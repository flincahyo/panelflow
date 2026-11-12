import { describe, expect, it } from "vitest";
import {
  calculateAllDuctFillRatios,
  calculateDuctFillRatio,
  DUCT_PACKING_FACTOR,
  getDuctFillStatusColor,
  segmentIntersectsBox,
  wireCrossesDuct,
} from "../duct-fill";
import type { WireConnection, WireDuct } from "@/types/panel";

describe("Wire Duct Fill Ratio (%) Engine", () => {
  const sampleDuct: WireDuct = {
    id: "duct-1",
    name: "Main Duct",
    xMm: 0,
    yMm: 100,
    widthMm: 400,
    heightMm: 40,
    depthMm: 60,
    orientation: "horizontal",
  };

  it("accurately tests segment vs AABB intersection", () => {
    // Box: x: [-50, 50], y: [80, 120]
    expect(segmentIntersectsBox(-100, 100, 100, 100, -50, 80, 50, 120)).toBe(true);
    expect(segmentIntersectsBox(0, 50, 0, 150, -50, 80, 50, 120)).toBe(true);
    // Segment completely outside
    expect(segmentIntersectsBox(-200, 200, -100, 200, -50, 80, 50, 120)).toBe(false);
  });

  it("checks whether a wire crosses duct bounds", () => {
    const crossingWire: WireConnection = {
      id: "w1",
      label: "L1-1",
      colorCode: "R",
      gaugeMm2: "2.5",
      fromComponentId: "c1",
      fromPinId: "p1",
      toComponentId: "c2",
      toPinId: "p2",
      waypoints: [
        { xMm: -50, yMm: 100 },
        { xMm: 50, yMm: 100 },
      ],
    };

    const nonCrossingWire: WireConnection = {
      id: "w2",
      label: "L2-1",
      colorCode: "S",
      gaugeMm2: "1.5",
      fromComponentId: "c1",
      fromPinId: "p1",
      toComponentId: "c2",
      toPinId: "p2",
      waypoints: [
        { xMm: -50, yMm: -100 },
        { xMm: 50, yMm: -100 },
      ],
    };

    expect(wireCrossesDuct(crossingWire, sampleDuct)).toBe(true);
    expect(wireCrossesDuct(nonCrossingWire, sampleDuct)).toBe(false);
  });

  it("calculates fill ratio percent based on 60% industry packing factor", () => {
    // Cross section: 40mm x 60mm = 2400 mm2.
    // Effective capacity (60%): 2400 * 0.6 = 1440 mm2.
    // For 2.5 mm² NYAF wire, OD = 3.7mm -> radius = 1.85mm -> area = PI * 1.85^2 ≈ 10.75 mm².
    const wires: WireConnection[] = [
      {
        id: "w1",
        label: "L1-1",
        colorCode: "R",
        gaugeMm2: "2.5",
        fromComponentId: "c1",
        fromPinId: "p1",
        toComponentId: "c2",
        toPinId: "p2",
        waypoints: [
          { xMm: 0, yMm: 90 },
          { xMm: 0, yMm: 110 },
        ],
      },
    ];

    const stats = calculateDuctFillRatio(sampleDuct, wires, DUCT_PACKING_FACTOR);
    expect(stats.wireCount).toBe(1);
    expect(stats.effectiveCapacityMm2).toBe(1440);
    expect(stats.totalCableAreaMm2).toBeCloseTo(10.8, 1);
    expect(stats.fillRatioPercent).toBeCloseTo((10.75 / 1440) * 100, 1);
    expect(stats.status).toBe("normal");
  });

  it("categorizes fill status into normal, moderate, and warning overfill", () => {
    // Small duct: 20x20 -> cross section 400 mm2 -> effective capacity 240 mm2
    const smallDuct: WireDuct = {
      id: "d-small",
      name: "Small Duct",
      xMm: 0,
      yMm: 0,
      widthMm: 20,
      heightMm: 20,
      depthMm: 20,
      orientation: "horizontal",
    };

    // Many 16mm² wires (OD = 8.0mm, area ≈ 50.27 mm² each)
    const heavyWires: WireConnection[] = Array.from({ length: 5 }, (_, i) => ({
      id: `hw-${i}`,
      label: `W-${i}`,
      colorCode: "R",
      gaugeMm2: "16.0",
      fromComponentId: "c1",
      fromPinId: "p1",
      toComponentId: "c2",
      toPinId: "p2",
      waypoints: [
        { xMm: 0, yMm: -5 },
        { xMm: 0, yMm: 5 },
      ],
    }));

    // 5 * 50.27 ≈ 251.35 mm² > 240 mm² => > 100% fill ratio -> warning
    const statsWarning = calculateDuctFillRatio(smallDuct, heavyWires);
    expect(statsWarning.status).toBe("warning");
    expect(statsWarning.fillRatioPercent).toBeGreaterThan(70);
    expect(statsWarning.recommendedSize).toBeDefined();

    const colors = getDuctFillStatusColor(statsWarning.status);
    expect(colors.badgeBg).toBe("#ef4444");
  });

  it("calculates all duct fill ratios across a map", () => {
    const ducts: WireDuct[] = [sampleDuct];
    const map = calculateAllDuctFillRatios(ducts, []);
    expect(map.has(sampleDuct.id)).toBe(true);
    expect(map.get(sampleDuct.id)?.fillRatioPercent).toBe(0);
  });
});
