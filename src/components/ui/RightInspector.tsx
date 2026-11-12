"use client";

import { MapPin, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { snapToGrid } from "@/lib/snap";
import { formatDim, fromMm, inputStepForUnit, toMm } from "@/lib/units";
import { usePanelStore } from "@/store/usePanelStore";

interface RightInspectorProps {
  onClose?: () => void;
}

export function RightInspector({ onClose }: RightInspectorProps) {
  const displayUnit = usePanelStore((s) => s.displayUnit);
  const gridSnapMm = usePanelStore((s) => s.gridSnapMm);
  const selected = usePanelStore((s) => s.selected);
  const rails = usePanelStore((s) => s.rails);
  const ducts = usePanelStore((s) => s.ducts);
  const components = usePanelStore((s) => s.components);
  const cadAssets = usePanelStore((s) => s.cadAssets);
  const wires = usePanelStore((s) => s.wires);
  const titleBlock = usePanelStore((s) => s.titleBlock);
  const viewportMode = usePanelStore((s) => s.viewportMode);
  const isPinMarkingMode = usePanelStore((s) => s.isPinMarkingMode);
  const activeMarkingAssetId = usePanelStore((s) => s.activeMarkingAssetId);
  const inspectorFocusNonce = usePanelStore((s) => s.inspectorFocusNonce);
  const compNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inspectorFocusNonce > 0 && compNameInputRef.current) {
      compNameInputRef.current.focus();
      compNameInputRef.current.select();
    }
  }, [inspectorFocusNonce]);

  const updateRail = usePanelStore((s) => s.updateRail);
  const removeRail = usePanelStore((s) => s.removeRail);
  const updateDuct = usePanelStore((s) => s.updateDuct);
  const removeDuct = usePanelStore((s) => s.removeDuct);
  const moveComponent = usePanelStore((s) => s.moveComponent);
  const updateComponent = usePanelStore((s) => s.updateComponent);
  const removeComponent = usePanelStore((s) => s.removeComponent);
  const updateCadAsset = usePanelStore((s) => s.updateCadAsset);
  const removeCadAsset = usePanelStore((s) => s.removeCadAsset);
  const updateWire = usePanelStore((s) => s.updateWire);
  const removeWire = usePanelStore((s) => s.removeWire);
  const updateTitleBlock = usePanelStore((s) => s.updateTitleBlock);
  const setPinMarkingMode = usePanelStore((s) => s.setPinMarkingMode);
  const removePinFromAsset = usePanelStore((s) => s.removePinFromAsset);

  const step = inputStepForUnit(displayUnit);

  const rail =
    selected?.kind === "rail"
      ? rails.find((r) => r.id === selected.id)
      : undefined;
  const duct =
    selected?.kind === "duct"
      ? ducts.find((d) => d.id === selected.id)
      : undefined;
  const comp =
    selected?.kind === "component"
      ? components.find((c) => c.id === selected.id)
      : undefined;
  const cad =
    selected?.kind === "cad"
      ? cadAssets.find((a) => a.id === selected.id)
      : undefined;
  const wire =
    selected?.kind === "wire"
      ? wires.find((w) => w.id === selected.id)
      : undefined;

  const inputClass =
    "w-full rounded-lg border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#090b10] px-2.5 py-1.5 font-mono text-[13px] tabular-nums text-[#0f172a] dark:text-slate-100 focus:border-[#0284c7] dark:focus:border-white/30 focus:outline-none";
  const cardClass =
    "rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#171a21] p-3 shadow-xs dark:shadow-none";
  const subBoxClass =
    "rounded-lg border border-[#e2e8f0] dark:border-white/5 bg-[#f8fafc] dark:bg-[#090b10]";

  return (
    <aside className="flex w-76 shrink-0 flex-col border-l border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#0c0e14]/95 p-3 text-xs text-[#0f172a] dark:text-slate-200 overflow-y-auto backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between border-b border-[#e2e8f0] dark:border-white/10 pb-2">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
          Inspector ({displayUnit})
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[#64748b] dark:text-slate-500 hover:bg-[#e2e8f0] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white"
            title="Collapse Inspector"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!selected && (
        <div className="space-y-3 text-xs text-[#64748b] dark:text-slate-400">
          <div className={`${cardClass} space-y-1.5`}>
            <p className="text-xs text-[#334155] dark:text-slate-300">
              Select a DIN rail, wire duct, component, or wire in the{" "}
              {viewportMode.toUpperCase()} viewport.
            </p>
            <p className="font-mono text-[11px] text-[#94a3b8] dark:text-slate-500">
              Drag items on the mounting plate to snap to grid or nearest DIN rail.
            </p>
          </div>

          {viewportMode === "2d" && (
            <div className={`${cardClass} space-y-2.5`}>
              <div className="font-mono text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                2D Plot Frame / Title Block
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-[#64748b] dark:text-slate-400">Project Name</span>
                <input
                  type="text"
                  value={titleBlock.projectName}
                  onChange={(e) =>
                    updateTitleBlock({ projectName: e.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-[#64748b] dark:text-slate-400">Drawer</span>
                <input
                  type="text"
                  value={titleBlock.drawer}
                  onChange={(e) => updateTitleBlock({ drawer: e.target.value })}
                  className={inputClass}
                />
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <label className="space-y-1">
                  <span className="text-xs text-[#64748b] dark:text-slate-400">Sheet</span>
                  <input
                    type="text"
                    value={titleBlock.sheetNo}
                    onChange={(e) =>
                      updateTitleBlock({ sheetNo: e.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-[#64748b] dark:text-slate-400">Scale</span>
                  <input
                    type="text"
                    value={titleBlock.scale}
                    onChange={(e) =>
                      updateTitleBlock({ scale: e.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-[#64748b] dark:text-slate-400">Rev</span>
                  <input
                    type="text"
                    value={titleBlock.rev}
                    onChange={(e) => updateTitleBlock({ rev: e.target.value })}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {wire && (
        <div className={`${cardClass} space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[13px] text-[#0f172a] dark:text-white">Wire {wire.label}</span>
            <button
              type="button"
              onClick={() => removeWire(wire.id)}
              className="text-[#94a3b8] dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-[#64748b] dark:text-slate-400">Wire Tag / Code</span>
            <input
              type="text"
              value={wire.label}
              onChange={(e) => updateWire(wire.id, { label: e.target.value })}
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-[#64748b] dark:text-slate-400">Phase / Color</span>
              <select
                value={wire.colorCode}
                onChange={(e) =>
                  updateWire(wire.id, {
                    colorCode: e.target.value as typeof wire.colorCode,
                  })
                }
                className={inputClass}
              >
                <option value="R">R (L1)</option>
                <option value="S">S (L2)</option>
                <option value="T">T (L3)</option>
                <option value="N">N (Neutral)</option>
                <option value="PE">PE (Earth)</option>
                <option value="DC+">DC+ (24V)</option>
                <option value="DC-">DC- (0V)</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[#64748b] dark:text-slate-400">Gauge (mm²)</span>
              <input
                type="text"
                value={wire.gaugeMm2}
                onChange={(e) =>
                  updateWire(wire.id, { gaugeMm2: e.target.value })
                }
                className={inputClass}
              />
            </label>
          </div>
        </div>
      )}

      {rail && (
        <div className={`${cardClass} space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[13px] text-[#0f172a] dark:text-white">{rail.name}</span>
            <button
              type="button"
              onClick={() => removeRail(rail.id)}
              className="text-[#94a3b8] dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-[#64748b] dark:text-slate-400">
                X ({displayUnit})
              </span>
              <input
                type="number"
                step={step}
                value={Number(fromMm(rail.xMm, displayUnit).toFixed(3))}
                onChange={(e) =>
                  updateRail(rail.id, {
                    xMm: snapToGrid(
                      toMm(Number.parseFloat(e.target.value) || 0, displayUnit),
                      gridSnapMm
                    ),
                  })
                }
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[#64748b] dark:text-slate-400">
                Y ({displayUnit})
              </span>
              <input
                type="number"
                step={step}
                value={Number(fromMm(rail.yMm, displayUnit).toFixed(3))}
                onChange={(e) =>
                  updateRail(rail.id, {
                    yMm: snapToGrid(
                      toMm(Number.parseFloat(e.target.value) || 0, displayUnit),
                      gridSnapMm
                    ),
                  })
                }
                className={inputClass}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-[#64748b] dark:text-slate-400">
              Length ({displayUnit})
            </span>
            <input
              type="number"
              step={step}
              value={Number(fromMm(rail.lengthMm, displayUnit).toFixed(3))}
              onChange={(e) =>
                updateRail(rail.id, {
                  lengthMm: Math.max(
                    50,
                    toMm(Number.parseFloat(e.target.value) || 50, displayUnit)
                  ),
                })
              }
              className={inputClass}
            />
          </label>
        </div>
      )}

      {duct && (
        <div className={`${cardClass} space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[13px] text-[#0f172a] dark:text-white">{duct.name}</span>
            <button
              type="button"
              onClick={() => removeDuct(duct.id)}
              className="text-[#94a3b8] dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["X", "xMm"],
                ["Y", "yMm"],
                ["Width", "widthMm"],
                ["Height", "heightMm"],
              ] as const
            ).map(([label, key]) => (
              <label key={key} className="space-y-1">
                <span className="text-xs text-[#64748b] dark:text-slate-400">
                  {label} ({displayUnit})
                </span>
                <input
                  type="number"
                  step={step}
                  value={Number(fromMm(duct[key], displayUnit).toFixed(3))}
                  onChange={(e) => {
                    const mm = toMm(
                      Number.parseFloat(e.target.value) || 0,
                      displayUnit
                    );
                    updateDuct(duct.id, {
                      [key]:
                        key === "widthMm" || key === "heightMm"
                          ? Math.max(15, mm)
                          : snapToGrid(mm, gridSnapMm),
                    });
                  }}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {comp && (
        <div className="space-y-3">
          <div className={`${cardClass} space-y-3`}>
            <div className="flex items-center justify-between gap-2">
              <input
                ref={compNameInputRef}
                type="text"
                value={comp.name}
                onChange={(e) =>
                  updateComponent(comp.id, { name: e.target.value })
                }
                className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 font-semibold text-sm text-[#0f172a] dark:text-white hover:border-[#e2e8f0] dark:hover:border-white/15 focus:border-[#0284c7] dark:focus:border-white/30 focus:bg-[#f8fafc] dark:focus:bg-[#090b10] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeComponent(comp.id)}
                className="shrink-0 text-[#94a3b8] dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className={`${subBoxClass} p-2 font-mono text-[11px] tabular-nums text-[#64748b] dark:text-slate-400`}>
              BBox: {formatDim(comp.widthMm, displayUnit)} ×{" "}
              {formatDim(comp.heightMm, displayUnit)} ×{" "}
              {formatDim(comp.depthMm, displayUnit)}
              <br />
              Rail: {rails.find((r) => r.id === comp.railId)?.name ?? "Unmounted"}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-[#64748b] dark:text-slate-400">
                  X ({displayUnit})
                </span>
                <input
                  type="number"
                  step={step}
                  value={Number(fromMm(comp.xMm, displayUnit).toFixed(3))}
                  onChange={(e) =>
                    moveComponent(
                      comp.id,
                      toMm(Number.parseFloat(e.target.value) || 0, displayUnit),
                      comp.yMm
                    )
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-[#64748b] dark:text-slate-400">
                  Y ({displayUnit})
                </span>
                <input
                  type="number"
                  step={step}
                  value={Number(fromMm(comp.yMm, displayUnit).toFixed(3))}
                  onChange={(e) =>
                    moveComponent(
                      comp.id,
                      comp.xMm,
                      toMm(Number.parseFloat(e.target.value) || 0, displayUnit)
                    )
                  }
                  className={inputClass}
                />
              </label>
            </div>
          </div>

          <div className={`${cardClass} space-y-2`}>
            <div className="font-mono text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
              Pin Terminals ({comp.pins.length})
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {comp.pins.map((pin) => (
                <div
                  key={pin.id}
                  className={`flex items-center justify-between ${subBoxClass} px-2.5 py-1.5 font-mono text-[11px] tabular-nums`}
                >
                  <span className="font-semibold text-amber-600 dark:text-amber-300">
                    {pin.label}
                  </span>
                  <span className="text-[#64748b] dark:text-slate-400">
                    ({pin.localXMm}, {pin.localYMm}, {pin.localZMm}) mm
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {cad && (
        <div className={`${cardClass} space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[13px] text-[#0f172a] dark:text-white">{cad.name}</span>
            <button
              type="button"
              onClick={() => removeCadAsset(cad.id)}
              className="text-[#94a3b8] dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className={`${subBoxClass} p-2 font-mono text-[11px] tabular-nums text-[#64748b] dark:text-slate-400`}>
            Normalized BBox: {formatDim(cad.boundingBoxMm.w, displayUnit)} ×{" "}
            {formatDim(cad.boundingBoxMm.h, displayUnit)} ×{" "}
            {formatDim(cad.boundingBoxMm.d, displayUnit)}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ["X", "xMm"],
                ["Y", "yMm"],
                ["Z", "zMm"],
              ] as const
            ).map(([label, key]) => (
              <label key={key} className="space-y-1">
                <span className="text-xs text-[#64748b] dark:text-slate-400">{label}</span>
                <input
                  type="number"
                  step={step}
                  value={Number(fromMm(cad[key], displayUnit).toFixed(2))}
                  onChange={(e) =>
                    updateCadAsset(cad.id, {
                      [key]: toMm(
                        Number.parseFloat(e.target.value) || 0,
                        displayUnit
                      ),
                    })
                  }
                  className={inputClass}
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setPinMarkingMode(
                !(isPinMarkingMode && activeMarkingAssetId === cad.id),
                cad.id
              )
            }
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 font-mono text-xs font-medium transition-colors ${
              isPinMarkingMode && activeMarkingAssetId === cad.id
                ? "bg-amber-500 text-black font-semibold"
                : "border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#090b10] text-[#0f172a] dark:text-slate-200 hover:border-[#cbd5e1] dark:hover:border-white/25"
            }`}
          >
            <MapPin className="h-4 w-4" />
            {isPinMarkingMode && activeMarkingAssetId === cad.id
              ? "Done Marking Pins"
              : "Mark Pins on Mesh"}
          </button>

          <div className="space-y-1.5 border-t border-[#e2e8f0] dark:border-white/10 pt-2">
            <div className="font-mono text-xs font-semibold uppercase text-[#64748b] dark:text-slate-400">
              Marked Pins ({cad.pins.length})
            </div>
            {cad.pins.map((pin) => (
              <div
                key={pin.id}
                className={`flex items-center justify-between gap-1 ${subBoxClass} px-2 py-1 font-mono text-[11px] tabular-nums`}
              >
                <input
                  type="text"
                  value={pin.label}
                  onChange={(e) => {
                    const nextPins = cad.pins.map((p) =>
                      p.id === pin.id ? { ...p, label: e.target.value } : p
                    );
                    updateCadAsset(cad.id, { pins: nextPins });
                  }}
                  className="w-16 rounded border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#171a21] px-1 py-0.5 text-xs text-amber-600 dark:text-amber-300"
                />
                <span className="text-[#64748b] dark:text-slate-400">
                  ({pin.localXMm},{pin.localYMm},{pin.localZMm})
                </span>
                <button
                  type="button"
                  onClick={() => removePinFromAsset(cad.id, pin.id)}
                  className="text-[#94a3b8] dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
