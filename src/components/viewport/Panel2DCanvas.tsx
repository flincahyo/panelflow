"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cable,
  Hand,
  Hash,
  Maximize2,
  MousePointer2,
  Redo2,
  Ruler,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { detectCollisionsAndBounds, getEffectiveCadBounds } from "@/lib/collision";
import {
  buildAlignmentTargetBoxes,
  computeAlignmentGuides,
  type AlignmentGuideLine,
  type AlignmentTargetBox,
} from "@/lib/alignment-guides";
import {
  buildSvgObstacleBoxes,
  formatCadDisplayLabel,
  getSmartCadLabelPosition,
  type SvgRect,
} from "@/lib/cad-label";
import { getBackplateDimensions } from "@/lib/template-export";
import { EnclosureDoor2D } from "./EnclosureDoor2D";
import { calculateAllDuctFillRatios, getDuctFillStatusColor } from "@/lib/duct-fill";
import { parseDxfToMmSegments } from "@/lib/dxf-parser";
import { WIRE_COLOR_MAP } from "@/lib/sheet-export";
import {
  computePlateRulerSubTicks,
  computeSelectionFootprint,
  getRulerStepsMm,
  plateToWorldX,
  plateToWorldY,
  worldToPlateX,
  worldToPlateY,
} from "@/lib/ruler";
import { getRotatedDimensions, rotateLocalPoint, snapToGrid } from "@/lib/snap";
import { formatDim } from "@/lib/units";
import {
  getWireOuterDiameterMm,
  pointsToRoundedSvgPath,
  pointsToSvgPath,
  routeOrthogonalWire,
  routeWireThroughDucts,
} from "@/lib/wire-router";
import { usePanelStore } from "@/store/usePanelStore";
import type {
  CustomCadAsset,
  DinRail,
  GridSnapMm,
  PlacedComponent,
  SelectedTarget,
  WireColorCode,
  WireDuct,
} from "@/types/panel";

const WIRE_COLORS: { code: WireColorCode; label: string; hex: string }[] = [
  { code: "R", label: "R (L1)", hex: "#dc2626" },
  { code: "S", label: "S (L2)", hex: "#eab308" },
  { code: "T", label: "T (L3)", hex: "#2563eb" },
  { code: "N", label: "N", hex: "#0284c7" },
  { code: "PE", label: "PE", hex: "#16a34a" },
  { code: "DC+", label: "+24V", hex: "#ef4444" },
  { code: "DC-", label: "0V", hex: "#1e293b" },
];

type DragState =
  | {
      type: "pan";
      startClientX: number;
      startClientY: number;
      startPanX: number;
      startPanY: number;
    }
  | {
      type: "component";
      id: string;
      offsetXMm: number;
      offsetYMm: number;
    }
  | {
      type: "cad";
      id: string;
      offsetXMm: number;
      offsetYMm: number;
    }
  | {
      type: "rail-move";
      id: string;
      offsetXMm: number;
      offsetYMm: number;
    }
  | {
      type: "rail-resize";
      id: string;
      edge: "left" | "right";
      initialXMm: number;
      initialLengthMm: number;
      startWorldXMm: number;
    }
  | {
      type: "duct-move";
      id: string;
      offsetXMm: number;
      offsetYMm: number;
    }
  | {
      type: "duct-resize";
      id: string;
      edge: "left" | "right" | "top" | "bottom";
      initialDuct: WireDuct;
      startWorldXMm: number;
      startWorldYMm: number;
    }
  | {
      type: "marquee";
      startWorldXMm: number;
      startWorldYMm: number;
      currentWorldXMm: number;
      currentWorldYMm: number;
      additive: boolean;
    }
  | {
      type: "multi-drag";
      startWorldXMm: number;
      startWorldYMm: number;
      lastDxMm: number;
      lastDyMm: number;
    };

