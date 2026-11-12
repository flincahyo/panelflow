import { parseDxfToMmSegments, type DxfSegment } from "./dxf-parser";
import type { CadFormat, CadImportUnit, PinTerminal } from "@/types/panel";

export interface PreviewSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PreviewPin {
  id: string;
  label: string;
  x: number;
  y: number;
}

export type CadPreviewData =
  | {
      type: "wireframe";
      viewBox: string;
      segments: PreviewSegment[];
      pins: PreviewPin[];
    }
  | {
      type: "silhouette";
      viewBox: string;
      aspectRatio: number; // width / height
      w: number;
      h: number;
      d: number;
      pins: PreviewPin[];
    };

/**
 * Fast simple parser for OBJ raw text wireframes.
 * Extracts vertices and face/line edges projected onto XY plane.
 */
export function parseObjWireframe(objText: string): PreviewSegment[] {
  const lines = objText.split(/\r?\n/);
  const vertices: Array<{ x: number; y: number }> = [];
  const segments: PreviewSegment[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("v ")) {
      const parts = trimmed.split(/\s+/).slice(1);
      const x = Number.parseFloat(parts[0]) || 0;
      const y = Number.parseFloat(parts[1]) || 0;
      vertices.push({ x, y });
    } else if (trimmed.startsWith("f ") || trimmed.startsWith("l ")) {
      const parts = trimmed.split(/\s+/).slice(1);
      const idxs: number[] = [];
      for (const p of parts) {
        const vIdxStr = p.split("/")[0];
        const vIdx = Number.parseInt(vIdxStr, 10);
        if (!Number.isNaN(vIdx)) {
          // OBJ indices are 1-based or negative relative
          const actual = vIdx > 0 ? vIdx - 1 : vertices.length + vIdx;
          if (actual >= 0 && actual < vertices.length) {
            idxs.push(actual);
          }
        }
      }

      if (idxs.length >= 2) {
        for (let i = 0; i < idxs.length - 1; i++) {
          segments.push({
            x1: vertices[idxs[i]].x,
            y1: vertices[idxs[i]].y,
            x2: vertices[idxs[i + 1]].x,
            y2: vertices[idxs[i + 1]].y,
          });
        }
        // close loop for polygon face
        if (trimmed.startsWith("f ") && idxs.length > 2) {
          segments.push({
            x1: vertices[idxs[idxs.length - 1]].x,
            y1: vertices[idxs[idxs.length - 1]].y,
            x2: vertices[idxs[0]].x,
            y2: vertices[idxs[0]].y,
          });
        }
      }
    }
  }

  return segments;
}

export function getCadPreviewSvgData(input: {
  format: CadFormat;
  rawText?: string;
  sourceUnit?: CadImportUnit;
  boundingBoxMm: { w: number; h: number; d: number };
  pins?: PinTerminal[];
}): CadPreviewData {
  const { format, rawText, sourceUnit = "mm", boundingBoxMm, pins = [] } = input;

  const previewPins: PreviewPin[] = pins.map((p) => ({
    id: p.id,
    label: p.label,
    x: p.localXMm,
    // world Y is up, SVG Y is down
    y: -p.localYMm,
  }));

  // 1. DXF Wireframe
  if (format === "dxf" && rawText) {
    try {
      const parsed = parseDxfToMmSegments(rawText, sourceUnit);
      if (parsed.segments.length > 0) {
        // Find 2D projection bounds (XY)
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        // Note: DXF parser centers segments around (0,0,0).
        // In SVG coordinates, Y increases downwards, so we flip y: ySvg = -y
        const segs: PreviewSegment[] = parsed.segments.map((s) => {
          const sy1 = -s.y1;
          const sy2 = -s.y2;
          minX = Math.min(minX, s.x1, s.x2);
          maxX = Math.max(maxX, s.x1, s.x2);
          minY = Math.min(minY, sy1, sy2);
          maxY = Math.max(maxY, sy1, sy2);
          return {
            x1: s.x1,
            y1: sy1,
            x2: s.x2,
            y2: sy2,
          };
        });

        // Also check pins in bounds
        for (const pin of previewPins) {
          minX = Math.min(minX, pin.x);
          maxX = Math.max(maxX, pin.x);
          minY = Math.min(minY, pin.y);
          maxY = Math.max(maxY, pin.y);
        }

        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        const padX = width * 0.08;
        const padY = height * 0.08;

        return {
          type: "wireframe",
          viewBox: `${minX - padX} ${minY - padY} ${width + padX * 2} ${height + padY * 2}`,
          segments: segs,
          pins: previewPins,
        };
      }
    } catch {
      // fallback
    }
  }

  // 2. OBJ Wireframe
  if (format === "obj" && rawText) {
    try {
      const parsedSegs = parseObjWireframe(rawText);
      if (parsedSegs.length > 0) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        const segs: PreviewSegment[] = parsedSegs.map((s) => {
          const sy1 = -s.y1;
          const sy2 = -s.y2;
          minX = Math.min(minX, s.x1, s.x2);
          maxX = Math.max(maxX, s.x1, s.x2);
          minY = Math.min(minY, sy1, sy2);
          maxY = Math.max(maxY, sy1, sy2);
          return {
            x1: s.x1,
            y1: sy1,
            x2: s.x2,
            y2: sy2,
          };
        });

        for (const pin of previewPins) {
          minX = Math.min(minX, pin.x);
          maxX = Math.max(maxX, pin.x);
          minY = Math.min(minY, pin.y);
          maxY = Math.max(maxY, pin.y);
        }

        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        const padX = width * 0.08;
        const padY = height * 0.08;

        return {
          type: "wireframe",
          viewBox: `${minX - padX} ${minY - padY} ${width + padX * 2} ${height + padY * 2}`,
          segments: segs,
          pins: previewPins,
        };
      }
    } catch {
      // fallback
    }
  }

  // 3. Fallback: Proportional Isometric/Orthographic 3D Box Silhouette (GLB/GLTF or fallback)
  const w = Math.max(10, boundingBoxMm.w || 50);
  const h = Math.max(10, boundingBoxMm.h || 50);
  const d = Math.max(5, boundingBoxMm.d || 20);

  return {
    type: "silhouette",
    viewBox: `0 0 ${w} ${h}`,
    aspectRatio: w / h,
    w,
    h,
    d,
    pins: previewPins,
  };
}
