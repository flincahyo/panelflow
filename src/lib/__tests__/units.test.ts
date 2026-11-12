import { describe, expect, it } from "vitest";
import {
  formatDim,
  fromMm,
  getCadScaleFactorToMm,
  inputStepForUnit,
  toMm,
} from "@/lib/units";

describe("Multi-Unit Measurement Engine (canonical mm)", () => {
  it("converts mm, cm, m, and inch to canonical mm", () => {
    expect(toMm(100, "mm")).toBe(100);
    expect(toMm(25, "cm")).toBe(250);
    expect(toMm(1.5, "m")).toBe(1500);
    expect(toMm(10, "inch")).toBeCloseTo(254, 6);
  });

  it("converts canonical mm to mm, cm, and m", () => {
    expect(fromMm(600, "mm")).toBe(600);
    expect(fromMm(600, "cm")).toBe(60);
    expect(fromMm(800, "m")).toBe(0.8);
  });

  it("handles non-finite inputs safely", () => {
    expect(toMm(Number.NaN, "cm")).toBe(0);
    expect(fromMm(Number.POSITIVE_INFINITY, "m")).toBe(0);
  });

  it("formats dimensions cleanly with unit suffix", () => {
    expect(formatDim(600, "mm")).toBe("600 mm");
    expect(formatDim(600, "cm")).toBe("60 cm");
    expect(formatDim(800, "m")).toBe("0.8 m");
    expect(formatDim(17.5, "mm")).toBe("17.5 mm");
  });

  it("returns expected CAD scale factors and UI input steps", () => {
    expect(getCadScaleFactorToMm("mm")).toBe(1);
    expect(getCadScaleFactorToMm("cm")).toBe(10);
    expect(getCadScaleFactorToMm("m")).toBe(1000);
    expect(getCadScaleFactorToMm("inch")).toBe(25.4);
    expect(inputStepForUnit("mm")).toBe(1);
    expect(inputStepForUnit("cm")).toBe(0.5);
    expect(inputStepForUnit("m")).toBe(0.01);
  });
});
