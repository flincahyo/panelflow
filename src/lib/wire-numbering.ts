import type { PanelSheet, WireColorCode, WireConnection } from "@/types/panel";

/**
 * EPLAN Standard Wire Numbering conventions:
 * - 3-Phase AC Power:
 *   - R -> L1-1, L1-2, L1-3...
 *   - S -> L2-1, L2-2, L2-3...
 *   - T -> L3-1, L3-2, L3-3...
 * - Neutral:
 *   - N -> N-1, N-2, N-3...
 * - Protective Earth:
 *   - PE -> PE-1, PE-2, PE-3...
 * - DC / Control / Instrumentation:
 *   - DC+ -> +24V-1, +24V-2... or +24V if single / W01...
 *   - DC- -> 0V-1, 0V-2... or 0V if single / W02...
 *   - Generic Control: W01, W02, W03...
 */

export interface WireNumberingRuleOptions {
  phasePrefix?: {
    R: string;
    S: string;
    T: string;
    N: string;
    PE: string;
    "DC+": string;
    "DC-": string;
  };
  controlFormat?: "prefix-seq" | "numeric-seq"; // e.g. "+24V-1" vs "W01"
}

const DEFAULT_PREFIX_MAP: Record<WireColorCode, string> = {
  R: "L1",
  S: "L2",
  T: "L3",
  N: "N",
  PE: "PE",
  "DC+": "+24V",
  "DC-": "0V",
};

/**
 * Assigns standardized EPLAN wire identifiers to all wires in a list.
 * Respects existing wiring sequence or sorts deterministically by coordinates/IDs.
 */
export function generateWireNumbers(
  wires: WireConnection[],
  options?: WireNumberingRuleOptions
): WireConnection[] {
  const prefixMap = { ...DEFAULT_PREFIX_MAP, ...(options?.phasePrefix || {}) };
  const counterMap: Record<string, number> = {};

  return wires.map((wire) => {
    const code = wire.colorCode;
    const prefix = prefixMap[code] || "W";

    counterMap[prefix] = (counterMap[prefix] || 0) + 1;
    const seq = counterMap[prefix];

    let newLabel: string;
    if (code === "DC+" || code === "DC-") {
      if (options?.controlFormat === "numeric-seq") {
        newLabel = `W${String(seq).padStart(2, "0")}`;
      } else {
        newLabel = `${prefix}-${seq}`;
      }
    } else {
      newLabel = `${prefix}-${seq}`;
    }

    return {
      ...wire,
      label: newLabel,
    };
  });
}

/**
 * Applies auto wire numbering to an entire panel sheet.
 */
export function autoNumberSheetWires(
  sheet: PanelSheet,
  options?: WireNumberingRuleOptions
): PanelSheet {
  return {
    ...sheet,
    wires: generateWireNumbers(sheet.wires, options),
  };
}
