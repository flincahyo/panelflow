import { create } from "zustand";
import { COMPONENT_CATALOG } from "@/lib/components-catalog";
import {
  clampToBackplate,
  DIN_RAIL_HEIGHT_MM,
  getRotatedDimensions,
  snapComponentToNearestRail,
  snapToGrid,
} from "@/lib/snap";
import { getBackplateDimensions } from "@/lib/template-export";
import type {
  CanvasTool2D,
  ComponentTemplateId,
  CustomCadAsset,
  DinRail,
  DoorMode,
  EnclosureConfig,
  GridSnapMm,
  LengthUnit,
  PinTerminal,
  PlacedComponent,
  RotationDeg,
  SelectionTarget,
  TitleBlockMeta,
  ViewportMode,
  WireColorCode,
  WireConnection,
  WireDuct,
} from "@/types/panel";

function nextIncrementedName(baseName: string, existingNames: string[]): string {
  const existing = new Set(existingNames);
  const hashMatch = baseName.match(/^(.*?)\s*#(\d+)$/);
  if (hashMatch) {
    const prefix = hashMatch[1];
    let n = Number(hashMatch[2]) + 1;
    while (existing.has(`${prefix} #${n}`)) n += 1;
    return `${prefix} #${n}`;
  }
  const trailingNumMatch = baseName.match(/^(.*?)(\d+)$/);
  if (trailingNumMatch) {
    const prefix = trailingNumMatch[1];
    let n = Number(trailingNumMatch[2]) + 1;
    while (existing.has(`${prefix}${n}`)) n += 1;
    return `${prefix}${n}`;
  }
  let n = 2;
  while (existing.has(`${baseName} #${n}`)) n += 1;
  return `${baseName} #${n}`;
}

function makeUid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

interface PanelStore {
  viewportMode: ViewportMode;
  canvasTool2D: CanvasTool2D;
  displayUnit: LengthUnit;
  gridSnapMm: GridSnapMm;
  enclosure: EnclosureConfig;
  rails: DinRail[];
  ducts: WireDuct[];
  components: PlacedComponent[];
  cadAssets: CustomCadAsset[];
  wires: WireConnection[];
  titleBlock: TitleBlockMeta;
  activeWireColor: WireColorCode;
  activeWireGauge: string;
  activeWireStartPin: { componentId: string; pinId: string } | null;
  selected: SelectionTarget;
  isPinMarkingMode: boolean;
  activeMarkingAssetId: string | null;
  inspectorFocusNonce: number;

  requestInspectorFocus: () => void;

  setViewportMode: (mode: ViewportMode) => void;
  setCanvasTool2D: (tool: CanvasTool2D) => void;
  setActiveWireColor: (color: WireColorCode) => void;
  setActiveWireGauge: (gauge: string) => void;
  setActiveWireStartPin: (pin: { componentId: string; pinId: string } | null) => void;
  updateTitleBlock: (partial: Partial<TitleBlockMeta>) => void;

  addWire: (wire: Omit<WireConnection, "id">) => void;
  updateWire: (id: string, partial: Partial<WireConnection>) => void;
  removeWire: (id: string) => void;

  setDisplayUnit: (unit: LengthUnit) => void;
  setGridSnapMm: (snap: GridSnapMm) => void;
  setDoorMode: (mode: DoorMode) => void;
  updateEnclosure: (partial: Partial<EnclosureConfig>) => void;

  setSelected: (target: SelectionTarget) => void;
  setPinMarkingMode: (enabled: boolean, assetId?: string | null) => void;

  addRail: (customPos?: { xMm: number; yMm: number }) => void;
  updateRail: (id: string, partial: Partial<DinRail>) => void;
  removeRail: (id: string) => void;

  addDuct: (
    orientation?: "horizontal" | "vertical",
    customPos?: { xMm: number; yMm: number }
  ) => void;
  updateDuct: (id: string, partial: Partial<WireDuct>) => void;
  removeDuct: (id: string) => void;

  // Component Actions
  addComponent: (templateId: ComponentTemplateId, nearYMm?: number, customPos?: { xMm: number; yMm: number }) => void;
  updateComponent: (id: string, partial: Partial<PlacedComponent>) => void;
  moveComponent: (id: string, targetXMm: number, targetYMm: number) => void;
  removeComponent: (id: string) => void;
  rotateComponent: (id: string, deltaDeg?: 90 | 180 | 270) => void;
  duplicateComponent: (id: string, offsetMm?: { x: number; y: number }) => string | null;
  snapComponentToRail: (id: string) => void;

  // Rail & Duct Duplication / Alignment
  duplicateRail: (id: string, offsetMm?: { x: number; y: number }) => string | null;
  duplicateDuct: (id: string, offsetMm?: { x: number; y: number }) => string | null;
  alignComponentsOnRail: (railId: string, mode: "distribute" | "left" | "center" | "right") => void;

  addCadAsset: (asset: CustomCadAsset) => void;
  updateCadAsset: (id: string, partial: Partial<CustomCadAsset>) => void;
  moveCadAsset: (id: string, targetXMm: number, targetYMm: number) => void;
  removeCadAsset: (id: string) => void;
  rotateCadAsset: (id: string, deltaDeg?: 90 | 180 | 270) => void;
  duplicateCadAsset: (id: string, offsetMm?: { x: number; y: number }) => string | null;
  addPinToAsset: (assetId: string, pin: Omit<PinTerminal, "id">) => void;
  removePinFromAsset: (assetId: string, pinId: string) => void;
}

export const usePanelStore = create<PanelStore>((set, get) => ({
  viewportMode: "2d",
  canvasTool2D: "select",
  displayUnit: "mm",
  gridSnapMm: 10,
  enclosure: {
    widthMm: 600,
    heightMm: 800,
    depthMm: 250,
    backplateInsetMm: 40,
    backplateThicknessMm: 2,
    wallThicknessMm: 2,
    doorMode: "transparent",
  },
  rails: [
    { id: "rail-1", name: "DIN-1 (Top)", xMm: 0, yMm: 200, lengthMm: 460 },
    { id: "rail-2", name: "DIN-2 (Mid)", xMm: 0, yMm: 40, lengthMm: 460 },
    { id: "rail-3", name: "DIN-3 (Bottom)", xMm: 0, yMm: -140, lengthMm: 460 },
  ],
  ducts: [
    {
      id: "duct-1",
      name: "Top Duct",
      xMm: 0,
      yMm: 280,
      widthMm: 480,
      heightMm: 40,
      depthMm: 60,
      orientation: "horizontal",
    },
    {
      id: "duct-2",
      name: "Mid Duct",
      xMm: 0,
      yMm: 120,
      widthMm: 480,
      heightMm: 40,
      depthMm: 60,
      orientation: "horizontal",
    },
    {
      id: "duct-3",
      name: "Bottom Duct",
      xMm: 0,
      yMm: -220,
      widthMm: 480,
      heightMm: 40,
      depthMm: 60,
      orientation: "horizontal",
    },
    {
      id: "duct-v-left",
      name: "Left Vertical Duct",
      xMm: -230,
      yMm: 40,
      widthMm: 40,
      heightMm: 560,
      depthMm: 60,
      orientation: "vertical",
    },
    {
      id: "duct-v-right",
      name: "Right Vertical Duct",
      xMm: 230,
      yMm: 40,
      widthMm: 40,
      heightMm: 560,
      depthMm: 60,
      orientation: "vertical",
    },
  ],
  components: [
    {
      id: "comp-1",
      templateId: "mcb-3p",
      name: "Main Breaker (MCB 3P)",
      xMm: -160,
      yMm: 200,
      zMm: 42.5,
      railId: "rail-1",
      widthMm: 52.5,
      heightMm: 85,
      depthMm: 70,
      color: "#e2e6ed",
      accentColor: "#dc2626",
      pins: COMPONENT_CATALOG["mcb-3p"].pins.map((p, idx) => ({
        ...p,
        id: `comp-1-pin-${idx + 1}`,
      })),
    },
    {
      id: "comp-2",
      templateId: "mcb-1p",
      name: "Control Circuit (MCB 1P)",
      xMm: -100,
      yMm: 200,
      zMm: 42.5,
      railId: "rail-1",
      widthMm: 17.5,
      heightMm: 85,
      depthMm: 70,
      color: "#e2e6ed",
      accentColor: "#2563eb",
      pins: COMPONENT_CATALOG["mcb-1p"].pins.map((p, idx) => ({
        ...p,
        id: `comp-2-pin-${idx + 1}`,
      })),
    },
    {
      id: "comp-3",
      templateId: "psu-24v",
      name: "24VDC Power Supply",
      xMm: -120,
      yMm: 40,
      zMm: 62.5,
      railId: "rail-2",
      widthMm: 72,
      heightMm: 125,
      depthMm: 110,
      color: "#1e293b",
      accentColor: "#10b981",
      pins: COMPONENT_CATALOG["psu-24v"].pins.map((p, idx) => ({
        ...p,
        id: `comp-3-pin-${idx + 1}`,
      })),
    },
    {
      id: "comp-4",
      templateId: "contactor",
      name: "Motor Contactor KM1",
      xMm: 20,
      yMm: 40,
      zMm: 55,
      railId: "rail-2",
      widthMm: 45,
      heightMm: 85,
      depthMm: 95,
      color: "#334155",
      accentColor: "#0ea5e9",
      pins: COMPONENT_CATALOG.contactor.pins.map((p, idx) => ({
        ...p,
        id: `comp-4-pin-${idx + 1}`,
      })),
    },
  ],
  cadAssets: [],
  wires: [
    {
      id: "wire-1",
      label: "F01",
      colorCode: "R",
      gaugeMm2: "4.0",
      fromComponentId: "comp-1",
      fromPinId: "comp-1-pin-4",
      toComponentId: "comp-4",
      toPinId: "comp-4-pin-1",
    },
    {
      id: "wire-2",
      label: "K01",
      colorCode: "DC+",
      gaugeMm2: "1.5",
      fromComponentId: "comp-3",
      fromPinId: "comp-3-pin-4",
      toComponentId: "comp-4",
      toPinId: "comp-4-pin-5",
    },
  ],
  titleBlock: {
    projectName: "MAIN CONTROL PANEL - MDP-01",
    drawer: "Flints Studio",
    sheetNo: "1 / 1",
    date: new Date().toISOString().slice(0, 10),
    scale: "1:1",
    rev: "A",
  },
  activeWireColor: "R",
  activeWireGauge: "2.5",
  activeWireStartPin: null,
  selected: null,
  isPinMarkingMode: false,
  activeMarkingAssetId: null,
  inspectorFocusNonce: 0,

  requestInspectorFocus: () =>
    set((state) => ({ inspectorFocusNonce: state.inspectorFocusNonce + 1 })),
  setViewportMode: (mode) => set({ viewportMode: mode }),
  setCanvasTool2D: (tool) => set({ canvasTool2D: tool, activeWireStartPin: null }),
  setActiveWireColor: (color) => set({ activeWireColor: color }),
  setActiveWireGauge: (gauge) => set({ activeWireGauge: gauge }),
  setActiveWireStartPin: (pin) => set({ activeWireStartPin: pin }),
  updateTitleBlock: (partial) =>
    set((state) => ({ titleBlock: { ...state.titleBlock, ...partial } })),

  addWire: (wire) => {
    const id = `wire-${Date.now()}`;
    set((state) => ({
      wires: [...state.wires, { ...wire, id }],
      selected: { kind: "wire", id },
    }));
  },

  updateWire: (id, partial) =>
    set((state) => ({
      wires: state.wires.map((w) => (w.id === id ? { ...w, ...partial } : w)),
    })),

  removeWire: (id) =>
    set((state) => ({
      wires: state.wires.filter((w) => w.id !== id),
      selected: state.selected?.id === id ? null : state.selected,
    })),

  setDisplayUnit: (unit) => set({ displayUnit: unit }),
  setGridSnapMm: (snap) => set({ gridSnapMm: snap }),
  setDoorMode: (mode) =>
    set((state) => ({
      enclosure: { ...state.enclosure, doorMode: mode },
    })),
  updateEnclosure: (partial) =>
    set((state) => ({
      enclosure: { ...state.enclosure, ...partial },
    })),

  setSelected: (target) => set({ selected: target }),
  setPinMarkingMode: (enabled, assetId = null) =>
    set({ isPinMarkingMode: enabled, activeMarkingAssetId: assetId }),

  addRail: (customPos) => {
    const { rails, gridSnapMm, enclosure } = get();
    const { widthMm } = getBackplateDimensions(enclosure);
    const newY = customPos?.yMm ?? (rails.length > 0 ? rails[rails.length - 1].yMm - 80 : 0);
    const newX = customPos?.xMm ?? 0;
    const snappedY = snapToGrid(newY, gridSnapMm);
    const snappedX = snapToGrid(newX, gridSnapMm);
    const id = makeUid("rail");
    const newRail: DinRail = {
      id,
      name: nextIncrementedName("DIN Rail", rails.map((r) => r.name)),
      xMm: snappedX,
      yMm: snappedY,
      lengthMm: Math.min(460, widthMm - 40),
    };
    set((state) => ({
      rails: [...state.rails, newRail],
      selected: { kind: "rail", id },
    }));
  },

  duplicateRail: (id, offsetMm = { x: 0, y: -120 }) => {
    const { rails, enclosure, gridSnapMm } = get();
    const source = rails.find((r) => r.id === id);
    if (!source) return null;
    const { widthMm, heightMm } = getBackplateDimensions(enclosure);
    const rawX = snapToGrid(source.xMm + offsetMm.x, gridSnapMm);
    const rawY = snapToGrid(source.yMm + offsetMm.y, gridSnapMm);
    const clamped = clampToBackplate(
      rawX,
      rawY,
      source.lengthMm,
      DIN_RAIL_HEIGHT_MM,
      widthMm,
      heightMm
    );
    const newId = makeUid("rail");
    const duplicated: DinRail = {
      ...source,
      id: newId,
      name: nextIncrementedName(source.name, rails.map((r) => r.name)),
      xMm: clamped.xMm,
      yMm: clamped.yMm,
    };
    set((state) => ({
      rails: [...state.rails, duplicated],
      selected: { kind: "rail", id: newId },
    }));
    return newId;
  },

  updateRail: (id, partial) =>
    set((state) => ({
      rails: state.rails.map((r) => (r.id === id ? { ...r, ...partial } : r)),
    })),

  removeRail: (id) =>
    set((state) => ({
      rails: state.rails.filter((r) => r.id !== id),
      components: state.components.map((c) =>
        c.railId === id ? { ...c, railId: null } : c
      ),
      selected: state.selected?.id === id ? null : state.selected,
    })),

  addDuct: (orientation = "horizontal", customPos) => {
    const { ducts, enclosure, gridSnapMm } = get();
    const { widthMm, heightMm } = getBackplateDimensions(enclosure);
    const id = makeUid("duct");
    const rawX = customPos ? snapToGrid(customPos.xMm, gridSnapMm) : 0;
    const rawY = customPos ? snapToGrid(customPos.yMm, gridSnapMm) : 0;
    const newDuct: WireDuct = {
      id,
      name: nextIncrementedName(
        orientation === "horizontal" ? "Horiz Duct" : "Vert Duct",
        ducts.map((d) => d.name)
      ),
      xMm: rawX,
      yMm: rawY,
      widthMm: orientation === "horizontal" ? Math.min(460, widthMm - 20) : 40,
      heightMm: orientation === "vertical" ? Math.min(500, heightMm - 40) : 40,
      depthMm: 60,
      orientation,
    };
    set((state) => ({
      ducts: [...state.ducts, newDuct],
      selected: { kind: "duct", id },
    }));
  },

  duplicateDuct: (id, offsetMm) => {
    const { ducts, enclosure, gridSnapMm } = get();
    const source = ducts.find((d) => d.id === id);
    if (!source) return null;
    const defaultOffset =
      source.orientation === "vertical" ? { x: 80, y: 0 } : { x: 0, y: -120 };
    const effOffset = offsetMm ?? defaultOffset;
    const { widthMm, heightMm } = getBackplateDimensions(enclosure);
    const rawX = snapToGrid(source.xMm + effOffset.x, gridSnapMm);
    const rawY = snapToGrid(source.yMm + effOffset.y, gridSnapMm);
    const clamped = clampToBackplate(
      rawX,
      rawY,
      source.widthMm,
      source.heightMm,
      widthMm,
      heightMm
    );
    const newId = makeUid("duct");
    const duplicated: WireDuct = {
      ...source,
      id: newId,
      name: nextIncrementedName(source.name, ducts.map((d) => d.name)),
      xMm: clamped.xMm,
      yMm: clamped.yMm,
    };
    set((state) => ({
      ducts: [...state.ducts, duplicated],
      selected: { kind: "duct", id: newId },
    }));
    return newId;
  },

  updateDuct: (id, partial) =>
    set((state) => ({
      ducts: state.ducts.map((d) => (d.id === id ? { ...d, ...partial } : d)),
    })),

  removeDuct: (id) =>
    set((state) => ({
      ducts: state.ducts.filter((d) => d.id !== id),
      selected: state.selected?.id === id ? null : state.selected,
    })),

  alignComponentsOnRail: (railId, mode) => {
    const { rails, components } = get();
    const targetRail = rails.find((r) => r.id === railId);
    if (!targetRail) return;

    const attached = components.filter((c) => c.railId === railId);
    if (attached.length === 0) return;

    // Sort by current x position left to right
    const sorted = [...attached].sort((a, b) => a.xMm - b.xMm);
    const railLeft = targetRail.xMm - targetRail.lengthMm / 2;
    const railRight = targetRail.xMm + targetRail.lengthMm / 2;
    const totalCompWidth = sorted.reduce((sum, c) => {
      const dims = getRotatedDimensions(c.widthMm, c.heightMm, c.rotationDeg ?? 0);
      return sum + dims.widthMm;
    }, 0);

    const positions = new Map<string, number>();

    if (mode === "left") {
      let curX = railLeft + 15; // 15mm clearance from rail edge
      for (const comp of sorted) {
        const dims = getRotatedDimensions(comp.widthMm, comp.heightMm, comp.rotationDeg ?? 0);
        positions.set(comp.id, curX + dims.widthMm / 2);
        curX += dims.widthMm + 6; // 6mm gap
      }
    } else if (mode === "right") {
      let curX = railRight - 15;
      for (let i = sorted.length - 1; i >= 0; i--) {
        const comp = sorted[i];
        const dims = getRotatedDimensions(comp.widthMm, comp.heightMm, comp.rotationDeg ?? 0);
        positions.set(comp.id, curX - dims.widthMm / 2);
        curX -= dims.widthMm + 6;
      }
    } else if (mode === "center") {
      const gap = 8;
      const totalBlockWidth = totalCompWidth + Math.max(0, sorted.length - 1) * gap;
      let curX = targetRail.xMm - totalBlockWidth / 2;
      for (const comp of sorted) {
        const dims = getRotatedDimensions(comp.widthMm, comp.heightMm, comp.rotationDeg ?? 0);
        positions.set(comp.id, curX + dims.widthMm / 2);
        curX += dims.widthMm + gap;
      }
    } else if (mode === "distribute") {
      if (sorted.length === 1) {
        positions.set(sorted[0].id, targetRail.xMm);
      } else {
        const availableSpan = targetRail.lengthMm - 30; // 15mm padding on both sides
        const spacing = (availableSpan - totalCompWidth) / (sorted.length - 1);
        const effectiveSpacing = Math.max(4, spacing);
        let curX = railLeft + 15;
        for (const comp of sorted) {
          const dims = getRotatedDimensions(comp.widthMm, comp.heightMm, comp.rotationDeg ?? 0);
          positions.set(comp.id, curX + dims.widthMm / 2);
          curX += dims.widthMm + effectiveSpacing;
        }
      }
    }

    set((state) => ({
      components: state.components.map((c) => {
        if (!positions.has(c.id)) return c;
        return {
          ...c,
          xMm: Number(positions.get(c.id)!.toFixed(2)),
          yMm: targetRail.yMm,
        };
      }),
    }));
  },

  addComponent: (templateId, nearYMm, customPos) => {
    const template = COMPONENT_CATALOG[templateId];
    if (!template) return;
    const { rails, gridSnapMm, components } = get();

    let snapResult: { railId: string | null; xMm: number; yMm: number; zMm: number };
    if (customPos) {
      snapResult = snapComponentToNearestRail(
        customPos.xMm,
        customPos.yMm,
        template.widthMm,
        template.depthMm,
        rails,
        gridSnapMm,
        35
      );
    } else {
      const targetY = nearYMm ?? (rails[0]?.yMm ?? 0);
      snapResult = snapComponentToNearestRail(
        0,
        targetY,
        template.widthMm,
        template.depthMm,
        rails,
        gridSnapMm
      );
    }

    const id = makeUid("comp");
    const newComponent: PlacedComponent = {
      id,
      templateId,
      name: nextIncrementedName(
        template.shortName,
        components.map((c) => c.name)
      ),
      xMm: snapResult.xMm,
      yMm: snapResult.yMm,
      zMm: snapResult.zMm,
      rotationDeg: 0,
      railId: snapResult.railId,
      widthMm: template.widthMm,
      heightMm: template.heightMm,
      depthMm: template.depthMm,
      color: template.color,
      accentColor: template.accentColor,
      pins: template.pins.map((p, idx) => ({
        ...p,
        id: `${id}-pin-${idx + 1}`,
      })),
    };

    set((state) => ({
      components: [...state.components, newComponent],
      selected: { kind: "component", id },
    }));
  },

  rotateComponent: (id, deltaDeg = 90) => {
    set((state) => ({
      components: state.components.map((c) => {
        if (c.id !== id) return c;
        const current = c.rotationDeg ?? 0;
        const nextDeg = (((current + deltaDeg) % 360) + 360) % 360 as RotationDeg;
        return { ...c, rotationDeg: nextDeg };
      }),
    }));
  },

  duplicateComponent: (id, offsetMm = { x: 20, y: 0 }) => {
    const { components, rails, gridSnapMm, enclosure } = get();
    const source = components.find((c) => c.id === id);
    if (!source) return null;

    const newId = makeUid("comp");
    const targetX = source.xMm + offsetMm.x;
    const targetY = source.yMm + offsetMm.y;

    const snapResult = snapComponentToNearestRail(
      targetX,
      targetY,
      source.widthMm,
      source.depthMm,
      rails,
      gridSnapMm,
      source.railId ? 20 : Infinity
    );

    const { widthMm: plateW, heightMm: plateH } = getBackplateDimensions(enclosure);
    const clamped = clampToBackplate(
      snapResult.xMm,
      snapResult.yMm,
      source.widthMm,
      source.heightMm,
      plateW,
      plateH
    );

    const duplicated: PlacedComponent = {
      ...source,
      id: newId,
      name: nextIncrementedName(source.name, components.map((c) => c.name)),
      xMm: clamped.xMm,
      yMm: clamped.yMm,
      zMm: snapResult.zMm,
      railId: snapResult.railId,
      pins: source.pins.map((p, idx) => ({
        ...p,
        id: `${newId}-pin-${idx + 1}`,
      })),
    };

    set((state) => ({
      components: [...state.components, duplicated],
      selected: { kind: "component", id: newId },
    }));
    return newId;
  },

  snapComponentToRail: (id) => {
    const comp = get().components.find((c) => c.id === id);
    if (!comp) return;
    const { rails, gridSnapMm } = get();
    const snapResult = snapComponentToNearestRail(
      comp.xMm,
      comp.yMm,
      comp.widthMm,
      comp.depthMm,
      rails,
      gridSnapMm
    );
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id
          ? {
              ...c,
              xMm: snapResult.xMm,
              yMm: snapResult.yMm,
              zMm: snapResult.zMm,
              railId: snapResult.railId,
            }
          : c
      ),
    }));
  },

  updateComponent: (id, partial) =>
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id ? { ...c, ...partial } : c
      ),
    })),

  moveComponent: (id, targetXMm, targetYMm) => {
    const comp = get().components.find((c) => c.id === id);
    if (!comp) return;
    const { rails, gridSnapMm, enclosure } = get();
    const snapResult = snapComponentToNearestRail(
      targetXMm,
      targetYMm,
      comp.widthMm,
      comp.depthMm,
      rails,
      gridSnapMm
    );

    const { widthMm: plateW, heightMm: plateH } =
      getBackplateDimensions(enclosure);
    const clamped = clampToBackplate(
      snapResult.xMm,
      snapResult.yMm,
      comp.widthMm,
      comp.heightMm,
      plateW,
      plateH
    );

    set((state) => ({
      components: state.components.map((c) =>
        c.id === id
          ? {
              ...c,
              xMm: clamped.xMm,
              yMm: clamped.yMm,
              zMm: snapResult.zMm,
              railId: snapResult.railId,
            }
          : c
      ),
    }));
  },

  removeComponent: (id) =>
    set((state) => ({
      components: state.components.filter((c) => c.id !== id),
      wires: state.wires.filter(
        (w) => w.fromComponentId !== id && w.toComponentId !== id
      ),
      selected: state.selected?.id === id ? null : state.selected,
    })),

  addCadAsset: (asset) =>
    set((state) => ({
      cadAssets: [...state.cadAssets, asset],
      selected: { kind: "cad", id: asset.id },
    })),

  rotateCadAsset: (id, deltaDeg = 90) => {
    set((state) => ({
      cadAssets: state.cadAssets.map((a) => {
        if (a.id !== id) return a;
        const current = a.rotationDeg ?? 0;
        const nextDeg = (((current + deltaDeg) % 360) + 360) % 360 as RotationDeg;
        return { ...a, rotationDeg: nextDeg };
      }),
    }));
  },

  duplicateCadAsset: (id, offsetMm = { x: 20, y: 0 }) => {
    const { cadAssets, enclosure, gridSnapMm } = get();
    const source = cadAssets.find((a) => a.id === id);
    if (!source) return null;

    const newId = makeUid("cad");
    const { widthMm: plateW, heightMm: plateH } = getBackplateDimensions(enclosure);
    const rawX = snapToGrid(source.xMm + offsetMm.x, gridSnapMm);
    const rawY = snapToGrid(source.yMm + offsetMm.y, gridSnapMm);
    const clamped = clampToBackplate(
      rawX,
      rawY,
      source.boundingBoxMm.w,
      source.boundingBoxMm.h,
      plateW,
      plateH
    );

    const duplicated: CustomCadAsset = {
      ...source,
      id: newId,
      name: nextIncrementedName(source.name, cadAssets.map((a) => a.name)),
      xMm: clamped.xMm,
      yMm: clamped.yMm,
      pins: source.pins.map((p, idx) => ({
        ...p,
        id: `${newId}-pin-${idx + 1}`,
      })),
    };

    set((state) => ({
      cadAssets: [...state.cadAssets, duplicated],
      selected: { kind: "cad", id: newId },
    }));
    return newId;
  },

  updateCadAsset: (id, partial) =>
    set((state) => ({
      cadAssets: state.cadAssets.map((a) =>
        a.id === id ? { ...a, ...partial } : a
      ),
    })),

  moveCadAsset: (id, targetXMm, targetYMm) => {
    const asset = get().cadAssets.find((a) => a.id === id);
    if (!asset) return;
    const { rails, gridSnapMm, enclosure } = get();
    const snapResult = snapComponentToNearestRail(
      targetXMm,
      targetYMm,
      asset.boundingBoxMm.w,
      asset.boundingBoxMm.d,
      rails,
      gridSnapMm,
      25
    );
    const { widthMm: plateW, heightMm: plateH } =
      getBackplateDimensions(enclosure);
    const clamped = clampToBackplate(
      snapResult.xMm,
      snapResult.yMm,
      asset.boundingBoxMm.w,
      asset.boundingBoxMm.h,
      plateW,
      plateH
    );

    set((state) => ({
      cadAssets: state.cadAssets.map((a) =>
        a.id === id
          ? {
              ...a,
              xMm: clamped.xMm,
              yMm: clamped.yMm,
              zMm: snapResult.snappedToRail ? snapResult.zMm : a.zMm,
            }
          : a
      ),
    }));
  },

  removeCadAsset: (id) =>
    set((state) => ({
      cadAssets: state.cadAssets.filter((a) => a.id !== id),
      wires: state.wires.filter(
        (w) => w.fromComponentId !== id && w.toComponentId !== id
      ),
      selected: state.selected?.id === id ? null : state.selected,
      isPinMarkingMode:
        state.activeMarkingAssetId === id ? false : state.isPinMarkingMode,
      activeMarkingAssetId:
        state.activeMarkingAssetId === id ? null : state.activeMarkingAssetId,
    })),

  addPinToAsset: (assetId, pin) =>
    set((state) => ({
      cadAssets: state.cadAssets.map((a) => {
        if (a.id !== assetId) return a;
        const newPin: PinTerminal = {
          ...pin,
          id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        };
        return { ...a, pins: [...a.pins, newPin] };
      }),
    })),

  removePinFromAsset: (assetId, pinId) =>
    set((state) => ({
      cadAssets: state.cadAssets.map((a) =>
        a.id === assetId
          ? { ...a, pins: a.pins.filter((p) => p.id !== pinId) }
          : a
      ),
    })),
}));
