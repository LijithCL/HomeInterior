import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type {
  AiCatalogAsset,
  AiProvider,
  ProposeEditsInput,
  ProposeFromImageInput,
  ProposeLayoutInput,
  ProposedEditPlan,
  ProposedLayoutPlan,
} from './ai-provider.interface';

const MODEL = 'claude-opus-4-8';

// Structured-output schemas the model is constrained to via forced tool use
// — it can only ever emit a room program / a list of discrete edit
// operations, never raw wall/room/object JSON. Real geometry is always
// built afterwards by layout-builder.ts / edit-ops.ts (see the interface's
// module comment). Not exercised until ANTHROPIC_API_KEY is set — see
// ai-provider.factory.ts — but written to the real API so switching it on
// later is a one-line change, not a rewrite.

const PROPOSE_LAYOUT_TOOL = {
  name: 'propose_layout',
  description:
    'Propose a room program for a house design: a list of rooms (name, kind, approximate size in millimeters) and the furniture each room should contain, described by free-text keywords matched against a catalog.',
  input_schema: {
    type: 'object' as const,
    properties: {
      rooms: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            kind: {
              type: 'string',
              enum: [
                'living',
                'dining',
                'kitchen',
                'bedroom',
                'bathroom',
                'garage',
                'study',
                'other',
              ],
            },
            widthMm: { type: 'integer', minimum: 1500, maximum: 12000 },
            lengthMm: { type: 'integer', minimum: 1500, maximum: 12000 },
            furniture: { type: 'array', items: { type: 'string' } },
          },
          required: ['name', 'kind', 'widthMm', 'lengthMm', 'furniture'],
        },
      },
      notes: {
        type: 'string',
        description:
          'One or two sentences summarizing the proposal for the user.',
      },
    },
    required: ['rooms', 'notes'],
    additionalProperties: false,
  },
};

const PROPOSE_EDITS_TOOL = {
  name: 'propose_edits',
  description:
    'Propose a list of discrete, deterministic edit operations against the existing design document. Each operation targets an existing object/room by name (case-insensitive) or, for add_object, a catalog asset name.',
  input_schema: {
    type: 'object' as const,
    properties: {
      ops: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            op: {
              type: 'string',
              enum: [
                'move_object',
                'resize_object',
                'recolor_object',
                'add_object',
                'remove_object',
                'rename_room',
                'resize_room',
                'set_construction_day',
              ],
            },
            targetName: { type: 'string' },
            anchor: {
              type: 'string',
              enum: ['window', 'door', 'room-center', 'none'],
            },
            colorHex: { type: 'string' },
            scaleFactor: { type: 'number' },
            widthMm: { type: 'integer' },
            lengthMm: { type: 'integer' },
            newName: { type: 'string' },
            constructionDay: { type: 'integer', minimum: 1, maximum: 120 },
          },
          required: ['op', 'targetName'],
        },
      },
      notes: {
        type: 'string',
        description:
          'One or two sentences summarizing the proposal for the user.',
      },
    },
    required: ['ops', 'notes'],
    additionalProperties: false,
  },
};

function catalogSummary(catalog: AiCatalogAsset[]): string {
  return catalog
    .map(
      (a) =>
        `- ${a.name} (${a.category}, ${a.defaultWidthMm}x${a.defaultDepthMm}mm)`,
    )
    .join('\n');
}

export class AnthropicAiProvider implements AiProvider {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicAiProvider.name);
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async proposeLayout({
    prompt,
    catalog,
  }: ProposeLayoutInput): Promise<ProposedLayoutPlan> {
    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system:
        'You are a residential architecture assistant for a home design tool. Given a plain-language brief, propose a sensible room program. You never specify exact coordinates — only approximate room sizes and furniture keywords; a deterministic layout engine places everything on a floor plan.',
      tools: [PROPOSE_LAYOUT_TOOL],
      tool_choice: { type: 'tool', name: 'propose_layout' },
      messages: [
        {
          role: 'user',
          content: `Brief: ${prompt}\n\nAvailable furniture/asset catalog (use these names for the "furniture" keywords when possible):\n${catalogSummary(catalog)}`,
        },
      ],
    });
    return this.extractToolInput<ProposedLayoutPlan>(message, 'propose_layout');
  }

  async proposeEdits({
    prompt,
    document,
    catalog,
  }: ProposeEditsInput): Promise<ProposedEditPlan> {
    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system:
        'You are a home design assistant. Given a scoped edit request and a summary of the current design, propose a list of discrete edit operations. Never invent coordinates — operations reference existing objects/rooms by name and an anchor (e.g. "near the window"); a deterministic engine resolves the exact position.',
      tools: [PROPOSE_EDITS_TOOL],
      tool_choice: { type: 'tool', name: 'propose_edits' },
      messages: [
        {
          role: 'user',
          content: `Edit request: ${prompt}\n\nCurrent objects: ${document.objects.map((o) => o.name).join(', ') || '(none)'}\nCurrent rooms: ${document.rooms.map((r) => r.name).join(', ') || '(none)'}\n\nAsset catalog (for add_object targetName):\n${catalogSummary(catalog)}`,
        },
      ],
    });
    return this.extractToolInput<ProposedEditPlan>(message, 'propose_edits');
  }

  async proposeFromImage({
    prompt,
    document,
    catalog,
    imageBase64,
    mimeType,
  }: ProposeFromImageInput): Promise<ProposedEditPlan> {
    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system:
        'You are a home design assistant with vision. Look at the uploaded room photo and propose edit operations (furniture to add, recolor, or rearrange) that would help recreate or improve on what you see, using only the provided asset catalog. Never invent coordinates — operations reference existing objects/rooms by name and an anchor; a deterministic engine resolves the exact position.',
      tools: [PROPOSE_EDITS_TOOL],
      tool_choice: { type: 'tool', name: 'propose_edits' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as
                  'image/png' | 'image/jpeg' | 'image/webp',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `User note (optional): ${prompt || '(none)'}\n\nCurrent rooms: ${document.rooms.map((r) => r.name).join(', ') || '(none)'}\n\nAsset catalog (for add_object targetName):\n${catalogSummary(catalog)}`,
            },
          ],
        },
      ],
    });
    return this.extractToolInput<ProposedEditPlan>(message, 'propose_edits');
  }

  private extractToolInput<T>(message: Anthropic.Message, toolName: string): T {
    if (message.stop_reason === 'refusal') {
      throw new Error('The AI declined to respond to this request.');
    }
    const block = message.content.find(
      (b) => b.type === 'tool_use' && b.name === toolName,
    );
    if (!block || block.type !== 'tool_use') {
      this.logger.error(
        `Expected a ${toolName} tool_use block, got stop_reason=${message.stop_reason}`,
      );
      throw new Error('The AI did not return a usable proposal.');
    }
    return block.input as T;
  }
}
