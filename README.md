<div align="center">

# 显·影 / XianYing

**将群体互动转化为光与数据的艺术**

*Transforming group interactions into light, data, and art.*

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com)
[![Three.js](https://img.shields.io/badge/Three.js-r169-000000?logo=threedotjs&logoColor=white)](https://threejs.org)

</div>

---

## 它是什么？

**显·影** 是一个实验性跨平台应用（Web + iOS），旨在捕捉群体对话中那些容易被忽略的互动细节——谁在对谁说话、情绪如何波动、气氛在哪个瞬间转折——并将这些数据转化为 **3D 粒子网络可视化艺术作品**。

> 每一个参与者是一颗发光的粒子。
> 每一次发言触发一道光束。
> 光束的粗细是音量，颜色是情绪。
> 一场对话，最终成为一幅可以回看的「光的画」。

---

## 核心能力

| 能力 | 描述 |
|:---|:---|
| 🎙️ **实时语音采集** | 调用设备麦克风，实时录制群体对话 |
| 📝 **ASR 语音转写** | 接入火山引擎 ASR，支持流式 & 文件转写 |
| 🏷️ **说话人识别** | 自动区分发言人，录后可手动校对 |
| 📊 **互动数据分析** | 发言频率、情绪基调、气氛转折点等结构化指标 |
| ✨ **3D 可视化生成** | 基于 Three.js / R3F 的粒子-光束网络，数据驱动艺术输出 |
| 📱 **跨平台** | Web 浏览器直接访问，iOS 通过 Capacitor 原生打包 |

---

## 技术栈

```
React 18 · TypeScript · Vite 6 · Tailwind CSS v4
Three.js + React Three Fiber · Framer Motion
shadcn/ui + Radix · Capacitor 8 (iOS)
火山引擎 ASR · Google Sheets API
```

---

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/csteyy/XianYing.git
cd XianYing/显影

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入你的密钥

# 启动开发服务器
npm run dev
```

### iOS 构建

```bash
npm run build
npx cap sync ios
# 用 Xcode 打开 ios/App/App.xcodeproj
```

---

## 项目结构

```
显影/
├── src/
│   ├── components/       # 页面 & 功能组件
│   │   ├── HomePage.tsx              # 首页 · 粒子背景
│   │   ├── RecordingPage.tsx         # 录制 · 实时转写
│   │   ├── PostRecordingEditPage.tsx # 录后编辑 · 校对
│   │   ├── DataAnalysisPage.tsx      # 数据分析 · 指标
│   │   ├── Visualization3DPage.tsx   # 3D 可视化生成
│   │   └── ui/                       # shadcn/ui 组件库
│   ├── services/
│   │   ├── volcengine/   # 火山引擎 ASR 客户端
│   │   └── googleSheets/ # Google Sheets 数据同步
│   ├── hooks/            # 自定义 Hooks (ASR / 音频捕获)
│   └── utils/            # 工具函数
├── server/               # 代理服务 (WebSocket / TOS)
├── ios/                  # Capacitor iOS 原生项目
└── 论文/                  # 毕业论文相关资料
```

---

## 页面流

```
首页 → 场景设置 → 录制 → 录后编辑 → 数据分析 → 3D 可视化
 │
 ├── 历史记录
 ├── 作品库
 └── 设置
```

---

## 环境变量

在 `显影/` 目录下创建 `.env.local`（参考 `.env.example`）：

| 变量 | 说明 |
|:---|:---|
| `VITE_VOLCENGINE_API_KEY` | 火山引擎 ASR API Key |
| `VITE_VOLCENGINE_STREAM_RESOURCE_ID` | 流式识别资源 ID |
| `VITE_VOLCENGINE_FILE_RESOURCE_ID` | 文件识别资源 ID |
| `VITE_GOOGLE_SPREADSHEET_ID` | Google Sheets 表格 ID |
| `TOS_ACCESS_KEY_ID` | 火山引擎 TOS Access Key |
| `TOS_SECRET_ACCESS_KEY` | 火山引擎 TOS Secret Key |
| `TOS_REGION` / `TOS_BUCKET` / `TOS_ENDPOINT` | TOS 存储配置 |

---

## License

MIT
