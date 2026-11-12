"use client";

import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { usePanelStore } from "@/store/usePanelStore";
import type { PlacedComponent } from "@/types/panel";

const BACKPLATE_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

function ComponentItem3D({
  comp,
  isSelected,
  onDragChange,
}: {
  comp: PlacedComponent;
  isSelected: boolean;
  onDragChange: (dragging: boolean) => void;
}) {
  const setSelected = usePanelStore((s) => s.setSelected);
  const moveComponent = usePanelStore((s) => s.moveComponent);

  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ dx: 0, dy: 0 });
  const hitPoint = useRef(new THREE.Vector3());

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setSelected({ kind: "component", id: comp.id });
    if (e.ray.intersectPlane(BACKPLATE_PLANE, hitPoint.current)) {
      offsetRef.current = {
        dx: comp.xMm - hitPoint.current.x,
        dy: comp.yMm - hitPoint.current.y,
      };
    }
    setDragging(true);
    onDragChange(true);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging) return;
    e.stopPropagation();
    if (e.ray.intersectPlane(BACKPLATE_PLANE, hitPoint.current)) {
      moveComponent(
        comp.id,
        hitPoint.current.x + offsetRef.current.dx,
        hitPoint.current.y + offsetRef.current.dy
      );
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging) return;
    e.stopPropagation();
    setDragging(false);
    onDragChange(false);
  };

  return (
    <group
      position={[comp.xMm, comp.yMm, comp.zMm]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Main body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[comp.widthMm, comp.heightMm, comp.depthMm]} />
        <meshStandardMaterial
          color={comp.color}
          roughness={0.45}
          metalness={0.15}
        />
      </mesh>

      {/* Selection wireframe highlight */}
      {isSelected && (
        <mesh>
          <boxGeometry
            args={[comp.widthMm + 2, comp.heightMm + 2, comp.depthMm + 2]}
          />
          <meshBasicMaterial color="#38bdf8" wireframe />
        </mesh>
      )}

      {/* Front Accent / Toggle / Breaker Face */}
      <mesh position={[0, 0, comp.depthMm / 2 + 1]}>
        <boxGeometry args={[comp.widthMm * 0.72, 14, 4]} />
        <meshStandardMaterial color={comp.accentColor} roughness={0.35} />
      </mesh>

      {/* Pin Terminals */}
      {comp.pins.map((pin) => (
        <group
          key={pin.id}
          position={[pin.localXMm, pin.localYMm, pin.localZMm]}
        >
          <mesh>
            <cylinderGeometry args={[2.2, 2.2, 4, 12]} />
            <meshStandardMaterial
              color="#f59e0b"
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
          {isSelected && (
            <Html
              center
              distanceFactor={600}
              position={[0, 0, 8]}
              style={{ pointerEvents: "none" }}
            >
              <span className="rounded bg-slate-950/90 px-1 py-0.5 font-mono text-[9px] font-semibold text-amber-300 border border-amber-500/40 whitespace-nowrap">
                {pin.label}
              </span>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}

export function Components3D({
  onDragChange,
}: {
  onDragChange: (dragging: boolean) => void;
}) {
  const components = usePanelStore((s) => s.components);
  const selected = usePanelStore((s) => s.selected);

  return (
    <group>
      {components.map((comp) => (
        <ComponentItem3D
          key={comp.id}
          comp={comp}
          isSelected={
            selected?.kind === "component" && selected.id === comp.id
          }
          onDragChange={onDragChange}
        />
      ))}
    </group>
  );
}
