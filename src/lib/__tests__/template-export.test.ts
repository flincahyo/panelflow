import { describe, expect, it } from "vitest";
import {
  computeDrillingHoles,
  generateDrillingDxf,
  generateDrillingSvg,
  getBackplateDimensions,
} from "@/lib/template-export";
import type { DinRail, EnclosureConfig, WireDuct } from "@/types/panel";

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
  { id: "r1", name: "DIN-1", xMm: 0, yMm: 150, lengthMm: 100 },
];

const ducts: WireDuct[] = [
  {
    id: "d1",
    name: "DUCT-1",
    xMm: 0,
    yMm: 260,
    widthMm: 150,
    heightMm: 40,
    depthMm: 60,
    orientation: "horizontal",
  },
];

describe("2D Drilling Template Generator (1:1 mm SVG & DXF)", () => {
  it("computes backplate dimensions from enclosure and inset", () => {
    expect(getBackplateDimensions(enclosure)).toEqual({
      widthMm: 520,
      heightMm: 720,
    });
  });

  it("computes DIN rail and wire duct mounting holes in plate coordinates", () => {
    const spec = computeDrillingHoles(enclosure, rails, ducts);
    expect(spec.backplateWidthMm).toBe(520);
    expect(spec.backplateHeightMm).toBe(720);

    const railHoles = spec.holes.filter((h) => h.kind === "din-rail");
    // 100mm rail: 12.5mm inset each side => x from -37.5 to +37.5 => 4 holes at 25mm pitch
    expect(railHoles).toHaveLength(4);
    expect(railHoles[0].diameterMm).toBe(5.5);
    expect(railHoles[0].yMm).toBe(510); // 720/2 + 150

    const ductHoles = spec.holes.filter((h) => h.kind === "wire-duct");
    // 150mm duct: 25mm inset each side => x from -50 to +50 => 3 holes at 50mm pitch
    expect(ductHoles).toHaveLength(3);
    expect(ductHoles[0].diameterMm).toBe(4.5);
    expect(ductHoles[0].yMm).toBe(620); // 720/2 + 260
  });

  it("generates valid 1:1 mm SVG with plate rect and hole circles", () => {
    const svg = generateDrillingSvg(enclosure, rails, ducts);
    expect(svg).toContain('width="520mm"');
    expect(svg).toContain('height="720mm"');
    expect(svg).toContain('viewBox="0 0 520 720"');
    expect(svg).toContain('rect x="0" y="0" width="520" height="720"');
    expect(svg).toContain('data-kind="din-rail"');
    expect(svg).toContain('data-kind="wire-duct"');
  });

  it("generates valid DXF with $INSUNITS=4 (mm), PLATE_OUTLINE, and CIRCLE entities", () => {
    const dxf = generateDrillingDxf(enclosure, rails, ducts);
    expect(dxf).toContain("$INSUNITS\n70\n4");
    expect(dxf).toContain("PLATE_OUTLINE");
    expect(dxf).toContain("DIN_RAIL_HOLES");
    expect(dxf).toContain("WIRE_DUCT_HOLES");
    expect(dxf).toContain("CIRCLE");
    expect(dxf.trim().endsWith("EOF")).toBe(true);
  });
});
