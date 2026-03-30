import React, { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

// 模拟的对话数据 (From 显影项目)
const gData = {
  nodes: [
    { id: 'Alice', name: 'Alice', val: 12, color: '#f59e0b', mood: '积极' },
    { id: 'Bob', name: 'Bob', val: 8, color: '#3b82f6', mood: '平静' },
    { id: 'Charlie', name: 'Charlie', val: 15, color: '#22c55e', mood: '积极' },
    { id: 'Diana', name: 'Diana', val: 6, color: '#8b5cf6', mood: '好奇' }
  ],
  links: [
    { source: 'Alice', target: 'Bob', value: 2, mood: '积极' },
    { source: 'Bob', target: 'Alice', value: 1, mood: '平静' },
    { source: 'Charlie', target: 'Bob', value: 3, mood: '积极' },
    { source: 'Alice', target: 'Charlie', value: 2, mood: '积极' },
    { source: 'Diana', target: 'Alice', value: 1, mood: '好奇' }
  ]
};

// 预生成发光材质的纹理
function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
}

export default function ForceGraph() {
  const fgRef = useRef<any>();
  const glowTexture = useMemo(() => createGlowTexture(), []);

  // 响应式宽高
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#030014' }}>
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={gData}
        backgroundColor="#030014"
        showNavInfo={false}
        // 节点视觉：发光星体
        nodeThreeObject={(node: any) => {
          const material = new THREE.SpriteMaterial({
            map: glowTexture,
            color: new THREE.Color(node.color),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });
          const sprite = new THREE.Sprite(material);
          const size = Math.sqrt(node.val) * 6; // 节点大小
          sprite.scale.set(size, size, 1);
          return sprite;
        }}
        // 连线视觉
        linkColor={() => 'rgba(255, 255, 255, 0.1)'}
        linkWidth={0.5}
        // 粒子流动（光束感）
        linkDirectionalParticles={(link: any) => link.value * 2} // 粒子数量与对话频次正相关
        linkDirectionalParticleSpeed={(link: any) => link.value * 0.005} // 流动速度
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleColor={(link: any) => {
          // 根据目标节点的颜色设置粒子颜色，体现能量流向
          const sourceNode = gData.nodes.find(n => n.id === (typeof link.source === 'object' ? link.source.id : link.source));
          return sourceNode?.color || '#ffffff';
        }}
        // 相机交互相关
        onNodeClick={(node: any) => {
          // 点击节点，相机平滑飞行居中
          const distance = 100;
          const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
          if (fgRef.current) {
            fgRef.current.cameraPosition(
              { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
              node, // lookAt ({ x, y, z })
              1500  // ms transition duration
            );
          }
        }}
      />
    </div>
  );
}