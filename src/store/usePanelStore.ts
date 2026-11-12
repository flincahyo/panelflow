import { create } from "zustand";
import { COMPONENT_CATALOG } from "@/lib/components-catalog";
import { clampToBackplate, snapComponentToNearestRail, snapToGrid } from "@/lib/snap";
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
  SelectionTarget,
  TitleBlockMeta,
  ViewportMode,
  WireColorCode,
  WireConnection,
  WireDuct,
} from "@/types/panel";

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

  addRail: () => void;
  updateRail: (id: string, partial: Partial<DinRail>) => void;
  removeRail: (id: string) => void;

  addDuct: (orientation?: "horizontal" | "vertical") => void;
  updateDuct: (id: string, partial: Partial<WireDuct>) => void;
  removeDuct: (id: string) => void;

  addComponent: (templateId: ComponentTemplateId, nearYMm?: number) => void;
  updateComponent: (id: string, partial: Partial<PlacedComponent>) => void;
  moveComponent: (id: string, targetXMm: number, targetYMm: number) => void;
  removeComponent: (id: string) => void;

  addCadAsset: (asset: CustomCadAsset) => void;
  updateCadAsset: (id: string, partial: Partial<CustomCadAsset>) => void;
  removeCadAsset: (id: string) => void;
  addPinToAsset: (assetId: string, pin: Omit<PinTerminal, "id">) => void;
  removePinFromAsset: (assetId: string, pinId: string) => void;
}

export const usePanelStore = create<PanelStore>((set, get) => ({
  viewportMode: "3d",
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

  addRail: () => {
    const { rails, gridSnapMm, enclosure } = get();
    const { widthMm } = getBackplateDimensions(enclosure);
    const newY = rails.length > 0 ? rails[rails.length - 1].yMm - 80 : 0;
    const snappedY = snapToGrid(newY, gridSnapMm);
    const id = `rail-${Date.now()}`;
    const newRail: DinRail = {
      id,
      name: `DIN Rail ${rails.length + 1}`,
      xMm: 0,
      yMm: snappedY,
      lengthMm: Math.min(460, widthMm - 40),
    };
    set((state) => ({
      rails: [...state.rails, newRail],
      selected: { kind: "rail", id },
    }));
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

  addDuct: (orientation = "horizontal") => {
    const { ducts, enclosure } = get();
    const { widthMm, heightMm } = getBackplateDimensions(enclosure);
    const id = `duct-${Date.now()}`;
    const newDuct: WireDuct = {
      id,
      name: `${orientation === "horizontal" ? "Horiz" : "Vert"} Duct ${
        ducts.length + 1
      }`,
      xMm: 0,
      yMm: 0,
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

  updateDuct: (id, partial) =>
    set((state) => ({
      ducts: state.ducts.map((d) => (d.id === id ? { ...d, ...partial } : d)),
    })),

  removeDuct: (id) =>
    set((state) => ({
      ducts: state.ducts.filter((d) => d.id !== id),
      selected: state.selected?.id === id ? null : state.selected,
    })),

  addComponent: (templateId, nearYMm) => {
    const template = COMPONENT_CATALOG[templateId];
    if (!template) return;
    const { rails, gridSnapMm, components } = get();
    const targetY = nearYMm ?? (rails[0]?.yMm ?? 0);
    const snapResult = snapComponentToNearestRail(
      0,
      targetY,
      template.widthMm,
      template.depthMm,
      rails,
      gridSnapMm
    );

    const id = `comp-${Date.now()}`;
    const newComponent: PlacedComponent = {
      id,
      templateId,
      name: `${template.shortName} #${components.length + 1}`,
      xMm: snapResult.xMm,
      yMm: snapResult.yMm,
      zMm: snapResult.zMm,
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
      selected: state.selected?.id === id ? null : state.selected,
    })),

  addCadAsset: (asset) =>
    set((state) => ({
      cadAssets: [...state.cadAssets, asset],
      selected: { kind: "cad", id: asset.id },
    })),

  updateCadAsset: (id, partial) =>
    set((state) => ({
      cadAssets: state.cadAssets.map((a) =>
        a.id === id ? { ...a, ...partial } : a
      ),
    })),

  removeCadAsset: (id) =>
    set((state) => ({
      cadAssets: state.cadAssets.filter((a) => a.id !== id),
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
