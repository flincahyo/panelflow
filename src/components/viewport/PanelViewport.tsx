"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useRef, useState } from "react";
import { ContextMenu, type ContextMenuState, type ContextMenuTarget } from "@/components/ui/ContextMenu";
import { Components3D } from "@/components/viewport/Components3D";
import { CustomCad3D } from "@/components/viewport/CustomCad3D";
import { Enclosure3D } from "@/components/viewport/Enclosure3D";
import { RailsAndDucts3D } from "@/components/viewport/RailsAndDucts3D";
import { formatDim } from "@/lib/units";
import { usePanelStore } from "@/store/usePanelStore";

export function PanelViewport() {
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const meshContextHandledRef = useRef(false);

  const displayUnit = usePanelStore((s) => s.displayUnit);
  const gridSnapMm = usePanelStore((s) => s.gridSnapMm);
  const enclosure = usePanelStore((s) => s.enclosure);
  const isPinMarkingMode = usePanelStore((s) => s.isPinMarkingMode);
  const setSelected = usePanelStore((s) => s.setSelected);

  const handle3DContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>, target: ContextMenuTarget) => {
      e.nativeEvent.preventDefault();
      meshContextHandledRef.current = true;
      if (
        target.kind === "component" ||
        target.kind === "rail" ||
        target.kind === "duct" ||
        target.kind === "cad"
      ) {
        setSelected({ kind: target.kind, id: target.id });
      }
      setContextMenu({
        x: e.nativeEvent.clientX,
        y: e.nativeEvent.clientY,
        target,
      });
    },
    [setSelected]
  );

  return (
    <div
      className="relative h-full w-full bg-[#0d1016] select-none"
      onContextMenu={(e) => {
        e.preventDefault();
        if (meshContextHandledRef.current) {
          meshContextHandledRef.current = false;
          return;
        }
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          target: { kind: "canvas", worldPos: { xMm: 0, yMm: 0 } },
        });
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{ powerPreference: "high-performance", antialias: true }}
        shadows
        camera={{ position: [480, 180, 1180], fov: 38, near: 2, far: 25000 }}
      >
        <color attach="background" args={["#0d1016"]} />
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[600, 900, 1000]}
          intensity={1.35}
          castShadow
        />
        <directionalLight position={[-600, -400, 700]} intensity={0.45} />

        <Enclosure3D />
        <RailsAndDucts3D
          onDragChange={setIsDraggingItem}
          onContextMenu={handle3DContextMenu}
        />
        <Components3D
          onDragChange={setIsDraggingItem}
          onContextMenu={handle3DContextMenu}
        />
        <CustomCad3D onContextMenu={handle3DContextMenu} />

        <OrbitControls
          makeDefault
          enabled={!isDraggingItem}
          enableDamping
          dampingFactor={0.08}
          minDistance={180}
          maxDistance={4000}
        />
      </Canvas>

      {/* Crisp CAD HUD Status Bar */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-300">
        <span className="rounded border border-slate-700/80 bg-slate-900/85 px-2 py-1">
          ENCLOSURE: {formatDim(enclosure.widthMm, displayUnit)} ×{" "}
          {formatDim(enclosure.heightMm, displayUnit)} ×{" "}
          {formatDim(enclosure.depthMm, displayUnit)}
        </span>
        <span className="rounded border border-slate-700/80 bg-slate-900/85 px-2 py-1">
          GRID SNAP: {formatDim(gridSnapMm, displayUnit)}
        </span>
        {isPinMarkingMode && (
          <span className="rounded border border-amber-500/70 bg-amber-950/90 px-2 py-1 text-amber-300 font-semibold">
            PIN MARKER ACTIVE — CLICK MESH SURFACE TO PLACE PIN
          </span>
        )}
      </div>

      <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
    </div>
  );
}
