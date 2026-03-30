import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  stormNodes,
  speechEvents,
  aggregatedEdges,
  MOOD_COLORS,
  type StormNode as StormNodeData,
  type SpeechEvent,
  type AggregatedEdge,
  type Mood,
} from '../data/stormMockData';

// ══════════════════════════════════════════════
//  Types
// ══════════════════════════════════════════════

interface ForceGraphProps {
  focusNodeId: string | null;
  selectedMeeting: string | 'all';
  onNodeClick: (node: any) => void;
}

interface BoltEntry {
  id: string;
  event: SpeechEvent;
  birth: number;
  travelS?: number;
  collisionFrac?: number;
}

type ViewMode = 'summary' | 'timeline';

// ══════════════════════════════════════════════
//  Constants
// ══════════════════════════════════════════════

const BG_COLOR = '#faf9f7';
const FOG_COLOR = '#f0ede6';
const NODE_BASE_RADIUS = 0.16;
const BOLT_SEGMENTS = 14;
const SPARK_COUNT = 14;
const PULSE_TRAVEL_S = 1.4;
const PULSE_FADE_S = 0.4;
const INTERRUPT_FRAC = 0.55;
const EVENT_INTERVAL_S = 1.8;
const EXPLOSION_COUNT = 35;
const EXPLOSION_S = 0.7;
const PULSE_LENGTH_MIN = 0.18;
const PULSE_LENGTH_MAX = 0.40;
const SUMMARY_PULSE_PERIOD = 4;
const SUMMARY_PULSE_LEN = 0.25;
const SUMMARY_PULSE_OPACITY = 0.5;

// ══════════════════════════════════════════════
//  Noise utility
// ══════════════════════════════════════════════

function fbm(x: number, y: number, z: number): number {
  let v = 0;
  v += Math.sin(x * 1.27 + y * 3.41 + z * 2.17) * 0.50;
  v += Math.sin(x * 4.13 + y * 1.79 + z * 5.31) * 0.25;
  v += Math.sin(x * 7.93 + y * 6.47 + z * 3.89) * 0.125;
  return v;
}

// ══════════════════════════════════════════════
//  Fibonacci sphere layout
// ══════════════════════════════════════════════

function computeForceLayout(): Map<string, THREE.Vector3> {
  const N = stormNodes.length;
  const R = 3.2;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  const positions = new Map<string, THREE.Vector3>();
  stormNodes.forEach((node, i) => {
    const y = N > 1 ? 1 - (2 * i) / (N - 1) : 0;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;

    positions.set(
      node.id,
      new THREE.Vector3(
        Math.cos(theta) * radiusAtY * R,
        y * R,
        Math.sin(theta) * radiusAtY * R,
      ),
    );
  });

  return positions;
}

// ══════════════════════════════════════════════
//  BackgroundGrid — polar grid for spatial reference
// ══════════════════════════════════════════════

function BackgroundGrid() {
  const rings = useMemo(() => {
    const radii = [2, 3.5, 5.5];
    const segs = 64;
    return radii.map((r) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      return pts;
    });
  }, []);

  const radials = useMemo(() => {
    const count = 8;
    const outerR = 6;
    const lines: THREE.Vector3[][] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      lines.push([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(a) * outerR, 0, Math.sin(a) * outerR),
      ]);
    }
    return lines;
  }, []);

  return (
    <group position={[0, -2.5, 0]} rotation={[-Math.PI * 0.05, 0, 0]}>
      {rings.map((pts, i) => (
        <Line key={`ring-${i}`} points={pts} color="#c8c3b8" lineWidth={0.6} transparent opacity={0.12} depthWrite={false} />
      ))}
      {radials.map((pts, i) => (
        <Line key={`rad-${i}`} points={pts} color="#c8c3b8" lineWidth={0.5} transparent opacity={0.08} depthWrite={false} />
      ))}
    </group>
  );
}

// ══════════════════════════════════════════════
//  StormNode — metallic icosahedron + noise displacement
// ══════════════════════════════════════════════

