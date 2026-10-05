'use client';

import * as THREE from 'three';
import type { AssetCategory } from '@/lib/editor/asset-types';

function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const target = new THREE.Color(amt >= 0 ? '#ffffff' : '#000000');
  c.lerp(target, Math.min(1, Math.abs(amt)));
  return `#${c.getHexString()}`;
}

interface Dims {
  w: number;
  h: number;
  d: number;
  color: string;
}

// ---------- Kitchen ----------

function RefrigeratorModel({ w, h, d, color }: Dims) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.3} />
      </mesh>
      <mesh position={[w * 0.05, 0, d / 2 + 0.002]}>
        <boxGeometry args={[0.01, h * 0.98, 0.004]} />
        <meshStandardMaterial color={shade(color, -0.35)} />
      </mesh>
      <mesh position={[w * 0.32, h * 0.15, d / 2 + 0.02]} castShadow>
        <boxGeometry args={[0.03, h * 0.35, 0.03]} />
        <meshStandardMaterial color="#8a8f94" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[w * 0.32, -h * 0.28, d / 2 + 0.02]} castShadow>
        <boxGeometry args={[0.03, h * 0.18, 0.03]} />
        <meshStandardMaterial color="#8a8f94" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function CounterModel({ w, h, d, color }: Dims) {
  const topH = Math.min(0.06, h * 0.08);
  const baseH = h - topH;
  const seamCount = Math.max(1, Math.round(w / 0.6)) - 1;
  return (
    <group>
      <mesh position={[0, -topH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, baseH, d]} />
        <meshStandardMaterial color={shade(color, -0.1)} roughness={0.8} />
      </mesh>
      <mesh position={[0, h / 2 - topH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.02, topH, d + 0.02]} />
        <meshStandardMaterial color="#dcdcd4" roughness={0.3} />
      </mesh>
      {Array.from({ length: seamCount }).map((_, i) => {
        const x = -w / 2 + (w / (seamCount + 1)) * (i + 1);
        return (
          <mesh key={i} position={[x, -topH / 2, d / 2 + 0.002]}>
            <boxGeometry args={[0.006, baseH * 0.9, 0.004]} />
            <meshStandardMaterial color={shade(color, -0.35)} />
          </mesh>
        );
      })}
    </group>
  );
}

// ---------- Bathroom ----------

function ToiletModel({ w, h, d, color }: Dims) {
  const bowlR = Math.min(w, d) * 0.42;
  const tankW = w * 0.85;
  const tankD = d * 0.28;
  const tankH = h * 0.45;
  return (
    <group>
      <mesh position={[0, -h * 0.28, -d * 0.08]} castShadow receiveShadow>
        <cylinderGeometry args={[bowlR * 0.6, bowlR * 0.75, h * 0.42, 16]} />
        <meshStandardMaterial color={color} roughness={0.15} />
      </mesh>
      <mesh position={[0, -h * 0.05, -d * 0.05]} castShadow receiveShadow>
        <cylinderGeometry args={[bowlR, bowlR * 0.9, h * 0.22, 20]} />
        <meshStandardMaterial color={color} roughness={0.15} />
      </mesh>
      <mesh position={[0, h * 0.08, -d * 0.05]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[bowlR * 0.85, bowlR * 0.12, 10, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      <mesh position={[0, h * 0.22, -d / 2 + tankD / 2]} castShadow receiveShadow>
        <boxGeometry args={[tankW, tankH, tankD]} />
        <meshStandardMaterial color={color} roughness={0.15} />
      </mesh>
      <mesh position={[0, h * 0.22 + tankH / 2 + 0.01, -d / 2 + tankD / 2]}>
        <boxGeometry args={[tankW * 1.03, 0.02, tankD * 1.05]} />
        <meshStandardMaterial color={shade(color, -0.05)} roughness={0.1} />
      </mesh>
    </group>
  );
}

function BasinModel({ w, h, d, color }: Dims) {
  const legH = h * 0.55;
  const r = Math.min(w, d);
  return (
    <group>
      <mesh position={[0, -h / 2 + legH / 2, 0]} castShadow>
        <cylinderGeometry args={[r * 0.12, r * 0.16, legH, 12]} />
        <meshStandardMaterial color={color} roughness={0.2} />
      </mesh>
      <mesh position={[0, h / 2 - h * 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h * 0.24, d]} />
        <meshStandardMaterial color={color} roughness={0.15} />
      </mesh>
      <mesh position={[0, h / 2 - h * 0.06, 0]}>
        <cylinderGeometry args={[r * 0.38, r * 0.42, h * 0.1, 20]} />
        <meshStandardMaterial color="#f2f5f7" roughness={0.1} />
      </mesh>
      <mesh position={[0, h / 2 + 0.06, -d * 0.3]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, h / 2 + 0.12, -d * 0.22]} rotation-z={Math.PI / 2.2} castShadow>
        <cylinderGeometry args={[0.01, 0.01, 0.12, 8]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  );
}

function BathtubModel({ w, h, d, color }: Dims) {
  const wallT = Math.min(w, d) * 0.08;
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.2} />
      </mesh>
      <mesh position={[0, wallT, 0]}>
        <boxGeometry args={[w - wallT * 2, h - wallT, d - wallT * 2]} />
        <meshStandardMaterial color={shade(color, -0.12)} roughness={0.25} />
      </mesh>
      <mesh position={[0, h / 2 + 0.05, -d / 2 + wallT]} castShadow>
        <cylinderGeometry args={[0.014, 0.014, 0.12, 8]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  );
}

function ShowerModel({ w, h, d, color }: Dims) {
  const glassColor = '#cfe8ef';
  return (
    <group>
      <mesh position={[0, -h / 2 + 0.02, 0]} receiveShadow>
        <boxGeometry args={[w, 0.04, d]} />
        <meshStandardMaterial color={shade(color, -0.2)} roughness={0.5} />
      </mesh>
      <mesh position={[-w / 2 + 0.01, 0.02, 0]}>
        <boxGeometry args={[0.02, h * 0.96, d]} />
        <meshStandardMaterial color={glassColor} transparent opacity={0.28} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.02, -d / 2 + 0.01]}>
        <boxGeometry args={[w, h * 0.96, 0.02]} />
        <meshStandardMaterial color={glassColor} transparent opacity={0.28} roughness={0.05} />
      </mesh>
      <mesh position={[0, h / 2 - 0.08, -d / 2 + 0.06]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 16]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, h / 2 - 0.02, -d / 2 + 0.02]} rotation-x={Math.PI / 6} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ---------- Electrical ----------

function CeilingFanModel({ w, h, d, color }: Dims) {
  const bladeLen = Math.min(w, d) / 2 - 0.05;
  const bladeCount = 4;
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.08, 0.1, h * 0.6, 12]} />
        <meshStandardMaterial color={shade(color, -0.2)} metalness={0.4} roughness={0.3} />
      </mesh>
      {Array.from({ length: bladeCount }).map((_, i) => {
        const angle = (i / bladeCount) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[(Math.cos(angle) * bladeLen) / 2, -h * 0.15, (Math.sin(angle) * bladeLen) / 2]}
            rotation-y={angle}
            castShadow
          >
            <boxGeometry args={[bladeLen, 0.015, 0.12]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

function AcUnitModel({ w, h, d, color }: Dims) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.3} />
      </mesh>
      {Array.from({ length: 4 }).map((_, i) => (
        <mesh key={i} position={[0, h * 0.3 - i * ((h * 0.5) / 3), d / 2 + 0.003]}>
          <boxGeometry args={[w * 0.85, 0.01, 0.006]} />
          <meshStandardMaterial color={shade(color, -0.3)} />
        </mesh>
      ))}
      <mesh position={[w * 0.35, -h * 0.3, d / 2 + 0.004]}>
        <boxGeometry args={[w * 0.12, 0.02, 0.006]} />
        <meshStandardMaterial color="#3fa9f5" />
      </mesh>
    </group>
  );
}

function WallPlateModel({ w, h, d, color }: Dims) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, d / 2 + 0.002]}>
        <cylinderGeometry args={[Math.min(w, h) * 0.18, Math.min(w, h) * 0.18, 0.004, 16]} />
        <meshStandardMaterial color="#2b2b2b" />
      </mesh>
    </group>
  );
}

