"use client";

import { useState, useRef } from "react";
import { usePanelStore } from "@/store/usePanelStore";
import { parseDxfToMmSegments } from "@/lib/dxf-parser";
import { getCadScaleFactorToMm } from "@/lib/units";
import type { CadFormat, CadImportUnit, CustomCadAsset } from "@/types/panel";
import { Upload, X, FileCheck, Layers } from "lucide-react";

export function CadUploadModal({ onClose }: { onClose: () => void }) {
  const { addCadAsset, setSelected } = usePanelStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceUnit, setSourceUnit] = useState<CadImportUnit>("mm");
  const [assetName, setAssetName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const units: CadImportUnit[] = ["mm", "cm", "m", "inch"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    setAssetName(baseName);
    setErrorMsg(null);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const ext = selectedFile.name.split(".").pop()?.toLowerCase();
      const id = `cad-${Date.now()}`;

      if (ext === "dxf") {
        const text = await selectedFile.text();
        const parsed = parseDxfToMmSegments(text, sourceUnit);

        const asset: CustomCadAsset = {
          id,
          name: assetName || selectedFile.name,
          fileName: selectedFile.name,
          format: "dxf",
          sourceUnit,
          xMm: 0,
          yMm: 0,
          zMm: parsed.boundingBoxMm.d / 2,
          boundingBoxMm: parsed.boundingBoxMm,
          pins: [],
          rawText: text,
        };

        addCadAsset(asset);
        setSelected({ kind: "cad", id });
        onClose();
      } else if (ext === "glb" || ext === "gltf" || ext === "obj") {
        const objectUrl = URL.createObjectURL(selectedFile);
        const scaleFactor = getCadScaleFactorToMm(sourceUnit);

        // Standard bounding box estimate (normalized to mm)
        const asset: CustomCadAsset = {
          id,
          name: assetName || selectedFile.name,
          fileName: selectedFile.name,
          format: ext as CadFormat,
          sourceUnit,
          xMm: 0,
          yMm: 0,
          zMm: 25,
          boundingBoxMm: {
            w: 50 * (sourceUnit === "m" ? 1 : scaleFactor === 1 ? 1 : scaleFactor),
            h: 80 * (sourceUnit === "m" ? 1 : scaleFactor === 1 ? 1 : scaleFactor),
            d: 50 * (sourceUnit === "m" ? 1 : scaleFactor === 1 ? 1 : scaleFactor),
          },
          pins: [],
          objectUrl,
        };

        addCadAsset(asset);
        setSelected({ kind: "cad", id });
        onClose();
      } else {
        setErrorMsg("Unsupported format. Please upload .glb, .gltf, .obj, or .dxf");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to parse CAD file";
      setErrorMsg(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-md w-full p-5 space-y-4 text-xs select-none">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-sky-950 border border-sky-800/60 flex items-center justify-center text-sky-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100 text-sm">
                Custom CAD Importer
              </h3>
              <p className="text-[11px] text-zinc-400">
                Upload 3D model & normalize to canonical mm
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drag & drop / browse area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-800 hover:border-sky-500/50 bg-zinc-900/40 hover:bg-zinc-900/80 rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf,.obj,.dxf"
            onChange={handleFileChange}
            className="hidden"
          />
          {selectedFile ? (
            <div className="text-center space-y-1">
              <FileCheck className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="font-medium text-zinc-200">{selectedFile.name}</div>
              <div className="text-[10px] text-zinc-500 font-mono">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </div>
            </div>
          ) : (
            <div className="text-center space-y-1">
              <Upload className="w-8 h-8 text-zinc-500 mx-auto" />
              <div className="font-medium text-zinc-300">
                Click or drop CAD model here
              </div>
              <div className="text-[11px] text-zinc-500">
                Supports .glb, .gltf, .obj, .dxf
              </div>
            </div>
          )}
        </div>

        {/* Name input */}
        <div>
          <label className="text-[10px] text-zinc-400 font-mono block mb-1">
            Asset Label
          </label>
          <input
            type="text"
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
            placeholder="e.g. VFD Inverter 0.75kW"
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 focus:outline-none"
          />
        </div>

        {/* Source Unit Selector */}
        <div>
          <label className="text-[10px] text-zinc-400 font-mono block mb-1">
            Original CAD Unit Scale (Normalizes to mm)
          </label>
          <div className="grid grid-cols-4 gap-1.5 bg-zinc-900/60 p-1 rounded border border-zinc-800">
            {units.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setSourceUnit(u)}
                className={`py-1.5 rounded font-mono uppercase transition-colors ${
                  sourceUnit === u
                    ? "bg-sky-600 text-white font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">
            Factor: 1 {sourceUnit} = {getCadScaleFactorToMm(sourceUnit)} mm internal
          </p>
        </div>

        {errorMsg && (
          <div className="p-2 rounded bg-red-950/50 border border-red-800/60 text-red-300 text-[11px]">
            {errorMsg}
          </div>
        )}

        <div className="pt-2 flex justify-end gap-2 border-t border-zinc-900">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!selectedFile || isProcessing}
            onClick={handleImport}
            className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium transition-colors cursor-pointer"
          >
            {isProcessing ? "Processing..." : "Import Model"}
          </button>
        </div>
      </div>
    </div>
  );
}
