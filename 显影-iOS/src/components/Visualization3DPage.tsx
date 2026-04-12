import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, Save, Download, Settings, Sparkles, Maximize2, X, FileText, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Progress } from './ui/progress';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { getSpeakerColor } from '../utils/speakerColors';
import StormVisualization, { ModeBar, TimelineBar, type ViewMode, type CaptureHandle } from './StormVisualization';
import { MOOD_COLORS } from '../data/stormTypes';
import type { AnnotatedRecord } from '../utils/transformAnnotatedToStorm';
import {
  transformAnnotatedToStorm,
  getMockStormData,
  type TransformedStormData,
} from '../utils/transformAnnotatedToStorm';
import { markVisualization } from '../services/sessionStore';
import { getSettings } from '../services/settingsStore';

interface Visualization3DPageProps {
  onNavigate: (page: string, data?: any) => void;
  annotatedData?: AnnotatedRecord[];
  from?: string;
  sessionId?: string;
}

const EMOTION_LABELS: Record<string, string> = {
  positive: '积极',
  negative: '消极',
  calm: '平静',
};

type ExportFormat = 'png' | 'gif';

const RESOLUTION_OPTIONS: { value: string; size: number; label: string }[] = [
  { value: 'ultra', size: 4096, label: '超清 (4096×4096)' },
  { value: 'high', size: 2048, label: '高清 (2048×2048)' },
  { value: 'standard', size: 1024, label: '标准 (1024×1024)' },
];