// A wall switch panel — a flat plate with a row of small toggle switches,
// distinct from WallPlateModel's single round socket.
function SwitchBoardModel({ w, h, d, color }: Dims) {
  const switchCount = w > 0.15 ? 3 : 2;
  const switchW = (w * 0.7) / switchCount;
  const gap = (w * 0.3) / (switchCount + 1);
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {Array.from({ length: switchCount }).map((_, i) => {
        const x = -w / 2 + gap * (i + 1) + switchW * i + switchW / 2;
        return (
          <mesh key={i} position={[x, 0, d / 2 + 0.003]} castShadow>
            <boxGeometry args={[switchW, h * 0.35, 0.006]} />
            <meshStandardMaterial color="#f2f2f0" roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

// A pendant bulb — a thin ceiling mount, a drop cord, and a glowing bulb at
// the end. Meant to be placed near ceiling height (raise its Elevation),
// same convention as Wall Light/Sconce.
function BulbModel({ w, h, d, color }: Dims) {
  const bulbR = Math.min(w, d) * 0.4;
  const cordLen = Math.max(0.02, h - bulbR * 2);
  return (
    <group>
      <mesh position={[0, h / 2 - 0.01, 0]} castShadow>
        <cylinderGeometry args={[Math.min(w, d) * 0.5, Math.min(w, d) * 0.5, 0.02, 16]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.5} />
      </mesh>
      <mesh position={[0, h / 2 - cordLen / 2, 0]}>
        <cylinderGeometry args={[0.004, 0.004, cordLen, 6]} />
        <meshStandardMaterial color="#2b2b2b" />
      </mesh>
      <mesh position={[0, -h / 2 + bulbR, 0]} castShadow>
        <sphereGeometry args={[bulbR, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// ---------- Decoration ----------

function PottedPlantModel({ w, h, d, color }: Dims) {
  const potH = h * 0.28;
  const potR = Math.min(w, d) / 2;
  const foliageR = Math.min(w, d) * 0.55;
  return (
    <group>
      <mesh position={[0, -h / 2 + potH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[potR * 0.7, potR, potH, 12]} />
        <meshStandardMaterial color="#a5745a" roughness={0.8} />
      </mesh>
      <mesh position={[0, -h / 2 + potH + 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.03, h * 0.35, 6]} />
        <meshStandardMaterial color="#4a3a2a" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[
            Math.cos(i * 1.7) * foliageR * 0.3,
            h * 0.25 + (i % 2) * h * 0.12,
            Math.sin(i * 1.7) * foliageR * 0.3,
          ]}
          castShadow
        >
          <sphereGeometry args={[foliageR * (0.6 + (i % 2) * 0.15), 10, 10]} />
          <meshStandardMaterial color={i % 2 ? shade(color, 0.1) : color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function RugModel({ w, h, d, color }: Dims) {
  const base = shade(color, -0.15);
  return (
    <group>
      <mesh receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={base} roughness={1} />
      </mesh>
      <mesh position={[0, h / 2 + 0.0015, 0]} receiveShadow>
        <boxGeometry args={[w * 0.86, 0.003, d * 0.86]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
    </group>
  );
}

function FramedDecorModel({ w, h, d, color }: Dims) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={shade(color, -0.3)} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, d * 0.1]}>
        <boxGeometry args={[w * 0.82, h * 0.82, d * 0.6]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}

// ---------- Furniture ----------

type SofaVariant = 'straight' | 'l-shaped' | 'loveseat';

function SofaModel({ w, h, d, color, variant = 'straight' }: Dims & { variant?: SofaVariant }) {
  const armW = Math.min(w * 0.12, 0.15);
  const seatH = h * 0.55;
  const backH = h - seatH;
  // A loveseat reads as one continuous two-seat cushion rather than a run
  // of several — no seat-divider lines, and slightly bulkier arms, the
  // visual cue that distinguishes it from a plain 'straight' sofa scaled
  // down to the same width.
  const seatCount = variant === 'loveseat' ? 1 : Math.max(1, Math.round((w - armW * 2) / 0.7));
  const armWActual = variant === 'loveseat' ? armW * 1.4 : armW;
  // The L-shaped chaise: an extra block extending in +Z off the right end,
  // as deep as the sofa is wide-ish, turning the silhouette from a
  // straight rectangle into a real L rather than just a resized box.
  // A fixed proportion of the sofa's own depth, rather than comparing
  // against width, so the chaise reads as an unmistakable L regardless of
  // this particular instance's exact Width/Depth — a modest few-percent
  // bump would just look like a rendering quirk, not a different shape.
  const chaiseDepth = variant === 'l-shaped' ? d * 1.7 : 0;

  return (
    <group>
      <mesh position={[0, -h / 2 + seatH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w - armWActual * 2, seatH, d]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[0, h / 2 - backH / 2, -d / 2 + d * 0.12]} castShadow receiveShadow>
        <boxGeometry args={[w - armWActual * 2, backH, d * 0.24]} />
        <meshStandardMaterial color={shade(color, -0.08)} roughness={0.85} />
      </mesh>
      <mesh position={[-w / 2 + armWActual / 2, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[armWActual, h * 0.7, d]} />
        <meshStandardMaterial color={shade(color, -0.12)} roughness={0.85} />
      </mesh>
      <mesh position={[w / 2 - armWActual / 2, 0, chaiseDepth > 0 ? (chaiseDepth - d) / 2 : 0]} castShadow receiveShadow>
        <boxGeometry args={[armWActual, h * 0.7, chaiseDepth > 0 ? chaiseDepth : d]} />
        <meshStandardMaterial color={shade(color, -0.12)} roughness={0.85} />
      </mesh>
      {chaiseDepth > 0 && (
        <mesh position={[w / 2 - armWActual - w * 0.25, -h / 2 + seatH / 2, d / 2 + (chaiseDepth - d) / 2]} castShadow receiveShadow>
          <boxGeometry args={[w * 0.5, seatH, chaiseDepth - d]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      )}
      {Array.from({ length: seatCount - 1 }).map((_, i) => {
        const x = -w / 2 + armWActual + ((w - armWActual * 2) / seatCount) * (i + 1);
        return (
          <mesh key={i} position={[x, -h / 2 + seatH, 0]}>
            <boxGeometry args={[0.01, 0.01, d]} />
            <meshStandardMaterial color={shade(color, -0.2)} />
          </mesh>
        );
      })}
    </group>
  );
}

type TableVariant = 'rectangular' | 'round';

function TableModel({ w, h, d, color, variant = 'rectangular' }: Dims & { variant?: TableVariant }) {
  const topH = Math.min(0.05, h * 0.12);
  const legH = h - topH;

  if (variant === 'round') {
    const radius = Math.min(w, d) / 2;
    const pedestalR = radius * 0.12;
    return (
      <group>
        <mesh position={[0, h / 2 - topH / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[radius, radius, topH, 32]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        <mesh position={[0, -topH / 2, 0]} castShadow>
          <cylinderGeometry args={[pedestalR, pedestalR, legH, 16]} />
          <meshStandardMaterial color={shade(color, -0.25)} roughness={0.5} />
        </mesh>
        <mesh position={[0, -topH / 2 - legH / 2 + 0.015, 0]} castShadow>
          <cylinderGeometry args={[radius * 0.45, radius * 0.45, 0.03, 24]} />
          <meshStandardMaterial color={shade(color, -0.25)} roughness={0.5} />
        </mesh>
      </group>
    );
  }

  const legInset = Math.min(w, d) * 0.08;
  const legW = Math.min(0.05, w * 0.04);
  const legD = Math.min(0.05, d * 0.04);
  const legs = [
    [-w / 2 + legInset, -d / 2 + legInset],
    [w / 2 - legInset, -d / 2 + legInset],
    [-w / 2 + legInset, d / 2 - legInset],
    [w / 2 - legInset, d / 2 - legInset],
  ];
  return (
    <group>
      <mesh position={[0, h / 2 - topH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, topH, d]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {legs.map(([x, z], i) => (
        <mesh key={i} position={[x, -topH / 2, z]} castShadow>
          <boxGeometry args={[legW, legH, legD]} />
          <meshStandardMaterial color={shade(color, -0.25)} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function TvTableModel({ w, h, d, color }: Dims) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, d / 2 + 0.002]}>
        <boxGeometry args={[w * 0.92, 0.01, 0.005]} />
        <meshStandardMaterial color={shade(color, -0.3)} />
      </mesh>
    </group>
  );
}

function ChairModel({ w, h, d, color }: Dims) {
  const seatH = h * 0.5;
  const backH = h - seatH;
  const legInset = Math.min(w, d) * 0.15;
  const legW = Math.min(0.04, w * 0.06);
  const legD = Math.min(0.04, d * 0.06);
  const legs = [
    [-w / 2 + legInset, -d / 2 + legInset],
    [w / 2 - legInset, -d / 2 + legInset],
    [-w / 2 + legInset, d / 2 - legInset],
    [w / 2 - legInset, d / 2 - legInset],
  ];
  return (
    <group>
      <mesh position={[0, -h / 2 + seatH + h * 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h * 0.08, d]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0, h / 2 - backH / 2, -d / 2 + d * 0.08]} castShadow receiveShadow>
        <boxGeometry args={[w, backH, d * 0.12]} />
        <meshStandardMaterial color={shade(color, -0.1)} roughness={0.6} />
      </mesh>
      {legs.map(([x, z], i) => (
        <mesh key={i} position={[x, -h / 2 + seatH / 2, z]} castShadow>
          <boxGeometry args={[legW, seatH, legD]} />
          <meshStandardMaterial color={shade(color, -0.25)} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

type BedVariant = 'headboard' | 'platform';

function BedModel({ w, h, d, color, pillows, variant = 'headboard' }: Dims & { pillows: number; variant?: BedVariant }) {
  const frameH = h * 0.5;
  const mattressH = h * 0.5;
  const pillowW = pillows === 2 ? w * 0.28 : w * 0.5;
  const pillowGap = pillows === 2 ? w * 0.06 : 0;
  const startX = -(pillowW * pillows + pillowGap * (pillows - 1)) / 2 + pillowW / 2;
  return (
    <group>
      <mesh position={[0, -h / 2 + frameH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, frameH, d]} />
        <meshStandardMaterial color={shade(color, -0.2)} roughness={0.8} />
      </mesh>
      <mesh position={[0, -h / 2 + frameH + mattressH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.96, mattressH, d * 0.96]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {variant === 'headboard' && (
        <mesh position={[0, 0, -d / 2 + 0.02]} castShadow>
          <boxGeometry args={[w, h * 1.3, 0.04]} />
          <meshStandardMaterial color={shade(color, -0.3)} roughness={0.7} />
        </mesh>
      )}
      {Array.from({ length: pillows }).map((_, i) => (
        <mesh key={i} position={[startX + i * (pillowW + pillowGap), h / 2 + 0.02, -d / 2 + d * 0.18]} castShadow>
          <boxGeometry args={[pillowW, 0.06, d * 0.22]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function WardrobeModel({ w, h, d, color }: Dims) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, d / 2 + 0.002]}>
        <boxGeometry args={[0.01, h * 0.96, 0.004]} />
        <meshStandardMaterial color={shade(color, -0.3)} />
      </mesh>
      <mesh position={[-w * 0.05, 0, d / 2 + 0.02]} castShadow>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color="#c9c2b0" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[w * 0.05, 0, d / 2 + 0.02]} castShadow>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color="#c9c2b0" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

function BookshelfModel({ w, h, d, color }: Dims) {
  const shelfCount = 3;
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {Array.from({ length: shelfCount }).map((_, i) => {
        const y = -h / 2 + (h / (shelfCount + 1)) * (i + 1);
        return (
          <mesh key={i} position={[0, y, d * 0.02]}>
            <boxGeometry args={[w * 0.94, 0.01, d * 0.9]} />
            <meshStandardMaterial color={shade(color, -0.25)} />
          </mesh>
        );
      })}
      <mesh position={[-w * 0.25, h * 0.18, d * 0.15]} castShadow>
        <boxGeometry args={[w * 0.06, h * 0.18, d * 0.5]} />
        <meshStandardMaterial color="#a3402c" roughness={0.7} />
      </mesh>
      <mesh position={[-w * 0.1, h * 0.18, d * 0.15]} castShadow>
        <boxGeometry args={[w * 0.06, h * 0.18, d * 0.5]} />
        <meshStandardMaterial color="#3d5a80" roughness={0.7} />
      </mesh>
      <mesh position={[w * 0.15, h * 0.18, d * 0.15]} castShadow>
        <boxGeometry args={[w * 0.06, h * 0.18, d * 0.5]} />
        <meshStandardMaterial color="#8a9b5e" roughness={0.7} />
      </mesh>
    </group>
  );
}

// A display cabinet — a wooden frame with shelves, like BookshelfModel, but
// a glass front panel (semi-transparent, glossy) covering the whole face
// instead of open shelves, since a showcase is for displaying glassware/
// trophies behind a door rather than reaching in for books.
function ShowcaseModel({ w, h, d, color }: Dims) {
  const shelfCount = 3;
  const frameDepth = d * 0.06;
  return (
    <group>
      <mesh position={[0, 0, -d / 2 + frameDepth / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h, frameDepth]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[-w / 2 + 0.01, 0, 0]} castShadow>
        <boxGeometry args={[0.02, h, d]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[w / 2 - 0.01, 0, 0]} castShadow>
        <boxGeometry args={[0.02, h, d]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, h / 2 - 0.01, 0]} castShadow>
        <boxGeometry args={[w, 0.02, d]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, -h / 2 + 0.01, 0]} castShadow>
        <boxGeometry args={[w, 0.02, d]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {Array.from({ length: shelfCount }).map((_, i) => {
        const y = -h / 2 + (h / (shelfCount + 1)) * (i + 1);
        return (
          <mesh key={i} position={[0, y, 0]}>
            <boxGeometry args={[w * 0.92, 0.008, d * 0.88]} />
            <meshStandardMaterial color={shade(color, -0.15)} roughness={0.4} />
          </mesh>
        );
      })}
      <mesh position={[0, 0, d / 2 - 0.006]}>
        <boxGeometry args={[w * 0.94, h * 0.94, 0.008]} />
        <meshPhysicalMaterial color="#cfe8ee" transparent opacity={0.28} roughness={0.05} metalness={0} transmission={0.6} />
      </mesh>
    </group>
  );
}

// A pooja mandir (home shrine) — a small wooden cabinet with corner pillars,
// an arched pediment on top, and an open altar shelf, distinct from every
// other cabinet-style model by its arch + pillar silhouette.
function PoojaMandirModel({ w, h, d, color }: Dims) {
  const baseH = h * 0.16;
  const pillarH = h * 0.62;
  const archH = h - baseH - pillarH;
  const pillarR = Math.min(w, d) * 0.05;
  const woodColor = shade(color, -0.05);
  return (
    <group>
      <mesh position={[0, -h / 2 + baseH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, baseH, d]} />
        <meshStandardMaterial color={shade(color, -0.15)} roughness={0.6} />
      </mesh>
      <mesh position={[0, -h / 2 + baseH + 0.01, 0]} receiveShadow>
        <boxGeometry args={[w * 0.92, 0.02, d * 0.85]} />
        <meshStandardMaterial color={shade(color, -0.3)} roughness={0.5} />
      </mesh>
      {[
        [-w / 2 + pillarR * 1.4, -d / 2 + pillarR * 1.4],
        [w / 2 - pillarR * 1.4, -d / 2 + pillarR * 1.4],
        [-w / 2 + pillarR * 1.4, d / 2 - pillarR * 1.4],
        [w / 2 - pillarR * 1.4, d / 2 - pillarR * 1.4],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, -h / 2 + baseH + pillarH / 2, z]} castShadow>
          <cylinderGeometry args={[pillarR, pillarR, pillarH, 12]} />
          <meshStandardMaterial color={woodColor} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, h / 2 - archH * 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, archH * 0.35, d]} />
        <meshStandardMaterial color={woodColor} roughness={0.5} />
      </mesh>
      <mesh position={[0, h / 2 - archH * 0.18, 0]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[Math.min(w, d) * 0.68, archH * 0.55, 4]} />
        <meshStandardMaterial color={shade(color, -0.2)} roughness={0.55} />
      </mesh>
      <mesh position={[0, -h / 2 + baseH + pillarH * 0.75, 0]} castShadow>
        <boxGeometry args={[w * 0.4, pillarH * 0.3, d * 0.3]} />
        <meshStandardMaterial color="#d9b25a" metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}

const RAIL_COLOR = '#7a7a7a';
// Standard ergonomic handrail height above the pitch line — a fixed real-world
// mm value (capped for very short flights) rather than a fraction of total
// rise, so the rail always sits at a graspable height regardless of h.
function railRise(h: number): number {
  return Math.min(0.9, h * 0.45);
}

export type RailSide = 'left' | 'right' | 'both';

// The handrail's horizontal position for a single-flight staircase: which
// side of the stair it runs along, and how far it sits from that side's
// edge. `offsetMm` is measured from the stair's true edge — negative (the
// default) tucks the rail in over the tread, 0 sits flush with the edge, and
// positive lets it float further out past the edge.
function railX(w: number, side: 'left' | 'right' = 'right', offsetMm = -30): number {
  const edge = w / 2 + offsetMm / 1000;
  return side === 'right' ? edge : -edge;
}

// Wraps HandrailRun for a single-flight staircase's `railSide` setting —
// 'left'/'right' places one run, 'both' places one on each side (mirrored
// around the stair's centerline) so climbers have a rail to grab from
// either edge.
function StaircaseHandrails({
  w,
  railSide,
  railOffsetMm,
  steps,
  stepDepth,
  stepRise,
  startZ,
  h0,
  startFrac,
  endFrac,
}: {
  w: number;
  railSide?: RailSide;
  railOffsetMm?: number;
  steps: number;
  stepDepth: number;
  stepRise: number;
  startZ: number;
  h0: number;
  startFrac: number;
  endFrac: number;
}) {
  const sides: ('left' | 'right')[] = railSide === 'both' ? ['left', 'right'] : [railSide ?? 'right'];
  return (
    <>
      {sides.map((side) => (
        <HandrailRun
          key={side}
          x={railX(w, side, railOffsetMm)}
          steps={steps}
          stepDepth={stepDepth}
          stepRise={stepRise}
          startZ={startZ}
          h0={h0}
          startFrac={startFrac}
          endFrac={endFrac}
        />
      ))}
    </>
  );
}

// A run of evenly spaced vertical balusters from each step's outer edge up to
// the rail line, plus newel posts at the bottom and top — shared by every
// staircase variant so the rail reads as actually supported rather than a bar
// floating beside the steps. `startFrac`/`endFrac` (0–1, along this run's own
// step count) let the rail cover only part of the flight — e.g. skip the
// bottom few steps, or the top few — instead of always running the full
// length; the default (0 to 1) is the previous, full-length behavior.
function HandrailRun({
  x,
  steps,
  stepDepth,
  stepRise,
  startZ,
  h0,
  zDir = 1,
  yDir = 1,
  startFrac = 0,
  endFrac = 1,
}: {
  x: number;
  steps: number;
  stepDepth: number;
  stepRise: number;
  startZ: number;
  h0: number;
  zDir?: 1 | -1;
  yDir?: 1 | -1;
  startFrac?: number;
  endFrac?: number;
}) {
  if (endFrac <= startFrac) return null;
  const railY = railRise(steps * stepRise);
  const iStart = startFrac * steps;
  const iEnd = endFrac * steps;
  const runDepth = (iEnd - iStart) * stepDepth;
  const runRise = (iEnd - iStart) * stepRise;
  const pitch = Math.atan2(runRise * yDir, runDepth * zDir);
  const baseZ = startZ + zDir * stepDepth * iStart;
  const baseY = h0 + yDir * stepRise * iStart;
  const midZ = baseZ + (zDir * runDepth) / 2;
  const midY = baseY + (yDir * runRise) / 2 + railY;
  const firstPost = Math.ceil(iStart);
  const lastPost = Math.floor(iEnd);
  return (
    <group>
      <mesh position={[x, midY, midZ]} rotation-x={-pitch} castShadow>
        <boxGeometry args={[0.035, 0.035, Math.hypot(runRise, runDepth) * 0.97]} />
        <meshStandardMaterial color={RAIL_COLOR} metalness={0.4} roughness={0.35} />
      </mesh>
      {Array.from({ length: Math.max(0, lastPost - firstPost + 1) }).map((_, k) => {
        const i = firstPost + k;
        const treadY = h0 + yDir * stepRise * i;
        const postZ = startZ + zDir * stepDepth * i;
        const postH = railY - stepRise * 0.15;
        return (
          <mesh key={i} position={[x, treadY + postH / 2, postZ]} castShadow>
            <boxGeometry args={[0.03, postH, 0.03]} />
            <meshStandardMaterial color={RAIL_COLOR} metalness={0.3} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

interface StaircaseProps extends Dims {
  railSide?: RailSide;
  railOffsetMm?: number;
  stepCount?: number;
  // Whether the handrail renders at all, and if so what portion (0–100, as a
  // percent along the flight) it covers — undefined means "the whole flight"
  // for each, the previous and still default behavior. Lets the rail be
  // removed entirely, or only over part of the run (e.g. skip the bottom
  // steps near an open landing).
  railEnabled?: boolean;
  railStartPercent?: number;
  railEndPercent?: number;
}

function StaircaseModel({
  w,
  h,
  d,
  color,
  railSide,
  railOffsetMm,
  stepCount,
  railEnabled = true,
  railStartPercent = 0,
  railEndPercent = 100,
}: StaircaseProps) {
  const steps = Math.max(3, Math.min(30, stepCount ?? Math.max(6, Math.min(18, Math.round(d / 0.28)))));
  const stepDepth = d / steps;
  const stepRise = h / steps;
  const treadThickness = Math.min(0.04, stepRise * 0.35);
  return (
    <group>
      {Array.from({ length: steps }).map((_, i) => {
        // A thin tread + riser per step, not a solid block down to the
        // floor — the run's own diagonal stringer is enough to read as a
        // real staircase, and leaves the triangular volume underneath open
        // (usable as understair storage) instead of a solid closed mass.
        const treadTopY = stepRise * (i + 1) - h / 2;
        const frontZ = -d / 2 + stepDepth * (i + 1);
        return (
          <group key={i}>
            <mesh position={[0, treadTopY - treadThickness / 2, frontZ - stepDepth / 2]} castShadow receiveShadow>
              <boxGeometry args={[w, treadThickness, stepDepth * 0.96]} />
              <meshStandardMaterial color={i % 2 === 0 ? color : shade(color, -0.06)} roughness={0.6} />
            </mesh>
            <mesh position={[0, treadTopY - stepRise / 2, frontZ]} castShadow>
              <boxGeometry args={[w, stepRise, 0.02]} />
              <meshStandardMaterial color={shade(color, -0.1)} roughness={0.7} />
            </mesh>
          </group>
        );
      })}
      {railEnabled && (
        <StaircaseHandrails
          w={w}
          railSide={railSide}
          railOffsetMm={railOffsetMm}
          steps={steps}
          stepDepth={stepDepth}
          stepRise={stepRise}
          startZ={-d / 2}
          h0={-h / 2}
          startFrac={railStartPercent / 100}
          endFrac={railEndPercent / 100}
        />
      )}
    </group>
  );
}

// Closed-riser staircase: full-depth treads with a full-height riser panel
// directly beneath each one, so consecutive steps share a flush edge and
// there's no visible gap looking at the run from the side (unlike
// StaircaseModel's thin open-tread look) — while the triangular volume under
// the stringer is still left hollow, not filled in as a solid block.
function ClosedRiserStaircaseModel({
  w,
  h,
  d,
  color,
  railSide,
  railOffsetMm,
  stepCount,
  railEnabled = true,
  railStartPercent = 0,
  railEndPercent = 100,
}: StaircaseProps) {
  const steps = Math.max(3, Math.min(30, stepCount ?? Math.max(6, Math.min(18, Math.round(d / 0.28)))));
  const stepDepth = d / steps;
  const stepRise = h / steps;
  const treadOverhang = stepDepth * 0.08; // small nosing over the riser below
  return (
    <group>
      {Array.from({ length: steps }).map((_, i) => {
        const treadTopY = stepRise * (i + 1) - h / 2;
        const treadBackZ = -d / 2 + stepDepth * i;
        const treadFrontZ = -d / 2 + stepDepth * (i + 1) + treadOverhang;
        const treadCenterZ = (treadBackZ + treadFrontZ) / 2;
        const treadDepth = treadFrontZ - treadBackZ;
        return (
          <group key={i}>
            <mesh position={[0, treadTopY - stepRise * 0.06, treadCenterZ]} castShadow receiveShadow>
              <boxGeometry args={[w, stepRise * 0.12, treadDepth]} />
              <meshStandardMaterial color={i % 2 === 0 ? color : shade(color, -0.06)} roughness={0.6} />
            </mesh>
            <mesh position={[0, treadTopY - stepRise / 2, treadFrontZ - treadOverhang]} castShadow receiveShadow>
              <boxGeometry args={[w, stepRise, 0.03]} />
              <meshStandardMaterial color={shade(color, -0.1)} roughness={0.7} />
            </mesh>
          </group>
        );
      })}
      {railEnabled && (
        <StaircaseHandrails
          w={w}
          railSide={railSide}
          railOffsetMm={railOffsetMm}
          steps={steps}
          stepDepth={stepDepth}
          stepRise={stepRise}
          startZ={-d / 2}
          h0={-h / 2}
          startFrac={railStartPercent / 100}
          endFrac={railEndPercent / 100}
        />
      )}
    </group>
  );
}

// A U-shaped switchback — two parallel half-height flights side by side
// joined by a mid-height landing, with a handrail down the shared spine
// between them — the common enclosed/indoor stair layout, distinct from
// StaircaseModel's single straight open flight (which reads more like an
// exterior/deck stair).
function InteriorStaircaseModel({
  w,
  h,
  d,
  color,
  stepCount,
  railEnabled = true,
  railStartPercent = 0,
  railEndPercent = 100,
}: Dims & { stepCount?: number; railEnabled?: boolean; railStartPercent?: number; railEndPercent?: number }) {
  const flightW = w / 2;
  const landingDepth = Math.min(d * 0.22, 0.9);
  const runDepth = d - landingDepth;
  const steps = Math.max(2, Math.min(15, stepCount ?? Math.max(4, Math.min(10, Math.round(runDepth / 0.28)))));
  const stepDepth = runDepth / steps;
  const stepRise = h / 2 / steps;
  const railColor = '#7a7a7a';
  const treadColor = shade(color, -0.06);
  const treadThickness = Math.min(0.04, stepRise * 0.35);

  return (
    <group>
      {/* Flight 1: back wall up to the landing, left half. Thin tread +
          riser per step rather than a solid block down to the floor,
          leaving the space under each flight open (understair storage)
          instead of a closed wedge. */}
      {Array.from({ length: steps }).map((_, i) => {
        const treadTopY = -h / 2 + stepRise * (i + 1);
        const frontZ = -d / 2 + stepDepth * (i + 1);
        return (
          <group key={`f1-${i}`}>
            <mesh position={[-flightW / 2, treadTopY - treadThickness / 2, frontZ - stepDepth / 2]} castShadow receiveShadow>
              <boxGeometry args={[flightW, treadThickness, stepDepth * 0.96]} />
              <meshStandardMaterial color={i % 2 === 0 ? color : treadColor} roughness={0.6} />
            </mesh>
            <mesh position={[-flightW / 2, treadTopY - stepRise / 2, frontZ]} castShadow>
              <boxGeometry args={[flightW, stepRise, 0.02]} />
              <meshStandardMaterial color={shade(color, -0.1)} roughness={0.7} />
            </mesh>
          </group>
        );
      })}

      {/* Landing, connecting the two flights at mid-height. */}
      <mesh position={[0, -0.04, d / 2 - landingDepth / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.08, landingDepth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>

      {/* Flight 2: landing up to full height, right half, retracing back
          toward the rear wall — same open thin tread + riser treatment. */}
      {Array.from({ length: steps }).map((_, i) => {
        const treadTopY = stepRise * (i + 1);
        const frontZ = d / 2 - landingDepth - stepDepth * (i + 1);
        return (
          <group key={`f2-${i}`}>
            <mesh position={[flightW / 2, treadTopY - treadThickness / 2, frontZ + stepDepth / 2]} castShadow receiveShadow>
              <boxGeometry args={[flightW, treadThickness, stepDepth * 0.96]} />
              <meshStandardMaterial color={i % 2 === 0 ? color : treadColor} roughness={0.6} />
            </mesh>
            <mesh position={[flightW / 2, treadTopY - stepRise / 2, frontZ]} castShadow>
              <boxGeometry args={[flightW, stepRise, 0.02]} />
              <meshStandardMaterial color={shade(color, -0.1)} roughness={0.7} />
            </mesh>
          </group>
        );
      })}

      {/* Handrail + balusters down the shared spine between the two flights, one run per pitch. */}
      {railEnabled && (
        <>
          <HandrailRun
            x={0}
            steps={steps}
            stepDepth={stepDepth}
            stepRise={stepRise}
            startZ={-d / 2}
            h0={-h / 2}
            startFrac={railStartPercent / 100}
            endFrac={railEndPercent / 100}
          />
          <HandrailRun
            x={0}
            steps={steps}
            stepDepth={stepDepth}
            stepRise={stepRise}
            startZ={d / 2 - landingDepth}
            h0={0}
            zDir={-1}
            yDir={1}
            startFrac={railStartPercent / 100}
            endFrac={railEndPercent / 100}
          />
          <mesh position={[0, railRise(h / 2), d / 2 - landingDepth / 2]} castShadow>
            <boxGeometry args={[0.035, railRise(h / 2) * 2, 0.035]} />
            <meshStandardMaterial color={railColor} metalness={0.4} roughness={0.35} />
          </mesh>
        </>
      )}
    </group>
  );
}

// Same as HandrailRun, but for a run that travels along X instead of Z (the
// second leg of an L-shaped staircase) — the rail bar rotates about Z
// instead of X, and its fixed lateral offset is a Z position instead of an
// X position.
function HandrailRunAlongX({
  z,
  steps,
  stepWidth,
  stepRise,
  startX,
  h0,
  xDir = 1,
  yDir = 1,
  startFrac = 0,
  endFrac = 1,
}: {
  z: number;
  steps: number;
  stepWidth: number;
  stepRise: number;
  startX: number;
  h0: number;
  xDir?: 1 | -1;
  yDir?: 1 | -1;
  startFrac?: number;
  endFrac?: number;
}) {
  if (endFrac <= startFrac) return null;
  const railY = railRise(steps * stepRise);
  const iStart = startFrac * steps;
  const iEnd = endFrac * steps;
  const runWidth = (iEnd - iStart) * stepWidth;
  const runRise = (iEnd - iStart) * stepRise;
  const pitch = Math.atan2(runRise * yDir, runWidth * xDir);
  const baseX = startX + xDir * stepWidth * iStart;
  const baseY = h0 + yDir * stepRise * iStart;
  const midX = baseX + (xDir * runWidth) / 2;
  const midY = baseY + (yDir * runRise) / 2 + railY;
  const firstPost = Math.ceil(iStart);
  const lastPost = Math.floor(iEnd);
  return (
    <group>
      <mesh position={[midX, midY, z]} rotation-z={pitch} castShadow>
        <boxGeometry args={[Math.hypot(runRise, runWidth) * 0.97, 0.035, 0.035]} />
        <meshStandardMaterial color={RAIL_COLOR} metalness={0.4} roughness={0.35} />
      </mesh>
      {Array.from({ length: Math.max(0, lastPost - firstPost + 1) }).map((_, k) => {
        const i = firstPost + k;
        const treadY = h0 + yDir * stepRise * i;
        const postX = startX + xDir * stepWidth * i;
        const postH = railY - stepRise * 0.15;
        return (
          <mesh key={i} position={[postX, treadY + postH / 2, z]} castShadow>
            <boxGeometry args={[0.03, postH, 0.03]} />
            <meshStandardMaterial color={RAIL_COLOR} metalness={0.3} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

// An L-shaped (quarter-turn) staircase: one flight along the depth axis,
// a square corner landing, then a second flight turning 90° to continue
// along the width axis — distinct from InteriorStaircaseModel's U-shaped
// (180°) switchback, which runs both flights parallel to each other.
function LShapedStaircaseModel({
  w,
  h,
  d,
  color,
  stepCount,
  railEnabled = true,
  railStartPercent = 0,
  railEndPercent = 100,
}: Dims & { stepCount?: number; railEnabled?: boolean; railStartPercent?: number; railEndPercent?: number }) {
  const legW = Math.min(w, d) * 0.42;
  const runDepth1 = Math.max(0.3, d - legW);
  const runWidth2 = Math.max(0.3, w - legW);
  const totalRun = runDepth1 + runWidth2;
  const totalSteps = Math.max(6, Math.min(24, stepCount ?? Math.max(8, Math.min(20, Math.round(totalRun / 0.28)))));
  const stepPitch = totalRun / totalSteps;
  const stepRise = h / totalSteps;
  const steps1 = Math.max(1, Math.min(totalSteps - 1, Math.round(runDepth1 / stepPitch)));
  const steps2 = Math.max(1, totalSteps - steps1);
  const stepDepth1 = runDepth1 / steps1;
  const stepDepth2 = runWidth2 / steps2;
  const treadThickness = Math.min(0.04, stepRise * 0.35);
  const treadColor = shade(color, -0.06);
  const flight1X = -w / 2 + legW / 2;
  const flight2Z = d / 2 - legW / 2;
  const landingY = -h / 2 + steps1 * stepRise;

  return (
    <group>
      {/* Flight 1: along the depth (Z) axis, up the left leg. */}
      {Array.from({ length: steps1 }).map((_, i) => {
        const treadTopY = -h / 2 + stepRise * (i + 1);
        const frontZ = -d / 2 + stepDepth1 * (i + 1);
        return (
          <group key={`f1-${i}`}>
            <mesh position={[flight1X, treadTopY - treadThickness / 2, frontZ - stepDepth1 / 2]} castShadow receiveShadow>
              <boxGeometry args={[legW, treadThickness, stepDepth1 * 0.96]} />
              <meshStandardMaterial color={i % 2 === 0 ? color : treadColor} roughness={0.6} />
            </mesh>
            <mesh position={[flight1X, treadTopY - stepRise / 2, frontZ]} castShadow>
              <boxGeometry args={[legW, stepRise, 0.02]} />
              <meshStandardMaterial color={shade(color, -0.1)} roughness={0.7} />
            </mesh>
          </group>
        );
      })}

      {/* Square corner landing where the two flights meet. */}
      <mesh position={[flight1X, landingY - 0.04, flight2Z]} castShadow receiveShadow>
        <boxGeometry args={[legW, 0.08, legW]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>

      {/* Flight 2: turns 90° onto the width (X) axis, up the front leg. */}
      {Array.from({ length: steps2 }).map((_, i) => {
        const treadTopY = landingY + stepRise * (i + 1);
        const frontX = -w / 2 + legW + stepDepth2 * (i + 1);
        return (
          <group key={`f2-${i}`}>
            <mesh position={[frontX - stepDepth2 / 2, treadTopY - treadThickness / 2, flight2Z]} castShadow receiveShadow>
              <boxGeometry args={[stepDepth2 * 0.96, treadThickness, legW]} />
              <meshStandardMaterial color={i % 2 === 0 ? color : treadColor} roughness={0.6} />
            </mesh>
            <mesh position={[frontX, treadTopY - stepRise / 2, flight2Z]} castShadow>
              <boxGeometry args={[0.02, stepRise, legW]} />
              <meshStandardMaterial color={shade(color, -0.1)} roughness={0.7} />
            </mesh>
          </group>
        );
      })}

      {railEnabled && (
        <>
          <HandrailRun
            x={flight1X - legW / 2}
            steps={steps1}
            stepDepth={stepDepth1}
            stepRise={stepRise}
            startZ={-d / 2}
            h0={-h / 2}
            startFrac={railStartPercent / 100}
            endFrac={railEndPercent / 100}
          />
          <HandrailRunAlongX
            z={flight2Z + legW / 2}
            steps={steps2}
            stepWidth={stepDepth2}
            stepRise={stepRise}
            startX={-w / 2 + legW}
            h0={landingY}
            startFrac={railStartPercent / 100}
            endFrac={railEndPercent / 100}
          />
        </>
      )}
    </group>
  );
}

function TvModel({ w, h, d, color }: Dims) {
  const standWidth = w * 0.55;
  const standHeight = h * 0.08;
  const screenHeight = h * 0.75;
  const neckHeight = Math.max(0.02, h - standHeight - screenHeight);
  return (
    <group>
      <mesh position={[0, -h / 2 + standHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[standWidth, standHeight, d]} />
        <meshStandardMaterial color="#2b2b2b" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, -h / 2 + standHeight + neckHeight / 2, 0]} castShadow>
        <boxGeometry args={[standWidth * 0.15, neckHeight, d * 0.3]} />
        <meshStandardMaterial color="#2b2b2b" roughness={0.5} />
      </mesh>
      <mesh position={[0, h / 2 - screenHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, screenHeight, d * 0.15]} />
        <meshStandardMaterial color="#141414" roughness={0.3} metalness={0.3} />
      </mesh>
      <mesh position={[0, h / 2 - screenHeight / 2, (d * 0.15) / 2 + 0.005]}>
        <boxGeometry args={[w * 0.94, screenHeight * 0.9, 0.005]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} roughness={0.2} />
      </mesh>
    </group>
  );
}

// A wall-mounted TV — just the thin screen and a slim wall bracket, no
// floor stand or neck, since it's meant to be placed high on a wall
// (raise its Elevation) rather than sitting on a TV table.
function WallMountedTvModel({ w, h, d, color }: Dims) {
  const bracketDepth = Math.max(0.02, d);
  return (
    <group>
      <mesh position={[0, 0, -bracketDepth / 2 + 0.01]} castShadow>
        <boxGeometry args={[w * 0.12, h * 0.5, bracketDepth * 0.6]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, bracketDepth * 0.3]} />
        <meshStandardMaterial color="#141414" roughness={0.3} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, (bracketDepth * 0.3) / 2 + 0.005]}>
        <boxGeometry args={[w * 0.94, h * 0.9, 0.005]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} roughness={0.2} />
      </mesh>
    </group>
  );
}

// ---------- Exterior ----------

function TreeModel({ w, h, d, color }: Dims) {
  const trunkH = h * 0.35;
  const canopyR = Math.min(w, d) * 0.5;
  return (
    <group>
      <mesh position={[0, -h / 2 + trunkH / 2, 0]} castShadow>
        <cylinderGeometry args={[Math.min(w, d) * 0.06, Math.min(w, d) * 0.09, trunkH, 8]} />
        <meshStandardMaterial color="#5b3f2a" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = i * 1.3;
        const r = canopyR * 0.35;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * r * 0.4, h * 0.15 + (i % 2) * h * 0.1, Math.sin(angle) * r * 0.4]}
            castShadow
          >
            <sphereGeometry args={[canopyR * (0.55 + (i % 3) * 0.08), 10, 10]} />
            <meshStandardMaterial color={i % 2 ? shade(color, 0.08) : color} roughness={0.95} />
          </mesh>
        );
      })}
    </group>
  );
}

function HedgeModel({ w, h, d, color }: Dims) {
  const bumps = Math.max(3, Math.round(w / 0.5));
  return (
    <group>
      <mesh position={[0, -h * 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h * 0.8, d]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {Array.from({ length: bumps }).map((_, i) => {
        const x = -w / 2 + (w / bumps) * (i + 0.5);
        return (
          <mesh key={i} position={[x, h * 0.32, 0]} castShadow>
            <sphereGeometry args={[Math.min(d, h) * 0.4, 8, 8]} />
            <meshStandardMaterial color={shade(color, i % 2 ? 0.05 : -0.03)} roughness={0.95} />
          </mesh>
        );
      })}
    </group>
  );
}

function PoolModel({ w, h, d, color }: Dims) {
  const rim = Math.min(w, d) * 0.04;
  return (
    <group>
      <mesh receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#e8e4da" roughness={0.8} />
      </mesh>
      <mesh position={[0, h * 0.15, 0]}>
        <boxGeometry args={[w - rim * 2, h * 0.5, d - rim * 2]} />
        <meshStandardMaterial color={color} transparent opacity={0.75} roughness={0.05} metalness={0.1} />
      </mesh>
    </group>
  );
}

// A sloped boundary-wall block — the object equivalent of WallSegmentMesh's
// sloped-quad geometry, used when the wall's Start and End corners have
// different resolved heights/elevations (following sloped land, or a
// stepped gable). Coordinates are absolute local-space (the group is
// positioned at the object's own base by ObjectMesh when sloped), not
// centered the way the flat BoundaryWallModel box is.
function SlopedBoundaryWallModel({ w, d, color, slope }: { w: number; d: number; color: string; slope: WallSlope }) {
  const { startElevationM, endElevationM, startHeightM, endHeightM } = slope;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, startElevationM);
  shape.lineTo(w / 2, endElevationM);
  shape.lineTo(w / 2, endElevationM + endHeightM);
  shape.lineTo(-w / 2, startElevationM + startHeightM);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 1 });
  geometry.translate(0, 0, -d / 2);
  geometry.computeVertexNormals();
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

function BoundaryWallModel({ w, h, d, color, wallSlope }: Dims & { wallSlope?: WallSlope }) {
  if (wallSlope) {
    return <SlopedBoundaryWallModel w={w} d={d} color={color} slope={wallSlope} />;
  }
  const courses = Math.max(2, Math.round(h / 0.3));
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {Array.from({ length: courses - 1 }).map((_, i) => {
        const y = -h / 2 + (h / courses) * (i + 1);
        return (
          <mesh key={i} position={[0, y, d / 2 + 0.002]}>
            <boxGeometry args={[w, 0.006, 0.004]} />
            <meshStandardMaterial color={shade(color, -0.2)} />
          </mesh>
        );
      })}
      <mesh position={[0, h / 2 + 0.02, 0]}>
        <boxGeometry args={[w + 0.02, 0.04, d + 0.02]} />
        <meshStandardMaterial color={shade(color, 0.1)} roughness={0.7} />
      </mesh>
    </group>
  );
}

// A metal balcony/terrace railing — top and bottom rails with evenly spaced
// vertical balusters between them, distinct from BoundaryWallModel's solid
// brick block. Supports the same wallSlope mechanism as the boundary wall
// (following sloped land/steps): the two rails are built the same
// sloped-quad way as SlopedBoundaryWallModel (just thin), and each baluster
// stays vertical but has its own height/position linearly interpolated from
// the slope — real balusters stay plumb even on a raked rail, so this reads
// correctly rather than tilting the bars themselves.
function HandGrillModel({ w, h, d, color, wallSlope }: Dims & { wallSlope?: WallSlope }) {
  // Capped at 1/3 of the shortest end's own height (not just the flat h),
  // so a grill sloped down to a very short height at one end (e.g. near the
  // 50mm Properties-panel minimum) can't make the top/bottom rails overlap
  // or invert at that end.
  const shortestHeightM = wallSlope ? Math.min(wallSlope.startHeightM, wallSlope.endHeightM) : h;
  const railH = Math.min(0.05, h * 0.12, shortestHeightM / 3);
  const barCount = Math.max(4, Math.round(w / 0.12));
  const barSize = Math.min(0.02, Math.max(0.01, w * 0.01));
  const railColor = shade(color, -0.1);

  if (!wallSlope) {
    return (
      <group>
        <mesh position={[0, -h / 2 + railH / 2, 0]} castShadow>
          <boxGeometry args={[w, railH, d * 0.6]} />
          <meshStandardMaterial color={railColor} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, h / 2 - railH / 2, 0]} castShadow>
          <boxGeometry args={[w, railH, d * 0.6]} />
          <meshStandardMaterial color={railColor} metalness={0.5} roughness={0.4} />
        </mesh>
        {Array.from({ length: barCount }).map((_, i) => {
          const t = barCount === 1 ? 0.5 : i / (barCount - 1);
          const x = -w / 2 + w * t;
          return (
            <mesh key={i} position={[x, 0, 0]} castShadow>
              <boxGeometry args={[barSize, h - railH * 2, barSize]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} />
            </mesh>
          );
        })}
      </group>
    );
  }

  const { startElevationM, endElevationM, startHeightM, endHeightM } = wallSlope;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return (
    <group>
      <SlopedBoundaryWallModel
        w={w}
        d={d * 0.6}
        color={railColor}
        slope={{ startElevationM, endElevationM, startHeightM: railH, endHeightM: railH }}
      />
      <SlopedBoundaryWallModel
        w={w}
        d={d * 0.6}
        color={railColor}
        slope={{
          startElevationM: startElevationM + startHeightM - railH,
          endElevationM: endElevationM + endHeightM - railH,
          startHeightM: railH,
          endHeightM: railH,
        }}
      />
      {Array.from({ length: barCount }).map((_, i) => {
        const t = barCount === 1 ? 0.5 : i / (barCount - 1);
        const x = -w / 2 + w * t;
        const bottomY = lerp(startElevationM, endElevationM, t) + railH;
        const topY = lerp(startElevationM + startHeightM, endElevationM + endHeightM, t) - railH;
        const barH = Math.max(0.01, topY - bottomY);
        const midY = (bottomY + topY) / 2;
        return (
          <mesh key={i} position={[x, midY, 0]} castShadow>
            <boxGeometry args={[barSize, barH, barSize]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

function GateModel({ w, h, d, color }: Dims) {
  const postW = Math.min(0.15, w * 0.06);
  const bars = Math.max(4, Math.round(w / 0.3));
  return (
    <group>
      <mesh position={[-w / 2 + postW / 2, 0, 0]} castShadow>
        <boxGeometry args={[postW, h, d * 2]} />
        <meshStandardMaterial color={shade(color, -0.15)} roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[w / 2 - postW / 2, 0, 0]} castShadow>
        <boxGeometry args={[postW, h, d * 2]} />
        <meshStandardMaterial color={shade(color, -0.15)} roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, h * 0.35, 0]} castShadow>
        <boxGeometry args={[w, h * 0.08, d]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.3} />
      </mesh>
      {Array.from({ length: bars }).map((_, i) => {
        const x = -w / 2 + postW + ((w - postW * 2) / (bars - 1)) * i;
        return (
          <mesh key={i} position={[x, 0, 0]} castShadow>
            <boxGeometry args={[Math.min(0.03, w * 0.02), h * 0.75, d * 0.6]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}

function PavingModel({ w, h, d, color }: Dims) {
  const cols = Math.max(2, Math.round(w / 0.9));
  const rows = Math.max(2, Math.round(d / 0.9));
  return (
    <group>
      <mesh receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {Array.from({ length: cols - 1 }).map((_, i) => {
        const x = -w / 2 + (w / cols) * (i + 1);
        return (
          <mesh key={`c${i}`} position={[x, h / 2 + 0.001, 0]}>
            <boxGeometry args={[0.006, 0.002, d]} />
            <meshStandardMaterial color={shade(color, -0.3)} />
          </mesh>
        );
      })}
      {Array.from({ length: rows - 1 }).map((_, i) => {
        const z = -d / 2 + (d / rows) * (i + 1);
        return (
          <mesh key={`r${i}`} position={[0, h / 2 + 0.001, z]}>
            <boxGeometry args={[w, 0.002, 0.006]} />
            <meshStandardMaterial color={shade(color, -0.3)} />
          </mesh>
        );
      })}
    </group>
  );
}

function GardenLightModel({ w, h, d, color }: Dims) {
  const poleR = Math.min(w, d) * 0.08;
  return (
    <group>
      <mesh position={[0, -h * 0.1, 0]} castShadow>
        <cylinderGeometry args={[poleR, poleR * 1.3, h * 0.8, 8]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, h * 0.38, 0]} castShadow>
        <boxGeometry args={[Math.min(w, d) * 0.5, h * 0.18, Math.min(w, d) * 0.5]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function GazeboModel({ w, h, d, color }: Dims) {
  const postR = Math.min(w, d) * 0.03;
  const postH = h * 0.7;
  const roofH = h * 0.35;
  const inset = Math.min(w, d) * 0.1;
  const posts = [
    [-w / 2 + inset, -d / 2 + inset],
    [w / 2 - inset, -d / 2 + inset],
    [-w / 2 + inset, d / 2 - inset],
    [w / 2 - inset, d / 2 - inset],
  ];
  return (
    <group>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, -h / 2 + postH / 2, z]} castShadow>
          <cylinderGeometry args={[postR, postR, postH, 8]} />
          <meshStandardMaterial color={shade(color, -0.2)} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, h / 2 - roofH / 2, 0]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[Math.min(w, d) * 0.75, roofH, 4]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  );
}

// A freestanding porch/sitout pillar — a plinth base, a shaft, and a capital,
// in either a round (classical) or square (modern) cross-section. Distinct
// from GazeboModel's four thin corner posts, which are part of one roofed
// structure — this is a single standalone column meant to be placed
// individually along a sitout/verandah edge.
type PillarVariant = 'round' | 'square';

function PillarModel({ w, h, d, color, variant = 'round' }: Dims & { variant?: PillarVariant }) {
  const baseH = h * 0.06;
  const capH = h * 0.05;
  const shaftH = h - baseH - capH;
  const capColor = shade(color, -0.12);
  if (variant === 'square') {
    return (
      <group>
        <mesh position={[0, -h / 2 + baseH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w * 1.15, baseH, d * 1.15]} />
          <meshStandardMaterial color={capColor} roughness={0.7} />
        </mesh>
        <mesh position={[0, -h / 2 + baseH + shaftH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, shaftH, d]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
        <mesh position={[0, h / 2 - capH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w * 1.15, capH, d * 1.15]} />
          <meshStandardMaterial color={capColor} roughness={0.7} />
        </mesh>
      </group>
    );
  }
  const shaftR = Math.min(w, d) / 2;
  return (
    <group>
      <mesh position={[0, -h / 2 + baseH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[shaftR * 1.18, shaftR * 1.18, baseH, 20]} />
        <meshStandardMaterial color={capColor} roughness={0.7} />
      </mesh>
      <mesh position={[0, -h / 2 + baseH + shaftH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[shaftR, shaftR, shaftH, 20]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0, h / 2 - capH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[shaftR * 1.18, shaftR * 1.18, capH, 20]} />
        <meshStandardMaterial color={capColor} roughness={0.7} />
      </mesh>
    </group>
  );
}

// ---------- More furniture ----------

function StoolModel({ w, h, d, color }: Dims) {
  const seatR = Math.min(w, d) / 2;
  const legR = seatR * 0.12;
  const legInset = seatR * 0.75;
  const legPositions = [0, 90, 180, 270].map((deg) => [
    Math.cos((deg * Math.PI) / 180) * legInset,
    Math.sin((deg * Math.PI) / 180) * legInset,
  ]);
  return (
    <group>
      <mesh position={[0, h / 2 - 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[seatR, seatR, 0.06, 16]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {legPositions.map(([x, z], i) => (
        <mesh key={i} position={[x, -0.03, z]} castShadow>
          <cylinderGeometry args={[legR, legR, h - 0.06, 8]} />
          <meshStandardMaterial color={shade(color, -0.3)} metalness={0.4} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- More kitchen ----------

function StoveModel({ w, h, d, color }: Dims) {
  const topH = Math.min(0.05, h * 0.08);
  const burnerR = Math.min(w, d) * 0.12;
  const burners: Array<[number, number]> = [
    [-w * 0.22, -d * 0.18],
    [w * 0.22, -d * 0.18],
    [-w * 0.22, d * 0.18],
    [w * 0.22, d * 0.18],
  ];
  return (
    <group>
      <mesh position={[0, -topH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h - topH, d]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, h / 2 - topH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, topH, d]} />
        <meshStandardMaterial color="#1c1c1c" roughness={0.3} />
      </mesh>
      {burners.map(([x, z], i) => (
        <mesh key={i} position={[x, h / 2, z]}>
          <cylinderGeometry args={[burnerR, burnerR, 0.01, 16]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function ApplianceModel({ w, h, d, color }: Dims) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, d / 2 + 0.002]}>
        <boxGeometry args={[w * 0.85, h * 0.7, 0.006]} />
        <meshStandardMaterial color={shade(color, -0.3)} />
      </mesh>
      <mesh position={[w * 0.35, 0, d / 2 + 0.02]}>
        <boxGeometry args={[0.02, h * 0.5, 0.02]} />
        <meshStandardMaterial color="#8a8f94" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ---------- More bathroom ----------

function MirrorModel({ w, h, d, color }: Dims) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={shade(color, -0.15)} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, d * 0.2]}>
        <boxGeometry args={[w * 0.86, h * 0.86, d * 0.3]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.05} />
      </mesh>
    </group>
  );
}

function TowelRackModel({ w, h, d, color }: Dims) {
  const rodR = Math.min(h, d) * 0.15;
  return (
    <group>
      <mesh rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[rodR, rodR, w * 0.9, 10]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[-w * 0.4, 0, 0]} castShadow>
        <boxGeometry args={[w * 0.05, h, d]} />
        <meshStandardMaterial color={shade(color, -0.2)} />
      </mesh>
      <mesh position={[w * 0.4, 0, 0]} castShadow>
        <boxGeometry args={[w * 0.05, h, d]} />
        <meshStandardMaterial color={shade(color, -0.2)} />
      </mesh>
    </group>
  );
}

// ---------- More electrical ----------

function WaterHeaterModel({ w, h, d, color }: Dims) {
  const r = Math.min(w, d) / 2;
  return (
    <group>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[r, r, h, 16]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, h * 0.3, r * 0.9]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[r * 0.12, r * 0.12, r * 0.5, 8]} />
        <meshStandardMaterial color="#8a8f94" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

function WashingMachineModel({ w, h, d, color }: Dims) {
  const doorR = Math.min(w, h) * 0.28;
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.25} />
      </mesh>
      <mesh position={[0, h * 0.42, d / 2 + 0.002]}>
        <boxGeometry args={[w * 0.9, h * 0.1, 0.006]} />
        <meshStandardMaterial color={shade(color, -0.25)} />
      </mesh>
      <mesh position={[0, -h * 0.06, d / 2 + 0.01]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[doorR, doorR, 0.015, 24]} />
        <meshStandardMaterial color={shade(color, -0.45)} metalness={0.5} roughness={0.2} />
      </mesh>
      <mesh position={[0, -h * 0.06, d / 2 + 0.018]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[doorR * 0.72, doorR * 0.72, 0.008, 24]} />
        <meshStandardMaterial color="#1c2733" transparent opacity={0.55} metalness={0.6} roughness={0.1} />
      </mesh>
    </group>
  );
}

function SconceModel({ w, h, d, color }: Dims) {
  return (
    <group>
      <mesh position={[0, 0, -d * 0.3]} castShadow>
        <boxGeometry args={[w * 0.5, h * 0.4, d * 0.3]} />
        <meshStandardMaterial color="#8a8f94" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, d * 0.1]} castShadow>
        <sphereGeometry args={[Math.min(w, h) * 0.35, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ---------- More decoration ----------

function ClockModel({ w, h, d, color }: Dims) {
  const r = Math.min(w, h) / 2;
  return (
    <group>
      <mesh rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[r, r, d, 24]} />
        <meshStandardMaterial color="#f5f5f0" roughness={0.4} />
      </mesh>
      <mesh position={[0, r * 0.35, d / 2 + 0.002]}>
        <boxGeometry args={[0.006, r * 0.7, 0.004]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[r * 0.25, 0, d / 2 + 0.002]}>
        <boxGeometry args={[r * 0.5, 0.006, 0.004]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function FloorLampModel({ w, h, d, color }: Dims) {
  const poleR = Math.min(w, d) * 0.06;
  const shadeR = Math.min(w, d) * 0.45;
  const shadeH = h * 0.22;
  return (
    <group>
      <mesh position={[0, -h / 2 + 0.01, 0]} castShadow>
        <cylinderGeometry args={[Math.min(w, d) * 0.3, Math.min(w, d) * 0.3, 0.02, 16]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.5} />
      </mesh>
      <mesh castShadow>
        <cylinderGeometry args={[poleR, poleR, h * 0.75, 8]} />
        <meshStandardMaterial color="#5a5a5a" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, h / 2 - shadeH / 2, 0]} castShadow>
        <cylinderGeometry args={[shadeR * 0.7, shadeR, shadeH, 16, 1, true]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function CurtainModel({ w, h, d, color }: Dims) {
  const pleats = Math.max(4, Math.round(w / 0.25));
  const pleatW = w / pleats;
  return (
    <group>
      {Array.from({ length: pleats }).map((_, i) => {
        const x = -w / 2 + pleatW * (i + 0.5);
        const zOff = (i % 2 === 0 ? 1 : -1) * d * 0.3;
        return (
          <mesh key={i} position={[x, 0, zOff]} castShadow>
            <boxGeometry args={[pleatW * 0.9, h, d * 0.6]} />
            <meshStandardMaterial color={i % 2 ? shade(color, -0.08) : color} roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

// ---------- Dispatcher ----------

// A wall-like object's (e.g. Boundary Wall) top/base slope, in local model
// space — 'start' is the object's own -w/2 edge, 'end' is +w/2 — already
// converted to meters and resolved (no more `?? fallback` needed downstream).
export interface WallSlope {
  startElevationM: number;
  endElevationM: number;
  startHeightM: number;
  endHeightM: number;
}

interface CategoryObjectModelProps {
  category: AssetCategory;
  name: string;
  w: number;
  h: number;
  d: number;
  color: string;
  variant?: string;
  railSide?: RailSide;
  railOffsetMm?: number;
  stepCount?: number;
  railEnabled?: boolean;
  railStartPercent?: number;
  railEndPercent?: number;
  wallSlope?: WallSlope;
}

function DefaultBoxModel({ w, h, d, color }: Dims) {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

export function CategoryObjectModel({
  category,
  name,
  w,
  h,
  d,
  color,
  variant,
  railSide,
  railOffsetMm,
  stepCount,
  railEnabled,
  railStartPercent,
  railEndPercent,
  wallSlope,
}: CategoryObjectModelProps) {
  const n = name.toLowerCase();
  switch (category) {
    case 'KITCHEN':
      if (n.includes('refrigerator')) return <RefrigeratorModel w={w} h={h} d={d} color={color} />;
      if (n.includes('stove') || n.includes('cooktop')) return <StoveModel w={w} h={h} d={d} color={color} />;
      if (n.includes('microwave') || n.includes('dishwasher')) return <ApplianceModel w={w} h={h} d={d} color={color} />;
      if (n.includes('chimney') || n.includes('hood')) return <AcUnitModel w={w} h={h} d={d} color={color} />;
      if (n.includes('cupboard')) return <WardrobeModel w={w} h={h} d={d} color={color} />;
      return <CounterModel w={w} h={h} d={d} color={color} />;
    case 'BATHROOM':
      if (n.includes('toilet')) return <ToiletModel w={w} h={h} d={d} color={color} />;
      if (n.includes('bath')) return <BathtubModel w={w} h={h} d={d} color={color} />;
      if (n.includes('shower')) return <ShowerModel w={w} h={h} d={d} color={color} />;
      if (n.includes('bidet') || n.includes('sink') || n.includes('basin')) return <BasinModel w={w} h={h} d={d} color={color} />;
      if (n.includes('mirror')) return <MirrorModel w={w} h={h} d={d} color={color} />;
      if (n.includes('towel')) return <TowelRackModel w={w} h={h} d={d} color={color} />;
      return <CounterModel w={w} h={h} d={d} color={color} />;
    case 'ELECTRICAL':
      if (n.includes('washing') || n.includes('dryer')) return <WashingMachineModel w={w} h={h} d={d} color={color} />;
      if (n.includes('fan')) return <CeilingFanModel w={w} h={h} d={d} color={color} />;
      if (n.includes('ac') || n.includes('air')) return <AcUnitModel w={w} h={h} d={d} color={color} />;
      if (n.includes('water heater') || n.includes('heater')) return <WaterHeaterModel w={w} h={h} d={d} color={color} />;
      if (n.includes('bulb')) return <BulbModel w={w} h={h} d={d} color={color} />;
      if (n.includes('switch')) return <SwitchBoardModel w={w} h={h} d={d} color={color} />;
      if (n.includes('light') || n.includes('sconce')) return <SconceModel w={w} h={h} d={d} color={color} />;
      return <WallPlateModel w={w} h={h} d={d} color={color} />;
    case 'DECORATION':
      if (n.includes('plant')) return <PottedPlantModel w={w} h={h} d={d} color={color} />;
      if (n.includes('rug')) return <RugModel w={w} h={h} d={d} color={color} />;
      if (n.includes('mirror')) return <MirrorModel w={w} h={h} d={d} color={color} />;
      if (n.includes('clock')) return <ClockModel w={w} h={h} d={d} color={color} />;
      if (n.includes('lamp')) return <FloorLampModel w={w} h={h} d={d} color={color} />;
      if (n.includes('curtain')) return <CurtainModel w={w} h={h} d={d} color={color} />;
      return <FramedDecorModel w={w} h={h} d={d} color={color} />;
    case 'FURNITURE':
      if (n.includes('sofa') || n.includes('armchair') || n.includes('recliner')) {
        return <SofaModel w={w} h={h} d={d} color={color} variant={variant as SofaVariant | undefined} />;
      }
      if (n.includes('stool')) return <StoolModel w={w} h={h} d={d} color={color} />;
      if (n.includes('chair')) return <ChairModel w={w} h={h} d={d} color={color} />;
      if (n.includes('double bed')) {
        return <BedModel w={w} h={h} d={d} color={color} pillows={2} variant={variant as BedVariant | undefined} />;
      }
      if (n.includes('bed')) return <BedModel w={w} h={h} d={d} color={color} pillows={1} variant={variant as BedVariant | undefined} />;
      if (n.includes('wardrobe') || n.includes('cupboard')) return <WardrobeModel w={w} h={h} d={d} color={color} />;
      if (n.includes('showcase')) return <ShowcaseModel w={w} h={h} d={d} color={color} />;
      if (n.includes('shoe rack') || n.includes('bookshelf')) return <BookshelfModel w={w} h={h} d={d} color={color} />;
      if (n.includes('pooja') || n.includes('mandir')) return <PoojaMandirModel w={w} h={h} d={d} color={color} />;
      if (n.includes('nightstand') || n.includes('tv table')) return <TvTableModel w={w} h={h} d={d} color={color} />;
      if (n.includes('l-shaped staircase') || n.includes('l shaped staircase')) {
        return (
          <LShapedStaircaseModel
            w={w}
            h={h}
            d={d}
            color={color}
            stepCount={stepCount}
            railEnabled={railEnabled}
            railStartPercent={railStartPercent}
            railEndPercent={railEndPercent}
          />
        );
      }
      if (n.includes('interior staircase')) {
        return (
          <InteriorStaircaseModel
            w={w}
            h={h}
            d={d}
            color={color}
            stepCount={stepCount}
            railEnabled={railEnabled}
            railStartPercent={railStartPercent}
            railEndPercent={railEndPercent}
          />
        );
      }
      if (n.includes('closed riser staircase') || n.includes('closed staircase')) {
        return (
          <ClosedRiserStaircaseModel
            w={w}
            h={h}
            d={d}
            color={color}
            railSide={railSide}
            railOffsetMm={railOffsetMm}
            stepCount={stepCount}
            railEnabled={railEnabled}
            railStartPercent={railStartPercent}
            railEndPercent={railEndPercent}
          />
        );
      }
      if (n.includes('staircase') || n.includes('stairs')) {
        return (
          <StaircaseModel
            w={w}
            h={h}
            d={d}
            color={color}
            railSide={railSide}
            railOffsetMm={railOffsetMm}
            stepCount={stepCount}
            railEnabled={railEnabled}
            railStartPercent={railStartPercent}
            railEndPercent={railEndPercent}
          />
        );
      }
      if (n.includes('wall mounted tv') || n.includes('wall-mounted tv')) {
        return <WallMountedTvModel w={w} h={h} d={d} color={color} />;
      }
      if (n.includes('television') || n.includes('tv')) return <TvModel w={w} h={h} d={d} color={color} />;
      if (n.includes('table')) return <TableModel w={w} h={h} d={d} color={color} variant={variant as TableVariant | undefined} />;
      return <DefaultBoxModel w={w} h={h} d={d} color={color} />;
    case 'EXTERIOR':
      if (n.includes('tree')) return <TreeModel w={w} h={h} d={d} color={color} />;
      if (n.includes('hedge')) return <HedgeModel w={w} h={h} d={d} color={color} />;
      if (n.includes('pool')) return <PoolModel w={w} h={h} d={d} color={color} />;
      if (n.includes('grill') || n.includes('railing')) {
        return <HandGrillModel w={w} h={h} d={d} color={color} wallSlope={wallSlope} />;
      }
      if (n.includes('wall')) return <BoundaryWallModel w={w} h={h} d={d} color={color} wallSlope={wallSlope} />;
      if (n.includes('gate')) return <GateModel w={w} h={h} d={d} color={color} />;
      if (n.includes('driveway') || n.includes('pathway') || n.includes('paving')) {
        return <PavingModel w={w} h={h} d={d} color={color} />;
      }
      if (n.includes('light')) return <GardenLightModel w={w} h={h} d={d} color={color} />;
      if (n.includes('gazebo')) return <GazeboModel w={w} h={h} d={d} color={color} />;
      if (n.includes('pillar') || n.includes('column')) {
        return <PillarModel w={w} h={h} d={d} color={color} variant={variant as PillarVariant | undefined} />;
      }
      if (n.includes('sofa')) return <SofaModel w={w} h={h} d={d} color={color} variant={variant as SofaVariant | undefined} />;
      if (n.includes('table')) return <TableModel w={w} h={h} d={d} color={color} variant={variant as TableVariant | undefined} />;
      return <DefaultBoxModel w={w} h={h} d={d} color={color} />;
    default:
      return <DefaultBoxModel w={w} h={h} d={d} color={color} />;
  }
}

// ---------- Wall fixtures: doors & windows ----------

interface DoorFixtureProps {
  length: number;
  height: number;
  depth: number;
  color: string;
  isDouble: boolean;
  isSliding: boolean;
}

export function DoorFixture({ length, height, depth, color, isDouble, isSliding }: DoorFixtureProps) {
  const frameT = Math.min(0.06, length * 0.06);
  const frameColor = shade(color, -0.25);
  const panelDepth = depth * 0.6;
  const handleColor = '#c9c2b0';
  const useDouble = isDouble && !isSliding;
  const panelWidth = useDouble ? length / 2 - frameT * 1.5 : length - frameT * 2;

  const renderPanel = (offsetX: number, handleSign: number) => (
    <group position={[offsetX, -frameT / 2, 0]}>
      <mesh castShadow>
        <boxGeometry args={[panelWidth, height - frameT * 1.5, panelDepth]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      {!isSliding && panelWidth > 0.5 && (
        <>
          <mesh position={[0, height * 0.18, panelDepth / 2 + 0.002]}>
            <boxGeometry args={[panelWidth * 0.7, height * 0.32, 0.006]} />
            <meshStandardMaterial color={shade(color, -0.12)} roughness={0.6} />
          </mesh>
          <mesh position={[0, -height * 0.22, panelDepth / 2 + 0.002]}>
            <boxGeometry args={[panelWidth * 0.7, height * 0.32, 0.006]} />
            <meshStandardMaterial color={shade(color, -0.12)} roughness={0.6} />
          </mesh>
        </>
      )}
      {!isSliding && (
        <mesh position={[handleSign * (panelWidth / 2 - 0.06), 0, panelDepth / 2 + 0.02]} castShadow>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.3} />
        </mesh>
      )}
      {isSliding && (
        <mesh position={[handleSign * (panelWidth / 2 - 0.1), 0, panelDepth / 2 + 0.004]}>
          <boxGeometry args={[0.02, height * 0.3, 0.01]} />
          <meshStandardMaterial color={handleColor} metalness={0.5} roughness={0.3} />
        </mesh>
      )}
    </group>
  );

  return (
    <group>
      <mesh position={[0, height / 2 - frameT / 2, 0]}>
        <boxGeometry args={[length, frameT, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} />
      </mesh>
      <mesh position={[-length / 2 + frameT / 2, -frameT / 2, 0]}>
        <boxGeometry args={[frameT, height - frameT, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} />
      </mesh>
      <mesh position={[length / 2 - frameT / 2, -frameT / 2, 0]}>
        <boxGeometry args={[frameT, height - frameT, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} />
      </mesh>

      {useDouble ? (
        <>
          {renderPanel(-length / 4, 1)}
          {renderPanel(length / 4, -1)}
        </>
      ) : (
        renderPanel(0, 1)
      )}

      {isSliding && (
        <mesh position={[0, height / 2 + 0.03, 0]}>
          <boxGeometry args={[length * 1.05, 0.03, depth * 1.3]} />
          <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.2} />
        </mesh>
      )}
    </group>
  );
}

interface WindowFixtureProps {
  length: number;
  height: number;
  depth: number;
  color: string;
  paneCount: number;
}

export function WindowFixture({ length, height, depth, color, paneCount }: WindowFixtureProps) {
  const frameT = Math.min(0.05, length * 0.05);
  const frameColor = shade(color, -0.35);
  const innerW = length - frameT * 2;
  const innerH = height - frameT * 2;
  const paneGap = frameT * 0.8;
  const paneW = (innerW - paneGap * (paneCount - 1)) / paneCount;

  return (
    <group>
      <mesh position={[0, height / 2 - frameT / 2, 0]}>
        <boxGeometry args={[length, frameT, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[0, -height / 2 + frameT / 2, 0]}>
        <boxGeometry args={[length, frameT, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[-length / 2 + frameT / 2, 0, 0]}>
        <boxGeometry args={[frameT, height, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[length / 2 - frameT / 2, 0, 0]}>
        <boxGeometry args={[frameT, height, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>

      {Array.from({ length: paneCount }).map((_, i) => {
        const x = -innerW / 2 + paneW / 2 + i * (paneW + paneGap);
        return (
          <group key={i}>
            <mesh position={[x, 0, 0]}>
              <boxGeometry args={[paneW, innerH, depth * 0.4]} />
              <meshStandardMaterial color={color} transparent opacity={0.4} roughness={0.05} metalness={0.1} />
            </mesh>
            {innerH > 0.7 && (
              <mesh position={[x, 0, depth * 0.25]}>
                <boxGeometry args={[paneW, frameT * 0.5, depth * 0.15]} />
                <meshStandardMaterial color={frameColor} roughness={0.5} />
              </mesh>
            )}
            {i > 0 && (
              <mesh position={[x - paneW / 2 - paneGap / 2, 0, 0]}>
                <boxGeometry args={[paneGap, innerH, depth * 0.5]} />
                <meshStandardMaterial color={frameColor} roughness={0.5} />
              </mesh>
            )}
          </group>
        );
      })}

      <mesh position={[0, -height / 2 - 0.015, depth * 0.3]}>
        <boxGeometry args={[length + frameT, 0.03, depth * 0.8]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} />
      </mesh>
    </group>
  );
}
