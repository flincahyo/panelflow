"use client";

import {
  Box,
  Cpu,
  FileUp,
  Layers,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { COMPONENT_LIST } from "@/lib/components-catalog";
import { getBackplateDimensions } from "@/lib/template-export";
import { formatDim, fromMm, inputStepForUnit, toMm } from "@/lib/units";
import { usePanelStore } from "@/store/usePanelStore";
import type { CadFormat, CadImportUnit, CustomCadAsset } from "@/types/panel";

type TabId = "enclosure" | "rails" | "components" | "cad";

export function LeftSidebar() {
  const [activeTab, setActiveTab] = useState<TabId>("components");
  const [cadImportUnit, setCadImportUnit] = useState<CadImportUnit>("mm");

  const displayUnit = usePanelStore((s) => s.displayUnit);
  const enclosure = usePanelStore((s) => s.enclosure);
  const rails = usePanelStore((s) => s.rails);
  const ducts = usePanelStore((s) => s.ducts);
  const cadAssets = usePanelStore((s) => s.cadAssets);
  const selected = usePanelStore((s) => s.selected);
  const isPinMarkingMode = usePanelStore((s) => s.isPinMarkingMode);
  const activeMarkingAssetId = usePanelStore((s) => s.activeMarkingAssetId);

  const updateEnclosure = usePanelStore((s) => s.updateEnclosure);
  const setSelected = usePanelStore((s) => s.setSelected);
  const addRail = usePanelStore((s) => s.addRail);
  const removeRail = usePanelStore((s) => s.removeRail);
  const addDuct = usePanelStore((s) => s.addDuct);
  const removeDuct = usePanelStore((s) => s.removeDuct);
  const addComponent = usePanelStore((s) => s.addComponent);
  const addCadAsset = usePanelStore((s) => s.addCadAsset);
  const removeCadAsset = usePanelStore((s) => s.removeCadAsset);
  const setPinMarkingMode = usePanelStore((s) => s.setPinMarkingMode);

  const { widthMm: plateW, heightMm: plateH } =
    getBackplateDimensions(enclosure);
  const step = inputStepForUnit(displayUnit);

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
    }

    addCadAsset(baseAsset);
    e.target.value = "";
  };

  const tabs: { id: TabId; label: string; icon: typeof Box }[] = [
    { id: "enclosure", label: "Box", icon: Box },
    { id: "rails", label: "Rails", icon: Layers },
    { id: "components", label: "Parts", icon: Cpu },
    { id: "cad", label: "CAD", icon: FileUp },
  ];

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-800 bg-[#12161f] text-slate-200">
      {/* Tab Strip */}
      <div className="grid grid-cols-4 border-b border-slate-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors border-b-2 ${
                active
                  ? "border-sky-500 bg-slate-900/60 text-sky-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {activeTab === "enclosure" && (
          <div className="space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Enclosure Dimensions ({displayUnit})
            </div>

            {(
              [
                ["Width (W)", "widthMm"],
                ["Height (H)", "heightMm"],
                ["Depth (D)", "depthMm"],
                ["Backplate Inset", "backplateInsetMm"],
              ] as const
            ).map(([label, key]) => (
              <label key={key} className="block space-y-1">
                <span className="text-[11px] text-slate-400">{label}</span>
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
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </label>
            ))}

            <div className="rounded border border-slate-800 bg-slate-900/60 p-2.5 font-mono text-[11px] text-slate-300 space-y-1">
              <div className="text-[10px] uppercase text-slate-500">
                Mounting Backplate
              </div>
              <div>
                {formatDim(plateW, displayUnit)} ×{" "}
                {formatDim(plateH, displayUnit)}
              </div>
            </div>
          </div>
        )}

        {activeTab === "rails" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  DIN Rails (35mm)
                </span>
                <button
                  type="button"
                  onClick={addRail}
                  className="flex items-center gap-1 rounded bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-500"
                >
                  <Plus className="h-3 w-3" /> Add Rail
                </button>
              </div>
              <div className="space-y-1">
                {rails.map((rail) => (
                  <div
                    key={rail.id}
                    onClick={() => setSelected({ kind: "rail", id: rail.id })}
                    className={`flex cursor-pointer items-center justify-between rounded border px-2.5 py-1.5 ${
                      selected?.kind === "rail" && selected.id === rail.id
                        ? "border-sky-500 bg-sky-950/30"
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="font-medium text-slate-200">
                        {rail.name}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
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
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-800 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Wire Ducts
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => addDuct("horizontal")}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] hover:border-sky-500"
                  >
                    + Horiz
                  </button>
                  <button
                    type="button"
                    onClick={() => addDuct("vertical")}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] hover:border-sky-500"
                  >
                    + Vert
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {ducts.map((duct) => (
                  <div
                    key={duct.id}
                    onClick={() => setSelected({ kind: "duct", id: duct.id })}
                    className={`flex cursor-pointer items-center justify-between rounded border px-2.5 py-1.5 ${
                      selected?.kind === "duct" && selected.id === duct.id
                        ? "border-sky-500 bg-sky-950/30"
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="font-medium text-slate-200">
                        {duct.name}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
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
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "components" && (
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Electrical Library (Auto-Snap DIN)
            </div>
            <div className="space-y-1.5">
              {COMPONENT_LIST.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => addComponent(tpl.id)}
                  className="flex w-full items-center justify-between rounded border border-slate-800 bg-slate-900/60 p-2.5 text-left transition-colors hover:border-sky-500/60 hover:bg-slate-900"
                >
                  <div>
                    <div className="font-medium text-slate-100">
                      {tpl.name}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                      {formatDim(tpl.widthMm, displayUnit)} ×{" "}
                      {formatDim(tpl.heightMm, displayUnit)} ×{" "}
                      {formatDim(tpl.depthMm, displayUnit)} · {tpl.pins.length}{" "}
                      pins
                    </div>
                  </div>
                  <Plus className="h-4 w-4 shrink-0 text-sky-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "cad" && (
          <div className="space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Custom CAD Importer
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">
                Source File Native Unit
              </span>
              <select
                value={cadImportUnit}
                onChange={(e) =>
                  setCadImportUnit(e.target.value as CadImportUnit)
                }
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
              >
                <option value="mm">Millimeters (mm)</option>
                <option value="cm">Centimeters (cm)</option>
                <option value="m">Meters (m)</option>
                <option value="inch">Inches (inch)</option>
              </select>
            </label>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded border border-dashed border-slate-700 bg-slate-900/50 p-4 text-center hover:border-sky-500">
              <FileUp className="h-5 w-5 text-sky-400" />
              <span className="text-xs font-medium text-slate-200">
                Upload .GLB / .GLTF / .OBJ / .DXF
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                Auto-normalized to canonical mm
              </span>
              <input
                type="file"
                accept=".glb,.gltf,.obj,.dxf"
                onChange={handleCadUpload}
                className="hidden"
              />
            </label>

            <div className="space-y-1.5">
              {cadAssets.map((asset) => {
                const markingThis =
                  isPinMarkingMode && activeMarkingAssetId === asset.id;
                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelected({ kind: "cad", id: asset.id })}
                    className={`cursor-pointer rounded border p-2.5 space-y-2 ${
                      selected?.kind === "cad" && selected.id === asset.id
                        ? "border-sky-500 bg-sky-950/30"
                        : "border-slate-800 bg-slate-900/60"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-slate-200">
                          {asset.name}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {asset.format.toUpperCase()} ({asset.sourceUnit}) ·{" "}
                          {asset.pins.length} pins
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCadAsset(asset.id);
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPinMarkingMode(!markingThis, asset.id);
                      }}
                      className={`flex w-full items-center justify-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] font-medium ${
                        markingThis
                          ? "bg-amber-600 text-white"
                          : "border border-slate-700 bg-slate-800 text-slate-300 hover:border-amber-500"
                      }`}
                    >
                      <MapPin className="h-3 w-3" />
                      {markingThis ? "Done Marking Pins" : "Mark Pins on Mesh"}
                    </button>
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
