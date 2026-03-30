import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { complexMockData, NodeData, LinkData } from '../data/mockData';

// 创建柔和呼吸感的生物荧光纹理
function createOrganicTexture(colorHex: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, `${colorHex}ff`); // 内部不刺眼，柔和
    gradient.addColorStop(0.3, `${colorHex}88`); 
    gradient.addColorStop(0.7, `${colorHex}22`); 
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

interface ForceGraphProps {
  focusNodeId: string | null;
  selectedMeeting: string | 'all';
  onNodeClick: (node: any) => void;
}

// 封装安全的 ID 获取方法
const getId = (nodeOrId: any) => typeof nodeOrId === 'object' ? nodeOrId.id : nodeOrId;

export default function ForceGraphOrganic({ focusNodeId, selectedMeeting, onNodeClick }: ForceGraphProps) {
  const fgRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // 呼吸动画的 time uniform
  const [time, setTime] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      setTime(t => t + 0.05);
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const graphData = useMemo(() => {
    let links = complexMockData.links;
    if (selectedMeeting !== 'all') {
      links = links.filter(l => l.meetingId === selectedMeeting);
    }
    const connectedNodes = new Set();
    links.forEach(l => {
      connectedNodes.add(l.source);
      connectedNodes.add(l.target);
    });
    const nodes = complexMockData.nodes.filter(n => connectedNodes.has(n.id) || n.id === focusNodeId);
    
    return { nodes: nodes.length > 0 ? nodes : complexMockData.nodes, links };
  }, [selectedMeeting, focusNodeId]);

  const textureCache = useRef<Record<string, THREE.CanvasTexture>>({});
  const getTexture = useCallback((color: string) => {
    if (!textureCache.current[color]) {
      textureCache.current[color] = createOrganicTexture(color);
    }
    return textureCache.current[color];
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#020b14' }}> {/* 深海蓝背景 */}
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor="#020b14"
        showNavInfo={false}
        // 增加节点斥尼，使移动像在流体中一样缓慢
        d3VelocityDecay={0.3}
        nodeThreeObject={(node: any) => {
          const group = new THREE.Group();

          let isFocusRelated = true;
          let opacityMultiplier = 1;

          if (focusNodeId) {
            if (node.id === focusNodeId) {
              isFocusRelated = true;
            } else {
              const isNeighbor = graphData.links.some(l => {
                const sourceId = getId(l.source);
                const targetId = getId(l.target);
                return (sourceId === focusNodeId && targetId === node.id) || 
                       (targetId === focusNodeId && sourceId === node.id);
              });
              isFocusRelated = isNeighbor;
            }
            if (!isFocusRelated) {
              opacityMultiplier = 0.1; 
            }
          }

          // 1. 柔和呼吸神经元
          const material = new THREE.SpriteMaterial({
            map: getTexture(node.color),
            color: new THREE.Color(0xffffff),
            transparent: true,
            opacity: opacityMultiplier * (0.8 + 0.2 * Math.sin(time + node.val)), // 呼吸感
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });
          const sprite = new THREE.Sprite(material);
          // 更大的体积，边界更模糊
          const size = Math.sqrt(node.val) * 7; 
          sprite.scale.set(size, size, 1);
          group.add(sprite);

          // 2. 文字标签 (更加柔和的颜色)
          if (opacityMultiplier > 0.3) {
            const spriteText = new SpriteText(node.name);
            spriteText.color = '#a0aec0';
            spriteText.textHeight = 3.5;
            spriteText.position.y = -size / 2 - 3;
            spriteText.material.depthWrite = false;
            spriteText.material.transparent = true;
            spriteText.material.opacity = opacityMultiplier * 0.8;
            group.add(spriteText);
          }

          return group;
        }}
        // 连线视觉：柔和光带
        linkColor={(link: any) => {
          let opacity = 0.3;
          if (focusNodeId) {
            const sourceId = getId(link.source);
            const targetId = getId(link.target);
            const isFocusLink = sourceId === focusNodeId || targetId === focusNodeId;
            opacity = isFocusLink ? 0.7 : 0.05;
          }
          return `rgba(100, 150, 255, ${opacity})`; // 使用统一的青蓝色流体连线
        }}
        linkWidth={1.5} // 更粗的连线
        
        // 流体波纹传递
        linkDirectionalParticles={(link: any) => {
          if (focusNodeId) {
            const sourceId = getId(link.source);
            const targetId = getId(link.target);
            const isFocusLink = sourceId === focusNodeId || targetId === focusNodeId;
            if (!isFocusLink) return 0;
          }
          return Math.max(1, Math.floor(link.value / 2)); // 粒子数较少
        }}
        linkDirectionalParticleSpeed={(link: any) => link.value * 0.002} // 移动缓慢
        linkDirectionalParticleWidth={4} // 颗粒大，像水滴
        linkDirectionalParticleColor={(link: any) => {
          return link.source.color || '#4fd1c5';
        }}
        
        onNodeClick={(node: any) => {
          onNodeClick(node);
          const distance = 90;
          const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
          if (fgRef.current) {
            fgRef.current.cameraPosition(
              { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, 
              node, 
              2000 // 切换镜头更缓慢，体现水下感
            );
          }
        }}
      />
    </div>
  );
}