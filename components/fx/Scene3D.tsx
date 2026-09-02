'use client';

import { Canvas } from '@react-three/fiber';
import { Float, RoundedBox, MeshDistortMaterial, Icosahedron } from '@react-three/drei';
import { useReducedMotion, useLowPower } from './useReducedMotion';

/**
 * Lightweight floating-parcels hero scene. No shadows, capped DPR, three light
 * sources only. Rendered client-side and skipped on reduced-motion / low-power
 * devices (caller should also next/dynamic({ ssr:false }) this).
 */
function Parcel({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) {
  return (
    <Float speed={1.4} rotationIntensity={1.1} floatIntensity={1.6} position={position}>
      <RoundedBox args={[1, 1, 1]} radius={0.12} smoothness={4} scale={scale}>
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.15} />
      </RoundedBox>
    </Float>
  );
}

export default function Scene3D({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const low = useLowPower();
  if (reduced || low) return null;

  return (
    <div className={className} style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }} aria-hidden>
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 5, 3]} intensity={1.3} color="#a58bff" />
        <pointLight position={[-4, -2, 2]} intensity={40} color="#22d3ee" />

        <Float speed={1.1} rotationIntensity={1.4} floatIntensity={1.2}>
          <Icosahedron args={[1.4, 6]} position={[0, 0, 0]}>
            <MeshDistortMaterial color="#7c5cff" emissive="#4321a8" emissiveIntensity={0.35} distort={0.34} speed={1.6} roughness={0.25} />
          </Icosahedron>
        </Float>

        <Parcel position={[-2.6, 1.1, -0.5]} color="#22d3ee" scale={0.7} />
        <Parcel position={[2.7, -0.8, -0.4]} color="#f472b6" scale={0.85} />
        <Parcel position={[2.1, 1.6, -1.2]} color="#a58bff" scale={0.55} />
        <Parcel position={[-2.3, -1.5, -1]} color="#f5a524" scale={0.6} />
      </Canvas>
    </div>
  );
}
