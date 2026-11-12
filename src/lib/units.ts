import type { CadImportUnit, LengthUnit } from "@/types/panel";

const UNIT_TO_MM: Record<CadImportUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  inch: 25.4,
};

export function getCadScaleFactorToMm(unit: CadImportUnit): number {
  return UNIT_TO_MM[unit];
}

export function toMm(value: number, unit: CadImportUnit): number {
  if (!Number.isFinite(value)) return 0;
  return value * UNIT_TO_MM[unit];
}

export function fromMm(mm: number, unit: LengthUnit): number {
  if (!Number.isFinite(mm)) return 0;
  return mm / UNIT_TO_MM[unit];
}

export function defaultDecimalsForUnit(unit: LengthUnit): number {
  switch (unit) {
    case "mm":
      return 1;
    case "cm":
      return 2;
    case "m":
      return 3;
  }
}

export function inputStepForUnit(unit: LengthUnit): number {
  switch (unit) {
    case "mm":
      return 1;
    case "cm":
      return 0.5;
    case "m":
      return 0.01;
  }
}

export function formatDim(
  mm: number,
  unit: LengthUnit,
  decimals?: number
): string {
  const val = fromMm(mm, unit);
  const d = decimals ?? defaultDecimalsForUnit(unit);
  const formatted = Number(val.toFixed(d)).toString();
  return `${formatted} ${unit}`;
}
