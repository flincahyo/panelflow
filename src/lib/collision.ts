import { getRotatedDimensions, rotateLocalPoint } from "@/lib/snap";
import type { CustomCadAsset, PlacedComponent } from "@/types/panel";

export interface CadEffectiveBounds {
  widthMm: number;
  heightMm: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Calculates effective dimensions and centroid offset of a CAD asset after crop/trim.
 * Uncropped geometry is centered at (xMm, yMm).
 * When cropped, effective width = max(1, w - left - right),
 * effective height = max(1, h - top - bottom),
 * centroid shifts by ((left - right) / 2, (bottom - top) / 2).
 */
export function getEffectiveCadBounds(asset: {
  boundingBoxMm: { w: number; h: number };
  cropMm?: { top: number; bottom: number; left: number; right: number };
}): CadEffectiveBounds {
  const w = asset.boundingBoxMm.w;
  const h = asset.boundingBoxMm.h;
  const crop = asset.cropMm;
  if (!crop) {
    return { widthMm: w, heightMm: h, offsetX: 0, offsetY: 0 };
  }

  const left = Math.max(0, Math.min(crop.left || 0, w - 1));
  const right = Math.max(0, Math.min(crop.right || 0, Math.max(0, w - left - 1)));
  const top = Math.max(0, Math.min(crop.top || 0, h - 1));
  const bottom = Math.max(0, Math.min(crop.bottom || 0, Math.max(0, h - top - 1)));

  const effW = Math.max(1, w - left - right);
  const effH = Math.max(1, h - top - bottom);
  const offsetX = (left - right) / 2;
  const offsetY = (bottom - top) / 2;

  return { widthMm: effW, heightMm: effH, offsetX, offsetY };
}

export interface BoxItem {
  id: string;
  kind: "component" | "cad";
  name: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface CollisionReport {
  overlappingIds: Set<string>;
  outOfBoundsIds: Set<string>;
  overlapPairs: Array<[string, string]>;
}

const EPSILON_MM = 0.05;

export function detectCollisionsAndBounds(
  components: PlacedComponent[],
  cadAssets: CustomCadAsset[],
  plateWidthMm: number,
  plateHeightMm: number
): CollisionReport {
  const items: BoxItem[] = [
    ...components.map((c) => {
      const dims = getRotatedDimensions(c.widthMm, c.heightMm, c.rotationDeg ?? 0);
      return {
        id: c.id,
        kind: "component" as const,
        name: c.name,
        xMm: c.xMm,
        yMm: c.yMm,
        widthMm: dims.widthMm,
        heightMm: dims.heightMm,
      };
    }),
    ...cadAssets.map((a) => {
      const eff = getEffectiveCadBounds(a);
      const rot = a.rotationDeg ?? 0;
      const dims = getRotatedDimensions(eff.widthMm, eff.heightMm, rot);
      const rotOffset = rotateLocalPoint(eff.offsetX, eff.offsetY, rot);
      return {
        id: a.id,
        kind: "cad" as const,
        name: a.name,
        xMm: a.xMm + rotOffset.xMm,
        yMm: a.yMm + rotOffset.yMm,
        widthMm: dims.widthMm,
        heightMm: dims.heightMm,
      };
    }),
  ];

  const overlappingIds = new Set<string>();
  const outOfBoundsIds = new Set<string>();
  const overlapPairs: Array<[string, string]> = [];

  const halfPlateW = plateWidthMm / 2;
  const halfPlateH = plateHeightMm / 2;

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (
      Math.abs(a.xMm) + a.widthMm / 2 > halfPlateW + EPSILON_MM ||
      Math.abs(a.yMm) + a.heightMm / 2 > halfPlateH + EPSILON_MM
    ) {
      outOfBoundsIds.add(a.id);
    }

    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      const overlapX =
        Math.abs(a.xMm - b.xMm) < (a.widthMm + b.widthMm) / 2 - EPSILON_MM;
      const overlapY =
        Math.abs(a.yMm - b.yMm) < (a.heightMm + b.heightMm) / 2 - EPSILON_MM;

      if (overlapX && overlapY) {
        overlappingIds.add(a.id);
        overlappingIds.add(b.id);
        overlapPairs.push([a.id, b.id]);
      }
    }
  }

  return {
    overlappingIds,
    outOfBoundsIds,
    overlapPairs,
  };
}
