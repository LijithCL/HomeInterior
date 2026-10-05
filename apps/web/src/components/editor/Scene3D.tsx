'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, Html, Line, OrbitControls, PerspectiveCamera, TransformControls } from '@react-three/drei';
import * as THREE from 'three';

type OrbitControlsImpl = React.ComponentRef<typeof OrbitControls>;
import {
  DEFAULT_WALL_HEIGHT_MM,
  DEFAULT_WINDOW_SILL_MM,
  floorStackOffsetMm,
  pointAlongWall,
  polygonBounds,
  wallAngleRad,
  wallLengthMm,
  type Point,
  type Room,
  type SceneObject,
  type Wall,
  type WallOpening,
} from '@/lib/editor/document';
import { buildWallSegments } from '@/lib/editor/wall-geometry';
import { computeSunState } from '@/lib/editor/sun';
import { useEditorStore, type GizmoMode, type Unit } from '@/lib/editor/editor-store';
import { isWallLikeAssetName, type Asset } from '@/lib/editor/asset-types';
import { snapAngle, snapPointToWalls, snapToGrid, snapToWallEndpoints } from '@/lib/editor/snapping';
import { formatLength } from '@/lib/editor/units';
import { getMaterialCanvas } from '@/lib/editor/materials';
import { CategoryObjectModel, DoorFixture, WindowFixture } from './asset-models';

const OBJECT_DROP_GRID_MM = 50;
const WALL_HIT_HEIGHT_TOLERANCE_MM = 100;
const DEFAULT_WALL_THICKNESS_MM = 150;
const WALL_SNAP_THRESHOLD_MM = 150;

// The four independently draggable/settable numeric fields on a wall's
// vertical profile — top and base, each at the start and end point.
type WallHeightField = 'heightMm' | 'endHeightMm' | 'elevationMm' | 'endElevationMm';

const MM = 0.001; // scene units are meters; document units are millimeters
const WALL_COLOR = '#d8d2c4';
const FLOOR_COLOR = '#e9e4d8';
const GROUND_COLOR = '#7fa06a';
const CEILING_COLOR = '#f7f4ec';
// Rendered semi-transparent rather than solid: a solid ceiling at wall-top
// height would fully block the Top camera preset and any perspective once
// the camera rises above wall height, both of which are actively used for
// placing/inspecting objects.
const CEILING_OPACITY = 0.35;

function roomCeilingHeightMm(room: Room, walls: Wall[]): number {
  const heights = walls.filter((w) => room.wallIds.includes(w.id)).map((w) => w.heightMm);
  return heights.length > 0 ? Math.max(...heights) : DEFAULT_WALL_HEIGHT_MM;
}

function computeBounds(walls: Wall[]): { centerX: number; centerZ: number; radius: number } {
  const points = walls.flatMap((w) => [w.start, w.end]);
  if (points.length === 0) return { centerX: 0, centerZ: 0, radius: 5 };
  const b = polygonBounds(points);
  return {
    centerX: ((b.minX + b.maxX) / 2) * MM,
    centerZ: ((b.minY + b.maxY) / 2) * MM,
    radius: Math.max(3, Math.hypot(b.widthMm, b.heightMm) * MM * 0.7),
  };
}

interface Scene3DProps {
  assets: Asset[];
}

export interface Scene3DHandle {
  // Snapshot of the live canvas as a PNG data URL, or null if the canvas
  // isn't mounted/ready yet.
  capture(): string | null;
  // Moves the camera to frame a single room; returns false if the room
  // doesn't exist (e.g. it was deleted mid-walkthrough).
  frameRoom(roomId: string): boolean;
  // Moves the camera inside a room at standing eye height, near one interior
  // corner and looking toward its center — "step inside and look around",
  // as opposed to frameRoom's outside/elevated framing. Unlike Walk mode,
  // this keeps normal OrbitControls (and the selection/edit tools) active,
  // since the point is to see and edit the room's interior, not navigate
  // hands-free. Returns false if the room doesn't exist.
  enterRoom(roomId: string): boolean;
  resetView(): void;
}

