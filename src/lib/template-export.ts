import type { DinRail, EnclosureConfig, WireDuct } from "@/types/panel";

export interface DrillingHole {
  xMm: number; // 0 = backplate left edge
  yMm: number; // 0 = backplate bottom edge
  diameterMm: number;
  kind: "din-rail" | "wire-duct";
  sourceName: string;
}

export interface BackplateLayoutSpec {
  backplateWidthMm: number;
  backplateHeightMm: number;
  holes: DrillingHole[];
}

export function getBackplateDimensions(enclosure: EnclosureConfig): {
  widthMm: number;
  heightMm: number;
} {
  return {
    widthMm: Math.max(100, enclosure.widthMm - enclosure.backplateInsetMm * 2),
    heightMm: Math.max(100, enclosure.heightMm - enclosure.backplateInsetMm * 2),
  };
}

export function computeDrillingHoles(
  enclosure: EnclosureConfig,
  rails: DinRail[],
  ducts: WireDuct[]
): BackplateLayoutSpec {
  const { widthMm: backplateWidthMm, heightMm: backplateHeightMm } =
    getBackplateDimensions(enclosure);
  const holes: DrillingHole[] = [];

  const toPlateX = (centerX: number) => centerX + backplateWidthMm / 2;
  const toPlateY = (centerY: number) => centerY + backplateHeightMm / 2;

  for (const rail of rails) {
    const startX = toPlateX(rail.xMm - rail.lengthMm / 2 + 12.5);
    const endX = toPlateX(rail.xMm + rail.lengthMm / 2 - 12.5);
    const y = toPlateY(rail.yMm);

    if (endX <= startX) {
      holes.push({
        xMm: Number(toPlateX(rail.xMm).toFixed(2)),
        yMm: Number(y.toFixed(2)),
        diameterMm: 5.5,
        kind: "din-rail",
        sourceName: rail.name,
      });
      continue;
    }

    const pitch = 25;
    for (let x = startX; x <= endX + 0.01; x += pitch) {
      holes.push({
        xMm: Number(x.toFixed(2)),
        yMm: Number(y.toFixed(2)),
        diameterMm: 5.5,
        kind: "din-rail",
        sourceName: rail.name,
      });
    }
  }

  for (const duct of ducts) {
    const cx = toPlateX(duct.xMm);
    const cy = toPlateY(duct.yMm);
    const pitch = 50;

    if (duct.orientation === "horizontal") {
      const startX = cx - duct.widthMm / 2 + 25;
      const endX = cx + duct.widthMm / 2 - 25;
      if (endX <= startX) {
        holes.push({
          xMm: Number(cx.toFixed(2)),
          yMm: Number(cy.toFixed(2)),
          diameterMm: 4.5,
          kind: "wire-duct",
          sourceName: duct.name,
        });
      } else {
        for (let x = startX; x <= endX + 0.01; x += pitch) {
          holes.push({
            xMm: Number(x.toFixed(2)),
            yMm: Number(cy.toFixed(2)),
            diameterMm: 4.5,
            kind: "wire-duct",
            sourceName: duct.name,
          });
        }
      }
    } else {
      const startY = cy - duct.heightMm / 2 + 25;
      const endY = cy + duct.heightMm / 2 - 25;
      if (endY <= startY) {
        holes.push({
          xMm: Number(cx.toFixed(2)),
          yMm: Number(cy.toFixed(2)),
          diameterMm: 4.5,
          kind: "wire-duct",
          sourceName: duct.name,
        });
      } else {
        for (let y = startY; y <= endY + 0.01; y += pitch) {
          holes.push({
            xMm: Number(cx.toFixed(2)),
            yMm: Number(y.toFixed(2)),
            diameterMm: 4.5,
            kind: "wire-duct",
            sourceName: duct.name,
          });
        }
      }
    }
  }

  return { backplateWidthMm, backplateHeightMm, holes };
}

