import type { DxfSegment } from "./dxf-parser";

export interface Point2D {
  x: number;
  y: number;
}

export interface ImageToCadOptions {
  widthMm: number;
  heightMm: number;
  depthMm?: number;
  threshold?: number; // 0 - 255 (default 128)
  invert?: boolean; // false = dark on light, true = light on dark
  toleranceMm?: number; // Douglas-Peucker epsilon in mm (default ~0.3mm)
  minContourPoints?: number; // Filter noise
  addOuterFrame?: boolean; // Include bounding border segments
}

export interface ImageToCadResult {
  segments: DxfSegment[];
  dxfText: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  dataUrl?: string;
  imageOverlayUrl?: string;
  contourCount: number;
}

export interface ContentBoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface TrimResult {
  dataUrl: string;
  originalWidth: number;
  originalHeight: number;
  trimmedWidth: number;
  trimmedHeight: number;
  aspectRatio: number;
  boundingBox: ContentBoundingBox;
}

export interface ComponentDimensionPreset {
  id: string;
  label: string;
  name: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
}

export const STANDARD_COMPONENT_PRESETS: ComponentDimensionPreset[] = [
  { id: "contactor", label: "Contactor (45×77mm)", name: "Contactor", widthMm: 45, heightMm: 77, depthMm: 86 },
  { id: "overload", label: "Overload Relay (45×66mm)", name: "Overload Relay", widthMm: 45, heightMm: 66, depthMm: 70 },
  { id: "mcb-1p", label: "MCB 1P (18×85mm)", name: "MCB 1P", widthMm: 18, heightMm: 85, depthMm: 70 },
  { id: "mcb-3p", label: "MCB 3P (54×85mm)", name: "MCB 3P", widthMm: 54, heightMm: 85, depthMm: 70 },
  { id: "psu-24v", label: "Power Supply 24V (72×125mm)", name: "Power Supply 24V", widthMm: 72, heightMm: 125, depthMm: 100 },
  { id: "terminal-block", label: "Terminal Block (6×50mm)", name: "Terminal Block", widthMm: 6, heightMm: 50, depthMm: 45 },
  { id: "panel-meter", label: "Panel Meter (96×96mm)", name: "Panel Meter", widthMm: 96, heightMm: 96, depthMm: 65 },
];

/**
 * Calculate aspect ratio (width / height).
 */
export function calculateAspectRatio(width: number, height: number): number {
  if (height <= 0 || width <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
    return 1;
  }
  return width / height;
}

/**
 * Calculate height from width keeping aspect ratio.
 */
export function calculateHeightFromWidth(widthMm: number, aspectRatio: number): number {
  if (aspectRatio <= 0 || !Number.isFinite(aspectRatio)) return Math.max(1, Math.round(widthMm));
  return Math.max(1, Math.round(widthMm / aspectRatio));
}

/**
 * Calculate width from height keeping aspect ratio.
 */
export function calculateWidthFromHeight(heightMm: number, aspectRatio: number): number {
  if (aspectRatio <= 0 || !Number.isFinite(aspectRatio)) return Math.max(1, Math.round(heightMm));
  return Math.max(1, Math.round(heightMm * aspectRatio));
}

/**
 * Find bounding box of non-white / non-transparent content in RGBA ImageData.
 * Uses corner background color distance sampling and brightness/luminance thresholds
 * to remove white backgrounds, faint gradients, and jpeg shadow artifacts.
 */
