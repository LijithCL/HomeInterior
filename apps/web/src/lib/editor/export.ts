import type Konva from 'konva';

const EXPORT_PADDING_MM = 300;
const TARGET_WIDTH_PX = 2000;
const TARGET_HEIGHT_PX = 1500;

// Temporarily reframes the stage to fit all drawn content (excluding the
// grid layer, which spans a huge fixed area and would otherwise dominate
// the bounding box), captures a PNG data URL, then restores the user's
// original pan/zoom exactly. Runs synchronously so there's no visible flash.
export function exportFloorPlanPng(stage: Konva.Stage, contentLayer: Konva.Layer): string | null {
  const prevScale = stage.scale();
  const prevPosition = stage.position();
  const prevWidth = stage.width();
  const prevHeight = stage.height();

  try {
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();

    const rect = contentLayer.getClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const contentWidth = rect.width + EXPORT_PADDING_MM * 2;
    const contentHeight = rect.height + EXPORT_PADDING_MM * 2;
    const fitScale = Math.min(TARGET_WIDTH_PX / contentWidth, TARGET_HEIGHT_PX / contentHeight);

    stage.width(TARGET_WIDTH_PX);
    stage.height(TARGET_HEIGHT_PX);
    stage.scale({ x: fitScale, y: fitScale });
    stage.position({
      x: (TARGET_WIDTH_PX / fitScale - rect.width) / 2 - rect.x,
      y: (TARGET_HEIGHT_PX / fitScale - rect.height) / 2 - rect.y,
    });
    stage.batchDraw();

    return stage.toDataURL({ mimeType: 'image/png', pixelRatio: 1 });
  } finally {
    stage.width(prevWidth);
    stage.height(prevHeight);
    stage.scale(prevScale);
    stage.position(prevPosition);
    stage.batchDraw();
  }
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = window.document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export const EXPORT_TARGET_WIDTH_PX = TARGET_WIDTH_PX;
export const EXPORT_TARGET_HEIGHT_PX = TARGET_HEIGHT_PX;
