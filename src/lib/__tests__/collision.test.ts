import { describe, expect, it } from "vitest";
import { detectCollisionsAndBounds, getEffectiveCadBounds } from "../collision";
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

  it("computes effective cropped CAD bounds and clamps minimum 1mm", () => {
    expect(
      getEffectiveCadBounds({ boundingBoxMm: { w: 45, h: 60 } })
    ).toEqual({ widthMm: 45, heightMm: 60, offsetX: 0, offsetY: 0 });

    expect(
      getEffectiveCadBounds({
        boundingBoxMm: { w: 45, h: 60 },
        cropMm: { top: 15, bottom: 5, left: 4, right: 0 },
      })
    ).toEqual({ widthMm: 41, heightMm: 40, offsetX: 2, offsetY: -5 });

    const clamped = getEffectiveCadBounds({
      boundingBoxMm: { w: 20, h: 20 },
      cropMm: { top: 50, bottom: 50, left: 30, right: 10 },
    });
    expect(clamped.widthMm).toBe(1);
    expect(clamped.heightMm).toBe(1);
  });

  it("uses effective cropped CAD bounds for collision and plate bounds checks", () => {
    const contactor = makeComp("contactor", 0, 40, 45, 80); // y: [0, 80]
    const torUncropped: CustomCadAsset = {
      id: "tor",
      name: "TOR",
      fileName: "tor.dxf",
      format: "dxf",
      sourceUnit: "mm",
      xMm: 0,
      yMm: -10, // uncropped y: [-40, 20] -> overlaps contactor [0, 20]
      zMm: 20,
      boundingBoxMm: { w: 45, h: 60, d: 40 },
      pins: [],
    };

    const uncroppedReport = detectCollisionsAndBounds(
      [contactor],
      [torUncropped],
      500,
      700
    );
    expect(uncroppedReport.overlappingIds.has("tor")).toBe(true);
    expect(uncroppedReport.overlappingIds.has("contactor")).toBe(true);

    const torCropped: CustomCadAsset = {
      ...torUncropped,
      cropMm: { top: 20, bottom: 0, left: 0, right: 0 }, // effective y: [-40, 0] -> clear
    };
    const croppedReport = detectCollisionsAndBounds(
      [contactor],
      [torCropped],
      500,
      700
    );
    expect(croppedReport.overlappingIds.size).toBe(0);
    expect(croppedReport.overlapPairs).toEqual([]);

    // Cropping an out-of-bounds edge brings CAD asset back inside plate bounds
    const edgeAsset: CustomCadAsset = {
      id: "edge-cad",
      name: "Edge CAD",
      fileName: "edge.dxf",
      format: "dxf",
      sourceUnit: "mm",
      xMm: 235,
      yMm: 0,
      zMm: 20,
      boundingBoxMm: { w: 40, h: 40, d: 20 }, // right edge 255 > 250
      cropMm: { top: 0, bottom: 0, left: 0, right: 10 }, // right edge 245 <= 250
      pins: [],
    };
    const edgeReport = detectCollisionsAndBounds([], [edgeAsset], 500, 700);
    expect(edgeReport.outOfBoundsIds.has("edge-cad")).toBe(false);
  });
});
