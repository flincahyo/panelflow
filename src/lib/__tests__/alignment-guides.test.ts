import { describe, expect, it } from "vitest";
import {
  buildAlignmentTargetBoxes,
  computeAlignmentGuides,
  type AlignmentTargetBox,
} from "@/lib/alignment-guides";
import type { CustomCadAsset, DinRail, PlacedComponent, WireDuct } from "@/types/panel";

describe("alignment-guides", () => {
  it("computes horizontal and vertical alignment guides with snap", () => {
    const targets: AlignmentTargetBox[] = [
      {
        id: "comp-1",
        kind: "component",
        left: 20,
        right: 80,
        centerX: 50,
        top: 100,
        bottom: 20,
        centerY: 60,
      },
    ];

    // Near center X (centerX: 52, target: 50) -> should snap to 50
    const resX = computeAlignmentGuides(
      {
        xMm: 52,
        yMm: 200,
        widthMm: 40,
        heightMm: 60,
      },
      targets,
      3.5
    );

    expect(resX.snappedX).toBe(true);
    expect(resX.xMm).toBe(50);
    expect(resX.guides.some((g) => g.orientation === "vertical" && g.coordinate === 50)).toBe(true);

    // Near left edge (left: 21 -> xMm = 21 + 20 = 41, target left: 20 -> snapped xMm = 40)
    const resLeft = computeAlignmentGuides(
      {
        xMm: 41,
        yMm: 200,
        widthMm: 40,
        heightMm: 60,
      },
      targets,
      3.5
    );

    expect(resLeft.snappedX).toBe(true);
    expect(resLeft.xMm).toBe(40);
    expect(resLeft.guides.some((g) => g.orientation === "vertical" && g.coordinate === 20)).toBe(true);

    // Near center Y (centerY: 62, target: 60) -> should snap to 60
    const resY = computeAlignmentGuides(
      {
        xMm: 300,
        yMm: 62,
        widthMm: 40,
        heightMm: 60,
      },
      targets,
      3.5
    );

    expect(resY.snappedY).toBe(true);
    expect(resY.yMm).toBe(60);
    expect(resY.guides.some((g) => g.orientation === "horizontal" && g.coordinate === 60)).toBe(true);
  });

  it("builds target boxes from components, cadAssets, rails, ducts excluding specified ids", () => {
    const components: PlacedComponent[] = [
      {
        id: "c1",
        templateId: "contactor",
        name: "KM1",
        xMm: 0,
        yMm: 50,
        zMm: 0,
        widthMm: 45,
        heightMm: 85,
        depthMm: 75,
        color: "#fff",
        accentColor: "#000",
        railId: null,
        pins: [],
      },
    ];

    const cadAssets: CustomCadAsset[] = [
      {
        id: "cad1",
        name: "VFD",
        fileName: "vfd.step",
        format: "obj",
        sourceUnit: "mm",
        xMm: 100,
        yMm: 50,
        zMm: 0,
        boundingBoxMm: { w: 60, h: 120, d: 80 },
        pins: [],
      },
    ];

    const rails: DinRail[] = [
      {
        id: "r1",
        name: "Rail 1",
        xMm: 0,
        yMm: 0,
        lengthMm: 400,
      },
    ];

    const ducts: WireDuct[] = [
      {
        id: "d1",
        name: "Duct 1",
        xMm: 0,
        yMm: -100,
        widthMm: 400,
        heightMm: 40,
        depthMm: 60,
        orientation: "horizontal",
      },
    ];

    const boxes = buildAlignmentTargetBoxes(
      components,
      cadAssets,
      rails,
      ducts,
      new Set(["c1"])
    );

    expect(boxes.some((b) => b.id === "c1")).toBe(false);
    expect(boxes.some((b) => b.id === "cad1")).toBe(true);
    expect(boxes.some((b) => b.id === "r1")).toBe(true);
    expect(boxes.some((b) => b.id === "d1")).toBe(true);
    expect(boxes.length).toBe(3);
  });
});
