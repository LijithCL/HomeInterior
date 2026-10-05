'use client';

import { useEffect, useState } from 'react';
import { Circle, Group, Image as KonvaImage, Line, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { Point, Room, SceneObject, Wall, WallOpening } from '@/lib/editor/document';
import {
  pointAlongWall,
  polygonAreaM2,
  polygonBounds,
  polygonCentroid,
  wallAngleRad,
  wallLengthMm,
} from '@/lib/editor/document';
import { formatLength, formatArea } from '@/lib/editor/units';
import { getMaterialCanvas } from '@/lib/editor/materials';
import type { Unit } from '@/lib/editor/editor-store';

const OPENING_COLOR: Record<WallOpening['type'], string> = {
  DOOR: '#B8896A',
  WINDOW: '#8FC3E0',
};

export function GridLines({ spacingMm = 500, extentMm = 15000 }: { spacingMm?: number; extentMm?: number }) {
  const lines: number[] = [];
  for (let v = -extentMm; v <= extentMm; v += spacingMm) lines.push(v);

  return (
    <Group listening={false}>
      {lines.map((v) => (
        <Line
          key={`v-${v}`}
          points={[v, -extentMm, v, extentMm]}
          stroke={v === 0 ? '#c7c7c7' : '#e5e5e5'}
          strokeWidth={v === 0 ? 3 : 1}
        />
      ))}
      {lines.map((v) => (
        <Line
          key={`h-${v}`}
          points={[-extentMm, v, extentMm, v]}
          stroke={v === 0 ? '#c7c7c7' : '#e5e5e5'}
          strokeWidth={v === 0 ? 3 : 1}
        />
      ))}
    </Group>
  );
}

// A traced-over blueprint/photo (see lib/editor/materials.ts-adjacent
// Floor.underlay* fields) — loads its own <img> since Konva's Image needs
// a real HTMLImageElement, not just a URL string.
export function FloorUnderlay({
  url,
  x,
  y,
  widthMm,
  opacity,
}: {
  url: string;
  x: number;
  y: number;
  widthMm: number;
  opacity: number;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!image) return null;
  const heightMm = widthMm * (image.naturalHeight / image.naturalWidth || 1);

  return (
    <KonvaImage image={image} x={x} y={y} width={widthMm} height={heightMm} opacity={opacity} listening={false} />
  );
}

export function MeasureLine({
  start,
  end,
  unit,
  live,
}: {
  start: Point;
  end: Point;
  unit: Unit;
  live?: boolean;
}) {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const angleDeg = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  return (
    <Group listening={false}>
      <Line
        points={[start.x, start.y, end.x, end.y]}
        stroke={live ? '#f59e0b' : '#dc2626'}
        strokeWidth={30}
        dash={[100, 60]}
      />
      <Circle x={start.x} y={start.y} radius={45} fill={live ? '#f59e0b' : '#dc2626'} />
      <Circle x={end.x} y={end.y} radius={45} fill={live ? '#f59e0b' : '#dc2626'} />
      <Text
        text={formatLength(length, unit)}
        x={mid.x}
        y={mid.y}
        rotation={angleDeg}
        offsetY={54}
        offsetX={140}
        fontSize={130}
        fontStyle="bold"
        fill={live ? '#b45309' : '#b91c1c'}
      />
    </Group>
  );
}

export function CommentPin({
  point,
  resolved,
  isSelected,
  onSelect,
}: {
  point: Point;
  resolved: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const fill = resolved ? '#a3a3a3' : '#e8734a';
  return (
    <Group x={point.x} y={point.y} onClick={onSelect} onTap={onSelect}>
      <Circle radius={140} fill={fill} stroke={isSelected ? '#2563eb' : 'white'} strokeWidth={isSelected ? 40 : 20} />
      <Text text="!" fontSize={160} fontStyle="bold" fill="white" align="center" verticalAlign="middle" offsetX={40} offsetY={80} width={80} height={160} />
    </Group>
  );
}

interface WallShapeProps {
  wall: Wall;
  openings: WallOpening[];
  isSelected: boolean;
  unit: Unit;
  onSelect: () => void;
  onDragHandle: (end: 'start' | 'end', point: Point) => void;
  onDragWall?: (delta: Point) => void;
  selectedOpeningId?: string | null;
  onSelectOpening?: (openingId: string) => void;
  onDragOpening?: (openingId: string, deltaOffsetMm: number) => void;
  readOnly?: boolean;
}

export function WallShape({
  wall,
  openings,
  isSelected,
  unit,
  onSelect,
  onDragHandle,
  onDragWall,
  selectedOpeningId,
  onSelectOpening,
  onDragOpening,
  readOnly,
}: WallShapeProps) {
  const length = wallLengthMm(wall);
  const angleDeg = (wallAngleRad(wall) * 180) / Math.PI;
  const mid = { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 };

  return (
    <Group>
      {isSelected && (
        <Line
          points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
          stroke="#2563eb"
          strokeWidth={wall.thicknessMm + 60}
          lineCap="square"
          opacity={0.35}
          listening={false}
        />
      )}
      <Line
        points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
        stroke={wall.color ?? '#3f3f46'}
        strokeWidth={wall.thicknessMm}
        lineCap="square"
        draggable={!readOnly}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          const node = e.target;
          const delta = { x: node.x(), y: node.y() };
          node.position({ x: 0, y: 0 });
          if (delta.x !== 0 || delta.y !== 0) onDragWall?.(delta);
        }}
      />
      {openings.map((o) => {
        const p = pointAlongWall(wall, o.offsetMm);
        const halfW = o.widthMm / 2;
        const isOpeningSelected = selectedOpeningId === o.id;
        return (
          <Line
            key={o.id}
            points={[
              p.x - Math.cos(wallAngleRad(wall)) * halfW,
              p.y - Math.sin(wallAngleRad(wall)) * halfW,
              p.x + Math.cos(wallAngleRad(wall)) * halfW,
              p.y + Math.sin(wallAngleRad(wall)) * halfW,
            ]}
            stroke={isOpeningSelected ? '#2563eb' : OPENING_COLOR[o.type]}
            strokeWidth={wall.thicknessMm + 20}
            draggable={!readOnly}
            onClick={() => onSelectOpening?.(o.id)}
            onTap={() => onSelectOpening?.(o.id)}
            onDragEnd={(e) => {
              const node = e.target;
              const rawDx = node.x();
              const rawDy = node.y();
              node.position({ x: 0, y: 0 });
              if (rawDx === 0 && rawDy === 0) return;
              // The opening can only slide along the wall it's set into —
              // project the raw drag delta onto the wall's direction to get
              // a distance-along-wall change, not a free 2D move.
              const angle = wallAngleRad(wall);
              const deltaOffset = rawDx * Math.cos(angle) + rawDy * Math.sin(angle);
              onDragOpening?.(o.id, deltaOffset);
            }}
          />
        );
      })}
      <Text
        text={formatLength(length, unit)}
        x={mid.x}
        y={mid.y}
        rotation={angleDeg}
        offsetY={wall.thicknessMm / 2 + 24}
        offsetX={20}
        fontSize={130}
        fill="#525252"
        listening={false}
      />
      {isSelected && !readOnly && (
        <>
          <Circle
            x={wall.start.x}
            y={wall.start.y}
            radius={90}
            fill="#2563eb"
            draggable
            onDragMove={(e) => onDragHandle('start', { x: e.target.x(), y: e.target.y() })}
          />
          <Circle
            x={wall.end.x}
            y={wall.end.y}
            radius={90}
            fill="#2563eb"
            draggable
            onDragMove={(e) => onDragHandle('end', { x: e.target.x(), y: e.target.y() })}
          />
        </>
      )}
    </Group>
  );
}

