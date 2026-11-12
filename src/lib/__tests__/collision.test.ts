import { describe, expect, it } from "vitest";
import { detectCollisionsAndBounds } from "../collision";
import type { CustomCadAsset, PlacedComponent } from "@/types/panel";

function makeComp(
  id: string,
  xMm: number,
  yMm: number,
  widthMm = 50,
  heightMm = 80,
  rotationDeg: 0 | 90 | 180 | 270 = 0
): PlacedComponent {
  return {
    id,
    templateId: "mcb-1p",
    name: id,
    xMm,
    yMm,
    zMm: 40,
    rotationDeg,
    railId: null,
    widthMm,
    heightMm,
    depthMm: 70,
    color: "#e2e6ed",
    accentColor: "#2563eb",
    pins: [],
  };
}

describe("collision detection", () => {
  it("detects AABB overlap between components and rotated bounding boxes", () => {
    const components = [
      makeComp("c1", 0, 0, 50, 80, 0),
      makeComp("c2", 30, 0, 50, 80, 0), // overlaps c1
      makeComp("c3", -150, 100, 50, 80, 90), // rotated 90deg: 80x50, clear
    ];

    const report = detectCollisionsAndBounds(components, [], 500, 700);
    expect(report.overlappingIds.has("c1")).toBe(true);
    expect(report.overlappingIds.has("c2")).toBe(true);
    expect(report.overlappingIds.has("c3")).toBe(false);
    expect(report.overlapPairs).toEqual([["c1", "c2"]]);
  });

  it("detects out-of-bounds components and CAD assets against plate limits", () => {
    const components = [
      makeComp("inside", 0, 0, 50, 80),
      makeComp("outside", 240, 0, 50, 80), // max X = 265 > 250
    ];
    const cadAssets: CustomCadAsset[] = [
      {
        id: "cad-out",
        name: "CAD Out",
        fileName: "out.dxf",
        format: "dxf",
        sourceUnit: "mm",
        xMm: 0,
        yMm: 340,
        zMm: 20,
        boundingBoxMm: { w: 40, h: 40, d: 20 },
        pins: [],
      },
    ];

    const report = detectCollisionsAndBounds(components, cadAssets, 500, 700);
    expect(report.outOfBoundsIds.has("inside")).toBe(false);
    expect(report.outOfBoundsIds.has("outside")).toBe(true);
    expect(report.outOfBoundsIds.has("cad-out")).toBe(true);
  });
});
