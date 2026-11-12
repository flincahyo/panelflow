import { describe, expect, it } from "vitest";
import { getCadPreviewSvgData } from "@/lib/cad-preview";

describe("CAD preview helpers and bounds calculation", () => {
  it("generates fallback SVG data when no raw text exists", () => {
    const preview = getCadPreviewSvgData({
      format: "glb",
      boundingBoxMm: { w: 100, h: 50, d: 30 },
      pins: [],
    });
    expect(preview.viewBox).toBe("0 0 100 50");
    expect(preview.type).toBe("silhouette");
  });

  it("parses DXF rawText and computes proper viewBox with padding", () => {
    // DXF box from 0,0 to 100,50
    const sampleDxf = `0
SECTION
2
ENTITIES
0
LINE
8
0
10
0
20
0
11
100
21
0
0
LINE
8
0
10
100
20
0
11
100
21
50
0
ENDSEC
0
EOF`;
    const preview = getCadPreviewSvgData({
      format: "dxf",
      rawText: sampleDxf,
      sourceUnit: "mm",
      boundingBoxMm: { w: 100, h: 50, d: 0 },
      pins: [{ id: "p1", label: "A1", localXMm: 0, localYMm: 0, localZMm: 0 }],
    });

    expect(preview.type).toBe("wireframe");
    if (preview.type !== "wireframe") throw new Error("Expected wireframe");
    expect(preview.segments.length).toBeGreaterThan(0);
    expect(preview.pins.length).toBe(1);
    expect(preview.viewBox).toBeDefined();
    // bounds centered around 0,0 (-50 to +50 on X, -25 to +25 on Y)
    const [_minX, _minY, vbW, vbH] = preview.viewBox.split(" ").map(Number);
    expect(vbW).toBeGreaterThan(100);
    expect(vbH).toBeGreaterThan(50);
  });

  it("parses OBJ rawText wireframe vertices and edges", () => {
    const sampleObj = `
v 0 0 0
v 10 0 0
v 10 20 0
v 0 20 0
f 1 2 3 4
`;
    const preview = getCadPreviewSvgData({
      format: "obj",
      rawText: sampleObj,
      boundingBoxMm: { w: 10, h: 20, d: 5 },
      pins: [],
    });

    expect(preview.type).toBe("wireframe");
    if (preview.type !== "wireframe") throw new Error("Expected wireframe");
    expect(preview.segments.length).toBe(4); // 4 quad edges
  });
});
