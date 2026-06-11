import { Canvas, useFrame } from "@react-three/fiber";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/**
 * three.js "verification constellation": a fibonacci sphere of nodes (sources +
 * articles) that slowly rotates, reacts to the pointer, and — driven by a scroll
 * progress ref from GSAP — disperses and dollies as the reader scrolls the hero.
 */

function Constellation({
  progress,
  dark,
  reduced,
}: {
  progress: MutableRefObject<number>;
  dark: boolean;
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const points = useRef<THREE.Points>(null);

  const { positions, colors, base } = useMemo(() => {
    const N = 2200;
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const base = new Float32Array(N * 3);
    const cRed = new THREE.Color(dark ? "#e0483d" : "#b3261e");
    const cInk = new THREE.Color(dark ? "#84a9d1" : "#1d3a5f");
    const cNeutral = new THREE.Color(dark ? "#ece4d4" : "#6d6353");
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = Math.PI * (3 - Math.sqrt(5)) * i;
      const radius = 2.5 + (Math.random() - 0.5) * 0.18;
      const x = Math.cos(theta) * r * radius;
      const z = Math.sin(theta) * r * radius;
      const yy = y * radius;
      positions.set([x, yy, z], i * 3);
      base.set([x, yy, z], i * 3);
      const pick = Math.random();
      const c = pick < 0.16 ? cRed : pick < 0.36 ? cInk : cNeutral;
      colors.set([c.r, c.g, c.b], i * 3);
    }
    return { positions, colors, base };
  }, [dark]);

  const rings = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) {
      const pts: number[] = [];
      const seg = 128;
      const rad = 2.55;
      const tilt = (k / 3) * Math.PI;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        const v = new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(1, 0, 0.4), tilt);
        pts.push(v.x, v.y, v.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      geos.push(g);
    }
    return geos;
  }, []);

  useFrame((state, delta) => {
    const p = progress.current;
    if (group.current) {
      if (!reduced) group.current.rotation.y += delta * 0.06;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        state.pointer.y * 0.25 + p * 0.6,
        0.06,
      );
      group.current.rotation.z = THREE.MathUtils.lerp(
        group.current.rotation.z,
        state.pointer.x * 0.12,
        0.06,
      );
      const s = 1 + p * 0.9;
      group.current.scale.setScalar(s);
      group.current.position.y = p * 1.2;
    }
    const geo = points.current?.geometry;
    if (geo) {
      const pos = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) {
        const f = 1 + p * (0.4 + ((i % 11) / 11) * 1.1);
        pos[i] = base[i] * f;
        pos[i + 1] = base[i + 1] * f;
        pos[i + 2] = base[i + 2] * f;
      }
      geo.attributes.position.needsUpdate = true;
    }
  });

  const lineColor = dark ? "#322a1f" : "#cfc3ab";

  return (
    <group ref={group}>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={dark ? 0.045 : 0.04}
          sizeAttenuation
          vertexColors
          transparent
          opacity={dark ? 0.95 : 0.85}
          depthWrite={false}
        />
      </points>
      {rings.map((g, i) => (
        <line key={i}>
          <primitive object={g} attach="geometry" />
          <lineBasicMaterial color={lineColor} transparent opacity={0.5} />
        </line>
      ))}
    </group>
  );
}

export function HeroScene({
  progressRef,
  className,
}: {
  progressRef?: MutableRefObject<number>;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const reduced = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);
  const fallbackRef = useRef(0);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className={className} />;
  const dark = resolvedTheme === "dark";

  return (
    <div className={className}>
      <Canvas
        key={dark ? "d" : "l"}
        camera={{ position: [0, 0, 7], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        frameloop={reduced ? "demand" : "always"}
      >
        <Constellation progress={progressRef ?? fallbackRef} dark={dark} reduced={reduced} />
      </Canvas>
    </div>
  );
}
