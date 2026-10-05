// Reuses the same room taxonomy the AI layout generator already proposes
// against (see ai/providers/ai-provider.interface.ts RoomKind) so "kitchen"
// means the same thing whether a room got its name from a human or from
// buildDocumentFromPlan(). Classification is keyword-matching over the
// room's free-text name — there's no stored room-type column, so this is
// computed fresh from each project's latest document at query time.
export const ROOM_KINDS = [
  'living',
  'dining',
  'kitchen',
  'bedroom',
  'bathroom',
  'garage',
  'study',
  'other',
] as const;

export type RoomKind = (typeof ROOM_KINDS)[number];

const KEYWORDS: Record<Exclude<RoomKind, 'other'>, string[]> = {
  living: ['living', 'lounge', 'family room'],
  dining: ['dining'],
  kitchen: ['kitchen', 'kitchenette'],
  bedroom: ['bedroom', 'bed room', 'master suite', 'nursery'],
  bathroom: ['bathroom', 'bath room', 'washroom', 'toilet', 'powder room'],
  garage: ['garage', 'carport'],
  study: ['study', 'office', 'den'],
};

export function classifyRoomName(name: string): RoomKind {
  const lower = name.toLowerCase();
  for (const kind of ROOM_KINDS) {
    if (kind === 'other') continue;
    if (KEYWORDS[kind].some((keyword) => lower.includes(keyword))) return kind;
  }
  return 'other';
}