function StormNode({
  data,
  position,
  dimmed,
  selected,
  slowBreath,
  onClick,
  colorOverride,
}: {
  data: StormNodeData;
  position: THREE.Vector3;
  dimmed: boolean;
  selected: boolean;
  slowBreath: boolean;
  onClick: () => void;
  colorOverride?: string;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);
  const origPos = useRef<Float32Array | null>(null);
  const effectiveColor = colorOverride || data.color;
  const color = useMemo(() => new THREE.Color(effectiveColor), [effectiveColor]);

  const radiusScale = Math.sqrt(data.speakCount) / 4;
  const radius = NODE_BASE_RADIUS * Math.max(0.7, Math.min(1.6, radiusScale));

  useEffect(() => {
    if (!meshRef.current) return;
    const geo = meshRef.current.geometry;
    origPos.current = new Float32Array(geo.attributes.position.array);
  }, []);

  useFrame((state) => {
    if (!meshRef.current || !origPos.current) return;
    const t = state.clock.elapsedTime;
    const geo = meshRef.current.geometry;
    const pos = geo.attributes.position;
    const orig = origPos.current;
    const speed = slowBreath ? 0.3 : 0.6;

    for (let i = 0; i < pos.count; i++) {
      const ox = orig[i * 3];
      const oy = orig[i * 3 + 1];
      const oz = orig[i * 3 + 2];
      const len = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
      const nx = ox / len;
      const ny = oy / len;
      const nz = oz / len;
      const disp =
        fbm(ox * 3.5 + t * speed, oy * 3.5 + t * speed * 0.7, oz * 3.5 + t * speed * 1.3) *
        0.12 * radius;
      pos.setXYZ(i, ox + nx * disp, oy + ny * disp, oz + nz * disp);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const breathSpeed = slowBreath ? 1.1 : 2.2;
    const pulse = 1 + Math.sin(t * breathSpeed + data.speakCount) * 0.06;
    groupRef.current.scale.setScalar(pulse);
  });

  const opacity = dimmed ? 0.2 : 1;

  return (
    <group ref={groupRef} position={position.toArray()}>
      <mesh ref={meshRef} onClick={onClick}>
        <icosahedronGeometry args={[radius, 3]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 0.8 : 0.35}
          metalness={0.85}
          roughness={0.35}
          transparent
          opacity={opacity}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius * 1.4, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={dimmed ? 0.03 : selected ? 0.16 : 0.08}
          depthWrite={false}
        />
      </mesh>

      <SparkCloud color={effectiveColor} radius={radius} dimmed={dimmed} />

      {!dimmed && (
        <Html
          position={[0, radius + 0.18, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              color: '#1a1a1a',
              fontFamily: "Georgia, 'Songti SC', serif",
              fontSize: 10,
              opacity: 0.75,
              whiteSpace: 'nowrap',
              userSelect: 'none',
              textShadow: '0 0 4px rgba(250,249,247,0.8)',
            }}
          >
            {data.name}
          </div>
        </Html>
      )}
    </group>
  );
}

// ══════════════════════════════════════════════
//  SparkCloud
// ══════════════════════════════════════════════

function SparkCloud({
  color,
  radius,
  dimmed,
}: {
  color: string;
  radius: number;
  dimmed: boolean;
}) {
  const ref = useRef<THREE.Points>(null!);
  const velocities = useRef<Float32Array>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(SPARK_COUNT * 3);
    const vel = new Float32Array(SPARK_COUNT * 3);
    for (let i = 0; i < SPARK_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (1.3 + Math.random() * 0.6);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
      vel[i * 3] = (Math.random() - 0.5) * 0.015;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.015;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.015;
    }
    velocities.current = vel;
    return arr;
  }, [radius]);

  useFrame(() => {
    if (!ref.current || dimmed) return;
    const pos = ref.current.geometry.attributes.position;
    const vel = velocities.current;
    const maxR = radius * 2.2;
    for (let i = 0; i < SPARK_COUNT; i++) {
      let x = pos.getX(i) + vel[i * 3];
      let y = pos.getY(i) + vel[i * 3 + 1];
      let z = pos.getZ(i) + vel[i * 3 + 2];
      const dist = Math.sqrt(x * x + y * y + z * z);
      if (dist > maxR) {
        const s = maxR / dist;
        x *= s; y *= s; z *= s;
        vel[i * 3] *= -0.5;
        vel[i * 3 + 1] *= -0.5;
        vel[i * 3 + 2] *= -0.5;
      }
      vel[i * 3] += (Math.random() - 0.5) * 0.002;
      vel[i * 3 + 1] += (Math.random() - 0.5) * 0.002;
      vel[i * 3 + 2] += (Math.random() - 0.5) * 0.002;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  });

  const colorObj = useMemo(() => new THREE.Color(color), [color]);

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={SPARK_COUNT}
        />
      </bufferGeometry>
      <pointsMaterial
        color={colorObj}
        size={0.02}
        transparent
        opacity={dimmed ? 0.05 : 0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

// ══════════════════════════════════════════════
//  StaticEdge — permanent connection line
// ══════════════════════════════════════════════

function StaticEdge({
  edge,
  fromPos,
  toPos,
}: {
  edge: AggregatedEdge;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
}) {
  const color = useMemo(
    () => new THREE.Color(MOOD_COLORS[edge.dominantMood]),
    [edge.dominantMood],
  );
  const pts = useMemo(() => [fromPos, toPos], [fromPos, toPos]);
  const width = Math.max(0.8, Math.min(1.8, edge.count * 0.35));

  return (
    <Line
      points={pts}
      color={color}
      lineWidth={width}
      transparent
      opacity={0.3}
      depthWrite={false}
    />
  );
}

// ══════════════════════════════════════════════
//  ElectricBolt — sliding pulse along an edge
// ══════════════════════════════════════════════

function ElectricBolt({
  event,
  birth,
  fromPos,
  toPos,
  onDone,
  travelS = PULSE_TRAVEL_S,
  collisionFrac = INTERRUPT_FRAC,
}: {
  event: SpeechEvent;
  birth: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  onDone: () => void;
  travelS?: number;
  collisionFrac?: number;
}) {
  const coreRef = useRef<any>(null);
  const glowRef = useRef<any>(null);
  const doneRef = useRef(false);
  const moodColor = useMemo(() => new THREE.Color(MOOD_COLORS[event.mood]), [event.mood]);

  const direction = useMemo(
    () => new THREE.Vector3().subVectors(toPos, fromPos),
    [fromPos, toPos],
  );
  const { perpA, perpB } = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0);
    const a = new THREE.Vector3().crossVectors(direction, up).normalize();
    if (a.lengthSq() < 0.001) a.crossVectors(direction, new THREE.Vector3(1, 0, 0)).normalize();
    const b = new THREE.Vector3().crossVectors(direction, a).normalize();
    return { perpA: a, perpB: b };
  }, [direction]);

  const seed = useMemo(() => Math.random() * 1000, []);
  const pulseLen = PULSE_LENGTH_MIN + ((event.duration - 15) / 30) * (PULSE_LENGTH_MAX - PULSE_LENGTH_MIN);
  const clampedPulseLen = Math.max(PULSE_LENGTH_MIN, Math.min(PULSE_LENGTH_MAX, pulseLen));

  const totalDuration = event.interrupted
    ? travelS * collisionFrac + EXPLOSION_S
    : travelS + PULSE_FADE_S;

  const jitterScale = 0.06 + (event.duration / 50) * 0.04;
  const lineWidth = Math.max(2, (event.duration / 45) * 3.5);

  const explosionRef = useRef<{
    origin: THREE.Vector3;
    positions: Float32Array;
    velocities: Float32Array;
  } | null>(null);
  const explosionPtsRef = useRef<THREE.Points>(null!);

  const dummyPts = useMemo(
    () => [new THREE.Vector3(), new THREE.Vector3(0.01, 0, 0)],
    [],
  );

  useFrame((state) => {
    const age = state.clock.elapsedTime - birth;
    const t = state.clock.elapsedTime;

    if (age > totalDuration + 0.1 && !doneRef.current) {
      doneRef.current = true;
      onDone();
      return;
    }

    let headFrac: number;
    let alpha: number;
    let explodeProgress = 0;

    if (event.interrupted) {
      const extEnd = travelS * collisionFrac;
      if (age < extEnd) {
        headFrac = (age / extEnd) * collisionFrac;
        alpha = 1;
      } else {
        headFrac = collisionFrac;
        explodeProgress = Math.min(1, (age - extEnd) / EXPLOSION_S);
        alpha = Math.max(0, 1 - explodeProgress * 1.5);

        if (!explosionRef.current) {
          const origin = new THREE.Vector3().lerpVectors(fromPos, toPos, collisionFrac);
          const count = EXPLOSION_COUNT;
          const pos = new Float32Array(count * 3);
          const vel = new Float32Array(count * 3);
          for (let i = 0; i < count; i++) {
            pos[i * 3] = origin.x;
            pos[i * 3 + 1] = origin.y;
            pos[i * 3 + 2] = origin.z;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const spd = 0.03 + Math.random() * 0.07;
            vel[i * 3] = spd * Math.sin(phi) * Math.cos(theta);
            vel[i * 3 + 1] = spd * Math.sin(phi) * Math.sin(theta);
            vel[i * 3 + 2] = spd * Math.cos(phi);
          }
          explosionRef.current = { origin, positions: pos, velocities: vel };
        }
      }
    } else {
      if (age < travelS) {
        headFrac = age / travelS;
        alpha = 1;
      } else {
        headFrac = 1;
        alpha = Math.max(0, 1 - (age - travelS) / PULSE_FADE_S);
      }
    }

    const tailFrac = Math.max(0, headFrac - clampedPulseLen);

    const pts: number[] = [];
    for (let i = 0; i <= BOLT_SEGMENTS; i++) {
      const localFrac = i / BOLT_SEGMENTS;
      const edgeFrac = tailFrac + localFrac * (headFrac - tailFrac);
      const base = new THREE.Vector3().lerpVectors(fromPos, toPos, edgeFrac);

      if (i > 0 && i < BOLT_SEGMENTS) {
        const nA = Math.sin(seed + localFrac * 17.3 + t * 14) *
                    Math.cos(seed + localFrac * 11.7 + t * 9);
        const nB = Math.cos(seed + localFrac * 13.1 + t * 11) *
                    Math.sin(seed + localFrac * 19.3 + t * 7.5);
        base.addScaledVector(perpA, nA * jitterScale);
        base.addScaledVector(perpB, nB * jitterScale);
      }
      pts.push(base.x, base.y, base.z);
    }

    coreRef.current?.geometry?.setPositions?.(pts);
    glowRef.current?.geometry?.setPositions?.(pts);

    if (coreRef.current?.material) coreRef.current.material.opacity = alpha;
    if (glowRef.current?.material) glowRef.current.material.opacity = alpha * 0.5;

    if (explosionRef.current && explosionPtsRef.current) {
      const exp = explosionRef.current;
      const attr = explosionPtsRef.current.geometry.attributes.position;
      for (let i = 0; i < EXPLOSION_COUNT; i++) {
        exp.positions[i * 3] += exp.velocities[i * 3];
        exp.positions[i * 3 + 1] += exp.velocities[i * 3 + 1];
        exp.positions[i * 3 + 2] += exp.velocities[i * 3 + 2];
        attr.setXYZ(i, exp.positions[i * 3], exp.positions[i * 3 + 1], exp.positions[i * 3 + 2]);
      }
      attr.needsUpdate = true;
      const mat = explosionPtsRef.current.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, 1 - explodeProgress) * 0.85;
      explosionPtsRef.current.visible = true;
    }
  });

  const explosionPositions = useMemo(() => new Float32Array(EXPLOSION_COUNT * 3), []);

  return (
    <group>
      <Line
        ref={glowRef}
        points={dummyPts}
        color={moodColor}
        lineWidth={lineWidth * 2.2}
        transparent
        opacity={0}
        depthWrite={false}
      />
      <Line
        ref={coreRef}
        points={dummyPts}
        color={moodColor}
        lineWidth={lineWidth}
        transparent
        opacity={0}
        depthWrite={false}
      />

      <points ref={explosionPtsRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[explosionPositions, 3]}
            count={EXPLOSION_COUNT}
          />
        </bufferGeometry>
        <pointsMaterial
          color={moodColor}
          size={0.04}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

// ══════════════════════════════════════════════
//  SummaryPulse — looping gentle pulse for summary mode
// ══════════════════════════════════════════════

function SummaryPulse({
  edge,
  fromPos,
  toPos,
  speedMultiplier,
}: {
  edge: AggregatedEdge;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  speedMultiplier: number;
}) {
  const coreRef = useRef<any>(null);
  const glowRef = useRef<any>(null);
  const moodColor = useMemo(
    () => new THREE.Color(MOOD_COLORS[edge.dominantMood]),
    [edge.dominantMood],
  );
  const phaseOffset = useMemo(() => Math.random() * SUMMARY_PULSE_PERIOD, []);
  const period = SUMMARY_PULSE_PERIOD / Math.max(0.5, Math.sqrt(edge.count) * 0.5);

  const direction = useMemo(
    () => new THREE.Vector3().subVectors(toPos, fromPos),
    [fromPos, toPos],
  );
  const { perpA, perpB } = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0);
    const a = new THREE.Vector3().crossVectors(direction, up).normalize();
    if (a.lengthSq() < 0.001)
      a.crossVectors(direction, new THREE.Vector3(1, 0, 0)).normalize();
    const b = new THREE.Vector3().crossVectors(direction, a).normalize();
    return { perpA: a, perpB: b };
  }, [direction]);

  const seed = useMemo(() => Math.random() * 1000, []);
  const dummyPts = useMemo(
    () => [new THREE.Vector3(), new THREE.Vector3(0.01, 0, 0)],
    [],
  );
  const lineWidth = Math.max(1, Math.min(2, edge.count * 0.25));

  useFrame((state) => {
    const t = state.clock.elapsedTime * speedMultiplier;
    const phase = ((t + phaseOffset) % period) / period;

    const headFrac = phase;
    const tailFrac = Math.max(0, headFrac - SUMMARY_PULSE_LEN);
    const segs = 10;

    const pts: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const localFrac = i / segs;
      const edgeFrac = tailFrac + localFrac * (headFrac - tailFrac);
      const base = new THREE.Vector3().lerpVectors(fromPos, toPos, edgeFrac);
      if (i > 0 && i < segs) {
        const nA =
          Math.sin(seed + localFrac * 17 + t * 6) *
          Math.cos(seed + localFrac * 12 + t * 4);
        const nB =
          Math.cos(seed + localFrac * 13 + t * 5) *
          Math.sin(seed + localFrac * 19 + t * 3.5);
        base.addScaledVector(perpA, nA * 0.03);
        base.addScaledVector(perpB, nB * 0.03);
      }
      pts.push(base.x, base.y, base.z);
    }

    coreRef.current?.geometry?.setPositions?.(pts);
    glowRef.current?.geometry?.setPositions?.(pts);

    const fadeIn = Math.min(1, headFrac * 5);
    const fadeOut = Math.min(1, (1 - headFrac) * 5);
    const alpha = fadeIn * fadeOut * SUMMARY_PULSE_OPACITY;

    if (coreRef.current?.material) coreRef.current.material.opacity = alpha;
    if (glowRef.current?.material) glowRef.current.material.opacity = alpha * 0.35;
  });

  return (
    <group>
      <Line
        ref={glowRef}
        points={dummyPts}
        color={moodColor}
        lineWidth={lineWidth * 2.2}
        transparent
        opacity={0}
        depthWrite={false}
      />
      <Line
        ref={coreRef}
        points={dummyPts}
        color={moodColor}
        lineWidth={lineWidth}
        transparent
        opacity={0}
        depthWrite={false}
      />
    </group>
  );
}

