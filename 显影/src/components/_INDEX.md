# components/ 目录索引

> 本目录包含显·影 App 的所有 UI 组件。分为三类：**页面组件**、**功能组件**、**基础 UI 组件**。

---

## 页面组件 — 每个文件 = App 中的一个完整页面

按用户流程排序：

| # | 文件 | 页面名称 | 用户在这里做什么 |
|---|---|---|---|
| 1 | `HomePage.tsx` | 首页 | 看到功能入口、最近记录、开始新录制 |
| 2 | `RecordingModeSelectionPage.tsx` | 场景设置 | 填写场景名称、添加参与者、选录制模式 |
| 3 | `RecordingPage.tsx` | 录制中 | 实时录音，看到转录字幕和声音波形 |
| 4 | `PostRecordingEditPage.tsx` | 录后编辑 | 校对自动转录的文本，修正发言人归属 |
| 5 | `DataAnalysisPage.tsx` | 数据分析 | 查看互动统计、发言详情、气氛转折点 |
| 6 | `Visualization3DPage.tsx` | 可视化生成 | 调整粒子/光束参数，生成互动艺术作品 |
| 7 | `HistoryPage.tsx` | 历史记录 | 浏览过往的录制记录 |
| 8 | `GalleryPage.tsx` | 作品库 | 浏览已生成的可视化作品 |
| 9 | `SettingsPage.tsx` | 设置 | 配置录制、可视化、隐私、通知选项 |

---

## 功能组件 — 独立功能模块，被页面复用

| 文件 | 用在哪 | 职责 |
|---|---|---|
| `BottomNav.tsx` | 全局 | 底部 Tab 导航栏（首页/记录/作品库/设置） |
| `FloatingActionButton.tsx` | 首页/记录/作品库 | 右下角悬浮的"+"按钮，一键新建记录 |
| `OnboardingGuide.tsx` | 首次启动 | 新手引导弹窗，教用户如何使用 |
| `ParticleBackground.tsx` | 首页 | 首页背景的动态粒子效果 |
| `SoundBars.tsx` | 录制页 | 实时音频柱状图动画 |

---

## ui/ — shadcn/ui 基础组件库

约 40 个通用 UI 积木（按钮、对话框、滑块、卡片等），由 shadcn/ui 自动生成。
**不需要逐一了解**，需要用某个 UI 元素时再查看。

常用的几个：
- `button.tsx` — 按钮
- `card.tsx` — 卡片容器
- `dialog.tsx` — 弹窗对话框
- `tabs.tsx` — 标签页切换
- `slider.tsx` — 滑块
- `sheet.tsx` — 底部抽屉
- `progress.tsx` — 进度条
- `scroll-area.tsx` — 自定义滚动区域

工具文件：
- `utils.ts` — `cn()` 函数，用于合并 Tailwind 样式类名（整个项目到处都在用）
- `use-mobile.ts` — 自定义 Hook，检测当前是否为移动端

---

## figma/ — Figma 辅助组件

| 文件 | 职责 |
|---|---|
| `ImageWithFallback.tsx` | 图片加载失败时显示占位符 |
