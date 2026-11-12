import { describe, expect, it } from "vitest";
import {
  routeOrthogonalWire,
  type WirePoint,
} from "../wire-router";

describe("wire-router", () => {
  it("generates simple straight route if points share X or Y axis", () => {
    const from: WirePoint = { x: 10, y: 20 };
    const to: WirePoint = { x: 10, y: 100 };
    const waypoints = routeOrthogonalWire(from, to);
    expect(waypoints).toEqual([
      { x: 10, y: 20 },
      { x: 10, y: 100 },
    ]);
  });

  it("generates 90-degree orthogonal route (Z / S bend) with mid X or mid Y", () => {
    const from: WirePoint = { x: 0, y: 0 };
    const to: WirePoint = { x: 100, y: 100 };
    const waypoints = routeOrthogonalWire(from, to, "horizontal-first");
    expect(waypoints.length).toBe(4);
    expect(waypoints[0]).toEqual({ x: 0, y: 0 });
    expect(waypoints[waypoints.length - 1]).toEqual({ x: 100, y: 100 });
    // Check that segments are strictly orthogonal (dx == 0 or dy == 0)
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      const isOrthogonal = p1.x === p2.x || p1.y === p2.y;
      expect(isOrthogonal).toBe(true);
    }
  });

  it("handles vertical-first preference correctly", () => {
    const from: WirePoint = { x: 20, y: 10 };
    const to: WirePoint = { x: 80, y: 90 };
    const waypoints = routeOrthogonalWire(from, to, "vertical-first");
    expect(waypoints.length).toBe(4);
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      expect(p1.x === p2.x || p1.y === p2.y).toBe(true);
    }
  });
});
