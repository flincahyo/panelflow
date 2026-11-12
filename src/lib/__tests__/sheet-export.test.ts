import { describe, expect, it } from "vitest";
import { generateEplanSheetSvg, type TitleBlockMeta } from "../sheet-export";
import type {
  DinRail,
  EnclosureConfig,
  PlacedComponent,
  WireConnection,
  WireDuct,
} from "@/types/panel";

describe("sheet-export", () => {
  const enclosure: EnclosureConfig = {
    widthMm: 600,
    heightMm: 800,
    depthMm: 250,
    backplateInsetMm: 40,
    backplateThicknessMm: 2,
    wallThicknessMm: 2,
    doorMode: "transparent",
  };

  const rails: DinRail[] = [
    { id: "rail-1", name: "DIN-1", xMm: 0, yMm: 100, lengthMm: 400 },
  ];

  const ducts: WireDuct[] = [
    {
      id: "duct-1",
      name: "Top Duct",
      xMm: 0,
      yMm: 200,
      widthMm: 420,
      heightMm: 40,
      depthMm: 60,
      orientation: "horizontal",
    },
  ];

  const components: PlacedComponent[] = [
    {
      id: "comp-1",
      templateId: "mcb-1p",
      name: "F1",
      xMm: 0,
      yMm: 100,
      zMm: 42.5,
      railId: "rail-1",
      widthMm: 17.5,
      heightMm: 85,
      depthMm: 70,
      color: "#e2e6ed",
      accentColor: "#2563eb",
      pins: [
        { id: "p1", label: "L1", localXMm: 0, localYMm: 38, localZMm: 22 },
        { id: "p2", label: "T1", localXMm: 0, localYMm: -38, localZMm: 22 },
      ],
    },
  ];

  const wires: WireConnection[] = [
    {
      id: "w1",
      label: "F01",
      colorCode: "R",
      gaugeMm2: "2.5",
      fromComponentId: "comp-1",
      fromPinId: "p1",
      toComponentId: "comp-1",
      toPinId: "p2",
    },
  ];

  const meta: TitleBlockMeta = {
    projectName: "Main Distribution Panel",
    drawer: "Flints Studio",
    sheetNo: "1 / 1",
    date: "2026-11-12",
    scale: "1:1",
    rev: "A",
  };

  it("renders valid SVG with ISO/IEC plot frame and title block metadata", () => {
    const svg = generateEplanSheetSvg({
      enclosure,
      rails,
      ducts,
      components,
      cadAssets: [],
      wires,
      meta,
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("Main Distribution Panel");
    expect(svg).toContain("Flints Studio");
    expect(svg).toContain("1 / 1");
    expect(svg).toContain("1:1");
    expect(svg).toContain("F1");
    expect(svg).toContain("F01");
  });

  it("includes custom CAD assets with pins in SVG output", () => {
    const svg = generateEplanSheetSvg({
      enclosure,
      rails,
      ducts,
      components,
      cadAssets: [
        {
          id: "cad-1",
          name: "PLC-Module-FX3U",
          fileName: "PLC-Module-FX3U.dxf",
          format: "dxf",
          sourceUnit: "mm",
          xMm: 0,
          yMm: 0,
          zMm: 30,
          boundingBoxMm: { w: 100, h: 80, d: 40 },
          pins: [
            {
              id: "cp1",
              label: "24V",
              localXMm: -20,
              localYMm: 30,
              localZMm: 0,
            },
          ],
        },
      ],
      wires,
      meta,
    });
    expect(svg).toContain('data-id="cad-1"');
    expect(svg).toContain("PLC-Module-FX3U");
    expect(svg).toContain("24V");
  });
});
