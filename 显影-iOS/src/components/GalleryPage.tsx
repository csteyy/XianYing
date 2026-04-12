import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { ChevronLeft, Download, Share2, Trash2, Search, X, FileText, SlidersHorizontal, Users, Check, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { listGalleryItems, deleteSession as removeSession, getSession } from '../services/sessionStore';

interface GalleryPageProps {
  onNavigate: (page: string, data?: any) => void;
}

interface GalleryItem {
  id: string;
  title: string;
  date: string;
  duration: string;
  participantNames: string[];
  sourceRecordName: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function loadGallery(): GalleryItem[] {
  return listGalleryItems().map((s) => ({
    id: s.id,
    title: `${s.sceneName} 可视化`,
    date: s.createdAt.slice(0, 10),
    duration: formatDuration(s.recordingTime),
    participantNames: s.speakers.map((sp) => sp.name),
    sourceRecordName: s.sceneName || '未命名会话',
  }));
}

type TimeRange = 'all' | '7d' | '30d' | '1y';
type DurationRange = 'all' | 'short' | 'medium' | 'long';
type SortBy = 'newest' | 'oldest' | 'longest' | 'shortest' | 'most-people' | 'least-people';

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: 'all', label: '全部时间' },
  { value: '7d', label: '7 天内' },
  { value: '30d', label: '30 天内' },
  { value: '1y', label: '1 年内' },
];

const durationOptions: { value: DurationRange; label: string }[] = [
  { value: 'all', label: '全部时长' },
  { value: 'short', label: '< 30 分钟' },
  { value: 'medium', label: '30–60 分钟' },
  { value: 'long', label: '> 60 分钟' },
];

const sortOptions: { value: SortBy; label: string }[] = [
  { value: 'newest', label: '最新优先' },
  { value: 'oldest', label: '最早优先' },
  { value: 'longest', label: '时长最长' },
  { value: 'shortest', label: '时长最短' },
  { value: 'most-people', label: '人数最多' },
  { value: 'least-people', label: '人数最少' },
];