export function findContentBoundingBox(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  brightnessThreshold = 220,
  alphaThreshold = 10,
  invert = false,
  colorTolerance = 30
): ContentBoundingBox | null {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) {
    return null;
  }

  // Sample 4 corner regions (up to 5x5 box each corner) to estimate background color
  const sampleCornerColors = (): { r: number; g: number; b: number }[] => {
    const corners: { r: number; g: number; b: number }[] = [];
    const sampleSize = Math.max(1, Math.min(5, Math.floor(Math.min(width, height) / 4)));

    const cornerStarts = [
      { startX: 0, startY: 0 }, // Top-left
      { startX: Math.max(0, width - sampleSize), startY: 0 }, // Top-right
      { startX: 0, startY: Math.max(0, height - sampleSize) }, // Bottom-left
      { startX: Math.max(0, width - sampleSize), startY: Math.max(0, height - sampleSize) }, // Bottom-right
    ];

    for (const { startX, startY } of cornerStarts) {
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let cy = 0; cy < sampleSize; cy++) {
        for (let cx = 0; cx < sampleSize; cx++) {
          const px = startX + cx;
          const py = startY + cy;
          if (px < width && py < height) {
            const idx = (py * width + px) * 4;
            if (data[idx + 3] > alphaThreshold) {
              rSum += data[idx];
              gSum += data[idx + 1];
              bSum += data[idx + 2];
              count++;
            }
          }
        }
      }
      if (count > 0) {
        corners.push({
          r: rSum / count,
          g: gSum / count,
          b: bSum / count,
        });
      }
    }
    return corners;
  };

  const cornerSamples = sampleCornerColors();

  // Color distance helper (Euclidean in RGB)
  const isCloseToCornerBg = (r: number, g: number, b: number, tol: number): boolean => {
    for (const c of cornerSamples) {
      // If corner sample is bright (typical white/gray paper background)
      const cLum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
      if (cLum >= 180) {
        const dr = r - c.r;
        const dg = g - c.g;
        const db = b - c.b;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist <= tol) return true;
      }
    }
    return false;
  };

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a > alphaThreshold) {
        if (invert) {
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum >= brightnessThreshold) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        } else {
          // Standard dark-content on white/light background:
          // Background if:
          // 1. Matches / within color distance of bright corner background samples
          // 2. Or pure white / broken-white (r,g,b >= brightnessThreshold)
          // 3. Or luminance >= brightnessThreshold
          // 4. Or high luminance with low saturation (faint shadow)
          const maxChannel = Math.max(r, g, b);
          const minChannel = Math.min(r, g, b);
          const diff = maxChannel - minChannel;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // Euclidean color distance to sampled background
          // Calculate distance to nearest corner background sample
          let minCornerDist = 999;
          for (const c of cornerSamples) {
            const dist = Math.hypot(r - c.r, g - c.g, b - c.b);
            if (dist < minCornerDist) minCornerDist = dist;
          }

          const isNearCorner = minCornerDist <= colorTolerance;
          const isBackground =
            (r >= brightnessThreshold && g >= brightnessThreshold && b >= brightnessThreshold) ||
            lum >= brightnessThreshold ||
            (lum > 175 && isNearCorner) ||
            (lum > 195 && diff < 30);

          if (!isBackground) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Trim whitespace margin from an image so dimensions scale strictly to the component body.
 */
export function trimImageWhitespace(
  img: HTMLImageElement,
  options?: {
    brightnessThreshold?: number;
    alphaThreshold?: number;
    padding?: number;
    invert?: boolean;
    cropMarginsPercent?: { top: number; right: number; bottom: number; left: number };
    colorTolerance?: number;
    cropMarginsMm?: { top: number; right: number; bottom: number; left: number };
    widthMm?: number;
    heightMm?: number;
  }
): TrimResult | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const {
    brightnessThreshold = 220,
    alphaThreshold = 15,
    padding = 0,
    invert = false,
    cropMarginsPercent,
    cropMarginsMm,
    widthMm,
    heightMm,
    colorTolerance = 30,
  } = options || {};

  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;
  if (!origW || !origH) return null;

  const canvas = document.createElement("canvas");
  canvas.width = origW;
  canvas.height = origH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, origW, origH);
  const imgData = ctx.getImageData(0, 0, origW, origH);
  const bbox = findContentBoundingBox(
    imgData.data,
    origW,
    origH,
    brightnessThreshold,
    alphaThreshold,
    invert,
    colorTolerance
  );

  let minX = 0;
  let minY = 0;
  let maxX = origW - 1;
  let maxY = origH - 1;

  if (bbox) {
    minX = Math.max(0, bbox.minX - padding);
    minY = Math.max(0, bbox.minY - padding);
    maxX = Math.min(origW - 1, bbox.maxX + padding);
    maxY = Math.min(origH - 1, bbox.maxY + padding);
  }

  // Apply manual crop margins (percentage or mm of bounding box)
  if (cropMarginsMm && widthMm && heightMm && widthMm > 0 && heightMm > 0) {
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const extraLeft = Math.round((boxW * Math.max(0, cropMarginsMm.left || 0)) / widthMm);
    const extraRight = Math.round((boxW * Math.max(0, cropMarginsMm.right || 0)) / widthMm);
    const extraTop = Math.round((boxH * Math.max(0, cropMarginsMm.top || 0)) / heightMm);
    const extraBottom = Math.round((boxH * Math.max(0, cropMarginsMm.bottom || 0)) / heightMm);

    minX = Math.min(maxX, minX + extraLeft);
    maxX = Math.max(minX, maxX - extraRight);
    minY = Math.min(maxY, minY + extraTop);
    maxY = Math.max(minY, maxY - extraBottom);
  } else if (cropMarginsPercent) {
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const extraLeft = Math.round((boxW * (cropMarginsPercent.left || 0)) / 100);
    const extraRight = Math.round((boxW * (cropMarginsPercent.right || 0)) / 100);
    const extraTop = Math.round((boxH * (cropMarginsPercent.top || 0)) / 100);
    const extraBottom = Math.round((boxH * (cropMarginsPercent.bottom || 0)) / 100);

    minX = Math.min(maxX, minX + extraLeft);
    maxX = Math.max(minX, maxX - extraRight);
    minY = Math.min(maxY, minY + extraTop);
    maxY = Math.max(minY, maxY - extraBottom);
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  if (cropW <= 0 || cropH <= 0) return null;

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = cropW;
  croppedCanvas.height = cropH;
  const croppedCtx = croppedCanvas.getContext("2d");
  if (!croppedCtx) return null;

  croppedCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  return {
    dataUrl: croppedCanvas.toDataURL("image/png"),
    originalWidth: origW,
    originalHeight: origH,
    trimmedWidth: cropW,
    trimmedHeight: cropH,
    aspectRatio: cropW / cropH,
    boundingBox: bbox || { minX, minY, maxX, maxY, width: cropW, height: cropH },
  };
}

