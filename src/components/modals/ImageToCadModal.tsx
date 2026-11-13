"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Upload,
  Sliders,
  Maximize2,
  MapPin,
  Download,
  FolderPlus,
  Play,
  Check,
  RotateCcw,
  Sparkles,
  Crop,
  Layers,
} from "lucide-react";
import { usePanelStore } from "@/store/usePanelStore";
import { saveCustomCadToLibrary } from "@/lib/indexed-db";
import {
  vectorizeImage,
  type ImageToCadResult,
} from "@/lib/image-to-cad";
import type { CustomCadAsset, PinTerminal } from "@/types/panel";

interface ImageToCadModalProps {
  onClose: () => void;
}

export function ImageToCadModal({ onClose }: ImageToCadModalProps) {
  const { addCadAsset, setSelected } = usePanelStore();

  // Wizard Step: 1 = Upload, 2 = Params & Trace, 3 = Pins & Crop, 4 = Finish/Export
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // File & Image state
  const [file, setFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [componentName, setComponentName] = useState("");

  // Physical Dimensions (mm)
  const [widthMm, setWidthMm] = useState<number>(45);
  const [heightMm, setHeightMm] = useState<number>(85);
  const [depthMm, setDepthMm] = useState<number>(70);

  // Trace Calibration
  const [threshold, setThreshold] = useState<number>(128);
  const [invert, setInvert] = useState<boolean>(false);
  const [toleranceMm, setToleranceMm] = useState<number>(0.35);

  // Vectorized Result
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [traceResult, setTraceResult] = useState<ImageToCadResult | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);

  // Pins & Crop
  const [pins, setPins] = useState<PinTerminal[]>([]);
  const [newPinLabel, setNewPinLabel] = useState<string>("L1");
  const [cropMm, setCropMm] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  const [showCropInputs, setShowCropInputs] = useState<boolean>(false);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.4);

  // Success states
  const [savedToLibrarySuccess, setSavedToLibrarySuccess] = useState<boolean>(false);
  const [placedOnCanvasSuccess, setPlacedOnCanvasSuccess] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // Handle file select
  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      setTraceError("Please upload an image file (PNG, JPG, WebP)");
      return;
    }
    setFile(selectedFile);
    const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
    setComponentName(baseName || "Custom Component");
    setTraceError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setPreviewDataUrl(url);
      setStep(2);
    };
    reader.readAsDataURL(selectedFile);
  };

  // Run vectorization engine
  const runVectorization = useCallback(async () => {
    if (!previewDataUrl) return;
    setIsTracing(true);
    setTraceError(null);

    try {
      const res = await vectorizeImage(previewDataUrl, {
        widthMm: Math.max(5, widthMm),
        heightMm: Math.max(5, heightMm),
        depthMm: Math.max(1, depthMm),
        threshold,
        invert,
        toleranceMm,
      });
      setTraceResult(res);
    } catch (err: unknown) {
      setTraceError(err instanceof Error ? err.message : "Failed to vectorize image");
    } finally {
      setIsTracing(false);
    }
  }, [previewDataUrl, widthMm, heightMm, depthMm, threshold, invert, toleranceMm]);

  // Auto re-trace when entering Step 2 or changing params (debounced)
  useEffect(() => {
    if (step >= 2 && previewDataUrl) {
      const timer = setTimeout(() => {
        runVectorization();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [step, previewDataUrl, widthMm, heightMm, threshold, invert, toleranceMm, runVectorization]);

  // Interactive Pin Placement on Preview SVG
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (step !== 3) return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - svgRect.left;
    const clickY = e.clientY - svgRect.top;

    // Normalizing to Component Local mm (0,0 is center, x right, y up)
    const normX = (clickX / svgRect.width - 0.5) * widthMm;
    const normY = (0.5 - clickY / svgRect.height) * heightMm;

    const newPin: PinTerminal = {
      id: `pin-${Date.now()}-${pins.length + 1}`,
      label: newPinLabel.trim() || `P${pins.length + 1}`,
      localXMm: Number(normX.toFixed(2)),
      localYMm: Number(normY.toFixed(2)),
      localZMm: 0,
    };

    setPins((prev) => [...prev, newPin]);

    // Next suggested label standard
    const standardLabels = ["L1", "L2", "L3", "N", "PE", "13", "14", "21", "22", "A1", "A2"];
    const currIdx = standardLabels.indexOf(newPinLabel.trim());
    if (currIdx >= 0 && currIdx < standardLabels.length - 1) {
      setNewPinLabel(standardLabels[currIdx + 1]);
    }
  };

  const removePin = (pinId: string) => {
    setPins((prev) => prev.filter((p) => p.id !== pinId));
  };

  // Build the CustomCadAsset object
  const buildCustomCadAsset = (): CustomCadAsset => {
    const id = `cad-img-${Date.now()}`;
    const allZeroCrop =
      cropMm.top === 0 && cropMm.bottom === 0 && cropMm.left === 0 && cropMm.right === 0;

    return {
      id,
      name: componentName.trim() || "Image Component",
      fileName: file ? file.name : "component.dxf",
      format: "dxf",
      sourceUnit: "mm",
      xMm: 0,
      yMm: 0,
      zMm: (depthMm || 70) / 2,
      boundingBoxMm: {
        w: widthMm,
        h: heightMm,
        d: depthMm || 70,
      },
      cropMm: allZeroCrop ? undefined : cropMm,
      pins,
      rawText: traceResult?.dxfText || "",
      dataUrl: previewDataUrl || undefined,
      imageOverlayUrl: previewDataUrl || undefined,
      showImageOverlay: true,
      entityCount: traceResult?.segments.length || 0,
    };
  };

  // Actions
  const handleSaveToLibrary = async () => {
    const asset = buildCustomCadAsset();
    try {
      await saveCustomCadToLibrary(asset);
      // Sync cloud if endpoint available
      fetch("/api/custom-parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: asset.name,
          format: asset.format,
          bounding_box: asset.cropMm
            ? { ...asset.boundingBoxMm, cropMm: asset.cropMm }
            : asset.boundingBoxMm,
          pins: asset.pins,
          cad_data: asset.rawText || asset.dataUrl || null,
        }),
      }).catch(() => {});

      setSavedToLibrarySuccess(true);
      setTimeout(() => setSavedToLibrarySuccess(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleDownloadDxf = () => {
    if (!traceResult?.dxfText) return;
    const blob = new Blob([traceResult.dxfText], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(componentName || "component").replace(/[^a-zA-Z0-9_-]/g, "_")}.dxf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePlaceOnCanvas = () => {
    const asset = buildCustomCadAsset();
    addCadAsset(asset);
    setSelected({ kind: "cad", id: asset.id });
    setPlacedOnCanvasSuccess(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
      <div className="flex flex-col h-[90vh] max-h-[820px] w-full max-w-4xl rounded-2xl border border-[#cbd5e1] dark:border-white/10 bg-white dark:bg-[#111318] text-[#0f172a] dark:text-slate-100 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-white/10 px-5 py-3.5 bg-[#f8fafc] dark:bg-[#161922]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-[#0f172a] dark:text-white">
                Image to CAD / Vector Component Converter
              </h2>
              <p className="text-[11px] text-[#64748b] dark:text-slate-400">
                Transform PNG/JPG photos or datasheet drawings to calibrated DXF vectors with terminal pins
              </p>
            </div>
          </div>

          {/* Stepper Tabs */}
          <div className="hidden sm:flex items-center gap-1 rounded-lg border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#0c0e14] p-1 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => previewDataUrl && setStep(1)}
              className={`rounded px-2.5 py-1 transition-colors ${
                step === 1 ? "bg-white dark:bg-[#202430] text-sky-500 shadow-xs" : "text-[#64748b] dark:text-slate-400"
              }`}
            >
              1. Upload
            </button>
            <button
              type="button"
              disabled={!previewDataUrl}
              onClick={() => previewDataUrl && setStep(2)}
              className={`rounded px-2.5 py-1 transition-colors ${
                step === 2 ? "bg-white dark:bg-[#202430] text-sky-500 shadow-xs" : "text-[#64748b] dark:text-slate-400"
              } ${!previewDataUrl ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              2. Dimensions & Trace
            </button>
            <button
              type="button"
              disabled={!traceResult}
              onClick={() => traceResult && setStep(3)}
              className={`rounded px-2.5 py-1 transition-colors ${
                step === 3 ? "bg-white dark:bg-[#202430] text-sky-500 shadow-xs" : "text-[#64748b] dark:text-slate-400"
              } ${!traceResult ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              3. Pins & Crop
            </button>
            <button
              type="button"
              disabled={!traceResult}
              onClick={() => traceResult && setStep(4)}
              className={`rounded px-2.5 py-1 transition-colors ${
                step === 4 ? "bg-white dark:bg-[#202430] text-sky-500 shadow-xs" : "text-[#64748b] dark:text-slate-400"
              } ${!traceResult ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              4. Export
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* Main Visual Preview Area */}
          <div
            ref={previewContainerRef}
            className="md:col-span-7 lg:col-span-8 flex flex-col items-center justify-center p-4 bg-[#f8fafc] dark:bg-[#090b10] border-b md:border-b-0 md:border-r border-[#e2e8f0] dark:border-white/10 relative overflow-hidden"
          >
            {!previewDataUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = e.dataTransfer.files[0];
                  if (dropped) handleFile(dropped);
                }}
                className="flex flex-col items-center justify-center gap-3 w-full max-w-md h-72 rounded-2xl border-2 border-dashed border-[#cbd5e1] dark:border-white/20 bg-white dark:bg-[#141720] hover:border-sky-500 hover:bg-sky-500/5 transition-all cursor-pointer p-6 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500">
                  <Upload className="h-7 w-7" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-[#0f172a] dark:text-white">
                    Click to upload or drag image here
                  </div>
                  <div className="text-xs text-[#64748b] dark:text-slate-400 mt-1">
                    PNG, JPG, WebP (datasheet schematic, component photo, CAD raster)
                  </div>
                </div>
                <div className="font-mono text-[11px] text-[#94a3b8] dark:text-slate-500">
                  Runs 100% locally in browser (Zero backend lag)
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full relative">
                {/* SVG Calibration & Vector Overlay Display */}
                <div className="relative max-h-[460px] max-w-full flex items-center justify-center bg-white dark:bg-[#141720] rounded-xl border border-[#cbd5e1] dark:border-white/10 shadow-inner overflow-hidden p-2">
                  <svg
                    viewBox={`-${widthMm / 2} -${heightMm / 2} ${widthMm} ${heightMm}`}
                    className="max-h-[420px] max-w-full cursor-crosshair"
                    style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
                    onClick={handleSvgClick}
                  >
                    {/* Background Grid Lines in mm */}
                    <defs>
                      <pattern id="grid-pattern-mm" width="10" height="10" patternUnits="userSpaceOnUse">
                        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.15" className="text-slate-300 dark:text-slate-800" />
                      </pattern>
                    </defs>
                    <rect
                      x={-widthMm / 2}
                      y={-heightMm / 2}
                      width={widthMm}
                      height={heightMm}
                      fill="url(#grid-pattern-mm)"
                    />

                    {/* Calibrated Raster Image Overlay */}
                    {previewDataUrl && (
                      <image
                        href={previewDataUrl}
                        x={-widthMm / 2}
                        y={-heightMm / 2}
                        width={widthMm}
                        height={heightMm}
                        preserveAspectRatio="none"
                        opacity={overlayOpacity}
                      />
                    )}

                    {/* Vector Segments */}
                    {traceResult?.segments.map((seg, i) => (
                      <line
                        key={i}
                        x1={seg.x1}
                        y1={-seg.y1} // SVG y is down, DXF y is up
                        x2={seg.x2}
                        y2={-seg.y2}
                        stroke="#0284c7"
                        strokeWidth="0.5"
                        strokeLinecap="round"
                      />
                    ))}

                    {/* Outer Bounding Box Stroke */}
                    <rect
                      x={-widthMm / 2}
                      y={-heightMm / 2}
                      width={widthMm}
                      height={heightMm}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="0.4"
                      strokeDasharray="2,2"
                    />

                    {/* Crop guide if active */}
                    {(cropMm.top > 0 || cropMm.bottom > 0 || cropMm.left > 0 || cropMm.right > 0) && (
                      <rect
                        x={-widthMm / 2 + cropMm.left}
                        y={-heightMm / 2 + cropMm.top}
                        width={Math.max(1, widthMm - cropMm.left - cropMm.right)}
                        height={Math.max(1, heightMm - cropMm.top - cropMm.bottom)}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="0.6"
                        strokeDasharray="3,1.5"
                      />
                    )}

                    {/* Terminal Pins Markers */}
                    {pins.map((p) => (
                      <g key={p.id} transform={`translate(${p.localXMm}, ${-p.localYMm})`}>
                        <circle r="1.8" fill="#f59e0b" fillOpacity="0.3" stroke="#f59e0b" strokeWidth="0.4" />
                        <line x1="-1" y1="0" x2="1" y2="0" stroke="#f59e0b" strokeWidth="0.3" />
                        <line x1="0" y1="-1" x2="0" y2="1" stroke="#f59e0b" strokeWidth="0.3" />
                        <text
                          x="2.4"
                          y="1"
                          fontSize="2.8"
                          fontWeight="bold"
                          fontFamily="monospace"
                          fill="#f59e0b"
                          stroke="#000000"
                          strokeWidth="0.4"
                          style={{ paintOrder: "stroke fill" }}
                        >
                          {p.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>

                {/* Bottom preview toolbar */}
                <div className="flex items-center justify-between w-full max-w-md mt-2 px-2 text-[11px] text-[#64748b] dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">
                      {widthMm}×{heightMm} mm
                    </span>
                    <span>•</span>
                    <span className="font-mono">{traceResult?.segments.length || 0} vectors</span>
                    <span>•</span>
                    <span className="font-mono">{pins.length} pins</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Overlay:</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={overlayOpacity}
                      onChange={(e) => setOverlayOpacity(Number.parseFloat(e.target.value))}
                      className="w-20 accent-sky-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls & Configuration Sidebar */}
          <div className="md:col-span-5 lg:col-span-4 p-5 flex flex-col justify-between overflow-y-auto bg-white dark:bg-[#111318]">
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                    Step 1: Choose Image Source
                  </h3>
                  <p className="text-xs text-[#0f172a] dark:text-slate-200">
                    Upload a front-view photograph, manufacturer 2D layout drawing, or catalog graphic.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-[#64748b] dark:text-slate-400">
                      Component Name / Reference
                    </span>
                    <input
                      type="text"
                      value={componentName}
                      onChange={(e) => setComponentName(e.target.value)}
                      placeholder="e.g. Fuji Electric SC-03 Contactor"
                      className="w-full rounded-lg border border-[#cbd5e1] dark:border-white/10 bg-[#f8fafc] dark:bg-[#161922] px-3 py-2 text-xs text-[#0f172a] dark:text-slate-100 focus:border-sky-500 focus:outline-none"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Browse Photo / Image
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                    Step 2: Calibrate Dimensions & Vectorize
                  </h3>
                  <p className="text-xs text-[#0f172a] dark:text-slate-300">
                    Input real component dimensions. Adjust contrast threshold for clean edge lines.
                  </p>
                </div>

                {/* Dimensions (W, H, D) */}
                <div className="space-y-2 rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#161922] p-3">
                  <div className="text-[11px] font-semibold text-[#0f172a] dark:text-slate-200">
                    Physical Dimensions (mm)
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10px] text-[#64748b] dark:text-slate-400">Width (W)</span>
                      <input
                        type="number"
                        min="5"
                        max="2000"
                        value={widthMm}
                        onChange={(e) => setWidthMm(Math.max(5, Number(e.target.value) || 5))}
                        className="w-full rounded-md border border-[#cbd5e1] dark:border-white/10 bg-white dark:bg-[#0c0e14] px-2 py-1 text-xs font-mono"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-[#64748b] dark:text-slate-400">Height (H)</span>
                      <input
                        type="number"
                        min="5"
                        max="2000"
                        value={heightMm}
                        onChange={(e) => setHeightMm(Math.max(5, Number(e.target.value) || 5))}
                        className="w-full rounded-md border border-[#cbd5e1] dark:border-white/10 bg-white dark:bg-[#0c0e14] px-2 py-1 text-xs font-mono"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-[#64748b] dark:text-slate-400">Depth (D)</span>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={depthMm}
                        onChange={(e) => setDepthMm(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full rounded-md border border-[#cbd5e1] dark:border-white/10 bg-white dark:bg-[#0c0e14] px-2 py-1 text-xs font-mono"
                      />
                    </label>
                  </div>
                </div>

                {/* Threshold & Simplification */}
                <div className="space-y-3 rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#161922] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#0f172a] dark:text-slate-200">
                      Binarization Threshold
                    </span>
                    <span className="font-mono text-[11px] text-sky-500">{threshold} / 255</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="245"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full accent-sky-500"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-semibold text-[#0f172a] dark:text-slate-200">
                      Invert Polarity (Light on Dark)
                    </span>
                    <input
                      type="checkbox"
                      checked={invert}
                      onChange={(e) => setInvert(e.target.checked)}
                      className="rounded border-[#cbd5e1] text-sky-500 focus:ring-sky-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-semibold text-[#0f172a] dark:text-slate-200">
                      Line Smoothing (Tolerance mm)
                    </span>
                    <span className="font-mono text-[11px] text-sky-500">{toleranceMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.05"
                    value={toleranceMm}
                    onChange={(e) => setToleranceMm(Number.parseFloat(e.target.value))}
                    className="w-full accent-sky-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-lg border border-[#cbd5e1] dark:border-white/10 px-3 py-2 text-xs font-medium text-[#64748b] dark:text-slate-300 hover:bg-[#f8fafc] dark:hover:bg-white/5"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isTracing || !traceResult}
                    onClick={() => setStep(3)}
                    className="flex-1 rounded-lg bg-sky-500 hover:bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Proceed to Pins & Crop</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                    Step 3: Interactive Terminal Pins & Crop
                  </h3>
                  <p className="text-xs text-[#0f172a] dark:text-slate-300">
                    Click anywhere on the preview to add wire connection terminals (e.g. L1, L2, A1).
                  </p>
                </div>

                {/* Add pin label helper */}
                <div className="space-y-2 rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#161922] p-3">
                  <label className="block space-y-1">
                    <span className="text-[10px] text-[#64748b] dark:text-slate-400 font-semibold uppercase">
                      Next Pin Label
                    </span>
                    <input
                      type="text"
                      value={newPinLabel}
                      onChange={(e) => setNewPinLabel(e.target.value)}
                      placeholder="e.g. L1, L2, A1, 13"
                      className="w-full rounded-md border border-[#cbd5e1] dark:border-white/10 bg-white dark:bg-[#0c0e14] px-2.5 py-1.5 text-xs font-mono font-semibold text-amber-500"
                    />
                  </label>
                  <div className="text-[10px] text-[#94a3b8] dark:text-slate-400 italic">
                    Tip: Click directly on terminal screws in the component view to place.
                  </div>
                </div>

                {/* Crop & Trim Toggle */}
                <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#161922] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#0f172a] dark:text-slate-200 flex items-center gap-1.5">
                      <Crop className="h-3.5 w-3.5 text-amber-500" />
                      Trim Margins (Crop mm)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCropInputs((v) => !v)}
                      className="text-xs text-sky-500 font-medium hover:underline"
                    >
                      {showCropInputs ? "Hide" : "Adjust"}
                    </button>
                  </div>

                  {showCropInputs && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-[#64748b]">Top (mm)</span>
                        <input
                          type="number"
                          min="0"
                          value={cropMm.top}
                          onChange={(e) =>
                            setCropMm((p) => ({ ...p, top: Math.max(0, Number(e.target.value) || 0) }))
                          }
                          className="w-full rounded border border-[#cbd5e1] dark:border-white/10 bg-white dark:bg-[#0c0e14] px-2 py-1 text-xs font-mono"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-[#64748b]">Bottom (mm)</span>
                        <input
                          type="number"
                          min="0"
                          value={cropMm.bottom}
                          onChange={(e) =>
                            setCropMm((p) => ({ ...p, bottom: Math.max(0, Number(e.target.value) || 0) }))
                          }
                          className="w-full rounded border border-[#cbd5e1] dark:border-white/10 bg-white dark:bg-[#0c0e14] px-2 py-1 text-xs font-mono"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-[#64748b]">Left (mm)</span>
                        <input
                          type="number"
                          min="0"
                          value={cropMm.left}
                          onChange={(e) =>
                            setCropMm((p) => ({ ...p, left: Math.max(0, Number(e.target.value) || 0) }))
                          }
                          className="w-full rounded border border-[#cbd5e1] dark:border-white/10 bg-white dark:bg-[#0c0e14] px-2 py-1 text-xs font-mono"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-[#64748b]">Right (mm)</span>
                        <input
                          type="number"
                          min="0"
                          value={cropMm.right}
                          onChange={(e) =>
                            setCropMm((p) => ({ ...p, right: Math.max(0, Number(e.target.value) || 0) }))
                          }
                          className="w-full rounded border border-[#cbd5e1] dark:border-white/10 bg-white dark:bg-[#0c0e14] px-2 py-1 text-xs font-mono"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Placed Pins List */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
                    Placed Pins ({pins.length})
                  </span>
                  {pins.length === 0 ? (
                    <div className="text-[11px] text-[#94a3b8] italic">No pins placed yet. Click preview image.</div>
                  ) : (
                    pins.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-md border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#161922] px-2 py-1 text-xs"
                      >
                        <span className="font-mono font-bold text-amber-500">{p.label}</span>
                        <span className="font-mono text-[10px] text-[#64748b]">
                          ({p.localXMm}, {p.localYMm})
                        </span>
                        <button
                          type="button"
                          onClick={() => removePin(p.id)}
                          className="text-[#94a3b8] hover:text-rose-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-lg border border-[#cbd5e1] dark:border-white/10 px-3 py-2 text-xs font-medium text-[#64748b] dark:text-slate-300 hover:bg-[#f8fafc] dark:hover:bg-white/5"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="flex-1 rounded-lg bg-sky-500 hover:bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Proceed to Save & Export</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                    Step 4: Save to Library & Use
                  </h3>
                  <p className="text-xs text-[#0f172a] dark:text-slate-300">
                    Component ready with calibrated mm boundaries, terminal pins, and DXF vectors.
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  {/* Action: Save to Library */}
                  <button
                    type="button"
                    onClick={handleSaveToLibrary}
                    className="flex w-full items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 px-4 py-3 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-white">
                        <FolderPlus className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-[#0f172a] dark:text-white">
                          Save to My CAD Library
                        </div>
                        <div className="text-[10px] text-[#64748b] dark:text-slate-400">
                          Appears in Parts & CAD custom library immediately
                        </div>
                      </div>
                    </div>
                    {savedToLibrarySuccess ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <span className="text-xs text-sky-500 font-semibold">Save</span>
                    )}
                  </button>

                  {/* Action: Place on Active Canvas */}
                  <button
                    type="button"
                    onClick={handlePlaceOnCanvas}
                    className="flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-3 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white">
                        <Play className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-[#0f172a] dark:text-white">
                          Place on Active Canvas
                        </div>
                        <div className="text-[10px] text-[#64748b] dark:text-slate-400">
                          Add component right away to 2D & 3D panel workspace
                        </div>
                      </div>
                    </div>
                    {placedOnCanvasSuccess ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <span className="text-xs text-emerald-500 font-semibold">Place</span>
                    )}
                  </button>

                  {/* Action: Download .DXF File */}
                  <button
                    type="button"
                    onClick={handleDownloadDxf}
                    className="flex w-full items-center justify-between rounded-xl border border-[#cbd5e1] dark:border-white/10 bg-[#f8fafc] dark:bg-[#161922] hover:bg-[#f1f5f9] dark:hover:bg-white/5 px-4 py-3 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f172a] dark:bg-white/10 text-white">
                        <Download className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-[#0f172a] dark:text-white">
                          Download as .DXF File
                        </div>
                        <div className="text-[10px] text-[#64748b] dark:text-slate-400">
                          Standard AutoCAD R12 DXF format (mm scaled)
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-[#64748b] font-medium">Export</span>
                  </button>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-lg border border-[#cbd5e1] dark:border-white/10 px-3 py-2 text-xs font-medium text-[#64748b] dark:text-slate-300 hover:bg-[#f8fafc] dark:hover:bg-white/5"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs font-semibold text-white transition-colors"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        className="hidden"
      />
    </div>
  );
}
