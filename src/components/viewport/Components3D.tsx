"use client";

import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { usePanelStore } from "@/store/usePanelStore";
import type { PlacedComponent } from "@/types/panel";

const BACKPLATE_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

function ComponentDetail3D({ comp }: { comp: PlacedComponent }) {
  const id = comp.templateId;
  const frontZ = comp.depthMm / 2;

  if (id === "mcb-1p" || id === "mcb-2p" || id === "mcb-3p" || id === "mcb-4p") {
    const poles = id === "mcb-1p" ? 1 : id === "mcb-2p" ? 2 : id === "mcb-3p" ? 3 : 4;
    const poleW = comp.widthMm / poles;
    return (
      <group>
        {/* Toggle handle */}
        <mesh position={[0, -2, frontZ + 3]}>
          <boxGeometry args={[comp.widthMm * 0.78, 8, 6]} />
          <meshStandardMaterial color={comp.accentColor} roughness={0.3} />
        </mesh>
        {/* Status window */}
        <mesh position={[0, 12, frontZ + 0.5]}>
          <boxGeometry args={[comp.widthMm * 0.5, 4, 1]} />
          <meshStandardMaterial color="#16a34a" roughness={0.4} />
        </mesh>
        {/* Pole dividers */}
        {Array.from({ length: poles - 1 }).map((_, i) => (
          <mesh
            key={i}
            position={[-comp.widthMm / 2 + poleW * (i + 1), 0, frontZ + 0.3]}
          >
            <boxGeometry args={[0.8, comp.heightMm * 0.9, 1]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        ))}
      </group>
    );
  }

  if (id === "mccb-100a") {
    return (
      <group>
        <mesh position={[0, 6, frontZ + 4]}>
          <boxGeometry args={[28, 22, 8]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} />
        </mesh>
        <mesh position={[0, 10, frontZ + 10]}>
          <boxGeometry args={[20, 10, 8]} />
          <meshStandardMaterial color={comp.accentColor} roughness={0.3} />
        </mesh>
        <mesh position={[18, -16, frontZ + 1]}>
          <cylinderGeometry args={[3.5, 3.5, 2, 16]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
      </group>
    );
  }

  if (id === "plc-compact") {
    return (
      <group>
        <mesh position={[0, 0, frontZ + 0.8]}>
          <boxGeometry args={[comp.widthMm * 0.9, comp.heightMm * 0.55, 2]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
        {[-12, -4, 4].map((xOff, idx) => (
          <mesh key={idx} position={[xOff, 14, frontZ + 2]}>
            <boxGeometry args={[4, 4, 1.5]} />
            <meshStandardMaterial
              color={idx === 0 ? "#22c55e" : idx === 1 ? "#f59e0b" : "#38bdf8"}
              emissive={idx === 0 ? "#22c55e" : "#000000"}
              emissiveIntensity={0.4}
            />
          </mesh>
        ))}
        <mesh position={[0, -18, frontZ + 1.5]}>
          <boxGeometry args={[comp.widthMm * 0.85, 5, 1.5]} />
          <meshStandardMaterial color={comp.accentColor} />
        </mesh>
      </group>
    );
  }

  if (id === "vfd-15kw") {
    return (
      <group>
        <mesh position={[0, 36, frontZ + 1.5]}>
          <boxGeometry args={[comp.widthMm * 0.72, 46, 3]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} />
        </mesh>
        <mesh position={[0, 44, frontZ + 3.2]}>
          <boxGeometry args={[36, 16, 1]} />
          <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, -32, frontZ + 0.8]}>
          <boxGeometry args={[comp.widthMm * 0.8, 52, 1.5]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      </group>
    );
  }

  if (id === "psu-24v" || id === "psu-24v-10a") {
    return (
      <group>
        <mesh position={[0, 8, frontZ + 0.8]}>
          <boxGeometry args={[comp.widthMm * 0.8, comp.heightMm * 0.5, 1.5]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} />
        </mesh>
        <mesh position={[comp.widthMm * 0.25, -24, frontZ + 1.5]}>
          <cylinderGeometry args={[3, 3, 2, 16]} />
          <meshStandardMaterial color={comp.accentColor} emissive={comp.accentColor} emissiveIntensity={0.35} />
        </mesh>
      </group>
    );
  }

  if (id === "pilot-lamp-red" || id === "pilot-lamp-green") {
    return (
      <group>
        <mesh position={[0, 0, frontZ + 3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[12, 13, 6, 24]} />
          <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, frontZ + 7]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[9.5, 10, 4, 24]} />
          <meshStandardMaterial
            color={comp.accentColor}
            emissive={comp.accentColor}
            emissiveIntensity={0.45}
            roughness={0.2}
          />
        </mesh>
      </group>
    );
  }

  if (id === "push-button" || id === "e-stop" || id === "selector-3pos") {
    const capRadius = id === "e-stop" ? 16 : 11;
    return (
      <group>
        <mesh position={[0, 0, frontZ + 3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[13, 14, 5, 24]} />
          <meshStandardMaterial color="#0f172a" metalness={0.3} roughness={0.4} />
        </mesh>
        {id === "selector-3pos" ? (
          <mesh position={[0, 0, frontZ + 8]} rotation={[0, 0, 0.35]}>
            <boxGeometry args={[6, 20, 8]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.3} />
          </mesh>
        ) : (
          <mesh position={[0, 0, frontZ + 8]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[capRadius, capRadius * 0.9, 7, 24]} />
            <meshStandardMaterial color={comp.accentColor} roughness={0.3} />
          </mesh>
        )}
      </group>
    );
  }

  if (id === "panel-meter-96") {
    return (
      <group>
        <mesh position={[0, 0, frontZ + 1.5]}>
          <boxGeometry args={[86, 86, 3]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} />
        </mesh>
        <mesh position={[0, 6, frontZ + 3.2]}>
          <boxGeometry args={[68, 44, 1]} />
          <meshStandardMaterial color="#0284c7" emissive="#0369a1" emissiveIntensity={0.35} />
        </mesh>
      </group>
    );
  }

  if (id === "cooling-fan-120") {
    return (
      <group>
        <mesh position={[0, 0, frontZ + 1.5]}>
          <boxGeometry args={[112, 112, 3]} />
          <meshStandardMaterial color="#475569" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, frontZ + 3.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[48, 48, 2, 24]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} />
        </mesh>
      </group>
    );
  }

  return (
    <mesh position={[0, 0, frontZ + 1]}>
      <boxGeometry args={[comp.widthMm * 0.72, Math.min(14, comp.heightMm * 0.35), 4]} />
      <meshStandardMaterial color={comp.accentColor} roughness={0.35} />
    </mesh>
  );
}

function ComponentItem3D({
  comp,
  isSelected,
  onDragChange,
  onContextMenu,
}: {
  comp: PlacedComponent;
  isSelected: boolean;
  onDragChange: (dragging: boolean) => void;
  onContextMenu: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const setSelected = usePanelStore((s) => s.setSelected);
  const moveComponent = usePanelStore((s) => s.moveComponent);

  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ dx: 0, dy: 0 });
  const hitPoint = useRef(new THREE.Vector3());

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
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

  const rotRad = ((comp.rotationDeg ?? 0) * Math.PI) / 180;

  return (
    <group
      position={[comp.xMm, comp.yMm, comp.zMm]}
      rotation={[0, 0, -rotRad]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={onContextMenu}
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

      {/* Proportional 3D Component Detail */}
      <ComponentDetail3D comp={comp} />

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
  onContextMenu,
}: {
  onDragChange: (dragging: boolean) => void;
  onContextMenu?: (e: ThreeEvent<MouseEvent>, target: import("@/components/ui/ContextMenu").ContextMenuTarget) => void;
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
          onContextMenu={(e) => {
            if (onContextMenu) {
              e.stopPropagation();
              onContextMenu(e, { kind: "component", id: comp.id });
            }
          }}
        />
      ))}
    </group>
  );
}