/**
 * Perpendicular distance from point P to line segment (A, B).
 */
export function perpendicularDistance(
  p: Point2D,
  a: Point2D,
  b: Point2D
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    const px = p.x - a.x;
    const py = p.y - a.y;
    return Math.sqrt(px * px + py * py);
  }

  const num = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x);
  return num / Math.sqrt(lengthSq);
}

/**
 * Douglas-Peucker polyline simplification.
 */
export function simplifyDouglasPeucker(
  points: Point2D[],
  epsilon: number
): Point2D[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const last = points.length - 1;

  for (let i = 1; i < last; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[last]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyDouglasPeucker(points.slice(0, index + 1), epsilon);
    const right = simplifyDouglasPeucker(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  }

  return [points[0], points[last]];
}

/**
 * Scale and center pixel points to target mm (origin 0,0 at center).
 * Image pixel coordinate: (0,0) is top-left, x right, y down.
 * CAD mm coordinate: centered at (0,0), x right, y up.
 */
export function pixelPointsToMmSegments(
  polylines: Point2D[][],
  imgWidth: number,
  imgHeight: number,
  widthMm: number,
  heightMm: number,
  toleranceMm = 0.3
): DxfSegment[] {
  if (imgWidth <= 0 || imgHeight <= 0 || widthMm <= 0 || heightMm <= 0) {
    return [];
  }

  const scaleX = widthMm / imgWidth;
  const scaleY = heightMm / imgHeight;

  const segments: DxfSegment[] = [];

  for (const poly of polylines) {
    if (poly.length < 2) continue;

    // Convert to mm first (origin at center)
    const mmPoly: Point2D[] = poly.map((pt) => ({
      x: Number(((pt.x - imgWidth / 2) * scaleX).toFixed(3)),
      y: Number(((imgHeight / 2 - pt.y) * scaleY).toFixed(3)),
    }));

    const simplified = simplifyDouglasPeucker(mmPoly, toleranceMm);
    if (simplified.length < 2) continue;

    for (let i = 0; i < simplified.length - 1; i++) {
      const p1 = simplified[i];
      const p2 = simplified[i + 1];
      if (Math.abs(p1.x - p2.x) < 0.01 && Math.abs(p1.y - p2.y) < 0.01) {
        continue;
      }
      segments.push({
        x1: p1.x,
        y1: p1.y,
        z1: 0,
        x2: p2.x,
        y2: p2.y,
        z2: 0,
      });
    }
  }

  return segments;
}

/**
 * Generate standard DXF R12 text format from DxfSegment[].
 * Units: Millimeters ($INSUNITS=4).
 */
export function generateDxfFromSegments(
  segments: DxfSegment[],
  widthMm?: number,
  heightMm?: number
): string {
  const lines: string[] = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1009", // DXF R12
    "9",
    "$INSUNITS",
    "70",
    "4", // 4 = Millimeters
  ];

  if (widthMm && heightMm) {
    const halfW = (widthMm / 2).toFixed(3);
    const halfH = (heightMm / 2).toFixed(3);
    lines.push(
      "9",
      "$EXTMIN",
      "10",
      `-${halfW}`,
      "20",
      `-${halfH}`,
      "30",
      "0.0",
      "9",
      "$EXTMAX",
      "10",
      `${halfW}`,
      "20",
      `${halfH}`,
      "30",
      "0.0"
    );
  }

  lines.push(
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "TABLES",
    "0",
    "TABLE",
    "2",
    "LAYER",
    "70",
    "1",
    "0",
    "LAYER",
    "2",
    "PANELFLOW_OUTLINE",
    "70",
    "0",
    "62",
    "7", // white/black
    "6",
    "CONTINUOUS",
    "0",
    "ENDTAB",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES"
  );

  for (const s of segments) {
    lines.push(
      "0",
      "LINE",
      "8",
      "PANELFLOW_OUTLINE",
      "10",
      s.x1.toFixed(3),
      "20",
      s.y1.toFixed(3),
      "30",
      s.z1.toFixed(3),
      "11",
      s.x2.toFixed(3),
      "21",
      s.y2.toFixed(3),
      "31",
      s.z2.toFixed(3)
    );
  }

  lines.push("0", "ENDSEC", "0", "EOF", "");
  return lines.join("\n");
}

