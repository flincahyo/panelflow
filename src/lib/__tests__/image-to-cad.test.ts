import { describe, it, expect } from "vitest";
import {
  perpendicularDistance,
  simplifyDouglasPeucker,
  pixelPointsToMmSegments,
  generateDxfFromSegments,
  binarizeImageData,
  extractContoursFromBinaryMask,
  type Point2D,
} from "../image-to-cad";
import { parseDxfToMmSegments } from "../dxf-parser";

describe("Image-to-CAD Vectorizer Engine", () => {
  it("calculates perpendicular distance correctly", () => {
    const p: Point2D = { x: 0, y: 5 };
    const a: Point2D = { x: -10, y: 0 };
    const b: Point2D = { x: 10, y: 0 };
    expect(perpendicularDistance(p, a, b)).toBeCloseTo(5);
  });

  it("simplifies collinear points via Douglas-Peucker", () => {
    const points: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0.05 },
      { x: 20, y: -0.05 },
      { x: 30, y: 0 },
      { x: 40, y: 0 },
    ];
    const simplified = simplifyDouglasPeucker(points, 0.5);
    expect(simplified.length).toBe(2);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[1]).toEqual({ x: 40, y: 0 });
  });

  it("preserves sharp corner in Douglas-Peucker", () => {
    const points: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const simplified = simplifyDouglasPeucker(points, 0.5);
    expect(simplified.length).toBe(4);
  });

  it("scales and centers pixel points into canonical mm bounds", () => {
    // 100x200 pixel image, a box from (25, 50) to (75, 150)
    // Target mm: 50mm width x 100mm height
    const poly: Point2D[] = [
      { x: 25, y: 50 },
      { x: 75, y: 50 },
      { x: 75, y: 150 },
      { x: 25, y: 150 },
      { x: 25, y: 50 },
    ];

    const segments = pixelPointsToMmSegments([poly], 100, 200, 50, 100, 0.1);
    expect(segments.length).toBe(4);

    // Box was half the width & half the height centered in image
    // In mm: width should be 25mm (-12.5 to 12.5), height 50mm (-25 to 25)
    for (const seg of segments) {
      expect(Math.abs(seg.x1)).toBeLessThanOrEqual(12.55);
      expect(Math.abs(seg.x2)).toBeLessThanOrEqual(12.55);
      expect(Math.abs(seg.y1)).toBeLessThanOrEqual(25.05);
      expect(Math.abs(seg.y2)).toBeLessThanOrEqual(25.05);
    }
  });

  it("generates valid standard DXF R12 text parseable by PanelFlow DXF parser", () => {
    const segments = [
      { x1: -22.5, y1: -42.5, z1: 0, x2: 22.5, y2: -42.5, z2: 0 },
      { x1: 22.5, y1: -42.5, z1: 0, x2: 22.5, y2: 42.5, z2: 0 },
      { x1: 22.5, y1: 42.5, z1: 0, x2: -22.5, y2: 42.5, z2: 0 },
      { x1: -22.5, y1: 42.5, z1: 0, x2: -22.5, y2: -42.5, z2: 0 },
    ];

    const dxfText = generateDxfFromSegments(segments, 45, 85);
    expect(dxfText).toContain("$ACADVER");
    expect(dxfText).toContain("AC1009");
    expect(dxfText).toContain("$INSUNITS");
    expect(dxfText).toContain("ENTITIES");
    expect(dxfText).toContain("PANELFLOW_OUTLINE");

    // Validate with parseDxfToMmSegments
    const parsed = parseDxfToMmSegments(dxfText, "mm");
    expect(parsed.entityCount).toBe(4);
    expect(parsed.boundingBoxMm.w).toBeCloseTo(45, 1);
    expect(parsed.boundingBoxMm.h).toBeCloseTo(85, 1);
  });

  it("binarizes RGBA imageData with custom threshold & invert", () => {
    // 2x2 image:
    // Pixel 0: Black (0,0,0, 255)
    // Pixel 1: White (255,255,255, 255)
    // Pixel 2: Gray 100 (100,100,100, 255)
    // Pixel 3: Transparent (0,0,0, 0)
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
      100, 100, 100, 255,
      0, 0, 0, 0,
    ]);

    // Normal mode: dark is 1 (foreground)
    const mask = binarizeImageData(data, 2, 2, 128, false);
    expect(mask[0]).toBe(1); // black
    expect(mask[1]).toBe(0); // white
    expect(mask[2]).toBe(1); // gray 100 < 128
    expect(mask[3]).toBe(0); // transparent

    // Invert mode: light is 1 (foreground)
    const maskInvert = binarizeImageData(data, 2, 2, 128, true);
    expect(maskInvert[0]).toBe(0);
    expect(maskInvert[1]).toBe(1);
    expect(maskInvert[2]).toBe(0);
    expect(maskInvert[3]).toBe(0);
  });

  it("extracts closed contours from binary mask", () => {
    // 8x8 mask with a 4x4 square in the middle
    const w = 8;
    const h = 8;
    const mask = new Uint8Array(w * h);

    for (let y = 2; y <= 5; y++) {
      for (let x = 2; x <= 5; x++) {
        mask[y * w + x] = 1;
      }
    }

    const contours = extractContoursFromBinaryMask(mask, w, h, 4);
    expect(contours.length).toBeGreaterThanOrEqual(1);
    expect(contours[0].length).toBeGreaterThanOrEqual(4);
  });
});