function parseDurationToSeconds(duration: string): number {
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export function GalleryPage({ onNavigate }: GalleryPageProps) {
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(loadGallery);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [durationRange, setDurationRange] = useState<DurationRange>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>([]);
  const [speakerSearch, setSpeakerSearch] = useState('');
  const [deleteItem, setDeleteItem] = useState<string | null>(null);

  const allSpeakers = useMemo(() => {
    const names = new Set<string>();
    galleryItems.forEach(item => item.participantNames.forEach(n => names.add(n)));
    return Array.from(names).sort();
  }, [galleryItems]);

  const speakerSuggestions = useMemo(() => {
    const available = allSpeakers.filter(n => !selectedSpeakers.includes(n));
    if (!speakerSearch.trim()) return available;
    const q = speakerSearch.toLowerCase();
    return available.filter(n => n.toLowerCase().includes(q));
  }, [speakerSearch, allSpeakers, selectedSpeakers]);

  const hasActiveFilters = searchQuery || timeRange !== 'all' || durationRange !== 'all' || selectedSpeakers.length > 0 || sortBy !== 'newest';

  const filteredItems = useMemo(() => {
    let items = [...galleryItems];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => item.title.toLowerCase().includes(q) || item.sourceRecordName.toLowerCase().includes(q));
    }

    if (timeRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (timeRange === '7d') cutoff.setDate(now.getDate() - 7);
      else if (timeRange === '30d') cutoff.setDate(now.getDate() - 30);
      else if (timeRange === '1y') cutoff.setFullYear(now.getFullYear() - 1);
      items = items.filter(item => new Date(item.date) >= cutoff);
    }

    if (durationRange !== 'all') {
      items = items.filter(item => {
        const sec = parseDurationToSeconds(item.duration);
        if (durationRange === 'short') return sec < 1800;
        if (durationRange === 'medium') return sec >= 1800 && sec <= 3600;
        if (durationRange === 'long') return sec > 3600;
        return true;
      });
    }

    if (selectedSpeakers.length > 0) {
      items = items.filter(item => selectedSpeakers.every(s => item.participantNames.includes(s)));
    }

    items.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'oldest': return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'longest': return parseDurationToSeconds(b.duration) - parseDurationToSeconds(a.duration);
        case 'shortest': return parseDurationToSeconds(a.duration) - parseDurationToSeconds(b.duration);
        case 'most-people': return b.participantNames.length - a.participantNames.length;
        case 'least-people': return a.participantNames.length - b.participantNames.length;
        default: return 0;
      }
    });

    return items;
  }, [galleryItems, searchQuery, timeRange, durationRange, selectedSpeakers, sortBy]);

  const clearFilters = () => {
    setSearchQuery('');
    setTimeRange('all');
    setDurationRange('all');
    setSortBy('newest');
    setSelectedSpeakers([]);
    setSpeakerSearch('');
  };

  const handleDownload = (e: React.MouseEvent, item: GalleryItem) => {
    e.stopPropagation();
    toast.success('作品已保存到相册', { description: `${item.title} 已成功下载` });
  };

  const handleShare = (e: React.MouseEvent, item: GalleryItem) => {
    e.stopPropagation();
    toast.success('分享链接已复制', { description: '分享前请确保已获得参与者授权' });
  };

  const handleDelete = () => {
    if (deleteItem) {
      const item = galleryItems.find(i => i.id === deleteItem);
      removeSession(deleteItem);
      setGalleryItems(prev => prev.filter(i => i.id !== deleteItem));
      if (expandedId === deleteItem) setExpandedId(null);
      toast.success('作品已删除', { description: item ? `${item.title} 已从作品库移除` : '' });
    }
    setDeleteItem(null);
  };

  const navigateToVisualization = (e: React.MouseEvent, item: GalleryItem) => {
    e.stopPropagation();
    const session = getSession(item.id);
    onNavigate('visualization', {
      annotatedData: session?.annotatedData,
      from: 'gallery',
      sessionId: item.id,
    });
  };

  const navigateToDataSource = (e: React.MouseEvent, item: GalleryItem) => {
    e.stopPropagation();
    const session = getSession(item.id);
    onNavigate('data-analysis', {
      readOnly: true,
      from: 'gallery',
      transcripts: session?.transcripts,
      speakers: session?.speakers,
      annotatedData: session?.annotatedData,
    });
  };

  const toggleSpeaker = (name: string) => {
    setSelectedSpeakers(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  return (
    <div className="min-h-full bg-background text-foreground pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => onNavigate('home')} className="w-11 h-11 mr-2">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex-1">
            <h2 className="font-serif">作品库</h2>
          </div>
          <Badge variant="secondary">{filteredItems.length} 件</Badge>
        </div>
      </div>

      <div className="px-6 py-4 max-w-2xl mx-auto">
        {/* Search */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 h-11 mb-4">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索标题..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground min-w-0 h-full py-0"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="shrink-0 p-1">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-auto h-8 px-3 text-xs rounded-full gap-1 border-border bg-card [&>svg]:ml-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeRangeOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={durationRange} onValueChange={(v) => setDurationRange(v as DurationRange)}>
            <SelectTrigger className="w-auto h-8 px-3 text-xs rounded-full gap-1 border-border bg-card [&>svg]:ml-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {durationOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-auto h-8 px-3 text-xs rounded-full gap-1 border-border bg-card [&>svg]:ml-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-full border transition-colors ${
                  selectedSpeakers.length > 0
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{selectedSpeakers.length > 0 ? `${selectedSpeakers.length} 人` : '参与者'}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
              <div className="p-2 border-b border-border">
                <input
                  value={speakerSearch}
                  onChange={e => setSpeakerSearch(e.target.value)}
                  placeholder="搜索参与者..."
                  className="w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground px-2 py-1.5"
                />
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {speakerSuggestions.length > 0 ? (
                  speakerSuggestions.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleSpeaker(name)}
                      className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md active:bg-muted transition-colors"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        selectedSpeakers.includes(name) ? 'bg-primary border-primary' : 'border-border'
                      }`}>
                        {selectedSpeakers.includes(name) && <Check className="w-3 h-3 text-primary-foreground" />}
                      </span>
                      <span>{name}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">无匹配结果</p>
                )}
              </div>
              {selectedSpeakers.length > 0 && (
                <div className="p-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setSelectedSpeakers([])}
                    className="w-full text-xs text-muted-foreground active:text-foreground transition-colors py-1"
                  >
                    清除选择
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="h-8 px-3 text-xs text-muted-foreground active:text-foreground transition-colors whitespace-nowrap">
              清空
            </button>
          )}
        </div>

        {/* Selected speaker chips */}
        {selectedSpeakers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {selectedSpeakers.map(name => (
              <span key={name} className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-primary/10 text-xs">
                {name}
                <button type="button" onClick={() => toggleSpeaker(name)}>
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Result count */}
        <p className="text-xs text-muted-foreground mb-4">共 {filteredItems.length} 件作品</p>

        {/* Gallery List */}
        <LayoutGroup>
          <div className="space-y-4">
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, layout: { duration: 0.3, type: 'spring', bounce: 0.15 } }}
                className="rounded-2xl bg-card border border-border overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full text-left px-6 pb-4 active:bg-muted/30 transition-colors"
                  style={{ paddingTop: 20 }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="flex-1 mr-3">{item.title}</h4>
                    <motion.div
                      animate={{ rotate: expandedId === item.id ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0 mt-0.5"
                    >
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    </motion.div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{item.date}</span>
                    <span className="text-border">·</span>
                    <span>{item.duration}</span>
                    <span className="text-border">·</span>
                    <span>{item.participantNames.length} 人</span>
                  </div>
                </button>

                <AnimatePresence>
                  {expandedId === item.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 space-y-4" style={{ paddingBottom: 28 }}>
                        {/* Participants */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">参与者</p>
                          <div className="flex flex-wrap gap-2">
                            {item.participantNames.map(name => (
                              <span key={name} className="text-sm px-3 py-1 rounded-lg border border-border bg-muted/50 text-foreground">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Source record */}
                        <button
                          type="button"
                          onClick={(e) => navigateToDataSource(e, item)}
                          className="flex items-center gap-2 text-sm active:opacity-70 transition-opacity"
                          style={{ color: '#3b82f6' }}
                        >
                          <FileText className="w-4 h-4" />
                          <span>数据来源：{item.sourceRecordName}</span>
                          <ChevronRight className="w-4 h-4 opacity-50" />
                        </button>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="flex-1 h-10 rounded-xl gap-2" onClick={(e) => navigateToVisualization(e, item)}>
                            <Eye className="w-4 h-4" /> 查看作品
                          </Button>
                          <Button size="sm" variant="outline" className="h-10 rounded-xl gap-1.5 px-3" onClick={(e) => handleDownload(e, item)}>
                            <Download className="w-4 h-4" /> 下载
                          </Button>
                          <Button size="sm" variant="outline" className="h-10 rounded-xl gap-1.5 px-3" onClick={(e) => handleShare(e, item)}>
                            <Share2 className="w-4 h-4" /> 分享
                          </Button>
                          <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-destructive shrink-0" onClick={(e) => {
                            e.stopPropagation();
                            setDeleteItem(item.id);
                          }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </LayoutGroup>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <SlidersHorizontal className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2">{hasActiveFilters ? '未找到匹配作品' : '暂无已生成的作品'}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {hasActiveFilters ? '尝试调整筛选条件' : '完成录制并生成可视化后，作品会自动出现在这里'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>清空筛选</Button>
            )}
          </motion.div>
        )}
      </div>

      <AlertDialog open={deleteItem !== null} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除该作品？删除后无法恢复
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
