import { useState } from 'react';
import InkToLight from './demos/InkToLight';
import RippleWeave from './demos/RippleWeave';
import SubtitleGalaxy from './demos/SubtitleGalaxy';
import CombinedA from './demos/CombinedA';
import CombinedB from './demos/CombinedB';
import CombinedC from './demos/CombinedC';
import CombinedA3D from './demos/CombinedA3D';
import CombinedB3D from './demos/CombinedB3D';

const COLORS = ['#4a7c8a', '#7a6b8a', '#8a7a5a', '#5a8a6a', '#c9956b', '#7f9bb8', '#6b8a7a', '#8a6b7a'];

const DEMOS = [
  {
    id: 1, label: '墨化为光',
    title: 'Case 1: 墨化为光',
    desc: '暖白纸面上，宋体转录文字逐字浮现，随后如水墨溶解为粒子，汇聚成温暖的发光关系网。',
  },
  {
    id: 2, label: '涟漪织网',
    title: 'Case 2: 涟漪织网',
    desc: '深色背景上，多色涟漪同时扩散与重叠，冻结后收缩凝聚为节点，交汇处抽出丝线般的连接。',
  },
  {
    id: 3, label: '字幕星河',
    title: 'Case 3: 字幕坠入星河',
    desc: '字幕瀑布从上方持续落下，突然停滞后缩成光点，在引力系统中漂移，划出渐变连线形成旋转星河。',
  },
  {
    id: 4, label: '宣纸墨韵',
    title: '融合 A: 宣纸墨韵',
    desc: '暖白底。墨色宋体文字逐行出现后滑向聚合，化为光点泛起水墨涟漪，收缩凝结为莫兰迪色节点网络。',
  },
  {
    id: 5, label: '深夜星图',
    title: '融合 B: 深夜星图',
    desc: '深黑底。白色转录文字带说话人色条，聚合后释放发光彩色涟漪，凝聚为明亮光点星图。',
  },
  {
    id: 6, label: '晨暮渐变',
    title: '融合 C: 晨暮渐变',
    desc: '渐变暖底。说话人色文字直接聚合，柔和暖色涟漪扩散后收缩，暖色节点间生长连线。',
  },
  {
    id: 7, label: '墨韵·空间',
    title: '3D A: 墨韵·空间',
    desc: '宣纸墨韵的 3D 升级版。2D 入场动画完成后，平滑过渡到可缩放/旋转/拖拽的正四面体空间结构图。',
  },
  {
    id: 8, label: '星图·空间',
    title: '3D B: 星图·空间',
    desc: '深夜星图的 3D 升级版。入场后过渡到深空星尘中的正四面体交互图谱，支持全角度自由探索。',
  },
];

const COMPONENTS: Record<number, React.FC> = {
  1: InkToLight,
  2: RippleWeave,
  3: SubtitleGalaxy,
  4: CombinedA,
  5: CombinedB,
  6: CombinedC,
  7: CombinedA3D,
  8: CombinedB3D,
};

function App() {
  const [activeTab, setActiveTab] = useState(7);

  const ActiveDemo = COMPONENTS[activeTab];
  const activeColor = COLORS[activeTab - 1];

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <div className="flex flex-col md:flex-row gap-10 items-center">
        {/* 左侧说明面板 */}
        <div className="max-w-sm hidden md:block">
          <h1
            className="text-3xl font-bold mb-3 tracking-widest"
            style={{ color: '#faf9f7', fontFamily: "Georgia, 'Songti SC', serif" }}
          >
            显·影
          </h1>
          <p className="text-sm mb-4 leading-relaxed" style={{ color: '#737373' }}>
            让不可见的互动，显影为艺术。
          </p>

          {/* 分组标签 */}
          <p className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: '#555' }}>
            单体原型
          </p>
          <div className="space-y-2 mb-5">
            {DEMOS.slice(0, 3).map((item, i) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="w-full text-left p-3 rounded-xl border transition-all duration-300"
                style={{
                  borderColor: activeTab === item.id ? COLORS[i] : '#333',
                  backgroundColor: activeTab === item.id ? `${COLORS[i]}10` : 'transparent',
                }}
              >
                <h3
                  className="text-xs font-medium mb-0.5"
                  style={{ color: activeTab === item.id ? COLORS[i] : '#999' }}
                >
                  {item.title}
                </h3>
                <p className="text-[10px] leading-relaxed" style={{ color: '#666' }}>
                  {item.desc}
                </p>
              </button>
            ))}
          </div>

          <p className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: '#555' }}>
            融合变体
          </p>
          <div className="space-y-2 mb-5">
            {DEMOS.slice(3, 6).map((item, i) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="w-full text-left p-3 rounded-xl border transition-all duration-300"
                style={{
                  borderColor: activeTab === item.id ? COLORS[i + 3] : '#333',
                  backgroundColor: activeTab === item.id ? `${COLORS[i + 3]}10` : 'transparent',
                }}
              >
                <h3
                  className="text-xs font-medium mb-0.5"
                  style={{ color: activeTab === item.id ? COLORS[i + 3] : '#999' }}
                >
                  {item.title}
                </h3>
                <p className="text-[10px] leading-relaxed" style={{ color: '#666' }}>
                  {item.desc}
                </p>
              </button>
            ))}
          </div>

          <p className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: '#555' }}>
            3D 空间交互
          </p>
          <div className="space-y-2">
            {DEMOS.slice(6).map((item, i) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="w-full text-left p-3 rounded-xl border transition-all duration-300"
                style={{
                  borderColor: activeTab === item.id ? COLORS[i + 6] : '#333',
                  backgroundColor: activeTab === item.id ? `${COLORS[i + 6]}10` : 'transparent',
                }}
              >
                <h3
                  className="text-xs font-medium mb-0.5"
                  style={{ color: activeTab === item.id ? COLORS[i + 6] : '#999' }}
                >
                  {item.title}
                </h3>
                <p className="text-[10px] leading-relaxed" style={{ color: '#666' }}>
                  {item.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* 移动端设备框 */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative bg-[#111] border-[12px] border-[#222] rounded-[2.5rem] overflow-hidden shadow-2xl"
            style={{ width: 300, height: 600 }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-5 bg-[#222] rounded-b-2xl z-50" />

            <div className="w-full h-full overflow-hidden relative">
              <ActiveDemo />
            </div>
          </div>

          {/* 底部 Tab 切换 — 两行 */}
          <div className="flex flex-col gap-2 items-center">
            <div className="flex gap-1.5">
              {DEMOS.slice(0, 3).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-3 py-1.5 rounded-full text-[10px] transition-all duration-300"
                  style={{
                    backgroundColor: activeTab === tab.id ? '#faf9f7' : '#333',
                    color: activeTab === tab.id ? '#1a1a1a' : '#999',
                    fontFamily: "Georgia, 'Songti SC', serif",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {DEMOS.slice(3, 6).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-3 py-1.5 rounded-full text-[10px] transition-all duration-300"
                  style={{
                    backgroundColor: activeTab === tab.id ? activeColor : '#333',
                    color: activeTab === tab.id ? '#1a1a1a' : '#999',
                    fontFamily: "Georgia, 'Songti SC', serif",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {DEMOS.slice(6).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-3 py-1.5 rounded-full text-[10px] transition-all duration-300"
                  style={{
                    backgroundColor: activeTab === tab.id ? activeColor : '#333',
                    color: activeTab === tab.id ? '#1a1a1a' : '#999',
                    fontFamily: "Georgia, 'Songti SC', serif",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
