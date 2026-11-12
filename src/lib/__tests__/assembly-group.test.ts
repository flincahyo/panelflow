import { beforeEach, describe, expect, it } from "vitest";
import { usePanelStore } from "@/store/usePanelStore";

describe("assembly-group-clipboard store tests", () => {
  beforeEach(() => {
    usePanelStore.getState().resetToDefaultProject();
    usePanelStore.setState({ clipboardItems: [], selectedIds: [], selected: null });
  });

  it("handles copy and paste with offset (+15, -15) and unique IDs", () => {
    const store = usePanelStore.getState();
    const activeSheet = store.sheets.find((s) => s.id === store.activeSheetId)!;
    expect(activeSheet.components.length).toBeGreaterThan(0);

    const compToCopy = activeSheet.components[0];
    store.setSelectedIds([{ kind: "component", id: compToCopy.id }]);
    const copiedCount = store.copySelectedToClipboard();
    expect(copiedCount).toBe(1);
    expect(usePanelStore.getState().clipboardItems.length).toBe(1);

    const pastedIds = store.pasteFromClipboard();
    expect(pastedIds.length).toBe(1);
    expect(pastedIds[0].id).not.toBe(compToCopy.id);

    const updatedSheet = usePanelStore.getState().sheets.find(
      (s) => s.id === store.activeSheetId
    )!;
    const pastedComp = updatedSheet.components.find((c) => c.id === pastedIds[0].id);
    expect(pastedComp).toBeDefined();
    expect(pastedComp?.name).not.toBe(compToCopy.name);
    expect(pastedComp?.pins.length).toBe(compToCopy.pins.length);
  });

  it("handles grouping and assembly co-movement", () => {
    const store = usePanelStore.getState();
    const activeSheet = store.sheets.find((s) => s.id === store.activeSheetId)!;
    expect(activeSheet.components.length).toBeGreaterThanOrEqual(2);

    const c1 = activeSheet.components[0];
    const c2 = activeSheet.components[1];

    store.setSelectedIds([
      { kind: "component", id: c1.id },
      { kind: "component", id: c2.id },
    ]);

    const groupId = store.groupSelectedItems();
    expect(groupId).toBeDefined();

    const sheetAfterGroup = usePanelStore.getState().sheets.find(
      (s) => s.id === store.activeSheetId
    )!;
    const groupedC1 = sheetAfterGroup.components.find((c) => c.id === c1.id);
    const groupedC2 = sheetAfterGroup.components.find((c) => c.id === c2.id);

    expect(groupedC1?.groupId).toBe(groupId);
    expect(groupedC2?.groupId).toBe(groupId);

    // Moving c1 along X on rail should co-move c2
    const initialC1X = groupedC1!.xMm;
    const initialC1Y = groupedC1!.yMm;
    const initialC2X = groupedC2!.xMm;
    const initialC2Y = groupedC2!.yMm;
    const moveDx = 30;

    store.moveComponent(c1.id, initialC1X + moveDx, initialC1Y);

    const sheetAfterMove = usePanelStore.getState().sheets.find(
      (s) => s.id === store.activeSheetId
    )!;
    const movedC1 = sheetAfterMove.components.find((c) => c.id === c1.id)!;
    const movedC2 = sheetAfterMove.components.find((c) => c.id === c2.id)!;

    expect(movedC1.xMm).toBeCloseTo(initialC1X + moveDx, 1);
    expect(movedC1.yMm).toBe(initialC1Y);
    expect(movedC2.xMm).toBeCloseTo(initialC2X + moveDx, 1);
    expect(movedC2.yMm).toBe(initialC2Y);

    // Ungroup
    store.setSelectedIds([{ kind: "component", id: c1.id }]);
    store.ungroupSelectedItems();

    const sheetAfterUngroup = usePanelStore.getState().sheets.find(
      (s) => s.id === store.activeSheetId
    )!;
    const ungroundC1 = sheetAfterUngroup.components.find((c) => c.id === c1.id)!;
    const ungroundC2 = sheetAfterUngroup.components.find((c) => c.id === c2.id)!;
    expect(ungroundC1.groupId).toBeUndefined();
    expect(ungroundC2.groupId).toBeUndefined();
  });

  it("respects lock state on items preventing move", () => {
    const store = usePanelStore.getState();
    const activeSheet = store.sheets.find((s) => s.id === store.activeSheetId)!;
    const c1 = activeSheet.components[0];

    store.setSelectedIds([{ kind: "component", id: c1.id }]);
    store.toggleLockSelectedItems(true);

    const sheetLocked = usePanelStore.getState().sheets.find(
      (s) => s.id === store.activeSheetId
    )!;
    expect(sheetLocked.components.find((c) => c.id === c1.id)?.locked).toBe(true);

    // Attempt to move locked component
    const origX = c1.xMm;
    const origY = c1.yMm;
    store.moveComponent(c1.id, origX + 50, origY + 50);

    const sheetAfterAttempt = usePanelStore.getState().sheets.find(
      (s) => s.id === store.activeSheetId
    )!;
    const notMovedC1 = sheetAfterAttempt.components.find((c) => c.id === c1.id)!;
    expect(notMovedC1.xMm).toBe(origX);
    expect(notMovedC1.yMm).toBe(origY);
  });
});
