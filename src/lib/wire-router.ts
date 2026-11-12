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

export function pointsToSvgPath(points: WirePoint[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")}`;
}
