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
  entityCount: number;
  warning?: string;
}

type DxfPair = [number, string];

interface DxfBlock {
  baseX: number;
  baseY: number;
  baseZ: number;
  entities: DxfPair[][];
}

function evaluateBSpline(
  degree: number,
  knots: number[],
  ctrlPts: Array<{ x: number; y: number; z: number }>,
  t: number
): { x: number; y: number; z: number } {
  const n = ctrlPts.length - 1;
  const p = Math.min(degree, n);

  // Clamp t into valid domain
  const tMin = knots[p];
  const tMax = knots[n + 1];
  const u = Math.max(tMin, Math.min(tMax, t));

  // Find knot span k
  let k = p;
  if (u >= tMax) {
    k = n;
  } else {
    for (let idx = p; idx <= n; idx++) {
      if (u >= knots[idx] && u < knots[idx + 1]) {
        k = idx;
        break;
      }
    }
  }

  const d = [];
  for (let j = 0; j <= p; j++) {
    const pt = ctrlPts[Math.max(0, Math.min(n, k - p + j))];
    d.push({ x: pt.x, y: pt.y, z: pt.z });
  }

  for (let r = 1; r <= p; r++) {
    for (let j = p; j >= r; j--) {
      const denom = knots[j + 1 + k - r] - knots[j + k - p];
      const alpha = denom > 1e-9 ? (u - knots[j + k - p]) / denom : 0;
      d[j] = {
        x: (1 - alpha) * d[j - 1].x + alpha * d[j].x,
        y: (1 - alpha) * d[j - 1].y + alpha * d[j].y,
        z: (1 - alpha) * d[j - 1].z + alpha * d[j].z,
      };
    }
  }

  return d[p];
}

