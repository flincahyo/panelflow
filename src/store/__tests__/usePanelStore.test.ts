import { beforeEach, describe, expect, it } from "vitest";
import { rotateLocalPoint } from "@/lib/snap";
import { usePanelStore } from "@/store/usePanelStore";

describe("usePanelStore - Default 2D & Context Menu Actions", () => {
  const initialSnapshot = usePanelStore.getState();

  beforeEach(() => {
    const freshSheet = initialSnapshot.sheets[0];
    const clonedSheet = {
      ...freshSheet,
      rails: freshSheet.rails.map((r) => ({ ...r })),
      ducts: freshSheet.ducts.map((d) => ({ ...d })),
      components: freshSheet.components.map((c) => ({
        ...c,
        pins: c.pins.map((p) => ({ ...p })),
      })),
      cadAssets: [],
      wires: freshSheet.wires.map((w) => ({ ...w })),
    };
    usePanelStore.setState({
      sheets: [clonedSheet],
      activeSheetId: clonedSheet.id,
      viewportMode: "2d",
      canvasTool2D: "select",
      gridSnapMm: 10,
      enclosure: clonedSheet.enclosure,
      plateConfig: clonedSheet.plateConfig,
      rails: clonedSheet.rails,
      ducts: clonedSheet.ducts,
      components: clonedSheet.components,
      cadAssets: clonedSheet.cadAssets,
      wires: clonedSheet.wires,
      titleBlock: clonedSheet.titleBlock,
      selected: null,
      selectedIds: [],
    });
  });

  it("defaults viewportMode to 2d", () => {
    expect(usePanelStore.getState().viewportMode).toBe("2d");
  });

  it("rotates component by 90 degrees modulo 360 and transforms pin coordinates", () => {
    const store = usePanelStore.getState();
    const targetId = "comp-1";

    expect(store.components.find((c) => c.id === targetId)?.rotationDeg ?? 0).toBe(0);

    store.rotateComponent(targetId, 90);
    expect(usePanelStore.getState().components.find((c) => c.id === targetId)?.rotationDeg).toBe(90);

    store.rotateComponent(targetId, 90);
    expect(usePanelStore.getState().components.find((c) => c.id === targetId)?.rotationDeg).toBe(180);

    store.rotateComponent(targetId, 90);
    expect(usePanelStore.getState().components.find((c) => c.id === targetId)?.rotationDeg).toBe(270);

    store.rotateComponent(targetId, 90);
    expect(usePanelStore.getState().components.find((c) => c.id === targetId)?.rotationDeg).toBe(0);

    expect(rotateLocalPoint(10, 20, 0)).toEqual({ xMm: 10, yMm: 20 });
    expect(rotateLocalPoint(10, 20, 90)).toEqual({ xMm: 20, yMm: -10 });
    expect(rotateLocalPoint(10, 20, 180)).toEqual({ xMm: -10, yMm: -20 });
    expect(rotateLocalPoint(10, 20, 270)).toEqual({ xMm: -20, yMm: 10 });
  });

  it("duplicates component with auto-incremented name, +20mm X offset, and new pin IDs", () => {
    const store = usePanelStore.getState();
    const source = store.components.find((c) => c.id === "comp-4")!; // Motor Contactor KM1
    const beforeCount = store.components.length;

    const newId = store.duplicateComponent(source.id, { x: 20, y: 0 });
    expect(newId).toBeTruthy();

    const state = usePanelStore.getState();
    expect(state.components.length).toBe(beforeCount + 1);
    const dup = state.components.find((c) => c.id === newId)!;
    expect(dup.name).toBe("Motor Contactor KM2");
    expect(dup.xMm).toBe(source.xMm + 20);
    expect(dup.yMm).toBe(source.yMm);
    expect(dup.pins.length).toBe(source.pins.length);
    expect(dup.pins[0].id).not.toBe(source.pins[0].id);
    expect(state.selected).toEqual({ kind: "component", id: newId });
  });

  it("removes component along with all connected wires", () => {
    const store = usePanelStore.getState();
    expect(store.wires.some((w) => w.fromComponentId === "comp-1" || w.toComponentId === "comp-1")).toBe(true);

    store.removeComponent("comp-1");
    const state = usePanelStore.getState();
    expect(state.components.find((c) => c.id === "comp-1")).toBeUndefined();
    expect(state.wires.some((w) => w.fromComponentId === "comp-1" || w.toComponentId === "comp-1")).toBe(false);
  });

  it("duplicates DIN rail and wire ducts with parallel offsets", () => {
    const store = usePanelStore.getState();
    const rail = store.rails[0]; // yMm: 200
    const newRailId = store.duplicateRail(rail.id, { x: 0, y: -120 });
    expect(newRailId).toBeTruthy();
    const dupRail = usePanelStore.getState().rails.find((r) => r.id === newRailId)!;
    expect(dupRail.yMm).toBe(rail.yMm - 120);

    const hDuct = store.ducts.find((d) => d.orientation === "horizontal")!;
    const newHDuctId = store.duplicateDuct(hDuct.id);
    const dupHDuct = usePanelStore.getState().ducts.find((d) => d.id === newHDuctId)!;
    expect(dupHDuct.yMm).toBe(hDuct.yMm - 120);

    const vDuct = store.ducts.find((d) => d.id === "duct-v-left")!; // xMm: -230
    const newVDuctId = store.duplicateDuct(vDuct.id);
    const dupVDuct = usePanelStore.getState().ducts.find((d) => d.id === newVDuctId)!;
    expect(dupVDuct.xMm).toBe(vDuct.xMm + 80);
  });

  it("aligns components on a DIN rail (left, center, right, distribute)", () => {
    const store = usePanelStore.getState();
    const railId = "rail-1";
    const rail = store.rails.find((r) => r.id === railId)!;

    // Left align
    store.alignComponentsOnRail(railId, "left");
    let onRail = usePanelStore
      .getState()
      .components.filter((c) => c.railId === railId)
      .sort((a, b) => a.xMm - b.xMm);
    const railLeft = rail.xMm - rail.lengthMm / 2;
    expect(onRail[0].xMm).toBeCloseTo(railLeft + 15 + onRail[0].widthMm / 2, 1);

    // Center align
    store.alignComponentsOnRail(railId, "center");
    onRail = usePanelStore
      .getState()
      .components.filter((c) => c.railId === railId)
      .sort((a, b) => a.xMm - b.xMm);
    const centerMid = (onRail[0].xMm - onRail[0].widthMm / 2 + (onRail[onRail.length - 1].xMm + onRail[onRail.length - 1].widthMm / 2)) / 2;
    expect(centerMid).toBeCloseTo(rail.xMm, 1);

    // Distribute evenly
    store.alignComponentsOnRail(railId, "distribute");
    onRail = usePanelStore
      .getState()
      .components.filter((c) => c.railId === railId)
      .sort((a, b) => a.xMm - b.xMm);
    const railRight = rail.xMm + rail.lengthMm / 2;
    expect(onRail[0].xMm - onRail[0].widthMm / 2).toBeCloseTo(railLeft + 15, 1);
    expect(onRail[onRail.length - 1].xMm + onRail[onRail.length - 1].widthMm / 2).toBeCloseTo(railRight - 15, 1);
  });

  it("updates wire color and gauge and adds items at custom cursor positions", () => {
    const store = usePanelStore.getState();
    store.updateWire("wire-1", { colorCode: "PE", gaugeMm2: "6.0" });
    const updatedWire = usePanelStore.getState().wires.find((w) => w.id === "wire-1")!;
    expect(updatedWire.colorCode).toBe("PE");
    expect(updatedWire.gaugeMm2).toBe("6.0");

    const beforeComps = usePanelStore.getState().components.length;
    store.addComponent("mcb-1p", undefined, { xMm: 123, yMm: 195 });
    const afterComps = usePanelStore.getState().components;
    expect(afterComps.length).toBe(beforeComps + 1);
    const added = afterComps[afterComps.length - 1];
    expect(added.railId).toBe("rail-1");
    expect(added.xMm).toBe(120); // snapped to 10mm grid
  });

  it("supports multi-sheet add, switch, rename, duplicate, and delete (min 1 sheet)", () => {
    const store = usePanelStore.getState();
    expect(store.sheets.length).toBe(1);
    const firstId = store.activeSheetId;

    // Cannot delete the last remaining sheet
    store.deleteSheet(firstId);
    expect(usePanelStore.getState().sheets.length).toBe(1);

    // Add a schematic sheet and switch to it automatically
    const secId = store.addSheet("schematic", "Control Schematic");
    let state = usePanelStore.getState();
    expect(state.sheets.length).toBe(2);
    expect(state.activeSheetId).toBe(secId);
    expect(state.components.length).toBe(0); // new sheet starts clean

    // Rename sheet
    state.renameSheet(secId, "Main Schematic");
    expect(usePanelStore.getState().sheets.find((s) => s.id === secId)?.name).toBe("Main Schematic");

    // Duplicate first sheet
    const dupId = state.duplicateSheet(firstId)!;
    state = usePanelStore.getState();
    expect(state.sheets.length).toBe(3);
    expect(state.activeSheetId).toBe(dupId);
    expect(state.components.length).toBeGreaterThan(0);

    // Switch back to first sheet
    state.setActiveSheet(firstId);
    expect(usePanelStore.getState().activeSheetId).toBe(firstId);

    // Delete duplicated sheet
    state.deleteSheet(dupId);
    expect(usePanelStore.getState().sheets.length).toBe(2);
  });

  it("supports undo and redo with max 30 history steps", () => {
    const store = usePanelStore.getState();
    const initialCount = store.components.length;

    store.addComponent("mcb-1p");
    expect(usePanelStore.getState().components.length).toBe(initialCount + 1);
    expect(usePanelStore.getState().canUndo).toBe(true);

    store.undo();
    expect(usePanelStore.getState().components.length).toBe(initialCount);
    expect(usePanelStore.getState().canRedo).toBe(true);

    store.redo();
    expect(usePanelStore.getState().components.length).toBe(initialCount + 1);

    // Exceed 30 steps: cap at 30 undos
    for (let i = 0; i < 35; i++) {
      usePanelStore.getState().addRail();
    }
    let undoCount = 0;
    while (usePanelStore.getState().canUndo && undoCount < 40) {
      usePanelStore.getState().undo();
      undoCount += 1;
    }
    expect(undoCount).toBe(30);
    expect(usePanelStore.getState().canUndo).toBe(false);
  });

  it("switches theme between light and dark", () => {
    const store = usePanelStore.getState();
    expect(store.theme).toBe("light");

    store.setTheme("dark");
    expect(usePanelStore.getState().theme).toBe("dark");

    store.toggleTheme();
    expect(usePanelStore.getState().theme).toBe("light");
  });

  it("supports multi-selection via setSelectedIds, toggleSelectId, and clearSelection", () => {
    const store = usePanelStore.getState();

    store.setSelectedIds([
      { kind: "component", id: "comp-1" },
      { kind: "component", id: "comp-2" },
    ]);
    expect(usePanelStore.getState().selectedIds).toHaveLength(2);
    expect(usePanelStore.getState().selected).toEqual({ kind: "component", id: "comp-1" });

    // Shift+Click toggle adds comp-3
    store.toggleSelectId({ kind: "component", id: "comp-3" });
    expect(usePanelStore.getState().selectedIds).toHaveLength(3);

    // Shift+Click toggle removes comp-2
    store.toggleSelectId({ kind: "component", id: "comp-2" });
    expect(usePanelStore.getState().selectedIds).toEqual([
      { kind: "component", id: "comp-1" },
      { kind: "component", id: "comp-3" },
    ]);

    store.clearSelection();
    expect(usePanelStore.getState().selectedIds).toEqual([]);
    expect(usePanelStore.getState().selected).toBeNull();
  });

  it("moves all selected items together with moveSelectedItems and clamps to backplate", () => {
    const store = usePanelStore.getState();
    const c1Before = store.components.find((c) => c.id === "comp-1")!;
    const c3Before = store.components.find((c) => c.id === "comp-3")!;

    store.setSelectedIds([
      { kind: "component", id: "comp-1" },
      { kind: "component", id: "comp-3" },
    ]);

    store.moveSelectedItems(30, -20);
    const state = usePanelStore.getState();
    const c1After = state.components.find((c) => c.id === "comp-1")!;
    const c3After = state.components.find((c) => c.id === "comp-3")!;
    const c2After = state.components.find((c) => c.id === "comp-2")!;

    expect(c1After.xMm).toBe(c1Before.xMm + 30);
    expect(c1After.yMm).toBe(c1Before.yMm - 20);
    expect(c3After.xMm).toBe(c3Before.xMm + 30);
    expect(c3After.yMm).toBe(c3Before.yMm - 20);
    // Unselected component stays put
    expect(c2After.xMm).toBe(-100);
  });

  it("deletes all selected items and connected wires in one undoable batch", () => {
    const store = usePanelStore.getState();
    const initialCompCount = store.components.length;
    expect(store.wires.length).toBeGreaterThan(0);

    store.setSelectedIds([
      { kind: "component", id: "comp-1" },
      { kind: "component", id: "comp-3" },
    ]);

    store.deleteSelectedItems();
    let state = usePanelStore.getState();
    expect(state.components.length).toBe(initialCompCount - 2);
    expect(state.components.find((c) => c.id === "comp-1")).toBeUndefined();
    expect(state.components.find((c) => c.id === "comp-3")).toBeUndefined();
    // Both wire-1 (from comp-1) and wire-2 (from comp-3) should be removed
    expect(state.wires).toHaveLength(0);
    expect(state.selectedIds).toEqual([]);
    expect(state.selected).toBeNull();
    expect(state.canUndo).toBe(true);

    // Undo restores both components and their wires
    state.undo();
    state = usePanelStore.getState();
    expect(state.components.length).toBe(initialCompCount);
    expect(state.wires.length).toBeGreaterThan(0);
  });

  it("aligns selected items (left, center, top)", () => {
    const store = usePanelStore.getState();
    store.setSelectedIds([
      { kind: "component", id: "comp-1" },
      { kind: "component", id: "comp-4" },
    ]);

    store.alignSelectedItems("left");
    let state = usePanelStore.getState();
    const c1 = state.components.find((c) => c.id === "comp-1")!;
    const c4 = state.components.find((c) => c.id === "comp-4")!;
    expect(c1.xMm - c1.widthMm / 2).toBeCloseTo(c4.xMm - c4.widthMm / 2, 1);

    store.alignSelectedItems("top");
    state = usePanelStore.getState();
    const c1Top = state.components.find((c) => c.id === "comp-1")!;
    const c4Top = state.components.find((c) => c.id === "comp-4")!;
    expect(c1Top.yMm + c1Top.heightMm / 2).toBeCloseTo(
      c4Top.yMm + c4Top.heightMm / 2,
      1
    );
  });

  it("controls inspector visibility and tab switching between inspector and bom", () => {
    const store = usePanelStore.getState();
    expect(store.inspectorOpen).toBe(true);
    expect(store.rightPanelTab).toBe("inspector");

    store.setRightPanelTab("bom");
    expect(usePanelStore.getState().rightPanelTab).toBe("bom");

    store.setInspectorOpen(false);
    expect(usePanelStore.getState().inspectorOpen).toBe(false);

    // requestInspectorFocus reopens inspector and switches to inspector tab
    store.requestInspectorFocus();
    expect(usePanelStore.getState().inspectorOpen).toBe(true);
    expect(usePanelStore.getState().rightPanelTab).toBe("inspector");
  });

  it("manages favorite and recent parts with max limit of 8 items", () => {
    const store = usePanelStore.getState();
    usePanelStore.setState({
      favoritePartIds: [],
      recentPartIds: [],
    });

    // Toggle favorite
    store.toggleFavoritePart("mcb-1p");
    expect(usePanelStore.getState().favoritePartIds).toEqual(["mcb-1p"]);

    store.toggleFavoritePart("contactor");
    expect(usePanelStore.getState().favoritePartIds).toEqual(["contactor", "mcb-1p"]);

    store.toggleFavoritePart("mcb-1p");
    expect(usePanelStore.getState().favoritePartIds).toEqual(["contactor"]);

    // Recent parts pushing and capping at 8 items
    const parts = [
      "mcb-1p",
      "mcb-2p",
      "mcb-3p",
      "mcb-4p",
      "mccb-100a",
      "contactor",
      "tor",
      "psu-24v",
      "terminal-block",
    ] as const;

    for (const p of parts) {
      store.addRecentPart(p);
    }

    const state = usePanelStore.getState();
    expect(state.recentPartIds.length).toBe(8);
    // Most recent is at front
    expect(state.recentPartIds[0]).toBe("terminal-block");
    // Oldest 'mcb-1p' was dropped
    expect(state.recentPartIds.includes("mcb-1p")).toBe(false);

    // Adding existing moves it to top
    store.addRecentPart("mcb-2p");
    expect(usePanelStore.getState().recentPartIds[0]).toBe("mcb-2p");
    expect(usePanelStore.getState().recentPartIds.length).toBe(8);
  });
});
