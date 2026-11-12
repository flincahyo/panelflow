import { getRotatedDimensions, rotateLocalPoint } from "@/lib/snap";
import { getEffectiveCadBounds } from "@/lib/collision";
import type {
  CustomCadAsset,
  DinRail,
  PlacedComponent,
  WireDuct,
} from "@/types/panel";

export interface AlignmentTargetBox {
  id: string;
  kind: "component" | "cad" | "rail" | "duct";
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

export interface AlignmentGuideLine {
  orientation: "vertical" | "horizontal";
  coordinate: number; // x for vertical, y for horizontal (world mm)
  start: number; // min y for vertical, min x for horizontal
  end: number; // max y for vertical, max x for horizontal
  type: "center" | "edge";
}

export interface AlignmentSnapResult {
  xMm: number;
  yMm: number;
  snappedX: boolean;
  snappedY: boolean;
  guides: AlignmentGuideLine[];
}

export const ALIGNMENT_SNAP_THRESHOLD_MM = 3.5;

export function buildAlignmentTargetBoxes(
  components: PlacedComponent[],
  cadAssets: CustomCadAsset[],
  rails: DinRail[],
  ducts: WireDuct[],
  excludeIds: Set<string>
): AlignmentTargetBox[] {
  const boxes: AlignmentTargetBox[] = [];

  for (const c of components) {
    if (excludeIds.has(c.id)) continue;
    const dims = getRotatedDimensions(c.widthMm, c.heightMm, c.rotationDeg ?? 0);
    const halfW = dims.widthMm / 2;
    const halfH = dims.heightMm / 2;
    boxes.push({
      id: c.id,
      kind: "component",
      centerX: c.xMm,
      centerY: c.yMm,
      left: c.xMm - halfW,
      right: c.xMm + halfW,
      top: c.yMm + halfH,
      bottom: c.yMm - halfH,
    });
  }

  for (const a of cadAssets) {
    if (excludeIds.has(a.id)) continue;
    const eff = getEffectiveCadBounds(a);
    const rot = a.rotationDeg ?? 0;
    const dims = getRotatedDimensions(eff.widthMm, eff.heightMm, rot);
    const rotOffset = rotateLocalPoint(eff.offsetX, eff.offsetY, rot);
    const cx = a.xMm + rotOffset.xMm;
    const cy = a.yMm + rotOffset.yMm;
    const halfW = dims.widthMm / 2;
    const halfH = dims.heightMm / 2;
    boxes.push({
      id: a.id,
      kind: "cad",
      centerX: cx,
      centerY: cy,
      left: cx - halfW,
      right: cx + halfW,
      top: cy + halfH,
      bottom: cy - halfH,
    });
  }

  for (const r of rails) {
    if (excludeIds.has(r.id)) continue;
    const halfW = r.lengthMm / 2;
    const halfH = 35 / 2;
    boxes.push({
      id: r.id,
      kind: "rail",
      centerX: r.xMm,
      centerY: r.yMm,
      left: r.xMm - halfW,
      right: r.xMm + halfW,
      top: r.yMm + halfH,
      bottom: r.yMm - halfH,
    });
  }

  for (const d of ducts) {
    if (excludeIds.has(d.id)) continue;
    const halfW = d.widthMm / 2;
    const halfH = d.heightMm / 2;
    boxes.push({
      id: d.id,
      kind: "duct",
      centerX: d.xMm,
      centerY: d.yMm,
      left: d.xMm - halfW,
      right: d.xMm + halfW,
      top: d.yMm + halfH,
      bottom: d.yMm - halfH,
    });
  }

  return boxes;
}

export function computeAlignmentGuides(
  movingBox: {
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
  },
  targets: AlignmentTargetBox[],
  thresholdMm: number = ALIGNMENT_SNAP_THRESHOLD_MM
): AlignmentSnapResult {
  let targetX = movingBox.xMm;
  let targetY = movingBox.yMm;
  let snappedX = false;
  let snappedY = false;

  const movingHalfW = movingBox.widthMm / 2;
  const movingHalfH = movingBox.heightMm / 2;

  // Moving candidate anchors
  const mCenterX = movingBox.xMm;
  const mLeft = movingBox.xMm - movingHalfW;
  const mRight = movingBox.xMm + movingHalfW;

  const mCenterY = movingBox.yMm;
  const mTop = movingBox.yMm + movingHalfH;
  const mBottom = movingBox.yMm - movingHalfH;

  let bestDiffX = Infinity;
  let snapXCoord = targetX;
  let xGuideLine: AlignmentGuideLine | null = null;

  // Evaluate X alignments (vertical guide lines)
  for (const t of targets) {
    // 1. Center to Center
    const diffCenter = Math.abs(mCenterX - t.centerX);
    if (diffCenter <= thresholdMm && diffCenter < bestDiffX) {
      bestDiffX = diffCenter;
      snapXCoord = t.centerX;
      snappedX = true;
      const minY = Math.min(mBottom, t.bottom) - 10;
      const maxY = Math.max(mTop, t.top) + 10;
      xGuideLine = {
        orientation: "vertical",
        coordinate: t.centerX,
        start: minY,
        end: maxY,
        type: "center",
      };
    }

    // 2. Left to Left
    const diffLeft = Math.abs(mLeft - t.left);
    if (diffLeft <= thresholdMm && diffLeft < bestDiffX) {
      bestDiffX = diffLeft;
      snapXCoord = t.left + movingHalfW;
      snappedX = true;
      const minY = Math.min(mBottom, t.bottom) - 10;
      const maxY = Math.max(mTop, t.top) + 10;
      xGuideLine = {
        orientation: "vertical",
        coordinate: t.left,
        start: minY,
        end: maxY,
        type: "edge",
      };
    }

    // 3. Right to Right
    const diffRight = Math.abs(mRight - t.right);
    if (diffRight <= thresholdMm && diffRight < bestDiffX) {
      bestDiffX = diffRight;
      snapXCoord = t.right - movingHalfW;
      snappedX = true;
      const minY = Math.min(mBottom, t.bottom) - 10;
      const maxY = Math.max(mTop, t.top) + 10;
      xGuideLine = {
        orientation: "vertical",
        coordinate: t.right,
        start: minY,
        end: maxY,
        type: "edge",
      };
    }

    // 4. Left to Right
    const diffLeftRight = Math.abs(mLeft - t.right);
    if (diffLeftRight <= thresholdMm && diffLeftRight < bestDiffX) {
      bestDiffX = diffLeftRight;
      snapXCoord = t.right + movingHalfW;
      snappedX = true;
      const minY = Math.min(mBottom, t.bottom) - 10;
      const maxY = Math.max(mTop, t.top) + 10;
      xGuideLine = {
        orientation: "vertical",
        coordinate: t.right,
        start: minY,
        end: maxY,
        type: "edge",
      };
    }

    // 5. Right to Left
    const diffRightLeft = Math.abs(mRight - t.left);
    if (diffRightLeft <= thresholdMm && diffRightLeft < bestDiffX) {
      bestDiffX = diffRightLeft;
      snapXCoord = t.left - movingHalfW;
      snappedX = true;
      const minY = Math.min(mBottom, t.bottom) - 10;
      const maxY = Math.max(mTop, t.top) + 10;
      xGuideLine = {
        orientation: "vertical",
        coordinate: t.left,
        start: minY,
        end: maxY,
        type: "edge",
      };
    }
  }

  let bestDiffY = Infinity;
  let snapYCoord = targetY;
  let yGuideLine: AlignmentGuideLine | null = null;

  // Evaluate Y alignments (horizontal guide lines)
  for (const t of targets) {
    // 1. Center to Center
    const diffCenter = Math.abs(mCenterY - t.centerY);
    if (diffCenter <= thresholdMm && diffCenter < bestDiffY) {
      bestDiffY = diffCenter;
      snapYCoord = t.centerY;
      snappedY = true;
      const minX = Math.min(mLeft, t.left) - 10;
      const maxX = Math.max(mRight, t.right) + 10;
      yGuideLine = {
        orientation: "horizontal",
        coordinate: t.centerY,
        start: minX,
        end: maxX,
        type: "center",
      };
    }

    // 2. Top to Top
    const diffTop = Math.abs(mTop - t.top);
    if (diffTop <= thresholdMm && diffTop < bestDiffY) {
      bestDiffY = diffTop;
      snapYCoord = t.top - movingHalfH;
      snappedY = true;
      const minX = Math.min(mLeft, t.left) - 10;
      const maxX = Math.max(mRight, t.right) + 10;
      yGuideLine = {
        orientation: "horizontal",
        coordinate: t.top,
        start: minX,
        end: maxX,
        type: "edge",
      };
    }

    // 3. Bottom to Bottom
    const diffBottom = Math.abs(mBottom - t.bottom);
    if (diffBottom <= thresholdMm && diffBottom < bestDiffY) {
      bestDiffY = diffBottom;
      snapYCoord = t.bottom + movingHalfH;
      snappedY = true;
      const minX = Math.min(mLeft, t.left) - 10;
      const maxX = Math.max(mRight, t.right) + 10;
      yGuideLine = {
        orientation: "horizontal",
        coordinate: t.bottom,
        start: minX,
        end: maxX,
        type: "edge",
      };
    }

    // 4. Top to Bottom
    const diffTopBottom = Math.abs(mTop - t.bottom);
    if (diffTopBottom <= thresholdMm && diffTopBottom < bestDiffY) {
      bestDiffY = diffTopBottom;
      snapYCoord = t.bottom - movingHalfH;
      snappedY = true;
      const minX = Math.min(mLeft, t.left) - 10;
      const maxX = Math.max(mRight, t.right) + 10;
      yGuideLine = {
        orientation: "horizontal",
        coordinate: t.bottom,
        start: minX,
        end: maxX,
        type: "edge",
      };
    }

    // 5. Bottom to Top
    const diffBottomTop = Math.abs(mBottom - t.top);
    if (diffBottomTop <= thresholdMm && diffBottomTop < bestDiffY) {
      bestDiffY = diffBottomTop;
      snapYCoord = t.top + movingHalfH;
      snappedY = true;
      const minX = Math.min(mLeft, t.left) - 10;
      const maxX = Math.max(mRight, t.right) + 10;
      yGuideLine = {
        orientation: "horizontal",
        coordinate: t.top,
        start: minX,
        end: maxX,
        type: "edge",
      };
    }
  }

  const guides: AlignmentGuideLine[] = [];
  if (xGuideLine) guides.push(xGuideLine);
  if (yGuideLine) guides.push(yGuideLine);

  return {
    xMm: snappedX ? snapXCoord : targetX,
    yMm: snappedY ? snapYCoord : targetY,
    snappedX,
    snappedY,
    guides,
  };
}
