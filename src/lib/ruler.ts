import { DIN_RAIL_HEIGHT_MM, getRotatedDimensions } from "@/lib/snap";
import type {
  CustomCadAsset,
  DinRail,
  PlacedComponent,
  SelectedTarget,
  WireDuct,
} from "@/types/panel";

export interface SelectionFootprint {
  x1Mm: number;
  x2Mm: number;
  y1Mm: number;
  y2Mm: number;
  widthMm: number;
  heightMm: number;
}

/**
 * Convert world X (center-origin, +right) to plate-relative X (top-left origin, +right).
 */
export function worldToPlateX(worldXMm: number, plateWidthMm: number): number {
  return worldXMm + plateWidthMm / 2;
}

/**
 * Convert world Y (center-origin, +up) to plate-relative Y (top-left origin, +down).
 */
export function worldToPlateY(worldYMm: number, plateHeightMm: number): number {
  return plateHeightMm / 2 - worldYMm;
}

/**
 * Convert plate-relative X (top-left origin, +right) to world X (center-origin, +right).
 */
export function plateToWorldX(plateXMm: number, plateWidthMm: number): number {
  return plateXMm - plateWidthMm / 2;
}

/**
 * Convert plate-relative Y (top-left origin, +down) to world Y (center-origin, +up).
 */
export function plateToWorldY(plateYMm: number, plateHeightMm: number): number {
  return plateHeightMm / 2 - plateYMm;
}

/**
 * Determine ruler major tick step in mm based on zoom level.
 */
export function getRulerStepMm(zoom: number): number {
  return zoom > 1.5 ? 25 : zoom > 0.7 ? 50 : 100;
}

/**
 * Generate tick values in plate-relative mm covering [minMm, maxMm].
 */
export function computePlateRulerTicks(
  minMm: number,
  maxMm: number,
  stepMm: number
): number[] {
  if (stepMm <= 0 || maxMm < minMm) return [];
  const start = Math.floor(minMm / stepMm) * stepMm;
  const end = Math.ceil(maxMm / stepMm) * stepMm;
  const ticks: number[] = [];
  for (let v = start; v <= end; v += stepMm) {
    ticks.push(v);
  }
  return ticks;
}

/**
 * Compute the bounding footprint [x1..x2, y1..y2] in plate-relative mm
 * across all currently selected components, CAD assets, DIN rails, and wire ducts.
 */
export function computeSelectionFootprint(params: {
  selected: SelectedTarget | null;
  selectedIds: SelectedTarget[];
  components: PlacedComponent[];
  cadAssets: CustomCadAsset[];
  rails: DinRail[];
  ducts: WireDuct[];
  plateWidthMm: number;
  plateHeightMm: number;
}): SelectionFootprint | null {
  const {
    selected,
    selectedIds,
    components,
    cadAssets,
    rails,
    ducts,
    plateWidthMm,
    plateHeightMm,
  } = params;

  const targets = new Map<string, SelectedTarget>();
  for (const item of selectedIds) {
    targets.set(`${item.kind}:${item.id}`, item);
  }
  if (selected) {
    targets.set(`${selected.kind}:${selected.id}`, selected);
  }
  if (targets.size === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let hasBounds = false;

  const expand = (worldX: number, worldY: number, w: number, h: number) => {
    const x1 = worldToPlateX(worldX - w / 2, plateWidthMm);
    const x2 = worldToPlateX(worldX + w / 2, plateWidthMm);
    const y1 = worldToPlateY(worldY + h / 2, plateHeightMm);
    const y2 = worldToPlateY(worldY - h / 2, plateHeightMm);
    minX = Math.min(minX, x1);
    maxX = Math.max(maxX, x2);
    minY = Math.min(minY, y1);
    maxY = Math.max(maxY, y2);
    hasBounds = true;
  };

  for (const target of targets.values()) {
    if (target.kind === "component") {
      const c = components.find((item) => item.id === target.id);
      if (!c) continue;
      const dims = getRotatedDimensions(c.widthMm, c.heightMm, c.rotationDeg ?? 0);
      expand(c.xMm, c.yMm, dims.widthMm, dims.heightMm);
    } else if (target.kind === "cad") {
      const a = cadAssets.find((item) => item.id === target.id);
      if (!a) continue;
      const dims = getRotatedDimensions(
        a.boundingBoxMm.w,
        a.boundingBoxMm.h,
        a.rotationDeg ?? 0
      );
      expand(a.xMm, a.yMm, dims.widthMm, dims.heightMm);
    } else if (target.kind === "rail") {
      const r = rails.find((item) => item.id === target.id);
      if (!r) continue;
      expand(r.xMm, r.yMm, r.lengthMm, DIN_RAIL_HEIGHT_MM);
    } else if (target.kind === "duct") {
      const d = ducts.find((item) => item.id === target.id);
      if (!d) continue;
      expand(d.xMm, d.yMm, d.widthMm, d.heightMm);
    }
  }

  if (!hasBounds) return null;

  return {
    x1Mm: minX,
    x2Mm: maxX,
    y1Mm: minY,
    y2Mm: maxY,
    widthMm: maxX - minX,
    heightMm: maxY - minY,
  };
}
