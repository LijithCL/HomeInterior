'use client';

import type { Asset, AssetCategory } from '@/lib/editor/asset-types';

interface IconProps {
  color: string;
}

// Some asset colors (porcelain whites, pale plastics, light grays) are
// nearly indistinguishable from the icon card's off-white background as a
// thin stroke — darken those toward neutral gray while keeping a hint of
// their original hue; leave already-visible colors untouched.
function strokeColor(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const bg = { r: 248, g: 248, b: 246 };
  const distanceFromBg = Math.hypot(r - bg.r, g - bg.g, b - bg.b);
  if (distanceFromBg >= 110) return hex;
  const mix = (channel: number) => Math.round(channel * 0.3 + 70 * 0.7);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function Glyph({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden>
      <rect x="1" y="1" width="38" height="38" rx="6" fill="#f8f8f6" stroke="#e5e5e0" />
      <g fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

// ---------- Doors & windows ----------

function SingleDoorIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="12" y="7" width="14" height="26" />
      <circle cx="23" cy="20" r="1" fill={color} stroke="none" />
      <path d="M12 7 A18 18 0 0 1 30 25" strokeDasharray="2 2" opacity={0.5} />
    </Glyph>
  );
}

function DoubleDoorIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="7" y="7" width="12" height="26" />
      <rect x="21" y="7" width="12" height="26" />
      <circle cx="17" cy="20" r="1" fill={color} stroke="none" />
      <circle cx="23" cy="20" r="1" fill={color} stroke="none" />
    </Glyph>
  );
}

function SlidingDoorIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="7" y="9" width="24" height="22" />
      <line x1="19" y1="9" x2="19" y2="31" />
      <path d="M23 20 h6 M27 17 l3 3 -3 3" />
    </Glyph>
  );
}

function windowPanes(count: number) {
  const left = 7;
  const right = 33;
  const top = 10;
  const bottom = 30;
  const step = (right - left) / count;
  const verticals = Array.from({ length: count - 1 }, (_, i) => left + step * (i + 1));
  return (
    <>
      <rect x={left} y={top} width={right - left} height={bottom - top} />
      <line x1={left} y1={(top + bottom) / 2} x2={right} y2={(top + bottom) / 2} />
      {verticals.map((x, i) => (
        <line key={i} x1={x} y1={top} x2={x} y2={bottom} />
      ))}
      <line x1={left - 2} y1={bottom + 2} x2={right + 2} y2={bottom + 2} />
    </>
  );
}

function SingleWindowIcon({ color }: IconProps) {
  return <Glyph color={color}>{windowPanes(1)}</Glyph>;
}

function DoubleWindowIcon({ color }: IconProps) {
  return <Glyph color={color}>{windowPanes(2)}</Glyph>;
}

function BayWindowIcon({ color }: IconProps) {
  return <Glyph color={color}>{windowPanes(3)}</Glyph>;
}

// ---------- Furniture ----------

function SofaIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="4" y="16" width="5" height="13" rx="1.5" />
      <rect x="31" y="16" width="5" height="13" rx="1.5" />
      <rect x="7" y="12" width="26" height="7" rx="2" />
      <rect x="7" y="18" width="26" height="11" rx="2" />
    </Glyph>
  );
}

function ArmchairIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="8" y="17" width="5" height="12" rx="1.5" />
      <rect x="27" y="17" width="5" height="12" rx="1.5" />
      <rect x="11" y="11" width="18" height="8" rx="2" />
      <rect x="11" y="18" width="18" height="11" rx="2" />
    </Glyph>
  );
}

function TableLegs({ x1, x2, top, bottom }: { x1: number; x2: number; top: number; bottom: number }) {
  return (
    <>
      <line x1={x1} y1={top} x2={x1} y2={bottom} />
      <line x1={x2} y1={top} x2={x2} y2={bottom} />
    </>
  );
}

function CoffeeTableIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="6" y="13" width="28" height="4" rx="1" />
      <TableLegs x1={9} x2={31} top={17} bottom={29} />
    </Glyph>
  );
}

function DiningTableIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="5" y="14" width="30" height="5" rx="1" />
      <TableLegs x1={8} x2={32} top={19} bottom={30} />
      <circle cx="13" cy="16.5" r="1" fill={color} stroke="none" />
      <circle cx="27" cy="16.5" r="1" fill={color} stroke="none" />
    </Glyph>
  );
}

function DiningChairIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="13" y="7" width="14" height="4" rx="1" />
      <rect x="13" y="11" width="14" height="10" rx="1" />
      <line x1="15" y1="21" x2="15" y2="31" />
      <line x1="25" y1="21" x2="25" y2="31" />
    </Glyph>
  );
}

function BedIcon({ color, pillows }: IconProps & { pillows: number }) {
  const pillowWidth = pillows === 2 ? 9 : 16;
  const gap = pillows === 2 ? 2 : 0;
  const startX = 20 - (pillowWidth * pillows + gap * (pillows - 1)) / 2;
  return (
    <Glyph color={color}>
      <rect x="6" y="10" width="28" height="21" rx="2" />
      <line x1="6" y1="18" x2="34" y2="18" />
      {Array.from({ length: pillows }).map((_, i) => (
        <rect key={i} x={startX + i * (pillowWidth + gap)} y="12" width={pillowWidth} height="4.5" rx="1.5" />
      ))}
    </Glyph>
  );
}

function WardrobeIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="9" y="6" width="22" height="28" />
      <line x1="20" y1="6" x2="20" y2="34" />
      <circle cx="17.5" cy="20" r="0.8" fill={color} stroke="none" />
      <circle cx="22.5" cy="20" r="0.8" fill={color} stroke="none" />
    </Glyph>
  );
}

function TvTableIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="10" y="24" width="20" height="6" rx="1" />
      <rect x="13" y="12" width="14" height="9" rx="1" />
      <line x1="20" y1="21" x2="20" y2="24" />
    </Glyph>
  );
}

function StudyTableIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="6" y="15" width="28" height="4" rx="1" />
      <TableLegs x1={9} x2={31} top={19} bottom={30} />
      <rect x="14" y="7" width="12" height="8" rx="1" />
    </Glyph>
  );
}

function BookshelfIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="8" y="6" width="24" height="28" />
      <line x1="8" y1="14" x2="32" y2="14" />
      <line x1="8" y1="22" x2="32" y2="22" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="16" y1="8" x2="16" y2="13" />
      <line x1="26" y1="16" x2="26" y2="21" />
    </Glyph>
  );
}

function StoolIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <ellipse cx="20" cy="12" rx="10" ry="3" />
      <line x1="12" y1="13" x2="10" y2="32" />
      <line x1="28" y1="13" x2="30" y2="32" />
    </Glyph>
  );
}

// ---------- Kitchen ----------

function CounterIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="5" y="14" width="30" height="6" rx="1" />
      <rect x="7" y="20" width="26" height="10" />
      <line x1="16" y1="20" x2="16" y2="30" />
      <line x1="24" y1="20" x2="24" y2="30" />
      <ellipse cx="28" cy="17" rx="3" ry="1.6" />
    </Glyph>
  );
}

function RefrigeratorIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="11" y="6" width="18" height="28" />
      <line x1="11" y1="14" x2="29" y2="14" />
      <line x1="24" y1="8" x2="24" y2="12" />
      <line x1="24" y1="16" x2="24" y2="26" />
    </Glyph>
  );
}

function StoveIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="7" y="9" width="26" height="22" />
      {[14, 26].map((x) =>
        [15, 25].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />),
      )}
    </Glyph>
  );
}

function ApplianceIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="8" y="7" width="24" height="26" />
      <rect x="11" y="10" width="18" height="14" />
      <circle cx="27" cy="27" r="1" fill={color} stroke="none" />
    </Glyph>
  );
}

// ---------- Bathroom ----------

function ToiletIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="12" y="7" width="16" height="7" rx="1.5" />
      <path d="M13 20 a7 8 0 1 0 14 0 a7 8 0 1 0 -14 0" />
      <path d="M13 20 h14" />
    </Glyph>
  );
}

function BasinIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <ellipse cx="20" cy="16" rx="12" ry="5" />
      <path d="M9 16 v3 a11 4 0 0 0 22 0 v-3" />
      <line x1="20" y1="26" x2="20" y2="32" />
      <path d="M17 8 v4 h6" />
    </Glyph>
  );
}

function MirrorIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="9" y="6" width="22" height="28" rx="1.5" />
      <rect x="12.5" y="9.5" width="15" height="21" rx="1" opacity={0.5} />
    </Glyph>
  );
}

function TowelRackIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <line x1="8" y1="12" x2="32" y2="12" />
      <line x1="10" y1="12" x2="10" y2="30" />
      <line x1="30" y1="12" x2="30" y2="30" />
    </Glyph>
  );
}

function BathtubIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="5" y="15" width="30" height="14" rx="6" />
      <path d="M9 19 h22" opacity={0.5} />
      <path d="M14 9 v5 M14 9 h5" />
    </Glyph>
  );
}

function ShowerIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="8" y="8" width="24" height="24" />
      <circle cx="27" cy="13" r="2.4" />
      <line x1="10" y1="30" x2="30" y2="10" opacity={0.5} />
      <line x1="16" y1="30" x2="30" y2="16" opacity={0.5} />
    </Glyph>
  );
}

// ---------- Electrical ----------

function CeilingFanIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <circle cx="20" cy="20" r="2.4" />
      {[0, 90, 180, 270].map((deg) => (
        <line
          key={deg}
          x1="20"
          y1="20"
          x2={20 + 12 * Math.cos((deg * Math.PI) / 180)}
          y2={20 + 12 * Math.sin((deg * Math.PI) / 180)}
        />
      ))}
    </Glyph>
  );
}

function AcUnitIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="6" y="13" width="28" height="12" rx="2" />
      <line x1="10" y1="17" x2="30" y2="17" />
      <line x1="10" y1="21" x2="30" y2="21" />
    </Glyph>
  );
}

function WallPlateIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="14" y="10" width="12" height="20" rx="2" />
      <circle cx="20" cy="20" r="2" />
    </Glyph>
  );
}

function WaterHeaterIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="13" y="6" width="14" height="28" rx="6" />
      <line x1="13" y1="14" x2="27" y2="14" />
    </Glyph>
  );
}

function SconceIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="15" y="8" width="10" height="8" />
      <circle cx="20" cy="24" r="7" />
    </Glyph>
  );
}

// ---------- Decoration ----------

function PottedPlantIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <path d="M14 26 l1.5 8 h9 l1.5 -8 z" />
      <line x1="20" y1="18" x2="20" y2="26" />
      <path d="M20 20 c-6 -2 -8 -8 -6 -12 c5 1 8 6 6 12 Z" />
      <path d="M20 18 c5 -1 8 -5 7 -9 c-5 0 -8 4 -7 9 Z" />
    </Glyph>
  );
}

function RugIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="5" y="11" width="30" height="18" rx="2" />
      <rect x="9" y="15" width="22" height="10" rx="1" opacity={0.6} />
    </Glyph>
  );
}

function ClockIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <circle cx="20" cy="20" r="12" />
      <line x1="20" y1="20" x2="20" y2="12" />
      <line x1="20" y1="20" x2="26" y2="22" />
    </Glyph>
  );
}

function FloorLampIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <path d="M13 10 h14 l-3 8 h-8 z" />
      <line x1="20" y1="18" x2="20" y2="32" />
      <line x1="14" y1="32" x2="26" y2="32" />
    </Glyph>
  );
}

function CurtainIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <line x1="7" y1="7" x2="33" y2="7" />
      {[10, 16, 22, 28].map((x, i) => (
        <path key={x} d={`M${x} 7 q${i % 2 ? -3 : 3} 12 0 26`} />
      ))}
    </Glyph>
  );
}

function GenericFrameIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="9" y="7" width="22" height="26" />
      <rect x="12.5" y="10.5" width="15" height="19" opacity={0.5} />
    </Glyph>
  );
}

// ---------- Exterior ----------

function TreeIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <line x1="20" y1="24" x2="20" y2="32" />
      <circle cx="20" cy="16" r="10" />
    </Glyph>
  );
}

function HedgeIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <path d="M6 26 h28 v6 h-28 z" />
      {[9, 15, 21, 27, 33].map((x) => (
        <path key={x} d={`M${x - 3} 26 a3 5 0 0 1 6 0`} />
      ))}
    </Glyph>
  );
}

function PoolIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="5" y="10" width="30" height="20" rx="4" />
      <path d="M9 18 q3 -2 6 0 t6 0 t6 0 t6 0" />
      <path d="M9 24 q3 -2 6 0 t6 0 t6 0 t6 0" />
    </Glyph>
  );
}

function BoundaryWallIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="5" y="13" width="30" height="14" />
      <line x1="5" y1="20" x2="35" y2="20" />
      <line x1="13" y1="13" x2="13" y2="20" />
      <line x1="24" y1="13" x2="24" y2="20" />
      <line x1="19" y1="20" x2="19" y2="27" />
      <line x1="29" y1="20" x2="29" y2="27" />
    </Glyph>
  );
}

function GateIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <line x1="8" y1="8" x2="8" y2="32" />
      <line x1="32" y1="8" x2="32" y2="32" />
      <line x1="8" y1="14" x2="32" y2="14" />
      {[13, 18, 23, 27].map((x) => (
        <line key={x} x1={x} y1="14" x2={x} y2="28" />
      ))}
    </Glyph>
  );
}

function PavingIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="6" y="8" width="28" height="24" />
      <line x1="6" y1="16" x2="34" y2="16" />
      <line x1="6" y1="24" x2="34" y2="24" />
      <line x1="16" y1="8" x2="16" y2="16" />
      <line x1="26" y1="16" x2="26" y2="24" />
      <line x1="20" y1="24" x2="20" y2="32" />
    </Glyph>
  );
}

function GardenLightIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <line x1="20" y1="16" x2="20" y2="33" />
      <path d="M15 8 h10 l-2 8 h-6 z" />
      <circle cx="20" cy="6" r="1" fill={color} stroke="none" />
    </Glyph>
  );
}

function GazeboIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <path d="M8 16 L20 7 L32 16 Z" />
      <line x1="10" y1="16" x2="10" y2="30" />
      <line x1="30" y1="16" x2="30" y2="30" />
      <line x1="10" y1="30" x2="30" y2="30" />
    </Glyph>
  );
}

function OutdoorTableIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <line x1="20" y1="6" x2="20" y2="18" />
      <path d="M11 8 a9 5 0 0 1 18 0 z" />
      <ellipse cx="20" cy="22" rx="11" ry="3" />
      <line x1="20" y1="25" x2="20" y2="32" />
    </Glyph>
  );
}

function GenericBoxIcon({ color }: IconProps) {
  return (
    <Glyph color={color}>
      <rect x="9" y="9" width="22" height="22" rx="2" />
    </Glyph>
  );
}

const FURNITURE_MATCHERS: Array<[string, (p: IconProps) => React.ReactElement]> = [
  ['sofa', SofaIcon],
  ['armchair', ArmchairIcon],
  ['recliner', ArmchairIcon],
  ['stool', StoolIcon],
  ['coffee table', CoffeeTableIcon],
  ['dining table', DiningTableIcon],
  ['dining chair', DiningChairIcon],
  ['double bed', DoubleBedIcon],
  ['single bed', SingleBedIcon],
  ['wardrobe', WardrobeIcon],
  ['nightstand', TvTableIcon],
  ['tv table', TvTableIcon],
  ['study table', StudyTableIcon],
  ['shoe rack', BookshelfIcon],
  ['bookshelf', BookshelfIcon],
  ['chair', DiningChairIcon],
  ['table', CoffeeTableIcon],
];

