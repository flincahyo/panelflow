"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Box,
  ChevronDown,
  ClipboardList,
  Copy,
  Cpu,
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
  Menu,
  Network,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Save,
  Sliders,
  Sun,
  Moon,
  Hash,
  Undo2,
  Users,
  Zap,
  Cloud,
  LogIn,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { clearAutoSaveSession } from "@/lib/indexed-db";
import { useAuthStore } from "@/store/useAuthStore";
import {
  parseAndValidatePflow,
  rehydrateCadAssets,
  sanitizeProjectFilename,
  serializeProjectAsync,
} from "@/lib/project-io";
import { generatePanelFlowSheetSvg } from "@/lib/sheet-export";
import { generateDrillingDxf, generateDrillingSvg } from "@/lib/template-export";
import { generateDoorDrillingDxf, generateDoorDrillingSvg } from "@/lib/door-cutout";
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

  const sheets = usePanelStore((s) => s.sheets);
  const activeSheetId = usePanelStore((s) => s.activeSheetId);
  const activeSheetType = usePanelStore((s) => s.activeSheetType);
  const autoRouteDuctsEnabled = usePanelStore((s) => s.autoRouteDuctsEnabled);
  const loadProjectState = usePanelStore((s) => s.loadProjectState);
  const resetToDefaultProject = usePanelStore((s) => s.resetToDefaultProject);

  const undo = usePanelStore((s) => s.undo);
  const redo = usePanelStore((s) => s.redo);
  const canUndo = usePanelStore((s) => s.canUndo);
  const canRedo = usePanelStore((s) => s.canRedo);
  const autoRouteAllWires = usePanelStore((s) => s.autoRouteAllWires);
  const autoNumberWires = usePanelStore((s) => s.autoNumberWires);
  const selected = usePanelStore((s) => s.selected);
  const selectedIds = usePanelStore((s) => s.selectedIds);
  const clipboardItems = usePanelStore((s) => s.clipboardItems);
  const copySelectedToClipboard = usePanelStore((s) => s.copySelectedToClipboard);
  const pasteFromClipboard = usePanelStore((s) => s.pasteFromClipboard);
  const groupSelectedItems = usePanelStore((s) => s.groupSelectedItems);
  const ungroupSelectedItems = usePanelStore((s) => s.ungroupSelectedItems);

  const setViewportMode = usePanelStore((s) => s.setViewportMode);
  const setDisplayUnit = usePanelStore((s) => s.setDisplayUnit);
  const setGridSnapMm = usePanelStore((s) => s.setGridSnapMm);
  const setDoorMode = usePanelStore((s) => s.setDoorMode);
  const addSheet = usePanelStore((s) => s.addSheet);
  const rightPanelTab = usePanelStore((s) => s.rightPanelTab);
  const setRightPanelTab = usePanelStore((s) => s.setRightPanelTab);
  const setInspectorOpen = usePanelStore((s) => s.setInspectorOpen);
  const leftSidebarOpen = usePanelStore((s) => s.leftSidebarOpen);
  const toggleLeftSidebar = usePanelStore((s) => s.toggleLeftSidebar);

  const user = useAuthStore((s) => s.user);
  const setAuthModalOpen = useAuthStore((s) => s.setAuthModalOpen);
  const setProjectsDrawerOpen = useAuthStore((s) => s.setProjectsDrawerOpen);
  const logout = useAuthStore((s) => s.logout);
  const syncStatus = useAuthStore((s) => s.syncStatus);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const [activeMenu, setActiveMenu] = useState<"file" | "edit" | "view" | "mobile" | null>(
    null
  );
  const menuBarRef = useRef<HTMLDivElement>(null);
  const openPflowInputRef = useRef<HTMLInputElement>(null);

  const units: LengthUnit[] = ["mm", "cm", "m"];
  const snaps: GridSnapMm[] = [1, 5, 10, 25];

  // Close menus on outside click
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (
        menuBarRef.current &&
        !menuBarRef.current.contains(e.target as Node)
      ) {
        setActiveMenu(null);
      }
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleDown);
    return () => window.removeEventListener("mousedown", handleDown);
  }, []);

  const handleExportSvg = () => {
    if (activeSheetType === "door-cutout") {
      const svg = generateDoorDrillingSvg(enclosure, components);
      triggerDownload("panelflow-door-drilling-1to1.svg", svg, "image/svg+xml");
      return;
    }
    const svg = generateDrillingSvg(enclosure, rails, ducts, plateConfig);
    triggerDownload("panelflow-drilling-1to1.svg", svg, "image/svg+xml");
  };

  const handleExportDxf = () => {
    if (activeSheetType === "door-cutout") {
      const dxf = generateDoorDrillingDxf(enclosure, components);
      triggerDownload("panelflow-door-drilling-1to1.dxf", dxf, "application/dxf");
      return;
    }
    const dxf = generateDrillingDxf(enclosure, rails, ducts, plateConfig);
    triggerDownload("panelflow-drilling-1to1.dxf", dxf, "application/dxf");
  };

  const get2DSheetSvg = () =>
    generatePanelFlowSheetSvg({
      enclosure,
      plateConfig,
      rails,
      ducts,
      components,
      cadAssets,
      wires,
      meta: titleBlock,
      showDuctFillBadge: false,
    });

  const handleSavePflow = useCallback(async () => {
    try {
      const json = await serializeProjectAsync({
        sheets,
        activeSheetId,
        displayUnit,
        gridSnapMm,
        autoRouteDuctsEnabled,
        titleBlock,
      });
      const filename = sanitizeProjectFilename(titleBlock.projectName || "project");
      triggerDownload(filename, json, "application/json");
    } catch (err) {
      alert(
        `Failed to save project: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  }, [sheets, activeSheetId, displayUnit, gridSnapMm, autoRouteDuctsEnabled, titleBlock]);

  const handleOpenPflowFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const result = parseAndValidatePflow(text);
        if (!result.ok) {
          alert(`Failed to load .pflow project: ${result.error}`);
          return;
        }
        const proj = result.data;
        loadProjectState({
          sheets: rehydrateCadAssets(proj.sheets),
          activeSheetId: proj.activeSheetId,
          displayUnit: proj.displayUnit,
          gridSnapMm: proj.gridSnapMm,
          autoRouteDuctsEnabled: proj.autoRouteDuctsEnabled,
          titleBlock: proj.titleBlock,
        });
      } catch (err) {
        alert(
          `Failed to read .pflow file: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
      } finally {
        e.target.value = "";
      }
    },
    [loadProjectState]
  );

  const handleNewProject = useCallback(async () => {
    const ok = window.confirm(
      "Start a New Project? Unsaved changes will be cleared and reset to a clean default mounting plate."
    );
    if (!ok) return;
    try {
      await clearAutoSaveSession();
    } catch {
      // ignore
    }
    resetToDefaultProject();
  }, [resetToDefaultProject]);

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
      if (key === "s") {
        e.preventDefault();
        handleSavePflow();
      } else if (key === "n" && e.shiftKey) {
        e.preventDefault();
        autoNumberWires();
      } else if (key === "o") {
        e.preventDefault();
        openPflowInputRef.current?.click();
      } else if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, handleSavePflow]);

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
    const cleanSvg = svg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    const blob = new Blob(
      [
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${titleBlock.projectName} - Sheet ${titleBlock.sheetNo}</title>
  <style>
    @page { size: landscape; margin: 5mm; }
    @media print {
      body { margin: 0; background: #fff !important; }
      .no-print { display: none !important; }
      svg { width: 100% !important; height: auto !important; max-height: 98vh; page-break-inside: avoid; }
    }
    body {
      margin: 0;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #f1f5f9;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .toolbar {
      width: 100%;
      max-width: 1200px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding: 8px 16px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
    }
    .btn {
      background: #0284c7;
      color: #fff;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }
    .sheet-card {
      background: #ffffff;
      padding: 12px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      max-width: 98vw;
      overflow: auto;
    }
    svg { width: 100%; height: auto; display: block; max-height: 85vh; }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <div>
      <strong>${titleBlock.projectName}</strong> — Sheet ${titleBlock.sheetNo}
    </div>
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="sheet-card">
    ${cleanSvg}
  </div>
  <script>
    // Auto-open print dialog once ready
    window.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => { window.print(); }, 400);
    });
  </script>
</body>
</html>`
      ],
      { type: "text/html;charset=utf-8" }
    );
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, "_blank");
    if (!win) {
      // Fallback if popup blocked
      const a = document.createElement("a");
      a.href = blobUrl;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const dropdownPanelClass =
    "absolute top-9 left-0 z-50 rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white/98 dark:bg-[#111318]/98 p-1.5 shadow-xl dark:shadow-2xl backdrop-blur-xl text-[13px]";
  const dropdownItemClass =
    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white";
  const dropdownSectionLabelClass =
    "px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-[#64748b] dark:text-slate-500 font-medium";
  const dropdownDividerClass = "my-1 border-t border-[#e2e8f0] dark:border-white/10";

  return (
    <header className="relative z-40 flex h-14 shrink-0 items-center justify-between border-b border-[#e2e8f0] dark:border-white/10 bg-white/95 dark:bg-[#0c0e14]/95 px-2.5 sm:px-4 text-xs text-[#0f172a] dark:text-slate-200 shadow-sm dark:shadow-none backdrop-blur-xl select-none">
      {/* LEFT SECTION: Logo Badge + Brand + File/Edit/View Menus */}
      <div className="flex items-center gap-2 sm:gap-3.5" ref={menuBarRef}>
        {/* Mobile Parts Drawer Toggle Button */}
        <button
          type="button"
          onClick={toggleLeftSidebar}
          aria-label={leftSidebarOpen ? "Close Parts Drawer" : "Open Parts Drawer"}
          title={leftSidebarOpen ? "Close Parts Drawer" : "Open Parts Drawer"}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all md:hidden ${
            leftSidebarOpen
              ? "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400"
              : "border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-white"
          }`}
        >
          <Cpu className="h-4 w-4" />
        </button>

        {/* Brand Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] dark:border-white/15 bg-[#f8fafc] dark:bg-[#171a21] shadow-xs">
            <Zap className="h-4.5 w-4.5 text-amber-500 dark:text-amber-400 fill-amber-400/20" />
          </div>
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-[#0f172a] dark:text-white text-[14px] sm:text-[15px]">
            <span>PanelFlow</span>
            <span className="hidden sm:inline-block rounded-md border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#64748b] dark:text-slate-400">
              CAD
            </span>
          </div>
        </div>

        {/* Mobile Hamburger / Quick Actions Menu */}
        <div className="relative md:hidden">
          <button
            type="button"
            onClick={() =>
              setActiveMenu(activeMenu === "mobile" ? null : "mobile")
            }
            aria-label="Open Mobile Menu"
            className={`flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-medium transition-colors ${
              activeMenu === "mobile"
                ? "border-sky-400 bg-sky-50 dark:bg-white/10 text-sky-600 dark:text-white"
                : "border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] text-[#64748b] dark:text-slate-400"
            }`}
          >
            <Menu className="h-4 w-4" />
            <span className="font-mono text-[11px]">Menu</span>
          </button>

          {activeMenu === "mobile" && (
            <div className="absolute top-10 left-0 z-50 w-72 max-h-[80vh] overflow-y-auto rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white/98 dark:bg-[#111318]/98 p-2 shadow-2xl backdrop-blur-xl text-xs">
              <div className="px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-[#64748b] dark:text-slate-500 font-medium">
                Active Project
              </div>
              <div className="mb-2 px-2 py-1 font-mono text-xs text-[#0f172a] dark:text-slate-200 truncate">
                {titleBlock.projectName}
              </div>
              <div className={dropdownDividerClass} />

              <div className={dropdownSectionLabelClass}>Project Actions</div>
              <button
                type="button"
                onClick={() => {
                  setActiveMenu(null);
                  handleSavePflow();
                }}
                className={dropdownItemClass}
              >
                <Save className="h-4 w-4 text-emerald-500" />
                Save Project (.pflow)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMenu(null);
                  openPflowInputRef.current?.click();
                }}
                className={dropdownItemClass}
              >
                <FolderOpen className="h-4 w-4 text-amber-500" />
                Open .pflow Project...
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMenu(null);
                  handleNewProject();
                }}
                className={dropdownItemClass}
              >
                <RotateCcw className="h-4 w-4 text-rose-500" />
                New Project (Reset)
              </button>
              <button
                type="button"
                onClick={() => {
                  addSheet("mounting-plate");
                  setActiveMenu(null);
                }}
                className={dropdownItemClass}
              >
                <Plus className="h-4 w-4 text-sky-500" />
                New Mounting Sheet
              </button>

              <div className={dropdownDividerClass} />
              <div className={dropdownSectionLabelClass}>Edit &amp; History</div>
              <button
                type="button"
                disabled={selectedIds.length === 0 && !selected}
                onClick={() => {
                  copySelectedToClipboard();
                  setActiveMenu(null);
                }}
                className={dropdownItemClass}
              >
                <Copy className="h-4 w-4 text-cyan-500" />
                Copy
              </button>
              <button
                type="button"
                disabled={clipboardItems.length === 0}
                onClick={() => {
                  pasteFromClipboard();
                  setActiveMenu(null);
                }}
                className={dropdownItemClass}
              >
                <Copy className="h-4 w-4 text-emerald-500" />
                Paste
              </button>
              <button
                type="button"
                disabled={!canUndo}
                onClick={() => {
                  undo();
                  setActiveMenu(null);
                }}
                className={dropdownItemClass}
              >
                <Undo2 className="h-4 w-4" />
                Undo
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={() => {
                  redo();
                  setActiveMenu(null);
                }}
                className={dropdownItemClass}
              >
                <Redo2 className="h-4 w-4" />
                Redo
              </button>
              <button
                type="button"
                disabled={wires.length === 0}
                onClick={() => {
                  autoRouteAllWires();
                  setActiveMenu(null);
                }}
                className={dropdownItemClass}
              >
                <Network className="h-4 w-4 text-sky-500" />
                Auto-Route All Wires
              </button>
              <button
                type="button"
                disabled={wires.length === 0}
                onClick={() => {
                  autoNumberWires();
                  setActiveMenu(null);
                }}
                className={dropdownItemClass}
              >
                <Hash className="h-4 w-4 text-emerald-500" />
                Auto-Number Wires
              </button>

              <div className={dropdownDividerClass} />
              <div className={dropdownSectionLabelClass}>Export Options</div>
              <button
                type="button"
                onClick={() => {
                  handleExport2DSheetSvg();
                  setActiveMenu(null);
                }}
                className={dropdownItemClass}
              >
                <Download className="h-4 w-4 text-sky-500" />
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
                <FileImage className="h-4 w-4 text-emerald-500" />
                Export High-Res PNG
              </button>
              <button
                type="button"
                onClick={() => {
                  handleExportDxf();
                  setActiveMenu(null);
                }}
                className={dropdownItemClass}
              >
                <Download className="h-4 w-4 text-indigo-500" />
                {activeSheetType === "door-cutout"
                  ? "Export Door Drilling DXF (1:1)"
                  : "Export Drilling DXF"}
              </button>

              <div className={dropdownDividerClass} />
              <div className={dropdownSectionLabelClass}>Units &amp; Theme</div>
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="text-[#64748b] dark:text-slate-400">Unit:</span>
                <div className="flex rounded-md border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#171a21] p-0.5">
                  {units.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setDisplayUnit(u)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                        displayUnit === u
                          ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-bold"
                          : "text-[#64748b] dark:text-slate-400"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setActiveMenu(null);
                }}
                className={dropdownItemClass}
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="h-4 w-4 text-amber-400" />
                    Switch to Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4 text-[#0f172a]" />
                    Switch to Dark Mode
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="hidden h-4 w-px bg-[#e2e8f0] dark:bg-white/10 md:block" />

        {/* Dropdown Menus (RelayFlow style) */}
        <div className="hidden items-center gap-1 md:flex">
          {/* FILE MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setActiveMenu(activeMenu === "file" ? null : "file")
              }
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                activeMenu === "file"
                  ? "bg-[#e2e8f0] dark:bg-white/10 text-[#0f172a] dark:text-white"
                  : "text-[#64748b] dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-white/5 hover:text-[#0f172a] dark:hover:text-slate-200"
              }`}
            >
              File
              <ChevronDown className="h-3.5 w-3.5 text-[#64748b] dark:text-slate-500" />
            </button>

            {activeMenu === "file" && (
              <div className={`${dropdownPanelClass} w-64`}>
                <div className={dropdownSectionLabelClass}>
                  Project (.PFLOW)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu(null);
                    handleNewProject();
                  }}
                  className={dropdownItemClass}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                  New Project (Reset to Default)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu(null);
                    openPflowInputRef.current?.click();
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                    Open .pflow Project...
                  </span>
                  <span className="font-mono text-[11px] text-[#64748b] dark:text-slate-500">
                    Ctrl+O
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu(null);
                    handleSavePflow();
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <Save className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                    Save Project (.pflow)
                  </span>
                  <span className="font-mono text-[11px] text-[#64748b] dark:text-slate-500">
                    Ctrl+S
                  </span>
                </button>
                <div className={dropdownDividerClass} />
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
                  Manufacturing & BOM
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInspectorOpen(true);
                    setRightPanelTab("bom");
                    setActiveMenu(null);
                  }}
                  className={dropdownItemClass}
                >
                  <ClipboardList className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" />
                  BOM & Wire Cutting Schedule...
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
                  {activeSheetType === "door-cutout"
                    ? "Door Drilling Template (1:1)"
                    : "CNC Drilling Template"}
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
                  {activeSheetType === "door-cutout"
                    ? "Export Door Drilling DXF (1:1)"
                    : "Export Drilling DXF (1:1)"}
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
                  {activeSheetType === "door-cutout"
                    ? "Export Door Drilling Template SVG (1:1)"
                    : "Export Drilling SVG (1:1)"}
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
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                activeMenu === "edit"
                  ? "bg-[#e2e8f0] dark:bg-white/10 text-[#0f172a] dark:text-white"
                  : "text-[#64748b] dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-white/5 hover:text-[#0f172a] dark:hover:text-slate-200"
              }`}
            >
              Edit
              <ChevronDown className="h-3.5 w-3.5 text-[#64748b] dark:text-slate-500" />
            </button>

            {activeMenu === "edit" && (
              <div className={`${dropdownPanelClass} w-64`}>
                <button
                  type="button"
                  disabled={selectedIds.length === 0 && !selected}
                  onClick={() => {
                    copySelectedToClipboard();
                    setActiveMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Copy className="h-3.5 w-3.5 text-cyan-500" />
                    Copy
                  </span>
                  <span className="font-mono text-[11px] text-[#64748b] dark:text-slate-500">
                    Ctrl+C
                  </span>
                </button>
                <button
                  type="button"
                  disabled={clipboardItems.length === 0}
                  onClick={() => {
                    pasteFromClipboard();
                    setActiveMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Copy className="h-3.5 w-3.5 text-emerald-500" />
                    Paste
                  </span>
                  <span className="font-mono text-[11px] text-[#64748b] dark:text-slate-500">
                    Ctrl+V
                  </span>
                </button>
                <div className="my-1 border-t border-[#e2e8f0] dark:border-white/10" />
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
                  <span className="font-mono text-[11px] text-[#64748b] dark:text-slate-500">
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
                  <span className="font-mono text-[11px] text-[#64748b] dark:text-slate-500">
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
                <button
                  type="button"
                  disabled={wires.length === 0}
                  onClick={() => {
                    autoNumberWires();
                    setActiveMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-emerald-500" />
                    Auto-Number Wires
                  </span>
                  <span className="font-mono text-[11px] text-[#64748b] dark:text-slate-500">
                    Ctrl+Shift+N
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
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                activeMenu === "view"
                  ? "bg-[#e2e8f0] dark:bg-white/10 text-[#0f172a] dark:text-white"
                  : "text-[#64748b] dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-white/5 hover:text-[#0f172a] dark:hover:text-slate-200"
              }`}
            >
              View
              <ChevronDown className="h-3.5 w-3.5 text-[#64748b] dark:text-slate-500" />
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

        {/* Active Project Pill (RelayFlow parity: left section after File/Edit/View) */}
        <div className="hidden items-center gap-2 rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-3.5 py-1.5 font-mono text-xs md:flex">
          <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[#64748b] dark:text-slate-400" />
          <span className="max-w-[260px] lg:max-w-[340px] truncate text-[#334155] dark:text-slate-300 font-medium">
            {titleBlock.projectName}
          </span>
          <span className="shrink-0 rounded-md border border-[#e2e8f0] dark:border-white/10 bg-[#e2e8f0]/70 dark:bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-[#0f172a] dark:text-slate-200">
            .PFLOW
          </span>
        </div>
      </div>

      {/* RIGHT SECTION: Viewport Switcher + Unit Switcher + BOM Report + Theme Toggle + Inspector Toggle */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Viewport Switcher Pill: [2D Layout] / [3D View] */}
        <div className="flex items-center rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#171a21] p-0.5 shadow-inner">
          <button
            type="button"
            onClick={() => setViewportMode("2d")}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs font-medium transition-all ${
              viewportMode === "2d"
                ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">2D Layout</span>
            <span className="sm:hidden text-[11px]">2D</span>
          </button>
          <button
            type="button"
            onClick={() => setViewportMode("3d")}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs font-medium transition-all ${
              viewportMode === "3d"
                ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">3D View</span>
            <span className="sm:hidden text-[11px]">3D</span>
          </button>
        </div>

        {/* Unit Switcher Pill (mm/cm/m) - Desktop only (in mobile drawer menu) */}
        <div className="hidden sm:flex items-center rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#171a21] p-0.5">
          {units.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setDisplayUnit(u)}
              className={`rounded-full px-2.5 py-1 font-mono text-xs transition-all ${
                displayUnit === u
                  ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-bold shadow-xs"
                  : "text-[#475569] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200 font-medium"
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        {/* Auto-Number Wires Toolbar Button */}
        <button
          type="button"
          disabled={wires.length === 0}
          onClick={() => autoNumberWires()}
          aria-label="Auto-Number Wires (Ctrl+Shift+N)"
          title="Auto-Number Wires (Ctrl+Shift+N)"
          className="flex h-8 items-center gap-1 sm:gap-1.5 rounded-full border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#171a21] px-2 sm:px-3 text-xs font-medium text-[#334155] dark:text-slate-200 shadow-xs dark:shadow-none hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white disabled:opacity-40"
        >
          <Hash className="h-3.5 w-3.5 text-emerald-500" />
          <span className="hidden lg:inline">Auto-Number</span>
        </button>

        {/* BOM & Wire List Quick Button */}
        <button
          type="button"
          onClick={() => {
            setInspectorOpen(true);
            setRightPanelTab("bom");
          }}
          aria-label="BOM & Wire Cutting Schedule"
          title="BOM & Wire Cutting Schedule"
          className={`flex h-8 items-center gap-1 sm:gap-1.5 rounded-full border px-2 sm:px-3 text-xs font-medium transition-all ${
            inspectorOpen && rightPanelTab === "bom"
              ? "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 shadow-xs"
              : "border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#171a21] text-[#334155] dark:text-slate-200 shadow-xs dark:shadow-none hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white"
          }`}
        >
          <ClipboardList className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" />
          <span className="hidden md:inline">BOM</span>
        </button>

        {/* Theme Toggle Button (Sun / Moon) - desktop only in toolbar, mobile has it in menu */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#171a21] text-[#64748b] dark:text-slate-400 shadow-xs dark:shadow-none transition-all hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white"
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

        {/* Auth / Account Pill (RelayFlow parity) */}
        {!user ? (
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            aria-label="Login"
            className="flex h-8 items-center gap-1.5 rounded-full border border-[#e2e8f0] dark:border-white/15 bg-white text-[#0f172a] dark:bg-white dark:text-black px-2.5 sm:px-3.5 text-xs font-semibold shadow-xs transition-all hover:bg-[#f8fafc] dark:hover:bg-slate-100"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Login</span>
          </button>
        ) : (
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => setAccountMenuOpen((o) => !o)}
              className="flex h-8 items-center gap-1.5 sm:gap-2 rounded-full border border-[#e2e8f0] dark:border-white/15 bg-white dark:bg-[#171a21] pr-2 sm:pr-2.5 pl-1.5 text-xs font-medium text-[#0f172a] dark:text-slate-200 shadow-xs hover:bg-[#f8fafc] dark:hover:bg-white/10"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0f172a] dark:bg-white text-[10px] font-bold text-white dark:text-black">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline max-w-[110px] truncate">
                {user.name || user.email.split("@")[0]}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  syncStatus === "saving"
                    ? "bg-amber-400 animate-pulse"
                    : syncStatus === "error"
                      ? "bg-rose-500"
                      : "bg-emerald-500"
                }`}
                title={`Cloud Auto-Save: ${syncStatus}`}
              />
              <ChevronDown className="h-3 w-3 text-[#64748b] dark:text-slate-400" />
            </button>

            {accountMenuOpen && (
              <div className="absolute top-10 right-0 z-50 w-56 rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white/98 dark:bg-[#111318]/98 p-1.5 shadow-xl backdrop-blur-xl text-[13px]">
                <div className="px-2.5 py-1.5 border-b border-[#e2e8f0] dark:border-white/10 mb-1">
                  <div className="truncate text-xs font-semibold text-[#0f172a] dark:text-white">
                    {user.name || "PanelFlow Engineer"}
                  </div>
                  <div className="truncate font-mono text-[10px] text-[#64748b] dark:text-slate-400">
                    {user.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setProjectsDrawerOpen(true);
                  }}
                  className={dropdownItemClass}
                >
                  <Cloud className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" />
                  My Cloud Projects
                </button>
                <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[#64748b] dark:text-slate-400">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      syncStatus === "saving"
                        ? "bg-amber-400 animate-pulse"
                        : syncStatus === "error"
                          ? "bg-rose-500"
                          : "bg-emerald-500"
                    }`}
                  />
                  <span>
                    Cloud Auto-Save:{" "}
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {syncStatus === "saving" ? "Syncing..." : "Active"}
                    </strong>
                  </span>
                </div>
                <div className={dropdownDividerClass} />
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <input
        ref={openPflowInputRef}
        type="file"
        accept=".pflow,.json"
        onChange={handleOpenPflowFile}
        className="hidden"
      />
    </header>
  );
}
