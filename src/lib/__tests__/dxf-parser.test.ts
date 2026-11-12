import { describe, expect, it } from "vitest";
import { parseDxfToMmSegments } from "@/lib/dxf-parser";

const SAMPLE_DXF = `0
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
30
0
11
10
21
0
31
0
0
LINE
8
0
10
10
20
0
30
0
11
10
21
5
31
0
0
ENDSEC
0
EOF
`;

const SAMPLE_ARC_DXF = `0
SECTION
2
ENTITIES
0
ARC
8
0
10
100
20
200
30
0
40
50
50
0
51
90
0
ENDSEC
0
EOF
`;

const SAMPLE_POLYLINE_DXF = `0
SECTION
2
ENTITIES
0
POLYLINE
8
0
70
1
0
VERTEX
10
10
20
10
30
0
0
VERTEX
10
50
20
10
30
0
0
VERTEX
10
50
20
40
30
0
0
SEQEND
0
ENDSEC
0
EOF
`;

const SAMPLE_BLOCK_INSERT_DXF = `0
SECTION
2
BLOCKS
0
BLOCK
2
SUB_MODULE
10
0
20
0
30
0
0
LINE
10
0
20
0
11
20
21
0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
2
SUB_MODULE
10
5000
20
3000
30
0
41
2
42
2
0
ENDSEC
0
EOF
`;

describe("DXF Parser - Robust CAD Entities & Centering", () => {
  it("parses LINE entities and scales from cm to canonical mm", () => {
    const parsed = parseDxfToMmSegments(SAMPLE_DXF, "cm");
    expect(parsed.segments).toHaveLength(2);
    expect(parsed.boundingBoxMm.w).toBe(100);
    expect(parsed.boundingBoxMm.h).toBe(50);
    expect(parsed.entityCount).toBe(2);
  });

  it("normalizes geometry around origin (0,0,0)", () => {
    const parsed = parseDxfToMmSegments(SAMPLE_DXF, "mm");
    expect(parsed.centerOffsetMm).toEqual({ x: 5, y: 2.5, z: 0 });
    expect(parsed.segments[0].x1).toBe(-5);
    expect(parsed.segments[0].x2).toBe(5);
  });

  it("parses ARC entity into approximated circular segments", () => {
    const parsed = parseDxfToMmSegments(SAMPLE_ARC_DXF, "mm");
    expect(parsed.segments.length).toBeGreaterThan(5);
    expect(parsed.entityCount).toBe(1);
    expect(parsed.boundingBoxMm.w).toBeGreaterThan(45);
    expect(parsed.boundingBoxMm.h).toBeGreaterThan(45);
  });

  it("parses POLYLINE with VERTEX and SEQEND pairs correctly", () => {
    const parsed = parseDxfToMmSegments(SAMPLE_POLYLINE_DXF, "mm");
    expect(parsed.entityCount).toBe(1);
    // Closed polyline with 3 vertices produces 3 line segments
    expect(parsed.segments).toHaveLength(3);
    expect(parsed.boundingBoxMm.w).toBe(40);
    expect(parsed.boundingBoxMm.h).toBe(30);
  });

  it("parses BLOCKS and INSERT with far coordinates and normalizes to origin", () => {
    const parsed = parseDxfToMmSegments(SAMPLE_BLOCK_INSERT_DXF, "mm");
    expect(parsed.entityCount).toBe(1);
    expect(parsed.segments).toHaveLength(1);
    // scaled by 2 -> 20 * 2 = 40mm width
    expect(parsed.boundingBoxMm.w).toBe(40);
    // Insert was at X=5000..5040 -> centerOffsetMm around 5020
    expect(parsed.centerOffsetMm.x).toBe(5020);
    expect(parsed.centerOffsetMm.y).toBe(3000);
    // Segment normalized around origin
    expect(parsed.segments[0].x1).toBe(-20);
    expect(parsed.segments[0].x2).toBe(20);
    expect(parsed.segments[0].y1).toBe(0);
    expect(parsed.segments[0].y2).toBe(0);
  });

  it("returns warning and empty segments on empty DXF", () => {
    const parsed = parseDxfToMmSegments("0\nEOF\n", "mm");
    expect(parsed.segments).toHaveLength(0);
    expect(parsed.entityCount).toBe(0);
    expect(parsed.warning).toBeDefined();
  });
});
