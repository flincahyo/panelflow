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

describe("Basic DXF Parser & Unit Normalization", () => {
  it("parses LINE entities and scales from cm to canonical mm", () => {
    const parsed = parseDxfToMmSegments(SAMPLE_DXF, "cm");
    expect(parsed.segments).toHaveLength(2);
    expect(parsed.boundingBoxMm.w).toBe(100);
    expect(parsed.boundingBoxMm.h).toBe(50);
  });

  it("normalizes geometry around origin (0,0,0)", () => {
    const parsed = parseDxfToMmSegments(SAMPLE_DXF, "mm");
    expect(parsed.centerOffsetMm).toEqual({ x: 5, y: 2.5, z: 0 });
    expect(parsed.segments[0].x1).toBe(-5);
    expect(parsed.segments[0].x2).toBe(5);
  });
});