function DoubleBedIcon(props: IconProps) {
  return <BedIcon {...props} pillows={2} />;
}

function SingleBedIcon(props: IconProps) {
  return <BedIcon {...props} pillows={1} />;
}

function iconForCategory(category: AssetCategory, name: string, color: string): React.ReactElement {
  const n = name.toLowerCase();
  switch (category) {
    case 'DOOR':
      if (n.includes('double')) return <DoubleDoorIcon color={color} />;
      if (n.includes('sliding')) return <SlidingDoorIcon color={color} />;
      return <SingleDoorIcon color={color} />;
    case 'WINDOW':
      if (n.includes('bay')) return <BayWindowIcon color={color} />;
      if (n.includes('double')) return <DoubleWindowIcon color={color} />;
      return <SingleWindowIcon color={color} />;
    case 'FURNITURE': {
      const match = FURNITURE_MATCHERS.find(([key]) => n.includes(key));
      return match ? match[1]({ color }) : <GenericBoxIcon color={color} />;
    }
    case 'KITCHEN':
      if (n.includes('refrigerator')) return <RefrigeratorIcon color={color} />;
      if (n.includes('stove') || n.includes('cooktop')) return <StoveIcon color={color} />;
      if (n.includes('microwave') || n.includes('dishwasher')) return <ApplianceIcon color={color} />;
      if (n.includes('chimney') || n.includes('hood')) return <AcUnitIcon color={color} />;
      return <CounterIcon color={color} />;
    case 'BATHROOM':
      if (n.includes('toilet')) return <ToiletIcon color={color} />;
      if (n.includes('bath')) return <BathtubIcon color={color} />;
      if (n.includes('shower')) return <ShowerIcon color={color} />;
      if (n.includes('bidet') || n.includes('sink') || n.includes('basin')) return <BasinIcon color={color} />;
      if (n.includes('mirror')) return <MirrorIcon color={color} />;
      if (n.includes('towel')) return <TowelRackIcon color={color} />;
      return <CounterIcon color={color} />;
    case 'ELECTRICAL':
      if (n.includes('fan')) return <CeilingFanIcon color={color} />;
      if (n.includes('ac') || n.includes('air')) return <AcUnitIcon color={color} />;
      if (n.includes('water heater') || n.includes('heater')) return <WaterHeaterIcon color={color} />;
      if (n.includes('light') || n.includes('sconce')) return <SconceIcon color={color} />;
      return <WallPlateIcon color={color} />;
    case 'DECORATION':
      if (n.includes('plant')) return <PottedPlantIcon color={color} />;
      if (n.includes('rug')) return <RugIcon color={color} />;
      if (n.includes('mirror')) return <MirrorIcon color={color} />;
      if (n.includes('clock')) return <ClockIcon color={color} />;
      if (n.includes('lamp')) return <FloorLampIcon color={color} />;
      if (n.includes('curtain')) return <CurtainIcon color={color} />;
      return <GenericFrameIcon color={color} />;
    case 'EXTERIOR':
      if (n.includes('tree')) return <TreeIcon color={color} />;
      if (n.includes('hedge')) return <HedgeIcon color={color} />;
      if (n.includes('pool')) return <PoolIcon color={color} />;
      if (n.includes('wall')) return <BoundaryWallIcon color={color} />;
      if (n.includes('gate')) return <GateIcon color={color} />;
      if (n.includes('driveway') || n.includes('pathway') || n.includes('paving')) return <PavingIcon color={color} />;
      if (n.includes('light')) return <GardenLightIcon color={color} />;
      if (n.includes('gazebo')) return <GazeboIcon color={color} />;
      if (n.includes('sofa')) return <SofaIcon color={color} />;
      if (n.includes('table')) return <OutdoorTableIcon color={color} />;
      return <GenericBoxIcon color={color} />;
    default:
      return <GenericBoxIcon color={color} />;
  }
}

export function AssetIcon({ asset }: { asset: Asset }) {
  return iconForCategory(asset.category, asset.name, strokeColor(asset.color));
}
