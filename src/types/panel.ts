export type LengthUnit = "mm" | "cm" | "m";
export type CadImportUnit = "mm" | "cm" | "m" | "inch";
export type GridSnapMm = 5 | 10 | 25;
export type DoorMode = "open" | "transparent" | "hidden";

export interface EnclosureConfig {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  backplateInsetMm: number;
  backplateThicknessMm: number;
  wallThicknessMm: number;
  doorMode: DoorMode;
}

export interface DinRail {
  id: string;
  name: string;
  xMm: number;
  yMm: number;
  lengthMm: number;
}

export interface WireDuct {
  id: string;
  name: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  orientation: "horizontal" | "vertical";
}

export interface PinTerminal {
  id: string;
  label: string;
  localXMm: number;
  localYMm: number;
  localZMm: number;
}

export type ComponentTemplateId =
  | "mcb-1p"
  | "mcb-3p"
  | "contactor"
  | "relay"
  | "terminal-block"
  | "psu-24v";

export interface ComponentTemplate {
  id: ComponentTemplateId;
  name: string;
  shortName: string;
  category: "Protection" | "Switching" | "Termination" | "Power";
  widthMm: number;
  heightMm: number;
  depthMm: number;
  color: string;
  accentColor: string;
  pins: Omit<PinTerminal, "id">[];
}

export interface PlacedComponent {
  id: string;
  templateId: ComponentTemplateId;
  name: string;
  xMm: number;
  yMm: number;
  zMm: number;
  railId: string | null;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  color: string;
  accentColor: string;
  pins: PinTerminal[];
}

export type CadFormat = "glb" | "gltf" | "obj" | "dxf";

export interface CustomCadAsset {
  id: string;
  name: string;
  fileName: string;
  format: CadFormat;
  sourceUnit: CadImportUnit;
  xMm: number;
  yMm: number;
  zMm: number;
  boundingBoxMm: { w: number; h: number; d: number };
  pins: PinTerminal[];
  objectUrl?: string;
  rawText?: string;
}

export type SelectionTarget =
  | { kind: "rail"; id: string }
  | { kind: "duct"; id: string }
  | { kind: "component"; id: string }
  | { kind: "cad"; id: string }
  | null;
