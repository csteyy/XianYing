import { useState, useMemo, useRef } from 'react';
import { ChevronLeft, Settings, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { getSpeakerColor } from '@mobile/utils/speakerColors';
import { transformAnnotatedToStorm, getMockStormData, type TransformedStormData } from '@mobile/utils/transformAnnotatedToStorm';
import type { AnnotatedRecord } from '@mobile/utils/transformAnnotatedToStorm';
import { markVisualization } from '@mobile/services/sessionStore';
import { getSettings } from '@mobile/services/settingsStore';
import StormVisualization from '@mobile/components/StormVisualization';

interface VisualizationPageProps {
  onNavigate: (page: string, data?: any) => void;
  pageData?: any;
}

export function VisualizationPage({ onNavigate, pageData }: VisualizationPageProps) {
  const annotatedData: AnnotatedRecord[] | undefined = pageData?.annotatedData;
  const sessionId = pageData?.sessionId;
  const from = pageData?.from;

  const stormData: TransformedStormData = useMemo(() => {
    if (annotatedData && annotatedData.length > 0) return transformAnnotatedToStorm(annotatedData);
    return getMockStormData();
  }, [annotatedData]);

  const [showPanel, setShowPanel] = useState(true);
  const [particleSize, setParticleSize] = useState(() => getSettings().defaultParticleSize);
  const [speed, setSpeed] = useState(() => getSettings().defaultAnimationSpeed);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [viewMode, setViewMode] = useState<'timeline' | 'summary'>('timeline');

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [eventIdx, setEventIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const manualScrubRef = useRef(false);

  const [nodeColors, setNodeColors] = useState<Record<string, string>>(() => {
    const colors: Record<string, string> = {};
    stormData.nodes.forEach(n => { colors[n.id] = n.color; });
    return colors;
  });
  const [participantVisibility, setParticipantVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(stormData.nodes.map(n => [n.id, true]))
  );

  const visibleNodes = useMemo(() => stormData.nodes.filter(n => participantVisibility[n.id] !== false), [stormData.nodes, participantVisibility]);
  const visibleEvents = useMemo(() => stormData.events.filter(e => participantVisibility[e.source] !== false && participantVisibility[e.target] !== false), [stormData.events, participantVisibility]);
  const visibleEdges = useMemo(() => stormData.aggregatedEdges.filter(e => participantVisibility[e.source] !== false && participantVisibility[e.target] !== false), [stormData.aggregatedEdges, participantVisibility]);

  const handleSave = () => {
    if (sessionId) markVisualization(sessionId);
    toast.success('作品已保存到作品库');
  };

  const vizProps = {
    nodes: visibleNodes,
    events: visibleEvents,
    aggregatedEdges: visibleEdges,
    nodeColors,
    speedMultiplier: speed,
    autoRotate,
    showLabels,
    particleSize,
    viewMode,
    selectedNode,
    onNodeSelect: setSelectedNode,
    eventIdx,
    onEventIdxChange: setEventIdx,
    isPlaying,
    onPlayingChange: setIsPlaying,
    onViewModeChange: setViewMode as (m: 'summary' | 'timeline') => void,
    manualScrubRef,
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)]">
      <div className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-[var(--border)] bg-[var(--color-surface-1)]/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => {
            if (from === 'analysis') onNavigate('analysis', pageData);
            else onNavigate('dashboard');
          }} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors">
            <ChevronLeft className="w-4 h-4 text-[var(--color-ink-muted)]" />
          </button>
          <h3 className="font-serif text-sm">可视化</h3>
          <span className="text-xs text-[var(--color-ink-faint)]">{stormData.nodes.length} 节点 · {stormData.events.length} 事件</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[var(--color-surface-2)] border border-[var(--border)] hover:border-[var(--color-accent-dim)] transition-colors">
            <Save className="w-3.5 h-3.5" /> 保存
          </button>
          <button onClick={() => setShowPanel(!showPanel)} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors">
            <Settings className="w-4 h-4 text-[var(--color-ink-muted)]" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 3D Canvas */}
        <div className="flex-1 relative">
          <StormVisualization {...vizProps} compact={false} />
        </div>

        {/* Right panel */}
        <AnimatePresence>
          {showPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="shrink-0 border-l border-[var(--border)] bg-[var(--color-surface-1)] overflow-y-auto overflow-x-hidden">
              <div className="p-5 space-y-6 w-[280px]">
                {/* Participants */}
                <div>
                  <h4 className="text-[var(--color-ink-muted)] mb-3">参与者</h4>
                  <div className="space-y-2">
                    {stormData.nodes.map(node => (
                      <button key={node.id}
                        onClick={() => setParticipantVisibility(prev => ({ ...prev, [node.id]: !(prev[node.id] ?? true) }))}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${participantVisibility[node.id] !== false ? 'bg-[var(--color-surface-2)]' : 'bg-[var(--color-surface-2)]/30 opacity-50'}`}>
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: node.color }} />
                        <span className="text-sm flex-1 truncate text-left">{node.name}</span>
                        <span className="text-xs text-[var(--color-ink-faint)] tabular-nums">{node.speakCount}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* View mode */}
                <div>
                  <h4 className="text-[var(--color-ink-muted)] mb-3">视图模式</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {(['timeline', 'summary'] as const).map(mode => (
                      <button key={mode} onClick={() => setViewMode(mode)}
                        className={`px-3 py-2 rounded-lg text-xs transition-colors ${viewMode === mode ? 'bg-[var(--color-accent)] text-[var(--primary-foreground)]' : 'bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)]'}`}>
                        {mode === 'timeline' ? '时间线' : '总览'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Render settings */}
                <div className="space-y-4">
                  <h4 className="text-[var(--color-ink-muted)]">渲染设置</h4>
                  <RangeControl label="粒子大小" value={particleSize} min={0.5} max={3} step={0.1} onChange={setParticleSize} />
                  <RangeControl label="动画速度" value={speed} min={0.1} max={3} step={0.1} onChange={setSpeed} />
                  <ToggleControl label="自动旋转" checked={autoRotate} onChange={setAutoRotate} />
                  <ToggleControl label="显示标签" checked={showLabels} onChange={setShowLabels} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RangeControl({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-[var(--color-ink-faint)]">{label}</span>
        <span className="text-[var(--color-ink-muted)] tabular-nums">{value.toFixed(1)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full bg-[var(--color-surface-3)] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-accent)]" />
    </div>
  );
}

function ToggleControl({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center justify-between w-full text-xs">
      <span className="text-[var(--color-ink-faint)]">{label}</span>
      <div className={`w-8 h-4 rounded-full transition-colors ${checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-3)]'}`}>
        <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
    </button>
  );
}
