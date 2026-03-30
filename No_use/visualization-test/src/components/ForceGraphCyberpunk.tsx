import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { complexMockData, NodeData, LinkData } from '../data/mockData';

// 创建带有锐利核心的星体纹理
function createCyberpunkTexture(colorHex: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, '#ffffff'); // 极亮核心
    gradient.addColorStop(0.1, colorHex);
    gradient.addColorStop(0.4, `${colorHex}44`); // 高透明度外发光
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
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

export default function ForceGraphCyberpunk({ focusNodeId, selectedMeeting, onNodeClick }: ForceGraphProps) {
  const fgRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // 根据选中的 meeting 过滤数据
  const graphData = useMemo(() => {
    let links = complexMockData.links;
    if (selectedMeeting !== 'all') {
      links = links.filter(l => l.meetingId === selectedMeeting);
    }
    // 只保留有连线的节点或者 focus 的节点
    const connectedNodes = new Set();
    links.forEach(l => {
      connectedNodes.add(l.source);
      connectedNodes.add(l.target);
    });
    const nodes = complexMockData.nodes.filter(n => connectedNodes.has(n.id) || n.id === focusNodeId);
    
    // 如果没有数据，给一个空的
    return { nodes: nodes.length > 0 ? nodes : complexMockData.nodes, links };
  }, [selectedMeeting, focusNodeId]);

  // 缓存节点纹理
  const textureCache = useRef<Record<string, THREE.CanvasTexture>>({});
  const getTexture = useCallback((color: string) => {
    if (!textureCache.current[color]) {
      textureCache.current[color] = createCyberpunkTexture(color);
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
    <div style={{ width: '100%', height: '100%', background: '#000000' }}>
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor="#000000" // 纯黑背景
        showNavInfo={false}
        // 节点渲染
        nodeThreeObject={(node: any) => {
          const group = new THREE.Group();

          // 是否是被 focus 的节点，或者是否是被 focus 节点的直接邻居
          let isFocusRelated = true;
          let opacityMultiplier = 1;

          if (focusNodeId) {
            if (node.id === focusNodeId) {
              isFocusRelated = true;
            } else {
              // 检查是否是直接连接
              const isNeighbor = graphData.links.some(l => {
                const sourceId = getId(l.source);
                const targetId = getId(l.target);
                return (sourceId === focusNodeId && targetId === node.id) || 
                       (targetId === focusNodeId && sourceId === node.id);
              });
              isFocusRelated = isNeighbor;
            }
            if (!isFocusRelated) {
              opacityMultiplier = 0.15; // 降低不相关节点的亮度
            }
          }

          // 1. 发光星体核心
          const material = new THREE.SpriteMaterial({
            map: getTexture(node.color),
            color: new THREE.Color(0xffffff),
            transparent: true,
            opacity: opacityMultiplier,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });
          const sprite = new THREE.Sprite(material);
          const size = Math.sqrt(node.val) * 4; 
          sprite.scale.set(size, size, 1);
          group.add(sprite);

          // 2. 文字标签
          if (opacityMultiplier > 0.3) {
            const spriteText = new SpriteText(node.name);
            spriteText.color = node.color;
            spriteText.textHeight = 4;
            spriteText.position.y = -size / 2 - 4; // 悬浮在节点下方
            spriteText.material.depthWrite = false;
            spriteText.material.transparent = true;
            spriteText.material.opacity = opacityMultiplier;
            group.add(spriteText);
          }

          return group;
        }}
        // 连线视觉
        linkColor={(link: any) => {
          let opacity = 0.2;
          if (focusNodeId) {
            const sourceId = getId(link.source);
            const targetId = getId(link.target);
            const isFocusLink = sourceId === focusNodeId || targetId === focusNodeId;
            opacity = isFocusLink ? 0.6 : 0.05;
          }
          return `rgba(255, 255, 255, ${opacity})`;
        }}
        linkWidth={0.5}
        // 粒子（光梭）
        linkDirectionalParticles={(link: any) => {
          if (focusNodeId) {
            const sourceId = getId(link.source);
            const targetId = getId(link.target);
            const isFocusLink = sourceId === focusNodeId || targetId === focusNodeId;
            if (!isFocusLink) return 0;
          }
          return link.value; // 根据 value 决定粒子数
        }}
        linkDirectionalParticleSpeed={(link: any) => link.value * 0.008} // 快速穿梭
        linkDirectionalParticleWidth={2} // 更宽以形成光梭感
        linkDirectionalParticleColor={(link: any) => {
          const sourceNode = graphData.nodes.find(n => n.id === (typeof link.source === 'object' ? link.source.id : link.source));
          return sourceNode?.color || '#ffffff';
        }}
        // 将球形粒子变为拉长的线段效果 (激光效果)
        linkDirectionalParticleResolution={8}
        
        // 相机交互
        onNodeClick={(node: any) => {
          onNodeClick(node);
          const distance = 80;
          const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
          if (fgRef.current) {
            fgRef.current.cameraPosition(
              { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, 
              node, 
              1000  
            );
          }
        }}
      />
    </div>
  );
}