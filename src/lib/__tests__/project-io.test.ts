import { describe, it, expect } from "vitest";
import {
  serializeProject,
  deserializeProject,
  validateProjectSchema,
  PANEL_FLOW_FILE_EXTENSION,
  PANEL_FLOW_SCHEMA_VERSION,
} from "../project-io";
import type { PanelSheet } from "@/types/panel";

describe("project-io", () => {
  const dummySheet: PanelSheet = {
    id: "sheet-1",
    name: "Sheet 1 (Mounting Plate)",
    sheetType: "mounting-plate",
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
    rails: [{ id: "rail-1", name: "DIN-1", xMm: 0, yMm: 100, lengthMm: 400 }],
    ducts: [{
      id: "duct-1",
      name: "Top Duct",
      xMm: 0,
      yMm: 200,
      widthMm: 400,
      heightMm: 40,
      depthMm: 60,
      orientation: "horizontal",
    }],
    components: [{
      id: "comp-1",
      templateId: "mcb-1p",
      name: "MCB 1",
      xMm: 0,
      yMm: 100,
      zMm: 35,
      railId: "rail-1",
      widthMm: 17.5,
      heightMm: 85,
      depthMm: 70,
      color: "#e2e6ed",
      accentColor: "#2563eb",
      pins: [{ id: "p1", label: "1", localXMm: 0, localYMm: 38, localZMm: 22 }],
    }],
    cadAssets: [{
      id: "cad-1",
      name: "Custom Breaker",
      fileName: "custom.dxf",
      format: "dxf",
      sourceUnit: "mm",
      xMm: 0,
      yMm: 0,
      zMm: 20,
      boundingBoxMm: { w: 50, h: 50, d: 20 },
      pins: [],
      rawText: "0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF",
    }],
    wires: [{
      id: "w-1",
      label: "W1",
      colorCode: "R",
      gaugeMm2: "2.5",
      fromComponentId: "comp-1",
      fromPinId: "p1",
      toComponentId: "comp-1",
      toPinId: "p1",
    }],
    titleBlock: {
      projectName: "Test Project",
      drawer: "Flints Studio",
      sheetNo: "1/1",
      date: "2026-11-12",
      scale: "1:1",
      rev: "A",
    },
  };

  it("exports constants", () => {
    expect(PANEL_FLOW_FILE_EXTENSION).toBe(".pflow");
    expect(PANEL_FLOW_SCHEMA_VERSION).toBe(1);
  });

  it("serializes and deserializes a project losslessly", () => {
    const serialized = serializeProject({
      sheets: [dummySheet],
      activeSheetId: "sheet-1",
      displayUnit: "mm",
      titleBlock: dummySheet.titleBlock,
    });

    expect(typeof serialized).toBe("string");
    const json = JSON.parse(serialized);
    expect(json.version).toBe(PANEL_FLOW_SCHEMA_VERSION);
    expect(json.sheets).toHaveLength(1);
    expect(json.sheets[0].cadAssets[0].rawText).toContain("SECTION");

    const validated = validateProjectSchema(json);
    expect(validated.valid).toBe(true);

    const project = deserializeProject(serialized);
    expect(project.sheets).toHaveLength(1);
    expect(project.activeSheetId).toBe("sheet-1");
    expect(project.sheets[0].components[0].name).toBe("MCB 1");
    expect(project.sheets[0].cadAssets[0].rawText).toContain("SECTION");
  });

  it("rejects invalid project json schema", () => {
    const invalid1 = validateProjectSchema(null);
    expect(invalid1.valid).toBe(false);

    const invalid2 = validateProjectSchema({ version: 99 });
    expect(invalid2.valid).toBe(false);

    const invalid3 = validateProjectSchema({ version: 1, sheets: [] });
    expect(invalid3.valid).toBe(false);
  });
});
