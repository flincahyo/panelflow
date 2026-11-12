import { describe, it, expect } from "vitest";
import { COMPONENT_CATALOG, COMPONENT_LIST } from "../components-catalog";
import type { ComponentTemplateId } from "@/types/panel";

describe("expanded components-catalog", () => {
  const expectedIds: ComponentTemplateId[] = [
    // Protection & Switchgear
    "mcb-1p",
    "mcb-2p",
    "mcb-3p",
    "mcb-4p",
    "mccb-100a",
    "spd-3pn",
    "fuse-1p",
    // Control & Automation
    "contactor",
    "tor",
    "relay",
    "timer-relay",
    "plc-compact",
    "vfd-15kw",
    // Power & Distribution
    "psu-24v",
    "psu-24v-10a",
    "dist-block-4p",
    // Terminals & DIN Accessories
    "terminal-block",
    "terminal-n",
    "terminal-pe",
    "end-clamp",
    // Door & Panel Controls
    "pilot-lamp-red",
    "pilot-lamp-green",
    "push-button",
    "e-stop",
    "selector-3pos",
    "panel-meter-96",
    "cooling-fan-120",
  ];

  it("contains all required industrial standard templates", () => {
    expect(COMPONENT_LIST.length).toBeGreaterThanOrEqual(expectedIds.length);
    for (const id of expectedIds) {
      expect(COMPONENT_CATALOG[id]).toBeDefined();
      const tpl = COMPONENT_CATALOG[id];
      expect(tpl.id).toBe(id);
      expect(tpl.widthMm).toBeGreaterThan(0);
      expect(tpl.heightMm).toBeGreaterThan(0);
      expect(tpl.depthMm).toBeGreaterThan(0);
      expect(Array.isArray(tpl.pins)).toBe(true);
      expect(tpl.category).toBeDefined();
    }
  });

  it("verifies accurate dimensions for key parts", () => {
    // MCB dimensions
    expect(COMPONENT_CATALOG["mcb-1p"].widthMm).toBe(17.5);
    expect(COMPONENT_CATALOG["mcb-2p"].widthMm).toBe(35);
    expect(COMPONENT_CATALOG["mcb-3p"].widthMm).toBe(52.5);
    expect(COMPONENT_CATALOG["mcb-4p"].widthMm).toBe(70);

    // MCCB 3P 100A
    expect(COMPONENT_CATALOG["mccb-100a"].widthMm).toBe(90);
    expect(COMPONENT_CATALOG["mccb-100a"].heightMm).toBe(155);
    expect(COMPONENT_CATALOG["mccb-100a"].depthMm).toBe(85);
    expect(COMPONENT_CATALOG["mccb-100a"].mountingType).toBe("screw_plate");

    // PLC Compact CPU with I0.0-I0.3, Q0.0-Q0.3, +24V, 0V
    const plc = COMPONENT_CATALOG["plc-compact"];
    expect(plc.widthMm).toBe(110);
    expect(plc.heightMm).toBe(100);
    expect(plc.depthMm).toBe(75);
    const pinLabels = plc.pins.map((p) => p.label);
    expect(pinLabels).toContain("+24V");
    expect(pinLabels).toContain("0V");
    expect(pinLabels).toContain("I0.0");
    expect(pinLabels).toContain("Q0.0");

    // VFD 1.5kW with L1, L2, L3, U, V, W, PE
    const vfd = COMPONENT_CATALOG["vfd-15kw"];
    expect(vfd.widthMm).toBe(75);
    expect(vfd.heightMm).toBe(185);
    expect(vfd.depthMm).toBe(140);
    expect(vfd.mountingType).toBe("screw_plate");
    const vfdPins = vfd.pins.map((p) => p.label);
    expect(vfdPins).toContain("L1");
    expect(vfdPins).toContain("U");
    expect(vfdPins).toContain("PE");

    // Door Controls
    expect(COMPONENT_CATALOG["pilot-lamp-red"].mountingType).toBe("door_cutout");
    expect(COMPONENT_CATALOG["panel-meter-96"].widthMm).toBe(96);
    expect(COMPONENT_CATALOG["panel-meter-96"].heightMm).toBe(96);
    expect(COMPONENT_CATALOG["cooling-fan-120"].widthMm).toBe(120);
    expect(COMPONENT_CATALOG["cooling-fan-120"].heightMm).toBe(120);
  });
});