export function generateDrillingSvg(
  enclosure: EnclosureConfig,
  rails: DinRail[],
  ducts: WireDuct[]
): string {
  const { backplateWidthMm, backplateHeightMm, holes } = computeDrillingHoles(
    enclosure,
    rails,
    ducts
  );

  // SVG Y axis points down, so flip Y: svgY = backplateHeightMm - hole.yMm
  const holeElements = holes
    .map((h) => {
      const r = (h.diameterMm / 2).toFixed(2);
      const svgY = (backplateHeightMm - h.yMm).toFixed(2);
      const stroke = h.kind === "din-rail" ? "#2563eb" : "#d97706";
      return `    <circle cx="${h.xMm}" cy="${svgY}" r="${r}" fill="none" stroke="${stroke}" stroke-width="0.4" data-kind="${h.kind}" data-source="${h.sourceName}" />`;
    })
    .join("\n");

  const crosshairs = holes
    .map((h) => {
      const svgY = backplateHeightMm - h.yMm;
      const len = 3;
      return `    <path d="M ${(h.xMm - len).toFixed(2)} ${svgY.toFixed(2)} H ${(h.xMm + len).toFixed(2)} M ${h.xMm.toFixed(2)} ${(svgY - len).toFixed(2)} V ${(svgY + len).toFixed(2)}" stroke="#64748b" stroke-width="0.2" />`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${backplateWidthMm}mm"
     height="${backplateHeightMm}mm"
     viewBox="0 0 ${backplateWidthMm} ${backplateHeightMm}">
  <title>Panel Pro Backplate Drilling Template (1:1 mm)</title>
  <g id="plate-outline">
    <rect x="0" y="0" width="${backplateWidthMm}" height="${backplateHeightMm}" fill="none" stroke="#0f172a" stroke-width="0.6" />
  </g>
  <g id="crosshairs">
${crosshairs}
  </g>
  <g id="drilling-holes">
${holeElements}
  </g>
  <g id="annotations">
    <text x="8" y="14" font-family="monospace" font-size="8" fill="#0f172a">PANEL PRO 1:1 DRILLING TEMPLATE | PLATE: ${backplateWidthMm}x${backplateHeightMm} mm | HOLES: ${holes.length}</text>
  </g>
</svg>
`;
}

export function generateDrillingDxf(
  enclosure: EnclosureConfig,
  rails: DinRail[],
  ducts: WireDuct[]
): string {
  const { backplateWidthMm, backplateHeightMm, holes } = computeDrillingHoles(
    enclosure,
    rails,
    ducts
  );

  const lines: string[] = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$INSUNITS",
    "70",
    "4",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
  ];

  const addLine = (
    layer: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => {
    lines.push(
      "0",
      "LINE",
      "8",
      layer,
      "10",
      x1.toFixed(3),
      "20",
      y1.toFixed(3),
      "30",
      "0.000",
      "11",
      x2.toFixed(3),
      "21",
      y2.toFixed(3),
      "31",
      "0.000"
    );
  };

  // Backplate rectangle (1:1 mm, bottom-left origin)
  addLine("PLATE_OUTLINE", 0, 0, backplateWidthMm, 0);
  addLine("PLATE_OUTLINE", backplateWidthMm, 0, backplateWidthMm, backplateHeightMm);
  addLine("PLATE_OUTLINE", backplateWidthMm, backplateHeightMm, 0, backplateHeightMm);
  addLine("PLATE_OUTLINE", 0, backplateHeightMm, 0, 0);

  for (const h of holes) {
    const layer = h.kind === "din-rail" ? "DIN_RAIL_HOLES" : "WIRE_DUCT_HOLES";
    lines.push(
      "0",
      "CIRCLE",
      "8",
      layer,
      "10",
      h.xMm.toFixed(3),
      "20",
      h.yMm.toFixed(3),
      "30",
      "0.000",
      "40",
      (h.diameterMm / 2).toFixed(3)
    );
  }

  lines.push("0", "ENDSEC", "0", "EOF", "");
  return lines.join("\n");
}
