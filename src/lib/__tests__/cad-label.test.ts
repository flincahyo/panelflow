import { describe, expect, it } from "vitest";
import {
  buildSvgObstacleBoxes,
  formatCadDisplayLabel,
  getSmartCadLabelPosition,
} from "../cad-label";
import type { CustomCadAsset, PlacedComponent } from "@/types/panel";

describe("cad-label helper", () => {
  it("formats display label cleanly without [DXF] suffix and respects maxLen", () => {
    expect(formatCadDisplayLabel("Contactor Schneider LC1D")).toBe(
      "Contactor Schneider LC1D"
    );
    expect(
      formatCadDisplayLabel(
        "Super Long Industrial Molded Case Circuit Breaker Model 2026 With Shunt Trip",
        25
      )
    ).toBe("Super Long Industrial M…");
  });

  it("defaults to top position when top zone is free and not cropped", () => {
    const pos = getSmartCadLabelPosition({
      assetId: "relay-1",
      effX: 100,
      effY: 100,
      effW: 50,
      effH: 60,
      otherBoxes: [],
    });
    expect(pos.placement).toBe("top");
    expect(pos.x).toBe(102);
    expect(pos.y).toBe(97);
  });

  it("shifts to right when cropMm.top > 0", () => {
    const pos = getSmartCadLabelPosition({
      assetId: "relay-1",
      effX: 100,
      effY: 100,
      effW: 50,
      effH: 60,
      cropMm: { top: 12, bottom: 0, left: 0, right: 0 },
      otherBoxes: [],
    });
    expect(pos.placement).toBe("right");
    expect(pos.x).toBe(153);
    expect(pos.y).toBe(105);
  });

  it("shifts to right when top zone is occluded by contactor placed above", () => {
    const obstacleAbove = {
      id: "contactor-1",
      x: 95,
      y: 70,
      w: 60,
      h: 30, // overlaps y: 70..100 (topZone y: 88..100)
    };
    const pos = getSmartCadLabelPosition({
      assetId: "relay-1",
      effX: 100,
      effY: 100,
      effW: 50,
      effH: 60,
      otherBoxes: [obstacleAbove],
    });
    expect(pos.placement).toBe("right");
  });

  it("falls back to bottom when top and right are both occluded", () => {
    const obstacleAbove = {
      id: "contactor-1",
      x: 95,
      y: 70,
      w: 60,
      h: 30,
    };
    const obstacleRight = {
      id: "duct-1",
      x: 151,
      y: 95,
      w: 30,
      h: 70,
    };
    const pos = getSmartCadLabelPosition({
      assetId: "relay-1",
      effX: 100,
      effY: 100,
      effW: 50,
      effH: 60,
      otherBoxes: [obstacleAbove, obstacleRight],
    });
    expect(pos.placement).toBe("bottom");
    expect(pos.y).toBe(100 + 60 + 5);
  });

  it("honors manual labelPosition override from Inspector", () => {
    const pos = getSmartCadLabelPosition({
      assetId: "relay-1",
      effX: 100,
      effY: 100,
      effW: 50,
      effH: 60,
      labelPosition: "left",
      otherBoxes: [],
    });
    expect(pos.placement).toBe("left");
    expect(pos.textAnchor).toBe("end");
    expect(pos.x).toBe(97);
  });

  it("builds SVG obstacle boxes from components and CAD assets", () => {
    const components: PlacedComponent[] = [
      {
        id: "c1",
        templateId: "mcb-1p",
        name: "Q1",
        xMm: 10,
        yMm: 20,
        zMm: 0,
        railId: null,
        widthMm: 18,
        heightMm: 80,
        depthMm: 60,
        color: "#e2e6ed",
        accentColor: "#2563eb",
        pins: [],
      },
    ];
    const cadAssets: CustomCadAsset[] = [
      {
        id: "a1",
        name: "Contactor",
        fileName: "lc1d.dxf",
        format: "dxf",
        sourceUnit: "mm",
        xMm: 10,
        yMm: 120,
        zMm: 0,
        boundingBoxMm: { w: 45, h: 75, d: 50 },
        pins: [],
      },
    ];
    const boxes = buildSvgObstacleBoxes(components, cadAssets);
    expect(boxes).toHaveLength(2);
    expect(boxes[0].id).toBe("c1");
    expect(boxes[1].id).toBe("a1");
  });
});
