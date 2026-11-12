import { beforeEach, describe, expect, it } from "vitest";
import { rotateLocalPoint } from "@/lib/snap";
import { usePanelStore } from "@/store/usePanelStore";

describe("usePanelStore - Default 2D & Context Menu Actions", () => {
  const initialSnapshot = usePanelStore.getState();

  beforeEach(() => {
    usePanelStore.setState({
      viewportMode: "2d",
      canvasTool2D: "select",
      gridSnapMm: 10,
      rails: initialSnapshot.rails.map((r) => ({ ...r })),
      ducts: initialSnapshot.ducts.map((d) => ({ ...d })),
      components: initialSnapshot.components.map((c) => ({
        ...c,
        pins: c.pins.map((p) => ({ ...p })),
      })),
      cadAssets: [],
      wires: initialSnapshot.wires.map((w) => ({ ...w })),
      selected: null,
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
});
