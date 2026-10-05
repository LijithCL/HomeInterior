import { Injectable, Logger } from '@nestjs/common';
import type {
  AiProvider,
  EditOp,
  EditOpAnchor,
  ProposeEditsInput,
  ProposeFromImageInput,
  ProposeLayoutInput,
  ProposedEditPlan,
  ProposedLayoutPlan,
} from './ai-provider.interface';

const COLOR_NAMES: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  pink: '#ec4899',
  black: '#171717',
  white: '#f5f5f5',
  gray: '#9ca3af',
  grey: '#9ca3af',
  brown: '#92400e',
  beige: '#d6cbb8',
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// No network call, no cost — a deterministic, keyword-driven stand-in for
// the real AI. It exists so the proposal/preview/apply plumbing can be
// built and verified end-to-end without an Anthropic API key (see the
// architecture doc's AI section). AnthropicAiProvider implements the same
// interface; switching providers is a one-line change in ai-provider.factory.ts.
@Injectable()
export class StubAiProvider implements AiProvider {
  readonly name = 'stub';
  private readonly logger = new Logger(StubAiProvider.name);

  proposeLayout({ prompt }: ProposeLayoutInput): Promise<ProposedLayoutPlan> {
    this.logger.log(`[stub] proposeLayout: "${prompt}"`);
    const lower = prompt.toLowerCase();

    const bedroomMatch = lower.match(/(\d+)\s*-?\s*bed/);
    const bedrooms = clamp(bedroomMatch ? Number(bedroomMatch[1]) : 2, 1, 6);
    const bathroomMatch = lower.match(/(\d+)\s*-?\s*bath/);
    const bathrooms = clamp(
      bathroomMatch ? Number(bathroomMatch[1]) : Math.ceil(bedrooms / 2),
      1,
      bedrooms,
    );
    const wantsGarage = /garage/.test(lower);
    const wantsStudy = /study|office/.test(lower);
    const wantsDining = /dining/.test(lower) || bedrooms >= 3;

    const rooms: ProposedLayoutPlan['rooms'] = [
      {
        name: 'Living Room',
        kind: 'living',
        widthMm: 4500,
        lengthMm: 4000,
        furniture: ['sofa', 'tv unit', 'coffee table'],
      },
      {
        name: 'Kitchen',
        kind: 'kitchen',
        widthMm: 3500,
        lengthMm: 3000,
        furniture: ['refrigerator', 'kitchen counter'],
      },
    ];

    if (wantsDining) {
      rooms.push({
        name: 'Dining Room',
        kind: 'dining',
        widthMm: 3500,
        lengthMm: 3000,
        furniture: ['dining table', 'dining chair'],
      });
    }

    for (let i = 1; i <= bedrooms; i++) {
      const isMaster = i === 1;
      rooms.push({
        name: isMaster ? 'Master Bedroom' : `Bedroom ${i}`,
        kind: 'bedroom',
        widthMm: isMaster ? 4200 : 3600,
        lengthMm: isMaster ? 3800 : 3200,
        furniture: isMaster
          ? ['double bed', 'wardrobe']
          : ['single bed', 'wardrobe'],
      });
    }

    for (let i = 1; i <= bathrooms; i++) {
      rooms.push({
        name: bathrooms > 1 ? `Bathroom ${i}` : 'Bathroom',
        kind: 'bathroom',
        widthMm: 2400,
        lengthMm: 1800,
        furniture: ['toilet', 'sink'],
      });
    }

    if (wantsStudy) {
      rooms.push({
        name: 'Study',
        kind: 'study',
        widthMm: 3000,
        lengthMm: 2800,
        furniture: ['desk', 'chair'],
      });
    }

    if (wantsGarage) {
      rooms.push({
        name: 'Garage',
        kind: 'garage',
        widthMm: 6000,
        lengthMm: 3500,
        furniture: [],
      });
    }

    return Promise.resolve({
      rooms,
      notes: `Stub layout: ${bedrooms} bedroom(s), ${bathrooms} bathroom(s)${wantsDining ? ', dining room' : ''}${wantsStudy ? ', study' : ''}${wantsGarage ? ', garage' : ''}.`,
    });
  }

  proposeEdits({ prompt }: ProposeEditsInput): Promise<ProposedEditPlan> {
    this.logger.log(`[stub] proposeEdits: "${prompt}"`);
    return Promise.resolve({
      ops: parseEditOps(prompt),
      notes: `Stub edit parse of: "${prompt}"`,
    });
  }

  proposeFromImage({
    prompt,
  }: ProposeFromImageInput): Promise<ProposedEditPlan> {
    this.logger.log(`[stub] proposeFromImage, prompt: "${prompt || '(none)'}"`);
    // No vision capability in the stub — it can't actually look at the
    // photo. It still returns a plausible, deterministic suggestion so the
    // image-to-design plumbing (upload -> proposal -> preview -> apply) can
    // be exercised without a real vision-capable model.
    const fromPrompt = parseEditOps(prompt);
    const suggestions: EditOp[] = [
      { op: 'add_object', targetName: 'rug', anchor: 'room-center' },
      { op: 'add_object', targetName: 'floor lamp', anchor: 'room-center' },
    ];
    return Promise.resolve({
      ops: [...fromPrompt, ...suggestions],
      notes:
        "Stub photo suggestion: added a rug and a floor lamp to the largest room. (No real vision model configured — this does not reflect the photo's actual contents.)",
    });
  }
}

function parseEditOps(prompt: string): EditOp[] {
  const lower = prompt.toLowerCase();
  const ops: EditOp[] = [];

  for (const m of lower.matchAll(
    /move (?:the )?([a-z0-9 ]+?) (?:to|near|towards) (?:the )?(window|door|center|middle)/g,
  )) {
    const anchor: EditOpAnchor =
      m[2] === 'window' ? 'window' : m[2] === 'door' ? 'door' : 'room-center';
    ops.push({ op: 'move_object', targetName: m[1].trim(), anchor });
  }

  for (const m of lower.matchAll(
    /make (?:the )?([a-z0-9 ]+?) (bigger|larger|smaller)/g,
  )) {
    ops.push({
      op: 'resize_object',
      targetName: m[1].trim(),
      scaleFactor: m[2] === 'smaller' ? 0.7 : 1.3,
    });
  }

  for (const m of lower.matchAll(
    /(?:change|set|paint) (?:the )?([a-z0-9 ]+?)(?: colou?r)? to ([a-z]+)/g,
  )) {
    const hex = COLOR_NAMES[m[2]];
    if (hex)
      ops.push({
        op: 'recolor_object',
        targetName: m[1].trim(),
        colorHex: hex,
      });
  }

  for (const m of lower.matchAll(/remove (?:the )?([a-z0-9 ]+)/g)) {
    ops.push({ op: 'remove_object', targetName: m[1].trim() });
  }

  for (const m of lower.matchAll(
    /add (?:a |an |another )?([a-z0-9 ]+?)(?=[,.;]|$| and )/g,
  )) {
    const name = m[1]?.trim();
    if (name)
      ops.push({ op: 'add_object', targetName: name, anchor: 'room-center' });
  }

  return ops;
}
