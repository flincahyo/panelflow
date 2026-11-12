"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  ChevronDown,
  Download,
  Eye,
  FileCheck2,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileUp,
  FolderOpen,
  Grid,
  Layers,
  Network,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Sliders,
  Sun,
  Moon,
  Undo2,
  Zap,
} from "lucide-react";
import { generateEplanSheetSvg } from "@/lib/sheet-export";
import { generateDrillingDxf, generateDrillingSvg } from "@/lib/template-export";
import { formatDim } from "@/lib/units";
import { usePanelStore } from "@/store/usePanelStore";
import type { DoorMode, GridSnapMm, LengthUnit, SheetType } from "@/types/panel";

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface TopToolbarProps {
  inspectorOpen?: boolean;
  onToggleInspector?: () => void;
}

export function TopToolbar({
  inspectorOpen = true,
  onToggleInspector,
}: TopToolbarProps) {
  const viewportMode = usePanelStore((s) => s.viewportMode);
  const theme = usePanelStore((s) => s.theme);
  const toggleTheme = usePanelStore((s) => s.toggleTheme);
  const displayUnit = usePanelStore((s) => s.displayUnit);
  const gridSnapMm = usePanelStore((s) => s.gridSnapMm);
  const enclosure = usePanelStore((s) => s.enclosure);
  const plateConfig = usePanelStore((s) => s.plateConfig);
  const rails = usePanelStore((s) => s.rails);
  const ducts = usePanelStore((s) => s.ducts);
  const components = usePanelStore((s) => s.components);
  const cadAssets = usePanelStore((s) => s.cadAssets);
  const wires = usePanelStore((s) => s.wires);
  const titleBlock = usePanelStore((s) => s.titleBlock);

  const undo = usePanelStore((s) => s.undo);
  const redo = usePanelStore((s) => s.redo);
  const canUndo = usePanelStore((s) => s.canUndo);
  const canRedo = usePanelStore((s) => s.canRedo);
  const autoRouteAllWires = usePanelStore((s) => s.autoRouteAllWires);

  const setViewportMode = usePanelStore((s) => s.setViewportMode);
  const setDisplayUnit = usePanelStore((s) => s.setDisplayUnit);
  const setGridSnapMm = usePanelStore((s) => s.setGridSnapMm);
  const setDoorMode = usePanelStore((s) => s.setDoorMode);
  const addSheet = usePanelStore((s) => s.addSheet);

  const [activeMenu, setActiveMenu] = useState<"file" | "edit" | "view" | null>(
    null
  );
  const menuBarRef = useRef<HTMLDivElement>(null);

  const units: LengthUnit[] = ["mm", "cm", "m"];
  const snaps: GridSnapMm[] = [5, 10, 25];

  // Close menus on outside click
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (
        menuBarRef.current &&
        !menuBarRef.current.contains(e.target as Node)
      ) {
        setActiveMenu(null);
      }
    };
    window.addEventListener("mousedown", handleDown);
    return () => window.removeEventListener("mousedown", handleDown);
  }, []);

  const handleExportSvg = () => {
    const svg = generateDrillingSvg(enclosure, rails, ducts, plateConfig);
    triggerDownload("panelflow-drilling-1to1.svg", svg, "image/svg+xml");
  };

  const handleExportDxf = () => {
    const dxf = generateDrillingDxf(enclosure, rails, ducts, plateConfig);
    triggerDownload("panelflow-drilling-1to1.dxf", dxf, "application/dxf");
  };

  const get2DSheetSvg = () =>
    generateEplanSheetSvg({
      enclosure,
      plateConfig,
      rails,
      ducts,
      components,
      cadAssets,
      wires,
      meta: titleBlock,
    });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const handleExport2DSheetSvg = () => {
    triggerDownload("panelflow-2d-sheet.svg", get2DSheetSvg(), "image/svg+xml");
  };

  const handleExport2DSheetPng = () => {
    const svg = get2DSheetSvg();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 3;
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            const pngUrl = URL.createObjectURL(pngBlob);
            const a = document.createElement("a");
            a.href = pngUrl;
            a.download = "panelflow-2d-sheet.png";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(pngUrl);
          }
        }, "image/png");
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleExport2DSheetPdf = () => {
    const svg = get2DSheetSvg();
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${titleBlock.projectName} - Sheet ${titleBlock.sheetNo}</title>
  <style>
    @page { size: landscape; margin: 6mm; }
    body { margin: 0; display: flex; justify-content: center; align-items: center; background: #fff; }
    svg { width: 100%; height: auto; max-height: 98vh; }
  </style>
</head>
<body>${svg}<script>window.onload = () => { window.print(); };</script></body>
</html>`);
    win.document.close();
  };

  const dropdownPanelClass =
    "absolute top-8 left-0 z-50 rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white/98 dark:bg-[#111318]/98 p-1 shadow-xl dark:shadow-2xl backdrop-blur-xl text-xs";
  const dropdownItemClass =
    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white";
  const dropdownSectionLabelClass =
    "px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#64748b] dark:text-slate-500";
  const dropdownDividerClass = "my-1 border-t border-[#e2e8f0] dark:border-white/10";

  return (
    <header className="relative z-40 flex h-13 shrink-0 items-center justify-between border-b border-[#e2e8f0] dark:border-white/10 bg-white/95 dark:bg-[#0c0e14]/95 px-3.5 text-xs text-[#0f172a] dark:text-slate-200 shadow-sm dark:shadow-none backdrop-blur-xl select-none">
      {/* LEFT SECTION: Logo Badge + Brand + File/Edit/View Menus */}
      <div className="flex items-center gap-3" ref={menuBarRef}>
        {/* Brand Badge */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e2e8f0] dark:border-white/15 bg-[#f8fafc] dark:bg-[#171a21] shadow-xs">
            <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400 fill-amber-400/20" />
          </div>
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-[#0f172a] dark:text-white text-sm">
            <span>PanelFlow</span>
            <span className="rounded-md border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-white/5 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#64748b] dark:text-slate-400">
              CAD
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-[#e2e8f0] dark:bg-white/10" />

        {/* Dropdown Menus (RelayFlow style) */}
        <div className="flex items-center gap-0.5">
          {/* FILE MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setActiveMenu(activeMenu === "file" ? null : "file")
              }
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeMenu === "file"
                  ? "bg-[#e2e8f0] dark:bg-white/10 text-[#0f172a] dark:text-white"
                  : "text-[#64748b] dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-white/5 hover:text-[#0f172a] dark:hover:text-slate-200"
              }`}
            >
              File
              <ChevronDown className="h-3 w-3 text-[#64748b] dark:text-slate-500" />
            </button>

            {activeMenu === "file" && (
              <div className={`${dropdownPanelClass} w-56`}>
                <div className={dropdownSectionLabelClass}>
                  Project Sheets
                </div>
                <button
                  type="button"
                  onClick={() => {
                    addSheet("mounting-plate");
                    setActiveMenu(null);
                  }}
                  className={dropdownItemClass}
                >
                  <Plus className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" />
                  New Mounting Sheet
                </button>
                <div className={dropdownDividerClass} />
                <div className={dropdownSectionLabelClass}>
                  Export 2D Drawing (.PFLOW)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleExport2DSheetSvg();
                    setActiveMenu(null);
                  }}
                  className={dropdownItemClass}
                >
                  <Download className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" />
                  Export 2D SVG
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleExport2DSheetPng();
                    setActiveMenu(null);
                  }}
                  className={dropdownItemClass}
                >
                  <FileImage className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                  Export High-Res PNG
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleExport2DSheetPdf();
                    setActiveMenu(null);
                  }}
                  className={dropdownItemClass}
                >
                  <FileText className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  Print / Export PDF
                </button>
                <div className={dropdownDividerClass} />
                <div className={dropdownSectionLabelClass}>
                  CNC Drilling Template
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleExportDxf();
                    setActiveMenu(null);
                  }}
                  className={dropdownItemClass}
                >
                  <Download className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                  Export Drilling DXF (1:1)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleExportSvg();
                    setActiveMenu(null);
                  }}
                  className={dropdownItemClass}
                >
                  <Download className="h-3.5 w-3.5 text-teal-500 dark:text-teal-400" />
                  Export Drilling SVG (1:1)
                </button>
              </div>
            )}
          </div>

          {/* EDIT MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setActiveMenu(activeMenu === "edit" ? null : "edit")
              }
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeMenu === "edit"
                  ? "bg-[#e2e8f0] dark:bg-white/10 text-[#0f172a] dark:text-white"
                  : "text-[#64748b] dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-white/5 hover:text-[#0f172a] dark:hover:text-slate-200"
              }`}
            >
              Edit
              <ChevronDown className="h-3 w-3 text-[#64748b] dark:text-slate-500" />
            </button>

            {activeMenu === "edit" && (
              <div className={`${dropdownPanelClass} w-60`}>
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={() => {
                    undo();
                    setActiveMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Undo2 className="h-3.5 w-3.5" />
                    Undo
                  </span>
                  <span className="font-mono text-[10px] text-[#64748b] dark:text-slate-500">
                    Ctrl+Z
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!canRedo}
                  onClick={() => {
                    redo();
                    setActiveMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Redo2 className="h-3.5 w-3.5" />
                    Redo
                  </span>
                  <span className="font-mono text-[10px] text-[#64748b] dark:text-slate-500">
                    Ctrl+Y
                  </span>
                </button>
                <div className="my-1 border-t border-[#e2e8f0] dark:border-white/10" />
                <button
                  type="button"
                  disabled={wires.length === 0}
                  onClick={() => {
                    autoRouteAllWires();
                    setActiveMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Network className="h-3.5 w-3.5 text-sky-500" />
                    Auto-Route All Wires via Ducts
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* VIEW MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setActiveMenu(activeMenu === "view" ? null : "view")
              }
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeMenu === "view"
                  ? "bg-[#e2e8f0] dark:bg-white/10 text-[#0f172a] dark:text-white"
                  : "text-[#64748b] dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-white/5 hover:text-[#0f172a] dark:hover:text-slate-200"
              }`}
            >
              View
              <ChevronDown className="h-3 w-3 text-[#64748b] dark:text-slate-500" />
            </button>

            {activeMenu === "view" && (
              <div className={`${dropdownPanelClass} w-48`}>
                <button
                  type="button"
                  onClick={() => {
                    setViewportMode("2d");
                    setActiveMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5" />
                    2D Layout
                  </span>
                  {viewportMode === "2d" && (
                    <span className="text-[#0f172a] dark:text-white text-xs">✓</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewportMode("3d");
                    setActiveMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <Box className="h-3.5 w-3.5" />
                    3D View
                  </span>
                  {viewportMode === "3d" && (
                    <span className="text-[#0f172a] dark:text-white text-xs">✓</span>
                  )}
                </button>
                <div className={dropdownDividerClass} />
                <div className={dropdownSectionLabelClass}>
                  Door Enclosure
                </div>
                {(["transparent", "open", "hidden"] as DoorMode[]).map((dm) => (
                  <button
                    key={dm}
                    type="button"
                    onClick={() => {
                      setDoorMode(dm);
                      setActiveMenu(null);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-left capitalize text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white"
                  >
                    <span>{dm}</span>
                    {enclosure.doorMode === dm && (
                      <span className="text-[#0f172a] dark:text-white text-xs">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SECTION: Project Pill (.PFLOW) + Viewport Switcher + Unit Switcher + Theme Toggle + Inspector Toggle */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Active Project Pill */}
        <div className="hidden items-center gap-2 rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-3 py-1 font-mono text-[11px] md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
          <span className="max-w-[160px] truncate text-[#334155] dark:text-slate-300 font-medium">
            {titleBlock.projectName}
          </span>
          <span className="rounded-md border border-[#e2e8f0] dark:border-white/10 bg-[#e2e8f0]/70 dark:bg-white/10 px-1.5 py-0.2 font-mono text-[9px] font-bold tracking-wider text-[#0f172a] dark:text-slate-200">
            .PFLOW
          </span>
        </div>

        {/* Viewport Switcher Pill: [2D Layout] / [3D View] */}
        <div className="flex items-center rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#171a21] p-0.5 shadow-inner">
          <button
            type="button"
            onClick={() => setViewportMode("2d")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
              viewportMode === "2d"
                ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            2D Layout
          </button>
          <button
            type="button"
            onClick={() => setViewportMode("3d")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
              viewportMode === "3d"
                ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            3D View
          </button>
        </div>

        {/* Unit Switcher Pill (mm/cm/m) */}
        <div className="flex items-center rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#171a21] p-0.5">
          {units.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setDisplayUnit(u)}
              className={`rounded-full px-2 py-0.5 font-mono text-[11px] transition-all ${
                displayUnit === u
                  ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-bold shadow-xs"
                  : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        {/* Theme Toggle Button (Sun / Moon) */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#171a21] text-[#64748b] dark:text-slate-400 shadow-xs dark:shadow-none transition-all hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white"
        >
          {theme === "dark" ? (
            <Sun className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-[#0f172a]" />
          )}
        </button>

        {/* Toggle Inspector Button */}
        {onToggleInspector && (
          <button
            type="button"
            onClick={onToggleInspector}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
              inspectorOpen
                ? "border-[#cbd5e1] dark:border-white/20 bg-[#e2e8f0] dark:bg-white/10 text-[#0f172a] dark:text-white"
                : "border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#171a21] text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-white"
            }`}
            title={inspectorOpen ? "Hide Inspector" : "Show Inspector"}
          >
            {inspectorOpen ? (
              <PanelRightClose className="h-3.5 w-3.5" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </header>
  );
}
