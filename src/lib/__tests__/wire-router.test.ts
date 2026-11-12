import { describe, expect, it } from "vitest";
import {
  getWireOuterDiameterMm,
  pointsToRoundedSvgPath,
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
      expect(p1.x === p2.x || p1.y === p2.y).toBe(true);
    }
  });

  it("returns realistic NYAF outer diameters (mm) for standard gauges and fallback", () => {
    expect(getWireOuterDiameterMm("0.75")).toBe(2.4);
    expect(getWireOuterDiameterMm("1.0")).toBe(2.7);
    expect(getWireOuterDiameterMm("1.5")).toBe(3.0);
    expect(getWireOuterDiameterMm("2.5")).toBe(3.7);
    expect(getWireOuterDiameterMm("4.0")).toBe(4.4);
    expect(getWireOuterDiameterMm("6.0")).toBe(5.2);
    expect(getWireOuterDiameterMm("10.0")).toBe(6.5);
    expect(getWireOuterDiameterMm("16.0")).toBe(8.0);
    expect(getWireOuterDiameterMm(25)).toBeGreaterThan(7.0);
  });

  it("generates rounded corner SVG paths for orthogonal bends", () => {
    const pts = routeOrthogonalWire({ x: 0, y: 0 }, { x: 100, y: 100 }, "horizontal-first");
    const d = pointsToRoundedSvgPath(pts, 4);
    expect(d).toContain("Q ");
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

  it("maps standard NYAF cross-sections to physical outer diameters in mm", () => {
    expect(getWireOuterDiameterMm(0.75)).toBe(2.4);
    expect(getWireOuterDiameterMm(1.0)).toBe(2.7);
    expect(getWireOuterDiameterMm("1.5")).toBe(3.0);
    expect(getWireOuterDiameterMm(2.5)).toBe(3.7);
    expect(getWireOuterDiameterMm("4.0")).toBe(4.4);
    expect(getWireOuterDiameterMm(6.0)).toBe(5.2);
    expect(getWireOuterDiameterMm("10")).toBe(6.5);
    expect(getWireOuterDiameterMm("10.0")).toBe(6.5);
    expect(getWireOuterDiameterMm(16.0)).toBe(8.0);
  });

  it("computes realistic fallback outer diameter for non-table cross-sections", () => {
    const d25 = getWireOuterDiameterMm(25);
    expect(d25).toBeGreaterThan(8.0);
    expect(d25).toBeLessThan(13.0);
    expect(getWireOuterDiameterMm(0)).toBeGreaterThan(0);
  });

  it("formats orthogonal waypoints with rounded corner arcs when radius > 0", () => {
    const pts: WirePoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ];
    const d = pointsToRoundedSvgPath(pts, 4);
    expect(d).toContain("Q ");
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d.endsWith("100 50")).toBe(true);
  });
});
