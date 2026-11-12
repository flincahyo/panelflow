import type {
  CustomCadAsset,
  DinRail,
  EnclosureConfig,
  PlacedComponent,
  TitleBlockMeta,
  WireConnection,
  WireDuct,
} from "@/types/panel";
import { parseDxfToMmSegments } from "./dxf-parser";
import { getBackplateDimensions } from "./template-export";
import { pointsToSvgPath, routeOrthogonalWire } from "./wire-router";

export interface EplanSheetParams {
  enclosure: EnclosureConfig;
  rails: DinRail[];
  ducts: WireDuct[];
  components: PlacedComponent[];
  cadAssets?: CustomCadAsset[];
  wires: WireConnection[];
  meta: TitleBlockMeta;
}

export const WIRE_COLOR_MAP: Record<string, string> = {
  R: "#dc2626", // Red (L1/R)
  S: "#eab308", // Yellow (L2/S)
  T: "#2563eb", // Blue / Black (L3/T)
  N: "#0284c7", // Light blue (Neutral)
  PE: "#16a34a", // Green / Yellow earth
  "DC+": "#ef4444",
  "DC-": "#1e293b",
};

export { type TitleBlockMeta };

export function generateEplanSheetSvg(params: EplanSheetParams): string {
  const {
    enclosure,
    rails,
    ducts,
    components,
    cadAssets = [],
    wires,
    meta,
  } = params;
  const { widthMm: plateW, heightMm: plateH } = getBackplateDimensions(enclosure);

  // Outer Sheet geometry (Standard Drawing Sheet with Margins & Title Block)
  const marginMm = 40;
  const titleBlockHeightMm = 50;
  const sheetWidthMm = Math.max(841, plateW + marginMm * 2 + 100);
  const sheetHeightMm = Math.max(594, plateH + marginMm * 2 + titleBlockHeightMm);

  // Mount plate center in drawing coordinates
  const drawingCenterX = sheetWidthMm / 2;
  const drawingCenterY = marginMm + plateH / 2;

  // Convert local plate coords (center=0,0, Y up) to Drawing SVG coords (top-left=0,0, Y down)
  const toSvgX = (xMm: number) => drawingCenterX + xMm;
  const toSvgY = (yMm: number) => drawingCenterY - yMm;

  // 1. Grid crosshairs & border
  const borderX = 10;
  const borderY = 10;
  const borderW = sheetWidthMm - 20;
  const borderH = sheetHeightMm - 20;

  // Plate outline
  const plateSvgX = toSvgX(-plateW / 2);
  const plateSvgY = toSvgY(plateH / 2);

  // 2. Wire Ducts
  const ductSvg = ducts
    .map((d) => {
      const x = toSvgX(d.xMm - d.widthMm / 2);
      const y = toSvgY(d.yMm + d.heightMm / 2);
      return `
    <g class="wire-duct" data-id="${d.id}">
      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${d.widthMm.toFixed(2)}" height="${d.heightMm.toFixed(2)}" fill="#cbd5e1" fill-opacity="0.3" stroke="#64748b" stroke-dasharray="2,2" stroke-width="0.5" />
      <text x="${(x + 4).toFixed(2)}" y="${(y + 12).toFixed(2)}" font-family="sans-serif" font-size="6" fill="#64748b">${d.name} (${d.widthMm}x${d.heightMm})</text>
    </g>`;
    })
    .join("\n");

  // 3. DIN Rails (Profile TH35 with center line & bolt slots)
  const railSvg = rails
    .map((r) => {
      const x = toSvgX(r.xMm - r.lengthMm / 2);
      const y = toSvgY(r.yMm + 17.5);
      const h = 35;
      return `
    <g class="din-rail" data-id="${r.id}">
      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${r.lengthMm.toFixed(2)}" height="${h}" fill="#94a3b8" fill-opacity="0.25" stroke="#475569" stroke-width="0.8" />
      <line x1="${x.toFixed(2)}" y1="${(y + 17.5).toFixed(2)}" x2="${(x + r.lengthMm).toFixed(2)}" y2="${(y + 17.5).toFixed(2)}" stroke="#cbd5e1" stroke-dasharray="4,2" stroke-width="0.4" />
      <text x="${(x + 6).toFixed(2)}" y="${(y + 12).toFixed(2)}" font-family="monospace" font-size="7" font-weight="bold" fill="#334155">${r.name}</text>
    </g>`;
    })
    .join("\n");

  // 4. Components (Eplan 2D vector symbol with tags & pin circles)
  const pinCoordMap = new Map<string, { x: number; y: number }>();

  const compSvg = components
    .map((c) => {
      const x = toSvgX(c.xMm - c.widthMm / 2);
      const y = toSvgY(c.yMm + c.heightMm / 2);

      // Pins
      const pinsSvg = c.pins
        .map((p) => {
          const pinSvgX = toSvgX(c.xMm + p.localXMm);
          const pinSvgY = toSvgY(c.yMm + p.localYMm);
          pinCoordMap.set(`${c.id}:${p.id}`, { x: pinSvgX, y: pinSvgY });

          return `
      <g class="pin" data-pin-id="${p.id}">
        <circle cx="${pinSvgX.toFixed(2)}" cy="${pinSvgY.toFixed(2)}" r="1.5" fill="#f8fafc" stroke="#1e293b" stroke-width="0.5" />
        <text x="${(pinSvgX + 2.5).toFixed(2)}" y="${(pinSvgY + 2).toFixed(2)}" font-family="monospace" font-size="4.5" fill="#475569">${p.label}</text>
      </g>`;
        })
        .join("\n");

      return `
    <g class="component" data-id="${c.id}">
      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${c.widthMm.toFixed(2)}" height="${c.heightMm.toFixed(2)}" fill="#ffffff" stroke="#0f172a" stroke-width="0.8" />
      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${c.widthMm.toFixed(2)}" height="6" fill="${c.accentColor || "#3b82f6"}" />
      <text x="${(x + 3).toFixed(2)}" y="${(y + 12).toFixed(2)}" font-family="monospace" font-size="6.5" font-weight="bold" fill="#0f172a">${c.name}</text>
      <text x="${(x + 3).toFixed(2)}" y="${(y + 19).toFixed(2)}" font-family="sans-serif" font-size="5" fill="#64748b">${c.templateId.toUpperCase()}</text>
      ${pinsSvg}
    </g>`;
    })
    .join("\n");

  // 4b. Custom CAD Assets (DXF vector lines or bounding box + pins)
  const cadSvg = cadAssets
    .map((asset) => {
      let w = asset.boundingBoxMm.w;
      let h = asset.boundingBoxMm.h;
      let dxfSegments: Array<{ x1: number; y1: number; x2: number; y2: number }> =
        [];

      if (asset.format === "dxf" && asset.rawText) {
        const parsed = parseDxfToMmSegments(asset.rawText, asset.sourceUnit);
        w = parsed.boundingBoxMm.w;
        h = parsed.boundingBoxMm.h;
        dxfSegments = parsed.segments;
      }

      const x = toSvgX(asset.xMm - w / 2);
      const y = toSvgY(asset.yMm + h / 2);

      const pinsSvg = asset.pins
        .map((p) => {
          const pinSvgX = toSvgX(asset.xMm + p.localXMm);
          const pinSvgY = toSvgY(asset.yMm + p.localYMm);
          pinCoordMap.set(`${asset.id}:${p.id}`, { x: pinSvgX, y: pinSvgY });

          return `
      <g class="cad-pin" data-pin-id="${p.id}">
        <circle cx="${pinSvgX.toFixed(2)}" cy="${pinSvgY.toFixed(2)}" r="1.6" fill="#fef3c7" stroke="#d97706" stroke-width="0.6" />
        <text x="${(pinSvgX + 2.5).toFixed(2)}" y="${(pinSvgY + 2).toFixed(2)}" font-family="monospace" font-size="4.5" font-weight="bold" fill="#92400e">${p.label}</text>
      </g>`;
        })
        .join("\n");

      const dxfLinesSvg = dxfSegments
        .map(
          (s) =>
            `<line x1="${toSvgX(asset.xMm + s.x1).toFixed(2)}" y1="${toSvgY(
              asset.yMm + s.y1
            ).toFixed(2)}" x2="${toSvgX(asset.xMm + s.x2).toFixed(2)}" y2="${toSvgY(
              asset.yMm + s.y2
            ).toFixed(2)}" stroke="#0369a1" stroke-width="0.75" />`
        )
        .join("\n");

      const shortLabel =
        asset.name.length > 20 ? `${asset.name.slice(0, 18)}…` : asset.name;

      return `
    <g class="cad-asset" data-id="${asset.id}">
      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${asset.format === "dxf" ? "#f0f9ff" : "#f8fafc"}" fill-opacity="${asset.format === "dxf" ? "0.3" : "0.85"}" stroke="${asset.format === "dxf" ? "#94a3b8" : "#0f172a"}" stroke-width="0.7" stroke-dasharray="${asset.format === "dxf" ? "2,1.5" : "none"}" />
      <text x="${(x + 2).toFixed(2)}" y="${(y - 3).toFixed(2)}" font-family="monospace" font-size="5" font-weight="bold" fill="#0369a1">${shortLabel} [${asset.format.toUpperCase()}]</text>
      ${dxfLinesSvg}
      ${pinsSvg}
    </g>`;
    })
    .join("\n");

  // 5. Wires (Orthogonal routing lines with wire tag callouts)
  const wireSvg = wires
    .map((w) => {
      const p1 = pinCoordMap.get(`${w.fromComponentId}:${w.fromPinId}`);
      const p2 = pinCoordMap.get(`${w.toComponentId}:${w.toPinId}`);
      if (!p1 || !p2) return "";

      const waypoints = routeOrthogonalWire(p1, p2, "horizontal-first");
      const pathD = pointsToSvgPath(waypoints);
      const stroke = WIRE_COLOR_MAP[w.colorCode] || "#2563eb";
      const midIdx = Math.floor(waypoints.length / 2);
      const labelPos = waypoints[midIdx] || p1;

      return `
    <g class="wire-net" data-id="${w.id}">
      <path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="${(labelPos.x - 8).toFixed(2)}" y="${(labelPos.y - 4).toFixed(2)}" width="16" height="8" rx="1.5" fill="#ffffff" stroke="${stroke}" stroke-width="0.4" />
      <text x="${labelPos.x.toFixed(2)}" y="${(labelPos.y + 1.5).toFixed(2)}" font-family="monospace" font-size="4" font-weight="bold" fill="#0f172a" text-anchor="middle">${w.label} (${w.gaugeMm2}mm²)</text>
    </g>`;
    })
    .join("\n");

  // 6. ISO / IEC Title Block (Plot Frame) in bottom-right corner
  const tbWidth = 240;
  const tbHeight = 45;
  const tbX = borderX + borderW - tbWidth;
  const tbY = borderY + borderH - tbHeight;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${sheetWidthMm}mm"
     height="${sheetHeightMm}mm"
     viewBox="0 0 ${sheetWidthMm} ${sheetHeightMm}">
  <defs>
    <style>
      text { user-select: none; }
    </style>
  </defs>

  <!-- Drawing Sheet Background -->
  <rect x="0" y="0" width="${sheetWidthMm}" height="${sheetHeightMm}" fill="#ffffff" />

  <!-- ISO Outer & Inner Border -->
  <rect x="${borderX}" y="${borderY}" width="${borderW}" height="${borderH}" fill="none" stroke="#0f172a" stroke-width="1" />
  <rect x="${borderX + 4}" y="${borderY + 4}" width="${borderW - 8}" height="${borderH - 8}" fill="none" stroke="#64748b" stroke-width="0.3" />

  <!-- Enclosure Backplate Outline -->
  <g id="enclosure-backplate">
    <rect x="${plateSvgX.toFixed(2)}" y="${plateSvgY.toFixed(2)}" width="${plateW}" height="${plateH}" fill="#f8fafc" stroke="#0f172a" stroke-width="1.2" />
    <!-- Dimension annotations -->
    <text x="${drawingCenterX}" y="${(plateSvgY - 6).toFixed(2)}" font-family="monospace" font-size="7" fill="#475569" text-anchor="middle">MOUNTING PLATE: ${plateW} mm</text>
    <text x="${(plateSvgX - 8).toFixed(2)}" y="${drawingCenterY}" font-family="monospace" font-size="7" fill="#475569" text-anchor="middle" transform="rotate(-90 ${(plateSvgX - 8).toFixed(2)} ${drawingCenterY})">${plateH} mm</text>
  </g>

  <!-- Wire Ducts Layer -->
  <g id="wire-ducts">
    ${ductSvg}
  </g>

  <!-- DIN Rails Layer -->
  <g id="din-rails">
    ${railSvg}
  </g>

  <!-- Components Layer -->
  <g id="components">
    ${compSvg}
  </g>

  <!-- Custom CAD Assets Layer -->
  <g id="cad-assets">
    ${cadSvg}
  </g>

  <!-- Wires Layer -->
  <g id="wires">
    ${wireSvg}
  </g>

  <!-- Title Block (ISO 7200 / IEC 61082) -->
  <g id="title-block">
    <rect x="${tbX}" y="${tbY}" width="${tbWidth}" height="${tbHeight}" fill="#ffffff" stroke="#0f172a" stroke-width="0.8" />
    <line x1="${tbX}" y1="${tbY + 15}" x2="${tbX + tbWidth}" y2="${tbY + 15}" stroke="#0f172a" stroke-width="0.5" />
    <line x1="${tbX}" y1="${tbY + 30}" x2="${tbX + tbWidth}" y2="${tbY + 30}" stroke="#0f172a" stroke-width="0.5" />
    <line x1="${tbX + 130}" y1="${tbY}" x2="${tbX + 130}" y2="${tbY + tbHeight}" stroke="#0f172a" stroke-width="0.5" />
    <line x1="${tbX + 185}" y1="${tbY + 15}" x2="${tbX + 185}" y2="${tbY + tbHeight}" stroke="#0f172a" stroke-width="0.5" />

    <!-- Project & Organization -->
    <text x="${tbX + 5}" y="${tbY + 10}" font-family="sans-serif" font-size="6" font-weight="bold" fill="#0f172a">PROJECT: ${meta.projectName}</text>
    <text x="${tbX + 5}" y="${tbY + 24}" font-family="sans-serif" font-size="5.5" fill="#334155">DRAWER: ${meta.drawer}</text>
    <text x="${tbX + 5}" y="${tbY + 39}" font-family="sans-serif" font-size="5" fill="#64748b">EPLAN PRO PANEL 2D MOUNTING LAYOUT</text>

    <!-- Meta Details -->
    <text x="${tbX + 135}" y="${tbY + 10}" font-family="sans-serif" font-size="5.5" fill="#334155">DATE: ${meta.date}</text>
    <text x="${tbX + 135}" y="${tbY + 24}" font-family="sans-serif" font-size="5.5" fill="#334155">SCALE: ${meta.scale}</text>
    <text x="${tbX + 135}" y="${tbY + 39}" font-family="sans-serif" font-size="5.5" fill="#334155">REV: ${meta.rev}</text>
    <text x="${tbX + 190}" y="${tbY + 24}" font-family="sans-serif" font-size="5.5" font-weight="bold" fill="#0f172a">SHEET:</text>
    <text x="${tbX + 190}" y="${tbY + 39}" font-family="monospace" font-size="6.5" font-weight="bold" fill="#0284c7">${meta.sheetNo}</text>
  </g>
</svg>
`;
}