interface RoomShapeProps {
  room: Room;
  isSelected: boolean;
  unit: Unit;
  onSelect: () => void;
}

export function RoomShape({ room, isSelected, unit, onSelect }: RoomShapeProps) {
  const centroid = polygonCentroid(room.polygon);
  const area = polygonAreaM2(room.polygon);
  const bounds = polygonBounds(room.polygon);
  const points = room.polygon.flatMap((p) => [p.x, p.y]);
  const materialCanvas = room.floorMaterialId ? getMaterialCanvas(room.floorMaterialId) : null;
  const TILE_WORLD_MM = 500;

  return (
    <Group>
      <Line
        points={points}
        closed
        fill={isSelected ? 'rgba(37,99,235,0.08)' : 'rgba(0,0,0,0.02)'}
        // Konva's type only names HTMLImageElement, but at runtime it just
        // hands this to CanvasRenderingContext2D.createPattern(), which
        // also accepts an HTMLCanvasElement directly.
        fillPatternImage={materialCanvas ? (materialCanvas as unknown as HTMLImageElement) : undefined}
        fillPatternRepeat={materialCanvas ? 'repeat' : undefined}
        fillPatternScale={materialCanvas ? { x: TILE_WORLD_MM / 128, y: TILE_WORLD_MM / 128 } : undefined}
        fillPriority={materialCanvas ? 'pattern' : 'color'}
        onClick={onSelect}
        onTap={onSelect}
      />
      {isSelected && (
        <Line points={points} closed stroke="#2563eb" strokeWidth={30} listening={false} />
      )}
      <Text
        text={`${room.name}\n${formatLength(bounds.heightMm, unit)} × ${formatLength(bounds.widthMm, unit)}\n${formatArea(area, unit)}`}
        x={centroid.x}
        y={centroid.y}
        offsetX={1000}
        offsetY={225}
        fontSize={150}
        fill="#525252"
        align="center"
        width={2000}
        listening={false}
      />
    </Group>
  );
}

