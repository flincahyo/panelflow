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
import { resolvePinWorldPoint, routeWireThroughDucts } from "@/lib/wire-router";
import type {
  CanvasTool2D,
  ComponentTemplateId,
  CustomCadAsset,
  DinRail,
  DoorMode,
  EnclosureConfig,
  GridSnapMm,
  LengthUnit,
  PanelSheet,
  PinTerminal,
  PlacedComponent,
  PlateConfig,
  RotationDeg,
  SelectionTarget,
  SelectedTarget,
  SheetType,
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

function applyThemeToDom(theme: "dark" | "light") {
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
      root.style.backgroundColor = "#f8fafc";
      root.style.colorScheme = "light";
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
      root.style.backgroundColor = "#090b10";
      root.style.colorScheme = "dark";
    }
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("panelflow_saved_theme", theme);
    } catch {
      // ignore storage errors
    }
  }
}

export type ThemeMode = "dark" | "light";

export type SheetSnapshot = PanelSheet;

function cloneSheet(sheet: PanelSheet): PanelSheet {
  return JSON.parse(JSON.stringify(sheet));
}

function createDefaultSheet(id = "sheet-1", name = "Sheet 1 (Mounting Plate)", sheetType: SheetType = "mounting-plate"): PanelSheet {
  return {
    id,
    name,
    sheetType,
    enclosure: {
      widthMm: 600,
      heightMm: 800,
      depthMm: 250,
      backplateInsetMm: 40,
      backplateThicknessMm: 2,
      wallThicknessMm: 2,
      doorMode: "transparent",
      plateMode: "auto",
      manualPlateWidthMm: 520,
      manualPlateHeightMm: 720,
    },
    plateConfig: {
      mode: "auto",
      manualWidthMm: 520,
      manualHeightMm: 720,
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
  };
}

const defaultInitialSheet = createDefaultSheet();

interface HistoryState {
  past: PanelSheet[][]; // array of sheets list snapshots
  future: PanelSheet[][];
}

interface PanelStore {
  // Multi-sheet Canvas State
  sheets: PanelSheet[];
  activeSheetId: string;

  // Active sheet projections (for zero-breakage direct consumption)
  enclosure: EnclosureConfig;
  plateConfig: PlateConfig;
  rails: DinRail[];
  ducts: WireDuct[];
  components: PlacedComponent[];
  cadAssets: CustomCadAsset[];
  wires: WireConnection[];
  titleBlock: TitleBlockMeta;

  // Global Workspace State
  theme: ThemeMode;
  viewportMode: ViewportMode;
  canvasTool2D: CanvasTool2D;
  displayUnit: LengthUnit;
  gridSnapMm: GridSnapMm;
  activeWireColor: WireColorCode;
  activeWireGauge: string;
  activeWireStartPin: { componentId: string; pinId: string } | null;
  autoRouteDuctsEnabled: boolean;
  setAutoRouteDuctsEnabled: (enabled: boolean) => void;
  selected: SelectionTarget;
  selectedIds: SelectedTarget[];
  isPinMarkingMode: boolean;
  activeMarkingAssetId: string | null;
  inspectorFocusNonce: number;

  // History Stack
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Sheet Tabs Actions
  setActiveSheet: (sheetId: string) => void;
  addSheet: (sheetType?: SheetType, name?: string) => string;
  renameSheet: (sheetId: string, newName: string) => void;
  duplicateSheet: (sheetId: string) => string | null;
  deleteSheet: (sheetId: string) => boolean;

  // Inspector & Toolbar Focus
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  requestInspectorFocus: () => void;
  setViewportMode: (mode: ViewportMode) => void;
  setCanvasTool2D: (tool: CanvasTool2D) => void;
  setActiveWireColor: (color: WireColorCode) => void;
  setActiveWireGauge: (gauge: string) => void;
  setActiveWireStartPin: (pin: { componentId: string; pinId: string } | null) => void;
  updateTitleBlock: (partial: Partial<TitleBlockMeta>) => void;

  // Plate / Enclosure Actions
  setDisplayUnit: (unit: LengthUnit) => void;
  setGridSnapMm: (snap: GridSnapMm) => void;
  setDoorMode: (mode: DoorMode) => void;
  updateEnclosure: (partial: Partial<EnclosureConfig>) => void;
  updatePlateConfig: (partial: Partial<PlateConfig>) => void;

  // Wire Actions
  addWire: (wire: Omit<WireConnection, "id">) => void;
  updateWire: (id: string, partial: Partial<WireConnection>) => void;
  removeWire: (id: string) => void;
  autoRouteWire: (id: string) => void;
  autoRouteAllWires: () => void;

  // Selection & Marking
  setSelected: (target: SelectionTarget) => void;
  setSelectedIds: (targets: SelectedTarget[]) => void;
  toggleSelectId: (target: SelectedTarget) => void;
  clearSelection: () => void;
  moveSelectedItems: (dxMm: number, dyMm: number) => void;
  deleteSelectedItems: () => void;
  alignSelectedItems: (mode: "left" | "center" | "top") => void;
  pushUndoSnapshot: () => void;
  setPinMarkingMode: (enabled: boolean, assetId?: string | null) => void;

  // Rails & Ducts
  addRail: (customPos?: { xMm: number; yMm: number }) => void;
  updateRail: (id: string, partial: Partial<DinRail>) => void;
  removeRail: (id: string) => void;
  duplicateRail: (id: string, offsetMm?: { x: number; y: number }) => string | null;

  addDuct: (
    orientation?: "horizontal" | "vertical",
    customPos?: { xMm: number; yMm: number }
  ) => void;
  updateDuct: (id: string, partial: Partial<WireDuct>) => void;
  removeDuct: (id: string) => void;
  duplicateDuct: (id: string, offsetMm?: { x: number; y: number }) => string | null;
  alignComponentsOnRail: (railId: string, mode: "distribute" | "left" | "center" | "right") => void;

  // Component Actions
  addComponent: (templateId: ComponentTemplateId, nearYMm?: number, customPos?: { xMm: number; yMm: number }) => void;
  updateComponent: (id: string, partial: Partial<PlacedComponent>) => void;
  moveComponent: (id: string, targetXMm: number, targetYMm: number) => void;
  removeComponent: (id: string) => void;
  rotateComponent: (id: string, deltaDeg?: 90 | 180 | 270) => void;
  duplicateComponent: (id: string, offsetMm?: { x: number; y: number }) => string | null;
  snapComponentToRail: (id: string) => void;

  // CAD Asset Actions
  addCadAsset: (asset: CustomCadAsset) => void;
  updateCadAsset: (id: string, partial: Partial<CustomCadAsset>) => void;
  moveCadAsset: (id: string, targetXMm: number, targetYMm: number) => void;
  removeCadAsset: (id: string) => void;
  rotateCadAsset: (id: string, deltaDeg?: 90 | 180 | 270) => void;
  duplicateCadAsset: (id: string, offsetMm?: { x: number; y: number }) => string | null;
  addPinToAsset: (assetId: string, pin: Omit<PinTerminal, "id">) => void;
  removePinFromAsset: (assetId: string, pinId: string) => void;

  // Project Import / Restore / Reset
  loadProjectState: (params: {
    sheets: PanelSheet[];
    activeSheetId?: string;
    displayUnit?: LengthUnit;
    gridSnapMm?: GridSnapMm;
    autoRouteDuctsEnabled?: boolean;
    titleBlock?: TitleBlockMeta;
  }) => void;
  resetToDefaultProject: () => void;
}

const MAX_HISTORY = 30;
let historyStack: HistoryState = {
  past: [],
  future: [],
};

function pushHistory(currentSheets: PanelSheet[]) {
  const snapshot = currentSheets.map(cloneSheet);
  historyStack.past.push(snapshot);
  if (historyStack.past.length > MAX_HISTORY) {
    historyStack.past.shift();
  }
  historyStack.future = [];
}

function syncActiveSheetProjection(sheet: PanelSheet) {
  return {
    enclosure: sheet.enclosure,
    plateConfig: sheet.plateConfig,
    rails: sheet.rails,
    ducts: sheet.ducts,
    components: sheet.components,
    cadAssets: sheet.cadAssets,
    wires: sheet.wires,
    titleBlock: sheet.titleBlock,
  };
}

export const usePanelStore = create<PanelStore>((set, get) => ({
  sheets: [defaultInitialSheet],
  activeSheetId: defaultInitialSheet.id,

  // Active projection
  enclosure: defaultInitialSheet.enclosure,
  plateConfig: defaultInitialSheet.plateConfig,
  rails: defaultInitialSheet.rails,
  ducts: defaultInitialSheet.ducts,
  components: defaultInitialSheet.components,
  cadAssets: defaultInitialSheet.cadAssets,
  wires: defaultInitialSheet.wires,
  titleBlock: defaultInitialSheet.titleBlock,

  theme: "light",
  viewportMode: "2d",
  canvasTool2D: "select",
  displayUnit: "mm",
  gridSnapMm: 10,
  activeWireColor: "R",
  activeWireGauge: "2.5",
  activeWireStartPin: null,
  autoRouteDuctsEnabled: true,
  setAutoRouteDuctsEnabled: (enabled) => set({ autoRouteDuctsEnabled: enabled }),
  selected: null,
  selectedIds: [],
  isPinMarkingMode: false,
  activeMarkingAssetId: null,
  inspectorFocusNonce: 0,
  canUndo: false,
  canRedo: false,

  undo: () => {
    if (historyStack.past.length === 0) return;
    const currentState = get();
    const currentSheets = currentState.sheets.map(cloneSheet);
    const previous = historyStack.past.pop()!;
    historyStack.future.push(currentSheets);

    let activeSheet = previous.find((s) => s.id === currentState.activeSheetId);
    if (!activeSheet) {
      activeSheet = previous[0];
    }

    set({
      sheets: previous,
      activeSheetId: activeSheet.id,
      canUndo: historyStack.past.length > 0,
      canRedo: true,
      ...syncActiveSheetProjection(activeSheet),
    });
  },

  redo: () => {
    if (historyStack.future.length === 0) return;
    const currentState = get();
    const currentSheets = currentState.sheets.map(cloneSheet);
    const next = historyStack.future.pop()!;
    historyStack.past.push(currentSheets);

    let activeSheet = next.find((s) => s.id === currentState.activeSheetId);
    if (!activeSheet) {
      activeSheet = next[0];
    }

    set({
      sheets: next,
      activeSheetId: activeSheet.id,
      canUndo: true,
      canRedo: historyStack.future.length > 0,
      ...syncActiveSheetProjection(activeSheet),
    });
  },

  setActiveSheet: (sheetId: string) => {
    const { sheets, activeSheetId } = get();
    if (sheetId === activeSheetId) return;
    const target = sheets.find((s) => s.id === sheetId);
    if (!target) return;

    set({
      activeSheetId: sheetId,
      selected: null,
      selectedIds: [],
      activeWireStartPin: null,
      isPinMarkingMode: false,
      activeMarkingAssetId: null,
      ...syncActiveSheetProjection(target),
    });
  },

  addSheet: (sheetType = "mounting-plate", name) => {
    const { sheets } = get();
    pushHistory(sheets);
    const id = makeUid("sheet");
    const typeLabel =
      sheetType === "door-cutout"
        ? "Door Cutout"
        : sheetType === "schematic"
        ? "Schematic"
        : "Mounting Plate";
    const sheetName =
      name || nextIncrementedName(`Sheet (${typeLabel})`, sheets.map((s) => s.name));
    const newSheet = createDefaultSheet(id, sheetName, sheetType);

    // Non-mounting-plate sheets (door-cutout, schematic) start clean without pre-populated DIN hardware
    if (sheetType !== "mounting-plate") {
      newSheet.rails = [];
      newSheet.ducts = [];
      newSheet.components = [];
      newSheet.wires = [];
    }

    const updated = [...sheets, newSheet];
    set({
      sheets: updated,
      activeSheetId: id,
      selected: null,
      selectedIds: [],
      activeWireStartPin: null,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(newSheet),
    });
    return id;
  },

  renameSheet: (sheetId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === sheetId ? { ...s, name: trimmed } : s
    );
    const active = updated.find((s) => s.id === activeSheetId) || updated[0];
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  duplicateSheet: (sheetId: string) => {
    const { sheets } = get();
    const source = sheets.find((s) => s.id === sheetId);
    if (!source) return null;
    pushHistory(sheets);

    const dup = cloneSheet(source);
    const newId = makeUid("sheet");
    dup.id = newId;
    dup.name = nextIncrementedName(source.name, sheets.map((s) => s.name));

    // Re-key components and pins to prevent ID collision
    const compIdMap = new Map<string, string>();
    dup.components = dup.components.map((c) => {
      const freshCompId = makeUid("comp");
      compIdMap.set(c.id, freshCompId);
      return {
        ...c,
        id: freshCompId,
        pins: c.pins.map((p, idx) => ({ ...p, id: `${freshCompId}-pin-${idx + 1}` })),
      };
    });

    dup.wires = dup.wires.map((w) => ({
      ...w,
      id: makeUid("wire"),
      fromComponentId: compIdMap.get(w.fromComponentId) ?? w.fromComponentId,
      toComponentId: compIdMap.get(w.toComponentId) ?? w.toComponentId,
    }));

    dup.rails = dup.rails.map((r) => ({ ...r, id: makeUid("rail") }));
    dup.ducts = dup.ducts.map((d) => ({ ...d, id: makeUid("duct") }));
    dup.cadAssets = dup.cadAssets.map((a) => ({ ...a, id: makeUid("cad") }));

    const updated = [...sheets, dup];
    set({
      sheets: updated,
      activeSheetId: newId,
      selected: null,
      selectedIds: [],
      activeWireStartPin: null,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(dup),
    });
    return newId;
  },

  deleteSheet: (sheetId: string) => {
    const { sheets, activeSheetId } = get();
    if (sheets.length <= 1) return false;
    pushHistory(sheets);

    const updated = sheets.filter((s) => s.id !== sheetId);
    let nextActiveId = activeSheetId;
    if (activeSheetId === sheetId) {
      nextActiveId = updated[0].id;
    }
    const nextActiveSheet = updated.find((s) => s.id === nextActiveId)!;

    set({
      sheets: updated,
      activeSheetId: nextActiveId,
      selected: null,
      selectedIds: [],
      activeWireStartPin: null,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(nextActiveSheet),
    });
    return true;
  },

  setTheme: (theme) => {
    applyThemeToDom(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    applyThemeToDom(next);
    set({ theme: next });
  },
  requestInspectorFocus: () =>
    set((state) => ({ inspectorFocusNonce: state.inspectorFocusNonce + 1 })),
  setViewportMode: (mode) => set({ viewportMode: mode }),
  setCanvasTool2D: (tool) => set({ canvasTool2D: tool, activeWireStartPin: null }),
  setActiveWireColor: (color) => set({ activeWireColor: color }),
  setActiveWireGauge: (gauge) => set({ activeWireGauge: gauge }),
  setActiveWireStartPin: (pin) => set({ activeWireStartPin: pin }),
  setDisplayUnit: (unit) => set({ displayUnit: unit }),
  setGridSnapMm: (snap) => set({ gridSnapMm: snap }),
  setSelected: (target) =>
    set({
      selected: target,
      selectedIds: target ? [target] : [],
    }),
  setSelectedIds: (targets) =>
    set({
      selectedIds: targets,
      selected: targets.length > 0 ? targets[0] : null,
    }),
  toggleSelectId: (target) => {
    const { selectedIds } = get();
    const exists = selectedIds.some((s) => s.id === target.id && s.kind === target.kind);
    let next: SelectedTarget[];
    if (exists) {
      next = selectedIds.filter((s) => !(s.id === target.id && s.kind === target.kind));
    } else {
      next = [...selectedIds, target];
    }
    set({
      selectedIds: next,
      selected: next.length > 0 ? next[next.length - 1] : null,
    });
  },
  clearSelection: () => set({ selected: null, selectedIds: [] }),

  pushUndoSnapshot: () => {
    const { sheets } = get();
    pushHistory(sheets);
    set({ canUndo: true, canRedo: false });
  },

  moveSelectedItems: (dxMm, dyMm) => {
    const { sheets, activeSheetId, selectedIds, enclosure, plateConfig } = get();
    if (selectedIds.length === 0 || (dxMm === 0 && dyMm === 0)) return;
    const activeSheet = sheets.find((s) => s.id === activeSheetId);
    if (!activeSheet) return;

    const { widthMm: plateW, heightMm: plateH } = getBackplateDimensions(
      enclosure,
      plateConfig
    );

    const compIds = new Set(selectedIds.filter((s) => s.kind === "component").map((s) => s.id));
    const cadIds = new Set(selectedIds.filter((s) => s.kind === "cad").map((s) => s.id));
    const railIds = new Set(selectedIds.filter((s) => s.kind === "rail").map((s) => s.id));
    const ductIds = new Set(selectedIds.filter((s) => s.kind === "duct").map((s) => s.id));

    const nextComponents = activeSheet.components.map((c) => {
      if (!compIds.has(c.id)) return c;
      const dims = getRotatedDimensions(c.widthMm, c.heightMm, c.rotationDeg ?? 0);
      const targetX = c.xMm + dxMm;
      const targetY = c.yMm + dyMm;
      const clamped = clampToBackplate(targetX, targetY, dims.widthMm, dims.heightMm, plateW, plateH);
      return {
        ...c,
        xMm: clamped.xMm,
        yMm: clamped.yMm,
      };
    });

    const nextCadAssets = activeSheet.cadAssets.map((a) => {
      if (!cadIds.has(a.id)) return a;
      const dims = getRotatedDimensions(a.boundingBoxMm.w, a.boundingBoxMm.h, a.rotationDeg ?? 0);
      const targetX = a.xMm + dxMm;
      const targetY = a.yMm + dyMm;
      const clamped = clampToBackplate(targetX, targetY, dims.widthMm, dims.heightMm, plateW, plateH);
      return {
        ...a,
        xMm: clamped.xMm,
        yMm: clamped.yMm,
      };
    });

    const nextRails = activeSheet.rails.map((r) => {
      if (!railIds.has(r.id)) return r;
      const clamped = clampToBackplate(r.xMm + dxMm, r.yMm + dyMm, r.lengthMm, DIN_RAIL_HEIGHT_MM, plateW, plateH);
      return {
        ...r,
        xMm: clamped.xMm,
        yMm: clamped.yMm,
      };
    });

    const nextDucts = activeSheet.ducts.map((d) => {
      if (!ductIds.has(d.id)) return d;
      const clamped = clampToBackplate(d.xMm + dxMm, d.yMm + dyMm, d.widthMm, d.heightMm, plateW, plateH);
      return {
        ...d,
        xMm: clamped.xMm,
        yMm: clamped.yMm,
      };
    });

    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            components: nextComponents,
            cadAssets: nextCadAssets,
            rails: nextRails,
            ducts: nextDucts,
          }
        : s
    );

    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      ...syncActiveSheetProjection(active),
    });
  },

  deleteSelectedItems: () => {
    const { sheets, activeSheetId, selectedIds } = get();
    if (selectedIds.length === 0) return;
    pushHistory(sheets);
    const activeSheet = sheets.find((s) => s.id === activeSheetId);
    if (!activeSheet) return;

    const compIds = new Set(selectedIds.filter((s) => s.kind === "component").map((s) => s.id));
    const cadIds = new Set(selectedIds.filter((s) => s.kind === "cad").map((s) => s.id));
    const railIds = new Set(selectedIds.filter((s) => s.kind === "rail").map((s) => s.id));
    const ductIds = new Set(selectedIds.filter((s) => s.kind === "duct").map((s) => s.id));
    const wireIds = new Set(selectedIds.filter((s) => s.kind === "wire").map((s) => s.id));

    const nextComponents = activeSheet.components
      .filter((c) => !compIds.has(c.id))
      .map((c) => (c.railId && railIds.has(c.railId) ? { ...c, railId: null } : c));

    const nextCadAssets = activeSheet.cadAssets.filter((a) => !cadIds.has(a.id));
    const nextRails = activeSheet.rails.filter((r) => !railIds.has(r.id));
    const nextDucts = activeSheet.ducts.filter((d) => !ductIds.has(d.id));

    // Remove wires either explicitly selected or connected to deleted components/CAD assets
    const nextWires = activeSheet.wires.filter(
      (w) =>
        !wireIds.has(w.id) &&
        !compIds.has(w.fromComponentId) &&
        !compIds.has(w.toComponentId) &&
        !cadIds.has(w.fromComponentId) &&
        !cadIds.has(w.toComponentId)
    );

    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            components: nextComponents,
            cadAssets: nextCadAssets,
            rails: nextRails,
            ducts: nextDucts,
            wires: nextWires,
          }
        : s
    );

    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: null,
      selectedIds: [],
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  alignSelectedItems: (mode: "left" | "center" | "top") => {
    const { sheets, activeSheetId, selectedIds, enclosure, plateConfig } = get();
    if (selectedIds.length < 2) return;
    const activeSheet = sheets.find((s) => s.id === activeSheetId);
    if (!activeSheet) return;

    pushHistory(sheets);
    const { widthMm: plateW, heightMm: plateH } = getBackplateDimensions(enclosure, plateConfig);

    type ItemRef = {
      id: string;
      kind: "component" | "cad";
      xMm: number;
      yMm: number;
      wMm: number;
      hMm: number;
      left: number;
      center: number;
      top: number;
    };

    const targets: ItemRef[] = [];
    for (const sel of selectedIds) {
      if (sel.kind === "component") {
        const c = activeSheet.components.find((x) => x.id === sel.id);
        if (c) {
          const dims = getRotatedDimensions(c.widthMm, c.heightMm, c.rotationDeg ?? 0);
          targets.push({
            id: c.id,
            kind: "component",
            xMm: c.xMm,
            yMm: c.yMm,
            wMm: dims.widthMm,
            hMm: dims.heightMm,
            left: c.xMm - dims.widthMm / 2,
            center: c.xMm,
            top: c.yMm + dims.heightMm / 2,
          });
        }
      } else if (sel.kind === "cad") {
        const a = activeSheet.cadAssets.find((x) => x.id === sel.id);
        if (a) {
          const dims = getRotatedDimensions(a.boundingBoxMm.w, a.boundingBoxMm.h, a.rotationDeg ?? 0);
          targets.push({
            id: a.id,
            kind: "cad",
            xMm: a.xMm,
            yMm: a.yMm,
            wMm: dims.widthMm,
            hMm: dims.heightMm,
            left: a.xMm - dims.widthMm / 2,
            center: a.xMm,
            top: a.yMm + dims.heightMm / 2,
          });
        }
      }
    }

    if (targets.length < 2) return;

    const compPosMap = new Map<string, { x: number; y: number }>();
    const cadPosMap = new Map<string, { x: number; y: number }>();

    if (mode === "left") {
      const minLeft = Math.min(...targets.map((t) => t.left));
      for (const t of targets) {
        const nextX = minLeft + t.wMm / 2;
        const clamped = clampToBackplate(nextX, t.yMm, t.wMm, t.hMm, plateW, plateH);
        if (t.kind === "component") compPosMap.set(t.id, { x: clamped.xMm, y: clamped.yMm });
        else cadPosMap.set(t.id, { x: clamped.xMm, y: clamped.yMm });
      }
    } else if (mode === "center") {
      const avgCenter = targets.reduce((sum, t) => sum + t.center, 0) / targets.length;
      for (const t of targets) {
        const clamped = clampToBackplate(avgCenter, t.yMm, t.wMm, t.hMm, plateW, plateH);
        if (t.kind === "component") compPosMap.set(t.id, { x: clamped.xMm, y: clamped.yMm });
        else cadPosMap.set(t.id, { x: clamped.xMm, y: clamped.yMm });
      }
    } else if (mode === "top") {
      const maxTop = Math.max(...targets.map((t) => t.top));
      for (const t of targets) {
        const nextY = maxTop - t.hMm / 2;
        const clamped = clampToBackplate(t.xMm, nextY, t.wMm, t.hMm, plateW, plateH);
        if (t.kind === "component") compPosMap.set(t.id, { x: clamped.xMm, y: clamped.yMm });
        else cadPosMap.set(t.id, { x: clamped.xMm, y: clamped.yMm });
      }
    }

    const updated = sheets.map((s) => {
      if (s.id !== activeSheetId) return s;
      return {
        ...s,
        components: s.components.map((c) => {
          const pos = compPosMap.get(c.id);
          return pos ? { ...c, xMm: pos.x, yMm: pos.y } : c;
        }),
        cadAssets: s.cadAssets.map((a) => {
          const pos = cadPosMap.get(a.id);
          return pos ? { ...a, xMm: pos.x, yMm: pos.y } : a;
        }),
      };
    });

    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  setPinMarkingMode: (enabled, assetId = null) =>
    set({ isPinMarkingMode: enabled, activeMarkingAssetId: assetId }),

  updateTitleBlock: (partial) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? { ...s, titleBlock: { ...s.titleBlock, ...partial } }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  setDoorMode: (mode) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? { ...s, enclosure: { ...s.enclosure, doorMode: mode } }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  updateEnclosure: (partial) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) => {
      if (s.id !== activeSheetId) return s;
      const nextEnclosure = { ...s.enclosure, ...partial };
      const nextPlateConfig = {
        ...s.plateConfig,
        ...(partial.plateMode ? { mode: partial.plateMode } : {}),
        ...(partial.manualPlateWidthMm !== undefined
          ? { manualWidthMm: partial.manualPlateWidthMm }
          : {}),
        ...(partial.manualPlateHeightMm !== undefined
          ? { manualHeightMm: partial.manualPlateHeightMm }
          : {}),
      };
      return {
        ...s,
        enclosure: nextEnclosure,
        plateConfig: nextPlateConfig,
      };
    });
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  updatePlateConfig: (partial) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) => {
      if (s.id !== activeSheetId) return s;
      const nextPlate = { ...s.plateConfig, ...partial };
      const nextEnclosure = {
        ...s.enclosure,
        plateMode: nextPlate.mode,
        manualPlateWidthMm: nextPlate.manualWidthMm,
        manualPlateHeightMm: nextPlate.manualHeightMm,
      };
      return {
        ...s,
        plateConfig: nextPlate,
        enclosure: nextEnclosure,
      };
    });
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  addWire: (wire) => {
    const { sheets, activeSheetId, autoRouteDuctsEnabled } = get();
    pushHistory(sheets);
    const id = `wire-${Date.now()}`;
    const activeSheet = sheets.find((s) => s.id === activeSheetId)!;
    let waypoints = wire.waypoints;
    if (!waypoints && autoRouteDuctsEnabled && activeSheet.ducts.length > 0) {
      const p1 = resolvePinWorldPoint(
        activeSheet.components,
        activeSheet.cadAssets,
        wire.fromComponentId,
        wire.fromPinId
      );
      const p2 = resolvePinWorldPoint(
        activeSheet.components,
        activeSheet.cadAssets,
        wire.toComponentId,
        wire.toPinId
      );
      if (p1 && p2) {
        const pts = routeWireThroughDucts(
          { x: p1.xMm, y: p1.yMm },
          { x: p2.xMm, y: p2.yMm },
          activeSheet.ducts,
          activeSheet.rails,
          activeSheet.wires.length
        );
        waypoints = pts.map((p) => ({ xMm: p.x, yMm: p.y }));
      }
    }
    const newWire: WireConnection = { ...wire, id, ...(waypoints ? { waypoints } : {}) };
    const updated = sheets.map((s) =>
      s.id === activeSheetId ? { ...s, wires: [...s.wires, newWire] } : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: { kind: "wire", id },
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  updateWire: (id, partial) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            wires: s.wires.map((w) => (w.id === id ? { ...w, ...partial } : w)),
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  removeWire: (id) => {
    const { sheets, activeSheetId, selected, selectedIds } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? { ...s, wires: s.wires.filter((w) => w.id !== id) }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: selected?.id === id ? null : selected,
      selectedIds: selectedIds.filter((s) => s.id !== id),
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  autoRouteWire: (id) => {
    const { sheets, activeSheetId } = get();
    const activeSheet = sheets.find((s) => s.id === activeSheetId);
    if (!activeSheet) return;
    const wireIdx = activeSheet.wires.findIndex((w) => w.id === id);
    if (wireIdx === -1) return;
    const wire = activeSheet.wires[wireIdx];
    const p1 = resolvePinWorldPoint(
      activeSheet.components,
      activeSheet.cadAssets,
      wire.fromComponentId,
      wire.fromPinId
    );
    const p2 = resolvePinWorldPoint(
      activeSheet.components,
      activeSheet.cadAssets,
      wire.toComponentId,
      wire.toPinId
    );
    if (!p1 || !p2) return;

    pushHistory(sheets);
    const pts = routeWireThroughDucts(
      { x: p1.xMm, y: p1.yMm },
      { x: p2.xMm, y: p2.yMm },
      activeSheet.ducts,
      activeSheet.rails,
      wireIdx
    );
    const waypoints = pts.map((p) => ({ xMm: p.x, yMm: p.y }));
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            wires: s.wires.map((w) => (w.id === id ? { ...w, waypoints } : w)),
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  autoRouteAllWires: () => {
    const { sheets, activeSheetId } = get();
    const activeSheet = sheets.find((s) => s.id === activeSheetId);
    if (!activeSheet || activeSheet.wires.length === 0) return;
    pushHistory(sheets);
    const routedWires = activeSheet.wires.map((wire, idx) => {
      const p1 = resolvePinWorldPoint(
        activeSheet.components,
        activeSheet.cadAssets,
        wire.fromComponentId,
        wire.fromPinId
      );
      const p2 = resolvePinWorldPoint(
        activeSheet.components,
        activeSheet.cadAssets,
        wire.toComponentId,
        wire.toPinId
      );
      if (!p1 || !p2) return wire;
      const pts = routeWireThroughDucts(
        { x: p1.xMm, y: p1.yMm },
        { x: p2.xMm, y: p2.yMm },
        activeSheet.ducts,
        activeSheet.rails,
        idx
      );
      return {
        ...wire,
        waypoints: pts.map((p) => ({ xMm: p.x, yMm: p.y })),
      };
    });
    const updated = sheets.map((s) =>
      s.id === activeSheetId ? { ...s, wires: routedWires } : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  addRail: (customPos) => {
    const { sheets, activeSheetId, gridSnapMm, enclosure, plateConfig } = get();
    pushHistory(sheets);
    const activeSheet = sheets.find((s) => s.id === activeSheetId)!;
    const { rails } = activeSheet;
    const { widthMm } = getBackplateDimensions(enclosure, plateConfig);
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
    const updated = sheets.map((s) =>
      s.id === activeSheetId ? { ...s, rails: [...s.rails, newRail] } : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: { kind: "rail", id },
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  duplicateRail: (id, offsetMm = { x: 0, y: -120 }) => {
    const { sheets, activeSheetId, enclosure, plateConfig, gridSnapMm } = get();
    const activeSheet = sheets.find((s) => s.id === activeSheetId)!;
    const source = activeSheet.rails.find((r) => r.id === id);
    if (!source) return null;
    pushHistory(sheets);

    const { widthMm, heightMm } = getBackplateDimensions(enclosure, plateConfig);
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
      name: nextIncrementedName(source.name, activeSheet.rails.map((r) => r.name)),
      xMm: clamped.xMm,
      yMm: clamped.yMm,
    };
    const updated = sheets.map((s) =>
      s.id === activeSheetId ? { ...s, rails: [...s.rails, duplicated] } : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: { kind: "rail", id: newId },
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
    return newId;
  },

  updateRail: (id, partial) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            rails: s.rails.map((r) => (r.id === id ? { ...r, ...partial } : r)),
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  removeRail: (id) => {
    const { sheets, activeSheetId, selected, selectedIds } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            rails: s.rails.filter((r) => r.id !== id),
            components: s.components.map((c) =>
              c.railId === id ? { ...c, railId: null } : c
            ),
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: selected?.id === id ? null : selected,
      selectedIds: selectedIds.filter((s) => s.id !== id),
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  addDuct: (orientation = "horizontal", customPos) => {
    const { sheets, activeSheetId, enclosure, plateConfig, gridSnapMm } = get();
    pushHistory(sheets);
    const activeSheet = sheets.find((s) => s.id === activeSheetId)!;
    const { widthMm, heightMm } = getBackplateDimensions(enclosure, plateConfig);
    const id = makeUid("duct");
    const rawX = customPos ? snapToGrid(customPos.xMm, gridSnapMm) : 0;
    const rawY = customPos ? snapToGrid(customPos.yMm, gridSnapMm) : 0;
    const newDuct: WireDuct = {
      id,
      name: nextIncrementedName(
        orientation === "horizontal" ? "Horiz Duct" : "Vert Duct",
        activeSheet.ducts.map((d) => d.name)
      ),
      xMm: rawX,
      yMm: rawY,
      widthMm: orientation === "horizontal" ? Math.min(460, widthMm - 20) : 40,
      heightMm: orientation === "vertical" ? Math.min(500, heightMm - 40) : 40,
      depthMm: 60,
      orientation,
    };
    const updated = sheets.map((s) =>
      s.id === activeSheetId ? { ...s, ducts: [...s.ducts, newDuct] } : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: { kind: "duct", id },
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  duplicateDuct: (id, offsetMm) => {
    const { sheets, activeSheetId, enclosure, plateConfig, gridSnapMm } = get();
    const activeSheet = sheets.find((s) => s.id === activeSheetId)!;
    const source = activeSheet.ducts.find((d) => d.id === id);
    if (!source) return null;
    pushHistory(sheets);

    const defaultOffset =
      source.orientation === "vertical" ? { x: 80, y: 0 } : { x: 0, y: -120 };
    const effOffset = offsetMm ?? defaultOffset;
    const { widthMm, heightMm } = getBackplateDimensions(enclosure, plateConfig);
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
      name: nextIncrementedName(source.name, activeSheet.ducts.map((d) => d.name)),
      xMm: clamped.xMm,
      yMm: clamped.yMm,
    };
    const updated = sheets.map((s) =>
      s.id === activeSheetId ? { ...s, ducts: [...s.ducts, duplicated] } : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: { kind: "duct", id: newId },
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
    return newId;
  },

  updateDuct: (id, partial) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            ducts: s.ducts.map((d) => (d.id === id ? { ...d, ...partial } : d)),
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  removeDuct: (id) => {
    const { sheets, activeSheetId, selected, selectedIds } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? { ...s, ducts: s.ducts.filter((d) => d.id !== id) }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: selected?.id === id ? null : selected,
      selectedIds: selectedIds.filter((s) => s.id !== id),
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  alignComponentsOnRail: (railId, mode) => {
    const { sheets, activeSheetId } = get();
    const activeSheet = sheets.find((s) => s.id === activeSheetId)!;
    const targetRail = activeSheet.rails.find((r) => r.id === railId);
    if (!targetRail) return;

    const attached = activeSheet.components.filter((c) => c.railId === railId);
    if (attached.length === 0) return;
    pushHistory(sheets);

    const sorted = [...attached].sort((a, b) => a.xMm - b.xMm);
    const railLeft = targetRail.xMm - targetRail.lengthMm / 2;
    const railRight = targetRail.xMm + targetRail.lengthMm / 2;
    const totalCompWidth = sorted.reduce((sum, c) => {
      const dims = getRotatedDimensions(c.widthMm, c.heightMm, c.rotationDeg ?? 0);
      return sum + dims.widthMm;
    }, 0);

    const positions = new Map<string, number>();

    if (mode === "left") {
      let curX = railLeft + 15;
      for (const comp of sorted) {
        const dims = getRotatedDimensions(comp.widthMm, comp.heightMm, comp.rotationDeg ?? 0);
        positions.set(comp.id, curX + dims.widthMm / 2);
        curX += dims.widthMm + 6;
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
        const availableSpan = targetRail.lengthMm - 30;
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

    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            components: s.components.map((c) => {
              if (!positions.has(c.id)) return c;
              return {
                ...c,
                xMm: Number(positions.get(c.id)!.toFixed(2)),
                yMm: targetRail.yMm,
              };
            }),
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  addComponent: (templateId, nearYMm, customPos) => {
    const template = COMPONENT_CATALOG[templateId];
    if (!template) return;
    const { sheets, activeSheetId, gridSnapMm } = get();
    const activeSheet = sheets.find((s) => s.id === activeSheetId)!;
    pushHistory(sheets);

    let snapResult: { railId: string | null; xMm: number; yMm: number; zMm: number };
    const mounting = template.mountingType ?? "din_rail";
    if (mounting === "din_rail") {
      if (customPos) {
        snapResult = snapComponentToNearestRail(
          customPos.xMm,
          customPos.yMm,
          template.widthMm,
          template.depthMm,
          activeSheet.rails,
          gridSnapMm,
          35
        );
      } else {
        const targetY = nearYMm ?? (activeSheet.rails[0]?.yMm ?? 0);
        snapResult = snapComponentToNearestRail(
          0,
          targetY,
          template.widthMm,
          template.depthMm,
          activeSheet.rails,
          gridSnapMm
        );
      }
    } else {
      snapResult = {
        railId: null,
        xMm: snapToGrid(customPos?.xMm ?? 0, gridSnapMm),
        yMm: snapToGrid(customPos?.yMm ?? nearYMm ?? 0, gridSnapMm),
        zMm: template.depthMm / 2 + 2,
      };
    }

    const id = makeUid("comp");
    const newComponent: PlacedComponent = {
      id,
      templateId,
      name: nextIncrementedName(
        template.shortName,
        activeSheet.components.map((c) => c.name)
      ),
      mountingType: mounting,
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

    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? { ...s, components: [...s.components, newComponent] }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: { kind: "component", id },
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  rotateComponent: (id, deltaDeg = 90) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            components: s.components.map((c) => {
              if (c.id !== id) return c;
              const current = c.rotationDeg ?? 0;
              const nextDeg = (((current + deltaDeg) % 360) + 360) % 360 as RotationDeg;
              return { ...c, rotationDeg: nextDeg };
            }),
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  duplicateComponent: (id, offsetMm = { x: 20, y: 0 }) => {
    const { sheets, activeSheetId, gridSnapMm, enclosure, plateConfig } = get();
    const activeSheet = sheets.find((s) => s.id === activeSheetId)!;
    const source = activeSheet.components.find((c) => c.id === id);
    if (!source) return null;
    pushHistory(sheets);

    const newId = makeUid("comp");
    const targetX = source.xMm + offsetMm.x;
    const targetY = source.yMm + offsetMm.y;

    const snapResult = snapComponentToNearestRail(
      targetX,
      targetY,
      source.widthMm,
      source.depthMm,
      activeSheet.rails,
      gridSnapMm,
      source.railId ? 20 : Infinity
    );

    const { widthMm: plateW, heightMm: plateH } = getBackplateDimensions(
      enclosure,
      plateConfig
    );
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
      name: nextIncrementedName(source.name, activeSheet.components.map((c) => c.name)),
      xMm: clamped.xMm,
      yMm: clamped.yMm,
      zMm: snapResult.zMm,
      railId: snapResult.railId,
      pins: source.pins.map((p, idx) => ({
        ...p,
        id: `${newId}-pin-${idx + 1}`,
      })),
    };

    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? { ...s, components: [...s.components, duplicated] }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: { kind: "component", id: newId },
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
    return newId;
  },

  snapComponentToRail: (id) => {
    const { sheets, activeSheetId, gridSnapMm } = get();
    const activeSheet = sheets.find((s) => s.id === activeSheetId)!;
    const comp = activeSheet.components.find((c) => c.id === id);
    if (!comp) return;
    pushHistory(sheets);

    const snapResult = snapComponentToNearestRail(
      comp.xMm,
      comp.yMm,
      comp.widthMm,
      comp.depthMm,
      activeSheet.rails,
      gridSnapMm
    );

    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            components: s.components.map((c) =>
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
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  updateComponent: (id, partial) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            components: s.components.map((c) => (c.id === id ? { ...c, ...partial } : c)),
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  moveComponent: (id, targetXMm, targetYMm) => {
    const { sheets, activeSheetId, gridSnapMm, enclosure, plateConfig } = get();
    const activeSheet = sheets.find((s) => s.id === activeSheetId)!;
    const comp = activeSheet.components.find((c) => c.id === id);
    if (!comp) return;

    const snapResult = snapComponentToNearestRail(
      targetXMm,
      targetYMm,
      comp.widthMm,
      comp.depthMm,
      activeSheet.rails,
      gridSnapMm
    );

    const { widthMm: plateW, heightMm: plateH } = getBackplateDimensions(
      enclosure,
      plateConfig
    );
    const clamped = clampToBackplate(
      snapResult.xMm,
      snapResult.yMm,
      comp.widthMm,
      comp.heightMm,
      plateW,
      plateH
    );

    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            components: s.components.map((c) =>
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
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      ...syncActiveSheetProjection(active),
    });
  },

  removeComponent: (id) => {
    const { sheets, activeSheetId, selected, selectedIds } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            components: s.components.filter((c) => c.id !== id),
            wires: s.wires.filter(
              (w) => w.fromComponentId !== id && w.toComponentId !== id
            ),
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: selected?.id === id ? null : selected,
      selectedIds: selectedIds.filter((s) => s.id !== id),
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  addCadAsset: (asset) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId ? { ...s, cadAssets: [...s.cadAssets, asset] } : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: { kind: "cad", id: asset.id },
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  rotateCadAsset: (id, deltaDeg = 90) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            cadAssets: s.cadAssets.map((a) => {
              if (a.id !== id) return a;
              const current = a.rotationDeg ?? 0;
              const nextDeg = (((current + deltaDeg) % 360) + 360) % 360 as RotationDeg;
              return { ...a, rotationDeg: nextDeg };
            }),
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  duplicateCadAsset: (id, offsetMm = { x: 20, y: 0 }) => {
    const { sheets, activeSheetId, enclosure, plateConfig, gridSnapMm } = get();
    const activeSheet = sheets.find((s) => s.id === activeSheetId)!;
    const source = activeSheet.cadAssets.find((a) => a.id === id);
    if (!source) return null;
    pushHistory(sheets);

    const newId = makeUid("cad");
    const { widthMm: plateW, heightMm: plateH } = getBackplateDimensions(
      enclosure,
      plateConfig
    );
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
      name: nextIncrementedName(source.name, activeSheet.cadAssets.map((a) => a.name)),
      xMm: clamped.xMm,
      yMm: clamped.yMm,
      pins: source.pins.map((p, idx) => ({
        ...p,
        id: `${newId}-pin-${idx + 1}`,
      })),
    };

    const updated = sheets.map((s) =>
      s.id === activeSheetId ? { ...s, cadAssets: [...s.cadAssets, duplicated] } : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: { kind: "cad", id: newId },
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
    return newId;
  },

  updateCadAsset: (id, partial) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            cadAssets: s.cadAssets.map((a) => (a.id === id ? { ...a, ...partial } : a)),
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  moveCadAsset: (id, targetXMm, targetYMm) => {
    const { sheets, activeSheetId, gridSnapMm, enclosure, plateConfig } = get();
    const activeSheet = sheets.find((s) => s.id === activeSheetId)!;
    const asset = activeSheet.cadAssets.find((a) => a.id === id);
    if (!asset) return;

    const snapResult = snapComponentToNearestRail(
      targetXMm,
      targetYMm,
      asset.boundingBoxMm.w,
      asset.boundingBoxMm.d,
      activeSheet.rails,
      gridSnapMm,
      25
    );
    const { widthMm: plateW, heightMm: plateH } = getBackplateDimensions(
      enclosure,
      plateConfig
    );
    const clamped = clampToBackplate(
      snapResult.xMm,
      snapResult.yMm,
      asset.boundingBoxMm.w,
      asset.boundingBoxMm.h,
      plateW,
      plateH
    );

    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            cadAssets: s.cadAssets.map((a) =>
              a.id === id
                ? {
                    ...a,
                    xMm: clamped.xMm,
                    yMm: clamped.yMm,
                    zMm: snapResult.snappedToRail ? snapResult.zMm : a.zMm,
                  }
                : a
            ),
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      ...syncActiveSheetProjection(active),
    });
  },

  removeCadAsset: (id) => {
    const { sheets, activeSheetId, selected, isPinMarkingMode, activeMarkingAssetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            cadAssets: s.cadAssets.filter((a) => a.id !== id),
            wires: s.wires.filter(
              (w) => w.fromComponentId !== id && w.toComponentId !== id
            ),
          }
        : s
    );
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      selected: selected?.id === id ? null : selected,
      isPinMarkingMode: activeMarkingAssetId === id ? false : isPinMarkingMode,
      activeMarkingAssetId: activeMarkingAssetId === id ? null : activeMarkingAssetId,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  addPinToAsset: (assetId, pin) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) => {
      if (s.id !== activeSheetId) return s;
      return {
        ...s,
        cadAssets: s.cadAssets.map((a) => {
          if (a.id !== assetId) return a;
          const newPin: PinTerminal = {
            ...pin,
            id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          };
          return { ...a, pins: [...a.pins, newPin] };
        }),
      };
    });
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  removePinFromAsset: (assetId, pinId) => {
    const { sheets, activeSheetId } = get();
    pushHistory(sheets);
    const updated = sheets.map((s) => {
      if (s.id !== activeSheetId) return s;
      return {
        ...s,
        cadAssets: s.cadAssets.map((a) =>
          a.id === assetId
            ? { ...a, pins: a.pins.filter((p) => p.id !== pinId) }
            : a
        ),
      };
    });
    const active = updated.find((s) => s.id === activeSheetId)!;
    set({
      sheets: updated,
      canUndo: true,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  loadProjectState: (params) => {
    if (!params.sheets || params.sheets.length === 0) return;
    historyStack = { past: [], future: [] };
    const validActiveId =
      params.activeSheetId &&
      params.sheets.some((s) => s.id === params.activeSheetId)
        ? params.activeSheetId
        : params.sheets[0].id;
    const active = params.sheets.find((s) => s.id === validActiveId)!;

    set({
      sheets: params.sheets,
      activeSheetId: validActiveId,
      displayUnit: params.displayUnit ?? get().displayUnit,
      gridSnapMm: params.gridSnapMm ?? get().gridSnapMm,
      autoRouteDuctsEnabled:
        params.autoRouteDuctsEnabled ?? get().autoRouteDuctsEnabled,
      selected: null,
      selectedIds: [],
      isPinMarkingMode: false,
      activeMarkingAssetId: null,
      canUndo: false,
      canRedo: false,
      ...syncActiveSheetProjection(active),
    });
  },

  resetToDefaultProject: () => {
    historyStack = { past: [], future: [] };
    const defaultSheet = createDefaultSheet();
    set({
      sheets: [defaultSheet],
      activeSheetId: defaultSheet.id,
      displayUnit: "mm",
      gridSnapMm: 10,
      selected: null,
      selectedIds: [],
      isPinMarkingMode: false,
      activeMarkingAssetId: null,
      canUndo: false,
      canRedo: false,
      ...syncActiveSheetProjection(defaultSheet),
    });
  },
}));
