// Simple day/night model driven by a single time-of-day slider (0-24h).
// Not astronomically accurate (fixed azimuth, symmetric sunrise/sunset at
// 6am/6pm) — the goal is a visually convincing lighting change, not a solar
// calculator.

export interface SunState {
  sunPosition: [number, number, number];
  sunIntensity: number;
  sunColor: string;
  ambientIntensity: number;
  ambientColor: string;
  skyColor: string;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255,
    ag = (pa >> 8) & 255,
    ab = pa & 255;
  const br = (pb >> 16) & 255,
    bg = (pb >> 8) & 255,
    bb = pb & 255;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bch = Math.round(lerp(ab, bb, t));
  return `#${((1 << 24) + (r << 16) + (g << 8) + bch).toString(16).slice(1)}`;
}

export function computeSunState(hours: number, distance = 20): SunState {
  // theta: 0 at sunrise (6h), PI/2 at solar noon (12h), PI at sunset (18h)
  const theta = ((hours - 6) / 12) * Math.PI;
  const elevation = Math.sin(theta); // >0 during the day, <0 at night
  const dayFactor = Math.max(0, elevation); // 0..1, peaks at noon
  const isNight = elevation < 0.05;

  const sunPosition: [number, number, number] = [
    Math.cos(theta) * distance,
    Math.max(elevation, 0.05) * distance,
    distance * 0.3,
  ];

  const warmth = 1 - dayFactor; // golden near the horizon, white overhead
  const sunColor = isNight ? '#5a6bb0' : lerpColor('#ffffff', '#ffa552', Math.min(1, warmth * 1.4));
  const sunIntensity = isNight ? 0.15 : 0.4 + dayFactor * 1.6;

  // Night still needs enough ambient for a dimly-visible "moonlit" house
  // rather than a flat black silhouette against the sky.
  const ambientIntensity = isNight ? 0.4 : 0.35 + dayFactor * 0.25;
  const ambientColor = isNight ? '#3d4a7a' : '#ffffff';
  const skyColor = isNight ? '#0b1130' : lerpColor('#bfe0f5', '#87ceeb', dayFactor);

  return { sunPosition, sunIntensity, sunColor, ambientIntensity, ambientColor, skyColor };
}
