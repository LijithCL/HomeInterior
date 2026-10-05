import { create } from 'zustand';
import { nanoid } from 'nanoid';
import {
  buildRectRoomWalls,
  createEmptyDocument,
  migrateDocument,
  polygonBounds,
  sanitizeDocument,
  DEFAULT_FLOOR_HEIGHT_MM,
  DEFAULT_OBJECT_CONSTRUCTION_DAY,
  DEFAULT_OPENING_CONSTRUCTION_DAY,
  DEFAULT_ROOM_CONSTRUCTION_DAY,
  DEFAULT_WALL_CONSTRUCTION_DAY,
  CONSTRUCTION_DAY_MAX,
  type DesignDocument,
  type Floor,
  type Point,
  type Room,
  type SceneObject,
  type Wall,
  type WallOpening,
} from './document';
import type { Comment } from './comment-types';

export type Tool = 'select' | 'wall' | 'room' | 'door' | 'window' | 'measure' | 'comment';

export type Selection =
  | { type: 'wall'; id: string }
  | { type: 'room'; id: string }
  | { type: 'opening'; id: string }
  | { type: 'object'; id: string }
  | null;

export type Unit = 'mm' | 'cm' | 'm' | 'ft';
export type ViewMode = '2D' | '3D';
export type GizmoMode = 'move' | 'rotate' | 'scale';
export type FloorViewMode = 'current' | 'all';

const MAX_HISTORY = 100;

interface EditorState {
  document: DesignDocument;
  activeFloorId: string;
  floorViewMode: FloorViewMode;
  selection: Selection;
  tool: Tool;
  snapEnabled: boolean;
  gridSizeMm: number;
  unit: Unit;
  dirty: boolean;
  past: DesignDocument[];
  future: DesignDocument[];
  viewMode: ViewMode;
  // A room the user asked to "step inside" (e.g. from the Rooms list) —
  // Scene3D consumes this once it (re-)mounts and moves the camera inside
  // that room, then clears it. Lives here rather than being called directly
  // on Scene3D's ref because the 3D view may not be mounted yet at the
  // moment of the request (e.g. triggered while still in the 2D view).
  pendingRoomFocusId: string | null;
  gizmoMode: GizmoMode;
  timeOfDayHours: number;
  timelineDay: number;
  // First-person walkthrough camera mode in the 3D view — pointer-lock
  // mouse-look + WASD movement instead of OrbitControls. A view concern
  // only, so it lives here rather than in Scene3D's own local state, since
  // the Toolbar button that toggles it is a sibling component.
  walkMode: boolean;
  // True only for the public /share/[token] viewer (§8) — Canvas/shapes and
  // Scene3D check this to disable every mutation entry point (dragging,
  // the 3D transform gizmo) while still allowing camera orbit/pan/zoom and
  // the day/night + construction-timeline sliders, which don't mutate the
  // document.
  readOnly: boolean;

  // Client-side cache of a project's pinned comments (§ collaboration) —
  // not part of DesignDocument/undo history, since comments are a
  // separate DB-backed resource (see apps/api/src/comments) fetched and
  // mutated through server actions, not saved with the design version.
  comments: Comment[];
  // A point the user just clicked with the Comment tool, waiting for its
  // body text before becoming a real Comment via createCommentAction.
  draftCommentPin: { floorId: string; x: number; y: number } | null;
  selectedCommentId: string | null;
  // Lives here rather than local state in CommentsPanel so that placing or
  // clicking a pin in Canvas/Scene3D (a sibling component) can pop the
  // panel open itself, instead of requiring the user to also click Comments.
  commentsPanelOpen: boolean;
  // Resolved signed URLs for each floor's underlay image, keyed by
  // Floor.underlayImageKey (not floorId — a key is stable across re-uploads
  // in a way that lets a stale cached URL for an old key just go unused).
  // Populated by EditorShell since resolving needs projectId; Canvas reads
  // straight from here so it doesn't need projectId threaded through props.
  underlayUrls: Record<string, string>;

