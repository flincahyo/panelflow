import { describe, expect, it } from "vitest";
import {
  computePlateRulerTicks,
  computeSelectionFootprint,
  getRulerStepMm,
  plateToWorldX,
  plateToWorldY,
  worldToPlateX,
  worldToPlateY,
} from "@/lib/ruler";
import type { PlacedComponent, SelectedTarget } from "@/types/panel";

describe("ruler plate-relative projection and footprint", () => {
  const plateW = 600;
  const plateH = 800;

  it("projects center world origin (0,0) to plate center (300, 400)", () => {
    expect(worldToPlateX(0, plateW)).toBe(300);
    expect(worldToPlateY(0, plateH)).toBe(400);
    expect(plateToWorldX(300, plateW)).toBe(0);
    expect(plateToWorldY(400, plateH)).toBe(0);
  });

  it("projects mounting plate top-left to plate (0, 0)", () => {
    // Mounting plate top-left in center-origin world coordinates:
    const worldTopLeftX = -plateW / 2; // -300
    const worldTopLeftY = plateH / 2; // +400

    expect(worldToPlateX(worldTopLeftX, plateW)).toBe(0);
    expect(worldToPlateY(worldTopLeftY, plateH)).toBe(0);

    expect(plateToWorldX(0, plateW)).toBe(worldTopLeftX);
    expect(plateToWorldY(0, plateH)).toBe(worldTopLeftY);
  });

  it("projects mounting plate bottom-right to plate (plateW, plateH)", () => {
    const worldBottomRightX = plateW / 2; // +300
    const worldBottomRightY = -plateH / 2; // -400

    expect(worldToPlateX(worldBottomRightX, plateW)).toBe(600);
    expect(worldToPlateY(worldBottomRightY, plateH)).toBe(800);

    expect(plateToWorldX(600, plateW)).toBe(worldBottomRightX);
    expect(plateToWorldY(800, plateH)).toBe(worldBottomRightY);
  });

  it("computes zoom-dependent step and ticks aligned to step multiples", () => {
    expect(getRulerStepMm(2.0)).toBe(25);
    expect(getRulerStepMm(1.0)).toBe(50);
    expect(getRulerStepMm(0.5)).toBe(100);

    const ticks = computePlateRulerTicks(-45, 120, 50);
    expect(ticks).toEqual([-50, 0, 50, 100, 150]);
  });

  it("calculates selection footprint correctly for a placed component", () => {
    // Component at world (0, 100) -> plateX = 300, plateY = 400 - 100 = 300
    // Component width 50, height 80 -> X span [275..325], Y span [260..340]
    const comp: PlacedComponent = {
      id: "comp-test-1",
      templateId: "mcb-1p",
      name: "MCB 1P",
      mountingType: "din_rail",
      railId: null,
      xMm: 0,
      yMm: 100,
      zMm: 10,
      widthMm: 50,
      heightMm: 80,
      depthMm: 60,
      color: "#fff",
      accentColor: "#f00",
      pins: [],
    };

    const selected: SelectedTarget = { kind: "component", id: "comp-test-1" };

    const footprint = computeSelectionFootprint({
      selected,
      selectedIds: [],
      components: [comp],
      cadAssets: [],
      rails: [],
      ducts: [],
      plateWidthMm: plateW,
      plateHeightMm: plateH,
    });

    expect(footprint).not.toBeNull();
    expect(footprint?.x1Mm).toBe(275);
    expect(footprint?.x2Mm).toBe(325);
    expect(footprint?.y1Mm).toBe(260);
    expect(footprint?.y2Mm).toBe(340);
    expect(footprint?.widthMm).toBe(50);
    expect(footprint?.heightMm).toBe(80);
  });
});
