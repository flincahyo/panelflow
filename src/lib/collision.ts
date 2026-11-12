import { getRotatedDimensions } from "@/lib/snap";
import type { CustomCadAsset, PlacedComponent } from "@/types/panel";

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
      const dims = getRotatedDimensions(
        a.boundingBoxMm.w,
        a.boundingBoxMm.h,
        a.rotationDeg ?? 0
      );
      return {
        id: a.id,
        kind: "cad" as const,
        name: a.name,
        xMm: a.xMm,
        yMm: a.yMm,
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
