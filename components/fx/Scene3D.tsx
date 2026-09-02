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
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 5, 3]} intensity={1.4} color="#6ec1e4" />
        <pointLight position={[-4, -2, 2]} intensity={40} color="#0a7bab" />

        <Float speed={1.1} rotationIntensity={1.4} floatIntensity={1.2}>
          <Icosahedron args={[1.05, 6]} position={[3.15, -0.2, -0.8]}>
            <MeshDistortMaterial color="#0a7bab" emissive="#00344d" emissiveIntensity={0.3} distort={0.32} speed={1.5} roughness={0.28} />
          </Icosahedron>
        </Float>

        <Parcel position={[3.9, 1.7, -0.8]} color="#6ec1e4" scale={0.6} />
        <Parcel position={[4.2, -1.2, -0.6]} color="#ff8f00" scale={0.72} />
        <Parcel position={[1.6, 1.9, -1.4]} color="#0693e3" scale={0.5} />
        <Parcel position={[2.0, -1.9, -1.1]} color="#005a84" scale={0.55} />
      </Canvas>
    </div>
  );
}