// ══════════════════════════════════════════════
//  SceneContent
// ══════════════════════════════════════════════

function SceneContent({
  focusNodeId,
  selectedNode,
  setSelectedNode,
  onNodeClick,
  mode,
  nodeColors,
  speedMultiplier,
  autoRotate,
  eventIdx,
  isPlaying,
  setEventIdx,
  manualScrubRef,
}: {
  focusNodeId: string | null;
  selectedNode: string | null;
  setSelectedNode: (id: string | null) => void;
  onNodeClick: (node: any) => void;
  mode: ViewMode;
  nodeColors: Record<string, string>;
  speedMultiplier: number;
  autoRotate: boolean;
  eventIdx: number;
  isPlaying: boolean;
  setEventIdx: (idx: number) => void;
  manualScrubRef: React.MutableRefObject<boolean>;
}) {
  const controlsRef = useRef<any>(null);
  const clockRef = useRef(0);
  const [bolts, setBolts] = useState<BoltEntry[]>([]);

  const eventIdxRef = useRef(eventIdx);
  eventIdxRef.current = eventIdx;

  const prevIdxRef = useRef(eventIdx);
  useEffect(() => {
    if (eventIdx !== prevIdxRef.current) {
      prevIdxRef.current = eventIdx;
      if (manualScrubRef.current) {
        manualScrubRef.current = false;
        clockRef.current = 0;
        setBolts([]);
      }
    }
  }, [eventIdx, manualScrubRef]);

  const nodePositions = useMemo(() => computeForceLayout(), []);
  const focusTarget = focusNodeId || selectedNode;

  useFrame((state, delta) => {
    if (mode === 'timeline' && isPlaying) {
      clockRef.current += delta;
      const interval = EVENT_INTERVAL_S / Math.max(0.3, speedMultiplier);
      if (clockRef.current >= interval) {
        clockRef.current = 0;
        const idx = eventIdxRef.current;
        const evt = speechEvents[idx];
        const now = state.clock.elapsedTime;

        const newBolts: BoltEntry[] = [
          { id: `bolt-${idx}-${Date.now()}`, event: evt, birth: now },
        ];

        if (evt.interrupted && evt.interruptedBy) {
          const counterCollisionFrac = 1 - INTERRUPT_FRAC;
          const counterTravelS =
            (PULSE_TRAVEL_S * INTERRUPT_FRAC) / counterCollisionFrac;
          newBolts.push({
            id: `bolt-${idx}-counter-${Date.now()}`,
            event: {
              ...evt,
              source: evt.interruptedBy,
              target: evt.source,
              mood: 'negative' as Mood,
            },
            birth: now,
            travelS: counterTravelS,
            collisionFrac: counterCollisionFrac,
          });
        }

        setBolts((prev) => [...prev, ...newBolts]);
        setEventIdx((idx + 1) % speechEvents.length);
      }
    }

    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 0.3;
    }
  });

  const removeBolt = useCallback((id: string) => {
    setBolts((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const handleNodeClick = useCallback(
    (nodeData: StormNodeData) => {
      setSelectedNode(selectedNode === nodeData.id ? null : nodeData.id);
      onNodeClick(nodeData);
    },
    [selectedNode, setSelectedNode, onNodeClick],
  );

  return (
    <>
      <hemisphereLight intensity={0.72} color="#fffdf7" groundColor="#d9d1c6" />
      <directionalLight position={[3, 4, 5]} intensity={0.6} color="#fff7e8" />
      <pointLight position={[-2, -2, 3]} intensity={0.28} color="#8a7a5a" />
      <pointLight position={[2, -3, -2]} intensity={0.15} color="#5a7a8a" />

      <BackgroundGrid />

      {aggregatedEdges.map((edge) => {
        const from = nodePositions.get(edge.source);
        const to = nodePositions.get(edge.target);
        if (!from || !to) return null;
        return (
          <StaticEdge
            key={`${edge.source}-${edge.target}`}
            edge={edge}
            fromPos={from}
            toPos={to}
          />
        );
      })}

      {stormNodes.map((node) => {
        const pos = nodePositions.get(node.id);
        if (!pos) return null;
        const isDimmed = !!focusTarget && focusTarget !== node.id;
        return (
          <StormNode
            key={node.id}
            data={node}
            position={pos}
            dimmed={isDimmed}
            selected={selectedNode === node.id}
            slowBreath={mode === 'summary'}
            onClick={() => handleNodeClick(node)}
            colorOverride={nodeColors[node.id]}
          />
        );
      })}

      {mode === 'summary' &&
        aggregatedEdges.map((edge) => {
          const from = nodePositions.get(edge.source);
          const to = nodePositions.get(edge.target);
          if (!from || !to) return null;
          return (
            <SummaryPulse
              key={`sp-${edge.source}-${edge.target}`}
              edge={edge}
              fromPos={from}
              toPos={to}
              speedMultiplier={speedMultiplier}
            />
          );
        })}

      {mode === 'timeline' &&
        bolts.map((b) => {
          const from = nodePositions.get(b.event.source);
          const to = nodePositions.get(b.event.target);
          if (!from || !to) return null;
          return (
            <ElectricBolt
              key={b.id}
              event={b.event}
              birth={b.birth}
              fromPos={from}
              toPos={to}
              onDone={() => removeBolt(b.id)}
              travelS={b.travelS}
              collisionFrac={b.collisionFrac}
            />
          );
        })}

      {selectedNode && nodePositions.get(selectedNode) && (
        <NodeDashboard3D
          nodeId={selectedNode}
          position={nodePositions.get(selectedNode)!}
          nodeColors={nodeColors}
        />
      )}

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate}
        autoRotateSpeed={0.3}
        minDistance={2.5}
        maxDistance={12}
        zoomSpeed={0.9}
        rotateSpeed={0.62}
        panSpeed={0.7}
        enablePan
        enableZoom
        enableRotate
      />
    </>
  );
}

// ══════════════════════════════════════════════
//  NodeDashboard3D
// ══════════════════════════════════════════════

function NodeDashboard3D({
  nodeId,
  position,
  nodeColors,
}: {
  nodeId: string;
  position: THREE.Vector3;
  nodeColors: Record<string, string>;
}) {
  const data = stormNodes.find((n) => n.id === nodeId);
  if (!data) return null;
  const c = nodeColors[nodeId] || data.color;

  return (
    <Html
      position={[position.x + 0.5, position.y + 0.3, position.z]}
      distanceFactor={6}
      style={{ pointerEvents: 'auto', width: 200 }}
    >
      <div
        style={{
          background: 'rgba(250, 249, 247, 0.95)',
          backdropFilter: 'blur(12px)',
          borderRadius: 12,
          padding: '14px 16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
          border: '1px solid rgba(0,0,0,0.06)',
          fontFamily: "Georgia, 'Songti SC', serif",
          color: '#1a1a1a',
          fontSize: 12,
          lineHeight: 1.6,
          minWidth: 180,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}88` }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{data.name}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#999' }}>发言次数</div>
            <div style={{ fontWeight: 600 }}>{data.speakCount}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#999' }}>平均时长</div>
            <div style={{ fontWeight: 600 }}>{data.avgDuration}s</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#999' }}>总时长</div>
            <div style={{ fontWeight: 600 }}>{Math.floor(data.totalDuration / 60)}m</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#999' }}>互动风格</div>
            <div style={{ fontWeight: 600, fontSize: 10 }}>{data.mainInteraction}</div>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#999', marginBottom: 4 }}>高频关键词</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {data.keywords.map((kw) => (
              <span key={kw} style={{ background: `${c}18`, color: c, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontFamily: 'system-ui, sans-serif', border: `1px solid ${c}30` }}>{kw}</span>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, color: '#999', marginBottom: 4 }}>常聊话题</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {data.topics.map((topic) => (
              <span key={topic} style={{ background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontFamily: 'system-ui, sans-serif', color: '#555' }}>{topic}</span>
            ))}
          </div>
        </div>
      </div>
    </Html>
  );
}

// ══════════════════════════════════════════════
//  MobileDashboard
// ══════════════════════════════════════════════

function MobileDashboard({ nodeId, onClose, nodeColors }: { nodeId: string; onClose: () => void; nodeColors: Record<string, string> }) {
  const data = stormNodes.find((n) => n.id === nodeId);
  if (!data) return null;
  const c = nodeColors[nodeId] || data.color;

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(250,249,247,0.97)', backdropFilter: 'blur(16px)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '20px 24px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)', fontFamily: "Georgia, 'Songti SC', serif", color: '#1a1a1a', zIndex: 20, animation: 'slideUp 0.3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: c, boxShadow: `0 0 8px ${c}66` }} />
          <span style={{ fontWeight: 600, fontSize: 18 }}>{data.name}</span>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#666' }}>关闭</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <StatCard label="发言次数" value={`${data.speakCount}`} />
        <StatCard label="平均时长" value={`${data.avgDuration}s`} />
        <StatCard label="总时长" value={`${Math.floor(data.totalDuration / 60)}m`} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>互动风格</div>
        <div style={{ fontSize: 14 }}>{data.mainInteraction}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>高频关键词</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {data.keywords.map((kw) => (
              <span key={kw} style={{ background: `${c}18`, color: c, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontFamily: 'system-ui, sans-serif', border: `1px solid ${c}30` }}>{kw}</span>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>常聊话题</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {data.topics.map((topic) => (
              <span key={topic} style={{ background: 'rgba(0,0,0,0.05)', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontFamily: 'system-ui, sans-serif', color: '#555' }}>{topic}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  ModeBar — segmented control with text labels
// ══════════════════════════════════════════════

function ModeBar({
  mode,
  setMode,
  onSettingsToggle,
  settingsOpen,
}: {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  onSettingsToggle: () => void;
  settingsOpen: boolean;
}) {
  const segBtn = (active: boolean): React.CSSProperties => ({
    border: 'none',
    borderRadius: 10,
    padding: '6px 16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    fontFamily: "Georgia, 'Songti SC', serif",
    color: active ? '#fff' : '#888',
    background: active ? '#1a1a1a' : 'transparent',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(250,249,247,0.92)',
        backdropFilter: 'blur(12px)',
        borderRadius: 14,
        padding: '5px 6px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.06)',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          background: 'rgba(0,0,0,0.04)',
          borderRadius: 10,
          padding: 2,
        }}
      >
        <button onClick={() => setMode('summary')} style={segBtn(mode === 'summary')}>
          总览
        </button>
        <button onClick={() => setMode('timeline')} style={segBtn(mode === 'timeline')}>
          时间轴
        </button>
      </div>
      <button
        onClick={onSettingsToggle}
        style={{
          border: 'none',
          borderRadius: 8,
          padding: '5px 8px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: settingsOpen ? 'rgba(0,0,0,0.08)' : 'transparent',
        }}
        title="设置"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={settingsOpen ? '#1a1a1a' : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════
//  TimelineBar — visual event timeline
// ══════════════════════════════════════════════

function TimelineBar({
  eventIdx,
  setEventIdx,
  isPlaying,
  setIsPlaying,
  total,
  nodeColors,
  onManualScrub,
}: {
  eventIdx: number;
  setEventIdx: (idx: number) => void;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  total: number;
  nodeColors: Record<string, string>;
  onManualScrub: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const eventRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = eventRefs.current[eventIdx];
    if (el && trackRef.current) {
      const track = trackRef.current;
      const elLeft = el.offsetLeft;
      const elW = el.offsetWidth;
      const trackW = track.clientWidth;
      const scrollTarget = elLeft - trackW / 2 + elW / 2;
      track.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    }
  }, [eventIdx]);

  const handleEventClick = (idx: number) => {
    onManualScrub();
    setEventIdx(idx);
    setIsPlaying(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(250,249,247,0.92)',
        backdropFilter: 'blur(12px)',
        borderRadius: 12,
        padding: '6px 10px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        border: '1px solid rgba(0,0,0,0.06)',
        userSelect: 'none',
        width: '85vw',
        maxWidth: 400,
        minWidth: 220,
      }}
    >
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="#1a1a1a">
            <rect x="3" y="2" width="3.5" height="12" rx="1" />
            <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="#1a1a1a">
            <path d="M4 2.5v11l9-5.5z" />
          </svg>
        )}
      </button>

      <div
        ref={trackRef}
        className="storm-timeline-track"
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          padding: '2px 0',
        }}
      >
        {speechEvents.map((evt, i) => {
          const isCurrent = i === eventIdx;
          const isPast = i < eventIdx;
          const node = stormNodes.find((n) => n.id === evt.source);
          const speakerColor = nodeColors[evt.source] || node?.color || '#888';
          const moodColor = MOOD_COLORS[evt.mood];
          const widthPx = Math.max(10, Math.min(24, (evt.duration / 45) * 20));

          return (
            <div
              key={evt.id}
              ref={(el) => { eventRefs.current[i] = el; }}
              onClick={() => handleEventClick(i)}
              style={{
                position: 'relative',
                width: widthPx,
                height: isCurrent ? 28 : 20,
                borderRadius: 3,
                background: isPast
                  ? speakerColor
                  : isCurrent
                    ? speakerColor
                    : `${speakerColor}55`,
                opacity: isPast ? 0.4 : 1,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'height 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease',
                border: isCurrent
                  ? `1.5px solid ${speakerColor}`
                  : '1.5px solid transparent',
                boxShadow: isCurrent
                  ? `0 0 8px ${speakerColor}66`
                  : 'none',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: moodColor,
                  borderRadius: '3px 3px 0 0',
                }}
              />
              {evt.interrupted && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 1,
                    right: 1,
                    fontSize: 6,
                    lineHeight: 1,
                    color: '#ef4444',
                  }}
                >
                  ⚡
                </div>
              )}
            </div>
          );
        })}
      </div>

      <span
        style={{
          fontSize: 11,
          color: '#999',
          fontFamily: 'system-ui, sans-serif',
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
          minWidth: 36,
          textAlign: 'right',
        }}
      >
        {eventIdx + 1}/{total}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════
//  SettingsPanel — user customization
// ══════════════════════════════════════════════

function SettingsPanel({
  nodeColors,
  setNodeColors,
  speed,
  setSpeed,
  autoRotate,
  setAutoRotate,
  onClose,
}: {
  nodeColors: Record<string, string>;
  setNodeColors: (c: Record<string, string>) => void;
  speed: number;
  setSpeed: (s: number) => void;
  autoRotate: boolean;
  setAutoRotate: (v: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(env(safe-area-inset-bottom, 16px) + 72px)',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(250,249,247,0.96)',
        backdropFilter: 'blur(16px)',
        borderRadius: 16,
        padding: '16px 20px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.12)',
        border: '1px solid rgba(0,0,0,0.06)',
        fontFamily: "Georgia, 'Songti SC', serif",
        color: '#1a1a1a',
        zIndex: 20,
        width: 280,
        maxHeight: '60vh',
        overflowY: 'auto',
        animation: 'slideUp 0.2s ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          paddingBottom: 10,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600 }}>设置</span>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(0,0,0,0.05)',
            border: 'none',
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 12,
            cursor: 'pointer',
            color: '#999',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>
          发言人颜色
        </div>
        {stormNodes.map((node) => (
          <div
            key={node.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 6,
            }}
          >
            <input
              type="color"
              value={nodeColors[node.id] || node.color}
              onChange={(e) =>
                setNodeColors({ ...nodeColors, [node.id]: e.target.value })
              }
              style={{
                width: 26,
                height: 26,
                border: '2px solid rgba(0,0,0,0.08)',
                borderRadius: 8,
                cursor: 'pointer',
                padding: 0,
                background: 'transparent',
              }}
            />
            <span style={{ fontSize: 12 }}>{node.name}</span>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#999',
            marginBottom: 6,
          }}
        >
          <span>动画速度</span>
          <span style={{ fontWeight: 600, color: '#1a1a1a' }}>
            {speed.toFixed(1)}x
          </span>
        </div>
        <input
          type="range"
          min={0.3}
          max={3}
          step={0.1}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#8a7a5a' }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12 }}>自动旋转</span>
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          style={{
            background: autoRotate ? '#8a7a5a' : 'rgba(0,0,0,0.06)',
            color: autoRotate ? '#fff' : '#999',
            border: 'none',
            borderRadius: 8,
            padding: '4px 14px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {autoRotate ? '开' : '关'}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  ForceGraphStorm — main export
// ══════════════════════════════════════════════

export default function ForceGraphStorm({
  focusNodeId,
  selectedMeeting,
  onNodeClick,
}: ForceGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mode, setMode] = useState<ViewMode>('timeline');
  const [showSettings, setShowSettings] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [autoRotate, setAutoRotate] = useState(true);
  const [eventIdx, setEventIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [nodeColors, setNodeColors] = useState<Record<string, string>>(() => {
    const colors: Record<string, string> = {};
    stormNodes.forEach((n) => {
      colors[n.id] = n.color;
    });
    return colors;
  });
  const manualScrubRef = useRef(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const bgColor = useMemo(() => new THREE.Color(BG_COLOR), []);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: BG_COLOR,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.06) 100%)',
          zIndex: 1,
        }}
      />

      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        onPointerMissed={() => setSelectedNode(null)}
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[FOG_COLOR, 6, 18]} />

        <SceneContent
          focusNodeId={focusNodeId}
          selectedNode={isMobile ? null : selectedNode}
          setSelectedNode={setSelectedNode}
          onNodeClick={onNodeClick}
          mode={mode}
          nodeColors={nodeColors}
          speedMultiplier={speedMultiplier}
          autoRotate={autoRotate}
          eventIdx={eventIdx}
          isPlaying={isPlaying}
          setEventIdx={setEventIdx}
          manualScrubRef={manualScrubRef}
        />
      </Canvas>

      <div
        style={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 12px) + 12px)',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          zIndex: 15,
          pointerEvents: 'none',
        }}
      >
        {mode === 'timeline' && (
          <div style={{ pointerEvents: 'auto' }}>
            <TimelineBar
              eventIdx={eventIdx}
              setEventIdx={(idx) => {
                manualScrubRef.current = true;
                setEventIdx(idx);
              }}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              total={speechEvents.length}
              nodeColors={nodeColors}
              onManualScrub={() => { manualScrubRef.current = true; }}
            />
          </div>
        )}
        <div style={{ pointerEvents: 'auto' }}>
          <ModeBar
            mode={mode}
            setMode={setMode}
            onSettingsToggle={() => setShowSettings(!showSettings)}
            settingsOpen={showSettings}
          />
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          nodeColors={nodeColors}
          setNodeColors={setNodeColors}
          speed={speedMultiplier}
          setSpeed={setSpeedMultiplier}
          autoRotate={autoRotate}
          setAutoRotate={setAutoRotate}
          onClose={() => setShowSettings(false)}
        />
      )}

      {isMobile && selectedNode && (
        <MobileDashboard
          nodeId={selectedNode}
          onClose={() => setSelectedNode(null)}
          nodeColors={nodeColors}
        />
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .storm-timeline-track::-webkit-scrollbar { display: none; }
        .storm-timeline-track { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>
    </div>
  );
}
