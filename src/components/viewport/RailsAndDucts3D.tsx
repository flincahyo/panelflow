"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import {
  clampToBackplate,
  DIN_RAIL_DEPTH_MM,
  DIN_RAIL_HEIGHT_MM,
  snapToGrid,
} from "@/lib/snap";
import { getBackplateDimensions } from "@/lib/template-export";
import { usePanelStore } from "@/store/usePanelStore";
import type { DinRail, WireDuct } from "@/types/panel";

const BACKPLATE_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

interface Props {
  onDragChange: (dragging: boolean) => void;
  onContextMenu?: (
    e: ThreeEvent<MouseEvent>,
    target: import("@/components/ui/ContextMenu").ContextMenuTarget
  ) => void;
}

function DinRailMesh({
  rail,
  isSelected,
  onDragChange,
  onContextMenu,
}: {
  rail: DinRail;
  isSelected: boolean;
  onDragChange: (dragging: boolean) => void;
  onContextMenu?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const gridSnapMm = usePanelStore((s) => s.gridSnapMm);
  const enclosure = usePanelStore((s) => s.enclosure);
  const setSelected = usePanelStore((s) => s.setSelected);
  const updateRail = usePanelStore((s) => s.updateRail);

  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ dx: 0, dy: 0 });
  const hitPoint = useRef(new THREE.Vector3());

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelected({ kind: "rail", id: rail.id });
    if (e.ray.intersectPlane(BACKPLATE_PLANE, hitPoint.current)) {
      offsetRef.current = {
        dx: rail.xMm - hitPoint.current.x,
        dy: rail.yMm - hitPoint.current.y,
      };
    }
    setDragging(true);
    onDragChange(true);
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging) return;
    e.stopPropagation();
    if (e.ray.intersectPlane(BACKPLATE_PLANE, hitPoint.current)) {
      const { widthMm: plateW, heightMm: plateH } =
        getBackplateDimensions(enclosure);
      const rawX = snapToGrid(
        hitPoint.current.x + offsetRef.current.dx,
        gridSnapMm
      );
      const rawY = snapToGrid(
        hitPoint.current.y + offsetRef.current.dy,
        gridSnapMm
      );
      const clamped = clampToBackplate(
        rawX,
        rawY,
        rail.lengthMm,
        DIN_RAIL_HEIGHT_MM,
        plateW,
        plateH
      );
      updateRail(rail.id, { xMm: clamped.xMm, yMm: clamped.yMm });
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging) return;
    e.stopPropagation();
    setDragging(false);
    onDragChange(false);
  };

  const baseColor = isSelected ? "#38bdf8" : "#d4d8df";

  return (
    <group
      position={[rail.xMm, rail.yMm, 0]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={onContextMenu}
    >
      {/* Back base flange */}
      <mesh position={[0, 0, 1]}>
        <boxGeometry args={[rail.lengthMm, 27, 2]} />
        <meshStandardMaterial color={baseColor} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Top-hat raised channel */}
      <mesh position={[0, 0, DIN_RAIL_DEPTH_MM / 2 + 1]}>
        <boxGeometry args={[rail.lengthMm, 25, DIN_RAIL_DEPTH_MM - 2]} />
        <meshStandardMaterial color={baseColor} metalness={0.75} roughness={0.35} />
      </mesh>
      {/* Outer 35mm DIN lips */}
      <mesh position={[0, 0, DIN_RAIL_DEPTH_MM - 0.75]}>
        <boxGeometry args={[rail.lengthMm, DIN_RAIL_HEIGHT_MM, 1.5]} />
        <meshStandardMaterial color={baseColor} metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
}

function WireDuctMesh({
  duct,
  isSelected,
  onDragChange,
  onContextMenu,
}: {
  duct: WireDuct;
  isSelected: boolean;
  onDragChange: (dragging: boolean) => void;
  onContextMenu?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const gridSnapMm = usePanelStore((s) => s.gridSnapMm);
  const enclosure = usePanelStore((s) => s.enclosure);
  const setSelected = usePanelStore((s) => s.setSelected);
  const updateDuct = usePanelStore((s) => s.updateDuct);

  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ dx: 0, dy: 0 });
  const hitPoint = useRef(new THREE.Vector3());

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelected({ kind: "duct", id: duct.id });
    if (e.ray.intersectPlane(BACKPLATE_PLANE, hitPoint.current)) {
      offsetRef.current = {
        dx: duct.xMm - hitPoint.current.x,
        dy: duct.yMm - hitPoint.current.y,
      };
    }
    setDragging(true);
    onDragChange(true);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging) return;
    e.stopPropagation();
    if (e.ray.intersectPlane(BACKPLATE_PLANE, hitPoint.current)) {
      const { widthMm: plateW, heightMm: plateH } =
        getBackplateDimensions(enclosure);
      const rawX = snapToGrid(
        hitPoint.current.x + offsetRef.current.dx,
        gridSnapMm
      );
      const rawY = snapToGrid(
        hitPoint.current.y + offsetRef.current.dy,
        gridSnapMm
      );
      const clamped = clampToBackplate(
        rawX,
        rawY,
        duct.widthMm,
        duct.heightMm,
        plateW,
        plateH
      );
      updateDuct(duct.id, { xMm: clamped.xMm, yMm: clamped.yMm });
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging) return;
    e.stopPropagation();
    setDragging(false);
    onDragChange(false);
  };

  const color = isSelected ? "#38bdf8" : "#64748b";

  return (
    <group
      position={[duct.xMm, duct.yMm, duct.depthMm / 2]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={onContextMenu}
    >
      <mesh>
        <boxGeometry args={[duct.widthMm, duct.heightMm, duct.depthMm]} />
        <meshStandardMaterial
          color={color}
          metalness={0.15}
          roughness={0.65}
          transparent
          opacity={0.88}
        />
      </mesh>
      {/* Front cover accent */}
      <mesh position={[0, 0, duct.depthMm / 2 + 0.5]}>
        <boxGeometry args={[duct.widthMm - 4, duct.heightMm - 4, 1]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.5} />
      </mesh>
    </group>
  );
}

export function RailsAndDucts3D({ onDragChange, onContextMenu }: Props) {
  const rails = usePanelStore((s) => s.rails);
  const ducts = usePanelStore((s) => s.ducts);
  const selected = usePanelStore((s) => s.selected);

  return (
    <group>
      {rails.map((rail) => (
        <DinRailMesh
          key={rail.id}
          rail={rail}
          isSelected={selected?.kind === "rail" && selected.id === rail.id}
          onDragChange={onDragChange}
          onContextMenu={(e) => {
            if (onContextMenu) {
              e.stopPropagation();
              onContextMenu(e, { kind: "rail", id: rail.id });
            }
          }}
        />
      ))}
      {ducts.map((duct) => (
        <WireDuctMesh
          key={duct.id}
          duct={duct}
          isSelected={selected?.kind === "duct" && selected.id === duct.id}
          onDragChange={onDragChange}
          onContextMenu={(e) => {
            if (onContextMenu) {
              e.stopPropagation();
              onContextMenu(e, { kind: "duct", id: duct.id });
            }
          }}
        />
      ))}
    </group>
  );
}
