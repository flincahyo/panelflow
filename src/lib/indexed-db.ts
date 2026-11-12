import type { CustomCadAsset, PanelSheet } from "@/types/panel";

const DB_NAME = "panelflow_db";
const DB_VERSION = 1;
const STORE_AUTOSAVE = "autosave";
const STORE_CUSTOM_LIBRARY = "custom_cad_library";

export interface CustomLibraryCadItem {
  id: string;
  name: string;
  fileName: string;
  format: CustomCadAsset["format"];
  sourceUnit: CustomCadAsset["sourceUnit"];
  boundingBoxMm: { w: number; h: number; d: number };
  pins: CustomCadAsset["pins"];
  rawText?: string;
  dataUrl?: string;
  entityCount?: number;
  parseWarning?: string;
  cloudId?: string;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable in current runtime"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_AUTOSAVE)) {
          db.createObjectStore(STORE_AUTOSAVE);
        }
        if (!db.objectStoreNames.contains(STORE_CUSTOM_LIBRARY)) {
          db.createObjectStore(STORE_CUSTOM_LIBRARY, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// ── Autosave session snapshot ───────────────────────────────────────────────
export interface AutoSaveSnapshot {
  sheets: PanelSheet[];
  activeSheetId: string;
  savedAt: number;
}

export async function saveAutoSaveSession(
  sheets: PanelSheet[],
  activeSheetId: string
): Promise<void> {
  const db = await getDb();
  // Strip transient in-memory blob URLs so we don't store revoked object URLs
  const cleanSheets: PanelSheet[] = sheets.map((sheet) => ({
    ...sheet,
    cadAssets: sheet.cadAssets.map((asset) => {
      const { objectUrl: _omitted, ...rest } = asset;
      return rest;
    }),
  }));

  const snapshot: AutoSaveSnapshot = {
    sheets: cleanSheets,
    activeSheetId,
    savedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUTOSAVE, "readwrite");
    const store = tx.objectStore(STORE_AUTOSAVE);
    const req = store.put(snapshot, "panelflow_autosave");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadAutoSaveSession(): Promise<AutoSaveSnapshot | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUTOSAVE, "readonly");
    const store = tx.objectStore(STORE_AUTOSAVE);
    const req = store.get("panelflow_autosave");
    req.onsuccess = () => {
      resolve((req.result as AutoSaveSnapshot) || null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearAutoSaveSession(): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUTOSAVE, "readwrite");
    const store = tx.objectStore(STORE_AUTOSAVE);
    const req = store.delete("panelflow_autosave");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Custom CAD Library ──────────────────────────────────────────────────────
export async function saveCustomCadToLibrary(
  asset: CustomCadAsset
): Promise<CustomLibraryCadItem> {
  const db = await getDb();
  const item: CustomLibraryCadItem = {
    id: asset.id,
    name: asset.name,
    fileName: asset.fileName,
    format: asset.format,
    sourceUnit: asset.sourceUnit,
    boundingBoxMm: { ...asset.boundingBoxMm },
    pins: asset.pins.map((p) => ({ ...p })),
    rawText: asset.rawText,
    dataUrl: asset.dataUrl,
    entityCount: asset.entityCount,
    parseWarning: asset.parseWarning,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CUSTOM_LIBRARY, "readwrite");
    const store = tx.objectStore(STORE_CUSTOM_LIBRARY);
    const req = store.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  });
}

export async function listCustomCadLibrary(): Promise<CustomLibraryCadItem[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CUSTOM_LIBRARY, "readonly");
    const store = tx.objectStore(STORE_CUSTOM_LIBRARY);
    const req = store.getAll();
    req.onsuccess = () => {
      resolve((req.result as CustomLibraryCadItem[]) || []);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function removeCustomCadFromLibrary(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CUSTOM_LIBRARY, "readwrite");
    const store = tx.objectStore(STORE_CUSTOM_LIBRARY);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function renameCustomCadInLibrary(
  id: string,
  newName: string
): Promise<CustomLibraryCadItem | null> {
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error("Name cannot be empty");
  }

  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CUSTOM_LIBRARY, "readwrite");
    const store = tx.objectStore(STORE_CUSTOM_LIBRARY);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const existing = getReq.result as CustomLibraryCadItem | undefined;
      if (!existing) {
        resolve(null);
        return;
      }

      const updated: CustomLibraryCadItem = {
        ...existing,
        name: trimmed,
      };

      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function updateCustomCadCloudId(
  id: string,
  cloudId: string
): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CUSTOM_LIBRARY, "readwrite");
    const store = tx.objectStore(STORE_CUSTOM_LIBRARY);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as CustomLibraryCadItem | undefined;
      if (!existing) {
        resolve();
        return;
      }
      const putReq = store.put({ ...existing, cloudId });
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}
