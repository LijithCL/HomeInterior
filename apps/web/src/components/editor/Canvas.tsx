'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect as KonvaRect, Transformer } from 'react-konva';
import type Konva from 'konva';
import { DEFAULT_WALL_HEIGHT_MM, DEFAULT_WINDOW_SILL_MM, wallLengthMm, type Point } from '@/lib/editor/document';
import { snapAngle, snapPointToWalls, snapToGrid, snapToWallEndpoints } from '@/lib/editor/snapping';
import { useEditorStore } from '@/lib/editor/editor-store';
import type { Asset } from '@/lib/editor/asset-types';
import { CommentPin, FloorUnderlay, GridLines, MeasureLine, ObjectShape, RoomShape, WallShape } from './shapes';

const DEFAULT_WALL_THICKNESS_MM = 150;
const SNAP_THRESHOLD_MM = 150;
const MIN_SCALE = 0.02;
const MAX_SCALE = 0.6;

export interface CanvasStageRefs {
  stage: Konva.Stage;
  contentLayer: Konva.Layer;
}

interface CanvasProps {
  assets: Asset[];
  onStageReady?: (refs: CanvasStageRefs) => void;
}

export default function Canvas({ assets, onStageReady }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageNodeRef = useRef<Konva.Stage | null>(null);
  const contentLayerNodeRef = useRef<Konva.Layer | null>(null);
  const reportedStageReadyRef = useRef(false);

  // Stable callback identities: an inline `ref={(node) => ...}` is a new
  // function every render, which makes React re-invoke it (null, then the
  // node again) on every render — if that invocation calls setState (via
  // onStageReady), it's an infinite render loop. useCallback keeps the ref
  // callback's identity stable so React only calls it on actual mount/unmount.
  const maybeReportStageReady = useCallback(() => {
    if (stageNodeRef.current && contentLayerNodeRef.current && !reportedStageReadyRef.current) {
      reportedStageReadyRef.current = true;
      onStageReady?.({ stage: stageNodeRef.current, contentLayer: contentLayerNodeRef.current });
    }
  }, [onStageReady]);

  const setStageNode = useCallback(
    (node: Konva.Stage | null) => {
      stageNodeRef.current = node;
      maybeReportStageReady();
    },
    [maybeReportStageReady],
  );

  const setContentLayerNode = useCallback(
    (node: Konva.Layer | null) => {
      contentLayerNodeRef.current = node;
      maybeReportStageReady();
    },
    [maybeReportStageReady],
  );

  const [size, setSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(0.08);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  const [wallDraft, setWallDraft] = useState<{ start: Point; end: Point } | null>(null);
  const [roomDraft, setRoomDraft] = useState<{ start: Point; end: Point } | null>(null);
  const [measureSegments, setMeasureSegments] = useState<{ start: Point; end: Point }[]>([]);
  const [measureDraft, setMeasureDraft] = useState<{ start: Point; end: Point } | null>(null);

  const document = useEditorStore((s) => s.document);
  const underlayUrls = useEditorStore((s) => s.underlayUrls);
  const activeFloorId = useEditorStore((s) => s.activeFloorId);
  const selection = useEditorStore((s) => s.selection);
  const tool = useEditorStore((s) => s.tool);
  const readOnly = useEditorStore((s) => s.readOnly);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const gridSizeMm = useEditorStore((s) => s.gridSizeMm);
  const unit = useEditorStore((s) => s.unit);
  const setSelection = useEditorStore((s) => s.setSelection);
  const setTool = useEditorStore((s) => s.setTool);
  const addWall = useEditorStore((s) => s.addWall);
  const updateWall = useEditorStore((s) => s.updateWall);
  const addRectRoom = useEditorStore((s) => s.addRectRoom);
  const addOpening = useEditorStore((s) => s.addOpening);
  const updateOpening = useEditorStore((s) => s.updateOpening);
  const addObject = useEditorStore((s) => s.addObject);
  const updateObject = useEditorStore((s) => s.updateObject);
  const removeSelected = useEditorStore((s) => s.removeSelected);
  const duplicateObject = useEditorStore((s) => s.duplicateObject);
  const duplicateWall = useEditorStore((s) => s.duplicateWall);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const comments = useEditorStore((s) => s.comments);
  const selectedCommentId = useEditorStore((s) => s.selectedCommentId);
  const setSelectedCommentId = useEditorStore((s) => s.setSelectedCommentId);
  const draftCommentPin = useEditorStore((s) => s.draftCommentPin);
  const setDraftCommentPin = useEditorStore((s) => s.setDraftCommentPin);
  const setCommentsPanelOpen = useEditorStore((s) => s.setCommentsPanelOpen);

  const transformerRef = useRef<Konva.Transformer>(null);
  const objectNodeRefs = useRef<Map<string, Konva.Rect>>(new Map());

  // Switching away from the Measure tool always drops any in-progress
  // measurement — cleared during render (not an effect), same reasoning as
  // Scene3D's wallDraft reset: https://react.dev/learn/you-might-not-need-an-effect
  const [lastTool, setLastTool] = useState(tool);
  if (tool !== lastTool) {
    setLastTool(tool);
    if (tool !== 'measure') {
      setMeasureDraft(null);
      setMeasureSegments([]);
    }
  }

  // The 2D editor only ever shows/edits one floor at a time — cross-floor
  // structure is authored by switching the active floor tab, not by mixing
  // floors on one canvas.
  const floorWalls = document.walls.filter((w) => w.floorId === activeFloorId);
  const floorWallIds = new Set(floorWalls.map((w) => w.id));
  const floorRooms = document.rooms.filter((r) => r.floorId === activeFloorId);
  const floorObjects = document.objects.filter((o) => o.floorId === activeFloorId);
  const floorOpenings = document.openings.filter((o) => floorWallIds.has(o.wallId));
  const activeFloor = document.floors.find((f) => f.id === activeFloorId);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') setSpacePressed(true);
      const isMod = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (isTyping) return;

      if (isMod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (isMod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSelected();
      } else if (isMod && e.key.toLowerCase() === 'd' && selection?.type === 'object') {
        e.preventDefault();
        duplicateObject(selection.id);
      } else if (isMod && e.key.toLowerCase() === 'd' && selection?.type === 'wall') {
        e.preventDefault();
        duplicateWall(selection.id);
      } else if (e.key === 'Escape') {
        setWallDraft(null);
        setRoomDraft(null);
        setMeasureDraft(null);
        setMeasureSegments([]);
        setTool('select');
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setSpacePressed(false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [undo, redo, removeSelected, duplicateObject, duplicateWall, selection, setTool]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    // Never attach the resize/rotate handles in the read-only viewer — a
    // draggable object with no transformer can still be selected for
    // inspection, but nothing on screen can actually mutate it.
    if (selection?.type === 'object' && !readOnly) {
      const node = objectNodeRefs.current.get(selection.id);
      transformer.nodes(node ? [node] : []);
    } else {
      transformer.nodes([]);
    }
    transformer.getLayer()?.batchDraw();
  }, [selection, readOnly]);

  const toWorld = useCallback(
    (screen: Point): Point => ({
      x: (screen.x - stagePos.x) / scale,
      y: (screen.y - stagePos.y) / scale,
    }),
    [scale, stagePos],
  );

  const applySnap = useCallback(
    (point: Point, referencePoint?: Point): Point => {
      if (!snapEnabled) return point;
      const wallSnap = snapPointToWalls(point, floorWalls, SNAP_THRESHOLD_MM / scale);
      if (wallSnap) return wallSnap.point;
      const endpointSnap = snapToWallEndpoints(point, floorWalls, SNAP_THRESHOLD_MM / scale);
      if (endpointSnap) return endpointSnap;
      let snapped = snapToGrid(point, gridSizeMm);
      if (referencePoint) snapped = snapAngle(referencePoint, snapped);
      return snapped;
    },
    [snapEnabled, floorWalls, gridSizeMm, scale],
  );

  // Furniture placement/dragging only ever snaps to the grid — wall-line and
  // wall-endpoint snapping (above) is for drawing/connecting walls to each
  // other, and applying it to objects too was pulling furniture onto a
  // wall's centerline from up to ~2m away at the default zoom, since that
  // threshold is scaled for wall-drawing precision, not object placement.
  const applyObjectSnap = useCallback(
    (point: Point): Point => (snapEnabled ? snapToGrid(point, gridSizeMm) : point),
    [snapEnabled, gridSizeMm],
  );

  function getPointerWorld(stage: Konva.Stage): Point | null {
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return toWorld(pos);
  }

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    // A trackpad's pinch gesture synthesizes a wheel event with ctrlKey set
    // (the Chrome/Firefox convention) — a plain two-finger scroll, or a
    // plain mouse wheel, carries no modifier. Treating every wheel event as
    // zoom (the previous behavior) left no way to pan by scrolling at all:
    // once zoomed in, scrolling just zoomed further until it hit MAX_SCALE
    // and then did nothing. This matches Figma/Google Maps' convention
    // instead — plain scroll pans, modifier+scroll (or pinch) zooms.
    if (!(e.evt.ctrlKey || e.evt.metaKey)) {
      setStagePos((pos) => ({ x: pos.x - e.evt.deltaX, y: pos.y - e.evt.deltaY }));
      return;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = { x: (pointer.x - stagePos.x) / scale, y: (pointer.y - stagePos.y) / scale };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * (1 + direction * 0.1)));
    setScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (spacePressed) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const clickedOnEmpty = e.target === stage;
    const world = getPointerWorld(stage);
    if (!world) return;

    if (tool === 'select') {
      if (clickedOnEmpty) setSelection(null);
      return;
    }

    if (tool === 'wall') {
      if (!wallDraft) {
        const start = applySnap(world);
        setWallDraft({ start, end: start });
      } else {
        const end = applySnap(world, wallDraft.start);
        addWall({ start: wallDraft.start, end, thicknessMm: DEFAULT_WALL_THICKNESS_MM, heightMm: DEFAULT_WALL_HEIGHT_MM });
        setWallDraft({ start: end, end });
      }
      return;
    }

    if (tool === 'room') {
      const start = applySnap(world);
      setRoomDraft({ start, end: start });
      return;
    }

    if (tool === 'measure') {
      const point = applySnap(world, measureDraft?.start);
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
      setDraftCommentPin({ floorId: activeFloorId, x: Math.round(world.x), y: Math.round(world.y) });
      setSelectedCommentId(null);
      setCommentsPanelOpen(true);
      return;
    }

    if (tool === 'door' || tool === 'window') {
      const hit = snapPointToWalls(world, floorWalls, SNAP_THRESHOLD_MM * 2 / scale);
      if (!hit) return;
      const wall = floorWalls.find((w) => w.id === hit.wallId);
      if (!wall) return;
      const defaultAsset = assets.find((a) => a.category === (tool === 'door' ? 'DOOR' : 'WINDOW'));
      const offsetMm = Math.hypot(hit.point.x - wall.start.x, hit.point.y - wall.start.y);
      addOpening({
        wallId: wall.id,
        type: tool === 'door' ? 'DOOR' : 'WINDOW',
        assetId: defaultAsset?.id ?? '',
        offsetMm,
        widthMm: defaultAsset?.defaultWidthMm ?? 900,
        heightMm: defaultAsset?.defaultHeightMm ?? (tool === 'door' ? 2100 : 1200),
        sillHeightMm: tool === 'door' ? 0 : DEFAULT_WINDOW_SILL_MM,
      });
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const world = getPointerWorld(stage);
    if (!world) return;

    if (tool === 'wall' && wallDraft) {
      setWallDraft({ start: wallDraft.start, end: applySnap(world, wallDraft.start) });
    }
    if (tool === 'room' && roomDraft) {
      setRoomDraft({ start: roomDraft.start, end: applySnap(world) });
    }
    if (tool === 'measure' && measureDraft) {
      setMeasureDraft({ start: measureDraft.start, end: applySnap(world, measureDraft.start) });
    }
  };

  const handleStageMouseUp = () => {
    if (tool === 'room' && roomDraft) {
      const dx = Math.abs(roomDraft.end.x - roomDraft.start.x);
      const dy = Math.abs(roomDraft.end.y - roomDraft.start.y);
      if (dx > 200 && dy > 200) {
        addRectRoom(roomDraft.start, roomDraft.end, DEFAULT_WALL_THICKNESS_MM, 'Room');
      }
      setRoomDraft(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-asset');
    if (!raw) return;
    const asset: Asset = JSON.parse(raw);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = toWorld(screenPoint);

    if (asset.category === 'DOOR' || asset.category === 'WINDOW') {
      const hit = snapPointToWalls(world, floorWalls, (SNAP_THRESHOLD_MM * 2) / scale);
      if (!hit) return;
      const wall = floorWalls.find((w) => w.id === hit.wallId);
      if (!wall) return;
      const offsetMm = Math.hypot(hit.point.x - wall.start.x, hit.point.y - wall.start.y);
      const id = addOpening({
        wallId: wall.id,
        type: asset.category,
        assetId: asset.id,
        offsetMm,
        widthMm: asset.defaultWidthMm,
        heightMm: asset.defaultHeightMm,
        sillHeightMm: asset.category === 'WINDOW' ? DEFAULT_WINDOW_SILL_MM : 0,
      });
      setSelection({ type: 'opening', id });
      setTool('select');
      return;
    }

    const snapped = applyObjectSnap(world);
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
    setTool('select');
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-neutral-100"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Stage
        ref={setStageNode}
        width={size.width}
        height={size.height}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={spacePressed}
        onDragEnd={(e) => {
          // Konva's dragend bubbles up from whatever was actually dragged
          // (an object, a wall, a Transformer resize handle...) to this
          // Stage-level listener too. Without this guard, e.target is still
          // that child node, and writing its local mm coordinates in as the
          // Stage's pixel pan offset flings the whole canvas off-screen.
          if (e.target !== e.currentTarget) return;
          setStagePos({ x: e.target.x(), y: e.target.y() });
        }}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        style={{ cursor: spacePressed ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
      >
        {activeFloor?.underlayImageKey && underlayUrls[activeFloor.underlayImageKey] && (
          <Layer listening={false}>
            <FloorUnderlay
              url={underlayUrls[activeFloor.underlayImageKey]}
              x={activeFloor.underlayX ?? 0}
              y={activeFloor.underlayY ?? 0}
              widthMm={activeFloor.underlayWidthMm ?? 5000}
              opacity={activeFloor.underlayOpacity ?? 0.5}
            />
          </Layer>
        )}

        <Layer>
          <GridLines />
        </Layer>

        <Layer ref={setContentLayerNode}>
          {floorRooms.map((room) => (
            <RoomShape
              key={room.id}
              room={room}
              unit={unit}
              isSelected={selection?.type === 'room' && selection.id === room.id}
              onSelect={() => tool === 'select' && setSelection({ type: 'room', id: room.id })}
            />
          ))}

          {floorWalls.map((wall) => (
            <WallShape
              key={wall.id}
              wall={wall}
              unit={unit}
              openings={floorOpenings.filter((o) => o.wallId === wall.id)}
              isSelected={selection?.type === 'wall' && selection.id === wall.id}
              onSelect={() => tool === 'select' && setSelection({ type: 'wall', id: wall.id })}
              onDragHandle={(end, point) => {
                const snapped = applySnap(point);
                updateWall(wall.id, end === 'start' ? { start: snapped } : { end: snapped });
              }}
              onDragWall={(rawDelta) => {
                const delta = snapEnabled
                  ? { x: Math.round(rawDelta.x / gridSizeMm) * gridSizeMm, y: Math.round(rawDelta.y / gridSizeMm) * gridSizeMm }
                  : rawDelta;
                if (delta.x === 0 && delta.y === 0) return;
                updateWall(wall.id, {
                  start: { x: wall.start.x + delta.x, y: wall.start.y + delta.y },
                  end: { x: wall.end.x + delta.x, y: wall.end.y + delta.y },
                });
              }}
              selectedOpeningId={selection?.type === 'opening' ? selection.id : null}
              onSelectOpening={(openingId) => tool === 'select' && setSelection({ type: 'opening', id: openingId })}
              onDragOpening={(openingId, deltaOffsetMm) => {
                const opening = floorOpenings.find((o) => o.id === openingId && o.wallId === wall.id);
                if (!opening) return;
                const wallLen = wallLengthMm(wall);
                const halfW = opening.widthMm / 2;
                let newOffset = opening.offsetMm + deltaOffsetMm;
                if (snapEnabled) newOffset = Math.round(newOffset / gridSizeMm) * gridSizeMm;
                newOffset = Math.min(Math.max(newOffset, halfW), Math.max(halfW, wallLen - halfW));
                updateOpening(openingId, { offsetMm: newOffset });
              }}
              readOnly={readOnly || tool !== 'select'}
            />
          ))}

          {wallDraft && (
            <WallShape
              wall={{
                id: '__draft__',
                floorId: '__draft__',
                start: wallDraft.start,
                end: wallDraft.end,
                thicknessMm: DEFAULT_WALL_THICKNESS_MM,
                heightMm: DEFAULT_WALL_HEIGHT_MM,
                constructionDay: 0,
              }}
              openings={[]}
              unit={unit}
              isSelected
              onSelect={() => {}}
              onDragHandle={() => {}}
            />
          )}

          {measureSegments.map((seg, i) => (
            <MeasureLine key={`measure-${i}`} start={seg.start} end={seg.end} unit={unit} />
          ))}
          {measureDraft && <MeasureLine start={measureDraft.start} end={measureDraft.end} unit={unit} live />}

          {comments
            .filter((c) => c.floorId === activeFloorId && c.x != null && c.y != null)
            .map((c) => (
              <CommentPin
                key={c.id}
                point={{ x: c.x as number, y: c.y as number }}
                resolved={c.resolved}
                isSelected={selectedCommentId === c.id}
                onSelect={() => {
                  setSelectedCommentId(c.id);
                  setCommentsPanelOpen(true);
                }}
              />
            ))}
          {draftCommentPin && draftCommentPin.floorId === activeFloorId && (
            <CommentPin point={{ x: draftCommentPin.x, y: draftCommentPin.y }} resolved={false} isSelected onSelect={() => {}} />
          )}

          {roomDraft && (
            <KonvaRect
              x={Math.min(roomDraft.start.x, roomDraft.end.x)}
              y={Math.min(roomDraft.start.y, roomDraft.end.y)}
              width={Math.abs(roomDraft.end.x - roomDraft.start.x)}
              height={Math.abs(roomDraft.end.y - roomDraft.start.y)}
              stroke="#2563eb"
              dash={[80, 40]}
              fill="rgba(37,99,235,0.05)"
              listening={false}
            />
          )}

          {floorObjects.map((object) => (
            <ObjectShape
              key={object.id}
              object={object}
              isSelected={selection?.type === 'object' && selection.id === object.id}
              shapeRef={(node) => {
                if (node) objectNodeRefs.current.set(object.id, node);
                else objectNodeRefs.current.delete(object.id);
              }}
              onSelect={() => tool === 'select' && setSelection({ type: 'object', id: object.id })}
              onDragEnd={(point) => {
                const snapped = applyObjectSnap(point);
                updateObject(object.id, { x: snapped.x, y: snapped.y });
              }}
              onTransformEnd={(attrs) => updateObject(object.id, attrs)}
              readOnly={readOnly}
            />
          ))}

          <Transformer ref={transformerRef} rotationSnaps={snapEnabled ? [0, 45, 90, 135, 180, 225, 270, 315] : []} />
        </Layer>
      </Stage>
    </div>
  );
}
