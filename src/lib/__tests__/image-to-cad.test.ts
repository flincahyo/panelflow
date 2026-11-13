import { describe, it, expect } from "vitest";
import {
  perpendicularDistance,
  simplifyDouglasPeucker,
  pixelPointsToMmSegments,
  generateDxfFromSegments,
  binarizeImageData,
  extractContoursFromBinaryMask,
  calculateAspectRatio,
  calculateHeightFromWidth,
  calculateWidthFromHeight,
  findContentBoundingBox,
  STANDARD_COMPONENT_PRESETS,
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

  describe("Anti-Gepeng Aspect Ratio & Math Utilities", () => {
    it("calculates aspect ratio correctly and handles invalid inputs gracefully", () => {
      expect(calculateAspectRatio(100, 50)).toBe(2);
      expect(calculateAspectRatio(45, 85)).toBeCloseTo(45 / 85);
      expect(calculateAspectRatio(0, 100)).toBe(1);
      expect(calculateAspectRatio(100, 0)).toBe(1);
      expect(calculateAspectRatio(-50, 50)).toBe(1);
    });

    it("calculates proportional height from width", () => {
      // 1:2 aspect ratio (w=50, h=100) -> ratio = 0.5
      expect(calculateHeightFromWidth(45, 0.5)).toBe(90);
      // Square
      expect(calculateHeightFromWidth(96, 1)).toBe(96);
      // Fallback on invalid ratio
      expect(calculateHeightFromWidth(45, 0)).toBe(45);
    });

    it("calculates proportional width from height", () => {
      // 1:2 aspect ratio (w=50, h=100) -> ratio = 0.5
      expect(calculateWidthFromHeight(100, 0.5)).toBe(50);
      // Square
      expect(calculateWidthFromHeight(96, 1)).toBe(96);
      // Fallback on invalid ratio
      expect(calculateWidthFromHeight(70, 0)).toBe(70);
    });

    it("includes all requested standard industry component dimension presets", () => {
      const contactor = STANDARD_COMPONENT_PRESETS.find((p) => p.id === "contactor");
      expect(contactor).toBeDefined();
      expect(contactor).toMatchObject({ widthMm: 45, heightMm: 77, depthMm: 86 });

      const overload = STANDARD_COMPONENT_PRESETS.find((p) => p.id === "overload");
      expect(overload).toBeDefined();
      expect(overload).toMatchObject({ widthMm: 45, heightMm: 66, depthMm: 70 });

      const mcb1p = STANDARD_COMPONENT_PRESETS.find((p) => p.id === "mcb-1p");
      expect(mcb1p).toBeDefined();
      expect(mcb1p).toMatchObject({ widthMm: 18, heightMm: 85, depthMm: 70 });

      const mcb3p = STANDARD_COMPONENT_PRESETS.find((p) => p.id === "mcb-3p");
      expect(mcb3p).toBeDefined();
      expect(mcb3p).toMatchObject({ widthMm: 54, heightMm: 85, depthMm: 70 });

      const psu = STANDARD_COMPONENT_PRESETS.find((p) => p.id === "psu-24v");
      expect(psu).toBeDefined();
      expect(psu).toMatchObject({ widthMm: 72, heightMm: 125, depthMm: 100 });

      const terminal = STANDARD_COMPONENT_PRESETS.find((p) => p.id === "terminal-block");
      expect(terminal).toBeDefined();
      expect(terminal).toMatchObject({ widthMm: 6, heightMm: 50, depthMm: 45 });

      const meter = STANDARD_COMPONENT_PRESETS.find((p) => p.id === "panel-meter");
      expect(meter).toBeDefined();
      expect(meter).toMatchObject({ widthMm: 96, heightMm: 96, depthMm: 65 });
    });
  });

  describe("Auto-Trim Whitespace Margin Detection", () => {
    it("detects exact non-white bounding box inside white datasheet background", () => {
      // 10x10 image initialized to pure white (255, 255, 255, 255)
      const w = 10;
      const h = 10;
      const data = new Uint8ClampedArray(w * h * 4);
      data.fill(255);

      // Create a 4x6 dark box from x=[3..6], y=[2..7]
      for (let y = 2; y <= 7; y++) {
        for (let x = 3; x <= 6; x++) {
          const idx = (y * w + x) * 4;
          data[idx] = 40;     // R
          data[idx + 1] = 40; // G
          data[idx + 2] = 40; // B
          data[idx + 3] = 255; // A
        }
      }

      const bbox = findContentBoundingBox(data, w, h, 235, 10);
      expect(bbox).not.toBeNull();
      expect(bbox?.minX).toBe(3);
      expect(bbox?.maxX).toBe(6);
      expect(bbox?.minY).toBe(2);
      expect(bbox?.maxY).toBe(7);
      expect(bbox?.width).toBe(4);
      expect(bbox?.height).toBe(6);
    });

    it("treats light gray, broken-white, or light shadow as whitespace background", () => {
      const w = 8;
      const h = 8;
      const data = new Uint8ClampedArray(w * h * 4);
      // Fill with broken-white / light shadow background (225, 226, 227) -> lum ~ 226, diff = 2 < 25
      for (let i = 0; i < w * h; i++) {
        data[i * 4 + 0] = 225;
        data[i * 4 + 1] = 226;
        data[i * 4 + 2] = 227;
        data[i * 4 + 3] = 255;
      }

      // Draw component in center 2x2: (3,3) to (4,4)
      for (let y = 3; y <= 4; y++) {
        for (let x = 3; x <= 4; x++) {
          const idx = (y * w + x) * 4;
          data[idx] = 50;
          data[idx + 1] = 50;
          data[idx + 2] = 50;
          data[idx + 3] = 255;
        }
      }

      const bbox = findContentBoundingBox(data, w, h);
      expect(bbox).not.toBeNull();
      expect(bbox?.minX).toBe(3);
      expect(bbox?.maxX).toBe(4);
      expect(bbox?.minY).toBe(3);
      expect(bbox?.maxY).toBe(4);
      expect(bbox?.width).toBe(2);
      expect(bbox?.height).toBe(2);
    });

    it("treats light gray or near-white background as whitespace", () => {
      const w = 8;
      const h = 8;
      const data = new Uint8ClampedArray(w * h * 4);
      // Fill with near-white light gray background (236, 237, 238)
      for (let i = 0; i < w * h; i++) {
        data[i * 4 + 0] = 236;
        data[i * 4 + 1] = 237;
        data[i * 4 + 2] = 238;
        data[i * 4 + 3] = 255;
      }

      // Draw component in center 2x2: (3,3) to (4,4)
      for (let y = 3; y <= 4; y++) {
        for (let x = 3; x <= 4; x++) {
          const idx = (y * w + x) * 4;
          data[idx] = 50;
          data[idx + 1] = 50;
          data[idx + 2] = 50;
          data[idx + 3] = 255;
        }
      }

      const bbox = findContentBoundingBox(data, w, h);
      expect(bbox).not.toBeNull();
      expect(bbox?.minX).toBe(3);
      expect(bbox?.maxX).toBe(4);
      expect(bbox?.minY).toBe(3);
      expect(bbox?.maxY).toBe(4);
      expect(bbox?.width).toBe(2);
      expect(bbox?.height).toBe(2);
    });

    it("returns null when image is pure white or transparent", () => {
      const w = 5;
      const h = 5;
      const whiteData = new Uint8ClampedArray(w * h * 4);
      whiteData.fill(255); // all white

      const bboxWhite = findContentBoundingBox(whiteData, w, h, 235, 10);
      expect(bboxWhite).toBeNull();

      const transparentData = new Uint8ClampedArray(w * h * 4);
      // All 0s (transparent alpha)
      const bboxTrans = findContentBoundingBox(transparentData, w, h, 235, 10);
      expect(bboxTrans).toBeNull();
    });

    it("detects content in inverted polarity mode (bright lines on dark background)", () => {
      const w = 6;
      const h = 6;
      const data = new Uint8ClampedArray(w * h * 4);
      // Background is black with full alpha
      for (let i = 0; i < w * h; i++) {
        data[i * 4 + 0] = 10;
        data[i * 4 + 1] = 10;
        data[i * 4 + 2] = 10;
        data[i * 4 + 3] = 255;
      }

      // Bright line at (2, 2) to (4, 4)
      for (let i = 2; i <= 4; i++) {
        const idx = (i * w + i) * 4;
        data[idx] = 250;
        data[idx + 1] = 250;
        data[idx + 2] = 250;
      }

      const bbox = findContentBoundingBox(data, w, h, 128, 10, true);
      expect(bbox).not.toBeNull();
      expect(bbox?.minX).toBe(2);
      expect(bbox?.maxX).toBe(4);
      expect(bbox?.minY).toBe(2);
      expect(bbox?.maxY).toBe(4);
    });
  });
});
