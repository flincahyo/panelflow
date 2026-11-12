import { getCadScaleFactorToMm } from "@/lib/units";
import type { CadImportUnit } from "@/types/panel";

export interface DxfSegment {
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
}

export interface ParsedDxfGeometry {
  segments: DxfSegment[];
  boundingBoxMm: { w: number; h: number; d: number };
  centerOffsetMm: { x: number; y: number; z: number };
}

export function parseDxfToMmSegments(
  dxfText: string,
  sourceUnit: CadImportUnit
): ParsedDxfGeometry {
  const scale = getCadScaleFactorToMm(sourceUnit);
  const rawLines = dxfText.split(/\r?\n/).map((l) => l.trim());
  const segments: DxfSegment[] = [];

  let i = 0;
  let inEntities = false;

  const readPair = (): [number, string] | null => {
    if (i + 1 >= rawLines.length) return null;
    const code = Number.parseInt(rawLines[i], 10);
    const value = rawLines[i + 1];
    i += 2;
    return [code, value];
  };

  while (i + 1 < rawLines.length) {
    const pair = readPair();
    if (!pair) break;
    const [code, val] = pair;

    if (code === 2 && val === "ENTITIES") {
      inEntities = true;
      continue;
    }
    if (inEntities && code === 0 && val === "ENDSEC") {
      break;
    }
    if (!inEntities) continue;

    if (code === 0 && val === "LINE") {
      let x1 = 0,
        y1 = 0,
        z1 = 0,
        x2 = 0,
        y2 = 0,
        z2 = 0;
      while (i + 1 < rawLines.length) {
        const nextCode = Number.parseInt(rawLines[i], 10);
        if (nextCode === 0) break;
        const p = readPair();
        if (!p) break;
        const [c, v] = p;
        const num = Number.parseFloat(v) || 0;
        if (c === 10) x1 = num * scale;
        else if (c === 20) y1 = num * scale;
        else if (c === 30) z1 = num * scale;
        else if (c === 11) x2 = num * scale;
        else if (c === 21) y2 = num * scale;
        else if (c === 31) z2 = num * scale;
      }
      segments.push({ x1, y1, z1, x2, y2, z2 });
    } else if (code === 0 && val === "CIRCLE") {
      let cx = 0,
        cy = 0,
        cz = 0,
        r = 0;
      while (i + 1 < rawLines.length) {
        const nextCode = Number.parseInt(rawLines[i], 10);
        if (nextCode === 0) break;
        const p = readPair();
        if (!p) break;
        const [c, v] = p;
        const num = Number.parseFloat(v) || 0;
        if (c === 10) cx = num * scale;
        else if (c === 20) cy = num * scale;
        else if (c === 30) cz = num * scale;
        else if (c === 40) r = num * scale;
      }
      const steps = 24;
      for (let s = 0; s < steps; s++) {
        const a1 = (s / steps) * Math.PI * 2;
        const a2 = ((s + 1) / steps) * Math.PI * 2;
        segments.push({
          x1: cx + Math.cos(a1) * r,
          y1: cy + Math.sin(a1) * r,
          z1: cz,
          x2: cx + Math.cos(a2) * r,
          y2: cy + Math.sin(a2) * r,
          z2: cz,
        });
      }
    } else if (code === 0 && val === "LWPOLYLINE") {
      const pts: Array<{ x: number; y: number }> = [];
      let closed = false;
      let curX: number | null = null;
      while (i + 1 < rawLines.length) {
        const nextCode = Number.parseInt(rawLines[i], 10);
        if (nextCode === 0) break;
        const p = readPair();
        if (!p) break;
        const [c, v] = p;
        if (c === 70) closed = (Number.parseInt(v, 10) & 1) === 1;
        else if (c === 10) curX = (Number.parseFloat(v) || 0) * scale;
        else if (c === 20 && curX !== null) {
          pts.push({ x: curX, y: (Number.parseFloat(v) || 0) * scale });
          curX = null;
        }
      }
      for (let k = 0; k < pts.length - 1; k++) {
        segments.push({
          x1: pts[k].x,
          y1: pts[k].y,
          z1: 0,
          x2: pts[k + 1].x,
          y2: pts[k + 1].y,
          z2: 0,
        });
      }
      if (closed && pts.length > 2) {
        segments.push({
          x1: pts[pts.length - 1].x,
          y1: pts[pts.length - 1].y,
          z1: 0,
          x2: pts[0].x,
          y2: pts[0].y,
          z2: 0,
        });
      }
    }
  }

  if (segments.length === 0) {
    return {
      segments: [],
      boundingBoxMm: { w: 40, h: 40, d: 10 },
      centerOffsetMm: { x: 0, y: 0, z: 0 },
    };
  }

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (const s of segments) {
    minX = Math.min(minX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2);
    minZ = Math.min(minZ, s.z1, s.z2);
    maxX = Math.max(maxX, s.x1, s.x2);
    maxY = Math.max(maxY, s.y1, s.y2);
    maxZ = Math.max(maxZ, s.z1, s.z2);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  // Normalize segments around origin (0,0,0)
  const centered = segments.map((s) => ({
    x1: s.x1 - cx,
    y1: s.y1 - cy,
    z1: s.z1 - cz,
    x2: s.x2 - cx,
    y2: s.y2 - cy,
    z2: s.z2 - cz,
  }));

  return {
    segments: centered,
    boundingBoxMm: {
      w: Math.max(1, Number((maxX - minX).toFixed(2))),
      h: Math.max(1, Number((maxY - minY).toFixed(2))),
      d: Math.max(1, Number((maxZ - minZ).toFixed(2))),
    },
    centerOffsetMm: { x: cx, y: cy, z: cz },
  };
}
