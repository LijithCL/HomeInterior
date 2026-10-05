import type { Unit } from './editor-store';

export function formatLength(mm: number, unit: Unit): string {
  switch (unit) {
    case 'mm':
      return `${Math.round(mm)} mm`;
    case 'cm':
      return `${(mm / 10).toFixed(1)} cm`;
    case 'ft': {
      const feet = mm / 304.8;
      return `${feet.toFixed(2)} ft`;
    }
    case 'm':
    default:
      return `${(mm / 1000).toFixed(2)} m`;
  }
}

export function formatArea(m2: number, unit: Unit): string {
  if (unit === 'ft') {
    return `${(m2 * 10.7639).toFixed(1)} sq ft`;
  }
  return `${m2.toFixed(2)} m²`;
}

export function mmToDisplay(mm: number, unit: Unit): number {
  switch (unit) {
    case 'mm':
      return Math.round(mm);
    case 'cm':
      return Math.round(mm / 10) / 10;
    case 'ft':
      return Math.round((mm / 304.8) * 100) / 100;
    case 'm':
    default:
      return Math.round(mm) / 1000;
  }
}

export function displayToMm(value: number, unit: Unit): number {
  switch (unit) {
    case 'mm':
      return Math.round(value);
    case 'cm':
      return Math.round(value * 10);
    case 'ft':
      return Math.round(value * 304.8);
    case 'm':
    default:
      return Math.round(value * 1000);
  }
}