/**
 * Extract binary contour polylines from 1D binary pixel array.
 * Uses a robust scanline + Moore-neighbor boundary follower algorithm.
 */
export function extractContoursFromBinaryMask(
  mask: Uint8Array,
  width: number,
  height: number,
  minContourPoints = 6
): Point2D[][] {
  const visited = new Uint8Array(width * height);
  const contours: Point2D[][] = [];

  // Moore-neighbor 8-connected offsets (clockwise starting from North)
  const dx = [0, 1, 1, 1, 0, -1, -1, -1];
  const dy = [-1, -1, 0, 1, 1, 1, 0, -1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // Start tracing if pixel is foreground and not yet visited
      if (mask[idx] === 1 && visited[idx] === 0) {
        // Must be an edge pixel: adjacent to at least one background pixel
        let isEdge = false;
        for (let d = 0; d < 8; d++) {
          const nx = x + dx[d];
          const ny = y + dy[d];
          if (mask[ny * width + nx] === 0) {
            isEdge = true;
            break;
          }
        }

        if (!isEdge) {
          visited[idx] = 1;
          continue;
        }

        // Trace Moore neighborhood
        const contour: Point2D[] = [{ x, y }];
        visited[idx] = 1;

        let currX = x;
        let currY = y;
        let backtrackDir = 0;
        const maxSteps = width * height;
        let step = 0;

        while (step++ < maxSteps) {
          let foundNext = false;
          // Search clockwise from backtrackDir
          for (let i = 0; i < 8; i++) {
            const dir = (backtrackDir + i) % 8;
            const nx = currX + dx[dir];
            const ny = currY + dy[dir];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (mask[ny * width + nx] === 1) {
                currX = nx;
                currY = ny;
                visited[ny * width + nx] = 1;
                contour.push({ x: currX, y: currY });
                // Backtrack direction enters from opposite side
                backtrackDir = (dir + 5) % 8;
                foundNext = true;
                break;
              }
            }
          }

          if (!foundNext) break;
          // Completed cycle back to start
          if (currX === x && currY === y && contour.length > 2) {
            break;
          }
        }

        if (contour.length >= minContourPoints) {
          contours.push(contour);
        }
      }
    }
  }

  return contours;
}

