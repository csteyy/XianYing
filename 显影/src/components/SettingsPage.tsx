import { motion } from 'motion/react';
import { ChevronLeft, Mic, Video, Palette, Shield, Bell, Info, ChevronRight } from 'lucide-react';
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

interface SettingsPageProps {
  onNavigate: (page: string) => void;
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  // Recording settings
  const [audioQuality, setAudioQuality] = useState('high');
  const [videoQuality, setVideoQuality] = useState('1080p');
  const [autoStart, setAutoStart] = useState(true);

  // Visualization settings
  const [defaultStyle, setDefaultStyle] = useState('particles');
  const [particleDensity, setParticleDensity] = useState([70]);
  const [animationSpeed, setAnimationSpeed] = useState([60]);

  // Privacy settings
  const [saveTranscripts, setSaveTranscripts] = useState(true);
  const [autoBackup, setAutoBackup] = useState(false);
  const [dataRetention, setDataRetention] = useState('30');

  // Notification settings
  const [recordingNotif, setRecordingNotif] = useState(true);
  const [analysisNotif, setAnalysisNotif] = useState(true);

  const settingsSections = [
    {
      id: 'recording',
      title: '录制设置',
      icon: Mic,
      color: 'text-foreground/70',
      items: [
        {
          label: '音频质量',
          type: 'select',
          value: audioQuality,
          onChange: setAudioQuality,
          options: [
            { value: 'low', label: '标准 (64kbps)' },
            { value: 'medium', label: '良好 (128kbps)' },
            { value: 'high', label: '高清 (320kbps)' },
          ],
        },
        {
          label: '视频质量',
          type: 'select',
          value: videoQuality,
          onChange: setVideoQuality,
          options: [
            { value: '720p', label: '720p HD' },
            { value: '1080p', label: '1080p Full HD' },
            { value: '4k', label: '4K Ultra HD' },
          ],
        },
        {
          label: '自动开始录制',
          description: '进入录制页面后自动开始',
          type: 'switch',
          value: autoStart,
          onChange: setAutoStart,
        },
      ],
    },
    {
      id: 'visualization',
      title: '可视化设置',
      icon: Palette,
      items: [
        {
          label: '默认风格',
          type: 'select',
          value: defaultStyle,
          onChange: setDefaultStyle,
          options: [
            { value: 'particles', label: '粒子系统' },
            { value: 'beams', label: '光束网络' },
            { value: 'waves', label: '波纹效果' },
            { value: 'constellation', label: '星座图' },
          ],
        },
        {
          label: '粒子密度',
          type: 'slider',
          value: particleDensity,
          onChange: setParticleDensity,
          min: 20,
          max: 100,
        },
        {
          label: '动画速度',
          type: 'slider',
          value: animationSpeed,
          onChange: setAnimationSpeed,
          min: 20,
          max: 100,
        },
      ],
    },
    {
      id: 'privacy',
      title: '隐私与数据',
      icon: Shield,
      items: [
        {
          label: '保存转录文本',
          description: '在设备上保存语音转文字结果',
          type: 'switch',
          value: saveTranscripts,
          onChange: setSaveTranscripts,
        },
        {
          label: '自动备份',
          description: '定期备份数据到云端',
          type: 'switch',
          value: autoBackup,
          onChange: setAutoBackup,
        },
        {
          label: '数据保留期限',
          type: 'select',
          value: dataRetention,
          onChange: setDataRetention,
          options: [
            { value: '7', label: '7 天' },
            { value: '30', label: '30 天' },
            { value: '90', label: '90 天' },
            { value: 'forever', label: '永久保留' },
          ],
        },
      ],
    },
    {
      id: 'notifications',
      title: '通知设置',
      icon: Bell,
      items: [
        {
          label: '录制提醒',
          description: '录制开始和结束时通知',
          type: 'switch',
          value: recordingNotif,
          onChange: setRecordingNotif,
        },
        {
          label: '分析完成',
          description: '数据分析完成时通知',
          type: 'switch',
          value: analysisNotif,
          onChange: setAnalysisNotif,
        },
      ],
    },
  ];

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
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-card border border-border overflow-hidden"
            >
              {/* Section Header */}
              <div className="p-4 border-b border-border flex items-center gap-2">
                <Icon className="w-5 h-5" />
                <h3>{section.title}</h3>
              </div>

              {/* Section Items */}
              <div className="p-4 space-y-6">
                {section.items.map((item, index) => (
                  <div key={index}>
                    {item.type === 'select' && (
                      <div className="space-y-2">
                        <label className="text-sm">{item.label}</label>
                        <Select
                          value={item.value as string}
                          onValueChange={item.onChange as (value: string) => void}
                        >
                          <SelectTrigger className="bg-input-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {item.options?.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {item.type === 'switch' && (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm mb-1">{item.label}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <Switch
                          checked={item.value as boolean}
                          onCheckedChange={item.onChange as (checked: boolean) => void}
                        />
                      </div>
                    )}

                    {item.type === 'slider' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm">{item.label}</label>
                          <span className="text-sm text-muted-foreground">
                            {(item.value as number[])[0]}%
                          </span>
                        </div>
                        <Slider
                          value={item.value as number[]}
                          onValueChange={item.onChange as (value: number[]) => void}
                          min={item.min}
                          max={item.max}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    )}

                    {index < section.items.length - 1 && (
                      <Separator className="my-4" />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}

        {/* About Section */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          className="w-full rounded-2xl bg-card border border-border p-5 flex items-center justify-between active:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-foreground rounded-full" />
            <div className="text-left">
              <h4>关于应用</h4>
              <p className="text-xs text-muted-foreground">查看版本信息和许可</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </motion.button>

        {/* Storage Info */}
        <div className="rounded-2xl bg-muted/30 border border-border p-5">
          <h4 className="mb-3">存储使用</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">录制数据</span>
              <span>2.3 GB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">可视化作品</span>
              <span>856 MB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">缓存数据</span>
              <span>124 MB</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span>总计</span>
              <span className="text-primary">3.28 GB</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full mt-4">
            清理缓存
          </Button>
        </div>

        {/* Danger Zone */}
        <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-5">
          <h4 className="text-destructive mb-2">危险操作</h4>
          <p className="text-sm text-muted-foreground mb-4">
            以下操作将永久删除数据，请谨慎操作
          </p>
          <Button variant="destructive" size="sm" className="w-full">
            删除所有数据
          </Button>
        </div>
      </div>
    </div>
  );
}