"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { getBackplateDimensions } from "@/lib/template-export";
import { usePanelStore } from "@/store/usePanelStore";

export function Enclosure3D() {
  const enclosure = usePanelStore((s) => s.enclosure);
  const gridSnapMm = usePanelStore((s) => s.gridSnapMm);
  const setSelected = usePanelStore((s) => s.setSelected);

  const { widthMm: W, heightMm: H, depthMm: D, wallThicknessMm: T, backplateThicknessMm: BT, doorMode } =
    enclosure;
  const { widthMm: plateW, heightMm: plateH } = getBackplateDimensions(enclosure);

  // Backplate front face is at z = 0.
  // Enclosure rear wall sits behind backplate (z = -18 - T/2).
  const rearOffset = 18;
  const zBack = -BT - rearOffset;
  const zFront = zBack + D;
  const zCenter = (zBack + zFront) / 2;

  const gridGeometry = useMemo(() => {
    const pts: number[] = [];
    const halfW = plateW / 2;
    const halfH = plateH / 2;
    const step = gridSnapMm;

    for (let x = -Math.floor(halfW / step) * step; x <= halfW; x += step) {
      pts.push(x, -halfH, 0.3, x, halfH, 0.3);
    }
    for (let y = -Math.floor(halfH / step) * step; y <= halfH; y += step) {
      pts.push(-halfW, y, 0.3, halfW, y, 0.3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [plateW, plateH, gridSnapMm]);

  return (
    <group>
      {/* Rear enclosure wall */}
      <mesh position={[0, 0, zBack]} receiveShadow>
        <boxGeometry args={[W, H, T]} />
        <meshStandardMaterial color="#2a313d" metalness={0.55} roughness={0.5} />
      </mesh>

      {/* Left wall */}
      <mesh position={[-W / 2 + T / 2, 0, zCenter]} receiveShadow>
        <boxGeometry args={[T, H, D]} />
        <meshStandardMaterial color="#333b48" metalness={0.55} roughness={0.45} />
      </mesh>

      {/* Right wall */}
      <mesh position={[W / 2 - T / 2, 0, zCenter]} receiveShadow>
        <boxGeometry args={[T, H, D]} />
        <meshStandardMaterial color="#333b48" metalness={0.55} roughness={0.45} />
      </mesh>

      {/* Top wall */}
      <mesh position={[0, H / 2 - T / 2, zCenter]} receiveShadow>
        <boxGeometry args={[W - T * 2, T, D]} />
        <meshStandardMaterial color="#333b48" metalness={0.55} roughness={0.45} />
      </mesh>

      {/* Bottom wall */}
      <mesh position={[0, -H / 2 + T / 2, zCenter]} receiveShadow>
        <boxGeometry args={[W - T * 2, T, D]} />
        <meshStandardMaterial color="#333b48" metalness={0.55} roughness={0.45} />
      </mesh>

      {/* Galvanized Steel Mounting Backplate (front face at z = 0) */}
      <mesh
        position={[0, 0, -BT / 2]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          setSelected(null);
        }}
      >
        <boxGeometry args={[plateW, plateH, BT]} />
        <meshStandardMaterial color="#b9c2ce" metalness={0.72} roughness={0.35} />
      </mesh>

      {/* Snap Grid Overlay on Backplate */}
      <lineSegments geometry={gridGeometry}>
        <lineBasicMaterial color="#64748b" transparent opacity={0.28} />
      </lineSegments>

      {/* Hinged Front Door */}
      {doorMode !== "hidden" && (
        <group
          position={[-W / 2, 0, zFront]}
          rotation={[0, doorMode === "open" ? -Math.PI * 0.62 : 0, 0]}
        >
          <mesh position={[W / 2, 0, 0]}>
            <boxGeometry args={[W, H, T]} />
            {doorMode === "transparent" ? (
              <meshPhysicalMaterial
                color="#93c5fd"
                transparent
                opacity={0.14}
                roughness={0.15}
                metalness={0.1}
                depthWrite={false}
              />
            ) : (
              <meshStandardMaterial
                color="#3b4454"
                metalness={0.55}
                roughness={0.42}
              />
            )}
          </mesh>
          {/* Door Handle Latch */}
          <mesh position={[W - 26, 0, T / 2 + 5]}>
            <boxGeometry args={[14, 70, 10]} />
            <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
}
