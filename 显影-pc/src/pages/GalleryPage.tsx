import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trash2, BarChart3, Eye, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { listGalleryItems, deleteSession, getSession } from '@mobile/services/sessionStore';

interface GalleryPageProps {
  onNavigate: (page: string, data?: any) => void;
  pageData?: any;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function GalleryPage({ onNavigate }: GalleryPageProps) {
  const [items, setItems] = useState(listGalleryItems);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    deleteSession(id);
    setItems(listGalleryItems());
    setDeleteTarget(null);
    toast.success('作品已删除');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">
        <div>
          <h1 className="font-serif">作品库</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">保存的可视化作品集</p>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Sparkles className="w-10 h-10 text-[var(--color-ink-faint)] mb-4" strokeWidth={1.3} />
            <p className="text-sm text-[var(--color-ink-muted)]">还没有保存的作品</p>
            <p className="text-xs text-[var(--color-ink-faint)] mt-1">录制对话并生成可视化后，作品会自动出现在这里</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)] overflow-hidden hover:border-[var(--color-accent-dim)] transition-colors"
              >
                {/* Thumbnail placeholder */}
                <div className="aspect-[4/3] bg-[var(--color-surface-0)] flex items-center justify-center relative">
                  <div className="w-16 h-16 rounded-full border border-[var(--border)] flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[var(--color-accent)]" />
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      onClick={() => {
                        const session = getSession(item.id);
                        if (session) onNavigate('visualization', { annotatedData: session.annotatedData, sessionId: item.id, from: 'gallery' });
                      }}
                      className="p-2.5 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
                    >
                      <Eye className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={() => {
                        const session = getSession(item.id);
                        if (session) onNavigate('analysis', { from: 'gallery', readOnly: true, transcripts: session.transcripts, speakers: session.speakers, annotatedData: session.annotatedData, sessionId: item.id });
                      }}
                      className="p-2.5 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
                    >
                      <BarChart3 className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item.id)}
                      className="p-2.5 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-red-500/30 transition-colors"
                    >
                      <Trash2 className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-sm font-medium truncate">{item.sceneName} 可视化</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-ink-faint)]">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{item.speakers.length}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(item.recordingTime)}</span>
                    <span>{item.createdAt.slice(0, 10)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-80 p-6 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--border)] space-y-4"
            >
              <h3>删除作品？</h3>
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
