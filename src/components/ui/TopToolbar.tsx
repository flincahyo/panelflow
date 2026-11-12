"use client";

import { Box, Download, Eye, FileImage, FileText, Grid, Layers, Ruler } from "lucide-react";
import { generateEplanSheetSvg } from "@/lib/sheet-export";
import { generateDrillingDxf, generateDrillingSvg } from "@/lib/template-export";
import { formatDim } from "@/lib/units";
import { usePanelStore } from "@/store/usePanelStore";
import type { DoorMode, GridSnapMm, LengthUnit } from "@/types/panel";

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

export function TopToolbar() {
  const viewportMode = usePanelStore((s) => s.viewportMode);
  const displayUnit = usePanelStore((s) => s.displayUnit);
  const gridSnapMm = usePanelStore((s) => s.gridSnapMm);
  const enclosure = usePanelStore((s) => s.enclosure);
  const rails = usePanelStore((s) => s.rails);
  const ducts = usePanelStore((s) => s.ducts);
  const components = usePanelStore((s) => s.components);
  const wires = usePanelStore((s) => s.wires);
  const titleBlock = usePanelStore((s) => s.titleBlock);

  const setViewportMode = usePanelStore((s) => s.setViewportMode);
  const setDisplayUnit = usePanelStore((s) => s.setDisplayUnit);
  const setGridSnapMm = usePanelStore((s) => s.setGridSnapMm);
  const setDoorMode = usePanelStore((s) => s.setDoorMode);

  const units: LengthUnit[] = ["mm", "cm", "m"];
  const snaps: GridSnapMm[] = [5, 10, 25];
  const doorModes: { value: DoorMode; label: string }[] = [
    { value: "open", label: "Open" },
    { value: "transparent", label: "Glass" },
    { value: "hidden", label: "Hidden" },
  ];

  const handleExportSvg = () => {
    const svg = generateDrillingSvg(enclosure, rails, ducts);
    triggerDownload("panel-pro-drilling-1to1.svg", svg, "image/svg+xml");
  };

  const handleExportDxf = () => {
    const dxf = generateDrillingDxf(enclosure, rails, ducts);
    triggerDownload("panel-pro-drilling-1to1.dxf", dxf, "application/dxf");
  };

  const get2DSheetSvg = () =>
    generateEplanSheetSvg({
      enclosure,
      rails,
      ducts,
      components,
      wires,
      meta: titleBlock,
    });

  const handleExport2DSheetSvg = () => {
    triggerDownload("panel-pro-2d-sheet.svg", get2DSheetSvg(), "image/svg+xml");
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
            a.download = "panel-pro-2d-sheet.png";
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

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-[#12161f] px-4 text-xs text-slate-200">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-mono text-sm font-semibold tracking-wider text-slate-100">
          <span className="inline-block h-2.5 w-2.5 rounded-xs bg-sky-500" />
          PANEL PRO
        </div>

        {/* Viewport Mode Switcher: 3D View vs 2D Layout */}
        <div className="ml-2 flex rounded border border-slate-700 bg-slate-900 p-0.5">
          <button
            type="button"
            onClick={() => setViewportMode("3d")}
            className={`flex items-center gap-1.5 rounded-xs px-2.5 py-1 font-mono text-[11px] transition-colors ${
              viewportMode === "3d"
                ? "bg-sky-600 font-semibold text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            3D View
          </button>
          <button
            type="button"
            onClick={() => setViewportMode("2d")}
            className={`flex items-center gap-1.5 rounded-xs px-2.5 py-1 font-mono text-[11px] transition-colors ${
              viewportMode === "2d"
                ? "bg-sky-600 font-semibold text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            2D Layout
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Unit Switcher */}
        <div className="flex items-center gap-1.5">
          <Ruler className="h-3.5 w-3.5 text-slate-400" />
          <div className="flex rounded border border-slate-700 bg-slate-900 p-0.5">
            {units.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setDisplayUnit(u)}
                className={`rounded-xs px-2 py-0.5 font-mono text-[11px] transition-colors ${
                  displayUnit === u
                    ? "bg-sky-600 font-semibold text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Snap */}
        <div className="flex items-center gap-1.5">
          <Grid className="h-3.5 w-3.5 text-slate-400" />
          <div className="flex rounded border border-slate-700 bg-slate-900 p-0.5">
            {snaps.map((snap) => (
              <button
                key={snap}
                type="button"
                onClick={() => setGridSnapMm(snap)}
                className={`rounded-xs px-2 py-0.5 font-mono text-[11px] transition-colors ${
                  gridSnapMm === snap
                    ? "bg-sky-600 font-semibold text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {formatDim(snap, displayUnit)}
              </button>
            ))}
          </div>
        </div>

        {/* Door Mode */}
        <div className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-slate-400" />
          <div className="flex rounded border border-slate-700 bg-slate-900 p-0.5">
            {doorModes.map((dm) => (
              <button
                key={dm.value}
                type="button"
                onClick={() => setDoorMode(dm.value)}
                className={`rounded-xs px-2 py-0.5 text-[11px] transition-colors ${
                  enclosure.doorMode === dm.value
                    ? "bg-slate-700 font-medium text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {dm.label}
              </button>
            ))}
          </div>
        </div>

        {/* Export Controls */}
        <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
          {viewportMode === "2d" ? (
            <>
              <button
                type="button"
                onClick={handleExport2DSheetSvg}
                className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/80 px-2 py-1 font-mono text-[11px] text-slate-200 hover:border-sky-500/60 hover:bg-slate-800"
                title="Export 2D Engineering Sheet (SVG)"
              >
                <Download className="h-3 w-3 text-sky-400" />
                2D SVG
              </button>
              <button
                type="button"
                onClick={handleExport2DSheetPng}
                className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/80 px-2 py-1 font-mono text-[11px] text-slate-200 hover:border-sky-500/60 hover:bg-slate-800"
                title="Export 2D Engineering Sheet (High-Res PNG)"
              >
                <FileImage className="h-3 w-3 text-emerald-400" />
                PNG
              </button>
              <button
                type="button"
                onClick={handleExport2DSheetPdf}
                className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/80 px-2 py-1 font-mono text-[11px] text-slate-200 hover:border-sky-500/60 hover:bg-slate-800"
                title="Print / Save 2D Engineering Sheet as PDF"
              >
                <FileText className="h-3 w-3 text-amber-400" />
                PDF
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleExportSvg}
                className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1 font-mono text-[11px] text-slate-200 hover:border-sky-500/60 hover:bg-slate-800"
              >
                <Download className="h-3 w-3 text-sky-400" />
                SVG 1:1
              </button>
              <button
                type="button"
                onClick={handleExportDxf}
                className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1 font-mono text-[11px] text-slate-200 hover:border-sky-500/60 hover:bg-slate-800"
              >
                <Download className="h-3 w-3 text-emerald-400" />
                DXF 1:1
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
