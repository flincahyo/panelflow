import { create } from "zustand";
import type { PublicUser } from "@/lib/auth";
import { saveCustomCadToLibrary } from "@/lib/indexed-db";
import { usePanelStore } from "@/store/usePanelStore";
import type { ComponentTemplateId, CustomCadAsset } from "@/types/panel";

export interface CloudProjectSummary {
  id: string;
  name: string;
  thumbnail: string | null;
  updated_at: string;
}

export type SyncStatus = "idle" | "saving" | "saved" | "error";

interface AuthState {
  user: PublicUser | null;
  isLoading: boolean;
  oauth: { google: boolean; github: boolean };
  authModalOpen: boolean;
  projectsDrawerOpen: boolean;
  cloudProjectId: string | null;
  syncStatus: SyncStatus;

  setAuthModalOpen: (open: boolean) => void;
  setProjectsDrawerOpen: (open: boolean) => void;
  setCloudProjectId: (id: string | null) => void;
  setSyncStatus: (status: SyncStatus) => void;

  fetchMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  syncCloudLibraryAndPrefs: (prefs?: {
    favoritePartIds?: string[];
    recentPartIds?: string[];
  } | null) => Promise<void>;
}

const CLOUD_PROJECT_STORAGE_KEY = "panelflow_cloud_project_id";

function getStoredCloudProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CLOUD_PROJECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveStoredCloudProjectId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      localStorage.setItem(CLOUD_PROJECT_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(CLOUD_PROJECT_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  oauth: { google: false, github: false },
  authModalOpen: false,
  projectsDrawerOpen: false,
  cloudProjectId: getStoredCloudProjectId(),
  syncStatus: "idle",

  setAuthModalOpen: (open) => set({ authModalOpen: open }),
  setProjectsDrawerOpen: (open) => set({ projectsDrawerOpen: open }),
  setCloudProjectId: (id) => {
    saveStoredCloudProjectId(id);
    set({ cloudProjectId: id });
  },
  setSyncStatus: (status) => set({ syncStatus: status }),

  syncCloudLibraryAndPrefs: async (prefs) => {
    if (prefs) {
      const panelStore = usePanelStore.getState();
      const cloudFavs = (prefs.favoritePartIds || []) as ComponentTemplateId[];
      const cloudRecs = (prefs.recentPartIds || []) as ComponentTemplateId[];
      if (cloudFavs.length > 0 || cloudRecs.length > 0) {
        panelStore.setPartPreferences({
          favoritePartIds: cloudFavs,
          recentPartIds: cloudRecs,
        });
      }
    }

    try {
      const res = await fetch("/api/custom-parts");
      if (res.ok) {
        const json = await res.json();
        const parts = Array.isArray(json.parts) ? json.parts : [];
        for (const p of parts) {
          const asset: CustomCadAsset = {
            id: p.id,
            name: p.name,
            fileName: `${p.name}.${p.format || "dxf"}`,
            format: (p.format || "dxf") as CustomCadAsset["format"],
            sourceUnit: "mm",
            xMm: 0,
            yMm: 0,
            zMm: 10,
            rotationDeg: 0,
            boundingBoxMm: p.bounding_box || { w: 60, h: 60, d: 40 },
            pins: Array.isArray(p.pins) ? p.pins : [],
            rawText: typeof p.cad_data === "string" ? p.cad_data : undefined,
          };
          await saveCustomCadToLibrary(asset).catch(() => {});
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("panelflow:custom-library-updated"));
        }
      }
    } catch {
      // ignore offline error
    }
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      set({
        user: data.user || null,
        oauth: data.oauth || { google: false, github: false },
        isLoading: false,
      });
      if (data.user) {
        await get().syncCloudLibraryAndPrefs(data.preferences || null);
      }
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  login: async (email, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || "Login failed" };
      }
      set({ user: data.user, authModalOpen: false });
      await get().fetchMe();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  },

  register: async (email, password, name) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || "Registration failed" };
      }
      set({ user: data.user, authModalOpen: false });
      await get().fetchMe();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      saveStoredCloudProjectId(null);
      set({
        user: null,
        cloudProjectId: null,
        syncStatus: "idle",
        projectsDrawerOpen: false,
      });
    }
  },
}));
