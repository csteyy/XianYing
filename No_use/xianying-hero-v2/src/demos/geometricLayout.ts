import * as THREE from 'three';

export type StableShapeKind = 'tetrahedron' | 'octahedron' | 'cube' | 'sphere';

export interface ShapeThresholds {
  tetrahedronMax: number;
  octahedronMax: number;
  cubeMax: number;
}

export const DEFAULT_SHAPE_THRESHOLDS: ShapeThresholds = {
  tetrahedronMax: 4,
  octahedronMax: 6,
  cubeMax: 8,
};

export function getStableShapeByCount(
  nodeCount: number,
  thresholds: ShapeThresholds = DEFAULT_SHAPE_THRESHOLDS,
): StableShapeKind {
  if (nodeCount <= thresholds.tetrahedronMax) return 'tetrahedron';
  if (nodeCount <= thresholds.octahedronMax) return 'octahedron';
  if (nodeCount <= thresholds.cubeMax) return 'cube';
  return 'sphere';
}

/**
 * Returns stable geometric positions for N nodes.
 * - N <= 4: regular tetrahedron
 * - N <= 6: regular octahedron
 * - N <= 8: cube vertices
 * - N > 8:  Fibonacci sphere
 */
export function computeGeometricLayout(
  nodeCount: number,
  radius: number = 2,
  thresholds: ShapeThresholds = DEFAULT_SHAPE_THRESHOLDS,
): THREE.Vector3[] {
  let raw: [number, number, number][];
  const shape = getStableShapeByCount(nodeCount, thresholds);

  if (shape === 'tetrahedron') raw = tetrahedron();
  else if (shape === 'octahedron') raw = octahedron();
  else if (shape === 'cube') raw = cube();
  else raw = fibonacciSphere(nodeCount);

  const positions = raw.slice(0, nodeCount).map(([x, y, z]) => {
    const v = new THREE.Vector3(x, y, z).normalize().multiplyScalar(radius);
    return v;
  });

  return positions;
}

function tetrahedron(): [number, number, number][] {
  return [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ];
}

function octahedron(): [number, number, number][] {
  return [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
}

function cube(): [number, number, number][] {
  return [
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [1, -1, -1],
    [-1, 1, 1],
    [-1, 1, -1],
    [-1, -1, 1],
    [-1, -1, -1],
  ];
}

function fibonacciSphere(n: number): [number, number, number][] {
  if (n <= 1) return [[0, 0, 1]];

  const points: [number, number, number][] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    points.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }

  return points;
}
