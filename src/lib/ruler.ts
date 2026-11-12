import { DIN_RAIL_HEIGHT_MM, getRotatedDimensions, rotateLocalPoint } from "@/lib/snap";
import { getEffectiveCadBounds } from "@/lib/collision";
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

export interface RulerSteps {
  majorMm: number;
  mediumMm: number;
  minorMm: number;
}

export interface RulerTick {
  mm: number;
  kind: "major" | "medium" | "minor";
}

/**
 * Determine adaptive ruler major/medium/minor tick steps in mm based on zoom level.
 * - zoom > 2.5: major 10mm, medium 5mm, minor 1mm
 * - 1.2 <= zoom <= 2.5: major 20mm, medium 10mm, minor 5mm
 * - 0.6 <= zoom < 1.2: major 50mm, medium 25mm, minor 10mm
 * - zoom < 0.6: major 100mm, medium 50mm, minor 25mm
 */
export function getRulerStepsMm(zoom: number): RulerSteps {
  if (zoom > 2.5) {
    return { majorMm: 10, mediumMm: 5, minorMm: 1 };
  }
  if (zoom >= 1.2) {
    return { majorMm: 20, mediumMm: 10, minorMm: 5 };
  }
  if (zoom >= 0.6) {
    return { majorMm: 50, mediumMm: 25, minorMm: 10 };
  }
  return { majorMm: 100, mediumMm: 50, minorMm: 25 };
}

/**
 * Determine ruler major tick step in mm based on zoom level.
 */
export function getRulerStepMm(zoom: number): number {
  return getRulerStepsMm(zoom).majorMm;
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
 * Generate major, medium, and minor sub-ticks in plate-relative mm covering [minMm, maxMm].
 */
export function computePlateRulerSubTicks(
  minMm: number,
  maxMm: number,
  steps: RulerSteps
): RulerTick[] {
  const { majorMm, mediumMm, minorMm } = steps;
  if (minorMm <= 0 || majorMm <= 0 || mediumMm <= 0 || maxMm < minMm) {
    return [];
  }
  const start = Math.floor(minMm / minorMm) * minorMm;
  const end = Math.ceil(maxMm / minorMm) * minorMm;
  const ticks: RulerTick[] = [];
  for (let v = start; v <= end; v += minorMm) {
    const modMajor = ((v % majorMm) + majorMm) % majorMm;
    const modMedium = ((v % mediumMm) + mediumMm) % mediumMm;
    const kind: RulerTick["kind"] =
      modMajor === 0 ? "major" : modMedium === 0 ? "medium" : "minor";
    ticks.push({ mm: v, kind });
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
      const eff = getEffectiveCadBounds(a);
      const rot = a.rotationDeg ?? 0;
      const dims = getRotatedDimensions(eff.widthMm, eff.heightMm, rot);
      const rotOffset = rotateLocalPoint(eff.offsetX, eff.offsetY, rot);
      expand(a.xMm + rotOffset.xMm, a.yMm + rotOffset.yMm, dims.widthMm, dims.heightMm);
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
