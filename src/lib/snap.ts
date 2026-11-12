import type { DinRail, GridSnapMm, RotationDeg } from "@/types/panel";

export const DIN_RAIL_HEIGHT_MM = 35;
export const DIN_RAIL_DEPTH_MM = 7.5;

export function rotateLocalPoint(
  localXMm: number,
  localYMm: number,
  rotationDeg: RotationDeg = 0
): { xMm: number; yMm: number } {
  const deg = ((rotationDeg % 360) + 360) % 360;
  if (deg === 90) return { xMm: localYMm, yMm: -localXMm };
  if (deg === 180) return { xMm: -localXMm, yMm: -localYMm };
  if (deg === 270) return { xMm: -localYMm, yMm: localXMm };
  return { xMm: localXMm, yMm: localYMm };
}

export function getRotatedDimensions(
  widthMm: number,
  heightMm: number,
  rotationDeg: RotationDeg = 0
): { widthMm: number; heightMm: number } {
  const deg = ((rotationDeg % 360) + 360) % 360;
  if (deg === 90 || deg === 270) {
    return { widthMm: heightMm, heightMm: widthMm };
  }
  return { widthMm, heightMm };
}

export function snapToGrid(valueMm: number, gridMm: GridSnapMm): number {
  if (!Number.isFinite(valueMm) || gridMm <= 0) return 0;
  return Math.round(valueMm / gridMm) * gridMm;
}

export function snapPointToGrid(
  xMm: number,
  yMm: number,
  gridMm: GridSnapMm
): { xMm: number; yMm: number } {
  return {
    xMm: snapToGrid(xMm, gridMm),
    yMm: snapToGrid(yMm, gridMm),
  };
}

export function clampToBackplate(
  xMm: number,
  yMm: number,
  itemWidthMm: number,
  itemHeightMm: number,
  backplateWidthMm: number,
  backplateHeightMm: number
): { xMm: number; yMm: number } {
  const halfW = Math.max(0, backplateWidthMm / 2 - itemWidthMm / 2);
  const halfH = Math.max(0, backplateHeightMm / 2 - itemHeightMm / 2);
  return {
    xMm: Math.max(-halfW, Math.min(halfW, xMm)),
    yMm: Math.max(-halfH, Math.min(halfH, yMm)),
  };
}

export interface RailSnapResult {
  railId: string | null;
  xMm: number;
  yMm: number;
  zMm: number;
  snappedToRail: boolean;
}

export function snapComponentToNearestRail(
  xMm: number,
  yMm: number,
  compWidthMm: number,
  compDepthMm: number,
  rails: DinRail[],
  gridMm: GridSnapMm,
  maxSnapDistanceMm = Infinity
): RailSnapResult {
  if (rails.length === 0) {
    return {
      railId: null,
      xMm: snapToGrid(xMm, gridMm),
      yMm: snapToGrid(yMm, gridMm),
      zMm: compDepthMm / 2,
      snappedToRail: false,
    };
  }

  let bestRail: DinRail | null = null;
  let bestScore = Infinity;

  for (const rail of rails) {
    const dy = Math.abs(yMm - rail.yMm);
    if (dy > maxSnapDistanceMm) continue;
    const dxOutside = Math.max(0, Math.abs(xMm - rail.xMm) - rail.lengthMm / 2);
    const score = dy + dxOutside * 0.25;
    if (score < bestScore) {
      bestScore = score;
      bestRail = rail;
    }
  }

  if (!bestRail) {
    return {
      railId: null,
      xMm: snapToGrid(xMm, gridMm),
      yMm: snapToGrid(yMm, gridMm),
      zMm: compDepthMm / 2,
      snappedToRail: false,
    };
  }

  const minX = bestRail.xMm - bestRail.lengthMm / 2 + compWidthMm / 2;
  const maxX = bestRail.xMm + bestRail.lengthMm / 2 - compWidthMm / 2;
  const snappedX = snapToGrid(xMm, gridMm);
  const clampedX =
    minX <= maxX ? Math.max(minX, Math.min(maxX, snappedX)) : bestRail.xMm;

  return {
    railId: bestRail.id,
    xMm: clampedX,
    yMm: bestRail.yMm,
    zMm: DIN_RAIL_DEPTH_MM + compDepthMm / 2,
    snappedToRail: true,
  };
}
