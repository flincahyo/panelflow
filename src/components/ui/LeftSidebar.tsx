"use client";

import {
  Box,
  ChevronDown,
  Cpu,
  FileUp,
  Layers,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { COMPONENT_LIST } from "@/lib/components-catalog";
import { parseDxfToMmSegments } from "@/lib/dxf-parser";
import { getBackplateDimensions } from "@/lib/template-export";
import { formatDim, fromMm, inputStepForUnit, toMm } from "@/lib/units";
import { usePanelStore } from "@/store/usePanelStore";
import type {
  CadFormat,
  CadImportUnit,
  ComponentTemplateId,
  CustomCadAsset,
} from "@/types/panel";

type TabId = "components" | "rails" | "enclosure" | "cad";

function PartVectorIcon({
  templateId,
  accentColor,
}: {
  templateId: ComponentTemplateId;
  accentColor: string;
}) {
  switch (templateId) {
    case "mcb-1p":
      return (
        <svg viewBox="0 0 36 44" className="h-9 w-9">
          <rect
            x="10"
            y="4"
            width="16"
            height="36"
            rx="2"
            fill="#1e222d"
            stroke="#475569"
            strokeWidth="1.3"
          />
          <circle cx="18" cy="8" r="1.8" fill="#94a3b8" />
          <circle cx="18" cy="36" r="1.8" fill="#94a3b8" />
          <rect x="13" y="17" width="10" height="9" rx="1.2" fill={accentColor} />
          <line x1="18" y1="12" x2="18" y2="17" stroke="#64748b" strokeWidth="1" />
        </svg>
      );
    case "mcb-3p":
      return (
        <svg viewBox="0 0 48 44" className="h-9 w-9">
          <rect
            x="4"
            y="4"
            width="40"
            height="36"
            rx="2"
            fill="#1e222d"
            stroke="#475569"
            strokeWidth="1.3"
          />
          <line x1="17" y1="4" x2="17" y2="40" stroke="#334155" strokeWidth="0.9" />
          <line x1="31" y1="4" x2="31" y2="40" stroke="#334155" strokeWidth="0.9" />
          <circle cx="10.5" cy="8" r="1.6" fill="#94a3b8" />
          <circle cx="24" cy="8" r="1.6" fill="#94a3b8" />
          <circle cx="37.5" cy="8" r="1.6" fill="#94a3b8" />
          <circle cx="10.5" cy="36" r="1.6" fill="#94a3b8" />
          <circle cx="24" cy="36" r="1.6" fill="#94a3b8" />
          <circle cx="37.5" cy="36" r="1.6" fill="#94a3b8" />
          <rect x="8" y="18" width="32" height="7" rx="1.2" fill={accentColor} />
        </svg>
      );
    case "contactor":
      return (
        <svg viewBox="0 0 46 44" className="h-9 w-9">
          <rect
            x="5"
            y="4"
            width="36"
            height="36"
            rx="2.5"
            fill="#1e222d"
            stroke="#475569"
            strokeWidth="1.3"
          />
          <rect x="9" y="13" width="28" height="18" rx="1.5" fill="#0f172a" stroke={accentColor} strokeWidth="1.1" />
          <rect x="17" y="18" width="12" height="8" rx="1" fill={accentColor} fillOpacity="0.8" />
          <circle cx="11" cy="8" r="1.5" fill="#94a3b8" />
          <circle cx="19" cy="8" r="1.5" fill="#94a3b8" />
          <circle cx="27" cy="8" r="1.5" fill="#94a3b8" />
          <circle cx="35" cy="8" r="1.5" fill="#94a3b8" />
          <circle cx="11" cy="36" r="1.5" fill="#94a3b8" />
          <circle cx="19" cy="36" r="1.5" fill="#94a3b8" />
          <circle cx="27" cy="36" r="1.5" fill="#94a3b8" />
          <circle cx="35" cy="36" r="1.5" fill="#94a3b8" />
        </svg>
      );
    case "relay":
      return (
        <svg viewBox="0 0 36 44" className="h-9 w-9">
          <rect
            x="8"
            y="5"
            width="20"
            height="34"
            rx="2"
            fill="#1e222d"
            stroke="#475569"
            strokeWidth="1.3"
          />
          <rect x="11" y="12" width="14" height="20" rx="1.5" fill="#0f172a" stroke={accentColor} strokeWidth="1" />
          <circle cx="18" cy="18" r="2.2" fill={accentColor} />
          <line x1="14" y1="25" x2="22" y2="25" stroke="#64748b" strokeWidth="1.2" />
        </svg>
      );
    case "terminal-block":
      return (
        <svg viewBox="0 0 36 44" className="h-9 w-9">
          <rect
            x="12"
            y="5"
            width="12"
            height="34"
            rx="1.5"
            fill="#1e222d"
            stroke="#64748b"
            strokeWidth="1.3"
          />
          <circle cx="18" cy="11" r="2" fill="#94a3b8" />
          <circle cx="18" cy="33" r="2" fill="#94a3b8" />
          <line x1="18" y1="13" x2="18" y2="31" stroke="#cbd5e1" strokeWidth="1.4" />
        </svg>
      );
    case "psu-24v":
      return (
        <svg viewBox="0 0 48 44" className="h-9 w-9">
          <rect
            x="5"
            y="4"
            width="38"
            height="36"
            rx="2.5"
            fill="#1e222d"
            stroke="#475569"
            strokeWidth="1.3"
          />
          <line x1="10" y1="12" x2="38" y2="12" stroke="#334155" strokeWidth="1" />
          <line x1="10" y1="16" x2="38" y2="16" stroke="#334155" strokeWidth="1" />
          <line x1="10" y1="20" x2="38" y2="20" stroke="#334155" strokeWidth="1" />
          <circle cx="34" cy="29" r="2.5" fill={accentColor} />
          <text x="10" y="31" fontSize="6.5" fontFamily="monospace" fill="#cbd5e1" fontWeight="bold">
            24V
          </text>
        </svg>
      );
  }
}

export function LeftSidebar() {
  const [activeTab, setActiveTab] = useState<TabId>("components");
  const [searchQuery, setSearchQuery] = useState("");
  const [cadImportUnit, setCadImportUnit] = useState<CadImportUnit>("mm");
  const [railsOpen, setRailsOpen] = useState(true);
  const [ductsOpen, setDuctsOpen] = useState(true);

  const displayUnit = usePanelStore((s) => s.displayUnit);
  const enclosure = usePanelStore((s) => s.enclosure);
  const plateConfig = usePanelStore((s) => s.plateConfig);
  const rails = usePanelStore((s) => s.rails);
  const ducts = usePanelStore((s) => s.ducts);
  const cadAssets = usePanelStore((s) => s.cadAssets);
  const selected = usePanelStore((s) => s.selected);
  const isPinMarkingMode = usePanelStore((s) => s.isPinMarkingMode);
  const activeMarkingAssetId = usePanelStore((s) => s.activeMarkingAssetId);

  const updateEnclosure = usePanelStore((s) => s.updateEnclosure);
  const updatePlateConfig = usePanelStore((s) => s.updatePlateConfig);
  const setSelected = usePanelStore((s) => s.setSelected);
  const addRail = usePanelStore((s) => s.addRail);
  const removeRail = usePanelStore((s) => s.removeRail);
  const addDuct = usePanelStore((s) => s.addDuct);
  const removeDuct = usePanelStore((s) => s.removeDuct);
  const addComponent = usePanelStore((s) => s.addComponent);
  const addCadAsset = usePanelStore((s) => s.addCadAsset);
  const removeCadAsset = usePanelStore((s) => s.removeCadAsset);
  const setPinMarkingMode = usePanelStore((s) => s.setPinMarkingMode);

  const { widthMm: plateW, heightMm: plateH } = getBackplateDimensions(
    enclosure,
    plateConfig
  );
  const step = inputStepForUnit(displayUnit);

  const q = searchQuery.trim().toLowerCase();
  const filteredComponents = COMPONENT_LIST.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.shortName.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
  );
  const filteredRails = rails.filter(
    (r) => !q || r.name.toLowerCase().includes(q)
  );
  const filteredDucts = ducts.filter(
    (d) => !q || d.name.toLowerCase().includes(q)
  );
  const filteredCad = cadAssets.filter(
    (a) =>
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.fileName.toLowerCase().includes(q)
  );

  const handleCadUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["glb", "gltf", "obj", "dxf"].includes(ext)) return;

    const format = ext as CadFormat;
    const id = `cad-${Date.now()}`;
    const baseAsset: CustomCadAsset = {
      id,
      name: file.name.replace(/\.[^.]+$/, ""),
      fileName: file.name,
      format,
      sourceUnit: cadImportUnit,
      xMm: 0,
      yMm: 0,
      zMm: 30,
      boundingBoxMm: { w: 50, h: 50, d: 20 },
      pins: [],
    };

    if (format === "glb" || format === "gltf") {
      baseAsset.objectUrl = URL.createObjectURL(file);
    } else {
      baseAsset.rawText = await file.text();
      if (format === "dxf") {
        const parsed = parseDxfToMmSegments(baseAsset.rawText, cadImportUnit);
        baseAsset.boundingBoxMm = parsed.boundingBoxMm;
        baseAsset.entityCount = parsed.entityCount;
        baseAsset.parseWarning = parsed.warning;
      }
    }

    addCadAsset(baseAsset);
    e.target.value = "";
  };

  const tabs: { id: TabId; label: string; icon: typeof Box }[] = [
    { id: "components", label: "Parts", icon: Cpu },
    { id: "rails", label: "Rails", icon: Layers },
    { id: "enclosure", label: "Plate", icon: Box },
    { id: "cad", label: "CAD", icon: FileUp },
  ];

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#0c0e14]/90 text-[#0f172a] dark:text-slate-200 backdrop-blur-xl">
      {/* Search Bar Pill */}
      <div className="p-2.5 pb-2">
        <div className="flex items-center gap-2 rounded-full border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#171a21] px-3 py-2 focus-within:border-[#cbd5e1] dark:focus-within:border-white/25 transition-colors shadow-xs">
          <Search className="h-4 w-4 shrink-0 text-[#64748b] dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search parts, rails, symbols..."
            className="w-full bg-transparent text-[13px] text-[#0f172a] dark:text-slate-100 placeholder:text-[#94a3b8] dark:placeholder:text-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-[#64748b] dark:text-slate-500 hover:text-[#0f172a] dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Pill Switcher */}
      <div className="px-2.5 pb-2">
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#131620]/70 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-[#0f172a] text-white dark:bg-white dark:text-black shadow-xs"
                    : "text-[#64748b] dark:text-slate-400 hover:bg-[#e2e8f0] dark:hover:bg-white/5 hover:text-[#0f172a] dark:hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-3 text-xs">
        {activeTab === "components" && (
          <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#131620]/70 p-2.5 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                Parts Library
              </span>
              <span className="font-mono text-[11px] text-[#94a3b8] dark:text-slate-500">
                DIN Auto-Snap
              </span>
            </div>

            {filteredComponents.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#94a3b8] dark:text-slate-500">
                No matching parts
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredComponents.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => addComponent(tpl.id)}
                    title={`Add ${tpl.name} (${tpl.widthMm}×${tpl.heightMm}mm)`}
                    className="group relative flex flex-col items-center justify-between rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] p-2.5 text-center transition-all hover:border-[#cbd5e1] dark:hover:border-white/25 hover:bg-[#f1f5f9] dark:hover:bg-[#1d212b] active:scale-[0.98]"
                  >
                    <div className="flex h-10 w-full items-center justify-center">
                      <PartVectorIcon
                        templateId={tpl.id}
                        accentColor={tpl.accentColor}
                      />
                    </div>
                    <div className="mt-1.5 w-full">
                      <div className="truncate text-[13px] font-medium text-[#0f172a] dark:text-slate-100 group-hover:text-[#0f172a] dark:group-hover:text-white">
                        {tpl.shortName}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[#64748b] dark:text-slate-500">
                        {formatDim(tpl.widthMm, displayUnit)} ×{" "}
                        {formatDim(tpl.heightMm, displayUnit)}
                      </div>
                    </div>
                    <span className="absolute top-1.5 right-1.5 rounded-full bg-[#e2e8f0] dark:bg-white/5 p-0.5 text-[#64748b] dark:text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-[#0f172a] dark:group-hover:text-white">
                      <Plus className="h-2.5 w-2.5" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "rails" && (
          <div className="space-y-2.5">
            {/* DIN Rails Accordion Card */}
            <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#131620]/70 p-2.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRailsOpen((v) => !v)}
                  className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#334155] dark:text-slate-300"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      railsOpen ? "" : "-rotate-90"
                    }`}
                  />
                  DIN Rails (35mm)
                </button>
                <button
                  type="button"
                  onClick={() => addRail()}
                  className="flex items-center gap-1 rounded-full bg-[#0f172a] dark:bg-white px-2.5 py-0.5 text-[11px] font-semibold text-white dark:text-black hover:bg-[#334155] dark:hover:bg-slate-200 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>

              {railsOpen && (
                <div className="space-y-1.5 pt-1">
                  {filteredRails.map((rail) => (
                    <div
                      key={rail.id}
                      onClick={() => setSelected({ kind: "rail", id: rail.id })}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5 transition-colors ${
                        selected?.kind === "rail" && selected.id === rail.id
                          ? "border-[#0284c7] bg-[#e0f2fe] text-[#0369a1] dark:border-white/35 dark:bg-[#343842]/70 dark:text-slate-200"
                          : "border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] hover:border-[#cbd5e1] dark:hover:border-white/20"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-[#0f172a] dark:text-slate-200">
                          {rail.name}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-[#64748b] dark:text-slate-400">
                          L={formatDim(rail.lengthMm, displayUnit)} · Y=
                          {formatDim(rail.yMm, displayUnit)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRail(rail.id);
                        }}
                        className="p-1 text-[#94a3b8] dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Wire Ducts Accordion Card */}
            <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#131620]/70 p-2.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setDuctsOpen((v) => !v)}
                  className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#334155] dark:text-slate-300"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      ductsOpen ? "" : "-rotate-90"
                    }`}
                  />
                  Wire Ducts
                </button>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => addDuct("horizontal")}
                    className="rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-0.5 text-[11px] font-medium text-[#0f172a] dark:text-slate-200 hover:border-[#cbd5e1] dark:hover:border-white/25 hover:bg-[#f1f5f9] dark:hover:bg-white/10"
                  >
                    + H
                  </button>
                  <button
                    type="button"
                    onClick={() => addDuct("vertical")}
                    className="rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-0.5 text-[11px] font-medium text-[#0f172a] dark:text-slate-200 hover:border-[#cbd5e1] dark:hover:border-white/25 hover:bg-[#f1f5f9] dark:hover:bg-white/10"
                  >
                    + V
                  </button>
                </div>
              </div>

              {ductsOpen && (
                <div className="space-y-1.5 pt-1">
                  {filteredDucts.map((duct) => (
                    <div
                      key={duct.id}
                      onClick={() => setSelected({ kind: "duct", id: duct.id })}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5 transition-colors ${
                        selected?.kind === "duct" && selected.id === duct.id
                          ? "border-[#0284c7] bg-[#e0f2fe] text-[#0369a1] dark:border-white/35 dark:bg-[#343842]/70 dark:text-slate-200"
                          : "border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] hover:border-[#cbd5e1] dark:hover:border-white/20"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-[#0f172a] dark:text-slate-200">
                          {duct.name}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-[#64748b] dark:text-slate-400">
                          {formatDim(duct.widthMm, displayUnit)} ×{" "}
                          {formatDim(duct.heightMm, displayUnit)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDuct(duct.id);
                        }}
                        className="p-1 text-[#94a3b8] dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "enclosure" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#131620]/70 p-3 space-y-2.5 shadow-xs">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                Enclosure Dimensions ({displayUnit})
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["Width (W)", "widthMm"],
                    ["Height (H)", "heightMm"],
                    ["Depth (D)", "depthMm"],
                    ["Inset", "backplateInsetMm"],
                  ] as const
                ).map(([label, key]) => (
                  <label key={key} className="block space-y-1">
                    <span className="text-xs text-[#64748b] dark:text-slate-400">{label}</span>
                    <input
                      type="number"
                      step={step}
                      value={Number(
                        fromMm(enclosure[key], displayUnit).toFixed(3)
                      )}
                      onChange={(e) => {
                        const mm = toMm(
                          Number.parseFloat(e.target.value) || 0,
                          displayUnit
                        );
                        updateEnclosure({ [key]: Math.max(20, mm) });
                      }}
                      className="w-full rounded-lg border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-1.5 font-mono text-[13px] tabular-nums text-[#0f172a] dark:text-slate-100 focus:border-[#0284c7] dark:focus:border-white/30 focus:outline-none"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#131620]/70 p-3 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                  Mounting Plate
                </span>
                <div className="flex rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#171a21] p-0.5 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => updatePlateConfig({ mode: "auto" })}
                    className={`rounded-full px-2.5 py-0.5 transition-colors ${
                      plateConfig.mode === "auto"
                        ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                        : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updatePlateConfig({
                        mode: "manual",
                        manualWidthMm:
                          plateConfig.mode === "auto"
                            ? Math.max(
                                100,
                                enclosure.widthMm -
                                  enclosure.backplateInsetMm * 2
                              )
                            : plateConfig.manualWidthMm,
                        manualHeightMm:
                          plateConfig.mode === "auto"
                            ? Math.max(
                                100,
                                enclosure.heightMm -
                                  enclosure.backplateInsetMm * 2
                              )
                            : plateConfig.manualHeightMm,
                      })
                    }
                    className={`rounded-full px-2.5 py-0.5 transition-colors ${
                      plateConfig.mode === "manual"
                        ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                        : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {plateConfig.mode === "manual" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-[#64748b] dark:text-slate-400">
                      Plate W ({displayUnit})
                    </span>
                    <input
                      type="number"
                      step={step}
                      value={Number(
                        fromMm(plateConfig.manualWidthMm, displayUnit).toFixed(
                          3
                        )
                      )}
                      onChange={(e) => {
                        const mm = toMm(
                          Number.parseFloat(e.target.value) || 0,
                          displayUnit
                        );
                        updatePlateConfig({ manualWidthMm: Math.max(100, mm) });
                      }}
                      className="w-full rounded-lg border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-1.5 font-mono text-[13px] tabular-nums text-[#0f172a] dark:text-slate-100 focus:border-[#0284c7] dark:focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-[#64748b] dark:text-slate-400">
                      Plate H ({displayUnit})
                    </span>
                    <input
                      type="number"
                      step={step}
                      value={Number(
                        fromMm(plateConfig.manualHeightMm, displayUnit).toFixed(
                          3
                        )
                      )}
                      onChange={(e) => {
                        const mm = toMm(
                          Number.parseFloat(e.target.value) || 0,
                          displayUnit
                        );
                        updatePlateConfig({
                          manualHeightMm: Math.max(100, mm),
                        });
                      }}
                      className="w-full rounded-lg border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-1.5 font-mono text-[13px] tabular-nums text-[#0f172a] dark:text-slate-100 focus:border-[#0284c7] dark:focus:border-white/30 focus:outline-none"
                    />
                  </label>
                </div>
              ) : (
                <div className="rounded-lg border border-[#e2e8f0] dark:border-white/5 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#334155] dark:text-slate-300">
                  {formatDim(plateW, displayUnit)} ×{" "}
                  {formatDim(plateH, displayUnit)}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "cad" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#131620]/70 p-3 space-y-2.5 shadow-xs">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                Custom CAD Importer
              </div>

              <label className="block space-y-1">
                <span className="text-xs text-[#64748b] dark:text-slate-400">
                  Source File Native Unit
                </span>
                <select
                  value={cadImportUnit}
                  onChange={(e) =>
                    setCadImportUnit(e.target.value as CadImportUnit)
                  }
                  className="w-full rounded-lg border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-1.5 font-mono text-[13px] text-[#0f172a] dark:text-slate-100 focus:border-[#0284c7] dark:focus:border-white/30 focus:outline-none"
                >
                  <option value="mm">Millimeters (mm)</option>
                  <option value="cm">Centimeters (cm)</option>
                  <option value="m">Meters (m)</option>
                  <option value="inch">Inches (inch)</option>
                </select>
              </label>

              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#cbd5e1] dark:border-white/15 bg-[#f8fafc] dark:bg-[#171a21] p-4 text-center transition-colors hover:border-[#0284c7] dark:hover:border-white/35">
                <FileUp className="h-5 w-5 text-[#64748b] dark:text-slate-300" />
                <span className="text-[13px] font-medium text-[#0f172a] dark:text-slate-200">
                  Upload .GLB / .GLTF / .OBJ / .DXF
                </span>
                <span className="font-mono text-[11px] text-[#94a3b8] dark:text-slate-500">
                  Auto-normalized to canonical mm
                </span>
                <input
                  type="file"
                  accept=".glb,.gltf,.obj,.dxf"
                  onChange={handleCadUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-1.5">
              {filteredCad.map((asset) => {
                const markingThis =
                  isPinMarkingMode && activeMarkingAssetId === asset.id;
                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelected({ kind: "cad", id: asset.id })}
                    className={`rounded-lg border p-2 transition-colors cursor-pointer ${
                      selected?.kind === "cad" && selected.id === asset.id
                        ? "border-[#0284c7] bg-[#e0f2fe] text-[#0369a1] dark:border-white/35 dark:bg-[#343842]/50 dark:text-slate-200"
                        : "border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#171a21] hover:border-[#cbd5e1] dark:hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-[#0f172a] dark:text-slate-200">
                          {asset.name}
                        </div>
                        <div className="font-mono text-[11px] text-[#64748b] dark:text-slate-400">
                          [{asset.format.toUpperCase()}] · {asset.pins.length}{" "}
                          pins
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCadAsset(asset.id);
                        }}
                        className="p-1 text-[#94a3b8] dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-2 flex gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected({ kind: "cad", id: asset.id });
                          setPinMarkingMode(!markingThis, asset.id);
                        }}
                        className={`flex-1 rounded-md py-1.5 font-mono text-[11px] font-semibold transition-colors ${
                          markingThis
                            ? "bg-amber-500 text-black font-bold"
                            : "border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#0c0e14] text-[#334155] dark:text-slate-300 hover:border-[#cbd5e1] dark:hover:border-white/25"
                        }`}
                      >
                        <MapPin className="mr-1 inline h-3.5 w-3.5" />
                        {markingThis ? "Done Marking" : "Mark Pins"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
