"use client";

import dynamic from "next/dynamic";
import { LeftSidebar } from "@/components/ui/LeftSidebar";
import { RightInspector } from "@/components/ui/RightInspector";
import { TopToolbar } from "@/components/ui/TopToolbar";

const PanelViewport = dynamic(
  () =>
    import("@/components/viewport/PanelViewport").then(
      (mod) => mod.PanelViewport
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#0d1016] font-mono text-xs text-slate-400">
        INITIALIZING 3D CAD ENGINE...
      </div>
    ),
  }
);

export function PanelWorkbench() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0d1016]">
      <TopToolbar />
      <main className="flex min-h-0 flex-1">
        <LeftSidebar />
        <section className="relative min-w-0 flex-1">
          <PanelViewport />
        </section>
        <RightInspector />
      </main>
    </div>
  );
}
