import { motion } from 'motion/react';
import { ChevronLeft, Palette, Shield, Info, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Slider } from './ui/slider';
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
import { toast } from 'sonner';
import {
  getSettings,
  updateSettings,
  getStorageStats,
  clearCache,
  clearAllData,
} from '../services/settingsStore';

interface SettingsPageProps {
  onNavigate: (page: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const [settings, setSettings] = useState(getSettings);

  const update = (partial: Parameters<typeof updateSettings>[0]) => {
    const next = updateSettings(partial);
    setSettings(next);
  };

  const [showAbout, setShowAbout] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [storageStats, setStorageStats] = useState(getStorageStats);

  const refreshStorage = () => setStorageStats(getStorageStats());

  return (
    <div className="min-h-full bg-background text-foreground pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('home')}
            className="w-11 h-11 mr-2"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h2 className="flex-1 font-serif">设置</h2>
          <Badge variant="outline">v1.0.0</Badge>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 max-w-2xl mx-auto space-y-8">

        {/* ── 可视化设置 ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-border overflow-hidden"
        >
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Palette className="w-5 h-5" />
            <h3>可视化默认值</h3>
          </div>
          <div className="p-4 space-y-6">
            {/* 粒子大小 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm">粒子大小</label>
                <span className="text-sm text-muted-foreground">{settings.defaultParticleSize.toFixed(1)}x</span>
              </div>
              <Slider
                value={[settings.defaultParticleSize]}
                onValueChange={(v) => update({ defaultParticleSize: v[0] })}
                min={0.5}
                max={2}
                step={0.1}
                className="w-full"
              />
            </div>

            <Separator />

            {/* 动画速度 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm">动画速度</label>
                <span className="text-sm text-muted-foreground">{settings.defaultAnimationSpeed.toFixed(1)}x</span>
              </div>
              <Slider
                value={[settings.defaultAnimationSpeed]}
                onValueChange={(v) => update({ defaultAnimationSpeed: v[0] })}
                min={0.3}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>
        </motion.div>

        {/* ── 隐私与数据 ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-border overflow-hidden"
        >
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <h3>隐私与数据</h3>
          </div>
          <div className="p-4 space-y-6">
            {/* 保存转录文本 */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm mb-1">保存转录文本</p>
                <p className="text-xs text-muted-foreground">关闭后历史记录将不保存原始对话文本，节省空间</p>
              </div>
              <Switch
                checked={settings.saveTranscripts}
                onCheckedChange={(v) => update({ saveTranscripts: v })}
              />
            </div>

            <Separator />

            {/* 数据保留期限 */}
            <div className="space-y-2">
              <label className="text-sm">数据保留期限</label>
              <Select
                value={String(settings.dataRetentionDays)}
                onValueChange={(v) => update({ dataRetentionDays: Number(v) })}
              >
                <SelectTrigger className="bg-input-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 天</SelectItem>
                  <SelectItem value="30">30 天</SelectItem>
                  <SelectItem value="90">90 天</SelectItem>
                  <SelectItem value="0">永久保留</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                超过期限的历史记录和作品将被自动清理
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── 关于应用 ── */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAbout(!showAbout)}
          className="w-full rounded-2xl bg-card border border-border p-5 flex items-center justify-between active:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5" />
            <div className="text-left">
              <h4>关于应用</h4>
              <p className="text-xs text-muted-foreground">版本信息和项目说明</p>
            </div>
          </div>
          <motion.div animate={{ rotate: showAbout ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </motion.div>
        </motion.button>

        {showAbout && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-2xl bg-card border border-border p-5 -mt-4 space-y-3"
          >
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">项目名称</span>
              <span>显影 XianYing</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">版本</span>
              <span>1.0.0</span>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground leading-relaxed">
              「显影」是一个将多人对话数据转化为 3D 可视化艺术作品的工具。通过录制、语音识别、AI 标注和粒子系统渲染，呈现对话中的互动关系与情绪流动。
            </p>
          </motion.div>
        )}

        {/* ── 存储使用 ── */}
        <div className="rounded-2xl bg-muted/30 border border-border p-5">
          <h4 className="mb-3">存储使用</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">会话数据</span>
              <span>{formatBytes(storageStats.sessions)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">设置</span>
              <span>{formatBytes(storageStats.settings)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">其他缓存</span>
              <span>{formatBytes(storageStats.other)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span>总计</span>
              <span className="text-primary">{formatBytes(storageStats.total)}</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4"
            onClick={() => {
              clearCache();
              refreshStorage();
              toast.success('缓存已清理');
            }}
          >
            清理缓存
          </Button>
        </div>

        {/* ── 危险操作 ── */}
        <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-5">
          <h4 className="text-destructive mb-2">危险操作</h4>
          <p className="text-sm text-muted-foreground mb-4">
            删除所有历史记录和作品数据，此操作不可恢复
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => setShowDeleteDialog(true)}
          >
            删除所有数据
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除所有数据</AlertDialogTitle>
            <AlertDialogDescription>
              这将永久删除所有历史记录、作品数据和标注结果。此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearAllData();
                refreshStorage();
                toast.success('所有数据已删除');
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
