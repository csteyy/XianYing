import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import {
  computeGeometricLayout,
  getStableShapeByCount,
  type StableShapeKind,
} from './geometricLayout';
import {
  GRAPH_CONNECTIONS,
  GRAPH_NODE_LAYOUT_2D,
  GRAPH_NODES,
  type CombinedTheme,
} from './combinedEngine';

// ── Types ──

interface SpatialGraphProps {
  theme: CombinedTheme;
  showStardust?: boolean;
  active?: boolean;
  interactive?: boolean;
}

interface GraphNodeProps {
  index: number;
  label: string;
  color: string;
  theme: CombinedTheme;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  entryProgressRef: React.MutableRefObject<number>;
  runtimePositionsRef: React.MutableRefObject<THREE.Vector3[]>;
}

interface GraphConnectionProps {
  fromIdx: number;
  toIdx: number;
  fromColor: string;
  toColor: string;
  weight: number;
  theme: CombinedTheme;
  entryProgressRef: React.MutableRefObject<number>;
  runtimePositionsRef: React.MutableRefObject<THREE.Vector3[]>;
}

const SHAPE_LABELS: Record<StableShapeKind, string> = {
  tetrahedron: '正四面体',
  octahedron: '正八面体',
  cube: '立方体',
  sphere: '球面',
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function map2DAnchorToWorld(
  anchor: { x: number; y: number },
  worldWidth: number,
  worldHeight: number,
) {
  return new THREE.Vector3(
    (anchor.x - 0.5) * worldWidth,
    (0.5 - anchor.y) * worldHeight,
    0,
  );
}

// ── Animated node ──

function GraphNode({
  index,
  label,
  color,
  theme,
  startPos,
  targetPos,
  entryProgressRef,
  runtimePositionsRef,
}: GraphNodeProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null!);
  const isLight = theme.bg === '#faf9f7';

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const entry = easeOutCubic(entryProgressRef.current);
    group.position.lerpVectors(startPos, targetPos, entry);
    runtimePositionsRef.current[index].copy(group.position);

    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.3 + index * 1.6) * 0.08;
    group.scale.setScalar((0.9 + entry * 0.1) * pulse);

    if (glowMatRef.current) {
      const alphaBase = isLight ? 0.12 : 0.2;
      glowMatRef.current.opacity = alphaBase * (0.35 + entry * 0.65);
    }
  });

  const colorObj = useMemo(() => new THREE.Color(color), [color]);

  return (
    <group ref={groupRef} position={startPos.toArray()}>
      {/* Outer glow sphere */}
      <mesh>
        <sphereGeometry args={[0.27, 18, 18]} />
        <meshBasicMaterial
          ref={glowMatRef}
          color={colorObj}
          transparent
          opacity={isLight ? 0.12 : 0.2}
          depthWrite={false}
        />
      </mesh>

      {/* Core node */}
      <mesh>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial
          color={colorObj}
          emissive={colorObj}
          emissiveIntensity={isLight ? 0.35 : 1.3}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>

      {/* Label */}
      <Html
        position={[0, 0.34, 0]}
        center
        distanceFactor={7}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            color: theme.labelColor,
            fontFamily: "Georgia, 'Songti SC', serif",
            fontSize: 10,
            opacity: 0.7,
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

// ── Animated connection lines ──

function GraphConnection({
  fromIdx,
  toIdx,
  fromColor,
  toColor,
  weight,
  theme,
  entryProgressRef,
  runtimePositionsRef,
}: GraphConnectionProps) {
  const isLight = theme.bg === '#faf9f7';
  const lineRef = useRef<any>(null);
  const edgeColor = useMemo(
    () => new THREE.Color(fromColor).lerp(new THREE.Color(toColor), 0.5),
    [fromColor, toColor],
  );
  const initialPoints = useMemo(
    () => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)],
    [],
  );
  const temp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const from = runtimePositionsRef.current[fromIdx];
    const to = runtimePositionsRef.current[toIdx];
    if (!from || !to) return;

    const grow = THREE.MathUtils.smoothstep(entryProgressRef.current, 0.15, 0.95);
    temp.lerpVectors(from, to, grow);

    const line = lineRef.current;
    line?.geometry?.setPositions?.([from.x, from.y, from.z, temp.x, temp.y, temp.z]);

    const pulse = 0.82 + Math.sin(state.clock.elapsedTime * 1.8 + fromIdx + toIdx) * 0.12;
    const alphaBase = isLight ? 0.16 : 0.34;
    if (line?.material) {
      line.material.opacity = alphaBase * (0.5 + weight * 0.7) * grow * pulse;
    }
  });

  return (
    <Line
      ref={lineRef}
      points={initialPoints}
      color={edgeColor}
      lineWidth={Math.max(0.55, weight * 1.35)}
      transparent
      opacity={0}
      depthWrite={false}
    />
  );
}

