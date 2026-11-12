export interface WirePoint {
  x: number;
  y: number;
}

export type RoutingPreference = "horizontal-first" | "vertical-first" | "direct";

export function routeOrthogonalWire(
  from: WirePoint,
  to: WirePoint,
  preference: RoutingPreference = "horizontal-first"
): WirePoint[] {
  // If sharing exact same coordinate on an axis, straight line
  if (Math.abs(from.x - to.x) < 0.001 || Math.abs(from.y - to.y) < 0.001) {
    return [
      { x: Number(from.x.toFixed(2)), y: Number(from.y.toFixed(2)) },
      { x: Number(to.x.toFixed(2)), y: Number(to.y.toFixed(2)) },
    ];
  }

  if (preference === "direct") {
    return [
      { x: Number(from.x.toFixed(2)), y: Number(from.y.toFixed(2)) },
      { x: Number(to.x.toFixed(2)), y: Number(to.y.toFixed(2)) },
    ];
  }

  if (preference === "horizontal-first") {
    const midX = Number(((from.x + to.x) / 2).toFixed(2));
    return [
      { x: Number(from.x.toFixed(2)), y: Number(from.y.toFixed(2)) },
      { x: midX, y: Number(from.y.toFixed(2)) },
      { x: midX, y: Number(to.y.toFixed(2)) },
      { x: Number(to.x.toFixed(2)), y: Number(to.y.toFixed(2)) },
    ];
  }

  const midY = Number(((from.y + to.y) / 2).toFixed(2));
  return [
    { x: Number(from.x.toFixed(2)), y: Number(from.y.toFixed(2)) },
    { x: Number(from.x.toFixed(2)), y: midY },
    { x: Number(to.x.toFixed(2)), y: midY },
    { x: Number(to.x.toFixed(2)), y: Number(to.y.toFixed(2)) },
  ];
}

export const WIRE_GAUGES_MM2 = [
  "0.75",
  "1.0",
  "1.5",
  "2.5",
  "4.0",
  "6.0",
  "10.0",
  "16.0",
] as const;

const NYAF_OUTER_DIAMETER_MM: Record<string, number> = {
  "0.75": 2.4,
  "1": 2.7,
  "1.0": 2.7,
  "1.5": 3.0,
  "2.5": 3.7,
  "4": 4.4,
  "4.0": 4.4,
  "6": 5.2,
  "6.0": 5.2,
  "10": 6.5,
  "10.0": 6.5,
  "16": 8.0,
  "16.0": 8.0,
};

/**
 * Returns physical outer diameter (mm) for NYAF / flexible panel wire
 * based on conductor cross-section (mm²).
 */
export function getWireOuterDiameterMm(crossSectionMm2: number | string): number {
  const raw = String(crossSectionMm2).trim();
  if (raw in NYAF_OUTER_DIAMETER_MM) {
    return NYAF_OUTER_DIAMETER_MM[raw];
  }
  const area =
    typeof crossSectionMm2 === "number"
      ? crossSectionMm2
      : Number.parseFloat(raw);
  if (!Number.isFinite(area) || area <= 0) {
    return 3.0;
  }
  const normalized = area.toFixed(1);
  if (normalized in NYAF_OUTER_DIAMETER_MM) {
    return NYAF_OUTER_DIAMETER_MM[normalized];
  }
  // Realistic fallback: copper strand bundle diameter + insulation jacket (scales with conductor size)
  const conductorDia = 2 * Math.sqrt(area / Math.PI);
  const jacketThickness = 1.0 + conductorDia * 0.35;
  return Number((conductorDia + jacketThickness * 2).toFixed(2));
}

export function pointsToSvgPath(points: WirePoint[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")}`;
}

export function pointsToRoundedSvgPath(
  points: WirePoint[],
  radiusMm = 4
): string {
  if (points.length === 0) return "";
  if (points.length <= 2 || radiusMm <= 0) return pointsToSvgPath(points);

  const parts: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.hypot(dx1, dy1);

    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.hypot(dx2, dy2);

    if (len1 < 0.001 || len2 < 0.001) {
      parts.push(`L ${curr.x} ${curr.y}`);
      continue;
    }

    const r = Math.min(radiusMm, len1 / 2, len2 / 2);
    const p1x = curr.x - (dx1 / len1) * r;
    const p1y = curr.y - (dy1 / len1) * r;
    const p2x = curr.x + (dx2 / len2) * r;
    const p2y = curr.y + (dy2 / len2) * r;

    parts.push(`L ${p1x.toFixed(2)} ${p1y.toFixed(2)}`);
    parts.push(`Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${p2x.toFixed(2)} ${p2y.toFixed(2)}`);
  }

  const last = points[points.length - 1];
  parts.push(`L ${last.x} ${last.y}`);
  return parts.join(" ");
}