const Scene3D = forwardRef<Scene3DHandle, Scene3DProps>(function Scene3D({ assets }, ref) {
  const document = useEditorStore((s) => s.document);
  const activeFloorId = useEditorStore((s) => s.activeFloorId);
  const floorViewMode = useEditorStore((s) => s.floorViewMode);
  const pendingRoomFocusId = useEditorStore((s) => s.pendingRoomFocusId);
  const setPendingRoomFocus = useEditorStore((s) => s.setPendingRoomFocus);
  const timeOfDayHours = useEditorStore((s) => s.timeOfDayHours);
  const setTimeOfDayHours = useEditorStore((s) => s.setTimeOfDayHours);
  const timelineDay = useEditorStore((s) => s.timelineDay);
  const sun = useMemo(() => computeSunState(timeOfDayHours), [timeOfDayHours]);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const removeSelected = useEditorStore((s) => s.removeSelected);
  const gizmoMode = useEditorStore((s) => s.gizmoMode);
  const updateObject = useEditorStore((s) => s.updateObject);
  const addObject = useEditorStore((s) => s.addObject);
  const addOpening = useEditorStore((s) => s.addOpening);
  const updateOpening = useEditorStore((s) => s.updateOpening);
  const addWall = useEditorStore((s) => s.addWall);
  const updateWall = useEditorStore((s) => s.updateWall);
  const readOnly = useEditorStore((s) => s.readOnly);
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const gridSizeMm = useEditorStore((s) => s.gridSizeMm);
  const unit = useEditorStore((s) => s.unit);
  const walkMode = useEditorStore((s) => s.walkMode);
  const toggleWalkMode = useEditorStore((s) => s.toggleWalkMode);
  const comments = useEditorStore((s) => s.comments);
  const selectedCommentId = useEditorStore((s) => s.selectedCommentId);
  const setSelectedCommentId = useEditorStore((s) => s.setSelectedCommentId);
  const draftCommentPin = useEditorStore((s) => s.draftCommentPin);
  const setDraftCommentPin = useEditorStore((s) => s.setDraftCommentPin);
  const setCommentsPanelOpen = useEditorStore((s) => s.setCommentsPanelOpen);

  const meshRefs = useRef<Map<string, THREE.Object3D>>(new Map());
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const dragRef = useRef<{ id: string; floorId: string; startX: number; startY: number } | null>(null);
  const [wallDraft, setWallDraft] = useState<{ start: Point; end: Point } | null>(null);
  const [measureSegments, setMeasureSegments] = useState<{ start: Point; end: Point }[]>([]);
  const [measureDraft, setMeasureDraft] = useState<{ start: Point; end: Point } | null>(null);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);

  const wallGroupRefs = useRef<Map<string, THREE.Object3D>>(new Map());
  // Whole-wall drag: translates start+end together, preserving length/angle.
  const wallDragRef = useRef<{
    id: string;
    floorId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    grabX: number;
    grabY: number;
  } | null>(null);
  // Endpoint drag (length/angle change): a live "draft" override for whichever
  // wall+end is being dragged, since — unlike the rigid whole-wall translate
  // above — changing one endpoint means recomputing the wall's segment
  // geometry every frame, not just repositioning a group.
  const [wallEndpointDraft, setWallEndpointDraft] = useState<{
    wallId: string;
    end: 'start' | 'end';
    point: Point;
  } | null>(null);

  // Door/window drag: slides the opening along its own wall — a live draft
  // (same reasoning as wallEndpointDraft) since the fixture's rendered
  // position is derived from offsetMm via buildWallSegments, not a plain
  // translation.
  const openingDragRef = useRef<{ id: string; wallId: string } | null>(null);
  const [openingDraft, setOpeningDraft] = useState<{ id: string; offsetMm: number } | null>(null);

  // Vertical drag of a wall's top-at-start / top-at-end / base (elevation)
  // handle — there's no floor plane to raycast against for a purely-vertical
  // drag, so this instead converts the pointer's vertical screen movement to
  // world-space meters using the same distance-and-fov scale OrbitControls
  // itself uses for a screen-space-correct drag (see handleSideScroll above),
  // captured once at drag start since the field being dragged only moves a
  // small amount relative to the camera.
  const wallHeightDragRef = useRef<{
    wallId: string;
    field: WallHeightField;
    startClientY: number;
    startValueMm: number;
    metersPerPixel: number;
  } | null>(null);
  const [wallHeightDraft, setWallHeightDraft] = useState<{
    wallId: string;
    field: WallHeightField;
    valueMm: number;
  } | null>(null);

  // Switching away from the Wall tool always drops any in-progress chain —
  // otherwise a half-drawn preview would linger after the user picks
  // Move/Rotate/Scale or flips back to the 2D view. Cleared during render
  // (not an effect) since this is "resetting state when a prop changes":
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastTool, setLastTool] = useState(tool);
  if (tool !== lastTool) {
    setLastTool(tool);
    if (tool !== 'wall') setWallDraft(null);
    if (tool !== 'measure') {
      setMeasureDraft(null);
      setMeasureSegments([]);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setWallDraft(null);
        setMeasureDraft(null);
        setMeasureSegments([]);
        setTool('select');
        if (walkMode) toggleWalkMode();
        return;
      }
      // Delete/Backspace previously only worked in the 2D view (Canvas.tsx) —
      // the Properties panel's own "Delete" button is the only way this
      // worked from 3D, since this file's keydown handler didn't wire the
      // key at all. Same isTyping guard as Canvas.tsx: the Properties
      // panel's inputs share this same global listener regardless of which
      // view is active, so backspacing a digit in a Width/Height field must
      // not also delete the selected object.
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (isTyping || walkMode) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSelected();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setTool, walkMode, toggleWalkMode, removeSelected]);

  const visibleFloorIds = useMemo(() => {
    if (floorViewMode === 'current') return new Set([activeFloorId]);
    return new Set(document.floors.filter((f) => !f.hidden).map((f) => f.id));
  }, [document.floors, floorViewMode, activeFloorId]);

  // 4D construction timeline: elements only appear once the scrubber passes
  // their constructionDay (§5/§E) — filtered on top of, not instead of, the
  // floor-visibility filter above.
  const visibleWalls = document.walls.filter(
    (w) => visibleFloorIds.has(w.floorId) && w.constructionDay <= timelineDay,
  );
  const visibleWallIds = new Set(visibleWalls.map((w) => w.id));
  const visibleRooms = document.rooms.filter(
    (r) => visibleFloorIds.has(r.floorId) && r.constructionDay <= timelineDay,
  );
  const visibleObjects = document.objects.filter(
    (o) => visibleFloorIds.has(o.floorId) && o.constructionDay <= timelineDay,
  );
  const visibleOpenings = document.openings.filter(
    (o) => visibleWallIds.has(o.wallId) && o.constructionDay <= timelineDay,
  );

  const floorOffsetMm = (floorId: string) => floorStackOffsetMm(document.floors, floorId);

  // Switching floors (the FloorTabs bar, or the timeline) never used to move
  // the camera at all — in "This floor" mode that hides every other floor's
  // geometry, so jumping from the ground floor to a floor stacked a few
  // metres up left the camera pointed at thin air, since only that floor's
  // now-elevated walls are visible and nothing was in frame. This nudges the
  // camera by exactly the vertical delta between the floor you were just on
  // and the one you switched to, preserving whatever pan/zoom/angle you'd
  // set up — the same spot, just on the new floor's level — rather than
  // resetting to a default framing the way the preset buttons do.
  const lastActiveFloorIdRef = useRef(activeFloorId);
  useEffect(() => {
    const prevFloorId = lastActiveFloorIdRef.current;
    lastActiveFloorIdRef.current = activeFloorId;
    if (prevFloorId === activeFloorId) return;
    // Both offsets are recomputed fresh from the current document.floors at
    // the moment of the switch (not cached) — tracking a cached "last
    // offset" number instead of the floor id would go stale the moment a
    // floor's own height is edited without switching away from it, since
    // nothing would refresh that cached number until the next switch,
    // producing a wrong delta on departure.
    const prevOffsetMm = floorStackOffsetMm(document.floors, prevFloorId);
    const nextOffsetMm = floorStackOffsetMm(document.floors, activeFloorId);
    const deltaMm = nextOffsetMm - prevOffsetMm;
    if (Math.abs(deltaMm) < 1) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const deltaY = deltaMm * MM;
    camera.position.y += deltaY;
    controls.target.y += deltaY;
    controls.update();
    // Only the active floor's own change should trigger a re-frame, not
    // every edit to document.floors (e.g. resizing a floor's height
    // shouldn't yank the camera while you're still looking at it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFloorId]);

  const selectedObject =
    selection?.type === 'object' ? document.objects.find((o) => o.id === selection.id) : undefined;
  // The gizmo's onMouseUp commit formula assumes every object sits at
  // `offsetMm + elevationMm + heightMm/2` (ObjectMesh's "centered" group
  // position) — a sloped wall-like object's group instead sits at `offsetMm`
  // only (see ObjectMesh), so that formula would back out a wrong, flattened
  // elevationMm from the gizmo's Y position and silently corrupt the slope
  // on every drag. Gate the elevationMm auto-commit off for these by simply
  // not handing the gizmo the base values it needs to compute it (see the
  // `baseOffsetMm !== undefined && baseHeightMm !== undefined` guard below).
  const selectedObjectAsset = selectedObject ? assets.find((a) => a.id === selectedObject.assetId) : undefined;
  const selectedObjectIsSloped =
    !!selectedObject &&
    isWallLikeAssetName(selectedObjectAsset?.name ?? selectedObject.name, selectedObjectAsset?.category) &&
    ((selectedObject.endHeightMm ?? selectedObject.heightMm ?? selectedObjectAsset?.defaultHeightMm ?? 800) !==
      (selectedObject.heightMm ?? selectedObjectAsset?.defaultHeightMm ?? 800) ||
      (selectedObject.endElevationMm ?? selectedObject.elevationMm ?? 0) !== (selectedObject.elevationMm ?? 0));

  const bounds = useMemo(() => computeBounds(document.walls), [document.walls]);
  // The camera's own starting position/target are frozen at whatever the
  // design's extent was when the 3D view first mounted — `bounds` itself
  // stays reactive (for the preset buttons, frameRoom, and the ground
  // plane), but PerspectiveCamera/OrbitControls treat their position/target
  // props as live, so binding them straight to `bounds` snapped the camera
  // back to the default framing distance on every edit (adding a wall,
  // moving furniture, anything that changes `document.walls`), discarding
  // whatever the user had manually orbited/zoomed to.
  const [initialBounds] = useState(() => computeBounds(document.walls));

  // Scrollbar-driven panning (world X / world Z — the same ground-plane
  // axes the 2D floor plan already pans along, so "left/right" and
  // "up/down" mean the same thing in both views instead of being relative
  // to wherever the camera currently happens to be facing). `panTarget`
  // mirrors OrbitControls' actual target so the thumbs remain correct even
  // when panning happens some other way (drag, side-scroll) — it's kept in
  // sync via the OrbitControls `onChange` callback below, not derived from
  // props, since panning is otherwise a purely imperative Three.js mutation
  // React never sees.
  const [panTarget, setPanTarget] = useState({ x: initialBounds.centerX, z: initialBounds.centerZ });
  const panRangeM = Math.max(initialBounds.radius * 4, 8);

  function syncPanTargetFromControls() {
    const t = controlsRef.current?.target;
    if (t) setPanTarget({ x: t.x, z: t.z });
  }

  function setPanAxis(axis: 'x' | 'z', value: number) {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const delta = value - controls.target[axis];
    camera.position[axis] += delta;
    controls.target[axis] = value;
    setPanTarget((p) => ({ ...p, [axis]: value }));
  }

  function applyPreset(preset: 'top' | 'front' | 'side' | 'reset') {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const { centerX, centerZ, radius } = bounds;

    if (preset === 'top') {
      camera.position.set(centerX, radius * 2.2, centerZ + 0.01);
    } else if (preset === 'front') {
      camera.position.set(centerX, radius * 0.5, centerZ + radius * 1.8);
    } else if (preset === 'side') {
      camera.position.set(centerX + radius * 1.8, radius * 0.5, centerZ);
    } else {
      camera.position.set(centerX + radius * 1.4, radius * 1.2, centerZ + radius * 1.4);
    }
    controls.target.set(centerX, radius * 0.3, centerZ);
    controls.update();
  }

  function frameRoom(roomId: string): boolean {
    const room = document.rooms.find((r) => r.id === roomId);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!room || !camera || !controls) return false;
    const b = polygonBounds(room.polygon);
    const centerX = ((b.minX + b.maxX) / 2) * MM;
    const centerZ = ((b.minY + b.maxY) / 2) * MM;
    const floorY = floorOffsetMm(room.floorId) * MM;
    const radius = Math.max(1.5, Math.hypot(b.widthMm, b.heightMm) * MM * 0.65);
    camera.position.set(centerX + radius * 1.3, floorY + radius * 1.1, centerZ + radius * 1.3);
    controls.target.set(centerX, floorY + radius * 0.35, centerZ);
    controls.update();
    return true;
  }

  function enterRoom(roomId: string): boolean {
    const room = document.rooms.find((r) => r.id === roomId);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!room || !camera || !controls) return false;
    const b = polygonBounds(room.polygon);
    const floorY = floorOffsetMm(room.floorId) * MM;
    const eyeY = floorY + 1.6;
    // Stand a little inside the room's corner, not right against the walls,
    // but small rooms shouldn't push the inset past their own midpoint.
    const insetMm = Math.min(800, Math.min(b.widthMm, b.heightMm) * 0.25);
    const centerX = ((b.minX + b.maxX) / 2) * MM;
    const centerZ = ((b.minY + b.maxY) / 2) * MM;
    camera.position.set((b.minX + insetMm) * MM, eyeY, (b.minY + insetMm) * MM);
    controls.target.set(centerX, eyeY, centerZ);
    controls.update();
    return true;
  }

  useImperativeHandle(ref, () => ({
    capture: () => {
      const el = canvasElRef.current;
      if (!el) return null;
      try {
        return el.toDataURL('image/png');
      } catch {
        return null;
      }
    },
    frameRoom,
    enterRoom,
    resetView: () => applyPreset('reset'),
  }));

  // Consumes a "step inside this room" request queued in the store (e.g.
  // from the Rooms list) — queued rather than called directly on this
  // component's ref because the request can be made while the 3D view isn't
  // mounted yet (switching from 2D triggers the request and the mount in
  // the same click), so there'd be no ref to call yet at request time.
  useEffect(() => {
    if (!pendingRoomFocusId) return;
    if (enterRoom(pendingRoomFocusId)) setPendingRoomFocus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRoomFocusId]);

  // Screen -> world ray for the drop point, via the same camera driving the canvas.
  function rayFromScreen(clientX: number, clientY: number, rect: DOMRect): THREE.Ray | null {
    const camera = cameraRef.current;
    if (!camera) return null;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    return raycaster.ray;
  }

  // For furniture/kitchen/etc: where the ray meets the floor the object sits on.
  function intersectFloorPlane(ray: THREE.Ray, planeYMeters: number): Point | null {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeYMeters);
    const hit = new THREE.Vector3();
    if (!ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x / MM, y: hit.z / MM };
  }

  // For doors/windows: a wall is a vertical surface, not the floor, so a
  // door/window drop has to hit one of the walls' own (infinite) vertical
  // planes rather than the floor plane — then get clamped to that wall's
  // actual segment/height, picking whichever wall is closest to the camera
  // when more than one plane is crossed.
  function findWallOpeningTarget(
    ray: THREE.Ray,
    walls: Wall[],
    floorYMeters: number,
  ): { wallId: string; offsetMm: number } | null {
    let best: { wallId: string; offsetMm: number; dist: number } | null = null;
    for (const wall of walls) {
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const length = Math.hypot(dx, dy);
      if (length < 1) continue;
      const dirX = dx / length;
      const dirY = dy / length;
      const normal = new THREE.Vector3(-dirY, 0, dirX);
      const planePoint = new THREE.Vector3(wall.start.x * MM, 0, wall.start.y * MM);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, planePoint);
      const hit = new THREE.Vector3();
      if (!ray.intersectPlane(plane, hit)) continue;

      const offsetMm = (hit.x / MM - wall.start.x) * dirX + (hit.z / MM - wall.start.y) * dirY;
      if (offsetMm < 0 || offsetMm > length) continue;

      // Relative to this wall's own base, which may float above the floor
      // (see Wall.elevationMm) — not just the floor plane itself.
      const relativeHeightMm = (hit.y - floorYMeters) / MM - (wall.elevationMm ?? 0);
      if (relativeHeightMm < -WALL_HIT_HEIGHT_TOLERANCE_MM || relativeHeightMm > wall.heightMm + WALL_HIT_HEIGHT_TOLERANCE_MM) {
        continue;
      }

      const dist = ray.origin.distanceTo(hit);
      if (!best || dist < best.dist) best = { wallId: wall.id, offsetMm, dist };
    }
    return best ? { wallId: best.wallId, offsetMm: best.offsetMm } : null;
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (readOnly) return;
    const raw = e.dataTransfer.getData('application/x-asset');
    if (!raw) return;
    const asset: Asset = JSON.parse(raw);
    const rect = e.currentTarget.getBoundingClientRect();
    const ray = rayFromScreen(e.clientX, e.clientY, rect);
    if (!ray) return;
    const floorYMeters = floorOffsetMm(activeFloorId) * MM;

    if (asset.category === 'DOOR' || asset.category === 'WINDOW') {
      const floorWalls = document.walls.filter((w) => w.floorId === activeFloorId);
      const target = findWallOpeningTarget(ray, floorWalls, floorYMeters);
      if (!target) return;
      const id = addOpening({
        wallId: target.wallId,
        type: asset.category,
        assetId: asset.id,
        offsetMm: target.offsetMm,
        widthMm: asset.defaultWidthMm,
        heightMm: asset.defaultHeightMm,
        sillHeightMm: asset.category === 'WINDOW' ? DEFAULT_WINDOW_SILL_MM : 0,
      });
      setSelection({ type: 'opening', id });
      return;
    }

    const worldPoint = intersectFloorPlane(ray, floorYMeters);
    if (!worldPoint) return;
    const snapped = snapToGrid(worldPoint, OBJECT_DROP_GRID_MM);
    const id = addObject({
      assetId: asset.id,
      name: asset.name,
      x: snapped.x,
      y: snapped.y,
      rotationDeg: 0,
      widthMm: asset.defaultWidthMm,
      depthMm: asset.defaultDepthMm,
      color: asset.color,
    });
    setSelection({ type: 'object', id });
  }

  // Direct click-and-drag repositioning of an already-placed object, as an
  // alternative to the axis-constrained TransformControls gizmo: grabbing the
  // object's own body moves it freely across the floor plane it sits on,
  // snapped to the same grid as the initial drop-to-place.
  function handleObjectPointerDown(object: SceneObject) {
    return (e: ThreeEvent<PointerEvent>) => {
      // Same reasoning as handleWallPointerDown/handleOpeningPointerDown: a
      // click landing on an object while a drawing/measuring tool is active
      // should fall through to the floor click handler, not select/drag it.
      if (tool !== 'select' || walkMode) return;
      e.stopPropagation();
      setSelection({ type: 'object', id: object.id });
      if (readOnly) return;
      dragRef.current = { id: object.id, floorId: object.floorId, startX: object.x, startY: object.y };
      if (controlsRef.current) controlsRef.current.enabled = false;
    };
  }

  function endObjectDrag() {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (controlsRef.current) controlsRef.current.enabled = true;
    const mesh = meshRefs.current.get(drag.id);
    if (!mesh) return;
    const x = mesh.position.x / MM;
    const y = mesh.position.z / MM;
    if (Math.abs(x - drag.startX) < 1e-6 && Math.abs(y - drag.startY) < 1e-6) return;
    updateObject(drag.id, { x, y });
  }

  // Click-and-drag on a wall's body (not an endpoint handle) translates the
  // whole wall, preserving its length/angle — the 3D equivalent of dragging
  // the wall's Line in the 2D view.
  function handleWallPointerDown(wall: Wall) {
    return (e: ThreeEvent<PointerEvent>) => {
      // Only the Select tool owns wall clicks — while drawing walls, a click
      // landing on an existing wall mesh should fall through to the floor
      // click handler instead of selecting/dragging this wall.
      if (tool !== 'select' || walkMode) return;
      e.stopPropagation();
      setSelection({ type: 'wall', id: wall.id });
      if (readOnly) return;
      wallDragRef.current = {
        id: wall.id,
        floorId: wall.floorId,
        startX: wall.start.x,
        startY: wall.start.y,
        endX: wall.end.x,
        endY: wall.end.y,
        grabX: e.point.x / MM,
        grabY: e.point.z / MM,
      };
      if (controlsRef.current) controlsRef.current.enabled = false;
    };
  }

  function endWallDrag() {
    const drag = wallDragRef.current;
    if (!drag) return;
    wallDragRef.current = null;
    if (controlsRef.current) controlsRef.current.enabled = true;
    const group = wallGroupRefs.current.get(drag.id);
    if (!group) return;
    let dxMm = group.position.x / MM;
    let dzMm = group.position.z / MM;
    if (snapEnabled) {
      dxMm = Math.round(dxMm / gridSizeMm) * gridSizeMm;
      dzMm = Math.round(dzMm / gridSizeMm) * gridSizeMm;
    }
    group.position.set(0, 0, 0);
    if (Math.abs(dxMm) < 1e-6 && Math.abs(dzMm) < 1e-6) return;
    updateWall(drag.id, {
      start: { x: drag.startX + dxMm, y: drag.startY + dzMm },
      end: { x: drag.endX + dxMm, y: drag.endY + dzMm },
    });
  }

  // Dragging an endpoint handle changes the wall's length/angle — mirrors the
  // 2D endpoint circles, using the same wall-aware snapping (no angle-lock,
  // matching Canvas.tsx's onDragHandle) so it can reconnect to other walls.
  function handleWallEndpointPointerDown(wall: Wall, end: 'start' | 'end') {
    return (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (readOnly) return;
      setWallEndpointDraft({ wallId: wall.id, end, point: wall[end] });
      if (controlsRef.current) controlsRef.current.enabled = false;
    };
  }

  function endWallEndpointDrag() {
    if (!wallEndpointDraft) return;
    const { wallId, end, point } = wallEndpointDraft;
    setWallEndpointDraft(null);
    if (controlsRef.current) controlsRef.current.enabled = true;
    updateWall(wallId, end === 'start' ? { start: point } : { end: point });
  }

  // Vertical drag on one of a wall's four corner handles (top-start,
  // top-end, base-start, base-end) — grabbing and dragging the handle up or
  // down in the 3D view directly, as an alternative to typing into the
  // Height (start/end)/Elevation (start/end) fields.
  function wallFieldValue(wall: Wall, field: WallHeightField): number {
    if (field === 'heightMm') return wall.heightMm;
    if (field === 'endHeightMm') return wall.endHeightMm ?? wall.heightMm;
    if (field === 'elevationMm') return wall.elevationMm ?? 0;
    return wall.endElevationMm ?? wall.elevationMm ?? 0;
  }

  function handleWallHeightHandlePointerDown(wall: Wall, field: WallHeightField) {
    return (e: ThreeEvent<PointerEvent>) => {
      if (tool !== 'select' || walkMode) return;
      e.stopPropagation();
      setSelection({ type: 'wall', id: wall.id });
      if (readOnly) return;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const rect = canvasElRef.current?.getBoundingClientRect();
      if (!camera || !controls || !rect) return;
      const distance = camera.position.distanceTo(controls.target);
      const metersPerPixel = (2 * distance * Math.tan((camera.fov / 2) * (Math.PI / 180))) / rect.height;
      const startValueMm = wallFieldValue(wall, field);
      wallHeightDragRef.current = { wallId: wall.id, field, startClientY: e.clientY, startValueMm, metersPerPixel };
      setWallHeightDraft({ wallId: wall.id, field, valueMm: startValueMm });
      controls.enabled = false;
    };
  }

  function endWallHeightDrag() {
    const drag = wallHeightDragRef.current;
    if (!drag) return;
    wallHeightDragRef.current = null;
    if (controlsRef.current) controlsRef.current.enabled = true;
    if (wallHeightDraft && wallHeightDraft.wallId === drag.wallId && wallHeightDraft.field === drag.field) {
      const valueMm = wallHeightDraft.valueMm;
      if (drag.field === 'heightMm') updateWall(drag.wallId, { heightMm: valueMm });
      else if (drag.field === 'endHeightMm') updateWall(drag.wallId, { endHeightMm: valueMm });
      else if (drag.field === 'elevationMm') updateWall(drag.wallId, { elevationMm: valueMm });
      else updateWall(drag.wallId, { endElevationMm: valueMm });
    }
    setWallHeightDraft(null);
  }

  function endAllDrags() {
    endObjectDrag();
    endWallDrag();
    endWallEndpointDrag();
    endWallHeightDrag();
    endOpeningDrag();
  }

  // OrbitControls' own wheel listener only ever reads deltaY (vertical
  // scroll) for zoom — it has no concept of deltaX at all, so a trackpad's
  // horizontal two-finger swipe (or a mouse's tilt-wheel) did nothing here,
  // unlike the 2D canvas where plain scroll already pans in every
  // direction. This adds just the missing side-to-side half: pan the
  // camera and its orbit target together along the camera's own local
  // right axis, scaled the same screen-space-correct way OrbitControls
  // scales its right-drag pan (distance-to-target × fov), so a given
  // scroll amount feels consistent whether zoomed in close or far out.
  function handleSideScroll(e: React.WheelEvent<HTMLDivElement>) {
    if (walkMode || Math.abs(e.deltaX) < 1) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const distance = camera.position.distanceTo(controls.target);
    const panScale = (2 * distance * Math.tan((camera.fov / 2) * (Math.PI / 180))) / rect.height;

    const right = new THREE.Vector3();
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    right.multiplyScalar(e.deltaX * panScale);

    camera.position.add(right);
    controls.target.add(right);
  }

  // Doors/windows previously had no click handler at all in 3D — once
  // deselected (or after reloading the project), there was no way back to
  // their Width/Position fields in the properties panel. Clicking now also
  // starts a drag-along-the-wall, mirroring the 2D opening drag.
  function handleOpeningPointerDown(opening: WallOpening) {
    return (e: ThreeEvent<PointerEvent>) => {
      if (tool !== 'select' || walkMode) return;
      e.stopPropagation();
      setSelection({ type: 'opening', id: opening.id });
      if (readOnly) return;
      openingDragRef.current = { id: opening.id, wallId: opening.wallId };
      setOpeningDraft({ id: opening.id, offsetMm: opening.offsetMm });
      if (controlsRef.current) controlsRef.current.enabled = false;
    };
  }

  function endOpeningDrag() {
    const drag = openingDragRef.current;
    if (!drag) return;
    openingDragRef.current = null;
    if (controlsRef.current) controlsRef.current.enabled = true;
    if (openingDraft?.id === drag.id) updateOpening(drag.id, { offsetMm: openingDraft.offsetMm });
    setOpeningDraft(null);
  }

  // Mirrors Canvas.tsx's 2D wall tool: snap to nearby wall lines first, then
  // wall endpoints, then the grid — with an angle lock to the previous point
  // once one is given, so chained segments come out straight.
  function applyWallSnap(point: Point, referencePoint?: Point): Point {
    if (!snapEnabled) return point;
    const floorWalls = document.walls.filter((w) => w.floorId === activeFloorId);
    const wallSnap = snapPointToWalls(point, floorWalls, WALL_SNAP_THRESHOLD_MM);
    if (wallSnap) return wallSnap.point;
    const endpointSnap = snapToWallEndpoints(point, floorWalls, WALL_SNAP_THRESHOLD_MM);
    if (endpointSnap) return endpointSnap;
    let snapped = snapToGrid(point, gridSizeMm);
    if (referencePoint) snapped = snapAngle(referencePoint, snapped);
    return snapped;
  }

  // Wall tool in 3D: click-click-click like the 2D tool — the first click
  // starts a chain, each click after that commits a segment from the last
  // point and keeps drawing from its endpoint. Escape (handled above) or
  // switching tools ends the chain.
  function handleFloorClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((tool !== 'wall' && tool !== 'measure' && tool !== 'comment') || readOnly || walkMode) return;
    // A native "click" still fires after a small drag — ignore it here so
    // orbiting the camera with the Wall tool active doesn't drop a point.
    const down = pointerDownPosRef.current;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ray = rayFromScreen(e.clientX, e.clientY, rect);
    if (!ray) return;
    const worldPoint = intersectFloorPlane(ray, floorOffsetMm(activeFloorId) * MM);
    if (!worldPoint) return;

    if (tool === 'measure') {
      const point = applyWallSnap(worldPoint, measureDraft?.start);
      if (!measureDraft) {
        setMeasureDraft({ start: point, end: point });
      } else {
        setMeasureSegments((segs) => [...segs, { start: measureDraft.start, end: point }]);
        setMeasureDraft({ start: point, end: point });
      }
      return;
    }

    if (tool === 'comment') {
      setTool('select');
      setDraftCommentPin({ floorId: activeFloorId, x: Math.round(worldPoint.x), y: Math.round(worldPoint.y) });
      setSelectedCommentId(null);
      setCommentsPanelOpen(true);
      return;
    }

    if (!wallDraft) {
      const start = applyWallSnap(worldPoint);
      setWallDraft({ start, end: start });
      return;
    }
    const end = applyWallSnap(worldPoint, wallDraft.start);
    addWall({ start: wallDraft.start, end, thicknessMm: DEFAULT_WALL_THICKNESS_MM, heightMm: DEFAULT_WALL_HEIGHT_MM });
    setWallDraft({ start: end, end });
  }

  return (
    <div
      className="relative h-full w-full bg-neutral-200"
      onDrop={handleDrop}
      onDragOver={(e) => {
        if (!readOnly) e.preventDefault();
      }}
      onClick={handleFloorClick}
      onPointerDownCapture={(e) => {
        pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (walkMode) return;
        const drag = dragRef.current;
        if (drag) {
          const rect = e.currentTarget.getBoundingClientRect();
          const ray = rayFromScreen(e.clientX, e.clientY, rect);
          if (!ray) return;
          const floorYMeters = floorOffsetMm(drag.floorId) * MM;
          const worldPoint = intersectFloorPlane(ray, floorYMeters);
          if (!worldPoint) return;
          const snapped = snapToGrid(worldPoint, OBJECT_DROP_GRID_MM);
          const mesh = meshRefs.current.get(drag.id);
          if (mesh) {
            mesh.position.x = snapped.x * MM;
            mesh.position.z = snapped.y * MM;
          }
          return;
        }

        const wallDrag = wallDragRef.current;
        if (wallDrag) {
          const rect = e.currentTarget.getBoundingClientRect();
          const ray = rayFromScreen(e.clientX, e.clientY, rect);
          if (!ray) return;
          const floorYMeters = floorOffsetMm(wallDrag.floorId) * MM;
          const worldPoint = intersectFloorPlane(ray, floorYMeters);
          if (!worldPoint) return;
          const group = wallGroupRefs.current.get(wallDrag.id);
          if (group) {
            group.position.set((worldPoint.x - wallDrag.grabX) * MM, 0, (worldPoint.y - wallDrag.grabY) * MM);
          }
          return;
        }

        if (wallEndpointDraft) {
          const wall = document.walls.find((w) => w.id === wallEndpointDraft.wallId);
          if (!wall) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ray = rayFromScreen(e.clientX, e.clientY, rect);
          if (!ray) return;
          const worldPoint = intersectFloorPlane(ray, floorOffsetMm(wall.floorId) * MM);
          if (!worldPoint) return;
          setWallEndpointDraft({ ...wallEndpointDraft, point: applyWallSnap(worldPoint) });
          return;
        }

        const heightDrag = wallHeightDragRef.current;
        if (heightDrag) {
          const deltaPx = e.clientY - heightDrag.startClientY;
          // Screen down = world down, so a downward drag (positive deltaPx)
          // should shrink the value, an upward drag should grow it.
          const deltaMm = -deltaPx * heightDrag.metersPerPixel * 1000;
          const min = heightDrag.field === 'elevationMm' || heightDrag.field === 'endElevationMm' ? 0 : 300;
          const valueMm = Math.max(min, heightDrag.startValueMm + deltaMm);
          setWallHeightDraft({ wallId: heightDrag.wallId, field: heightDrag.field, valueMm });
          return;
        }

        const openingDrag = openingDragRef.current;
        if (openingDrag) {
          const wall = document.walls.find((w) => w.id === openingDrag.wallId);
          const opening = document.openings.find((o) => o.id === openingDrag.id);
          if (!wall || !opening) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ray = rayFromScreen(e.clientX, e.clientY, rect);
          if (!ray) return;
          const target = findWallOpeningTarget(ray, [wall], floorOffsetMm(wall.floorId) * MM);
          if (!target) return; // dragged off the wall's own segment — hold the last valid position
          const wallLen = wallLengthMm(wall);
          const halfW = opening.widthMm / 2;
          let offsetMm = target.offsetMm;
          if (snapEnabled) offsetMm = Math.round(offsetMm / gridSizeMm) * gridSizeMm;
          offsetMm = Math.min(Math.max(offsetMm, halfW), Math.max(halfW, wallLen - halfW));
          setOpeningDraft({ id: openingDrag.id, offsetMm });
          return;
        }

        if (tool === 'wall' && wallDraft) {
          const rect = e.currentTarget.getBoundingClientRect();
          const ray = rayFromScreen(e.clientX, e.clientY, rect);
          if (!ray) return;
          const worldPoint = intersectFloorPlane(ray, floorOffsetMm(activeFloorId) * MM);
          if (!worldPoint) return;
          setWallDraft({ start: wallDraft.start, end: applyWallSnap(worldPoint, wallDraft.start) });
        }

        if (tool === 'measure' && measureDraft) {
          const rect = e.currentTarget.getBoundingClientRect();
          const ray = rayFromScreen(e.clientX, e.clientY, rect);
          if (!ray) return;
          const worldPoint = intersectFloorPlane(ray, floorOffsetMm(activeFloorId) * MM);
          if (!worldPoint) return;
          setMeasureDraft({ start: measureDraft.start, end: applyWallSnap(worldPoint, measureDraft.start) });
        }
      }}
      onPointerUp={endAllDrags}
      onPointerLeave={endAllDrags}
      onWheel={handleSideScroll}
    >
      <Canvas
        shadows
        gl={{ preserveDrawingBuffer: true }}
        onCreated={(state) => {
          canvasElRef.current = state.gl.domElement;
        }}
        onPointerMissed={() => setSelection(null)}
      >
        <color attach="background" args={[sun.skyColor]} />
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault
          position={[initialBounds.radius * 1.4, initialBounds.radius * 1.2, initialBounds.radius * 1.4]}
          fov={50}
        />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!walkMode}
          target={[initialBounds.centerX, initialBounds.radius * 0.3, initialBounds.centerZ]}
          onChange={syncPanTargetFromControls}
        />
        <WalkthroughControls active={walkMode} eyeHeightMeters={floorOffsetMm(activeFloorId) * MM + 1.6} controlsRef={controlsRef} />

        <mesh position={[bounds.centerX, -0.02, bounds.centerZ]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[bounds.radius * 8, bounds.radius * 8]} />
          <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
        </mesh>

        <ambientLight intensity={sun.ambientIntensity} color={sun.ambientColor} />
        <directionalLight
          position={[bounds.centerX + sun.sunPosition[0], sun.sunPosition[1], bounds.centerZ + sun.sunPosition[2]]}
          intensity={sun.sunIntensity}
          color={sun.sunColor}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />

        {visibleRooms.map((room) => (
          <RoomFloor key={room.id} room={room} offsetMm={floorOffsetMm(room.floorId)} />
        ))}

        {visibleRooms.map((room) => (
          <CeilingMesh
            key={`ceiling-${room.id}`}
            room={room}
            offsetMm={floorOffsetMm(room.floorId)}
            heightMm={roomCeilingHeightMm(room, document.walls)}
          />
        ))}

        {visibleWalls.map((wall) => {
          const isSelected = selection?.type === 'wall' && selection.id === wall.id;
          let effectiveWall =
            wallEndpointDraft?.wallId === wall.id ? { ...wall, [wallEndpointDraft.end]: wallEndpointDraft.point } : wall;
          if (wallHeightDraft?.wallId === wall.id) {
            const v = wallHeightDraft.valueMm;
            if (wallHeightDraft.field === 'heightMm') effectiveWall = { ...effectiveWall, heightMm: v };
            else if (wallHeightDraft.field === 'endHeightMm') effectiveWall = { ...effectiveWall, endHeightMm: v };
            else if (wallHeightDraft.field === 'elevationMm') effectiveWall = { ...effectiveWall, elevationMm: v };
            else effectiveWall = { ...effectiveWall, endElevationMm: v };
          }
          return (
            <WallMesh
              key={wall.id}
              wall={effectiveWall}
              openings={visibleOpenings
                .filter((o) => o.wallId === wall.id)
                .map((o) => (openingDraft?.id === o.id ? { ...o, offsetMm: openingDraft.offsetMm } : o))}
              offsetMm={floorOffsetMm(wall.floorId)}
              assets={assets}
              isSelected={isSelected}
              showHandles={!readOnly && tool === 'select' && isSelected}
              wallRef={(group) => {
                if (group) wallGroupRefs.current.set(wall.id, group);
                else wallGroupRefs.current.delete(wall.id);
              }}
              onPointerDown={handleWallPointerDown(wall)}
              onEndpointPointerDown={(end) => handleWallEndpointPointerDown(wall, end)}
              onHeightHandlePointerDown={(field) => handleWallHeightHandlePointerDown(wall, field)}
              selectedOpeningId={selection?.type === 'opening' ? selection.id : null}
              onOpeningPointerDown={handleOpeningPointerDown}
            />
          );
        })}

        {wallDraft && (
          <WallDraftPreview
            start={wallDraft.start}
            end={wallDraft.end}
            offsetMm={floorOffsetMm(activeFloorId)}
            thicknessMm={DEFAULT_WALL_THICKNESS_MM}
            heightMm={DEFAULT_WALL_HEIGHT_MM}
          />
        )}

        {measureSegments.map((seg, i) => (
          <MeasureLine3D
            key={`measure-${i}`}
            start={seg.start}
            end={seg.end}
            offsetMm={floorOffsetMm(activeFloorId)}
            unit={unit}
          />
        ))}
        {measureDraft && (
          <MeasureLine3D
            start={measureDraft.start}
            end={measureDraft.end}
            offsetMm={floorOffsetMm(activeFloorId)}
            unit={unit}
            live
          />
        )}

        {comments
          .filter((c) => c.floorId && visibleFloorIds.has(c.floorId) && c.x != null && c.y != null)
          .map((c) => (
            <CommentPin3D
              key={c.id}
              point={{ x: c.x as number, y: c.y as number }}
              offsetMm={floorOffsetMm(c.floorId as string)}
              resolved={c.resolved}
              isSelected={selectedCommentId === c.id}
              onSelect={() => {
                setSelectedCommentId(c.id);
                setCommentsPanelOpen(true);
              }}
            />
          ))}
        {draftCommentPin && visibleFloorIds.has(draftCommentPin.floorId) && (
          <CommentPin3D
            point={{ x: draftCommentPin.x, y: draftCommentPin.y }}
            offsetMm={floorOffsetMm(draftCommentPin.floorId)}
            resolved={false}
            isSelected
            onSelect={() => {}}
          />
        )}

        {visibleObjects.map((object) => (
          <ObjectMesh
            key={object.id}
            object={object}
            asset={assets.find((a) => a.id === object.assetId)}
            offsetMm={floorOffsetMm(object.floorId)}
            isSelected={selection?.type === 'object' && selection.id === object.id}
            meshRef={(mesh) => {
              if (mesh) meshRefs.current.set(object.id, mesh);
              else meshRefs.current.delete(object.id);
            }}
            onPointerDown={handleObjectPointerDown(object)}
          />
        ))}

        {/* No transform gizmo at all in the read-only viewer (§8's public
            share link) — orbit/pan/zoom via OrbitControls above still
            works, but nothing here can mutate the document. */}
        {!readOnly && (
          <SelectionGizmo
            selectedId={selection?.type === 'object' ? selection.id : null}
            meshRefs={meshRefs}
            mode={gizmoMode}
            onCommit={(id, attrs) => updateObject(id, attrs)}
            controlsRef={controlsRef}
            baseWidthMm={selectedObject?.widthMm}
            baseDepthMm={selectedObject?.depthMm}
            baseOffsetMm={
              selectedObject && !selectedObjectIsSloped ? floorOffsetMm(selectedObject.floorId) : undefined
            }
            baseHeightMm={
              selectedObject && !selectedObjectIsSloped
                ? (assets.find((a) => a.id === selectedObject.assetId)?.defaultHeightMm ?? 800)
                : undefined
            }
          />
        )}
      </Canvas>

      {!walkMode && <CameraPresetOverlay onPreset={applyPreset} />}
      {!walkMode && <TimeOfDaySlider hours={timeOfDayHours} onChange={setTimeOfDayHours} />}
      {!walkMode && (
        <PanScrollbars
          x={panTarget.x}
          z={panTarget.z}
          centerX={initialBounds.centerX}
          centerZ={initialBounds.centerZ}
          rangeM={panRangeM}
          onChangeX={(v) => setPanAxis('x', v)}
          onChangeZ={(v) => setPanAxis('z', v)}
        />
      )}
      {walkMode && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-xs font-medium text-white">
          Click to look around · WASD or arrow keys to move · Esc to exit
        </div>
      )}
    </div>
  );
});

