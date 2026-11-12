"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cable,
  Hand,
  Maximize2,
  MousePointer2,
  Ruler,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { detectCollisionsAndBounds } from "@/lib/collision";
import { getBackplateDimensions } from "@/lib/template-export";
import { parseDxfToMmSegments } from "@/lib/dxf-parser";
import { WIRE_COLOR_MAP } from "@/lib/sheet-export";
import { rotateLocalPoint, snapToGrid } from "@/lib/snap";
import { formatDim } from "@/lib/units";
import {
  getWireOuterDiameterMm,
  pointsToRoundedSvgPath,
  pointsToSvgPath,
  routeOrthogonalWire,
} from "@/lib/wire-router";
import { usePanelStore } from "@/store/usePanelStore";
import type {
  CustomCadAsset,
  DinRail,
  PlacedComponent,
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
          stroke="#0284c7"
          strokeWidth={1.2}
          strokeDasharray="3,2"
          rx={1}
        />
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
      {comp.templateId === "mcb-1p" || comp.templateId === "mcb-3p" ? (
        <g stroke="#334155" strokeWidth={0.7} fill="none">
          <rect
            x={x + comp.widthMm * 0.2}
            y={y + comp.heightMm * 0.38}
            width={comp.widthMm * 0.6}
            height={comp.heightMm * 0.24}
            fill="#e2e8f0"
          />
          <line
            x1={x + comp.widthMm * 0.25}
            y1={y + comp.heightMm * 0.5}
            x2={x + comp.widthMm * 0.75}
            y2={y + comp.heightMm * 0.5}
            stroke="#0f172a"
            strokeWidth={1.2}
          />
        </g>
      ) : comp.templateId === "contactor" ? (
        <g stroke="#334155" strokeWidth={0.7} fill="none">
          <rect
            x={x + 6}
            y={y + 26}
            width={comp.widthMm - 12}
            height={comp.heightMm - 52}
            fill="#f8fafc"
          />
          <line
            x1={x + 10}
            y1={y + 34}
            x2={x + comp.widthMm - 10}
            y2={y + comp.heightMm - 34}
            stroke="#0ea5e9"
            strokeWidth={0.9}
          />
        </g>
      ) : comp.templateId === "psu-24v" ? (
        <g stroke="#334155" strokeWidth={0.7} fill="none">
          <rect
            x={x + 8}
            y={y + 28}
            width={comp.widthMm - 16}
            height={comp.heightMm - 56}
            fill="#f1f5f9"
          />
          <line
            x1={x + 12}
            y1={y + comp.heightMm / 2}
            x2={x + comp.widthMm - 12}
            y2={y + comp.heightMm / 2}
            stroke="#10b981"
            strokeWidth={1}
          />
        </g>
      ) : null}

      {/* Component Tag & Type */}
      <text
        x={x + 2.5}
        y={y + 12}
        fontSize={5}
        fontFamily="monospace"
        fontWeight="bold"
        fill="#0f172a"
      >
        {comp.name}
      </text>
      {comp.widthMm >= 16 && (
        <text
          x={x + 2.5}
          y={y + 18}
          fontSize={3.8}
          fontFamily="sans-serif"
          fill="#64748b"
        >
          {comp.templateId.toUpperCase()}
        </text>
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
  activeWireStartPin,
  onPointerDown,
  onContextMenu,
  onPinClick,
}: {
  asset: CustomCadAsset;
  isSelected: boolean;
  isMarkingThis: boolean;
  isWireMode: boolean;
  activeWireStartPin: { componentId: string; pinId: string } | null;
  onPointerDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPinClick: (e: React.PointerEvent, pinId: string) => void;
}) {
  const dxfParsed = useMemo(() => {
    if (asset.format !== "dxf" || !asset.rawText) return null;
    return parseDxfToMmSegments(asset.rawText, asset.sourceUnit);
  }, [asset.format, asset.rawText, asset.sourceUnit]);

  const w = dxfParsed ? dxfParsed.boundingBoxMm.w : asset.boundingBoxMm.w;
  const h = dxfParsed ? dxfParsed.boundingBoxMm.h : asset.boundingBoxMm.h;

  // SVG Y is down, world Y is up
  const x = asset.xMm - w / 2;
  const y = -(asset.yMm + h / 2);

  const shortLabel =
    asset.name.length > 18 ? `${asset.name.slice(0, 16)}…` : asset.name;
  const rot = asset.rotationDeg ?? 0;

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

      {/* Interactive Hitbox & Background */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
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
          x={x - 2.5}
          y={y - 2.5}
          width={w + 5}
          height={h + 5}
          fill="none"
          stroke={isMarkingThis ? "#f59e0b" : "#0284c7"}
          strokeWidth={1.2}
          strokeDasharray="3,2"
          rx={1}
        />
      )}

      {/* DXF Vector Segments or 3D Mesh Silhouette */}
      {dxfParsed && dxfParsed.segments.length > 0 ? (
        <g stroke="#0369a1" strokeWidth={0.75} strokeLinecap="round">
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
        <g stroke="#64748b" strokeWidth={0.6} fill="none">
          <line x1={x} y1={y} x2={x + w} y2={y + h} strokeDasharray="2,2" />
          <line x1={x + w} y1={y} x2={x} y2={y + h} strokeDasharray="2,2" />
          <circle cx={asset.xMm} cy={-asset.yMm} r={Math.min(w, h) * 0.2} />
        </g>
      )}

      {/* Asset Name & Format Tag */}
      <text
        x={x + 2}
        y={y - 3}
        fontSize={4.5}
        fontFamily="monospace"
        fontWeight="bold"
        fill="#0369a1"
      >
        {shortLabel} [{asset.format.toUpperCase()}]
      </text>

      {/* Pins */}
      {asset.pins.map((pin) => {
        const px = asset.xMm + pin.localXMm;
        const py = -(asset.yMm + pin.localYMm);
        const isStartPin =
          activeWireStartPin?.componentId === asset.id &&
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
              r={isWireMode ? 2.6 : 1.8}
              fill={isStartPin ? "#f59e0b" : "#fef3c7"}
              stroke={isStartPin ? "#b45309" : isWireMode ? "#0284c7" : "#d97706"}
              strokeWidth={isWireMode ? 0.9 : 0.65}
            />
            <text
              x={px}
              y={py - 3}
              fontSize={3.6}
              fontFamily="monospace"
              fontWeight="bold"
              fill="#92400e"
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

export function Panel2DCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

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
  const canvasTool2D = usePanelStore((s) => s.canvasTool2D);
  const activeWireColor = usePanelStore((s) => s.activeWireColor);
  const activeWireGauge = usePanelStore((s) => s.activeWireGauge);
  const activeWireStartPin = usePanelStore((s) => s.activeWireStartPin);
  const isPinMarkingMode = usePanelStore((s) => s.isPinMarkingMode);
  const activeMarkingAssetId = usePanelStore((s) => s.activeMarkingAssetId);

  const setSelected = usePanelStore((s) => s.setSelected);
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

  // Camera state: zoom (px per mm), pan (px offset of world origin (0,0) from top-left of container)
  const [zoom, setZoom] = useState(1.1);
  const [pan, setPan] = useState({ x: 480, y: 380 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
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

  const { widthMm: plateW, heightMm: plateH } = useMemo(
    () => getBackplateDimensions(enclosure, plateConfig),
    [enclosure, plateConfig]
  );

  const collisionReport = useMemo(
    () => detectCollisionsAndBounds(components, cadAssets, plateW, plateH),
    [components, cadAssets, plateW, plateH]
  );

  // Sheet dimensions around backplate
  const sheetW = Math.max(841, plateW + 220);
  const sheetH = Math.max(594, plateH + 140);

  // Fit sheet on initial mount
  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setViewportSize({ width: rect.width, height: rect.height });
    const scaleX = (rect.width - 80) / sheetW;
    const scaleY = (rect.height - 80) / sheetH;
    const nextZoom = Math.max(0.25, Math.min(3, Math.min(scaleX, scaleY)));
    setZoom(nextZoom);
    setPan({ x: rect.width / 2, y: rect.height / 2 });
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

  // Spacebar pan shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        setSpacePressed(true);
      }
      if (e.code === "Escape") {
        setActiveWireStartPin(null);
        setMeasureStart(null);
        setMeasureEnd(null);
        setMeasureHover(null);
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
  }, [setActiveWireStartPin]);

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

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
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
      setSelected(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
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

    if (dragState.type === "component") {
      moveComponent(
        dragState.id,
        world.xMm - dragState.offsetXMm,
        world.yMm - dragState.offsetYMm
      );
      return;
    }

    if (dragState.type === "cad") {
      moveCadAsset(
        dragState.id,
        world.xMm - dragState.offsetXMm,
        world.yMm - dragState.offsetYMm
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

  const handlePointerUp = () => {
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

  // Ruler ticks computation
  const rulerStepMm = zoom > 1.5 ? 25 : zoom > 0.7 ? 50 : 100;
  const xStartMm = Math.floor(-pan.x / zoom / rulerStepMm) * rulerStepMm;
  const xEndMm =
    Math.ceil((viewportSize.width - pan.x) / zoom / rulerStepMm) * rulerStepMm;
  const yTopMm = Math.ceil(pan.y / zoom / rulerStepMm) * rulerStepMm;
  const yBottomMm =
    Math.floor((pan.y - viewportSize.height) / zoom / rulerStepMm) * rulerStepMm;

  const xTicks: number[] = [];
  for (let x = xStartMm; x <= xEndMm; x += rulerStepMm) xTicks.push(x);

  const yTicks: number[] = [];
  for (let y = yBottomMm; y <= yTopMm; y += rulerStepMm) yTicks.push(y);

  // Title block geometry (bottom-right of sheet)
  const tbW = 240;
  const tbH = 44;
  const tbX = sheetW / 2 - 12 - tbW;
  const tbY = sheetH / 2 - 12 - tbH;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#e2e8f0] select-none"
      onWheel={handleWheel}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
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
      {/* Top Engineering Ruler */}
      <div className="pointer-events-none absolute top-0 right-0 left-6 z-20 h-6 overflow-hidden border-b border-slate-300 bg-slate-100/95 font-mono text-[9px] text-slate-600">
        {xTicks.map((xMm) => {
          const left = pan.x + xMm * zoom - 24;
          return (
            <div
              key={xMm}
              style={{ transform: `translateX(${left}px)` }}
              className="absolute top-0 bottom-0 border-l border-slate-400 pl-1"
            >
              {xMm}
            </div>
          );
        })}
      </div>

      {/* Left Engineering Ruler */}
      <div className="pointer-events-none absolute top-6 bottom-0 left-0 z-20 w-6 overflow-hidden border-r border-slate-300 bg-slate-100/95 font-mono text-[9px] text-slate-600">
        {yTicks.map((yMm) => {
          const top = pan.y - yMm * zoom - 24;
          return (
            <div
              key={yMm}
              style={{ transform: `translateY(${top}px)` }}
              className="absolute right-0 left-0 border-t border-slate-400 pt-0.5 text-center"
            >
              {yMm}
            </div>
          );
        })}
      </div>

      {/* Corner Origin Badge */}
      <div className="pointer-events-none absolute top-0 left-0 z-30 flex h-6 w-6 items-center justify-center border-r border-b border-slate-300 bg-slate-200 font-mono text-[8px] font-bold text-slate-700">
        mm
      </div>

      {/* 2D Floating Toolbar (Tools & Wire Drafter) */}
      <div className="absolute top-9 left-9 z-20 flex flex-wrap items-center gap-2 rounded-md border border-slate-300 bg-white/95 px-2.5 py-1.5 shadow-sm backdrop-blur">
        <div className="flex rounded border border-slate-200 bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => setCanvasTool2D("select")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
              canvasTool2D === "select"
                ? "bg-sky-600 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Select & Move (Click & Drag)"
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            Select
          </button>
          <button
            type="button"
            onClick={() => setCanvasTool2D("wire")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
              canvasTool2D === "wire"
                ? "bg-sky-600 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Wire Connection Tool (Click Pin A -> Pin B)"
          >
            <Cable className="h-3.5 w-3.5" />
            Wire
          </button>
          <button
            type="button"
            onClick={() => setCanvasTool2D("measure")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
              canvasTool2D === "measure"
                ? "bg-sky-600 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Measure Dimension Tool (Click Point A -> Point B, Esc to clear)"
          >
            <Ruler className="h-3.5 w-3.5" />
            Measure
          </button>
          <button
            type="button"
            onClick={() => setCanvasTool2D("pan")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
              canvasTool2D === "pan"
                ? "bg-sky-600 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Pan Canvas (or Space + Drag)"
          >
            <Hand className="h-3.5 w-3.5" />
            Pan
          </button>
        </div>

        {/* Wire Options when Wire Tool Active */}
        {canvasTool2D === "wire" && (
          <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
            <div className="flex items-center gap-1">
              {WIRE_COLORS.map((wc) => (
                <button
                  key={wc.code}
                  type="button"
                  onClick={() => setActiveWireColor(wc.code)}
                  className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                    activeWireColor === wc.code
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
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
              className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700"
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
            {activeWireStartPin && (
              <span className="font-mono text-[10px] font-semibold text-amber-600">
                Select target pin... (Esc to cancel)
              </span>
            )}
          </div>
        )}

        {canvasTool2D === "measure" && (
          <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
            <span className="font-mono text-[10px] font-semibold text-sky-700">
              {!measureStart
                ? "Click start point A"
                : !measureEnd
                ? "Click end point B (Esc to cancel)"
                : "Click to measure again (Esc to clear)"}
            </span>
          </div>
        )}

        {(collisionReport.overlappingIds.size > 0 ||
          collisionReport.outOfBoundsIds.size > 0) && (
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
            <span className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-rose-700">
              {collisionReport.overlappingIds.size > 0 &&
                `${collisionReport.overlapPairs.length} overlap`}
              {collisionReport.overlappingIds.size > 0 &&
                collisionReport.outOfBoundsIds.size > 0 &&
                " · "}
              {collisionReport.outOfBoundsIds.size > 0 &&
                `${collisionReport.outOfBoundsIds.size} out-of-bounds`}
            </span>
          </div>
        )}

        {isPinMarkingMode && activeMarkingAssetId && (
          <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
            <span className="font-mono text-[10px] font-semibold text-amber-600">
              Pin Marking Mode: Click on CAD asset to place pin
            </span>
          </div>
        )}
      </div>

      {/* Zoom Controls (Bottom Right) */}
      <div className="absolute right-4 bottom-4 z-20 flex items-center gap-1.5 rounded-md border border-slate-300 bg-white/95 px-2 py-1 shadow-sm">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))}
          className="rounded p-1 text-slate-600 hover:bg-slate-100"
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[44px] text-center font-mono text-[11px] font-medium text-slate-700">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(8, z * 1.2))}
          className="rounded p-1 text-slate-600 hover:bg-slate-100"
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={fitToView}
          className="rounded p-1 text-slate-600 hover:bg-slate-100"
          title="Fit Sheet to View"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Cursor Coordinates Status (Bottom Left) */}
      <div className="pointer-events-none absolute bottom-4 left-9 z-20 rounded border border-slate-300 bg-white/90 px-2.5 py-1 font-mono text-[11px] text-slate-700 shadow-xs">
        {cursorWorld
          ? `X: ${Math.round(cursorWorld.xMm)} mm | Y: ${Math.round(
              cursorWorld.yMm
            )} mm | Snap: ${gridSnapMm} mm`
          : `Snap: ${gridSnapMm} mm`}
      </div>

      {/* Main Interactive SVG Canvas */}
      <svg
        className={`h-full w-full ${
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
            <circle cx={0} cy={0} r={0.6} fill="#94a3b8" />
          </pattern>
          <pattern
            id="duct-hatch"
            width="6"
            height="6"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="1" />
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
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284c7" />
          </marker>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Eplan Drawing Sheet (ISO Plot Frame) */}
          <g>
            <rect
              x={-sheetW / 2}
              y={-sheetH / 2}
              width={sheetW}
              height={sheetH}
              fill="#ffffff"
              stroke="#0f172a"
              strokeWidth={1.2}
              filter="drop-shadow(0 4px 12px rgba(0,0,0,0.12))"
            />
            <rect
              x={-sheetW / 2 + 8}
              y={-sheetH / 2 + 8}
              width={sheetW - 16}
              height={sheetH - 16}
              fill="none"
              stroke="#64748b"
              strokeWidth={0.4}
            />
          </g>

          {/* Backplate Boundary & Engineering Grid */}
          <g>
            <rect
              x={-plateW / 2}
              y={-plateH / 2}
              width={plateW}
              height={plateH}
              fill="url(#grid-dots)"
              stroke="#0f172a"
              strokeWidth={1.4}
            />
            {/* Backplate Dimension Annotations */}
            <text
              x={0}
              y={-plateH / 2 - 8}
              fontSize={8}
              fontFamily="monospace"
              fill="#334155"
              textAnchor="middle"
            >
              MOUNTING PLATE: {plateW} x {plateH} mm
            </text>
          </g>

          {/* Wire Ducts Layer */}
          <g>
            {ducts.map((d) => {
              const x = d.xMm - d.widthMm / 2;
              const y = -(d.yMm + d.heightMm / 2);
              const isSelected =
                selected?.kind === "duct" && selected.id === d.id;

              return (
                <g key={d.id}>
                  <g
                    onPointerDown={(e) => {
                      if (e.button !== 0 || canvasTool2D !== "select" || spacePressed) return;
                      e.stopPropagation();
                      setSelected({ kind: "duct", id: d.id });
                      const w = screenToWorld(e.clientX, e.clientY);
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
              const isSelected =
                selected?.kind === "rail" && selected.id === r.id;

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
                      setSelected({ kind: "rail", id: r.id });
                      const w = screenToWorld(e.clientX, e.clientY);
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
            {components.map((comp) => (
              <Component2DSymbol
                key={comp.id}
                comp={comp}
                isSelected={
                  selected?.kind === "component" && selected.id === comp.id
                }
                isWireMode={canvasTool2D === "wire"}
                activeWireStartPin={activeWireStartPin}
                hasCollision={collisionReport.overlappingIds.has(comp.id)}
                isOutOfBounds={collisionReport.outOfBoundsIds.has(comp.id)}
                onPointerDown={(e) => {
                  if (e.button !== 0 || canvasTool2D !== "select" || spacePressed) return;
                  e.stopPropagation();
                  setSelected({ kind: "component", id: comp.id });
                  const w = screenToWorld(e.clientX, e.clientY);
                  setDragState({
                    type: "component",
                    id: comp.id,
                    offsetXMm: w.xMm - comp.xMm,
                    offsetYMm: w.yMm - comp.yMm,
                  });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
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
            ))}
          </g>

          {/* Custom CAD Assets Layer */}
          <g>
            {cadAssets.map((asset) => {
              const isMarkingThis =
                isPinMarkingMode && activeMarkingAssetId === asset.id;
              return (
                <CadAsset2DSymbol
                  key={asset.id}
                  asset={asset}
                  isSelected={
                    selected?.kind === "cad" && selected.id === asset.id
                  }
                  isMarkingThis={isMarkingThis}
                  isWireMode={canvasTool2D === "wire"}
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
                    setSelected({ kind: "cad", id: asset.id });
                    const w = screenToWorld(e.clientX, e.clientY);
                    setDragState({
                      type: "cad",
                      id: asset.id,
                      offsetXMm: w.xMm - asset.xMm,
                      offsetYMm: w.yMm - asset.yMm,
                    });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
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

              const waypoints = routeOrthogonalWire(p1, p2, "horizontal-first");
              const pathD = pointsToRoundedSvgPath(waypoints, 4);
              const stroke = WIRE_COLOR_MAP[w.colorCode] || "#2563eb";
              const wireDiaMm = getWireOuterDiameterMm(w.gaugeMm2);
              const isSelected =
                selected?.kind === "wire" && selected.id === w.id;
              const mid = waypoints[Math.floor(waypoints.length / 2)] || p1;

              return (
                <g
                  key={w.id}
                  onPointerDown={(e) => {
                    if (e.button !== 0 || canvasTool2D !== "select" || spacePressed) return;
                    e.stopPropagation();
                    setSelected({ kind: "wire", id: w.id });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
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
                  <rect
                    x={mid.x - 11}
                    y={mid.y - 4.5}
                    width={22}
                    height={9}
                    rx={1.5}
                    fill="#ffffff"
                    stroke={isSelected ? "#0284c7" : stroke}
                    strokeWidth={0.6}
                  />
                  <text
                    x={mid.x}
                    y={mid.y + 1.5}
                    fontSize={4}
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill="#0f172a"
                    textAnchor="middle"
                  >
                    {w.label} {w.gaugeMm2}
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
              const previewPts = routeOrthogonalWire(
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

          {/* ISO/IEC Title Block (Plot Frame) */}
          <g>
            <rect
              x={tbX}
              y={tbY}
              width={tbW}
              height={tbH}
              fill="#ffffff"
              stroke="#0f172a"
              strokeWidth={0.9}
            />
            <line
              x1={tbX}
              y1={tbY + 15}
              x2={tbX + tbW}
              y2={tbY + 15}
              stroke="#0f172a"
              strokeWidth={0.5}
            />
            <line
              x1={tbX}
              y1={tbY + 30}
              x2={tbX + tbW}
              y2={tbY + 30}
              stroke="#0f172a"
              strokeWidth={0.5}
            />
            <line
              x1={tbX + 135}
              y1={tbY}
              x2={tbX + 135}
              y2={tbY + tbH}
              stroke="#0f172a"
              strokeWidth={0.5}
            />
            <line
              x1={tbX + 190}
              y1={tbY + 15}
              x2={tbX + 190}
              y2={tbY + tbH}
              stroke="#0f172a"
              strokeWidth={0.5}
            />
            <text
              x={tbX + 5}
              y={tbY + 10}
              fontSize={6}
              fontFamily="sans-serif"
              fontWeight="bold"
              fill="#0f172a"
            >
              PROJECT: {titleBlock.projectName}
            </text>
            <text
              x={tbX + 5}
              y={tbY + 24}
              fontSize={5.5}
              fontFamily="sans-serif"
              fill="#334155"
            >
              DRAWER: {titleBlock.drawer}
            </text>
            <text
              x={tbX + 5}
              y={tbY + 39}
              fontSize={5}
              fontFamily="sans-serif"
              fill="#64748b"
            >
              EPLAN PRO PANEL 2D MOUNTING LAYOUT
            </text>
            <text
              x={tbX + 140}
              y={tbY + 10}
              fontSize={5.5}
              fontFamily="sans-serif"
              fill="#334155"
            >
              DATE: {titleBlock.date}
            </text>
            <text
              x={tbX + 140}
              y={tbY + 24}
              fontSize={5.5}
              fontFamily="sans-serif"
              fill="#334155"
            >
              SCALE: {titleBlock.scale}
            </text>
            <text
              x={tbX + 140}
              y={tbY + 39}
              fontSize={5.5}
              fontFamily="sans-serif"
              fill="#334155"
            >
              REV: {titleBlock.rev}
            </text>
            <text
              x={tbX + 195}
              y={tbY + 24}
              fontSize={5.5}
              fontFamily="sans-serif"
              fontWeight="bold"
              fill="#0f172a"
            >
              SHEET:
            </text>
            <text
              x={tbX + 195}
              y={tbY + 39}
              fontSize={6.5}
              fontFamily="monospace"
              fontWeight="bold"
              fill="#0284c7"
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