function parseSingleEntity(
  pairs: DxfPair[],
  blocks: Record<string, DxfBlock>,
  depth = 0
): { segments: DxfSegment[]; count: number } {
  if (pairs.length === 0) return { segments: [], count: 0 };
  const entityType = pairs[0][1].toUpperCase();
  const segments: DxfSegment[] = [];

  if (entityType === "LINE") {
    let x1 = 0,
      y1 = 0,
      z1 = 0,
      x2 = 0,
      y2 = 0,
      z2 = 0;
    for (let k = 1; k < pairs.length; k++) {
      const [c, v] = pairs[k];
      const num = Number.parseFloat(v) || 0;
      if (c === 10) x1 = num;
      else if (c === 20) y1 = num;
      else if (c === 30) z1 = num;
      else if (c === 11) x2 = num;
      else if (c === 21) y2 = num;
      else if (c === 31) z2 = num;
    }
    segments.push({ x1, y1, z1, x2, y2, z2 });
    return { segments, count: 1 };
  }

  if (entityType === "CIRCLE") {
    let cx = 0,
      cy = 0,
      cz = 0,
      r = 0;
    for (let k = 1; k < pairs.length; k++) {
      const [c, v] = pairs[k];
      const num = Number.parseFloat(v) || 0;
      if (c === 10) cx = num;
      else if (c === 20) cy = num;
      else if (c === 30) cz = num;
      else if (c === 40) r = num;
    }
    if (r > 0) {
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
    }
    return { segments, count: 1 };
  }

  if (entityType === "ARC") {
    let cx = 0,
      cy = 0,
      cz = 0,
      r = 0,
      startDeg = 0,
      endDeg = 360;
    for (let k = 1; k < pairs.length; k++) {
      const [c, v] = pairs[k];
      const num = Number.parseFloat(v) || 0;
      if (c === 10) cx = num;
      else if (c === 20) cy = num;
      else if (c === 30) cz = num;
      else if (c === 40) r = num;
      else if (c === 50) startDeg = num;
      else if (c === 51) endDeg = num;
    }
    if (r > 0) {
      let sweep = endDeg - startDeg;
      if (sweep <= 0) sweep += 360;
      const steps = Math.max(6, Math.ceil((sweep / 360) * 32));
      const startRad = (startDeg * Math.PI) / 180;
      const sweepRad = (sweep * Math.PI) / 180;
      for (let s = 0; s < steps; s++) {
        const a1 = startRad + (s / steps) * sweepRad;
        const a2 = startRad + ((s + 1) / steps) * sweepRad;
        segments.push({
          x1: cx + Math.cos(a1) * r,
          y1: cy + Math.sin(a1) * r,
          z1: cz,
          x2: cx + Math.cos(a2) * r,
          y2: cy + Math.sin(a2) * r,
          z2: cz,
        });
      }
    }
    return { segments, count: 1 };
  }

  if (entityType === "LWPOLYLINE") {
    const pts: Array<{ x: number; y: number }> = [];
    let closed = false;
    let curX: number | null = null;
    for (let k = 1; k < pairs.length; k++) {
      const [c, v] = pairs[k];
      if (c === 70) closed = (Number.parseInt(v, 10) & 1) === 1;
      else if (c === 10) curX = Number.parseFloat(v) || 0;
      else if (c === 20 && curX !== null) {
        pts.push({ x: curX, y: Number.parseFloat(v) || 0 });
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
    return { segments, count: 1 };
  }

  if (entityType === "ELLIPSE") {
    let cx = 0,
      cy = 0,
      cz = 0,
      mx = 1,
      my = 0,
      mz = 0,
      ratio = 1,
      startParam = 0,
      endParam = Math.PI * 2;
    for (let k = 1; k < pairs.length; k++) {
      const [c, v] = pairs[k];
      const num = Number.parseFloat(v) || 0;
      if (c === 10) cx = num;
      else if (c === 20) cy = num;
      else if (c === 30) cz = num;
      else if (c === 11) mx = num;
      else if (c === 21) my = num;
      else if (c === 31) mz = num;
      else if (c === 40) ratio = num || 1;
      else if (c === 41) startParam = num;
      else if (c === 42) endParam = num;
    }
    const minX = -my * ratio;
    const minY = mx * ratio;
    let sweep = endParam - startParam;
    if (sweep <= 0) sweep += Math.PI * 2;
    const steps = Math.max(12, Math.ceil((sweep / (Math.PI * 2)) * 32));
    for (let s = 0; s < steps; s++) {
      const t1 = startParam + (s / steps) * sweep;
      const t2 = startParam + ((s + 1) / steps) * sweep;
      segments.push({
        x1: cx + mx * Math.cos(t1) + minX * Math.sin(t1),
        y1: cy + my * Math.cos(t1) + minY * Math.sin(t1),
        z1: cz + mz * Math.cos(t1),
        x2: cx + mx * Math.cos(t2) + minX * Math.sin(t2),
        y2: cy + my * Math.cos(t2) + minY * Math.sin(t2),
        z2: cz + mz * Math.cos(t2),
      });
    }
    return { segments, count: 1 };
  }

  if (entityType === "SPLINE") {
    let degree = 3;
    let closed = false;
    const knots: number[] = [];
    const ctrlPts: Array<{ x: number; y: number; z: number }> = [];
    const fitPts: Array<{ x: number; y: number; z: number }> = [];
    let curCtrl: { x: number; y: number; z: number } | null = null;
    let curFit: { x: number; y: number; z: number } | null = null;

    for (let k = 1; k < pairs.length; k++) {
      const [c, v] = pairs[k];
      if (c === 70) closed = (Number.parseInt(v, 10) & 1) === 1;
      else if (c === 71) degree = Number.parseInt(v, 10) || 3;
      else if (c === 40) knots.push(Number.parseFloat(v) || 0);
      else if (c === 10) {
        if (curCtrl) ctrlPts.push(curCtrl);
        curCtrl = { x: Number.parseFloat(v) || 0, y: 0, z: 0 };
      } else if (c === 20 && curCtrl) {
        curCtrl.y = Number.parseFloat(v) || 0;
      } else if (c === 30 && curCtrl) {
        curCtrl.z = Number.parseFloat(v) || 0;
      } else if (c === 11) {
        if (curFit) fitPts.push(curFit);
        curFit = { x: Number.parseFloat(v) || 0, y: 0, z: 0 };
      } else if (c === 21 && curFit) {
        curFit.y = Number.parseFloat(v) || 0;
      } else if (c === 31 && curFit) {
        curFit.z = Number.parseFloat(v) || 0;
      }
    }
    if (curCtrl) ctrlPts.push(curCtrl);
    if (curFit) fitPts.push(curFit);

    let pts: Array<{ x: number; y: number; z: number }> = [];
    if (
      ctrlPts.length >= 2 &&
      knots.length === ctrlPts.length + degree + 1 &&
      degree >= 1
    ) {
      const p = Math.min(degree, ctrlPts.length - 1);
      const tMin = knots[p];
      const tMax = knots[ctrlPts.length];
      const steps = Math.max(16, ctrlPts.length * 6);
      for (let s = 0; s <= steps; s++) {
        const t = tMin + (s / steps) * (tMax - tMin);
        pts.push(evaluateBSpline(degree, knots, ctrlPts, t));
      }
    } else if (fitPts.length >= 2) {
      pts = fitPts;
    } else {
      pts = ctrlPts;
    }

    for (let k = 0; k < pts.length - 1; k++) {
      segments.push({
        x1: pts[k].x,
        y1: pts[k].y,
        z1: pts[k].z,
        x2: pts[k + 1].x,
        y2: pts[k + 1].y,
        z2: pts[k + 1].z,
      });
    }
    if (closed && pts.length > 2) {
      segments.push({
        x1: pts[pts.length - 1].x,
        y1: pts[pts.length - 1].y,
        z1: pts[pts.length - 1].z,
        x2: pts[0].x,
        y2: pts[0].y,
        z2: pts[0].z,
      });
    }
    return { segments, count: 1 };
  }

  if (entityType === "INSERT" && depth < 8) {
    let blockName = "";
    let ix = 0,
      iy = 0,
      iz = 0;
    let sx = 1,
      sy = 1,
      sz = 1;
    let rotDeg = 0;

    for (let k = 1; k < pairs.length; k++) {
      const [c, v] = pairs[k];
      if (c === 2) blockName = v;
      else if (c === 10) ix = Number.parseFloat(v) || 0;
      else if (c === 20) iy = Number.parseFloat(v) || 0;
      else if (c === 30) iz = Number.parseFloat(v) || 0;
      else if (c === 41) sx = Number.parseFloat(v) || 1;
      else if (c === 42) sy = Number.parseFloat(v) || 1;
      else if (c === 43) sz = Number.parseFloat(v) || 1;
      else if (c === 50) rotDeg = Number.parseFloat(v) || 0;
    }

    const blk = blocks[blockName];
    if (!blk) return { segments: [], count: 0 };

    const rotRad = (rotDeg * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    const transformPt = (px: number, py: number, pz: number) => {
      const lx = (px - blk.baseX) * sx;
      const ly = (py - blk.baseY) * sy;
      const lz = (pz - blk.baseZ) * sz;
      return {
        x: ix + lx * cosR - ly * sinR,
        y: iy + lx * sinR + ly * cosR,
        z: iz + lz,
      };
    };

    const parsedBlock = parseEntityStream(blk.entities, blocks, depth + 1);
    for (const seg of parsedBlock.segments) {
      const p1 = transformPt(seg.x1, seg.y1, seg.z1);
      const p2 = transformPt(seg.x2, seg.y2, seg.z2);
      segments.push({
        x1: p1.x,
        y1: p1.y,
        z1: p1.z,
        x2: p2.x,
        y2: p2.y,
        z2: p2.z,
      });
    }
    return { segments, count: Math.max(1, parsedBlock.count) };
  }

  return { segments: [], count: 0 };
}

function parseEntityStream(
  entities: DxfPair[][],
  blocks: Record<string, DxfBlock>,
  depth = 0
): { segments: DxfSegment[]; count: number } {
  const segments: DxfSegment[] = [];
  let count = 0;

  for (let idx = 0; idx < entities.length; idx++) {
    const entity = entities[idx];
    if (entity.length === 0) continue;
    const type = entity[0][1].toUpperCase();

    if (type === "POLYLINE") {
      let closed = false;
      for (let k = 1; k < entity.length; k++) {
        if (entity[k][0] === 70) {
          closed = (Number.parseInt(entity[k][1], 10) & 1) === 1;
        }
      }
      const pts: Array<{ x: number; y: number; z: number }> = [];
      while (idx + 1 < entities.length) {
        const nextEntity = entities[idx + 1];
        const nextType = nextEntity[0]?.[1]?.toUpperCase();
        if (nextType === "VERTEX") {
          idx++;
          let vx = 0,
            vy = 0,
            vz = 0;
          for (let k = 1; k < nextEntity.length; k++) {
            const [c, v] = nextEntity[k];
            const num = Number.parseFloat(v) || 0;
            if (c === 10) vx = num;
            else if (c === 20) vy = num;
            else if (c === 30) vz = num;
          }
          pts.push({ x: vx, y: vy, z: vz });
        } else if (nextType === "SEQEND") {
          idx++;
          break;
        } else {
          break;
        }
      }
      for (let k = 0; k < pts.length - 1; k++) {
        segments.push({
          x1: pts[k].x,
          y1: pts[k].y,
          z1: pts[k].z,
          x2: pts[k + 1].x,
          y2: pts[k + 1].y,
          z2: pts[k + 1].z,
        });
      }
      if (closed && pts.length > 2) {
        segments.push({
          x1: pts[pts.length - 1].x,
          y1: pts[pts.length - 1].y,
          z1: pts[pts.length - 1].z,
          x2: pts[0].x,
          y2: pts[0].y,
          z2: pts[0].z,
        });
      }
      count++;
      continue;
    }

    const res = parseSingleEntity(entity, blocks, depth);
    if (res.count > 0) {
      segments.push(...res.segments);
      count += res.count;
    }
  }

  return { segments, count };
}

export function parseDxfToMmSegments(
  dxfText: string,
  sourceUnit: CadImportUnit
): ParsedDxfGeometry {
  const scale = getCadScaleFactorToMm(sourceUnit);
  const rawLines = dxfText.split(/\r?\n/).map((l) => l.trim());

  const pairs: DxfPair[] = [];
  for (let i = 0; i + 1 < rawLines.length; i += 2) {
    const code = Number.parseInt(rawLines[i], 10);
    if (Number.isNaN(code)) continue;
    pairs.push([code, rawLines[i + 1]]);
  }

  const blocks: Record<string, DxfBlock> = {};
  const entityRecords: DxfPair[][] = [];

  let section: "NONE" | "BLOCKS" | "ENTITIES" = "NONE";
  let currentBlock: { name: string; block: DxfBlock } | null = null;
  let currentEntity: DxfPair[] | null = null;

  const flushEntity = () => {
    if (!currentEntity || currentEntity.length === 0) return;
    if (section === "BLOCKS" && currentBlock) {
      currentBlock.block.entities.push(currentEntity);
    } else if (section === "ENTITIES") {
      entityRecords.push(currentEntity);
    }
    currentEntity = null;
  };

  for (let idx = 0; idx < pairs.length; idx++) {
    const [code, val] = pairs[idx];

    if (code === 0 && val === "SECTION") {
      flushEntity();
      section = "NONE";
      continue;
    }
    if (code === 2 && section === "NONE") {
      if (val === "BLOCKS") section = "BLOCKS";
      else if (val === "ENTITIES") section = "ENTITIES";
      continue;
    }
    if (code === 0 && val === "ENDSEC") {
      flushEntity();
      section = "NONE";
      continue;
    }

    if (section === "BLOCKS") {
      if (code === 0 && val === "BLOCK") {
        flushEntity();
        currentBlock = {
          name: "",
          block: { baseX: 0, baseY: 0, baseZ: 0, entities: [] },
        };
        continue;
      }
      if (code === 0 && val === "ENDBLK") {
        flushEntity();
        if (currentBlock && currentBlock.name) {
          blocks[currentBlock.name] = currentBlock.block;
        }
        currentBlock = null;
        continue;
      }
      if (currentBlock && !currentEntity) {
        if (code === 0) {
          currentEntity = [[code, val]];
        } else if (code === 2) {
          currentBlock.name = val;
        } else if (code === 10) {
          currentBlock.block.baseX = Number.parseFloat(val) || 0;
        } else if (code === 20) {
          currentBlock.block.baseY = Number.parseFloat(val) || 0;
        } else if (code === 30) {
          currentBlock.block.baseZ = Number.parseFloat(val) || 0;
        }
        continue;
      }
      if (currentBlock && currentEntity) {
        if (code === 0) {
          flushEntity();
          currentEntity = [[code, val]];
        } else {
          currentEntity.push([code, val]);
        }
      }
      continue;
    }

    if (section === "ENTITIES") {
      if (code === 0) {
        flushEntity();
        currentEntity = [[code, val]];
      } else if (currentEntity) {
        currentEntity.push([code, val]);
      }
    }
  }
  flushEntity();

  const { segments: rawSegments, count: entityCount } = parseEntityStream(
    entityRecords,
    blocks
  );

  if (rawSegments.length === 0) {
    return {
      segments: [],
      boundingBoxMm: { w: 40, h: 40, d: 10 },
      centerOffsetMm: { x: 0, y: 0, z: 0 },
      entityCount,
      warning: "No supported DXF geometry entities found.",
    };
  }

  const scaledSegments = rawSegments.map((s) => ({
    x1: s.x1 * scale,
    y1: s.y1 * scale,
    z1: s.z1 * scale,
    x2: s.x2 * scale,
    y2: s.y2 * scale,
    z2: s.z2 * scale,
  }));

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (const s of scaledSegments) {
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
  const centered = scaledSegments.map((s) => ({
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
    entityCount,
  };
}