export default Scene3D;

function RoomFloor({ room, offsetMm }: { room: Room; offsetMm: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(room.polygon.map((p) => new THREE.Vector2(p.x * MM, -p.y * MM)));
    return new THREE.ShapeGeometry(shape);
  }, [room.polygon]);

  const floorTexture = useMemo(() => {
    if (!room.floorMaterialId) return null;
    const canvas = getMaterialCanvas(room.floorMaterialId);
    if (!canvas) return null;
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    const bounds = polygonBounds(room.polygon);
    texture.repeat.set(Math.max(1, bounds.widthMm / 500), Math.max(1, bounds.heightMm / 500));
    return texture;
  }, [room.floorMaterialId, room.polygon]);

  return (
    <mesh geometry={geometry} position={[0, offsetMm * MM, 0]} rotation-x={-Math.PI / 2} receiveShadow>
      <meshStandardMaterial
        color={floorTexture ? '#ffffff' : FLOOR_COLOR}
        map={floorTexture ?? undefined}
        roughness={0.9}
      />
    </mesh>
  );
}

function CeilingMesh({ room, offsetMm, heightMm }: { room: Room; offsetMm: number; heightMm: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(room.polygon.map((p) => new THREE.Vector2(p.x * MM, -p.y * MM)));
    return new THREE.ShapeGeometry(shape);
  }, [room.polygon]);

  return (
    <mesh geometry={geometry} position={[0, (offsetMm + heightMm) * MM, 0]} rotation-x={-Math.PI / 2}>
      <meshStandardMaterial
        color={room.ceilingColor ?? CEILING_COLOR}
        roughness={0.95}
        transparent
        opacity={CEILING_OPACITY}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function WallDraftPreview({
  start,
  end,
  offsetMm,
  thicknessMm,
  heightMm,
}: {
  start: Point;
  end: Point;
  offsetMm: number;
  thicknessMm: number;
  heightMm: number;
}) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthMeters = Math.max(0.05, Math.hypot(dx, dy) * MM);
  const angle = Math.atan2(dy, dx);
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  return (
    <group>
      <mesh
        position={[midX * MM, (offsetMm + heightMm / 2) * MM, midY * MM]}
        rotation-y={-angle}
      >
        <boxGeometry args={[lengthMeters, heightMm * MM, thicknessMm * MM]} />
        <meshStandardMaterial color="#2563eb" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh position={[start.x * MM, offsetMm * MM + 0.08, start.y * MM]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color="#2563eb" />
      </mesh>
      <mesh position={[end.x * MM, offsetMm * MM + 0.08, end.y * MM]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color="#2563eb" />
      </mesh>
    </group>
  );
}

function MeasureLine3D({
  start,
  end,
  offsetMm,
  unit,
  live,
}: {
  start: Point;
  end: Point;
  offsetMm: number;
  unit: Unit;
  live?: boolean;
}) {
  const y = offsetMm * MM + 0.08;
  const a = new THREE.Vector3(start.x * MM, y, start.y * MM);
  const b = new THREE.Vector3(end.x * MM, y, end.y * MM);
  const mid = a.clone().lerp(b, 0.5);
  const distanceMm = Math.hypot(end.x - start.x, end.y - start.y);
  const color = live ? '#f59e0b' : '#dc2626';
  return (
    <group>
      <Line points={[a, b]} color={color} lineWidth={2} dashed dashSize={0.12} gapSize={0.08} />
      <mesh position={a}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={b}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Html position={[mid.x, mid.y + 0.15, mid.z]} center distanceFactor={8}>
        <div
          style={{
            background: 'white',
            border: `2px solid ${color}`,
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 700,
            color,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {formatLength(distanceMm, unit)}
        </div>
      </Html>
    </group>
  );
}

function CommentPin3D({
  point,
  offsetMm,
  resolved,
  isSelected,
  onSelect,
}: {
  point: Point;
  offsetMm: number;
  resolved: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const color = resolved ? '#a3a3a3' : '#e8734a';
  const y = offsetMm * MM + 1.2;
  return (
    <Html position={[point.x * MM, y, point.y * MM]} center distanceFactor={8}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: color,
          border: isSelected ? '3px solid #2563eb' : '2px solid white',
          color: 'white',
          fontWeight: 700,
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
      >
        !
      </button>
    </Html>
  );
}

// First-person walkthrough: pointer-lock mouse-look + WASD/arrow-key
// movement, replacing OrbitControls while active (see `enabled={!walkMode}`
// on the OrbitControls element above). Rendered inside <Canvas> so it can
// use useThree/useFrame directly against the same default camera the
// presets/OrbitControls drive — no separate camera object.
function WalkthroughControls({
  active,
  eyeHeightMeters,
  controlsRef,
}: {
  active: boolean;
  eyeHeightMeters: number;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera, gl } = useThree();
  const keysRef = useRef<Record<string, boolean>>({});
  const yawRef = useRef(0);
  const pitchRef = useRef(0);

  // camera/controls here are three.js objects, not React state — mutating
  // them directly every frame is the standard react-three-fiber pattern
  // (same as the mesh/group mutations elsewhere in this file), which the
  // newer react-hooks/immutability rule doesn't yet distinguish from
  // reassigning a hook's own return value.
  /* eslint-disable react-hooks/immutability */
  useEffect(() => {
    if (!active) return;
    const domElement = gl.domElement;
    // Captured now, not read from the ref inside cleanup — the ref's
    // current node can change by the time this effect tears down.
    const controls = controlsRef.current;

    function onKeyDown(e: KeyboardEvent) {
      keysRef.current[e.code] = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.current[e.code] = false;
    }
    function onMouseMove(e: MouseEvent) {
      if (document.pointerLockElement !== domElement) return;
      yawRef.current -= e.movementX * 0.0025;
      pitchRef.current = Math.max(-1.4, Math.min(1.4, pitchRef.current - e.movementY * 0.0025));
    }
    function onClick() {
      domElement.requestPointerLock?.();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    domElement.addEventListener('click', onClick);

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    yawRef.current = euler.y;
    pitchRef.current = 0;
    camera.position.y = eyeHeightMeters;

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      domElement.removeEventListener('click', onClick);
      keysRef.current = {};
      if (document.pointerLockElement === domElement) document.exitPointerLock();

      // Hand back to OrbitControls pointed roughly where the walk ended,
      // rather than snapping to wherever it was left before walking.
      if (controls) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        controls.target.copy(camera.position).addScaledVector(forward, 3);
        controls.update();
      }
    };
  }, [active, gl, camera, eyeHeightMeters, controlsRef]);

  useFrame((_, delta) => {
    if (!active) return;
    const euler = new THREE.Euler(pitchRef.current, yawRef.current, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yawRef.current, 0, 'YXZ'));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yawRef.current, 0, 'YXZ'));
    const keys = keysRef.current;
    const speed = (keys.ShiftLeft ? 4.5 : 2.2) * delta;
    if (keys.KeyW || keys.ArrowUp) camera.position.addScaledVector(forward, speed);
    if (keys.KeyS || keys.ArrowDown) camera.position.addScaledVector(forward, -speed);
    if (keys.KeyD || keys.ArrowRight) camera.position.addScaledVector(right, speed);
    if (keys.KeyA || keys.ArrowLeft) camera.position.addScaledVector(right, -speed);
    camera.position.y = eyeHeightMeters;
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}

// The wall's base elevation at a given offset along its length, linearly
// interpolated between `elevationMm` (at the start point) and
// `endElevationMm` (at the end point) — lets the wall's base slope to follow
// a sloped floor/terrain. Falls back to a flat `elevationMm` when
// `endElevationMm` is unset.
function wallElevationAtOffset(wall: Wall, offsetMm: number): number {
  const start = wall.elevationMm ?? 0;
  const end = wall.endElevationMm ?? start;
  if (end === start) return start;
  const length = wallLengthMm(wall) || 1;
  const t = Math.min(1, Math.max(0, offsetMm / length));
  return start + (end - start) * t;
}

// The wall's top height above its own base at a given offset along its
// length, linearly interpolated between `heightMm` (at the start point) and
// `endHeightMm` (at the end point) — used for gable-style walls whose top
// edge slopes instead of running flat. Falls back to a flat `heightMm` when
// `endHeightMm` is unset. Independent of the base-elevation slope above —
// the two combine additively to get a segment's absolute top height.
function wallTopHeightAtOffset(wall: Wall, offsetMm: number): number {
  const endHeight = wall.endHeightMm ?? wall.heightMm;
  if (endHeight === wall.heightMm) return wall.heightMm;
  const length = wallLengthMm(wall) || 1;
  const t = Math.min(1, Math.max(0, offsetMm / length));
  return wall.heightMm + (endHeight - wall.heightMm) * t;
}

// A single wall segment. Flat segments (the common case, all four corners
// level) use a plain boxGeometry; segments whose top and/or bottom edge
// differs between the two ends (a sloped gable top, a sloped base following
// tilted terrain, or both at once) get a custom extruded-quadrilateral
// geometry instead, since a box can't represent a slanted face.
function WallSegmentMesh({
  lengthM,
  thicknessM,
  bottomStartM,
  bottomEndM,
  topStartM,
  topEndM,
  x,
  z,
  offsetY,
  rotationY,
  color,
  map,
  onPointerDown,
}: {
  lengthM: number;
  thicknessM: number;
  bottomStartM: number;
  bottomEndM: number;
  topStartM: number;
  topEndM: number;
  x: number;
  z: number;
  offsetY: number;
  rotationY: number;
  color: string;
  map: THREE.Texture | null | undefined;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const sloped = Math.abs(topStartM - topEndM) > 1e-6 || Math.abs(bottomStartM - bottomEndM) > 1e-6;
  const slopedGeometry = useMemo(() => {
    if (!sloped) return null;
    const shape = new THREE.Shape();
    shape.moveTo(-lengthM / 2, bottomStartM);
    shape.lineTo(lengthM / 2, bottomEndM);
    shape.lineTo(lengthM / 2, topEndM);
    shape.lineTo(-lengthM / 2, topStartM);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thicknessM, bevelEnabled: false, curveSegments: 1 });
    geometry.translate(0, 0, -thicknessM / 2);
    geometry.computeVertexNormals();
    return geometry;
  }, [sloped, lengthM, thicknessM, bottomStartM, bottomEndM, topStartM, topEndM]);

  const material = <meshStandardMaterial color={map ? '#ffffff' : color} map={map ?? undefined} roughness={0.85} />;

  if (sloped && slopedGeometry) {
    return (
      <mesh
        position={[x, offsetY, z]}
        rotation-y={rotationY}
        geometry={slopedGeometry}
        castShadow
        receiveShadow
        onPointerDown={onPointerDown}
      >
        {material}
      </mesh>
    );
  }

  const height = topStartM - bottomStartM;
  return (
    <mesh
      position={[x, offsetY + bottomStartM + height / 2, z]}
      rotation-y={rotationY}
      castShadow
      receiveShadow
      onPointerDown={onPointerDown}
    >
      <boxGeometry args={[lengthM, height, thicknessM]} />
      {material}
    </mesh>
  );
}

function WallMesh({
  wall,
  openings,
  offsetMm,
  assets,
  isSelected,
  showHandles,
  wallRef,
  onPointerDown,
  onEndpointPointerDown,
  onHeightHandlePointerDown,
  selectedOpeningId,
  onOpeningPointerDown,
}: {
  wall: Wall;
  openings: WallOpening[];
  offsetMm: number;
  assets: Asset[];
  isSelected: boolean;
  showHandles: boolean;
  wallRef: (group: THREE.Object3D | null) => void;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onEndpointPointerDown: (end: 'start' | 'end') => (e: ThreeEvent<PointerEvent>) => void;
  onHeightHandlePointerDown: (
    field: 'heightMm' | 'endHeightMm' | 'elevationMm' | 'endElevationMm',
  ) => (e: ThreeEvent<PointerEvent>) => void;
  selectedOpeningId: string | null;
  onOpeningPointerDown: (opening: WallOpening) => (e: ThreeEvent<PointerEvent>) => void;
}) {
  const { segments, fixtures } = useMemo(() => buildWallSegments(wall, openings), [wall, openings]);
  const angle = wallAngleRad(wall);
  const rotationY = -angle;
  const wallColor = isSelected ? '#60a5fa' : (wall.color ?? WALL_COLOR);
  const wallTexture = useMemo(() => {
    if (!wall.materialId) return null;
    const canvas = getMaterialCanvas(wall.materialId);
    if (!canvas) return null;
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(Math.max(1, wallLengthMm(wall) / 500), Math.max(1, wall.heightMm / 500));
    return texture;
  }, [wall]);
  const showWallTexture = !isSelected && wallTexture;

  return (
    <group ref={wallRef} position={[0, 0, 0]}>
      {segments.map((seg, i) => {
        const mid = pointAlongWall(wall, (seg.startOffsetMm + seg.endOffsetMm) / 2);
        const length = (seg.endOffsetMm - seg.startOffsetMm) * MM;
        // Only segments that reach the wall's actual top (not ones capped by
        // a window sill or header) follow the gable slope — a below-sill
        // segment's top is the fixed sill height regardless of endHeightMm.
        const followsSlope = seg.topMm === wall.heightMm;
        const topStartMm =
          wallElevationAtOffset(wall, seg.startOffsetMm) +
          (followsSlope ? wallTopHeightAtOffset(wall, seg.startOffsetMm) : seg.topMm);
        const topEndMm =
          wallElevationAtOffset(wall, seg.endOffsetMm) +
          (followsSlope ? wallTopHeightAtOffset(wall, seg.endOffsetMm) : seg.topMm);
        const bottomStartMm = wallElevationAtOffset(wall, seg.startOffsetMm) + seg.bottomMm;
        const bottomEndMm = wallElevationAtOffset(wall, seg.endOffsetMm) + seg.bottomMm;
        return (
          <WallSegmentMesh
            key={i}
            lengthM={length}
            thicknessM={wall.thicknessMm * MM}
            bottomStartM={bottomStartMm * MM}
            bottomEndM={bottomEndMm * MM}
            topStartM={topStartMm * MM}
            topEndM={topEndMm * MM}
            x={mid.x * MM}
            z={mid.y * MM}
            offsetY={offsetMm * MM}
            rotationY={rotationY}
            color={wallColor}
            map={showWallTexture ? wallTexture : undefined}
            onPointerDown={onPointerDown}
          />
        );
      })}

      {fixtures.map(({ opening, startOffsetMm, endOffsetMm, bottomMm, topMm }) => {
        const mid = pointAlongWall(wall, (startOffsetMm + endOffsetMm) / 2);
        const length = (endOffsetMm - startOffsetMm) * MM;
        const height = (topMm - bottomMm) * MM;
        const depth = wall.thicknessMm * MM * 0.85;
        const isWindow = opening.type === 'WINDOW';
        const asset = assets.find((a) => a.id === opening.assetId);
        const name = (asset?.name ?? '').toLowerCase();
        const isOpeningSelected = selectedOpeningId === opening.id;
        const color = isOpeningSelected ? '#60a5fa' : (asset?.color ?? (isWindow ? '#bfe3f0' : '#8B5E3C'));
        const isSliding = name ? name.includes('sliding') : length >= 1.7;
        const isDouble = name ? name.includes('double') : length >= 1.3 && length < 1.7;
        const paneCount = length >= 1.8 ? 3 : length >= 1.3 ? 2 : 1;
        const fixtureElevationMm = wallElevationAtOffset(wall, (startOffsetMm + endOffsetMm) / 2);
        return (
          <group
            key={opening.id}
            position={[mid.x * MM, (fixtureElevationMm + (bottomMm + topMm) / 2 + offsetMm) * MM, mid.y * MM]}
            rotation-y={rotationY}
            onPointerDown={onOpeningPointerDown(opening)}
          >
            {isWindow ? (
              <WindowFixture length={length} height={height} depth={depth} color={color} paneCount={paneCount} />
            ) : (
              <DoorFixture
                length={length}
                height={height}
                depth={depth}
                color={color}
                isDouble={isDouble}
                isSliding={isSliding}
              />
            )}
          </group>
        );
      })}

      {showHandles && (
        <>
          <mesh
            position={[
              wall.start.x * MM,
              (offsetMm + (wall.elevationMm ?? 0)) * MM + 0.1,
              wall.start.y * MM,
            ]}
            onPointerDown={onEndpointPointerDown('start')}
          >
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial color="#2563eb" />
          </mesh>
          <mesh
            position={[
              wall.end.x * MM,
              (offsetMm + (wall.endElevationMm ?? wall.elevationMm ?? 0)) * MM + 0.1,
              wall.end.y * MM,
            ]}
            onPointerDown={onEndpointPointerDown('end')}
          >
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial color="#2563eb" />
          </mesh>
          {/* Height handles: drag the top-at-start / top-at-end corners up or
              down to resize the wall (or slope it, if the two end up
              different), and drag the base-at-start / base-at-end handles to
              raise/lower elevation at each end (or slope the base) — an
              in-3D alternative to the Height (start)/Height (end)/Elevation
              (start)/Elevation (end) fields in the Properties panel. */}
          <mesh
            position={[
              wall.start.x * MM,
              (offsetMm + (wall.elevationMm ?? 0) + wall.heightMm) * MM,
              wall.start.y * MM,
            ]}
            onPointerDown={onHeightHandlePointerDown('heightMm')}
          >
            <coneGeometry args={[0.1, 0.16, 4]} />
            <meshStandardMaterial color="#f97316" />
          </mesh>
          <mesh
            position={[
              wall.end.x * MM,
              (offsetMm + (wall.endElevationMm ?? wall.elevationMm ?? 0) + (wall.endHeightMm ?? wall.heightMm)) * MM,
              wall.end.y * MM,
            ]}
            onPointerDown={onHeightHandlePointerDown('endHeightMm')}
          >
            <coneGeometry args={[0.1, 0.16, 4]} />
            <meshStandardMaterial color="#f97316" />
          </mesh>
          <mesh
            position={[
              wall.start.x * MM,
              (offsetMm + (wall.elevationMm ?? 0)) * MM,
              wall.start.y * MM,
            ]}
            rotation-x={Math.PI}
            onPointerDown={onHeightHandlePointerDown('elevationMm')}
          >
            <coneGeometry args={[0.1, 0.16, 4]} />
            <meshStandardMaterial color="#16a34a" />
          </mesh>
          <mesh
            position={[
              wall.end.x * MM,
              (offsetMm + (wall.endElevationMm ?? wall.elevationMm ?? 0)) * MM,
              wall.end.y * MM,
            ]}
            rotation-x={Math.PI}
            onPointerDown={onHeightHandlePointerDown('endElevationMm')}
          >
            <coneGeometry args={[0.1, 0.16, 4]} />
            <meshStandardMaterial color="#16a34a" />
          </mesh>
        </>
      )}
    </group>
  );
}

interface ObjectMeshProps {
  object: SceneObject;
  asset: Asset | undefined;
  offsetMm: number;
  isSelected: boolean;
  meshRef: (object: THREE.Object3D | null) => void;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}

function ObjectMesh({ object, asset, offsetMm, isSelected, meshRef, onPointerDown }: ObjectMeshProps) {
  const heightMm = object.heightMm ?? asset?.defaultHeightMm ?? 800;
  const elevationMm = object.elevationMm ?? 0;
  const w = object.widthMm * MM;
  const h = heightMm * MM;
  const d = object.depthMm * MM;
  const name = asset?.name ?? object.name;

  // A wall-like exterior object (e.g. Boundary Wall) can have a different
  // height/elevation at its End point than its Start — the object-level
  // equivalent of Wall.endHeightMm/endElevationMm, for following sloped
  // land or stepping up a gable. When sloped, the model needs each
  // corner's true world height, which a single centered h/2 offset can't
  // express, so the group is positioned at the object's base instead of
  // its vertical center, and the model builds its own sloped geometry from
  // that base using the raw start/end numbers.
  const isWallLikeAsset = isWallLikeAssetName(name, asset?.category);
  const endHeightMm = object.endHeightMm ?? heightMm;
  const endElevationMm = object.endElevationMm ?? elevationMm;
  const isSloped = isWallLikeAsset && (endHeightMm !== heightMm || endElevationMm !== elevationMm);
  const wallSlope = isSloped
    ? {
        startElevationM: elevationMm * MM,
        endElevationM: endElevationMm * MM,
        startHeightM: heightMm * MM,
        endHeightM: endHeightMm * MM,
      }
    : undefined;

  return (
    <group
      ref={meshRef}
      position={[
        object.x * MM,
        (isSloped ? offsetMm : offsetMm + elevationMm + heightMm / 2) * MM,
        object.y * MM,
      ]}
      rotation-y={-(object.rotationDeg * Math.PI) / 180}
      scale={[1, 1, 1]}
      onPointerDown={onPointerDown}
    >
      {asset ? (
        <CategoryObjectModel
          category={asset.category}
          name={name}
          w={w}
          h={h}
          d={d}
          color={object.color}
          variant={object.variant}
          railSide={object.railSide}
          railOffsetMm={object.railOffsetMm}
          stepCount={object.stepCount}
          railEnabled={object.railEnabled}
          railStartPercent={object.railStartPercent}
          railEndPercent={object.railEndPercent}
          wallSlope={wallSlope}
        />
      ) : (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={object.color} roughness={0.7} />
        </mesh>
      )}
      {isSelected && !wallSlope && (
        <mesh>
          <boxGeometry args={[w, h, d]} />
          <meshBasicMaterial visible={false} />
          <Edges scale={1.02} color="#2563eb" />
        </mesh>
      )}
      {isSelected && wallSlope && (
        // The plain centered w/h/d box doesn't bound a sloped object (its
        // geometry is absolute-positioned from the base, not centered), so
        // without this the selection highlight would float at the wrong
        // height — approximate with a box spanning the sloped shape's own
        // lowest and highest corners instead of omitting feedback entirely.
        <mesh
          position={[
            0,
            (Math.min(wallSlope.startElevationM, wallSlope.endElevationM) +
              Math.max(
                wallSlope.startElevationM + wallSlope.startHeightM,
                wallSlope.endElevationM + wallSlope.endHeightM,
              )) /
              2,
            0,
          ]}
        >
          <boxGeometry
            args={[
              w,
              Math.max(
                wallSlope.startElevationM + wallSlope.startHeightM,
                wallSlope.endElevationM + wallSlope.endHeightM,
              ) - Math.min(wallSlope.startElevationM, wallSlope.endElevationM),
              d,
            ]}
          />
          <meshBasicMaterial visible={false} />
          <Edges scale={1.02} color="#2563eb" />
        </mesh>
      )}
    </group>
  );
}

interface SelectionGizmoProps {
  selectedId: string | null;
  meshRefs: React.RefObject<Map<string, THREE.Object3D>>;
  mode: GizmoMode;
  onCommit: (id: string, attrs: Partial<SceneObject>) => void;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  baseWidthMm?: number;
  baseDepthMm?: number;
  baseOffsetMm?: number;
  baseHeightMm?: number;
}

function SelectionGizmo({
  selectedId,
  meshRefs,
  mode,
  onCommit,
  controlsRef,
  baseWidthMm,
  baseDepthMm,
  baseOffsetMm,
  baseHeightMm,
}: SelectionGizmoProps) {
  const target = selectedId ? meshRefs.current.get(selectedId) ?? null : null;

  // meshRefs can briefly hold a stale entry for an object that was just
  // deleted, hidden by the construction-day timeline, or moved off its
  // now-hidden floor — its ref-cleanup callback (removing it from the map)
  // and this component's re-render aren't guaranteed to land in the same
  // frame. An Object3D that's been detached has no `.parent`, and handing
  // that to TransformControls is exactly what triggers its "must be part
  // of the scene graph" console error.
  if (!target || !selectedId || !target.parent) return null;

  const modeMap = { move: 'translate', rotate: 'rotate', scale: 'scale' } as const;

  return (
    <TransformControls
      // Force a clean unmount/remount on every selection change (rather than
      // drei patching the existing instance's `object` prop in place) — the
      // in-place path is what could hand a just-detached Object3D (parent
      // already null) to TransformControls' internal attach logic between
      // one render and the next, triggering "must be part of the scene
      // graph" even with the target.parent guard above.
      key={selectedId}
      object={target}
      mode={modeMap[mode]}
      showX={mode !== 'rotate'}
      showZ={mode !== 'rotate'}
      showY
      onMouseDown={() => {
        if (controlsRef.current) controlsRef.current.enabled = false;
      }}
      onMouseUp={() => {
        if (controlsRef.current) controlsRef.current.enabled = true;
        const scaled = target.scale.x !== 1 || target.scale.z !== 1;
        const scaledY = target.scale.y !== 1;
        onCommit(selectedId, {
          x: target.position.x / MM,
          y: target.position.z / MM,
          rotationDeg: (-target.rotation.y * 180) / Math.PI,
          ...(mode === 'move' && baseOffsetMm !== undefined && baseHeightMm !== undefined
            ? {
                elevationMm: Math.max(
                  0,
                  Math.round(target.position.y / MM - baseOffsetMm - baseHeightMm / 2),
                ),
              }
            : {}),
          ...(mode === 'scale' && scaledY && baseHeightMm !== undefined
            ? { heightMm: Math.max(50, Math.round(baseHeightMm * target.scale.y)) }
            : {}),
          ...(scaled && baseWidthMm !== undefined && baseDepthMm !== undefined
            ? {
                widthMm: Math.max(50, Math.round(baseWidthMm * target.scale.x)),
                depthMm: Math.max(50, Math.round(baseDepthMm * target.scale.z)),
              }
            : {}),
        });
      }}
    />
  );
}

function CameraPresetOverlay({ onPreset }: { onPreset: (preset: 'top' | 'front' | 'side' | 'reset') => void }) {
  return (
    <div className="absolute left-2 top-2 flex gap-1 rounded-md bg-white/90 p-1 shadow">
      {(['reset', 'top', 'front', 'side'] as const).map((p) => (
        <button
          key={p}
          onClick={() => onPreset(p)}
          className="rounded px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          {p === 'reset' ? 'Perspective' : p[0].toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  );
}

// A visible, draggable pan control for the 3D view — the "Side-scroll or
// right-drag to pan" gestures work but aren't discoverable, and some users
// (trackpad-less mice, accessibility needs) don't have a good way to do
// either. Two plain range inputs styled as thin scrollbars: horizontal
// pans world X, vertical pans world Z — the same ground-plane axes the 2D
// floor plan already pans along (see Canvas.tsx's handleWheel), so the
// two views share one mental model instead of the 3D one being relative
// to wherever the camera happens to be facing.
function PanScrollbars({
  x,
  z,
  centerX,
  centerZ,
  rangeM,
  onChangeX,
  onChangeZ,
}: {
  x: number;
  z: number;
  centerX: number;
  centerZ: number;
  rangeM: number;
  onChangeX: (value: number) => void;
  onChangeZ: (value: number) => void;
}) {
  return (
    <>
      <input
        type="range"
        aria-label="Pan left and right"
        min={centerX - rangeM}
        max={centerX + rangeM}
        step={rangeM / 500}
        value={x}
        onChange={(e) => onChangeX(Number(e.target.value))}
        className="absolute bottom-0 left-0 right-3 h-3 accent-neutral-500"
      />
      <input
        type="range"
        aria-label="Pan forward and back"
        min={centerZ - rangeM}
        max={centerZ + rangeM}
        step={rangeM / 500}
        value={z}
        onChange={(e) => onChangeZ(Number(e.target.value))}
        className="absolute right-0 top-0 bottom-3 w-3"
        style={{ writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#a3a3a3' }}
      />
    </>
  );
}

function formatHours(hours: number): string {
  const h = Math.floor(hours) % 24;
  const m = Math.round((hours % 1) * 60);
  const period = h < 12 ? 'AM' : 'PM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
}

function TimeOfDaySlider({ hours, onChange }: { hours: number; onChange: (hours: number) => void }) {
  return (
    <div className="absolute bottom-2 right-2 flex items-center gap-2 rounded-md bg-white/90 px-3 py-2 shadow">
      <span aria-hidden>{hours >= 6 && hours < 18 ? '☀️' : '🌙'}</span>
      <input
        type="range"
        min={0}
        max={24}
        step={0.25}
        value={hours}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-40"
      />
      <span className="w-20 text-right text-xs text-neutral-600">{formatHours(hours)}</span>
    </div>
  );
}
