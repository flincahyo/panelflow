import type { WireConnection, WireDuct } from "@/types/panel";
import { getWireOuterDiameterMm } from "./wire-router";

export type DuctFillStatus = "normal" | "moderate" | "warning";

export interface DuctFillStats {
  ductId: string;
  wireCount: number;
  totalCableAreaMm2: number;
  effectiveCapacityMm2: number;
  fillRatioPercent: number;
  status: DuctFillStatus;
  recommendedSize?: { widthMm: number; heightMm: number; label: string };
}

// Industry standard: 60% usable space
export const DUCT_PACKING_FACTOR = 0.6;

// Standard wire duct dimension catalog (Width x Height/Depth in mm)
export const STANDARD_DUCT_SIZES = [
  { widthMm: 25, heightMm: 25, label: "25x25" },
  { widthMm: 25, heightMm: 45, label: "25x45" },
  { widthMm: 25, heightMm: 60, label: "25x60" },
  { widthMm: 33, heightMm: 33, label: "33x33" },
  { widthMm: 40, heightMm: 40, label: "40x40" },
  { widthMm: 40, heightMm: 60, label: "40x60" },
  { widthMm: 40, heightMm: 80, label: "40x80" },
  { widthMm: 60, heightMm: 60, label: "60x60" },
  { widthMm: 60, heightMm: 80, label: "60x80" },
  { widthMm: 60, heightMm: 100, label: "60x100" },
  { widthMm: 80, heightMm: 80, label: "80x80" },
  { widthMm: 80, heightMm: 100, label: "80x100" },
  { widthMm: 100, heightMm: 100, label: "100x100" },
];

/**
 * Line segment vs axis-aligned bounding box (AABB) intersection check.
 * Checks whether segment (x1, y1) to (x2, y2) enters or touches the box.
 */
export function segmentIntersectsBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): boolean {
  // 1. Either endpoint is inside the box
  if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) return true;
  if (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) return true;

  // 2. Both points strictly on one outside side
  if (x1 < minX && x2 < minX) return false;
  if (x1 > maxX && x2 > maxX) return false;
  if (y1 < minY && y2 < minY) return false;
  if (y1 > maxY && y2 > maxY) return false;

  const dx = x2 - x1;
  const dy = y2 - y1;

  // Segment ray clipping (Liang-Barsky / Slab method)
  let t0 = 0;
  let t1 = 1;

  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];

  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) {
      if (q[i] < 0) return false; // parallel and outside
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }

  return t0 <= t1;
}

/**
 * Checks if a wire passes through a duct.
 * Evaluates all consecutive waypoints in the wire path.
 */
export function wireCrossesDuct(wire: WireConnection, duct: WireDuct): boolean {
  if (!wire.waypoints || wire.waypoints.length < 2) {
    return false;
  }

  // Duct 2D bounds
  const minX = duct.xMm - duct.widthMm / 2;
  const maxX = duct.xMm + duct.widthMm / 2;
  const minY = duct.yMm - duct.heightMm / 2;
  const maxY = duct.yMm + duct.heightMm / 2;

  for (let i = 0; i < wire.waypoints.length - 1; i++) {
    const p1 = wire.waypoints[i];
    const p2 = wire.waypoints[i + 1];
    if (segmentIntersectsBox(p1.xMm, p1.yMm, p2.xMm, p2.yMm, minX, minY, maxX, maxY)) {
      return true;
    }
  }

  return false;
}

/**
 * Computes fill ratio stats for a single duct.
 */
export function calculateDuctFillRatio(
  duct: WireDuct,
  wires: WireConnection[],
  packingFactor = DUCT_PACKING_FACTOR
): DuctFillStats {
  // Cross section: duct cross-sectional dimensions perpendicular to wire flow.
  // In panel layout, horizontal duct carries wires along width; cross-section is heightMm x (depthMm || heightMm).
  // Vertical duct carries wires along height; cross-section is widthMm x (depthMm || widthMm).
  // If duct.widthMm and duct.heightMm are directly used as dimensions:
  const crossW = duct.orientation === "horizontal" ? duct.heightMm : duct.widthMm;
  const crossH = duct.depthMm || (duct.orientation === "horizontal" ? duct.heightMm : duct.widthMm);
  const ductCrossSectionMm = crossW * crossH;

  const effectiveCapacityMm2 = Math.max(1, ductCrossSectionMm * packingFactor);

  let wireCount = 0;
  let totalCableAreaMm2 = 0;

  for (const wire of wires) {
    if (wireCrossesDuct(wire, duct)) {
      wireCount++;
      const od = getWireOuterDiameterMm(wire.gaugeMm2);
      const radius = od / 2;
      const wireArea = Math.PI * radius * radius;
      totalCableAreaMm2 += wireArea;
    }
  }

  const fillRatioPercent = Number(
    ((totalCableAreaMm2 / effectiveCapacityMm2) * 100).toFixed(1)
  );

  let status: DuctFillStatus = "normal";
  if (fillRatioPercent > 70) {
    status = "warning";
  } else if (fillRatioPercent > 50) {
    status = "moderate";
  }

  let recommendedSize: { widthMm: number; heightMm: number; label: string } | undefined;
  if (status === "warning") {
    // Find next standard size whose effective capacity drops fill ratio <= 60%
    const targetCapacity = totalCableAreaMm2 / 0.6;
    for (const size of STANDARD_DUCT_SIZES) {
      const candidateCap = size.widthMm * size.heightMm * packingFactor;
      if (candidateCap >= targetCapacity) {
        recommendedSize = size;
        break;
      }
    }
    if (!recommendedSize) {
      recommendedSize = STANDARD_DUCT_SIZES[STANDARD_DUCT_SIZES.length - 1];
    }
  }

  return {
    ductId: duct.id,
    wireCount,
    totalCableAreaMm2: Number(totalCableAreaMm2.toFixed(1)),
    effectiveCapacityMm2: Number(effectiveCapacityMm2.toFixed(1)),
    fillRatioPercent,
    status,
    recommendedSize,
  };
}

/**
 * Computes fill ratios for an entire array of ducts.
 */
export function calculateAllDuctFillRatios(
  ducts: WireDuct[],
  wires: WireConnection[],
  packingFactor = DUCT_PACKING_FACTOR
): Map<string, DuctFillStats> {
  const map = new Map<string, DuctFillStats>();
  for (const duct of ducts) {
    map.set(duct.id, calculateDuctFillRatio(duct, wires, packingFactor));
  }
  return map;
}

export function getDuctFillStatusColor(status: DuctFillStatus): {
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  gaugeColor: string;
} {
  switch (status) {
    case "warning":
      return {
        badgeBg: "#ef4444",
        badgeText: "#ffffff",
        badgeBorder: "#b91c1c",
        gaugeColor: "#ef4444",
      };
    case "moderate":
      return {
        badgeBg: "#f59e0b",
        badgeText: "#ffffff",
        badgeBorder: "#d97706",
        gaugeColor: "#f59e0b",
      };
    case "normal":
    default:
      return {
        badgeBg: "#10b981",
        badgeText: "#ffffff",
        badgeBorder: "#059669",
        gaugeColor: "#10b981",
      };
  }
}
