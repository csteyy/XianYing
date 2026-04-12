import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Trash2, Clock, Users, BarChart3, X } from 'lucide-react';
import { toast } from 'sonner';
import { listSessions, deleteSession, getSession } from '@mobile/services/sessionStore';

interface HistoryPageProps {
  onNavigate: (page: string, data?: any) => void;
  pageData?: any;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function HistoryPage({ onNavigate }: HistoryPageProps) {
  const [sessions, setSessions] = useState(listSessions);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(s => s.sceneName.toLowerCase().includes(q) || s.speakers.some(sp => sp.name.toLowerCase().includes(q)));
  }, [sessions, search]);

  const selected = selectedId ? sessions.find(s => s.id === selectedId) : null;

  const handleDelete = (id: string) => {
    deleteSession(id);
    setSessions(listSessions());
    if (selectedId === id) setSelectedId(null);
    setDeleteTarget(null);
    toast.success('记录已删除');
  };

  return (
    <div className="h-full flex">
      {/* Left: list */}
      <div className="w-80 shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--color-surface-1)]">
        <div className="shrink-0 px-4 py-4 border-b border-[var(--border)] space-y-3">
          <h2 className="font-serif">记录</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-faint)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索场景名称或参与者..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--border)] text-sm placeholder:text-[var(--color-ink-faint)] focus:outline-none focus:border-[var(--color-accent-dim)] transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-sm text-[var(--color-ink-faint)]">
              {search ? '未找到匹配的记录' : '暂无录制记录'}
            </div>
          )}
          {filtered.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                selectedId === s.id
                  ? 'bg-[var(--color-accent-glow)] border border-[var(--color-accent-dim)]'
                  : 'hover:bg-[var(--color-surface-2)] border border-transparent'
              }`}
            >
              <p className="text-sm font-medium truncate">{s.sceneName || '未命名'}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-ink-faint)]">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{s.speakers.length}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(s.recordingTime)}</span>
                <span>{s.createdAt.slice(0, 10)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-[var(--color-ink-faint)]">
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">选择一条记录查看详情</p>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-8 py-8 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-serif">{selected.sceneName || '未命名'}</h1>
                <p className="text-sm text-[var(--color-ink-muted)] mt-1">
                  {selected.createdAt.slice(0, 10)} · {formatDuration(selected.recordingTime)} · {selected.speakers.length} 位参与者
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onNavigate('analysis', {
                    from: 'history', readOnly: true,
                    transcripts: selected.transcripts, speakers: selected.speakers,
                    annotatedData: selected.annotatedData, sessionId: selected.id,
                  })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[var(--color-accent)] text-[var(--primary-foreground)] hover:brightness-110 transition-all"
                >
                  <BarChart3 className="w-3.5 h-3.5" /> 查看分析
                </button>
                <button
                  onClick={() => setDeleteTarget(selected.id)}
                  className="p-2 rounded-lg border border-[var(--border)] text-[var(--color-ink-faint)] hover:text-[var(--color-negative)] hover:border-[var(--color-negative)] transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[var(--color-ink-muted)]">参与者</h3>
              <div className="flex flex-wrap gap-2">
                {selected.speakers.map(sp => (
                  <span key={sp.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-surface-1)] border border-[var(--border)] text-sm">
                    {sp.name}
                    <span className="text-xs text-[var(--color-ink-faint)]">{sp.speechCount}条</span>
                  </span>
                ))}
              </div>
            </div>

            {selected.transcripts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[var(--color-ink-muted)]">对话摘要（前10条）</h3>
                <div className="space-y-2">
                  {selected.transcripts.slice(0, 10).map((t, i) => (
                    <div key={i} className="flex gap-3 px-4 py-3 rounded-lg bg-[var(--color-surface-1)] border border-[var(--border)]">
                      <span className="text-xs text-[var(--color-ink-faint)] shrink-0 pt-0.5">{t.timestamp}</span>
                      <div>
                        <span className="text-xs font-medium text-[var(--color-accent)]">{t.speaker}</span>
                        <p className="text-sm mt-0.5">{t.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-80 p-6 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--border)] space-y-4"
            >
              <h3>确定删除？</h3>
              <p className="text-sm text-[var(--color-ink-muted)]">此操作不可撤销</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--color-surface-3)] transition-colors">取消</button>
                <button onClick={() => handleDelete(deleteTarget)} className="flex-1 py-2 rounded-lg bg-[var(--color-negative)] text-white text-sm hover:brightness-110 transition-all">删除</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
