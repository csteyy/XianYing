# 显·影 项目架构地图

> 本文档帮助你快速理解项目中每个文件和文件夹的职责，以及它们之间的关系。

---

## 技术栈总览

| 技术 | 角色 |
|---|---|
| **React 18** | UI 框架，用组件的方式构建界面 |
| **TypeScript** | JavaScript 的类型增强版，提供代码提示和错误检查 |
| **Vite** | 开发服务器 + 构建工具（类似 Webpack，但更快） |
| **Tailwind CSS v4** | 用 class 名直接写样式，不用写单独的 CSS 文件 |
| **shadcn/ui** | 基于 Radix 的 UI 组件库（按钮、对话框、滑块等基础积木） |
| **Motion (Framer Motion)** | 页面切换和元素的动画效果 |
| **Capacitor** | 把 Web 应用打包成 iOS 原生 App 的桥接层 |

---

## 页面流程图

```
首页 (HomePage)
  │
  ├─ [点击"新建记录" / FAB按钮]
  │   └─→ 场景设置 (RecordingModeSelectionPage)
  │         │   填写场景名称 + 添加参与者
  │         └─→ 录制 (RecordingPage)
  │               │   实时录音 + 转录字幕 + 声音波形
  │               └─→ 录后编辑 (PostRecordingEditPage)
  │                     │   校对转录文本 + 确认发言人
  │                     └─→ 数据分析 (DataAnalysisPage)
  │                           │   互动统计 + 气氛转折
  │                           └─→ 可视化 (Visualization3DPage)
  │                                 │   调整粒子/光束参数 → 生成作品
  │                                 └─→ 返回首页 ✓
  │
  ├─ [底部Tab: 记录] ─→ 历史记录 (HistoryPage)
  ├─ [底部Tab: 作品库] ─→ 作品库 (GalleryPage)
  └─ [底部Tab: 设置] ─→ 设置 (SettingsPage)
```

---

## 根目录文件说明

```
显影/
├── package.json                  # 项目依赖清单和构建脚本（npm install 读这个）
├── package-lock.json             # 依赖的精确版本锁定
├── vite.config.ts                # Vite 构建配置（端口、路径别名、构建输出目录等）
├── capacitor.config.json         # Capacitor 配置（App ID、名称、Web 资源目录）
├── index.html                    # Web 应用的 HTML 外壳，React 挂载到 <div id="root">
├── ARCHITECTURE.md               # ← 你正在读的这个文件
├── 显·影_产品愿景与概要_Context.md  # 产品愿景文档
├── README.md                     # 项目简介和运行说明
│
├── src/                          # ★ 核心前端源码（日常开发在这里）
├── build/                        # Vite 构建产物（自动生成，不要手动改）
├── ios/                          # Capacitor 生成的 iOS 原生项目
└── 显影/显影/                     # Xcode 原生入口（ContentView.swift 等）
```

---

## src/ 目录详解

```
src/
├── main.tsx                 # 【启动入口】把 React App 挂载到 HTML 的 #root 节点
├── App.tsx                  # 【路由中枢】管理所有页面的切换和页面间数据传递
├── index.css                # 【全局样式入口】引入 Tailwind 和自定义样式
│
├── styles/
│   └── globals.css          # 【主题与变量】CSS 颜色变量、字体、全局样式规则
│
├── utils/
│   └── speakerColors.ts     # 【工具函数】为不同发言人分配颜色
│
├── components/              # ★ 所有 UI 组件（详见下方）
│   ├── 页面组件 (xxxPage.tsx)
│   ├── 功能组件 (xxx.tsx)
│   ├── ui/                  # shadcn/ui 基础组件库
│   └── figma/               # Figma 相关辅助组件
│
└── guidelines/
    └── Guidelines.md        # AI 开发规范模板（待填充）
```

---

## components/ 组件清单

### 页面组件 — 每个对应 App 中一个完整页面

| 文件 | 产品页面 | 职责 |
|---|---|---|
| `HomePage.tsx` | 首页 | 主入口，展示功能卡片、粒子背景、最近记录 |
| `RecordingModeSelectionPage.tsx` | 场景设置 | 填写场景名称、添加参与者、选择录制模式 |
| `RecordingPage.tsx` | 录制中 | 实时录音、语音转写字幕、声音波形可视化 |
| `PostRecordingEditPage.tsx` | 录后编辑 | 录制结束后校对转录文本、确认发言人归属 |
| `DataAnalysisPage.tsx` | 数据分析 | 展示个人数据、发言详情、气氛转折点 |
| `Visualization3DPage.tsx` | 可视化生成 | 调整粒子和光束参数，生成互动艺术作品 |
| `HistoryPage.tsx` | 历史记录 | 浏览过往录制记录和转录数据 |
| `GalleryPage.tsx` | 作品库 | 浏览和筛选已生成的可视化艺术作品 |
| `SettingsPage.tsx` | 设置 | 录制/可视化/隐私/通知等设置项 |

### 功能组件 — 被多个页面复用或承担独立功能

| 文件 | 职责 |
|---|---|
| `BottomNav.tsx` | 底部 Tab 导航栏（首页/记录/作品库/设置） |
| `FloatingActionButton.tsx` | 浮动操作按钮（FAB），快速新建记录 |
| `OnboardingGuide.tsx` | 首次使用时弹出的新手引导教程 |
| `ParticleBackground.tsx` | 首页的装饰性动态粒子效果背景 |
| `SoundBars.tsx` | 录制时的音频柱状图动画组件 |
| `figma/ImageWithFallback.tsx` | 图片加载失败时的兜底显示组件 |

### ui/ — shadcn/ui 基础组件库

这个文件夹包含约 40 个通用 UI 组件（`button.tsx`、`dialog.tsx`、`slider.tsx` 等）。
它们是由 shadcn/ui 工具自动生成的"积木"，上面的页面组件会调用它们。

**日常开发时不需要逐一了解，需要用到某个 UI 元素时再查看对应文件。**

其中两个特殊工具文件：
- `ui/utils.ts` — `cn()` 样式合并工具函数（整个项目都在用）
- `ui/use-mobile.ts` — 检测是否为移动端的自定义 Hook

---

## ios/ 目录

Capacitor 自动生成的 iOS 原生项目，用于把 Web 应用打包成 iOS App。

- `ios/App/` — Xcode 项目主体
- `ios/App/App/public/` — 构建后的 Web 资源（`npm run build && npx cap sync ios` 自动同步）
- `ios/App/App/AppDelegate.swift` — iOS App 生命周期入口

**通常不需要手动修改这些文件，除非要配置 iOS 特有能力（推送、相机权限等）。**

---

## 数据流简述

```
App.tsx (状态中枢)
  │
  ├── currentPage (string)     → 决定当前显示哪个页面
  ├── pageData (any)           → 页面间传递的数据（如录制结果、发言人列表）
  └── handleNavigate(page, data) → 页面跳转函数，所有子页面通过它导航
```

当前没有使用全局状态管理库（如 Redux、Zustand），页面间数据通过 `App.tsx` 的 `pageData` state 传递。

---

## 构建与运行

```bash
# 安装依赖
cd 显影 && npm install

# 启动开发服务器（浏览器预览）
npm run dev          # → http://localhost:3000

# 构建生产版本
npm run build        # → 输出到 build/ 目录

# 同步到 iOS 并用 Xcode 运行
npm run build && npx cap sync ios
# 然后用 Xcode 打开 ios/App/App.xcodeproj
```
