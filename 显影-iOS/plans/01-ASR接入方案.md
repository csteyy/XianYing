# 豆包 ASR 接入方案

## 现状分析

项目为 React + TypeScript + Vite + Capacitor 的 PWA/iOS 应用。当前录音和转录均为模拟：

- `RecordingPage.tsx`: 用 `setInterval` + 硬编码模拟逐字打印
- `SoundBars.tsx`: 随机高度，未接入真实音频
- 无 `MediaRecorder`、`AudioContext`
- 无后端或 API 调用

## 核心挑战

1. **浏览器 WebSocket 不支持自定义 Header**：豆包流式 ASR 要求握手时传 `X-Api-App-Key`、`X-Api-Access-Key` 等 Header
2. **自定义二进制协议**：流式 ASR 使用 4 字节 header + payload size + gzip payload 的二进制帧
3. **音频格式转换**：`getUserMedia` 输出浮点 PCM，ASR 要求 PCM s16le 16kHz 单声道
4. **说话人分离**：流式 ASR 不支持说话人识别，只有录音文件识别支持 `enable_speaker_info`

## 整体架构

```
前端 React App
├── RecordingPage（录制页）
├── AudioCapture（音频采集）
├── StreamingASR Client（流式 ASR 客户端）
├── FileASR Client（文件 ASR 客户端）
└── BinaryProtocol（编解码）

后端代理 Node.js
├── WebSocket Proxy
└── HTTP Proxy

火山引擎
├── wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async（流式）
├── POST /api/v3/auc/bigmodel/submit（文件提交）
└── POST /api/v3/auc/bigmodel/query（文件查询）
```

## 两条 ASR 链路

| 场景     | API                       | 用途                 |
|----------|---------------------------|----------------------|
| 录制中   | 双向流式优化版 `bigmodel_async` | 实时转录文字         |
| 录制结束 | 录音文件识别 `/auc/bigmodel`   | 精确结果 + 说话人分离 |

## 代理层方案

因浏览器 WebSocket 无法带自定义 Header，需要轻量代理：

- **开发环境**：在 `vite.config.ts` 或独立 Node 脚本中添加 WebSocket 代理
- **生产环境**：部署 Node.js 或 Cloudflare Worker / Vercel Edge
- **Capacitor iOS**：可考虑原生 WebSocket 插件直连，绕过代理

## 新增文件结构

```
src/services/volcengine/
  config.ts, protocol.ts, streamingClient.ts, fileClient.ts, types.ts
src/services/audio/
  recorder.ts, pcmWorklet.ts
src/hooks/
  useStreamingASR.ts, useFileASR.ts, useAudioCapture.ts
server/wsProxy.ts
public/pcm-worklet-processor.js
```

## 环境变量

```
VITE_VOLCENGINE_APP_KEY=
VITE_VOLCENGINE_ACCESS_KEY=
VITE_VOLCENGINE_RESOURCE_ID=volc.bigasr.sauc.duration
VITE_VOLCENGINE_FILE_RESOURCE_ID=volc.bigasr.auc
```

---

## iOS-first 修订版

### P0 问题

1. **Node.js 代理在 iOS 上不可用**：`server/wsProxy.ts` 依赖 Node，iOS 上不存在
2. **缺少麦克风权限**：Info.plist 缺少 `NSMicrophoneUsageDescription`，会导致崩溃
3. **文件识别 URL 问题**：`fileClient.ts` 使用 base64 data URL，火山引擎要求可 HTTP 下载的公开 URL

### 修订架构：平台适配策略

| 功能             | iOS (Capacitor)                              | Web 开发                 |
|------------------|----------------------------------------------|---------------------------|
| WebSocket 流式 ASR | 原生 Capacitor 插件（URLSessionWebSocketTask） | localhost 代理           |
| HTTP 文件识别    | `fetch` 直连火山引擎                          | localhost 代理           |
| 音频 URL         | 上传对象存储获取公开 URL                       | 同上                     |

### 新增文件

- `src/services/platform.ts`：平台检测与统一 `connectWebSocket()` / `httpRequest()`
- `ios/App/App/NativeWebSocketPlugin.swift`：Capacitor 原生 WebSocket 插件
- `ios/App/App/NativeWebSocketPlugin.m`：ObjC 桥接

### 修改文件

- Info.plist：添加 `NSMicrophoneUsageDescription`、`NSCameraUsageDescription`
- streamingClient.ts：通过 `platform.ts` 建连，iOS 用原生插件直连
- fileClient.ts：移除 data URL，改为上传到对象存储获取 URL；iOS 直连火山引擎
- recorder.ts：AudioWorklet 路径兼容 Capacitor WebView
- capacitor.config.json：增加 server 白名单
