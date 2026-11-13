import type {
  CustomCadAsset,
  GridSnapMm,
  LengthUnit,
  PanelSheet,
  TitleBlockMeta,
} from "@/types/panel";

export const PANEL_FLOW_FILE_EXTENSION = ".pflow";
export const PANEL_FLOW_SCHEMA_VERSION = 1;

export interface PanelFlowProjectFile {
  app: "PanelFlow";
  version: number;
  exportedAt: string;
  displayUnit: LengthUnit;
  gridSnapMm?: GridSnapMm;
  autoRouteDuctsEnabled?: boolean;
  activeSheetId: string;
  titleBlock?: TitleBlockMeta;
  sheets: PanelSheet[];
}

export function sanitizeProjectFilename(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${cleaned || "panelflow-project"}${PANEL_FLOW_FILE_EXTENSION}`;
}

export async function blobUrlToDataUrl(
  objectUrl: string
): Promise<string | undefined> {
  try {
    const res = await fetch(objectUrl);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Failed to read blob as dataUrl"));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

export function stripTransientCadAsset(asset: CustomCadAsset): CustomCadAsset {
  const { objectUrl: _omitted, ...rest } = asset;
  return rest;
}

export async function compressDataUrlForExport(
  dataUrl: string,
  maxDimension = 900,
  quality = 0.88
): Promise<string> {
  if (typeof window === "undefined" || !dataUrl.startsWith("data:image/")) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w <= maxDimension && h <= maxDimension && dataUrl.length < 350000) {
        resolve(dataUrl);
        return;
      }
      if (w > maxDimension || h > maxDimension) {
        if (w > h) {
          h = Math.round((h * maxDimension) / w);
          w = maxDimension;
        } else {
          w = Math.round((w * maxDimension) / h);
          h = maxDimension;
        }
      }
      const cvs = document.createElement("canvas");
      cvs.width = w;
      cvs.height = h;
      const ctx = cvs.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const webp = cvs.toDataURL("image/webp", quality);
        if (webp.startsWith("data:image/webp") && webp.length < dataUrl.length) {
          resolve(webp);
          return;
        }
      } catch {}
      const png = cvs.toDataURL("image/png");
      resolve(png.length < dataUrl.length ? png : dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function prepareSheetsForSerialization(
  sheets: PanelSheet[]
): Promise<PanelSheet[]> {
  return Promise.all(
    sheets.map(async (sheet) => ({
      ...sheet,
      cadAssets: await Promise.all(
        sheet.cadAssets.map(async (asset) => {
          let dataUrl = asset.dataUrl || asset.imageOverlayUrl;
          if (!dataUrl && asset.objectUrl && asset.objectUrl.startsWith("blob:")) {
            dataUrl = await blobUrlToDataUrl(asset.objectUrl);
          }
          if (dataUrl && dataUrl.startsWith("data:image/")) {
            dataUrl = await compressDataUrlForExport(dataUrl, 900, 0.88);
          }
          const clean = stripTransientCadAsset(asset);
          return dataUrl
            ? { ...clean, dataUrl, imageOverlayUrl: dataUrl }
            : clean;
        })
      ),
    }))
  );
}

export function serializeProject(params: {
  sheets: PanelSheet[];
  activeSheetId: string;
  displayUnit: LengthUnit;
  gridSnapMm?: GridSnapMm;
  autoRouteDuctsEnabled?: boolean;
  titleBlock?: TitleBlockMeta;
}): string {
  const activeSheet =
    params.sheets.find((s) => s.id === params.activeSheetId) ?? params.sheets[0];

  const cleanSheets: PanelSheet[] = params.sheets.map((sheet) => ({
    ...sheet,
    cadAssets: sheet.cadAssets.map(stripTransientCadAsset),
  }));

  const project: PanelFlowProjectFile = {
    app: "PanelFlow",
    version: PANEL_FLOW_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    displayUnit: params.displayUnit,
    gridSnapMm: params.gridSnapMm ?? 10,
    autoRouteDuctsEnabled: params.autoRouteDuctsEnabled ?? true,
    activeSheetId: params.activeSheetId,
    titleBlock: params.titleBlock ?? activeSheet?.titleBlock,
    sheets: cleanSheets,
  };
  return JSON.stringify(project, null, 2);
}

export async function serializeProjectAsync(params: {
  sheets: PanelSheet[];
  activeSheetId: string;
  displayUnit: LengthUnit;
  gridSnapMm?: GridSnapMm;
  autoRouteDuctsEnabled?: boolean;
  titleBlock?: TitleBlockMeta;
}): Promise<string> {
  const preparedSheets = await prepareSheetsForSerialization(params.sheets);
  return serializeProject({
    ...params,
    sheets: preparedSheets,
  });
}

export function validateProjectSchema(data: unknown): {
  valid: boolean;
  error?: string;
} {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, error: "Project data must be an object" };
  }
  const obj = data as Partial<PanelFlowProjectFile>;
  if (obj.app !== undefined && obj.app !== "PanelFlow") {
    return { valid: false, error: `Unsupported project app: ${String(obj.app)}` };
  }
  if (obj.version !== PANEL_FLOW_SCHEMA_VERSION && obj.version !== 1) {
    return { valid: false, error: `Unsupported project schema version: ${obj.version}` };
  }
  if (!Array.isArray(obj.sheets) || obj.sheets.length === 0) {
    return { valid: false, error: "Project must contain at least one sheet" };
  }
  for (const sheet of obj.sheets) {
    if (!sheet || typeof sheet !== "object" || !sheet.id || !sheet.name) {
      return { valid: false, error: "Invalid sheet structure in project file" };
    }
    if (!sheet.enclosure || typeof sheet.enclosure !== "object") {
      return { valid: false, error: `Sheet ${sheet.id} is missing enclosure config` };
    }
    if (
      !Array.isArray(sheet.rails) ||
      !Array.isArray(sheet.ducts) ||
      !Array.isArray(sheet.components) ||
      !Array.isArray(sheet.cadAssets) ||
      !Array.isArray(sheet.wires)
    ) {
      return { valid: false, error: `Sheet ${sheet.id} has invalid element collections` };
    }
  }
  return { valid: true };
}

export function deserializeProject(jsonText: string): PanelFlowProjectFile {
  const parsed = JSON.parse(jsonText);
  const val = validateProjectSchema(parsed);
  if (!val.valid) {
    throw new Error(val.error || "Corrupted .pflow project file");
  }
  return parsed as PanelFlowProjectFile;
}

export function parseAndValidatePflow(
  jsonText: string
): { ok: true; data: PanelFlowProjectFile } | { ok: false; error: string } {
  try {
    const data = deserializeProject(jsonText);
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Corrupted .pflow project file",
    };
  }
}

export function rehydrateCadAssets(sheets: PanelSheet[]): PanelSheet[] {
  return sheets.map((sheet) => ({
    ...sheet,
    cadAssets: sheet.cadAssets.map((asset) => {
      if (
        (asset.format === "glb" || asset.format === "gltf") &&
        asset.dataUrl &&
        !asset.objectUrl
      ) {
        return { ...asset, objectUrl: asset.dataUrl };
      }
      return asset;
    }),
  }));
}
