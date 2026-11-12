"use client";

import { usePanelStore } from "@/store/usePanelStore";
import { formatDim } from "@/lib/units";
import { generateDrillingDxf, generateDrillingSvg } from "@/lib/template-export";
import { useState } from "react";
import { X, Download, FileCode, Check } from "lucide-react";

export function ExportModal({ onClose }: { onClose: () => void }) {
  const { enclosure, rails, ducts, displayUnit } = usePanelStore();
  const [copied, setCopied] = useState<"svg" | "dxf" | null>(null);

  const svgContent = generateDrillingSvg(enclosure, rails, ducts);
  const dxfContent = generateDrillingDxf(enclosure, rails, ducts);

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, type: "svg" | "dxf") => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const plateW = enclosure.widthMm - enclosure.backplateInsetMm * 2;
  const plateH = enclosure.heightMm - enclosure.backplateInsetMm * 2;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-xl w-full p-5 space-y-4 text-xs select-none">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-sky-950 border border-sky-800/60 flex items-center justify-center text-sky-400">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100 text-sm">
                2D Drilling Template (1:1 mm)
              </h3>
              <p className="text-[11px] text-zinc-400">
                Mounting plate drilling guide for DIN Rails and Wire Ducts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Plate stats */}
        <div className="grid grid-cols-3 gap-2 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80 font-mono text-[11px]">
          <div>
            <span className="text-zinc-500 block text-[10px]">PLATE SIZE</span>
            <span className="text-zinc-200">
              {plateW} × {plateH} mm
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block text-[10px]">DIN RAILS</span>
            <span className="text-zinc-200">{rails.length} rails (5.5mm ⌀)</span>
          </div>
          <div>
            <span className="text-zinc-500 block text-[10px]">WIRE DUCTS</span>
            <span className="text-zinc-200">{ducts.length} ducts (4.5mm ⌀)</span>
          </div>
        </div>

        {/* Live SVG Preview Box */}
        <div className="h-56 bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-center overflow-hidden">
          <div
            className="max-h-full max-w-full bg-white rounded shadow-sm p-2 flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: svgContent }}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        <div className="text-[11px] text-zinc-400 flex items-center justify-between">
          <span>Standards: EN 50022 35mm Rail pitch 25mm • Wire duct pitch 50mm</span>
          <span className="font-mono text-zinc-500">Scale 1:1 true mm</span>
        </div>

        {/* Export Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex gap-2">
            <button
              onClick={() =>
                downloadFile(
                  svgContent,
                  `panel-drilling-template-${plateW}x${plateH}mm.svg`,
                  "image/svg+xml"
                )
              }
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-medium transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download SVG (1:1)</span>
            </button>
            <button
              onClick={() => copyToClipboard(svgContent, "svg")}
              title="Copy SVG"
              className="px-2.5 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300"
            >
              {copied === "svg" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : "Copy"}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() =>
                downloadFile(
                  dxfContent,
                  `panel-drilling-template-${plateW}x${plateH}mm.dxf`,
                  "application/dxf"
                )
              }
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download DXF (AutoCAD)</span>
            </button>
            <button
              onClick={() => copyToClipboard(dxfContent, "dxf")}
              title="Copy DXF"
              className="px-2.5 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300"
            >
              {copied === "dxf" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