/**
 * Threshold RGBA ImageData into a 1-bit binary mask (1 = foreground stroke/edge, 0 = background).
 */
export function binarizeImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 128,
  invert = false
): Uint8Array {
  const total = width * height;
  const mask = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    // Transparent pixels are background
    if (a < 64) {
      mask[i] = 0;
      continue;
    }

    // Grayscale luminance (Rec. 601)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Normal mode: dark drawing lines on bright background -> lum < threshold is foreground
    // Invert mode: bright lines on dark background -> lum >= threshold is foreground
    if (!invert) {
      mask[i] = lum < threshold ? 1 : 0;
    } else {
      mask[i] = lum >= threshold ? 1 : 0;
    }
  }

  return mask;
}

/**
 * Pure client-side browser helper: Load image, trace to DXF segments and DXF text.
 */
export async function vectorizeImage(
  imageSource: File | Blob | string,
  options: ImageToCadOptions
): Promise<ImageToCadResult> {
  const {
    widthMm,
    heightMm,
    depthMm = 70,
    threshold = 128,
    invert = false,
    toleranceMm = 0.35,
    minContourPoints = 6,
    addOuterFrame = false,
  } = options;

  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("vectorizeImage requires a browser DOM environment");
  }

  // Load image element
  const img = new Image();
  let objectUrlToRevoke: string | null = null;
  let dataUrl: string | undefined;

  if (typeof imageSource === "string") {
    img.src = imageSource;
    if (imageSource.startsWith("data:")) {
      dataUrl = imageSource;
    }
  } else {
    objectUrlToRevoke = URL.createObjectURL(imageSource);
    img.src = objectUrlToRevoke;
  }

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image for vectorization"));
  });

  const canvas = document.createElement("canvas");
  // Downscale slightly if image is enormous (> 1600px) to keep trace fast & clean
  const maxDim = 1200;
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    throw new Error("Unable to acquire 2D canvas rendering context");
  }

  ctx.drawImage(img, 0, 0, w, h);

  if (!dataUrl) {
    dataUrl = canvas.toDataURL("image/png");
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);

  const mask = binarizeImageData(imgData.data, w, h, threshold, invert);
  const contours = extractContoursFromBinaryMask(mask, w, h, minContourPoints);
  const segments = pixelPointsToMmSegments(
    contours,
    w,
    h,
    widthMm,
    heightMm,
    toleranceMm
  );

  if (addOuterFrame) {
    const hw = Number((widthMm / 2).toFixed(3));
    const hh = Number((heightMm / 2).toFixed(3));
    segments.unshift(
      { x1: -hw, y1: -hh, z1: 0, x2: hw, y2: -hh, z2: 0 },
      { x1: hw, y1: -hh, z1: 0, x2: hw, y2: hh, z2: 0 },
      { x1: hw, y1: hh, z1: 0, x2: -hw, y2: hh, z2: 0 },
      { x1: -hw, y1: hh, z1: 0, x2: -hw, y2: -hh, z2: 0 }
    );
  }

  const dxfText = generateDxfFromSegments(segments, widthMm, heightMm);

  return {
    segments,
    dxfText,
    widthMm,
    heightMm,
    depthMm,
    dataUrl,
    imageOverlayUrl: dataUrl,
    contourCount: contours.length,
  };
}
