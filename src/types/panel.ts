export type LengthUnit = "mm" | "cm" | "m";
export type CadImportUnit = "mm" | "cm" | "m" | "inch";
export type GridSnapMm = 5 | 10 | 25;
export type DoorMode = "open" | "transparent" | "hidden";
export type RotationDeg = 0 | 90 | 180 | 270;

export type SheetType = "mounting-plate" | "door-cutout" | "schematic";
export type PlateMode = "auto" | "manual";

export interface PlateConfig {
  mode: PlateMode;
  manualWidthMm: number;
  manualHeightMm: number;
}

export interface EnclosureConfig {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  backplateInsetMm: number;
  backplateThicknessMm: number;
  wallThicknessMm: number;
  doorMode: DoorMode;
  plateMode?: PlateMode;
  manualPlateWidthMm?: number;
  manualPlateHeightMm?: number;
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

export type ComponentCategory =
  | "Protection & Switchgear"
  | "Control & Automation"
  | "Power & Distribution"
  | "Terminals & DIN Accessories"
  | "Door & Panel Controls";

export type ComponentMountingType = "din_rail" | "screw_plate" | "door_cutout";

export type ComponentTemplateId =
  | "mcb-1p"
  | "mcb-2p"
  | "mcb-3p"
  | "mcb-4p"
  | "mccb-100a"
  | "spd-3pn"
  | "fuse-1p"
  | "contactor"
  | "tor"
  | "relay"
  | "timer-relay"
  | "plc-compact"
  | "vfd-15kw"
  | "psu-24v"
  | "psu-24v-10a"
  | "dist-block-4p"
  | "terminal-block"
  | "terminal-n"
  | "terminal-pe"
  | "end-clamp"
  | "pilot-lamp-red"
  | "pilot-lamp-green"
  | "push-button"
  | "e-stop"
  | "selector-3pos"
  | "panel-meter-96"
  | "cooling-fan-120";

export interface ComponentTemplate {
  id: ComponentTemplateId;
  name: string;
  shortName: string;
  category: ComponentCategory;
  mountingType?: ComponentMountingType;
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
  mountingType?: ComponentMountingType;
  xMm: number;
  yMm: number;
  zMm: number;
  rotationDeg?: RotationDeg;
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
  rotationDeg?: RotationDeg;
  boundingBoxMm: { w: number; h: number; d: number };
  pins: PinTerminal[];
  objectUrl?: string;
  dataUrl?: string;
  rawText?: string;
  entityCount?: number;
  parseWarning?: string;
}

export type ViewportMode = "3d" | "2d";
export type ThemeMode = "dark" | "light";
export type CanvasTool2D = "select" | "wire" | "pan" | "measure";
export type WireColorCode = "R" | "S" | "T" | "N" | "PE" | "DC+" | "DC-";

export interface WireConnection {
  id: string;
  label: string;
  colorCode: WireColorCode;
  gaugeMm2: string;
  fromComponentId: string;
  fromPinId: string;
  toComponentId: string;
  toPinId: string;
  waypoints?: Array<{ xMm: number; yMm: number }>;
}

export interface TitleBlockMeta {
  projectName: string;
  drawer: string;
  sheetNo: string;
  date: string;
  scale: string;
  rev: string;
}

export interface PanelSheet {
  id: string;
  name: string;
  sheetType: SheetType;
  enclosure: EnclosureConfig;
  plateConfig: PlateConfig;
  rails: DinRail[];
  ducts: WireDuct[];
  components: PlacedComponent[];
  cadAssets: CustomCadAsset[];
  wires: WireConnection[];
  titleBlock: TitleBlockMeta;
}

export type SelectedItem =
  | { kind: "rail"; id: string }
  | { kind: "duct"; id: string }
  | { kind: "component"; id: string }
  | { kind: "cad"; id: string }
  | { kind: "wire"; id: string };

export type SelectionTarget = SelectedItem | null;
export type SelectedTarget = SelectedItem;
