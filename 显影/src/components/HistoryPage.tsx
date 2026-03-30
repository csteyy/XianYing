import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { ChevronLeft, Search, Trash2, X, Users, Check, FileBarChart, Calendar, Clock, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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
import { toast } from 'sonner';

interface HistoryPageProps {
  onNavigate: (page: string, data?: any) => void;
}

interface HistoryRecord {
  id: string;
  name: string;
  date: string;
  duration: string;
  participantNames: string[];
  status: string;
}

const initialRecords: HistoryRecord[] = [
  {
    id: '1',
    name: '毕业设计答辩',
    date: '2025-10-18',
    duration: '00:45:32',
    participantNames: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
    status: 'completed',
  },
  {
    id: '2',
    name: '小组讨论',
    date: '2025-10-17',
    duration: '00:32:15',
    participantNames: ['Alice', 'Bob', 'Frank'],
    status: 'completed',
  },
  {
    id: '3',
    name: '项目评审会',
    date: '2025-10-15',
    duration: '01:12:40',
    participantNames: ['Alice', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Heidi', 'Bob'],
    status: 'completed',
  },
  {
    id: '4',
    name: '午餐交流',
    date: '2025-10-14',
    duration: '00:28:05',
    participantNames: ['Bob', 'Charlie', 'Heidi', 'Diana'],
    status: 'completed',
  },
];

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

export function HistoryPage({ onNavigate }: HistoryPageProps) {
  const [records, setRecords] = useState<HistoryRecord[]>(initialRecords);
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
    records.forEach(r => r.participantNames.forEach(n => names.add(n)));
    return Array.from(names).sort();
  }, [records]);

  const speakerSuggestions = useMemo(() => {
    const available = allSpeakers.filter(n => !selectedSpeakers.includes(n));
    if (!speakerSearch.trim()) return available;
    const q = speakerSearch.toLowerCase();
    return available.filter(n => n.toLowerCase().includes(q));
  }, [speakerSearch, allSpeakers, selectedSpeakers]);

  const hasActiveFilters = searchQuery || timeRange !== 'all' || durationRange !== 'all' || selectedSpeakers.length > 0 || sortBy !== 'newest';

  const filteredItems = useMemo(() => {
    let items = [...records];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(r => r.name.toLowerCase().includes(q));
    }

    if (timeRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (timeRange === '7d') cutoff.setDate(now.getDate() - 7);
      else if (timeRange === '30d') cutoff.setDate(now.getDate() - 30);
      else if (timeRange === '1y') cutoff.setFullYear(now.getFullYear() - 1);
      items = items.filter(r => new Date(r.date) >= cutoff);
    }

    if (durationRange !== 'all') {
      items = items.filter(r => {
        const sec = parseDurationToSeconds(r.duration);
        if (durationRange === 'short') return sec < 1800;
        if (durationRange === 'medium') return sec >= 1800 && sec <= 3600;
        if (durationRange === 'long') return sec > 3600;
        return true;
      });
    }

    if (selectedSpeakers.length > 0) {
      items = items.filter(r => selectedSpeakers.every(s => r.participantNames.includes(s)));
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
  }, [records, searchQuery, timeRange, durationRange, selectedSpeakers, sortBy]);

  const clearFilters = () => {
    setSearchQuery('');
    setTimeRange('all');
    setDurationRange('all');
    setSortBy('newest');
    setSelectedSpeakers([]);
    setSpeakerSearch('');
  };

  const handleDelete = () => {
    if (deleteItem) {
      const record = records.find(r => r.id === deleteItem);
      setRecords(prev => prev.filter(r => r.id !== deleteItem));
      if (expandedId === deleteItem) setExpandedId(null);
      toast.success('记录已删除', { description: record ? `${record.name} 已从历史记录移除` : '' });
    }
    setDeleteItem(null);
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
            <h2 className="font-serif">历史记录</h2>
          </div>
          <Badge variant="secondary">{filteredItems.length} 条</Badge>
        </div>
      </div>

      <div className="px-6 py-4 max-w-2xl mx-auto">
        {/* Search */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 h-11 mb-4">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索记录..."
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
        <p className="text-xs text-muted-foreground mb-4">共 {filteredItems.length} 条记录</p>

        {/* Record List */}
        <LayoutGroup>
          <div className="space-y-4">
            {filteredItems.map((record, index) => (
              <motion.div
                key={record.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, layout: { duration: 0.3, type: 'spring', bounce: 0.15 } }}
                className="rounded-2xl bg-card border border-border overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                  className="w-full text-left px-6 pb-4 active:bg-muted/30 transition-colors"
                  style={{ paddingTop: 20 }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 mr-3">
                      <h4>{record.name}</h4>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="gap-1.5 text-xs px-2 py-0.5 font-medium border-border/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        已完成
                      </Badge>
                      <motion.div
                        animate={{ rotate: expandedId === record.id ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      </motion.div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{record.date}</span>
                    <span className="text-border">·</span>
                    <span>{record.duration}</span>
                    <span className="text-border">·</span>
                    <span>{record.participantNames.length} 人</span>
                  </div>
                </button>

                <AnimatePresence>
                  {expandedId === record.id && (
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
                            {record.participantNames.map(name => (
                              <span key={name} className="text-sm px-3 py-1 rounded-lg border border-border bg-muted/50 text-foreground">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="flex-1 h-10 rounded-xl gap-2" onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('data-analysis', { readOnly: true, from: 'history' });
                          }}>
                            <FileBarChart className="w-4 h-4" />
                            查看详情
                          </Button>
                          <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-destructive shrink-0" onClick={(e) => {
                            e.stopPropagation();
                            setDeleteItem(record.id);
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
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2">未找到匹配记录</h3>
            <p className="text-sm text-muted-foreground mb-4">尝试调整筛选条件</p>
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
              确定删除该记录？删除后无法恢复
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
