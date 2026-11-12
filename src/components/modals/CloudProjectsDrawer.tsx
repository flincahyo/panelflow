"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Cloud,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { rehydrateCadAssets } from "@/lib/project-io";
import { useAuthStore, type CloudProjectSummary } from "@/store/useAuthStore";
import { usePanelStore } from "@/store/usePanelStore";

export function CloudProjectsDrawer() {
  const user = useAuthStore((s) => s.user);
  const open = useAuthStore((s) => s.projectsDrawerOpen);
  const setOpen = useAuthStore((s) => s.setProjectsDrawerOpen);
  const cloudProjectId = useAuthStore((s) => s.cloudProjectId);
  const setCloudProjectId = useAuthStore((s) => s.setCloudProjectId);
  const setSyncStatus = useAuthStore((s) => s.setSyncStatus);

  const loadProjectState = usePanelStore((s) => s.loadProjectState);
  const sheets = usePanelStore((s) => s.sheets);
  const activeSheetId = usePanelStore((s) => s.activeSheetId);
  const displayUnit = usePanelStore((s) => s.displayUnit);
  const gridSnapMm = usePanelStore((s) => s.gridSnapMm);
  const autoRouteDuctsEnabled = usePanelStore((s) => s.autoRouteDuctsEnabled);
  const titleBlock = usePanelStore((s) => s.titleBlock);

  const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load projects");
      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open && user) {
      fetchProjects();
    }
  }, [open, user, fetchProjects]);

  if (!open || !user) return null;

  const handleSaveAsNew = async () => {
    setSavingNew(true);
    setError(null);
    setSyncStatus("saving");
    try {
      const cleanSheets = sheets.map((sheet) => ({
        ...sheet,
        cadAssets: sheet.cadAssets.map(({ objectUrl: _omitted, ...rest }) => rest),
      }));
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: titleBlock.projectName || "PanelFlow Project",
          data: {
            sheets: cleanSheets,
            activeSheetId,
            displayUnit,
            gridSnapMm,
            autoRouteDuctsEnabled,
            titleBlock,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save project");
      if (data.project?.id) {
        setCloudProjectId(data.project.id);
      }
      setSyncStatus("saved");
      await fetchProjects();
    } catch (err) {
      setSyncStatus("error");
      setError(err instanceof Error ? err.message : "Failed to save project");
    } finally {
      setSavingNew(false);
    }
  };

  const handleOpenProject = async (id: string) => {
    setOpeningId(id);
    setError(null);
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open project");
      const projData = data.project?.data;
      if (!projData || !Array.isArray(projData.sheets)) {
        throw new Error("Invalid cloud project payload");
      }
      loadProjectState({
        sheets: rehydrateCadAssets(projData.sheets),
        activeSheetId: projData.activeSheetId,
        displayUnit: projData.displayUnit,
        gridSnapMm: projData.gridSnapMm,
        autoRouteDuctsEnabled: projData.autoRouteDuctsEnabled,
        titleBlock: projData.titleBlock,
      });
      setCloudProjectId(id);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open project");
    } finally {
      setOpeningId(null);
    }
  };

  const handleDeleteProject = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      if (cloudProjectId === id) {
        setCloudProjectId(null);
      }
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <aside className="flex h-full w-full max-w-md flex-col border-l border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#111318] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Cloud className="h-4.5 w-4.5 text-sky-500 dark:text-sky-400" />
            <div>
              <h2 className="text-sm font-semibold text-[#0f172a] dark:text-white">
                My Cloud Projects
              </h2>
              <p className="text-[11px] text-[#64748b] dark:text-slate-400">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={fetchProjects}
              title="Refresh"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e2e8f0] dark:border-white/10 text-[#64748b] dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-white/10"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#64748b] dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-b border-[#e2e8f0] dark:border-white/10 px-5 py-3">
          <button
            type="button"
            disabled={savingNew}
            onClick={handleSaveAsNew}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] dark:bg-white text-xs font-semibold text-white dark:text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {savingNew ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Save Current Workbench as New Cloud Project
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading && projects.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-xs text-[#64748b] dark:text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading cloud projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#cbd5e1] dark:border-white/10 p-6 text-center text-xs text-[#64748b] dark:text-slate-400">
              No cloud projects saved yet. Click above or edit your panel to auto-save.
            </div>
          ) : (
            projects.map((proj) => {
              const isActive = proj.id === cloudProjectId;
              return (
                <div
                  key={proj.id}
                  className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                    isActive
                      ? "border-sky-400 dark:border-sky-500/50 bg-sky-50/60 dark:bg-sky-500/10"
                      : "border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21]"
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-[#0f172a] dark:text-white">
                        {proj.name}
                      </span>
                      {isActive && (
                        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-sky-600 dark:text-sky-400">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-[#64748b] dark:text-slate-400">
                      Updated {new Date(proj.updated_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={openingId === proj.id}
                      onClick={() => handleOpenProject(proj.id)}
                      className="flex h-7 items-center gap-1 rounded-lg border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#0c0e14] px-2.5 text-[11px] font-medium text-[#0f172a] dark:text-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-white/10"
                    >
                      {openingId === proj.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FolderOpen className="h-3 w-3 text-sky-500" />
                      )}
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(proj.id)}
                      title="Delete Cloud Project"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e2e8f0] dark:border-white/10 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/15"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