  loadDocument: (doc: DesignDocument) => void;
  setReadOnly: (readOnly: boolean) => void;
  markSaved: () => void;
  setTool: (tool: Tool) => void;
  setSelection: (selection: Selection) => void;
  toggleSnap: () => void;
  setUnit: (unit: Unit) => void;
  setViewMode: (mode: ViewMode) => void;
  setPendingRoomFocus: (roomId: string | null) => void;
  setGizmoMode: (mode: GizmoMode) => void;
  setFloorViewMode: (mode: FloorViewMode) => void;
  setTimeOfDayHours: (hours: number) => void;
  setTimelineDay: (day: number) => void;
  toggleWalkMode: () => void;

  setComments: (comments: Comment[]) => void;
  setDraftCommentPin: (pin: { floorId: string; x: number; y: number } | null) => void;
  setSelectedCommentId: (id: string | null) => void;
  setCommentsPanelOpen: (open: boolean) => void;
  setUnderlayUrl: (key: string, url: string) => void;
  addCommentLocal: (comment: Comment) => void;
  updateCommentLocal: (id: string, patch: Partial<Comment>) => void;
  removeCommentLocal: (id: string) => void;

  undo: () => void;
  redo: () => void;

  setActiveFloor: (id: string) => void;
  addFloor: (name?: string) => string;
  removeFloor: (id: string) => void;
  renameFloor: (id: string, name: string) => void;
  setFloorHeight: (id: string, heightMm: number) => void;
  duplicateFloor: (id: string) => string | null;
  toggleFloorHidden: (id: string) => void;
  updateFloorUnderlay: (
    id: string,
    patch: Partial<Pick<Floor, 'underlayImageKey' | 'underlayWidthMm' | 'underlayX' | 'underlayY' | 'underlayOpacity'>>,
  ) => void;

  addWall: (wall: Omit<Wall, 'id' | 'floorId' | 'constructionDay'>) => string;
  updateWall: (id: string, patch: Partial<Omit<Wall, 'id'>>) => void;
  removeWall: (id: string) => void;
  duplicateWall: (id: string) => string | null;

  addRoom: (room: Omit<Room, 'id' | 'floorId' | 'constructionDay'>) => string;
  updateRoom: (id: string, patch: Partial<Omit<Room, 'id'>>) => void;
  removeRoom: (id: string) => void;
  addRectRoom: (corner1: Point, corner2: Point, thicknessMm: number, name: string) => string;
  resizeRoom: (id: string, widthMm: number, heightMm: number) => void;

  addOpening: (opening: Omit<WallOpening, 'id' | 'constructionDay'>) => string;
  updateOpening: (id: string, patch: Partial<Omit<WallOpening, 'id'>>) => void;
  removeOpening: (id: string) => void;

  addObject: (object: Omit<SceneObject, 'id' | 'floorId' | 'constructionDay'>) => string;
  updateObject: (id: string, patch: Partial<Omit<SceneObject, 'id'>>) => void;
  removeObject: (id: string) => void;
  duplicateObject: (id: string) => string | null;

  removeSelected: () => void;
}

function withHistory(state: EditorState): Pick<EditorState, 'past' | 'future'> {
  const past = [...state.past, state.document].slice(-MAX_HISTORY);
  return { past, future: [] };
}

function firstFloorId(doc: DesignDocument): string {
  return [...doc.floors].sort((a, b) => a.levelIndex - b.levelIndex)[0]?.id ?? 'floor-ground';
}

const initialDocument = createEmptyDocument();