function Component2DSymbol({
  comp,
  isSelected,
  isWireMode,
  activeWireStartPin,
  onPointerDown,
  onContextMenu,
  onPinClick,
  hasCollision,
  isOutOfBounds,
}: {
  comp: PlacedComponent;
  isSelected: boolean;
  isWireMode: boolean;
  activeWireStartPin: { componentId: string; pinId: string } | null;
  onPointerDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPinClick: (e: React.PointerEvent, pinId: string) => void;
  hasCollision?: boolean;
  isOutOfBounds?: boolean;
}) {
  // SVG Y is down, world Y is up
  const x = comp.xMm - comp.widthMm / 2;
  const y = -(comp.yMm + comp.heightMm / 2);

  const isPE = comp.name.toLowerCase().includes("pe");
  const isN = comp.name.toLowerCase().includes("neutral") || comp.name.toLowerCase().endsWith(" n");

  const bodyFill =
    comp.templateId === "terminal-block"
      ? isPE
        ? "#dcfce7"
        : isN
        ? "#dbeafe"
        : "#f1f5f9"
      : "#ffffff";

  const accent =
    comp.templateId === "terminal-block"
      ? isPE
        ? "#16a34a"
        : isN
        ? "#2563eb"
        : "#64748b"
      : comp.accentColor;

  const rot = comp.rotationDeg ?? 0;

  return (
    <g
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      transform={rot ? `rotate(${rot} ${comp.xMm} ${-comp.yMm})` : undefined}
      className={isWireMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}
    >
      {/* Collision / Out-of-Bounds Warning Highlight */}
      {(hasCollision || isOutOfBounds) && (
        <g className="pointer-events-none">
          <rect
            x={x - 1.5}
            y={y - 1.5}
            width={comp.widthMm + 3}
            height={comp.heightMm + 3}
            fill="#ef4444"
            fillOpacity={0.12}
            stroke="#ef4444"
            strokeWidth={1.6}
            strokeDasharray={isOutOfBounds ? "4,2" : undefined}
            rx={1}
          />
          <rect
            x={x + comp.widthMm - 18}
            y={y - 6}
            width={18}
            height={6}
            rx={1}
            fill="#dc2626"
          />
          <text
            x={x + comp.widthMm - 9}
            y={y - 1.5}
            fontSize={3.8}
            fontFamily="monospace"
            fontWeight="bold"
            fill="#ffffff"
            textAnchor="middle"
          >
            {isOutOfBounds ? "! OOB" : "! OVL"}
          </text>
        </g>
      )}

      {/* Selection halo */}
      {isSelected && (
        <rect
          x={x - 2}
          y={y - 2}
          width={comp.widthMm + 4}
          height={comp.heightMm + 4}
          fill="none"
          stroke={comp.locked ? "#f59e0b" : "#0284c7"}
          strokeWidth={1.2}
          strokeDasharray="3,2"
          rx={1}
        />
      )}

      {/* Locked / Group Badge */}
      {(comp.locked || comp.groupId) && (
        <g className="pointer-events-none">
          {comp.locked && (
            <text
              x={x + 2}
              y={y + 8}
              fontSize={6}
              fontFamily="sans-serif"
              fill="#f59e0b"
              fontWeight="bold"
            >
              🔒
            </text>
          )}
          {comp.groupId && (
            <circle
              cx={x + comp.widthMm - 4}
              cy={y + 4}
              r={2.5}
              fill="#8b5cf6"
              stroke="#ffffff"
              strokeWidth={0.5}
            />
          )}
        </g>
      )}

      {/* Main Outline */}
      <rect
        x={x}
        y={y}
        width={comp.widthMm}
        height={comp.heightMm}
        fill={bodyFill}
        stroke={isSelected ? "#0284c7" : "#0f172a"}
        strokeWidth={0.9}
      />

      {/* Accent Header */}
      <rect x={x} y={y} width={comp.widthMm} height={5} fill={accent} />

      {/* Eplan 2D Vector Symbol Detail */}
      {comp.templateId === "mcb-1p" ||
      comp.templateId === "mcb-2p" ||
      comp.templateId === "mcb-3p" ||
      comp.templateId === "mcb-4p" ||
      comp.templateId === "spd-3pn" ||
      comp.templateId === "fuse-1p" ? (
        <g stroke="#334155" strokeWidth={0.7} fill="none">
          <rect
            x={x + comp.widthMm * 0.16}
            y={y + comp.heightMm * 0.38}
            width={comp.widthMm * 0.68}
            height={comp.heightMm * 0.24}
            fill="#e2e8f0"
          />
          <line
            x1={x + comp.widthMm * 0.22}
            y1={y + comp.heightMm * 0.5}
            x2={x + comp.widthMm * 0.78}
            y2={y + comp.heightMm * 0.5}
            stroke={accent}
            strokeWidth={1.3}
          />
        </g>
      ) : comp.templateId === "mccb-100a" ? (
        <g stroke="#334155" strokeWidth={0.8} fill="none">
          <rect
            x={x + comp.widthMm * 0.28}
            y={y + comp.heightMm * 0.35}
            width={comp.widthMm * 0.44}
            height={comp.heightMm * 0.28}
            rx={2}
            fill="#e2e8f0"
          />
          <rect
            x={x + comp.widthMm * 0.35}
            y={y + comp.heightMm * 0.44}
            width={comp.widthMm * 0.3}
            height={comp.heightMm * 0.1}
            fill={accent}
          />
        </g>
      ) : comp.templateId === "contactor" || comp.templateId === "tor" ? (
        <g stroke="#334155" strokeWidth={0.7} fill="none">
          <rect
            x={x + 6}
            y={y + 22}
            width={comp.widthMm - 12}
            height={comp.heightMm - 44}
            fill="#f8fafc"
          />
          <line
            x1={x + 10}
            y1={y + 28}
            x2={x + comp.widthMm - 10}
            y2={y + comp.heightMm - 28}
            stroke={accent}
            strokeWidth={1.0}
          />
        </g>
      ) : comp.templateId === "relay" || comp.templateId === "timer-relay" ? (
        <g stroke="#334155" strokeWidth={0.7} fill="none">
          <rect
            x={x + 3}
            y={y + 22}
            width={comp.widthMm - 6}
            height={comp.heightMm - 44}
            fill="#f8fafc"
          />
          <circle
            cx={x + comp.widthMm / 2}
            cy={y + comp.heightMm / 2}
            r={Math.min(5, comp.widthMm * 0.25)}
            fill={accent}
            fillOpacity={0.35}
            stroke={accent}
          />
        </g>
      ) : comp.templateId === "plc-compact" ? (
        <g stroke="#334155" strokeWidth={0.7} fill="none">
          <rect x={x + 6} y={y + 22} width={comp.widthMm - 12} height={comp.heightMm - 44} fill="#f1f5f9" />
          <rect x={x + 10} y={y + 26} width={comp.widthMm - 20} height={10} fill="#0f172a" />
          <circle cx={x + 15} cy={y + 31} r={1.8} fill="#22c55e" />
          <circle cx={x + 21} cy={y + 31} r={1.8} fill="#06b6d4" />
        </g>
      ) : comp.templateId === "vfd-15kw" ? (
        <g stroke="#334155" strokeWidth={0.7} fill="none">
          <rect x={x + 8} y={y + 26} width={comp.widthMm - 16} height={32} fill="#0f172a" />
          <circle cx={x + comp.widthMm / 2} cy={y + 82} r={12} fill="#e2e8f0" stroke={accent} strokeWidth={1} />
          <rect x={x + 10} y={y + 110} width={comp.widthMm - 20} height={44} fill="#f1f5f9" />
        </g>
      ) : comp.templateId === "psu-24v" ||
        comp.templateId === "psu-24v-10a" ||
        comp.templateId === "dist-block-4p" ? (
        <g stroke="#334155" strokeWidth={0.7} fill="none">
          <rect
            x={x + 8}
            y={y + 26}
            width={comp.widthMm - 16}
            height={comp.heightMm - 52}
            fill="#f1f5f9"
          />
          <line
            x1={x + 12}
            y1={y + comp.heightMm / 2}
            x2={x + comp.widthMm - 12}
            y2={y + comp.heightMm / 2}
            stroke={accent}
            strokeWidth={1.1}
          />
        </g>
      ) : comp.templateId === "pilot-lamp-red" ||
        comp.templateId === "pilot-lamp-green" ||
        comp.templateId === "pilot-lamp-yellow" ||
        comp.templateId === "push-button" ||
        comp.templateId === "e-stop" ||
        comp.templateId === "selector-3pos" ? (
        <g stroke="#0f172a" strokeWidth={0.8} fill="none">
          <circle
            cx={x + comp.widthMm / 2}
            cy={y + comp.heightMm / 2}
            r={Math.min(comp.widthMm, comp.heightMm) * 0.36}
            fill={accent}
            fillOpacity={0.3}
            stroke={accent}
            strokeWidth={1.2}
          />
          <circle
            cx={x + comp.widthMm / 2}
            cy={y + comp.heightMm / 2}
            r={11}
            strokeDasharray="2,1.5"
            stroke="#475569"
          />
        </g>
      ) : comp.templateId === "cam-lock" ? (
        <g stroke="#0f172a" strokeWidth={0.8} fill="none">
          <circle
            cx={x + comp.widthMm / 2}
            cy={y + comp.heightMm / 2}
            r={11}
            fill="#334155"
            fillOpacity={0.2}
            stroke="#475569"
            strokeWidth={1.2}
          />
          <line
            x1={x + comp.widthMm / 2 - 10}
            y1={y + comp.heightMm / 2 - 9}
            x2={x + comp.widthMm / 2 - 10}
            y2={y + comp.heightMm / 2 + 9}
            stroke="#f59e0b"
            strokeWidth={1.2}
          />
          <line
            x1={x + comp.widthMm / 2 + 10}
            y1={y + comp.heightMm / 2 - 9}
            x2={x + comp.widthMm / 2 + 10}
            y2={y + comp.heightMm / 2 + 9}
            stroke="#f59e0b"
            strokeWidth={1.2}
          />
          <rect
            x={x + comp.widthMm / 2 - 2}
            y={y + comp.heightMm / 2 - 6}
            width={4}
            height={12}
            rx={1}
            fill="#94a3b8"
          />
        </g>
      ) : comp.templateId === "panel-meter-96" ? (
        <g stroke="#0f172a" strokeWidth={0.8} fill="none">
          <rect x={x + 10} y={y + 22} width={comp.widthMm - 20} height={36} fill="#0f172a" />
          <rect x={x + 14} y={y + 26} width={comp.widthMm - 28} height={28} stroke="#38bdf8" strokeWidth={0.8} />
        </g>
      ) : comp.templateId === "cooling-fan-120" ? (
        <g stroke="#334155" strokeWidth={0.8} fill="none">
          <circle cx={x + comp.widthMm / 2} cy={y + comp.heightMm / 2} r={comp.widthMm * 0.38} fill="#f1f5f9" />
          <circle cx={x + comp.widthMm / 2} cy={y + comp.heightMm / 2} r={10} fill="#94a3b8" />
          <line x1={x + 14} y1={y + comp.heightMm / 2} x2={x + comp.widthMm - 14} y2={y + comp.heightMm / 2} stroke="#475569" />
          <line x1={x + comp.widthMm / 2} y1={y + 14} x2={x + comp.widthMm / 2} y2={y + comp.heightMm - 14} stroke="#475569" />
        </g>
      ) : null}

      {/* Component Tag & Type */}
      {comp.widthMm < 30 ? (
        <>
          {/* Contrasting Pill Tag above narrow component (< 30mm) */}
          {(() => {
            const shortTag =
              comp.name.length > 14 ? `${comp.name.slice(0, 12)}…` : comp.name;
            const pillW = Math.max(22, shortTag.length * 2.5 + 5);
            const pillY = hasCollision || isOutOfBounds ? y - 16 : y - 10;
            return (
              <g className="pointer-events-none">
                <rect
                  x={x + comp.widthMm / 2 - pillW / 2}
                  y={pillY}
                  width={pillW}
                  height={7.5}
                  rx={1.5}
                  fill="#0f172a"
                  stroke="#ffffff"
                  strokeWidth={0.4}
                />
                <text
                  x={x + comp.widthMm / 2}
                  y={pillY + 5.2}
                  fontSize={3.8}
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#ffffff"
                  textAnchor="middle"
                >
                  {shortTag}
                </text>
              </g>
            );
          })()}
          <text
            x={x + comp.widthMm / 2}
            y={y + 11.5}
            fontSize={3.2}
            fontFamily="monospace"
            fontWeight="bold"
            fill="#334155"
            textAnchor="middle"
          >
            {comp.templateId.toUpperCase()}
          </text>
        </>
      ) : (
        <>
          <text
            x={x + 2.5}
            y={y + 12}
            fontSize={4.8}
            fontFamily="monospace"
            fontWeight="bold"
            fill="#0f172a"
          >
            {comp.name.length > Math.floor((comp.widthMm - 4) / 2.9)
              ? `${comp.name.slice(0, Math.max(4, Math.floor((comp.widthMm - 4) / 2.9) - 1))}…`
              : comp.name}
          </text>
          <text
            x={x + 2.5}
            y={y + 18}
            fontSize={3.8}
            fontFamily="sans-serif"
            fill="#64748b"
          >
            {comp.templateId.toUpperCase()}
          </text>
        </>
      )}

      {/* Pins */}
      {comp.pins.map((pin) => {
        const px = comp.xMm + pin.localXMm;
        const py = -(comp.yMm + pin.localYMm);
        const isStartPin =
          activeWireStartPin?.componentId === comp.id &&
          activeWireStartPin?.pinId === pin.id;

        return (
          <g
            key={pin.id}
            onPointerDown={(e) => {
              if (isWireMode) {
                e.stopPropagation();
                onPinClick(e, pin.id);
              }
            }}
            className={isWireMode ? "cursor-pointer" : undefined}
          >
            <circle
              cx={px}
              cy={py}
              r={isWireMode ? 2.6 : 1.7}
              fill={isStartPin ? "#f59e0b" : "#ffffff"}
              stroke={isStartPin ? "#b45309" : isWireMode ? "#0284c7" : "#1e293b"}
              strokeWidth={isWireMode ? 0.9 : 0.6}
            />
            <text
              x={px}
              y={py - 3}
              fontSize={3.6}
              fontFamily="monospace"
              fill="#334155"
              textAnchor="middle"
            >
              {pin.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function CadAsset2DSymbol({
  asset,
  isSelected,
  isMarkingThis,
  isWireMode,
  isDark,
  obstacleBoxes,
  activeWireStartPin,
  onPointerDown,
  onContextMenu,
  onPinClick,
}: {
  asset: CustomCadAsset;
  isSelected: boolean;
  isMarkingThis: boolean;
  isWireMode: boolean;
  isDark: boolean;
  obstacleBoxes: SvgRect[];
  activeWireStartPin: { componentId: string; pinId: string } | null;
  onPointerDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPinClick: (e: React.PointerEvent, pinId: string) => void;
}) {
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);

  const dxfParsed = useMemo(() => {
    if (asset.format !== "dxf" || !asset.rawText) return null;
    return parseDxfToMmSegments(asset.rawText, asset.sourceUnit);
  }, [asset.format, asset.rawText, asset.sourceUnit]);

  const w = dxfParsed ? dxfParsed.boundingBoxMm.w : asset.boundingBoxMm.w;
  const h = dxfParsed ? dxfParsed.boundingBoxMm.h : asset.boundingBoxMm.h;

  const effBounds = getEffectiveCadBounds({
    boundingBoxMm: { w, h },
    cropMm: asset.cropMm,
  });
  const effW = effBounds.widthMm;
  const effH = effBounds.heightMm;

  // SVG Y is down, world Y is up
  const effX = asset.xMm + effBounds.offsetX - effW / 2;
  const effY = -(asset.yMm + effBounds.offsetY + effH / 2);
  const hasCrop = Boolean(
    asset.cropMm &&
      (asset.cropMm.top > 0 ||
        asset.cropMm.bottom > 0 ||
        asset.cropMm.left > 0 ||
        asset.cropMm.right > 0)
  );
  const clipId = `cad-crop-${asset.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  const cleanLabel = formatCadDisplayLabel(asset.name, 28);
  const rot = asset.rotationDeg ?? 0;

  const smartPos = useMemo(() => {
    return getSmartCadLabelPosition({
      assetId: asset.id,
      effX,
      effY,
      effW,
      effH,
      cropMm: asset.cropMm,
      labelPosition: asset.labelPosition,
      otherBoxes: obstacleBoxes,
    });
  }, [
    asset.id,
    effX,
    effY,
    effW,
    effH,
    asset.cropMm,
    asset.labelPosition,
    obstacleBoxes,
  ]);

  return (
    <g
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      transform={rot ? `rotate(${rot} ${asset.xMm} ${-asset.yMm})` : undefined}
      className={
        isMarkingThis || isWireMode
          ? "cursor-crosshair"
          : "cursor-grab active:cursor-grabbing"
      }
    >
      <title>{asset.fileName}</title>

      {hasCrop && (
        <defs>
          <clipPath id={clipId}>
            <rect x={effX} y={effY} width={effW} height={effH} />
          </clipPath>
        </defs>
      )}

      {/* Interactive Hitbox & Background */}
      <rect
        x={effX}
        y={effY}
        width={effW}
        height={effH}
        fill={asset.format === "dxf" ? "#f0f9ff" : "#f8fafc"}
        fillOpacity={asset.format === "dxf" ? 0.35 : 0.85}
        stroke={
          isMarkingThis
            ? "#f59e0b"
            : isSelected
            ? "#0284c7"
            : asset.format === "dxf"
            ? "#94a3b8"
            : "#0f172a"
        }
        strokeWidth={isMarkingThis || isSelected ? 1.1 : 0.7}
        strokeDasharray={asset.format === "dxf" ? "2,1.5" : undefined}
      />

      {/* Selection / Marking Halo */}
      {(isSelected || isMarkingThis) && (
        <rect
          x={effX - 2.5}
          y={effY - 2.5}
          width={effW + 5}
          height={effH + 5}
          fill="none"
          stroke={isMarkingThis ? "#f59e0b" : asset.locked ? "#f59e0b" : "#0284c7"}
          strokeWidth={1.2}
          strokeDasharray="3,2"
          rx={1}
        />
      )}

      {/* Locked / Group Badge */}
      {(asset.locked || asset.groupId) && (
        <g className="pointer-events-none">
          {asset.locked && (
            <text
              x={effX + 2}
              y={effY + 8}
              fontSize={6}
              fontFamily="sans-serif"
              fill="#f59e0b"
              fontWeight="bold"
            >
              🔒
            </text>
          )}
          {asset.groupId && (
            <circle
              cx={effX + effW - 4}
              cy={effY + 4}
              r={2.5}
              fill="#8b5cf6"
              stroke="#ffffff"
              strokeWidth={0.5}
            />
          )}
        </g>
      )}

      {/* DXF Vector Segments or 3D Mesh Silhouette */}
      {dxfParsed && dxfParsed.segments.length > 0 ? (
        <g
          clipPath={hasCrop ? `url(#${clipId})` : undefined}
          stroke="#0369a1"
          strokeWidth={0.75}
          strokeLinecap="round"
        >
          {dxfParsed.segments.map((seg, idx) => (
            <line
              key={idx}
              x1={asset.xMm + seg.x1}
              y1={-(asset.yMm + seg.y1)}
              x2={asset.xMm + seg.x2}
              y2={-(asset.yMm + seg.y2)}
            />
          ))}
        </g>
      ) : (
        <g
          clipPath={hasCrop ? `url(#${clipId})` : undefined}
          stroke="#64748b"
          strokeWidth={0.6}
          fill="none"
        >
          <line x1={effX} y1={effY} x2={effX + effW} y2={effY + effH} strokeDasharray="2,2" />
          <line x1={effX + effW} y1={effY} x2={effX} y2={effY + effH} strokeDasharray="2,2" />
          <circle cx={asset.xMm} cy={-asset.yMm} r={Math.min(w, h) * 0.2} />
        </g>
      )}

      {/* Smart Positioned CAD Label (Clean, no [DXF] suffix, with contrast halo) */}
      <g pointerEvents="none">
        <text
          x={smartPos.x}
          y={smartPos.y}
          textAnchor={smartPos.textAnchor}
          dominantBaseline={smartPos.dominantBaseline}
          fontSize={4.6}
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight={600}
          fill="#0284c7"
          stroke={isDark ? "#0b0f19" : "#ffffff"}
          strokeWidth={1.2}
          strokeLinejoin="round"
          style={{ paintOrder: "stroke fill" }}
        >
          {cleanLabel}
        </text>
      </g>

      {/* 100% Transparent Crosshair Pin Markers (Outside clipPath, with text halo) */}
      <g className="cad-pin-markers">
        {asset.pins.map((pin) => {
          const px = asset.xMm + pin.localXMm;
          const py = -(asset.yMm + pin.localYMm);
          const isStartPin =
            activeWireStartPin?.componentId === asset.id &&
            activeWireStartPin?.pinId === pin.id;
          const isHovered = hoveredPinId === pin.id;
          const isActivePin =
            isWireMode || isMarkingThis || isHovered || isStartPin;

          const ringStroke = isStartPin
            ? "#b45309"
            : isWireMode
            ? "#0284c7"
            : isHovered
            ? "#f59e0b"
            : isMarkingThis
            ? "#d97706"
            : "#0284c7";

          return (
            <g
              key={pin.id}
              onPointerEnter={() => setHoveredPinId(pin.id)}
              onPointerLeave={() =>
                setHoveredPinId((curr) => (curr === pin.id ? null : curr))
              }
              onPointerDown={(e) => {
                if (isWireMode) {
                  e.stopPropagation();
                  onPinClick(e, pin.id);
                }
              }}
              className={isWireMode ? "cursor-pointer" : undefined}
            >
              {/* True 100% transparent hit ring with thin stroke */}
              <circle
                cx={px}
                cy={py}
                r={
                  isStartPin
                    ? 2.5
                    : isWireMode || isMarkingThis
                    ? 2.2
                    : isHovered
                    ? 2.1
                    : 1.8
                }
                fill="transparent"
                pointerEvents="all"
                stroke={ringStroke}
                strokeOpacity={isActivePin ? 0.95 : 0.45}
                strokeWidth={isActivePin ? 0.55 : 0.35}
              />
              {/* Ultra-fine Crosshair lines (0.8mm span, strokeWidth 0.25) */}
              <line
                x1={px - 0.8}
                y1={py}
                x2={px + 0.8}
                y2={py}
                stroke={ringStroke}
                strokeOpacity={isActivePin ? 0.95 : 0.45}
                strokeWidth={0.25}
                pointerEvents="none"
              />
              <line
                x1={px}
                y1={py - 0.8}
                x2={px}
                y2={py + 0.8}
                stroke={ringStroke}
                strokeOpacity={isActivePin ? 0.95 : 0.45}
                strokeWidth={0.25}
                pointerEvents="none"
              />
              {/* Crisp Pin Label with halo stroke - readable over CAD without clipping */}
              <text
                x={px + 2.4}
                y={py + 1}
                fontSize={isActivePin ? 3.6 : 3.0}
                fontFamily="system-ui, -apple-system, BlinkMacSystemFont, monospace"
                fontWeight={600}
                fill={isWireMode ? "#0284c7" : isDark ? "#fbbf24" : "#b45309"}
                fillOpacity={isActivePin ? 1.0 : 0.85}
                stroke={isDark ? "#0b0f19" : "#ffffff"}
                strokeWidth={0.9}
                strokeLinejoin="round"
                style={{ paintOrder: "stroke fill" }}
                textAnchor="start"
                pointerEvents="none"
              >
                {pin.label}
              </text>
            </g>
          );
        })}
      </g>
    </g>
  );
}

export function Panel2DCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  const theme = usePanelStore((s) => s.theme);
  const activeSheetType = usePanelStore((s) => s.activeSheetType);
  const enclosure = usePanelStore((s) => s.enclosure);
  const plateConfig = usePanelStore((s) => s.plateConfig);
  const displayUnit = usePanelStore((s) => s.displayUnit);
  const rails = usePanelStore((s) => s.rails);
  const ducts = usePanelStore((s) => s.ducts);
  const components = usePanelStore((s) => s.components);
  const cadAssets = usePanelStore((s) => s.cadAssets);
  const wires = usePanelStore((s) => s.wires);
  const titleBlock = usePanelStore((s) => s.titleBlock);
  const gridSnapMm = usePanelStore((s) => s.gridSnapMm);
  const selected = usePanelStore((s) => s.selected);
  const selectedIds = usePanelStore((s) => s.selectedIds);
  const canvasTool2D = usePanelStore((s) => s.canvasTool2D);
  const activeWireColor = usePanelStore((s) => s.activeWireColor);
  const activeWireGauge = usePanelStore((s) => s.activeWireGauge);
  const activeWireStartPin = usePanelStore((s) => s.activeWireStartPin);
  const autoRouteDuctsEnabled = usePanelStore((s) => s.autoRouteDuctsEnabled);
  const autoNumberWires = usePanelStore((s) => s.autoNumberWires);
  const setAutoRouteDuctsEnabled = usePanelStore((s) => s.setAutoRouteDuctsEnabled);
  const isPinMarkingMode = usePanelStore((s) => s.isPinMarkingMode);
  const activeMarkingAssetId = usePanelStore((s) => s.activeMarkingAssetId);

  const setSelected = usePanelStore((s) => s.setSelected);
  const setSelectedIds = usePanelStore((s) => s.setSelectedIds);
  const toggleSelectId = usePanelStore((s) => s.toggleSelectId);
  const clearSelection = usePanelStore((s) => s.clearSelection);
  const moveSelectedItems = usePanelStore((s) => s.moveSelectedItems);
  const nudgeSelectedItems = usePanelStore((s) => s.nudgeSelectedItems);
  const deleteSelectedItems = usePanelStore((s) => s.deleteSelectedItems);
  const copySelectedToClipboard = usePanelStore((s) => s.copySelectedToClipboard);
  const pasteFromClipboard = usePanelStore((s) => s.pasteFromClipboard);
  const groupSelectedItems = usePanelStore((s) => s.groupSelectedItems);
  const ungroupSelectedItems = usePanelStore((s) => s.ungroupSelectedItems);
  const pushUndoSnapshot = usePanelStore((s) => s.pushUndoSnapshot);
  const setCanvasTool2D = usePanelStore((s) => s.setCanvasTool2D);
  const setActiveWireColor = usePanelStore((s) => s.setActiveWireColor);
  const setActiveWireGauge = usePanelStore((s) => s.setActiveWireGauge);
  const setActiveWireStartPin = usePanelStore((s) => s.setActiveWireStartPin);
  const moveComponent = usePanelStore((s) => s.moveComponent);
  const moveCadAsset = usePanelStore((s) => s.moveCadAsset);
  const addPinToAsset = usePanelStore((s) => s.addPinToAsset);
  const updateRail = usePanelStore((s) => s.updateRail);
  const updateDuct = usePanelStore((s) => s.updateDuct);
  const addWire = usePanelStore((s) => s.addWire);
  const setGridSnapMm = usePanelStore((s) => s.setGridSnapMm);
  const undo = usePanelStore((s) => s.undo);
  const redo = usePanelStore((s) => s.redo);
  const canUndo = usePanelStore((s) => s.canUndo);
  const canRedo = usePanelStore((s) => s.canRedo);

  // Camera state: zoom (px per mm), pan (px offset of world origin (0,0) from top-left of container)
  const [zoom, setZoom] = useState(1.1);
  const [pan, setPan] = useState({ x: 480, y: 380 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuideLine[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: import("@/components/ui/ContextMenu").ContextMenuTarget;
  } | null>(null);
  const [cursorWorld, setCursorWorld] = useState<{ xMm: number; yMm: number } | null>(
    null
  );
  const [measureStart, setMeasureStart] = useState<{ xMm: number; yMm: number } | null>(
    null
  );
  const [measureEnd, setMeasureEnd] = useState<{ xMm: number; yMm: number } | null>(
    null
  );
  const [measureHover, setMeasureHover] = useState<{ xMm: number; yMm: number } | null>(
    null
  );
  const [viewportSize, setViewportSize] = useState({ width: 960, height: 760 });
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    dist: number;
    midX: number;
    midY: number;
    zoom: number;
    panX: number;
    panY: number;
  } | null>(null);

  const { widthMm: plateW, heightMm: plateH } = useMemo(
    () => getBackplateDimensions(enclosure, plateConfig),
    [enclosure, plateConfig]
  );

  const collisionReport = useMemo(
    () => detectCollisionsAndBounds(components, cadAssets, plateW, plateH),
    [components, cadAssets, plateW, plateH]
  );

  const cadObstacleBoxes = useMemo(
    () => buildSvgObstacleBoxes(components, cadAssets),
    [components, cadAssets]
  );

  const ductFillMap = useMemo(
    () => calculateAllDuctFillRatios(ducts, wires),
    [ducts, wires]
  );

  // Sheet dimensions around backplate
  const sheetW = Math.max(841, plateW + 220);
  const sheetH = Math.max(594, plateH + 140);

  // Fit sheet on initial mount (reserve top clearance for ruler + floating toolbar)
  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setViewportSize({ width: rect.width, height: rect.height });
    const topPad = 92;
    const bottomPad = 44;
    const sidePad = 72;
    const availW = Math.max(200, rect.width - sidePad * 2);
    const availH = Math.max(200, rect.height - topPad - bottomPad);
    const scaleX = availW / sheetW;
    const scaleY = availH / sheetH;
    const nextZoom = Math.max(0.25, Math.min(3, Math.min(scaleX, scaleY)));
    setZoom(nextZoom);
    setPan({
      x: rect.width / 2 + 12,
      y: topPad + availH / 2,
    });
  }, [sheetW, sheetH]);

  useEffect(() => {
    fitToView();
    const onResize = () => {
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        setViewportSize({ width: rect.width, height: rect.height });
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitToView]);

  // Spacebar pan & Delete/Backspace bulk delete, Arrow nudge, Copy/Paste & Group shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);

      if (e.code === "Space" && !isEditingText) {
        setSpacePressed(true);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !isEditingText) {
        if (selectedIds.length > 0 || selected) {
          e.preventDefault();
          deleteSelectedItems();
        }
      }
      if (e.code === "Escape") {
        setActiveWireStartPin(null);
        setMeasureStart(null);
        setMeasureEnd(null);
        setMeasureHover(null);
        clearSelection();
      }

      if (isEditingText) return;

      const mod = e.ctrlKey || e.metaKey;

      // Copy: Ctrl+C / Cmd+C
      if (mod && !e.shiftKey && e.key.toLowerCase() === "c") {
        if (selectedIds.length > 0 || selected) {
          e.preventDefault();
          copySelectedToClipboard();
        }
        return;
      }

      // Paste: Ctrl+V / Cmd+V
      if (mod && !e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteFromClipboard();
        return;
      }

      // Group: Ctrl+G (not Shift)
      if (mod && !e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        groupSelectedItems();
        return;
      }

      // Ungroup: Ctrl+Shift+G
      if (mod && e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        ungroupSelectedItems();
        return;
      }

      // Arrow Keyboard Nudge (1mm, Shift=5mm)
      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown"
      ) {
        if (selectedIds.length > 0 || selected) {
          e.preventDefault();
          const step = e.shiftKey ? 5 : 1;
          let dx = 0;
          let dy = 0;
          if (e.key === "ArrowLeft") dx = -step;
          if (e.key === "ArrowRight") dx = step;
          if (e.key === "ArrowUp") dy = step;
          if (e.key === "ArrowDown") dy = -step;
          nudgeSelectedItems(dx, dy);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePressed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    setActiveWireStartPin,
    clearSelection,
    deleteSelectedItems,
    selectedIds,
    selected,
    copySelectedToClipboard,
    pasteFromClipboard,
    groupSelectedItems,
    ungroupSelectedItems,
    nudgeSelectedItems,
  ]);

  const isItemSelected = useCallback(
    (kind: SelectedTarget["kind"], id: string) =>
      selectedIds.some((s) => s.kind === kind && s.id === id) ||
      (selected?.kind === kind && selected.id === id),
    [selectedIds, selected]
  );

  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return { xMm: 0, yMm: 0 };
      const rect = el.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return {
        xMm: (sx - pan.x) / zoom,
        yMm: -(sy - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = Math.max(0.2, Math.min(8, zoom * factor));
    const scaleRatio = nextZoom / zoom;

    setPan({
      x: sx - (sx - pan.x) * scaleRatio,
      y: sy - (sy - pan.y) * scaleRatio,
    });
    setZoom(nextZoom);
  };

  const handleContainerPointerDownCapture = (e: React.PointerEvent) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const rect = containerRef.current?.getBoundingClientRect();
      const midX = (pts[0].x + pts[1].x) / 2 - (rect?.left ?? 0);
      const midY = (pts[0].y + pts[1].y) / 2 - (rect?.top ?? 0);
      pinchRef.current = {
        dist,
        midX,
        midY,
        zoom,
        panX: pan.x,
        panY: pan.y,
      };
      setDragState(null);
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (activePointersRef.current.size >= 2) return;
    if (e.button === 1 || spacePressed || canvasTool2D === "pan") {
      e.preventDefault();
      setDragState({
        type: "pan",
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      });
      return;
    }
    if (e.button === 0 && canvasTool2D === "measure") {
      e.stopPropagation();
      const raw = screenToWorld(e.clientX, e.clientY);
      const pt = {
        xMm: snapToGrid(raw.xMm, gridSnapMm),
        yMm: snapToGrid(raw.yMm, gridSnapMm),
      };
      if (!measureStart || (measureStart && measureEnd)) {
        setMeasureStart(pt);
        setMeasureEnd(null);
        setMeasureHover(pt);
      } else {
        setMeasureEnd(pt);
        setMeasureHover(null);
      }
      return;
    }
    if (e.button === 0) {
      const raw = screenToWorld(e.clientX, e.clientY);
      setDragState({
        type: "marquee",
        startWorldXMm: raw.xMm,
        startWorldYMm: raw.yMm,
        currentWorldXMm: raw.xMm,
        currentWorldYMm: raw.yMm,
        additive: e.shiftKey,
      });
      if (!e.shiftKey) {
        clearSelection();
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (activePointersRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const rect = containerRef.current?.getBoundingClientRect();
      const newMidX = (pts[0].x + pts[1].x) / 2 - (rect?.left ?? 0);
      const newMidY = (pts[0].y + pts[1].y) / 2 - (rect?.top ?? 0);
      const start = pinchRef.current;
      if (start.dist > 0) {
        const nextZoom = Math.max(0.2, Math.min(8, start.zoom * (newDist / start.dist)));
        const scaleRatio = nextZoom / start.zoom;
        setZoom(nextZoom);
        setPan({
          x: newMidX - (start.midX - start.panX) * scaleRatio,
          y: newMidY - (start.midY - start.panY) * scaleRatio,
        });
      }
      return;
    }

    const world = screenToWorld(e.clientX, e.clientY);
    setCursorWorld(world);
    if (canvasTool2D === "measure" && measureStart && !measureEnd) {
      setMeasureHover({
        xMm: snapToGrid(world.xMm, gridSnapMm),
        yMm: snapToGrid(world.yMm, gridSnapMm),
      });
    }

    if (!dragState) return;

    if (dragState.type === "pan") {
      setPan({
        x: dragState.startPanX + (e.clientX - dragState.startClientX),
        y: dragState.startPanY + (e.clientY - dragState.startClientY),
      });
      return;
    }

    if (dragState.type === "marquee") {
      setDragState({
        ...dragState,
        currentWorldXMm: world.xMm,
        currentWorldYMm: world.yMm,
      });
      return;
    }

    if (dragState.type === "multi-drag") {
      const rawDx = world.xMm - dragState.startWorldXMm;
      const rawDy = world.yMm - dragState.startWorldYMm;
      const targetDx = snapToGrid(rawDx, gridSnapMm);
      const targetDy = snapToGrid(rawDy, gridSnapMm);
      const deltaDx = targetDx - dragState.lastDxMm;
      const deltaDy = targetDy - dragState.lastDyMm;
      if (deltaDx !== 0 || deltaDy !== 0) {
        moveSelectedItems(deltaDx, deltaDy);
        setDragState({
          ...dragState,
          lastDxMm: targetDx,
          lastDyMm: targetDy,
        });
      }
      return;
    }

    if (dragState.type === "component") {
      const comp = components.find((c) => c.id === dragState.id);
      if (!comp) return;

      const rawTargetX = world.xMm - dragState.offsetXMm;
      const rawTargetY = world.yMm - dragState.offsetYMm;
      const dims = getRotatedDimensions(comp.widthMm, comp.heightMm, comp.rotationDeg ?? 0);

      const excludeIds = new Set<string>([comp.id]);
      if (comp.groupId) {
        for (const c of components) {
          if (c.groupId === comp.groupId) excludeIds.add(c.id);
        }
        for (const a of cadAssets) {
          if (a.groupId === comp.groupId) excludeIds.add(a.id);
        }
      }

      const targets = buildAlignmentTargetBoxes(
        components,
        cadAssets,
        rails,
        ducts,
        excludeIds
      );

      const alignResult = computeAlignmentGuides(
        {
          xMm: rawTargetX,
          yMm: rawTargetY,
          widthMm: dims.widthMm,
          heightMm: dims.heightMm,
        },
        targets
      );

      setAlignmentGuides(alignResult.guides);

      moveComponent(
        dragState.id,
        alignResult.xMm,
        alignResult.yMm,
        {
          skipGridSnapX: alignResult.snappedX,
          skipGridSnapY: alignResult.snappedY,
        }
      );
      return;
    }

    if (dragState.type === "cad") {
      const asset = cadAssets.find((a) => a.id === dragState.id);
      if (!asset) return;

      const rawTargetX = world.xMm - dragState.offsetXMm;
      const rawTargetY = world.yMm - dragState.offsetYMm;
      const eff = getEffectiveCadBounds(asset);
      const rot = asset.rotationDeg ?? 0;
      const dims = getRotatedDimensions(eff.widthMm, eff.heightMm, rot);
      const rotOff = rotateLocalPoint(eff.offsetX, eff.offsetY, rot);

      const excludeIds = new Set<string>([asset.id]);
      if (asset.groupId) {
        for (const c of components) {
          if (c.groupId === asset.groupId) excludeIds.add(c.id);
        }
        for (const a of cadAssets) {
          if (a.groupId === asset.groupId) excludeIds.add(a.id);
        }
      }

      const targets = buildAlignmentTargetBoxes(
        components,
        cadAssets,
        rails,
        ducts,
        excludeIds
      );

      const alignResult = computeAlignmentGuides(
        {
          xMm: rawTargetX + rotOff.xMm,
          yMm: rawTargetY + rotOff.yMm,
          widthMm: dims.widthMm,
          heightMm: dims.heightMm,
        },
        targets
      );

      setAlignmentGuides(alignResult.guides);

      moveCadAsset(
        dragState.id,
        alignResult.xMm - rotOff.xMm,
        alignResult.yMm - rotOff.yMm,
        {
          skipGridSnapX: alignResult.snappedX,
          skipGridSnapY: alignResult.snappedY,
        }
      );
      return;
    }

    if (dragState.type === "rail-move") {
      updateRail(dragState.id, {
        xMm: snapToGrid(world.xMm - dragState.offsetXMm, gridSnapMm),
        yMm: snapToGrid(world.yMm - dragState.offsetYMm, gridSnapMm),
      });
      return;
    }

    if (dragState.type === "rail-resize") {
      const dx = snapToGrid(world.xMm - dragState.startWorldXMm, gridSnapMm);
      const nextLen = Math.max(
        60,
        dragState.edge === "right"
          ? dragState.initialLengthMm + dx
          : dragState.initialLengthMm - dx
      );
      const nextX =
        dragState.edge === "right"
          ? dragState.initialXMm + (nextLen - dragState.initialLengthMm) / 2
          : dragState.initialXMm - (nextLen - dragState.initialLengthMm) / 2;
      updateRail(dragState.id, {
        lengthMm: nextLen,
        xMm: nextX,
      });
      return;
    }

    if (dragState.type === "duct-move") {
      updateDuct(dragState.id, {
        xMm: snapToGrid(world.xMm - dragState.offsetXMm, gridSnapMm),
        yMm: snapToGrid(world.yMm - dragState.offsetYMm, gridSnapMm),
      });
      return;
    }

    if (dragState.type === "duct-resize") {
      const d = dragState.initialDuct;
      const dx = snapToGrid(world.xMm - dragState.startWorldXMm, gridSnapMm);
      const dy = snapToGrid(world.yMm - dragState.startWorldYMm, gridSnapMm);
      if (dragState.edge === "right" || dragState.edge === "left") {
        const nextW = Math.max(
          20,
          dragState.edge === "right" ? d.widthMm + dx : d.widthMm - dx
        );
        const nextX =
          dragState.edge === "right"
            ? d.xMm + (nextW - d.widthMm) / 2
            : d.xMm - (nextW - d.widthMm) / 2;
        updateDuct(d.id, { widthMm: nextW, xMm: nextX });
      } else {
        const nextH = Math.max(
          20,
          dragState.edge === "top" ? d.heightMm + dy : d.heightMm - dy
        );
        const nextY =
          dragState.edge === "top"
            ? d.yMm + (nextH - d.heightMm) / 2
            : d.yMm - (nextH - d.heightMm) / 2;
        updateDuct(d.id, { heightMm: nextH, yMm: nextY });
      }
    }
  };

  const handlePointerUp = (e?: React.PointerEvent) => {
    if (e) {
      activePointersRef.current.delete(e.pointerId);
    } else {
      activePointersRef.current.clear();
    }
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    if (dragState?.type === "marquee") {
      const minX = Math.min(dragState.startWorldXMm, dragState.currentWorldXMm);
      const maxX = Math.max(dragState.startWorldXMm, dragState.currentWorldXMm);
      const minY = Math.min(dragState.startWorldYMm, dragState.currentWorldYMm);
      const maxY = Math.max(dragState.startWorldYMm, dragState.currentWorldYMm);

      if (maxX - minX > 1 || maxY - minY > 1) {
        const hits: SelectedTarget[] = [];

        for (const c of components) {
          const dims = getRotatedDimensions(c.widthMm, c.heightMm, c.rotationDeg ?? 0);
          const cx1 = c.xMm - dims.widthMm / 2;
          const cx2 = c.xMm + dims.widthMm / 2;
          const cy1 = c.yMm - dims.heightMm / 2;
          const cy2 = c.yMm + dims.heightMm / 2;
          if (cx1 <= maxX && cx2 >= minX && cy1 <= maxY && cy2 >= minY) {
            hits.push({ kind: "component", id: c.id });
          }
        }

        for (const a of cadAssets) {
          const eff = getEffectiveCadBounds(a);
          const rot = a.rotationDeg ?? 0;
          const dims = getRotatedDimensions(eff.widthMm, eff.heightMm, rot);
          const rotOffset = rotateLocalPoint(eff.offsetX, eff.offsetY, rot);
          const effCenterXMm = a.xMm + rotOffset.xMm;
          const effCenterYMm = a.yMm + rotOffset.yMm;
          const ax1 = effCenterXMm - dims.widthMm / 2;
          const ax2 = effCenterXMm + dims.widthMm / 2;
          const ay1 = effCenterYMm - dims.heightMm / 2;
          const ay2 = effCenterYMm + dims.heightMm / 2;
          if (ax1 <= maxX && ax2 >= minX && ay1 <= maxY && ay2 >= minY) {
            hits.push({ kind: "cad", id: a.id });
          }
        }

        if (dragState.additive) {
          const merged = [...selectedIds];
          for (const hit of hits) {
            if (!merged.some((s) => s.kind === hit.kind && s.id === hit.id)) {
              merged.push(hit);
            }
          }
          setSelectedIds(merged);
        } else {
          setSelectedIds(hits);
        }
      }
    }
    setAlignmentGuides([]);
    setDragState(null);
  };

  const handlePinClick = (componentId: string, pinId: string) => {
    if (!activeWireStartPin) {
      setActiveWireStartPin({ componentId, pinId });
      return;
    }
    if (
      activeWireStartPin.componentId === componentId &&
      activeWireStartPin.pinId === pinId
    ) {
      setActiveWireStartPin(null);
      return;
    }

    const wireNum = wires.length + 1;
    const prefix = activeWireColor === "PE" ? "PE" : activeWireColor === "N" ? "N" : "W";
    addWire({
      label: `${prefix}${String(wireNum).padStart(2, "0")}`,
      colorCode: activeWireColor,
      gaugeMm2: activeWireGauge,
      fromComponentId: activeWireStartPin.componentId,
      fromPinId: activeWireStartPin.pinId,
      toComponentId: componentId,
      toPinId: pinId,
    });
    setActiveWireStartPin(null);
  };

  // Pin lookup map for wire rendering (SVG coordinates: xMm, -yMm)
  const pinMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const c of components) {
      const rot = c.rotationDeg ?? 0;
      for (const p of c.pins) {
        const rotated = rotateLocalPoint(p.localXMm, p.localYMm, rot);
        map.set(`${c.id}:${p.id}`, {
          x: c.xMm + rotated.xMm,
          y: -(c.yMm + rotated.yMm),
        });
      }
    }
    for (const a of cadAssets) {
      const rot = a.rotationDeg ?? 0;
      for (const p of a.pins) {
        const rotated = rotateLocalPoint(p.localXMm, p.localYMm, rot);
        map.set(`${a.id}:${p.id}`, {
          x: a.xMm + rotated.xMm,
          y: -(a.yMm + rotated.yMm),
        });
      }
    }
    return map;
  }, [components, cadAssets]);

  // Plate-relative ruler ticks computation (origin 0,0 at top-left of mounting plate)
  const rulerSteps = getRulerStepsMm(zoom);
  const worldXMin = -pan.x / zoom;
  const worldXMax = (viewportSize.width - pan.x) / zoom;
  const worldYMax = pan.y / zoom;
  const worldYMin = (pan.y - viewportSize.height) / zoom;

  const plateXMin = worldToPlateX(worldXMin, plateW);
  const plateXMax = worldToPlateX(worldXMax, plateW);
  const plateYMin = worldToPlateY(worldYMax, plateH);
  const plateYMax = worldToPlateY(worldYMin, plateH);

  const xSubTicks = computePlateRulerSubTicks(plateXMin, plateXMax, rulerSteps);
  const ySubTicks = computePlateRulerSubTicks(plateYMin, plateYMax, rulerSteps);

  const plateLeftRulerPx = pan.x + plateToWorldX(0, plateW) * zoom - 24;
  const plateRightRulerPx = pan.x + plateToWorldX(plateW, plateW) * zoom - 24;
  const plateTopRulerPx = pan.y - plateToWorldY(0, plateH) * zoom - 24;
  const plateBottomRulerPx = pan.y - plateToWorldY(plateH, plateH) * zoom - 24;

  const selectionFootprint = useMemo(
    () =>
      computeSelectionFootprint({
        selected,
        selectedIds,
        components,
        cadAssets,
        rails,
        ducts,
        plateWidthMm: plateW,
        plateHeightMm: plateH,
      }),
    [selected, selectedIds, components, cadAssets, rails, ducts, plateW, plateH]
  );

  const cursorPlate = cursorWorld
    ? {
        xMm: worldToPlateX(cursorWorld.xMm, plateW),
        yMm: worldToPlateY(cursorWorld.yMm, plateH),
        topRulerLeftPx: pan.x + cursorWorld.xMm * zoom - 24,
        leftRulerTopPx: pan.y - cursorWorld.yMm * zoom - 24,
      }
    : null;

  // Title block geometry (bottom-right of sheet)
  const tbW = 264;
  const tbH = 44;
  const tbX = sheetW / 2 - 12 - tbW;
  const tbY = sheetH / 2 - 12 - tbH;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-white dark:bg-[#090b10] select-none touch-none"
      onWheel={handleWheel}
      onPointerDownCapture={handleContainerPointerDownCapture}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => {
        setCursorWorld(null);
        handlePointerUp();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        const worldPos = screenToWorld(e.clientX, e.clientY);
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          target: { kind: "canvas", worldPos },
        });
      }}
    >
      {/* Top Engineering Ruler (Plate Top-Left Origin: 0 -> plateW) */}
      <div className="pointer-events-none absolute top-0 right-0 left-6 z-20 h-6 overflow-hidden border-b border-[#e2e8f0] dark:border-white/10 bg-white/95 dark:bg-[#0c0e14]/90 font-mono text-[9px] text-[#64748b] dark:text-slate-400 backdrop-blur-md">
        {/* Dimmed out-of-plate zones */}
        {plateLeftRulerPx > 0 && (
          <div
            style={{ left: 0, width: plateLeftRulerPx }}
            className="absolute top-0 bottom-0 bg-slate-200/45 dark:bg-black/45"
          />
        )}
        <div
          style={{ left: Math.max(0, plateRightRulerPx), right: 0 }}
          className="absolute top-0 bottom-0 bg-slate-200/45 dark:bg-black/45"
        />

        {/* Selection Footprint Highlight (X1..X2) */}
        {selectionFootprint && (() => {
          const fpLeft = pan.x + plateToWorldX(selectionFootprint.x1Mm, plateW) * zoom - 24;
          const fpRight = pan.x + plateToWorldX(selectionFootprint.x2Mm, plateW) * zoom - 24;
          const fpWidth = Math.max(2, fpRight - fpLeft);
          return (
            <div
              style={{ left: fpLeft, width: fpWidth }}
              className="absolute top-0 bottom-0 border-x border-sky-500/80 bg-sky-500/20 dark:border-sky-400/80 dark:bg-sky-400/20"
            />
          );
        })()}

        {/* Ruler Sub-Ticks (Major 10px + label, Medium 6px, Minor 3px) */}
        {xSubTicks.map((tick) => {
          const left = pan.x + plateToWorldX(tick.mm, plateW) * zoom - 24;
          if (left < 0) return null;
          const isOutsidePlate = tick.mm < 0 || tick.mm > plateW;
          const isOrigin = tick.mm === 0;
          if (tick.kind === "major") {
            return (
              <div
                key={tick.mm}
                style={{ transform: `translateX(${left}px)` }}
                className="absolute top-0 bottom-0"
              >
                <div
                  className={`absolute bottom-0 left-0 h-[10px] w-px ${
                    isOrigin
                      ? "bg-sky-500/90 dark:bg-sky-400"
                      : isOutsidePlate
                        ? "bg-[#cbd5e1]/60 dark:bg-white/10"
                        : "bg-[#64748b] dark:bg-slate-400"
                  }`}
                />
                <span
                  className={`absolute top-0.5 left-1 leading-none ${
                    isOrigin
                      ? "font-bold text-sky-600 dark:text-sky-400"
                      : isOutsidePlate
                        ? "text-[#94a3b8]/70 dark:text-slate-600"
                        : "text-[#475569] dark:text-slate-300"
                  }`}
                >
                  {tick.mm}
                </span>
              </div>
            );
          }
          const tickHeightClass = tick.kind === "medium" ? "h-[6px]" : "h-[3px]";
          const tickColorClass = isOutsidePlate
            ? "bg-[#cbd5e1]/40 dark:bg-white/5"
            : tick.kind === "medium"
              ? "bg-[#94a3b8] dark:bg-slate-500"
              : "bg-[#cbd5e1] dark:bg-slate-600";
          return (
            <div
              key={tick.mm}
              style={{ transform: `translateX(${left}px)` }}
              className={`absolute bottom-0 w-px ${tickHeightClass} ${tickColorClass}`}
            />
          );
        })}

        {/* Cursor Hairline Tracker */}
        {cursorPlate && cursorPlate.topRulerLeftPx >= 0 && (
          <div
            style={{ transform: `translateX(${cursorPlate.topRulerLeftPx}px)` }}
            className="absolute top-0 bottom-0 z-10 w-[1.5px] bg-rose-500 dark:bg-rose-400"
          >
            <span className="absolute top-0.5 left-1 rounded bg-rose-500 px-1 py-[1px] text-[8px] font-semibold leading-none text-white shadow-xs dark:bg-rose-400 dark:text-slate-950">
              {Math.round(cursorPlate.xMm)}
            </span>
          </div>
        )}
      </div>

      {/* Left Engineering Ruler (Plate Top-Left Origin: 0 -> plateH downward) */}
      <div className="pointer-events-none absolute top-6 bottom-0 left-0 z-20 w-6 overflow-hidden border-r border-[#e2e8f0] dark:border-white/10 bg-white/95 dark:bg-[#0c0e14]/90 font-mono text-[9px] text-[#64748b] dark:text-slate-400 backdrop-blur-md">
        {/* Dimmed out-of-plate zones */}
        {plateTopRulerPx > 0 && (
          <div
            style={{ top: 0, height: plateTopRulerPx }}
            className="absolute right-0 left-0 bg-slate-200/45 dark:bg-black/45"
          />
        )}
        <div
          style={{ top: Math.max(0, plateBottomRulerPx), bottom: 0 }}
          className="absolute right-0 left-0 bg-slate-200/45 dark:bg-black/45"
        />

        {/* Selection Footprint Highlight (Y1..Y2) */}
        {selectionFootprint && (() => {
          const fpTop = pan.y - plateToWorldY(selectionFootprint.y1Mm, plateH) * zoom - 24;
          const fpBottom = pan.y - plateToWorldY(selectionFootprint.y2Mm, plateH) * zoom - 24;
          const fpHeight = Math.max(2, fpBottom - fpTop);
          return (
            <div
              style={{ top: fpTop, height: fpHeight }}
              className="absolute right-0 left-0 border-y border-sky-500/80 bg-sky-500/20 dark:border-sky-400/80 dark:bg-sky-400/20"
            />
          );
        })()}

        {/* Ruler Sub-Ticks (Major 10px + label, Medium 6px, Minor 3px) */}
        {ySubTicks.map((tick) => {
          const top = pan.y - plateToWorldY(tick.mm, plateH) * zoom - 24;
          if (top < 0) return null;
          const isOutsidePlate = tick.mm < 0 || tick.mm > plateH;
          const isOrigin = tick.mm === 0;
          if (tick.kind === "major") {
            return (
              <div
                key={tick.mm}
                style={{ transform: `translateY(${top}px)` }}
                className="absolute right-0 left-0"
              >
                <div
                  className={`absolute top-0 right-0 h-px w-[10px] ${
                    isOrigin
                      ? "bg-sky-500/90 dark:bg-sky-400"
                      : isOutsidePlate
                        ? "bg-[#cbd5e1]/60 dark:bg-white/10"
                        : "bg-[#64748b] dark:bg-slate-400"
                  }`}
                />
                <span
                  className={`block pt-0.5 pr-1 text-center text-[8px] leading-none ${
                    isOrigin
                      ? "font-bold text-sky-600 dark:text-sky-400"
                      : isOutsidePlate
                        ? "text-[#94a3b8]/70 dark:text-slate-600"
                        : "text-[#475569] dark:text-slate-300"
                  }`}
                >
                  {tick.mm}
                </span>
              </div>
            );
          }
          const tickWidthClass = tick.kind === "medium" ? "w-[6px]" : "w-[3px]";
          const tickColorClass = isOutsidePlate
            ? "bg-[#cbd5e1]/40 dark:bg-white/5"
            : tick.kind === "medium"
              ? "bg-[#94a3b8] dark:bg-slate-500"
              : "bg-[#cbd5e1] dark:bg-slate-600";
          return (
            <div
              key={tick.mm}
              style={{ transform: `translateY(${top}px)` }}
              className={`absolute right-0 h-px ${tickWidthClass} ${tickColorClass}`}
            />
          );
        })}

        {/* Cursor Hairline Tracker */}
        {cursorPlate && cursorPlate.leftRulerTopPx >= 0 && (
          <div
            style={{ transform: `translateY(${cursorPlate.leftRulerTopPx}px)` }}
            className="absolute right-0 left-0 z-10 h-[1.5px] bg-rose-500 dark:bg-rose-400"
          >
            <span className="absolute top-0.5 left-0.5 rounded bg-rose-500 px-0.5 py-[1px] text-[7px] font-semibold leading-none text-white shadow-xs dark:bg-rose-400 dark:text-slate-950">
              {Math.round(cursorPlate.yMm)}
            </span>
          </div>
        )}
      </div>

      {/* Corner Origin Badge */}
      <div className="pointer-events-none absolute top-0 left-0 z-30 flex h-6 w-6 items-center justify-center border-r border-b border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#111318] font-mono text-[8px] font-bold text-[#0f172a] dark:text-slate-300">
        mm
      </div>

      {/* Top Floating Pill Toolbar (Centered ala RelayFlow) */}
      <div className="absolute top-8 sm:top-9 left-1/2 -translate-x-1/2 z-20 flex max-w-[95vw] sm:max-w-[94%] flex-nowrap sm:flex-wrap items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar rounded-full border border-[#e2e8f0] dark:border-white/10 bg-white/95 dark:bg-[#171a21]/95 px-2 sm:px-3 py-1 sm:py-1.5 shadow-sm dark:shadow-2xl backdrop-blur-xl">
        <div className="flex shrink-0 items-center rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#0c0e14] p-0.5">
          <button
            type="button"
            onClick={() => setCanvasTool2D("select")}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
              canvasTool2D === "select"
                ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
            }`}
            title="Select & Move (Click & Drag)"
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            Select
          </button>
          <button
            type="button"
            onClick={() => setCanvasTool2D("wire")}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
              canvasTool2D === "wire"
                ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
            }`}
            title="Wire Connection Tool (Click Pin A -> Pin B)"
          >
            <Cable className="h-3.5 w-3.5" />
            Wire
          </button>
          <button
            type="button"
            onClick={() => setCanvasTool2D("measure")}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
              canvasTool2D === "measure"
                ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
            }`}
            title="Measure Dimension Tool (Click Point A -> Point B, Esc to clear)"
          >
            <Ruler className="h-3.5 w-3.5" />
            Measure
          </button>
          <button
            type="button"
            onClick={() => setCanvasTool2D("pan")}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
              canvasTool2D === "pan"
                ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
            }`}
            title="Pan Canvas (or Space + Drag)"
          >
            <Hand className="h-3.5 w-3.5" />
            Pan
          </button>
        </div>

        {/* Undo / Redo in Toolbar */}
        <div className="flex shrink-0 items-center rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#0c0e14] p-0.5">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="flex items-center rounded-full p-1 text-[#334155] dark:text-slate-300 hover:bg-[#e2e8f0] dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            className="flex items-center rounded-full p-1 text-[#334155] dark:text-slate-300 hover:bg-[#e2e8f0] dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Grid Snap Selector Pill */}
        <div className="flex shrink-0 items-center rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#0c0e14] p-0.5">
          {([5, 10, 25] as GridSnapMm[]).map((snap) => (
            <button
              key={snap}
              type="button"
              onClick={() => setGridSnapMm(snap)}
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] transition-all ${
                gridSnapMm === snap
                  ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-bold shadow-xs"
                  : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
              }`}
            >
              {snap}mm
            </button>
          ))}
        </div>

        {/* Wire Options when Wire Tool Active */}
        {canvasTool2D === "wire" && (
          <div className="flex items-center gap-1.5 border-l border-[#e2e8f0] dark:border-white/10 pl-2">
            <div className="flex items-center gap-1">
              {WIRE_COLORS.map((wc) => (
                <button
                  key={wc.code}
                  type="button"
                  onClick={() => setActiveWireColor(wc.code)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-all ${
                    activeWireColor === wc.code
                      ? "border-[#0f172a] dark:border-white bg-slate-200 dark:bg-white/20 text-[#0f172a] dark:text-white font-bold"
                      : "border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#0c0e14] text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: wc.hex }}
                  />
                  {wc.code}
                </button>
              ))}
            </div>
            <select
              value={activeWireGauge}
              onChange={(e) => setActiveWireGauge(e.target.value)}
              className="rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#0c0e14] px-2 py-0.5 font-mono text-[10px] text-[#0f172a] dark:text-slate-200 outline-none"
            >
              <option value="0.75">0.75 mm² (Ø2.4)</option>
              <option value="1.0">1.0 mm² (Ø2.7)</option>
              <option value="1.5">1.5 mm² (Ø3.0)</option>
              <option value="2.5">2.5 mm² (Ø3.7)</option>
              <option value="4.0">4.0 mm² (Ø4.4)</option>
              <option value="6.0">6.0 mm² (Ø5.2)</option>
              <option value="10.0">10.0 mm² (Ø6.5)</option>
              <option value="16.0">16.0 mm² (Ø8.0)</option>
            </select>
            <button
              type="button"
              onClick={() => setAutoRouteDuctsEnabled(!autoRouteDuctsEnabled)}
              title="Auto-route new wires through nearby Wire Ducts"
              className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] transition-all ${
                autoRouteDuctsEnabled && ducts.length > 0
                  ? "border-sky-500/60 bg-sky-500/15 text-sky-600 dark:text-sky-300 font-semibold"
                  : "border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#0c0e14] text-[#64748b] dark:text-slate-400"
              }`}
            >
              <span>{autoRouteDuctsEnabled && ducts.length > 0 ? "Duct Auto-Route: ON" : "Duct Auto-Route: OFF"}</span>
            </button>
            <button
              type="button"
              disabled={wires.length === 0}
              onClick={() => autoNumberWires()}
              title="Auto-number all wires on active sheet (EPLAN: L1-x, L2-x, N-x, PE-x, W01...)"
              className="flex items-center gap-1 rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#0c0e14] px-2.5 py-0.5 font-mono text-[10px] text-[#0f172a] dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-40 transition-all"
            >
              <Hash className="h-3 w-3 text-emerald-500" />
              <span>Auto-Number</span>
            </button>
            {activeWireStartPin && (
              <span className="font-mono text-[10px] font-semibold text-amber-500 animate-pulse">
                Click target pin...
              </span>
            )}
          </div>
        )}

        {canvasTool2D === "measure" && (
          <div className="flex items-center gap-2 border-l border-[#e2e8f0] dark:border-white/10 pl-2">
            <span className="font-mono text-[10px] font-semibold text-sky-600 dark:text-sky-400">
              {!measureStart
                ? "Click point A"
                : !measureEnd
                ? "Click point B"
                : "Measured (Esc clear)"}
            </span>
          </div>
        )}

        {(collisionReport.overlappingIds.size > 0 ||
          collisionReport.outOfBoundsIds.size > 0) && (
          <div className="flex items-center gap-1.5 border-l border-[#e2e8f0] dark:border-white/10 pl-2">
            <span className="rounded-full border border-rose-500/40 bg-rose-50 dark:bg-rose-950/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-rose-700 dark:text-rose-300">
              {collisionReport.overlappingIds.size > 0 &&
                `${collisionReport.overlapPairs.length} overlap`}
              {collisionReport.overlappingIds.size > 0 &&
                collisionReport.outOfBoundsIds.size > 0 &&
                " · "}
              {collisionReport.outOfBoundsIds.size > 0 &&
                `${collisionReport.outOfBoundsIds.size} OOB`}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Floating Status Pills (Senada RelayFlow) */}
      {/* Bottom Left / Center: Cursor & Snap Coordinates + Zoom Controls */}
      <div className="absolute bottom-2 sm:bottom-3 left-7 sm:left-9 z-20 flex max-w-[calc(100vw-3.5rem)] flex-wrap items-center gap-1.5 sm:gap-2">
        <div className="hidden sm:inline-flex rounded-full border border-[#e2e8f0] dark:border-white/10 bg-white/95 dark:bg-[#171a21]/95 px-3 py-1 font-mono text-[11px] tabular-nums text-[#0f172a] dark:text-slate-300 shadow-sm dark:shadow-xl backdrop-blur-xl">
          {cursorPlate
            ? `X: ${Math.round(cursorPlate.xMm)}mm | Y: ${Math.round(
                cursorPlate.yMm
              )}mm | Snap: ${gridSnapMm}mm`
            : `Snap: ${gridSnapMm}mm`}
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 rounded-full border border-[#e2e8f0] dark:border-white/10 bg-white/95 dark:bg-[#171a21]/95 p-0.5 shadow-sm dark:shadow-xl backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))}
            className="rounded-full p-1 text-[#64748b] dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[36px] sm:min-w-[42px] text-center font-mono text-[10px] sm:text-[11px] font-medium tabular-nums text-[#0f172a] dark:text-slate-200">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(8, z * 1.2))}
            className="rounded-full p-1 text-[#64748b] dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={fitToView}
            className="flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 font-mono text-[10px] text-[#64748b] dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white transition-colors"
            title="Fit Sheet to View"
          >
            <Maximize2 className="h-3 w-3" />
            <span className="hidden sm:inline">Fit</span>
          </button>
        </div>
      </div>

      {/* Bottom Right: Parts & Wires Count & Collisions Pill */}
      <div className="pointer-events-none absolute right-2 sm:right-4 bottom-2 sm:bottom-3 z-20 flex items-center gap-1.5 sm:gap-2 rounded-full border border-[#e2e8f0] dark:border-white/10 bg-white/95 dark:bg-[#171a21]/95 px-2.5 sm:px-3 py-1 font-mono text-[10px] sm:text-[11px] text-[#0f172a] dark:text-slate-300 shadow-sm dark:shadow-xl backdrop-blur-xl">
        <span>Parts: {components.length + cadAssets.length}</span>
        <span className="text-[#cbd5e1] dark:text-white/20">|</span>
        <span>Wires: {wires.length}</span>
        {collisionReport.overlappingIds.size > 0 && (
          <>
            <span className="text-[#cbd5e1] dark:text-white/20">|</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              {collisionReport.overlapPairs.length} <span className="hidden sm:inline">Overlaps</span><span className="sm:hidden">Ovl</span>
            </span>
          </>
        )}
      </div>

      {/* Main Interactive SVG Canvas */}
      <svg
        className={`h-full w-full touch-none ${
          spacePressed || canvasTool2D === "pan"
            ? "cursor-grab active:cursor-grabbing"
            : canvasTool2D === "wire"
            ? "cursor-crosshair"
            : "cursor-default"
        }`}
        onPointerDown={handleCanvasPointerDown}
      >
        <defs>
          <pattern
            id="grid-dots"
            width={gridSnapMm}
            height={gridSnapMm}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={0}
              cy={0}
              r={0.7}
              fill={theme === "light" ? "#cbd5e1" : "#161920"}
            />
          </pattern>
          <pattern
            id="duct-hatch"
            width="6"
            height="6"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke={theme === "light" ? "#cbd5e1" : "#252932"}
              strokeWidth="1"
            />
          </pattern>
          <marker
            id="measure-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 1 L 10 5 L 0 9 z"
              fill={theme === "light" ? "#0f172a" : "#ffffff"}
            />
          </marker>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Technical Drawing Sheet Outline (Dark Obsidian / Light Clean White) */}
          <g>
            <rect
              x={-sheetW / 2}
              y={-sheetH / 2}
              width={sheetW}
              height={sheetH}
              fill={theme === "light" ? "#ffffff" : "#090b10"}
              stroke={theme === "light" ? "#e2e8f0" : "#1a1e27"}
              strokeWidth={1.2}
              filter={
                theme === "light"
                  ? "drop-shadow(0 6px 20px rgba(15,23,42,0.08))"
                  : "drop-shadow(0 8px 24px rgba(0,0,0,0.6))"
              }
            />
            <rect
              x={-sheetW / 2 + 8}
              y={-sheetH / 2 + 8}
              width={sheetW - 16}
              height={sheetH - 16}
              fill="none"
              stroke={theme === "light" ? "#edf2f7" : "#161920"}
              strokeWidth={0.5}
            />
          </g>

          {/* Dedicated Door Cutout Canvas or Backplate Boundary */}
          {activeSheetType === "door-cutout" ? (
            <EnclosureDoor2D
              enclosure={enclosure}
              components={components}
              theme={theme}
              showDimensions={true}
            />
          ) : (
            <g>
              <rect
                x={-plateW / 2}
                y={-plateH / 2}
                width={plateW}
                height={plateH}
                fill="url(#grid-dots)"
                stroke={theme === "light" ? "#94a3b8" : "#252932"}
                strokeWidth={1.4}
              />
              {/* Backplate Dimension Annotations */}
              <text
                x={0}
                y={-plateH / 2 - 8}
                fontSize={8}
                fontFamily="monospace"
                fill={theme === "light" ? "#334155" : "#64748b"}
                textAnchor="middle"
              >
                MOUNTING PLATE: {plateW} x {plateH} mm
              </text>
            </g>
          )}

          {/* Wire Ducts Layer */}
          <g>
            {ducts.map((d) => {
              const x = d.xMm - d.widthMm / 2;
              const y = -(d.yMm + d.heightMm / 2);
              const isSelected = isItemSelected("duct", d.id);

              return (
                <g key={d.id}>
                  <g
                    onPointerDown={(e) => {
                      if (e.button !== 0 || canvasTool2D !== "select" || spacePressed) return;
                      e.stopPropagation();
                      if (e.shiftKey) {
                        toggleSelectId({ kind: "duct", id: d.id });
                        return;
                      }
                      const w = screenToWorld(e.clientX, e.clientY);
                      if (selectedIds.length > 1 && isSelected) {
                        pushUndoSnapshot();
                        setDragState({
                          type: "multi-drag",
                          startWorldXMm: w.xMm,
                          startWorldYMm: w.yMm,
                          lastDxMm: 0,
                          lastDyMm: 0,
                        });
                        return;
                      }
                      setSelected({ kind: "duct", id: d.id });
                      setDragState({
                        type: "duct-move",
                        id: d.id,
                        offsetXMm: w.xMm - d.xMm,
                        offsetYMm: w.yMm - d.yMm,
                      });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (selectedIds.length > 1 && isSelected) {
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          target: { kind: "multi" },
                        });
                        return;
                      }
                      setSelected({ kind: "duct", id: d.id });
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        target: { kind: "duct", id: d.id },
                      });
                    }}
                    className="cursor-move"
                  >
                    <rect
                      x={x}
                      y={y}
                      width={d.widthMm}
                      height={d.heightMm}
                      fill="url(#duct-hatch)"
                      fillOpacity={0.35}
                      stroke={isSelected ? "#0284c7" : "#64748b"}
                      strokeWidth={isSelected ? 1.2 : 0.7}
                      strokeDasharray="3,2"
                    />
                    <text
                      x={x + 4}
                      y={y + 10}
                      fontSize={5.5}
                      fontFamily="monospace"
                      fill="#475569"
                    >
                      {d.name} ({d.widthMm}x{d.heightMm})
                    </text>
                    {(() => {
                      const fillStats = ductFillMap.get(d.id);
                      if (!fillStats) return null;
                      const colors = getDuctFillStatusColor(fillStats.status);
                      const isHoriz = d.orientation === "horizontal";
                      const crossW = isHoriz ? d.heightMm : d.widthMm;
                      const crossH = d.depthMm || crossW;
                      const badgeText = `${crossW}x${crossH} [${fillStats.fillRatioPercent}%]`;
                      const badgeW = 34;
                      const badgeH = 9;
                      const bx = isHoriz ? x + d.widthMm - badgeW - 3 : x + (d.widthMm - badgeW) / 2;
                      const by = isHoriz ? y + 3 : y + d.heightMm - badgeH - 4;
                      return (
                        <g pointerEvents="none">
                          <rect
                            x={bx}
                            y={by}
                            width={badgeW}
                            height={badgeH}
                            rx={2}
                            fill={colors.badgeBg}
                            stroke={colors.badgeBorder}
                            strokeWidth={0.5}
                          />
                          <text
                            x={bx + badgeW / 2}
                            y={by + badgeH / 2 + 0.3}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={4}
                            fontFamily="monospace"
                            fontWeight="bold"
                            fill={colors.badgeText}
                          >
                            {badgeText}
                          </text>
                        </g>
                      );
                    })()}
                  </g>

                  {/* Duct Resize Handles */}
                  {isSelected && canvasTool2D === "select" && (
                    <>
                      <rect
                        x={x + d.widthMm - 3}
                        y={-d.yMm - 3}
                        width={6}
                        height={6}
                        fill="#0284c7"
                        className="cursor-ew-resize"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const w = screenToWorld(e.clientX, e.clientY);
                          setDragState({
                            type: "duct-resize",
                            id: d.id,
                            edge: "right",
                            initialDuct: d,
                            startWorldXMm: w.xMm,
                            startWorldYMm: w.yMm,
                          });
                        }}
                      />
                      <rect
                        x={d.xMm - 3}
                        y={y - 3}
                        width={6}
                        height={6}
                        fill="#0284c7"
                        className="cursor-ns-resize"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const w = screenToWorld(e.clientX, e.clientY);
                          setDragState({
                            type: "duct-resize",
                            id: d.id,
                            edge: "top",
                            initialDuct: d,
                            startWorldXMm: w.xMm,
                            startWorldYMm: w.yMm,
                          });
                        }}
                      />
                    </>
                  )}
                </g>
              );
            })}
          </g>

          {/* DIN Rails Layer (TH35) */}
          <g>
            {rails.map((r: DinRail) => {
              const x = r.xMm - r.lengthMm / 2;
              const y = -(r.yMm + 17.5);
              const isSelected = isItemSelected("rail", r.id);

              const holes: number[] = [];
              for (
                let hx = x + 12.5;
                hx <= x + r.lengthMm - 12.5;
                hx += 25
              ) {
                holes.push(hx);
              }

              return (
                <g key={r.id}>
                  <g
                    onPointerDown={(e) => {
                      if (e.button !== 0 || canvasTool2D !== "select" || spacePressed) return;
                      e.stopPropagation();
                      if (e.shiftKey) {
                        toggleSelectId({ kind: "rail", id: r.id });
                        return;
                      }
                      const w = screenToWorld(e.clientX, e.clientY);
                      if (selectedIds.length > 1 && isSelected) {
                        pushUndoSnapshot();
                        setDragState({
                          type: "multi-drag",
                          startWorldXMm: w.xMm,
                          startWorldYMm: w.yMm,
                          lastDxMm: 0,
                          lastDyMm: 0,
                        });
                        return;
                      }
                      setSelected({ kind: "rail", id: r.id });
                      setDragState({
                        type: "rail-move",
                        id: r.id,
                        offsetXMm: w.xMm - r.xMm,
                        offsetYMm: w.yMm - r.yMm,
                      });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (selectedIds.length > 1 && isSelected) {
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          target: { kind: "multi" },
                        });
                        return;
                      }
                      setSelected({ kind: "rail", id: r.id });
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        target: { kind: "rail", id: r.id },
                      });
                    }}
                    className="cursor-move"
                  >
                    <rect
                      x={x}
                      y={y}
                      width={r.lengthMm}
                      height={35}
                      fill="#94a3b8"
                      fillOpacity={0.22}
                      stroke={isSelected ? "#0284c7" : "#475569"}
                      strokeWidth={isSelected ? 1.2 : 0.8}
                    />
                    <line
                      x1={x}
                      y1={y + 6}
                      x2={x + r.lengthMm}
                      y2={y + 6}
                      stroke="#64748b"
                      strokeWidth={0.4}
                    />
                    <line
                      x1={x}
                      y1={y + 29}
                      x2={x + r.lengthMm}
                      y2={y + 29}
                      stroke="#64748b"
                      strokeWidth={0.4}
                    />
                    {holes.map((hx, idx) => (
                      <circle
                        key={idx}
                        cx={hx}
                        cy={y + 17.5}
                        r={1.6}
                        fill="#ffffff"
                        stroke="#475569"
                        strokeWidth={0.4}
                      />
                    ))}
                    <text
                      x={x + 6}
                      y={y + 13}
                      fontSize={6}
                      fontFamily="monospace"
                      fontWeight="bold"
                      fill="#1e293b"
                    >
                      {r.name} ({r.lengthMm}mm)
                    </text>
                  </g>

                  {/* Rail Resize Handles */}
                  {isSelected && canvasTool2D === "select" && (
                    <>
                      <rect
                        x={x - 3}
                        y={y + 14.5}
                        width={6}
                        height={6}
                        fill="#0284c7"
                        className="cursor-ew-resize"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const w = screenToWorld(e.clientX, e.clientY);
                          setDragState({
                            type: "rail-resize",
                            id: r.id,
                            edge: "left",
                            initialXMm: r.xMm,
                            initialLengthMm: r.lengthMm,
                            startWorldXMm: w.xMm,
                          });
                        }}
                      />
                      <rect
                        x={x + r.lengthMm - 3}
                        y={y + 14.5}
                        width={6}
                        height={6}
                        fill="#0284c7"
                        className="cursor-ew-resize"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const w = screenToWorld(e.clientX, e.clientY);
                          setDragState({
                            type: "rail-resize",
                            id: r.id,
                            edge: "right",
                            initialXMm: r.xMm,
                            initialLengthMm: r.lengthMm,
                            startWorldXMm: w.xMm,
                          });
                        }}
                      />
                    </>
                  )}
                </g>
              );
            })}
          </g>

          {/* Components Layer */}
          <g>
            {components.map((comp) => {
              const isSelected = isItemSelected("component", comp.id);
              return (
              <Component2DSymbol
                key={comp.id}
                comp={comp}
                isSelected={isSelected}
                isWireMode={canvasTool2D === "wire"}
                activeWireStartPin={activeWireStartPin}
                hasCollision={collisionReport.overlappingIds.has(comp.id)}
                isOutOfBounds={collisionReport.outOfBoundsIds.has(comp.id)}
                onPointerDown={(e) => {
                  if (e.button !== 0 || canvasTool2D !== "select" || spacePressed) return;
                  e.stopPropagation();
                  if (e.shiftKey) {
                    toggleSelectId({ kind: "component", id: comp.id });
                    return;
                  }
                  const w = screenToWorld(e.clientX, e.clientY);
                  if (selectedIds.length > 1 && isSelected) {
                    pushUndoSnapshot();
                    setDragState({
                      type: "multi-drag",
                      startWorldXMm: w.xMm,
                      startWorldYMm: w.yMm,
                      lastDxMm: 0,
                      lastDyMm: 0,
                    });
                    return;
                  }
                  setSelected({ kind: "component", id: comp.id });
                  if (!comp.locked) {
                    setDragState({
                      type: "component",
                      id: comp.id,
                      offsetXMm: w.xMm - comp.xMm,
                      offsetYMm: w.yMm - comp.yMm,
                    });
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (selectedIds.length > 1 && isSelected) {
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      target: { kind: "multi" },
                    });
                    return;
                  }
                  setSelected({ kind: "component", id: comp.id });
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    target: { kind: "component", id: comp.id },
                  });
                }}
                onPinClick={(e, pinId) => {
                  e.stopPropagation();
                  handlePinClick(comp.id, pinId);
                }}
              />
              );
            })}
          </g>

          {/* Custom CAD Assets Layer */}
          <g>
            {cadAssets.map((asset) => {
              const isMarkingThis =
                isPinMarkingMode && activeMarkingAssetId === asset.id;
              const isSelected = isItemSelected("cad", asset.id);
              return (
                <CadAsset2DSymbol
                  key={asset.id}
                  asset={asset}
                  isSelected={isSelected}
                  isMarkingThis={isMarkingThis}
                  isWireMode={canvasTool2D === "wire"}
                  isDark={theme === "dark"}
                  obstacleBoxes={cadObstacleBoxes}
                  activeWireStartPin={activeWireStartPin}
                  onPointerDown={(e) => {
                    if (e.button !== 0 || spacePressed) return;
                    if (isMarkingThis) {
                      e.stopPropagation();
                      const w = screenToWorld(e.clientX, e.clientY);
                      addPinToAsset(asset.id, {
                        label: `P${asset.pins.length + 1}`,
                        localXMm: Number((w.xMm - asset.xMm).toFixed(1)),
                        localYMm: Number((w.yMm - asset.yMm).toFixed(1)),
                        localZMm: 0,
                      });
                      return;
                    }
                    if (canvasTool2D !== "select") return;
                    e.stopPropagation();
                    if (e.shiftKey) {
                      toggleSelectId({ kind: "cad", id: asset.id });
                      return;
                    }
                    const w = screenToWorld(e.clientX, e.clientY);
                    if (selectedIds.length > 1 && isSelected) {
                      pushUndoSnapshot();
                      setDragState({
                        type: "multi-drag",
                        startWorldXMm: w.xMm,
                        startWorldYMm: w.yMm,
                        lastDxMm: 0,
                        lastDyMm: 0,
                      });
                      return;
                    }
                    setSelected({ kind: "cad", id: asset.id });
                    if (!asset.locked) {
                      setDragState({
                        type: "cad",
                        id: asset.id,
                        offsetXMm: w.xMm - asset.xMm,
                        offsetYMm: w.yMm - asset.yMm,
                      });
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (selectedIds.length > 1 && isSelected) {
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        target: { kind: "multi" },
                      });
                      return;
                    }
                    setSelected({ kind: "cad", id: asset.id });
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      target: { kind: "cad", id: asset.id },
                    });
                  }}
                  onPinClick={(e, pinId) => {
                    e.stopPropagation();
                    handlePinClick(asset.id, pinId);
                  }}
                />
              );
            })}
          </g>

          {/* Wires / Netlist Layer */}
          <g>
            {wires.map((w) => {
              const p1 = pinMap.get(`${w.fromComponentId}:${w.fromPinId}`);
              const p2 = pinMap.get(`${w.toComponentId}:${w.toPinId}`);
              if (!p1 || !p2) return null;

              const waypoints =
                w.waypoints && w.waypoints.length >= 2
                  ? w.waypoints.map((pt) => ({ x: pt.xMm, y: -pt.yMm }))
                  : routeOrthogonalWire(p1, p2, "horizontal-first");
              const pathD = pointsToRoundedSvgPath(waypoints, 4);
              const stroke = WIRE_COLOR_MAP[w.colorCode] || "#2563eb";
              const wireDiaMm = getWireOuterDiameterMm(w.gaugeMm2);
              const isSelected = isItemSelected("wire", w.id);

              // Place label at the exact midpoint of the longest straight span
              let mid = p1;
              let bestLen = -1;
              for (let i = 0; i < waypoints.length - 1; i++) {
                const a = waypoints[i];
                const b = waypoints[i + 1];
                const len = Math.hypot(b.x - a.x, b.y - a.y);
                if (len > bestLen) {
                  bestLen = len;
                  mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                }
              }

              return (
                <g
                  key={w.id}
                  onPointerDown={(e) => {
                    if (e.button !== 0 || canvasTool2D !== "select" || spacePressed) return;
                    e.stopPropagation();
                    if (e.shiftKey) {
                      toggleSelectId({ kind: "wire", id: w.id });
                      return;
                    }
                    setSelected({ kind: "wire", id: w.id });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (selectedIds.length > 1 && isSelected) {
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        target: { kind: "multi" },
                      });
                      return;
                    }
                    setSelected({ kind: "wire", id: w.id });
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      target: { kind: "wire", id: w.id },
                    });
                  }}
                  className="cursor-pointer"
                >
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={Math.max(8, wireDiaMm + 4)}
                  />
                  {isSelected && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth={wireDiaMm + 2.2}
                      strokeOpacity={0.35}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={wireDiaMm}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Halo filter / contrast border for clear readability */}
                  <rect
                    x={mid.x - Math.max(12, (w.label.length + w.gaugeMm2.length) * 2.8 + 6) / 2}
                    y={mid.y - 5.5}
                    width={Math.max(12, (w.label.length + w.gaugeMm2.length) * 2.8 + 6)}
                    height={11}
                    rx={2.5}
                    fill="#ffffff"
                    stroke={isSelected ? "#0284c7" : stroke}
                    strokeWidth={isSelected ? 1.0 : 0.6}
                    filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.18))"
                  />
                  <text
                    x={mid.x}
                    y={mid.y + 1.2}
                    fontSize={3.8}
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill="#0f172a"
                    textAnchor="middle"
                  >
                    {w.label} <tspan fill="#64748b" fontSize={3.2}>({w.gaugeMm2}mm²)</tspan>
                  </text>
                </g>
              );
            })}

            {/* Live Wire Preview */}
            {canvasTool2D === "wire" && activeWireStartPin && cursorWorld && (() => {
              const p1 = pinMap.get(
                `${activeWireStartPin.componentId}:${activeWireStartPin.pinId}`
              );
              if (!p1) return null;
              const previewPts =
                autoRouteDuctsEnabled && ducts.length > 0
                  ? routeWireThroughDucts(
                      { x: p1.x, y: -p1.y },
                      { x: cursorWorld.xMm, y: cursorWorld.yMm },
                      ducts,
                      rails,
                      wires.length
                    ).map((pt) => ({ x: pt.x, y: -pt.y }))
                  : routeOrthogonalWire(
                      p1,
                      { x: cursorWorld.xMm, y: -cursorWorld.yMm },
                      "horizontal-first"
                    );
              return (
                <path
                  d={pointsToSvgPath(previewPts)}
                  fill="none"
                  stroke={WIRE_COLOR_MAP[activeWireColor] || "#0284c7"}
                  strokeWidth={1.1}
                  strokeDasharray="3,2"
                  className="pointer-events-none"
                />
              );
            })()}
          </g>

          {/* Measuring Dimension Overlay */}
          {measureStart && (measureEnd || measureHover) && (() => {
            const b = measureEnd ?? measureHover!;
            const sx1 = measureStart.xMm;
            const sy1 = -measureStart.yMm;
            const sx2 = b.xMm;
            const sy2 = -b.yMm;
            const dx = Math.abs(b.xMm - measureStart.xMm);
            const dy = Math.abs(b.yMm - measureStart.yMm);
            const dist = Math.hypot(dx, dy);
            const midX = (sx1 + sx2) / 2;
            const midY = (sy1 + sy2) / 2;
            return (
              <g className="pointer-events-none">
                {/* Orthogonal ΔX & ΔY guides */}
                {dx > 0.1 && dy > 0.1 && (
                  <>
                    <line
                      x1={sx1}
                      y1={sy1}
                      x2={sx2}
                      y2={sy1}
                      stroke="#64748b"
                      strokeWidth={0.7}
                      strokeDasharray="3,2"
                    />
                    <line
                      x1={sx2}
                      y1={sy1}
                      x2={sx2}
                      y2={sy2}
                      stroke="#64748b"
                      strokeWidth={0.7}
                      strokeDasharray="3,2"
                    />
                  </>
                )}
                {/* Main dimension line */}
                <line
                  x1={sx1}
                  y1={sy1}
                  x2={sx2}
                  y2={sy2}
                  stroke="#0284c7"
                  strokeWidth={1.2}
                  markerStart="url(#measure-arrow)"
                  markerEnd="url(#measure-arrow)"
                />
                <circle cx={sx1} cy={sy1} r={2.2} fill="#0284c7" />
                <circle cx={sx2} cy={sy2} r={2.2} fill="#0284c7" />
                {/* Dimension Label */}
                <rect
                  x={midX - 42}
                  y={midY - 12}
                  width={84}
                  height={16}
                  rx={2.5}
                  fill="#0f172a"
                  fillOpacity={0.92}
                  stroke="#0284c7"
                  strokeWidth={0.7}
                />
                <text
                  x={midX}
                  y={midY - 5}
                  fontSize={5}
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#f8fafc"
                  textAnchor="middle"
                >
                  L={formatDim(dist, displayUnit)}
                </text>
                <text
                  x={midX}
                  y={midY + 1.5}
                  fontSize={3.8}
                  fontFamily="monospace"
                  fill="#93c5fd"
                  textAnchor="middle"
                >
                  ΔX:{formatDim(dx, displayUnit)} ΔY:{formatDim(dy, displayUnit)}
                </text>
              </g>
            );
          })()}

          {/* Smart Alignment Guides Overlay (Cyan/Sky dotted lines) */}
          {alignmentGuides.length > 0 && (
            <g className="pointer-events-none">
              {alignmentGuides.map((guide, idx) => {
                if (guide.orientation === "vertical") {
                  return (
                    <line
                      key={`guide-v-${idx}`}
                      x1={guide.coordinate}
                      y1={-guide.start}
                      x2={guide.coordinate}
                      y2={-guide.end}
                      stroke="#0ea5e9"
                      strokeWidth={1.5 / zoom}
                      strokeDasharray={`${6 / zoom},${4 / zoom}`}
                      strokeOpacity={0.9}
                    />
                  );
                }
                return (
                  <line
                    key={`guide-h-${idx}`}
                    x1={guide.start}
                    y1={-guide.coordinate}
                    x2={guide.end}
                    y2={-guide.coordinate}
                    stroke="#0ea5e9"
                    strokeWidth={1.5 / zoom}
                    strokeDasharray={`${6 / zoom},${4 / zoom}`}
                    strokeOpacity={0.9}
                  />
                );
              })}
            </g>
          )}

          {/* Marquee Box Selection Overlay */}
          {dragState?.type === "marquee" && (() => {
            const sx = Math.min(dragState.startWorldXMm, dragState.currentWorldXMm);
            const sy = -Math.max(dragState.startWorldYMm, dragState.currentWorldYMm);
            const sw = Math.abs(dragState.currentWorldXMm - dragState.startWorldXMm);
            const sh = Math.abs(dragState.currentWorldYMm - dragState.startWorldYMm);
            if (sw < 1 && sh < 1) return null;
            return (
              <rect
                x={sx}
                y={sy}
                width={sw}
                height={sh}
                fill="#38bdf8"
                fillOpacity={0.14}
                stroke="#0284c7"
                strokeWidth={1.2 / zoom}
                strokeDasharray={`${4 / zoom},${3 / zoom}`}
                className="pointer-events-none"
              />
            );
          })()}

          {/* ISO/IEC Title Block (Plot Frame) */}
          <g>
            <rect
              x={tbX}
              y={tbY}
              width={tbW}
              height={tbH}
              fill={theme === "light" ? "#f8fafc" : "#0c0e14"}
              stroke={theme === "light" ? "#cbd5e1" : "#252932"}
              strokeWidth={0.9}
            />
            <line
              x1={tbX}
              y1={tbY + 15}
              x2={tbX + tbW}
              y2={tbY + 15}
              stroke={theme === "light" ? "#cbd5e1" : "#252932"}
              strokeWidth={0.5}
            />
            <line
              x1={tbX}
              y1={tbY + 30}
              x2={tbX + tbW}
              y2={tbY + 30}
              stroke={theme === "light" ? "#cbd5e1" : "#252932"}
              strokeWidth={0.5}
            />
            <line
              x1={tbX + 158}
              y1={tbY}
              x2={tbX + 158}
              y2={tbY + tbH}
              stroke={theme === "light" ? "#cbd5e1" : "#252932"}
              strokeWidth={0.5}
            />
            <line
              x1={tbX + 214}
              y1={tbY + 15}
              x2={tbX + 214}
              y2={tbY + tbH}
              stroke={theme === "light" ? "#cbd5e1" : "#252932"}
              strokeWidth={0.5}
            />
            <defs>
              <clipPath id="tb-project-clip">
                <rect x={tbX + 2} y={tbY + 1} width={153} height={13} />
              </clipPath>
              <clipPath id="tb-drawer-clip">
                <rect x={tbX + 2} y={tbY + 16} width={153} height={13} />
              </clipPath>
            </defs>
            <text
              x={tbX + 5}
              y={tbY + 10}
              fontSize={5.5}
              fontFamily="sans-serif"
              fontWeight="bold"
              clipPath="url(#tb-project-clip)"
              fill={theme === "light" ? "#0f172a" : "#f1f5f9"}
            >
              PROJECT:{" "}
              {titleBlock.projectName.length > 34
                ? `${titleBlock.projectName.slice(0, 32)}…`
                : titleBlock.projectName}
            </text>
            <text
              x={tbX + 5}
              y={tbY + 24}
              fontSize={5.5}
              fontFamily="sans-serif"
              clipPath="url(#tb-drawer-clip)"
              fill={theme === "light" ? "#475569" : "#94a3b8"}
            >
              DRAWER:{" "}
              {titleBlock.drawer.length > 34
                ? `${titleBlock.drawer.slice(0, 32)}…`
                : titleBlock.drawer}
            </text>
            <text
              x={tbX + 5}
              y={tbY + 39}
              fontSize={5}
              fontFamily="sans-serif"
              fill="#64748b"
            >
              PANELFLOW 2D MOUNTING LAYOUT (.PFLOW)
            </text>
            <text
              x={tbX + 163}
              y={tbY + 10}
              fontSize={5.5}
              fontFamily="sans-serif"
              fill={theme === "light" ? "#475569" : "#94a3b8"}
            >
              DATE: {titleBlock.date}
            </text>
            <text
              x={tbX + 163}
              y={tbY + 24}
              fontSize={5.5}
              fontFamily="sans-serif"
              fill={theme === "light" ? "#475569" : "#94a3b8"}
            >
              SCALE: {titleBlock.scale}
            </text>
            <text
              x={tbX + 163}
              y={tbY + 39}
              fontSize={5.5}
              fontFamily="sans-serif"
              fill={theme === "light" ? "#475569" : "#94a3b8"}
            >
              REV: {titleBlock.rev}
            </text>
            <text
              x={tbX + 219}
              y={tbY + 24}
              fontSize={5.5}
              fontFamily="sans-serif"
              fontWeight="bold"
              fill={theme === "light" ? "#334155" : "#cbd5e1"}
            >
              SHEET:
            </text>
            <text
              x={tbX + 219}
              y={tbY + 39}
              fontSize={6.5}
              fontFamily="monospace"
              fontWeight="bold"
              fill={theme === "light" ? "#0f172a" : "#ffffff"}
            >
              {titleBlock.sheetNo}
            </text>
          </g>
        </g>
      </svg>

      <ContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onFitToScreen={fitToView}
      />
    </div>
  );
}
