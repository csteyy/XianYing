import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Palette, Shield, Info, Database, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { getSettings, updateSettings, getStorageStats, clearCache, clearAllData } from '@mobile/services/settingsStore';

interface SettingsPageProps {
  onNavigate: (page: string) => void;
  pageData?: any;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const [settings, setSettings] = useState(getSettings);
  const [storageStats, setStorageStats] = useState(getStorageStats);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const update = (partial: Parameters<typeof updateSettings>[0]) => {
    const next = updateSettings(partial);
    setSettings(next);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-8">
        <div>
          <h1 className="font-serif">设置</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">应用配置与数据管理</p>
        </div>

        {/* Visualization defaults */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[var(--color-accent)]" />
            <h3>可视化默认值</h3>
          </div>
          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)] space-y-5">
            <SettingRange label="默认粒子大小" value={settings.defaultParticleSize} min={0.5} max={3} step={0.1}
              onChange={v => update({ defaultParticleSize: v })} />
            <SettingRange label="默认动画速度" value={settings.defaultAnimationSpeed} min={0.1} max={3} step={0.1}
              onChange={v => update({ defaultAnimationSpeed: v })} />
          </div>
        </section>

        {/* Privacy */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--color-accent)]" />
            <h3>隐私与数据</h3>
          </div>
          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)] space-y-5">
            <SettingToggle label="保存转录文本" desc="关闭后仅保存分析结果" checked={settings.saveTranscripts}
              onChange={v => update({ saveTranscripts: v })} />
            <SettingRange label="数据保留天数" value={settings.dataRetentionDays} min={0} max={365} step={1}
              onChange={v => update({ dataRetentionDays: v })} suffix="天 (0=永久)" />
          </div>
        </section>

        {/* Storage */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[var(--color-accent)]" />
            <h3>存储</h3>
          </div>
          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)] space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-ink-muted)]">已使用</span>
              <span className="tabular-nums">{formatBytes(storageStats.total)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-ink-muted)]">会话数据</span>
              <span className="tabular-nums">{formatBytes(storageStats.sessions)}</span>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { clearCache(); setStorageStats(getStorageStats()); toast.success('缓存已清除'); }}
                className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--color-surface-2)] transition-colors"
              >
                清除缓存
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="flex-1 py-2 rounded-lg border border-[var(--color-negative)] text-[var(--color-negative)] text-sm hover:bg-[var(--color-negative)] hover:text-white transition-all"
              >
                <span className="flex items-center justify-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> 清除所有数据</span>
              </button>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--color-accent)]" />
            <h3>关于</h3>
          </div>
          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--color-surface-1)] space-y-4">
            <div className="text-sm text-[var(--color-ink-muted)] space-y-2">
              <p>显·影 桌面版 v0.1.0</p>
              <p className="text-xs text-[var(--color-ink-faint)]">让不可见的互动，显影为艺术</p>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('xianying-pc-onboarded');
                toast.success('引导页已重置，刷新页面后生效');
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> 重新查看引导页
            </button>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showDeleteDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-80 p-6 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--border)] space-y-4"
            >
              <h3>清除所有数据？</h3>
              <p className="text-sm text-[var(--color-ink-muted)]">所有录制记录和作品将被永久删除，此操作不可撤销</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteDialog(false)} className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--color-surface-3)] transition-colors">取消</button>
                <button onClick={() => { clearAllData(); setStorageStats(getStorageStats()); setShowDeleteDialog(false); toast.success('数据已清除'); }}
                  className="flex-1 py-2 rounded-lg bg-[var(--color-negative)] text-white text-sm hover:brightness-110 transition-all">确认删除</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingRange({ label, value, min, max, step, onChange, suffix }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-[var(--color-ink-muted)]">{label}</span>
        <span className="tabular-nums">{step < 1 ? value.toFixed(1) : value}{suffix ? ` ${suffix}` : ''}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full bg-[var(--color-surface-3)] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-accent)]"
      />
    </div>
  );
}

function SettingToggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center justify-between w-full text-left">
      <div>
        <p className="text-sm">{label}</p>
        {desc && <p className="text-xs text-[var(--color-ink-faint)] mt-0.5">{desc}</p>}
      </div>
      <div className={`w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-3)]'}`}>
        <div className={`w-3.5 h-3.5 rounded-full bg-white mt-[3px] transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
      </div>
    </button>
  );
}
