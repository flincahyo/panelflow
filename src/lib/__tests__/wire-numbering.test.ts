import { describe, expect, it } from "vitest";
import { autoNumberSheetWires, generateWireNumbers } from "../wire-numbering";
import type { PanelSheet, WireConnection } from "@/types/panel";

describe("Auto Wire Numbering Engine (EPLAN standard)", () => {
  it("assigns sequential EPLAN numbers per phase / signal type", () => {
    const rawWires: WireConnection[] = [
      {
        id: "w1",
        label: "wire-1",
        colorCode: "R",
        gaugeMm2: "2.5",
        fromComponentId: "c1",
        fromPinId: "p1",
        toComponentId: "c2",
        toPinId: "p2",
      },
      {
        id: "w2",
        label: "wire-2",
        colorCode: "R",
        gaugeMm2: "2.5",
        fromComponentId: "c1",
        fromPinId: "p2",
        toComponentId: "c2",
        toPinId: "p3",
      },
      {
        id: "w3",
        label: "wire-3",
        colorCode: "S",
        gaugeMm2: "2.5",
        fromComponentId: "c1",
        fromPinId: "p3",
        toComponentId: "c2",
        toPinId: "p4",
      },
      {
        id: "w4",
        label: "wire-4",
        colorCode: "N",
        gaugeMm2: "1.5",
        fromComponentId: "c1",
        fromPinId: "p4",
        toComponentId: "c2",
        toPinId: "p5",
      },
      {
        id: "w5",
        label: "wire-5",
        colorCode: "PE",
        gaugeMm2: "2.5",
        fromComponentId: "c1",
        fromPinId: "p5",
        toComponentId: "c2",
        toPinId: "p6",
      },
      {
        id: "w6",
        label: "wire-6",
        colorCode: "DC+",
        gaugeMm2: "0.75",
        fromComponentId: "c1",
        fromPinId: "p6",
        toComponentId: "c2",
        toPinId: "p7",
      },
    ];

    const numbered = generateWireNumbers(rawWires);
    expect(numbered[0].label).toBe("L1-1");
    expect(numbered[1].label).toBe("L1-2");
    expect(numbered[2].label).toBe("L2-1");
    expect(numbered[3].label).toBe("N-1");
    expect(numbered[4].label).toBe("PE-1");
    expect(numbered[5].label).toBe("+24V-1");
  });

  it("supports numeric-seq control format W01, W02...", () => {
    const rawWires: WireConnection[] = [
      {
        id: "w1",
        label: "raw",
        colorCode: "DC+",
        gaugeMm2: "0.75",
        fromComponentId: "c1",
        fromPinId: "p1",
        toComponentId: "c2",
        toPinId: "p2",
      },
    ];

    const numbered = generateWireNumbers(rawWires, {
      controlFormat: "numeric-seq",
    });
    expect(numbered[0].label).toBe("W01");
  });

  it("auto numbers wires in an entire panel sheet", () => {
    const sheet: PanelSheet = {
      id: "sheet-1",
      name: "Main Panel",
      sheetType: "mounting-plate",
      enclosure: {
        widthMm: 600,
        heightMm: 800,
        depthMm: 250,
        backplateInsetMm: 20,
        backplateThicknessMm: 2,
        wallThicknessMm: 1.5,
        doorMode: "transparent",
      },
      plateConfig: { mode: "auto", manualWidthMm: 500, manualHeightMm: 700 },
      rails: [],
      ducts: [],
      components: [],
      cadAssets: [],
      wires: [
        {
          id: "w1",
          label: "raw-wire",
          colorCode: "T",
          gaugeMm2: "4.0",
          fromComponentId: "c1",
          fromPinId: "p1",
          toComponentId: "c2",
          toPinId: "p2",
        },
      ],
      titleBlock: {
        projectName: "Test",
        drawer: "Tester",
        sheetNo: "01",
        date: "2026-11-13",
        scale: "1:1",
        rev: "A",
      },
    };

    const updatedSheet = autoNumberSheetWires(sheet);
    expect(updatedSheet.wires[0].label).toBe("L3-1");
  });
});