export function Visualization3DPage({ onNavigate, annotatedData, from, sessionId }: Visualization3DPageProps) {
  const [activeTab, setActiveTab] = useState('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const stormData: TransformedStormData = useMemo(() => {
    if (annotatedData && annotatedData.length > 0) {
      return transformAnnotatedToStorm(annotatedData);
    }
    return getMockStormData();
  }, [annotatedData]);

  const [viewMode, setViewMode] = useState<'timeline' | 'summary'>('timeline');
  const [showLabels, setShowLabels] = useState(true);
  const [particleSize, setParticleSize] = useState(() => getSettings().defaultParticleSize);
  const [speedMultiplier, setSpeedMultiplier] = useState(() => getSettings().defaultAnimationSpeed);
  const [autoRotate, setAutoRotate] = useState(true);
  const [nodeColors, setNodeColors] = useState<Record<string, string>>(() => {
    const colors: Record<string, string> = {};
    stormData.nodes.forEach((n) => { colors[n.id] = n.color; });
    return colors;
  });
  const [participantVisibility, setParticipantVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(stormData.nodes.map((n) => [n.id, true])),
  );

  const visibleNodes = useMemo(
    () => stormData.nodes.filter((n) => participantVisibility[n.id] !== false),
    [stormData.nodes, participantVisibility],
  );
  const visibleEvents = useMemo(
    () => stormData.events.filter(
      (e) => participantVisibility[e.source] !== false && participantVisibility[e.target] !== false,
    ),
    [stormData.events, participantVisibility],
  );
  const visibleEdges = useMemo(
    () => stormData.aggregatedEdges.filter(
      (e) => participantVisibility[e.source] !== false && participantVisibility[e.target] !== false,
    ),
    [stormData.aggregatedEdges, participantVisibility],
  );

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [eventIdx, setEventIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const manualScrubRef = useRef(false);

  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportResolution, setExportResolution] = useState('high');
  const [isCapturing, setIsCapturing] = useState(false);
  const [gifProgress, setGifProgress] = useState(0);
  const captureRef = useRef<CaptureHandle | null>(null);
  const gifCancelRef = useRef(false);

  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    try {
      (screen.orientation as any)?.lock?.('landscape').catch(() => {});
    } catch { /* not supported */ }
  }, []);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    try {
      screen.orientation?.unlock?.();
    } catch { /* not supported */ }
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exitFullscreen(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen, exitFullscreen]);

  const handleSave = () => {
    toast.success('可视化作品已保存至作品库', {
      description: '您可以继续编辑或返回查看',
      duration: 3000,
    });
  };

  const finishExport = useCallback(() => {
    toast.success('作品生成完成！', {
      description: '可视化艺术作品已保存至作品库',
      duration: 3000,
    });
    setTimeout(() => onNavigate('gallery'), 1500);
  }, [onNavigate]);

  const triggerDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = () => {
    if (sessionId) {
      markVisualization(sessionId);
    }

    setIsCapturing(true);
    setGifProgress(0);
    gifCancelRef.current = false;
    if (activeTab !== 'preview') setActiveTab('preview');
  };

  // PNG capture: single frame after canvas mounts
  useEffect(() => {
    if (!isCapturing || activeTab !== 'preview' || exportFormat !== 'png') return;

    const timer = setTimeout(() => {
      const res = RESOLUTION_OPTIONS.find((r) => r.value === exportResolution);
      const size = res?.size ?? 2048;

      const dataUrl = captureRef.current?.capture(size);
      if (dataUrl) {
        triggerDownload(dataUrl, `显影-可视化-${Date.now()}.png`);
        toast.success('PNG 已保存', { description: `分辨率 ${size}×${size}` });
      } else {
        toast.error('截图失败，请重试');
      }

      setIsCapturing(false);
      finishExport();
    }, 800);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCapturing, activeTab, exportFormat]);

  // GIF capture: multiple frames over time
  useEffect(() => {
    if (!isCapturing || activeTab !== 'preview' || exportFormat !== 'gif') return;

    const GIF_SIZE = 480;
    const FRAME_COUNT = 36;
    const FRAME_DELAY_MS = 100;

    let cancelled = false;
    gifCancelRef.current = false;

    const run = async () => {
      await new Promise((r) => setTimeout(r, 800));
      if (cancelled || gifCancelRef.current) return;

      const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
      const encoder = GIFEncoder();

      for (let i = 0; i < FRAME_COUNT; i++) {
        if (cancelled || gifCancelRef.current) {
          setIsCapturing(false);
          return;
        }

        await new Promise((r) => setTimeout(r, FRAME_DELAY_MS));
        const pixels = captureRef.current?.capturePixels(GIF_SIZE);
        if (!pixels) continue;

        const palette = quantize(pixels, 256);
        const index = applyPalette(pixels, palette);
        encoder.writeFrame(index, GIF_SIZE, GIF_SIZE, { palette, delay: FRAME_DELAY_MS });
        setGifProgress(((i + 1) / FRAME_COUNT) * 100);
      }

      encoder.finish();
      const blob = new Blob([encoder.bytes()], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `显影-可视化-${Date.now()}.gif`);
      URL.revokeObjectURL(url);

      toast.success('GIF 已保存', { description: `${FRAME_COUNT} 帧 · ${GIF_SIZE}×${GIF_SIZE}` });
      setIsCapturing(false);
      finishExport();
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCapturing, activeTab, exportFormat]);

  const controlledProps = {
    selectedNode,
    onNodeSelect: setSelectedNode,
    eventIdx,
    onEventIdxChange: setEventIdx,
    isPlaying,
    onPlayingChange: setIsPlaying,
    onViewModeChange: setViewMode as (m: 'summary' | 'timeline') => void,
    manualScrubRef,
  };

  const vizProps = {
    nodes: visibleNodes,
    events: visibleEvents,
    aggregatedEdges: visibleEdges,
    nodeColors,
    speedMultiplier,
    autoRotate,
    showLabels,
    particleSize,
    viewMode,
    ...controlledProps,
  };

  const focusedNode = visibleNodes.find((n) => n.id === selectedNode);

  return (
    <>
      <div className="h-dvh bg-background flex flex-col overflow-hidden">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
          <div className="flex items-center justify-between px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (from === 'gallery') {
                  onNavigate('gallery');
                } else {
                  onNavigate('data-analysis', { annotatedData, sessionId, from: 'home' });
                }
              }}
              className="w-11 h-11"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <h2 className="font-serif">3D 可视化</h2>
            <div className="w-11" />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="border-b border-border bg-background px-4">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                艺术化呈现
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                可视化设置
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Settings Tab ── */}
          <TabsContent value="settings" className="flex-1 m-0 p-0">
            <div className="h-full overflow-y-auto">
              <div className="max-w-2xl mx-auto px-6 py-6 pb-20 space-y-8">

                {/* 参与者显示 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-foreground rounded-full" />
                    <h3>参与者显示</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stormData.nodes.map((node) => (
                      <div key={node.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={nodeColors[node.id] || node.color}
                            onChange={(e) => setNodeColors((prev) => ({ ...prev, [node.id]: e.target.value }))}
                            className="w-6 h-6 rounded-md border-2 border-border cursor-pointer p-0"
                            style={{ background: 'transparent' }}
                          />
                          <span>{node.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({node.speakCount}次发言)
                          </span>
                        </div>
                        <Switch
                          checked={participantVisibility[node.id] !== false}
                          onCheckedChange={(checked) =>
                            setParticipantVisibility((prev) => ({ ...prev, [node.id]: checked }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 情绪颜色映射 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-foreground rounded-full" />
                    <h3>情绪 → 电流颜色映射</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {(Object.entries(MOOD_COLORS) as [string, string][]).map(([mood, color]) => (
                      <div key={mood} className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card">
                        <div className="w-12 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        <span>{EMOTION_LABELS[mood] || mood}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    电流颜色由发言情绪自动决定：积极=绿色，消极=红色，平静=蓝色
                  </p>
                </div>

                {/* 视觉参数 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-foreground rounded-full" />
                    <h3>视觉参数</h3>
                  </div>
                  <div className="space-y-6 p-6 rounded-lg border border-border bg-card">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>粒子大小</Label>
                        <span className="text-sm text-muted-foreground">{particleSize.toFixed(1)}x</span>
                      </div>
                      <Slider value={[particleSize]} onValueChange={(v) => setParticleSize(v[0])} min={0.5} max={2} step={0.1} className="w-full" />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>动画速度</Label>
                        <span className="text-sm text-muted-foreground">{speedMultiplier.toFixed(1)}x</span>
                      </div>
                      <Slider value={[speedMultiplier]} onValueChange={(v) => setSpeedMultiplier(v[0])} min={0.3} max={3} step={0.1} className="w-full" />
                    </div>

                    <div className="space-y-3">
                      <Label>视图模式</Label>
                      <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'timeline' | 'summary')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="timeline">时间轴播放</SelectItem>
                          <SelectItem value="summary">总览汇总</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>自动旋转</Label>
                      <Switch checked={autoRotate} onCheckedChange={setAutoRotate} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>显示标签</Label>
                      <Switch checked={showLabels} onCheckedChange={setShowLabels} />
                    </div>
                  </div>
                </div>

                {/* 字段映射说明 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-foreground rounded-full" />
                    <h3>字段映射</h3>
                  </div>
                  <div className="space-y-2 p-6 rounded-lg border border-border bg-card text-sm">
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">发言者</span>
                      <span>粒子身份 + 颜色</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">对谁发言</span>
                      <span>电流方向</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">情绪基调</span>
                      <span>电流颜色（绿/红/蓝）</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">发言时长</span>
                      <span>电流长度（优先使用实际时长）</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">互动类型</span>
                      <span>电流碰撞爆炸 / 交互标签</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">语速</span>
                      <span>电流粒子密度</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">音量</span>
                      <span>电流粗细 / 强度</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">话题标签</span>
                      <span>节点分组聚类</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">对话转折</span>
                      <span>闪电涟漪特效</span>
                    </div>
                  </div>
                </div>

                {/* 导出配置 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-foreground rounded-full" />
                    <h3>导出设置</h3>
                  </div>
                  <div className="space-y-4 p-6 rounded-lg border border-border bg-card">
                    <div className="space-y-3">
                      <Label>导出格式</Label>
                      <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="png">静态图 (PNG)</SelectItem>
                          <SelectItem value="gif">动图 (GIF)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {exportFormat === 'png' ? (
                      <div className="space-y-3">
                        <Label>分辨率</Label>
                        <Select value={exportResolution} onValueChange={setExportResolution}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RESOLUTION_OPTIONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          超清模式在低端设备上可能较慢，如导出失败会自动降级
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>GIF 参数</Label>
                        <p className="text-sm text-muted-foreground">
                          480×480 · 36 帧 · 约 3.6 秒动画
                        </p>
                        <p className="text-xs text-muted-foreground">
                          导出过程中动画将被逐帧捕获，耗时约 10 秒
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Preview Tab ── */}
          <TabsContent value="preview" className="flex-1 m-0 p-0 overflow-y-auto">
            <div className="flex flex-col items-center gap-4 p-4 pt-6">
              {/* Square preview card */}
              <div className="relative w-full rounded-2xl overflow-hidden border border-border shadow-sm" style={{ maxWidth: 'min(calc(100vw - 32px), 420px)', aspectRatio: '1 / 1' }}>
                <StormVisualization {...vizProps} compact captureRef={captureRef} />
                <button
                  onClick={enterFullscreen}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
                  style={{
                    zIndex: 10,
                    position: 'relative',
                    background: 'rgba(26,26,26,0.75)',
                    backdropFilter: 'blur(8px)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  全屏浏览
                </button>
              </div>

              {/* External controls below the card */}
              <div className="flex flex-col items-center gap-3 w-full" style={{ maxWidth: 'min(calc(100vw - 32px), 420px)' }}>
                <ModeBar mode={viewMode} setMode={setViewMode} />

                {viewMode === 'timeline' && (
                  <TimelineBar
                    eventIdx={eventIdx}
                    setEventIdx={(idx) => { manualScrubRef.current = true; setEventIdx(idx); }}
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                    total={visibleEvents.length}
                    events={visibleEvents}
                    nodes={visibleNodes}
                    nodeColors={nodeColors}
                    onManualScrub={() => { manualScrubRef.current = true; }}
                  />
                )}
              </div>

              {/* Focus card -- shown when a node is selected */}
              {focusedNode && (
                <div
                  className="w-full rounded-xl border border-border bg-card p-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
                  style={{ maxWidth: 'min(calc(100vw - 32px), 420px)', fontFamily: "Georgia, 'Songti SC', serif" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: nodeColors[focusedNode.id] || focusedNode.color, boxShadow: `0 0 6px ${(nodeColors[focusedNode.id] || focusedNode.color)}66` }} />
                      <span className="font-semibold text-base">{focusedNode.name}</span>
                    </div>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="text-xs text-muted-foreground px-2.5 py-1 rounded-lg hover:bg-muted transition-colors"
                    >
                      关闭
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 mb-3">
                    {[
                      { l: '发言次数', v: `${focusedNode.speakCount}` },
                      { l: '平均时长', v: `${focusedNode.avgDuration}s` },
                      { l: '总时长', v: `${Math.floor(focusedNode.totalDuration / 60)}m` },
                    ].map((s) => (
                      <div key={s.l} className="bg-muted/50 rounded-lg p-2.5 text-center">
                        <div className="text-[10px] text-muted-foreground mb-0.5">{s.l}</div>
                        <div className="text-sm font-semibold">{s.v}</div>
                      </div>
                    ))}
                  </div>
                  {focusedNode.keywords.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] text-muted-foreground mb-1.5">高频关键词</div>
                      <div className="flex flex-wrap gap-1.5">
                        {focusedNode.keywords.map((kw) => (
                          <span key={kw} className="text-[11px] px-2 py-0.5 rounded-full border" style={{ borderColor: `${nodeColors[focusedNode.id] || focusedNode.color}30`, color: nodeColors[focusedNode.id] || focusedNode.color, background: `${nodeColors[focusedNode.id] || focusedNode.color}10` }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {focusedNode.topics.length > 0 && (
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1.5">常聊话题</div>
                      <div className="flex flex-wrap gap-1.5">
                        {focusedNode.topics.map((t) => (
                          <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Brief info cards */}
              <div className="w-full grid grid-cols-3 gap-3" style={{ maxWidth: 'min(calc(100vw - 32px), 420px)' }}>
                <div className="flex flex-col items-center py-3 rounded-xl border border-border bg-card">
                  <span className="text-lg font-semibold">{visibleNodes.length}</span>
                  <span className="text-xs text-muted-foreground">参与者</span>
                </div>
                <div className="flex flex-col items-center py-3 rounded-xl border border-border bg-card">
                  <span className="text-lg font-semibold">{visibleEvents.length}</span>
                  <span className="text-xs text-muted-foreground">发言事件</span>
                </div>
                <div className="flex flex-col items-center py-3 rounded-xl border border-border bg-card">
                  <span className="text-lg font-semibold">{visibleEdges.length}</span>
                  <span className="text-xs text-muted-foreground">互动连线</span>
                </div>
              </div>

              {/* Participant legend */}
              <div className="w-full flex flex-wrap justify-center gap-2.5" style={{ maxWidth: 'min(calc(100vw - 32px), 420px)' }}>
                {visibleNodes.map((n) => (
                  <span
                    key={n.id}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm border border-border bg-card"
                  >
                    {n.name}
                  </span>
                ))}
              </div>

              {/* Data source reference */}
              <button
                type="button"
                onClick={() => onNavigate('data-analysis', {
                  readOnly: true,
                  from: 'visualization',
                  annotatedData,
                  sessionId,
                })}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-card text-sm active:opacity-70 transition-opacity"
                style={{ maxWidth: 'min(calc(100vw - 32px), 420px)', color: '#3b82f6' }}
              >
                <FileText className="w-4 h-4" />
                <span>查看数据来源</span>
              </button>

              <p className="text-xs text-muted-foreground text-center" style={{ maxWidth: 'min(calc(100vw - 32px), 420px)' }}>
                点击「全屏浏览」进入沉浸模式，查看完整交互详情
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Bottom Action Bar */}
        {(activeTab === 'settings' || isCapturing) && (
          <div className="fixed bottom-0 left-0 right-0 px-4 py-2 bg-background/95 backdrop-blur-lg border-t border-border safe-bottom z-30" style={{ minHeight: '68px' }}>
            <div className="max-w-2xl mx-auto flex gap-3">
              <Button onClick={handleSave} variant="outline" className="flex-1 h-10" disabled={isCapturing}>
                <Save className="w-4 h-4 mr-2" />
                保存
              </Button>
              <div className="flex-1 flex flex-col gap-1">
                <Button onClick={handleExport} className="w-full h-10" disabled={isCapturing}>
                  {isCapturing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {exportFormat === 'gif' ? `GIF ${Math.round(gifProgress)}%` : '导出中...'}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      完成并导出
                    </>
                  )}
                </Button>
                {isCapturing && exportFormat === 'gif' && (
                  <Progress value={gifProgress} className="h-1" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Fullscreen Immersive Overlay ── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50" style={{ background: '#faf9f7' }}>
          <StormVisualization {...vizProps} compact={false} />
          <button
            onClick={exitFullscreen}
            className="absolute top-4 left-4 z-[60] flex items-center justify-center w-10 h-10 rounded-full transition-all active:scale-90"
            style={{
              background: 'rgba(26,26,26,0.7)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)',
              top: 'max(16px, env(safe-area-inset-top, 16px))',
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  );
}