// ── Stardust background particles ──

function StardustLayer({
  count,
  spread,
  color,
  size,
  opacity,
  speed,
}: {
  count: number;
  spread: number;
  color: string;
  size: number;
  opacity: number;
  speed: number;
}) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * spread;
      arr[i * 3 + 1] = (Math.random() - 0.5) * spread;
      arr[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    return arr;
  }, [count, spread]);

  const ref = useRef<THREE.Points>(null!);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * speed;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color={color}
        size={size}
        sizeAttenuation
        depthWrite={false}
        opacity={opacity}
      />
    </Points>
  );
}

function Stardust() {
  return (
    <>
      <StardustLayer count={380} spread={16} color="#8c8ca0" size={0.014} opacity={0.28} speed={0.02} />
      <StardustLayer count={220} spread={11} color="#b7b7d4" size={0.02} opacity={0.22} speed={-0.014} />
    </>
  );
}

// ── Scene content ──

function SceneContent({
  theme,
  showStardust,
  active,
  interactive,
}: Required<SpatialGraphProps>) {
  const { camera, size } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const controlsRef = useRef<any>(null);
  const nodeCount = GRAPH_NODES.length;
  const isLight = theme.bg === '#faf9f7';

  const baseCameraZ = isLight ? 5.5 : 5.8;
  const focusCameraZ = isLight ? 4.6 : 4.3;
  const entryProgressRef = useRef(0);

  const worldSize = useMemo(() => {
    const fovRad = THREE.MathUtils.degToRad(cam.fov * 0.5);
    const worldHeight = 2 * Math.tan(fovRad) * baseCameraZ;
    const worldWidth = worldHeight * (size.width / size.height);
    return { worldWidth, worldHeight };
  }, [cam.fov, size.height, size.width, baseCameraZ]);

  const startPositions = useMemo(
    () =>
      GRAPH_NODE_LAYOUT_2D.map((anchor) =>
        map2DAnchorToWorld(anchor, worldSize.worldWidth, worldSize.worldHeight),
      ),
    [worldSize.worldHeight, worldSize.worldWidth],
  );

  const targetPositions = useMemo(
    () => computeGeometricLayout(nodeCount, isLight ? 1.9 : 2.1),
    [isLight, nodeCount],
  );
  const shapeKind = useMemo(() => getStableShapeByCount(nodeCount), [nodeCount]);
  const runtimePositionsRef = useRef<THREE.Vector3[]>(
    startPositions.map((p) => p.clone()),
  );

  useEffect(() => {
    runtimePositionsRef.current = startPositions.map((p) => p.clone());
    entryProgressRef.current = 0;
    cam.position.set(0, 0, baseCameraZ);
  }, [baseCameraZ, cam, startPositions]);

  useFrame((_, delta) => {
    const target = active ? 1 : 0;
    entryProgressRef.current = THREE.MathUtils.damp(
      entryProgressRef.current,
      target,
      active ? 3.8 : 6.5,
      delta,
    );
    const eased = easeOutCubic(entryProgressRef.current);
    const targetZ = THREE.MathUtils.lerp(baseCameraZ, focusCameraZ, eased);
    cam.position.z = THREE.MathUtils.damp(cam.position.z, targetZ, 4.5, delta);
    cam.lookAt(0, 0, 0);

    if (controlsRef.current) {
      controlsRef.current.enabled = interactive;
      controlsRef.current.autoRotate = interactive;
      controlsRef.current.autoRotateSpeed = interactive ? 0.45 : 0.08;
    }
  });

  return (
    <>
      {/* Lights tuned per theme for better spatial depth */}
      {isLight ? (
        <>
          <hemisphereLight intensity={0.72} color="#fffdf7" groundColor="#d9d1c6" />
          <directionalLight position={[3, 4, 5]} intensity={0.55} color="#fff7e8" />
          <pointLight position={[-2, -2, 3]} intensity={0.22} color="#8a7a5a" />
        </>
      ) : (
        <>
          <ambientLight intensity={0.2} />
          <pointLight position={[4, 3, 5]} intensity={1.1} color="#6e7cff" />
          <pointLight position={[-3, -2, 3]} intensity={0.75} color="#a06bff" />
          <pointLight position={[0, 4, -2]} intensity={0.42} color="#6ad6ff" />
        </>
      )}

      {/* Nodes */}
      {GRAPH_NODES.map((node, i) => (
        <GraphNode
          key={node.label}
          index={i}
          label={node.label}
          color={theme.speakerColors[node.speakerIdx]}
          theme={theme}
          startPos={startPositions[i]}
          targetPos={targetPositions[i]}
          entryProgressRef={entryProgressRef}
          runtimePositionsRef={runtimePositionsRef}
        />
      ))}

      {/* Connections */}
      {GRAPH_CONNECTIONS.map((conn, i) => (
        <GraphConnection
          key={i}
          fromIdx={conn.from}
          toIdx={conn.to}
          fromColor={theme.speakerColors[GRAPH_NODES[conn.from].speakerIdx]}
          toColor={theme.speakerColors[GRAPH_NODES[conn.to].speakerIdx]}
          weight={conn.weight}
          theme={theme}
          entryProgressRef={entryProgressRef}
          runtimePositionsRef={runtimePositionsRef}
        />
      ))}

      {showStardust && <Stardust />}

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        autoRotate={false}
        minDistance={2.2}
        maxDistance={8.6}
        zoomSpeed={0.9}
        rotateSpeed={0.62}
        panSpeed={0.7}
        enablePan
        enableZoom
        enableRotate
      />

      <Html position={[0, -2.75, 0]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            color: theme.mutedColor,
            opacity: 0.5,
            fontFamily: "Georgia, 'Songti SC', serif",
            fontSize: 10,
            letterSpacing: '0.08em',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          稳定形态 · {SHAPE_LABELS[shapeKind]}
        </div>
      </Html>
    </>
  );
}

// ── Main exported component ──

export default function SpatialGraph({
  theme,
  showStardust = false,
  active = false,
  interactive = false,
}: SpatialGraphProps) {
  const bgColor = useMemo(() => new THREE.Color(theme.bg), [theme.bg]);
  const isLight = theme.bg === '#faf9f7';

  return (
    <Canvas
      camera={{ position: [0, 0, isLight ? 5.5 : 5.8], fov: 45 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
    >
      <color attach="background" args={[bgColor]} />
      {isLight ? (
        <fog attach="fog" args={['#f5f2eb', 6.5, 14]} />
      ) : (
        <fog attach="fog" args={['#090a11', 7, 16]} />
      )}
      <SceneContent
        theme={theme}
        showStardust={showStardust}
        active={active}
        interactive={interactive}
      />
    </Canvas>
  );
}
