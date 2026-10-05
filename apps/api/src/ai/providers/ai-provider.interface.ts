import type { DesignDocument } from '../document-types';

// The provider boundary described in docs/ARCHITECTURE.md §J: whatever
// generates a proposal — a stub today, a real Claude call once a key is
// configured — returns a structured plan, never raw document JSON. Actual
// wall/room/object geometry is always built by our own deterministic code
// (layout-builder.ts / edit-ops.ts), so a hallucinated coordinate can never
// reach the live document.

export interface AiCatalogAsset {
  id: string;
  name: string;
  category: string;
  defaultWidthMm: number;
  defaultDepthMm: number;
  defaultHeightMm: number;
  color: string;
}

export type RoomKind =
  | 'living'
  | 'dining'
  | 'kitchen'
  | 'bedroom'
  | 'bathroom'
  | 'garage'
  | 'study'
  | 'other';

export interface RoomProgramItem {
  name: string;
  kind: RoomKind;
  widthMm: number;
  lengthMm: number;
  // Free-text keywords the layout builder tries to match against the asset
  // catalog by name (e.g. "sofa", "double bed") — never asset IDs, since
  // the provider only sees catalog names, not our internal identifiers.
  furniture: string[];
}

export interface ProposedLayoutPlan {
  rooms: RoomProgramItem[];
  notes: string;
}

export type EditOpAnchor = 'window' | 'door' | 'room-center' | 'none';

export interface EditOp {
  op:
    | 'move_object'
    | 'resize_object'
    | 'recolor_object'
    | 'add_object'
    | 'remove_object'
    | 'rename_room'
    | 'resize_room'
    | 'set_construction_day';
  // Matched case-insensitively against existing object/room names, or
  // against the asset catalog's name for add_object.
  targetName: string;
  anchor?: EditOpAnchor;
  colorHex?: string;
  scaleFactor?: number;
  widthMm?: number;
  lengthMm?: number;
  newName?: string;
  constructionDay?: number;
}

export interface ProposedEditPlan {
  ops: EditOp[];
  notes: string;
}

export interface ProposeLayoutInput {
  prompt: string;
  catalog: AiCatalogAsset[];
}

export interface ProposeEditsInput {
  prompt: string;
  document: DesignDocument;
  catalog: AiCatalogAsset[];
}

export interface ProposeFromImageInput extends ProposeEditsInput {
  imageBase64: string;
  mimeType: string;
}

export interface AiProvider {
  readonly name: string;
  proposeLayout(input: ProposeLayoutInput): Promise<ProposedLayoutPlan>;
  proposeEdits(input: ProposeEditsInput): Promise<ProposedEditPlan>;
  proposeFromImage(input: ProposeFromImageInput): Promise<ProposedEditPlan>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