export const useEditorStore = create<EditorState>((set, get) => ({
  document: initialDocument,
  activeFloorId: firstFloorId(initialDocument),
  floorViewMode: 'all',
  selection: null,
  tool: 'select',
  snapEnabled: true,
  gridSizeMm: 100,
  unit: 'm',
  dirty: false,
  past: [],
  future: [],
  viewMode: '2D',
  pendingRoomFocusId: null,
  gizmoMode: 'move',
  timeOfDayHours: 12,
  timelineDay: CONSTRUCTION_DAY_MAX,
  walkMode: false,
  readOnly: false,
  comments: [],
  draftCommentPin: null,
  selectedCommentId: null,
  commentsPanelOpen: false,
  underlayUrls: {},

  loadDocument: (doc) => {
    const sanitized = sanitizeDocument(migrateDocument(doc));
    set({
      document: sanitized,
      activeFloorId: firstFloorId(sanitized),
      past: [],
      future: [],
      dirty: false,
      selection: null,
    });
  },
  setReadOnly: (readOnly) => set({ readOnly }),
  markSaved: () => set({ dirty: false }),
  setTool: (tool) => set((s) => ({ tool, selection: null, draftCommentPin: tool === 'comment' ? s.draftCommentPin : null })),
  setSelection: (selection) => set({ selection }),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  setUnit: (unit) => set({ unit }),
  setViewMode: (viewMode) => set({ viewMode, selection: null }),
  setPendingRoomFocus: (pendingRoomFocusId) => set({ pendingRoomFocusId }),
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),
  setFloorViewMode: (floorViewMode) => set({ floorViewMode }),
  setTimeOfDayHours: (timeOfDayHours) => set({ timeOfDayHours }),
  setTimelineDay: (timelineDay) => set({ timelineDay }),
  toggleWalkMode: () => set((s) => ({ walkMode: !s.walkMode, selection: s.walkMode ? s.selection : null })),

  setComments: (comments) => set({ comments }),
  setDraftCommentPin: (draftCommentPin) => set({ draftCommentPin }),
  setSelectedCommentId: (selectedCommentId) => set({ selectedCommentId }),
  setCommentsPanelOpen: (commentsPanelOpen) => set({ commentsPanelOpen }),
  setUnderlayUrl: (key, url) => set((s) => ({ underlayUrls: { ...s.underlayUrls, [key]: url } })),
  addCommentLocal: (comment) => set((s) => ({ comments: [...s.comments, comment] })),
  updateCommentLocal: (id, patch) =>
    set((s) => ({ comments: s.comments.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  removeCommentLocal: (id) => set((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),

  undo: () =>
    set((s) => {
      const previous = s.past[s.past.length - 1];
      if (!previous) return s;
      return {
        document: previous,
        past: s.past.slice(0, -1),
        future: [s.document, ...s.future],
        dirty: true,
      };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return {
        document: next,
        past: [...s.past, s.document],
        future: s.future.slice(1),
        dirty: true,
      };
    }),

  setActiveFloor: (id) => set({ activeFloorId: id, selection: null }),

  addFloor: (name) => {
    const id = nanoid(8);
    set((s) => {
      const maxLevel = Math.max(...s.document.floors.map((f) => f.levelIndex), -1);
      const floor: Floor = {
        id,
        name: name ?? `Floor ${maxLevel + 2}`,
        levelIndex: maxLevel + 1,
        heightMm: DEFAULT_FLOOR_HEIGHT_MM,
      };
      return {
        ...withHistory(s),
        document: { ...s.document, floors: [...s.document.floors, floor] },
        activeFloorId: id,
        dirty: true,
      };
    });
    return id;
  },

  removeFloor: (id) =>
    set((s) => {
      if (s.document.floors.length <= 1) return s;
      const wallIdsOnFloor = new Set(s.document.walls.filter((w) => w.floorId === id).map((w) => w.id));
      const remainingFloors = s.document.floors.filter((f) => f.id !== id);
      return {
        ...withHistory(s),
        document: {
          ...s.document,
          floors: remainingFloors,
          walls: s.document.walls.filter((w) => w.floorId !== id),
          rooms: s.document.rooms.filter((r) => r.floorId !== id),
          objects: s.document.objects.filter((o) => o.floorId !== id),
          openings: s.document.openings.filter((o) => !wallIdsOnFloor.has(o.wallId)),
        },
        activeFloorId: s.activeFloorId === id ? firstFloorId({ ...s.document, floors: remainingFloors }) : s.activeFloorId,
        selection: null,
        dirty: true,
      };
    }),

  renameFloor: (id, name) =>
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        floors: s.document.floors.map((f) => (f.id === id ? { ...f, name } : f)),
      },
      dirty: true,
    })),

  setFloorHeight: (id, heightMm) =>
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        floors: s.document.floors.map((f) => (f.id === id ? { ...f, heightMm: Math.max(1000, heightMm) } : f)),
      },
      dirty: true,
    })),

  toggleFloorHidden: (id) =>
    set((s) => ({
      document: {
        ...s.document,
        floors: s.document.floors.map((f) => (f.id === id ? { ...f, hidden: !f.hidden } : f)),
      },
      dirty: true,
    })),

  // Not in undo history, same reasoning as toggleFloorHidden above — the
  // underlay is a drawing aid, not part of the actual design.
  updateFloorUnderlay: (id, patch) =>
    set((s) => ({
      document: {
        ...s.document,
        floors: s.document.floors.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      },
      dirty: true,
    })),

  duplicateFloor: (id) => {
    const state = get();
    const source = state.document.floors.find((f) => f.id === id);
    if (!source) return null;

    const newFloorId = nanoid(8);
    const wallIdMap = new Map<string, string>();
    const newWalls = state.document.walls
      .filter((w) => w.floorId === id)
      .map((w) => {
        const newId = nanoid(8);
        wallIdMap.set(w.id, newId);
        return { ...w, id: newId, floorId: newFloorId };
      });
    const newOpenings = state.document.openings
      .filter((o) => wallIdMap.has(o.wallId))
      .map((o) => ({ ...o, id: nanoid(8), wallId: wallIdMap.get(o.wallId)! }));
    const newRooms = state.document.rooms
      .filter((r) => r.floorId === id)
      .map((r) => ({
        ...r,
        id: nanoid(8),
        floorId: newFloorId,
        wallIds: r.wallIds.map((wid) => wallIdMap.get(wid) ?? wid),
      }));
    const newObjects = state.document.objects
      .filter((o) => o.floorId === id)
      .map((o) => ({ ...o, id: nanoid(8), floorId: newFloorId }));

    set((s) => {
      const maxLevel = Math.max(...s.document.floors.map((f) => f.levelIndex), -1);
      const newFloor: Floor = {
        id: newFloorId,
        name: `${source.name} (copy)`,
        levelIndex: maxLevel + 1,
        heightMm: source.heightMm,
      };
      return {
        ...withHistory(s),
        document: {
          ...s.document,
          floors: [...s.document.floors, newFloor],
          walls: [...s.document.walls, ...newWalls],
          openings: [...s.document.openings, ...newOpenings],
          rooms: [...s.document.rooms, ...newRooms],
          objects: [...s.document.objects, ...newObjects],
        },
        activeFloorId: newFloorId,
        dirty: true,
      };
    });
    return newFloorId;
  },

  addWall: (wall) => {
    const id = nanoid(8);
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        walls: [
          ...s.document.walls,
          { ...wall, id, floorId: s.activeFloorId, constructionDay: DEFAULT_WALL_CONSTRUCTION_DAY },
        ],
      },
      dirty: true,
    }));
    return id;
  },

  updateWall: (id, patch) =>
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        walls: s.document.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      },
      dirty: true,
    })),

  removeWall: (id) =>
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        walls: s.document.walls.filter((w) => w.id !== id),
        openings: s.document.openings.filter((o) => o.wallId !== id),
      },
      selection: null,
      dirty: true,
    })),

  duplicateWall: (id) => {
    const original = get().document.walls.find((w) => w.id === id);
    if (!original) return null;
    const newId = nanoid(8);
    const offset = 200;
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        walls: [
          ...s.document.walls,
          {
            ...original,
            id: newId,
            start: { x: original.start.x + offset, y: original.start.y + offset },
            end: { x: original.end.x + offset, y: original.end.y + offset },
          },
        ],
      },
      selection: { type: 'wall', id: newId },
      dirty: true,
    }));
    return newId;
  },

  addRoom: (room) => {
    const id = nanoid(8);
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        rooms: [
          ...s.document.rooms,
          { ...room, id, floorId: s.activeFloorId, constructionDay: DEFAULT_ROOM_CONSTRUCTION_DAY },
        ],
      },
      dirty: true,
    }));
    return id;
  },

  updateRoom: (id, patch) =>
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        rooms: s.document.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      },
      dirty: true,
    })),

  removeRoom: (id) =>
    set((s) => ({
      ...withHistory(s),
      document: { ...s.document, rooms: s.document.rooms.filter((r) => r.id !== id) },
      selection: null,
      dirty: true,
    })),

  addRectRoom: (corner1, corner2, thicknessMm, name) => {
    const floorId = get().activeFloorId;
    const { walls, polygon } = buildRectRoomWalls(corner1, corner2, thicknessMm, floorId, () => nanoid(8));
    const roomId = nanoid(8);
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        walls: [...s.document.walls, ...walls],
        rooms: [
          ...s.document.rooms,
          {
            id: roomId,
            floorId,
            name,
            polygon,
            wallIds: walls.map((w) => w.id),
            constructionDay: DEFAULT_ROOM_CONSTRUCTION_DAY,
          },
        ],
      },
      selection: { type: 'room', id: roomId },
      dirty: true,
    }));
    return roomId;
  },

  resizeRoom: (id, widthMm, heightMm) =>
    set((s) => {
      const room = s.document.rooms.find((r) => r.id === id);
      if (!room) return s;
      const bounds = polygonBounds(room.polygon);
      const { walls, polygon } = buildRectRoomWalls(
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.minX + widthMm, y: bounds.minY + heightMm },
        s.document.walls.find((w) => room.wallIds.includes(w.id))?.thicknessMm ?? 150,
        room.floorId,
        (() => {
          const ids = [...room.wallIds];
          return () => ids.shift() ?? nanoid(8);
        })(),
      );
      return {
        ...withHistory(s),
        document: {
          ...s.document,
          walls: s.document.walls.map((w) => walls.find((nw) => nw.id === w.id) ?? w),
          rooms: s.document.rooms.map((r) => (r.id === id ? { ...r, polygon } : r)),
        },
        dirty: true,
      };
    }),

  addOpening: (opening) => {
    const id = nanoid(8);
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        openings: [
          ...s.document.openings,
          { ...opening, id, constructionDay: DEFAULT_OPENING_CONSTRUCTION_DAY },
        ],
      },
      dirty: true,
    }));
    return id;
  },

  updateOpening: (id, patch) =>
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        openings: s.document.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      },
      dirty: true,
    })),

  removeOpening: (id) =>
    set((s) => ({
      ...withHistory(s),
      document: { ...s.document, openings: s.document.openings.filter((o) => o.id !== id) },
      selection: null,
      dirty: true,
    })),

  addObject: (object) => {
    const id = nanoid(8);
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        objects: [
          ...s.document.objects,
          { ...object, id, floorId: s.activeFloorId, constructionDay: DEFAULT_OBJECT_CONSTRUCTION_DAY },
        ],
      },
      dirty: true,
    }));
    return id;
  },

  updateObject: (id, patch) =>
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        objects: s.document.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      },
      dirty: true,
    })),

  removeObject: (id) =>
    set((s) => ({
      ...withHistory(s),
      document: { ...s.document, objects: s.document.objects.filter((o) => o.id !== id) },
      selection: null,
      dirty: true,
    })),

  duplicateObject: (id) => {
    const original = get().document.objects.find((o) => o.id === id);
    if (!original) return null;
    const newId = nanoid(8);
    set((s) => ({
      ...withHistory(s),
      document: {
        ...s.document,
        objects: [
          ...s.document.objects,
          { ...original, id: newId, x: original.x + 200, y: original.y + 200 },
        ],
      },
      selection: { type: 'object', id: newId },
      dirty: true,
    }));
    return newId;
  },

  removeSelected: () => {
    const selection = get().selection;
    if (!selection) return;
    if (selection.type === 'wall') get().removeWall(selection.id);
    if (selection.type === 'room') get().removeRoom(selection.id);
    if (selection.type === 'opening') get().removeOpening(selection.id);
    if (selection.type === 'object') get().removeObject(selection.id);
  },
}));
