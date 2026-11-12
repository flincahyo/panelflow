"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { LeftSidebar } from "@/components/ui/LeftSidebar";
import { RightInspector } from "@/components/ui/RightInspector";
import { SheetTabs } from "@/components/ui/SheetTabs";
import { TopToolbar } from "@/components/ui/TopToolbar";
import { Panel2DCanvas } from "@/components/viewport/Panel2DCanvas";
import { usePanelStore } from "@/store/usePanelStore";

const PanelViewport = dynamic(
  () =>
    import("@/components/viewport/PanelViewport").then(
      (mod) => mod.PanelViewport
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#f1f5f9] dark:bg-[#090b10] font-mono text-xs text-[#64748b] dark:text-slate-400">
        INITIALIZING 3D CAD ENGINE...
      </div>
    ),
  }
);

export function PanelWorkbench() {
  const viewportMode = usePanelStore((s) => s.viewportMode);
  const setTheme = usePanelStore((s) => s.setTheme);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  // Sync theme from localStorage on initial client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("panelflow_saved_theme");
      if (saved === "light" || saved === "dark") {
        setTheme(saved);
      }
    } catch {
      // storage unavailable
    }
  }, [setTheme]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#f8fafc] dark:bg-[#090b10] text-[#0f172a] dark:text-slate-100 antialiased select-none">
      <TopToolbar
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((v) => !v)}
      />
      <main className="flex min-h-0 flex-1 overflow-hidden">
        <LeftSidebar />
        <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-[#090b10]">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {viewportMode === "3d" ? <PanelViewport /> : <Panel2DCanvas />}
          </div>
          <SheetTabs />
        </section>
        {inspectorOpen && <RightInspector onClose={() => setInspectorOpen(false)} />}
      </main>
    </div>
  );
}