interface ObjectShapeProps {
  object: SceneObject;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (point: Point) => void;
  shapeRef: (node: Konva.Rect | null) => void;
  onTransformEnd: (attrs: { x: number; y: number; rotationDeg: number; widthMm: number; depthMm: number }) => void;
  readOnly?: boolean;
}

export function ObjectShape({ object, isSelected, onSelect, onDragEnd, shapeRef, onTransformEnd, readOnly }: ObjectShapeProps) {
  return (
    <Group>
      <Rect
        ref={shapeRef}
        x={object.x}
        y={object.y}
        width={object.widthMm}
        height={object.depthMm}
        offsetX={object.widthMm / 2}
        offsetY={object.depthMm / 2}
        rotation={object.rotationDeg}
        fill={object.color}
        stroke={isSelected ? '#2563eb' : '#3f3f46'}
        strokeWidth={isSelected ? 30 : 10}
        draggable={!readOnly && !object.locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onDragEnd({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={(e) => {
          const node = e.target;
          const widthMm = Math.max(50, node.width() * node.scaleX());
          const depthMm = Math.max(50, node.height() * node.scaleY());
          node.scaleX(1);
          node.scaleY(1);
          node.width(widthMm);
          node.height(depthMm);
          node.offsetX(widthMm / 2);
          node.offsetY(depthMm / 2);
          onTransformEnd({
            x: node.x(),
            y: node.y(),
            rotationDeg: node.rotation(),
            widthMm,
            depthMm,
          });
        }}
      />
      <Text
        text={object.name}
        x={object.x}
        y={object.y}
        offsetX={object.widthMm / 2}
        offsetY={object.depthMm / 2 - 30}
        width={object.widthMm}
        align="center"
        fontSize={110}
        fill="#1f1f1f"
        listening={false}
      />
    </Group>
  );
}
