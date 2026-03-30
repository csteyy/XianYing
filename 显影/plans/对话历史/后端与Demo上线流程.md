# 后端与Demo上线流程


---

## 用户

Search through my recent agent transcripts to find conversations about: 后端


## 助手

The user wants me to search through their recent agent transcripts to find conversations about "后端" (backend). Let me search the agent transcripts directory for this keyword.


## 助手

找到了 3 个包含"后端"相关内容的对话记录。让我读取每个文件的关键内容来了解具体讨论了什么。

I found 3 transcript files that contain "后端". Let me read the relevant parts of each to understand the conversation context. Let me read each file to get more details.


## 助手

找到了 3 个涉及"后端"的对话记录。让我进一步获取每个对话的具体内容摘要。

I found 3 conversations that mention "后端". Let me now read each file more carefully to get a summary of the conversation topics. Let me read the first few lines of each file to understand the overall topic.


## 助手

Now let me get more detail from the third conversation (e072fd34) to see its conclusion, and also get the key conclusion from the first conversation (de4d2b92).


## 助手

以下是搜索到的 3 个涉及"后端"的对话记录摘要：

---

### 1. [豆包ASR接入方案](de4d2b92-1659-488b-8261-cad916828c45)

**主题**：在显影项目中接入火山引擎豆包 ASR 大模型，替换现有的模拟转录逻辑。

**后端相关内容**：
- 分析了当前项目**没有任何后端或 API 调用**的现状
- 规划了搭建 **WebSocket/HTTP 代理层**（`server/wsProxy.ts`）来解决浏览器无法携带自定义 Header 的问题
- 讨论了实现流式 ASR 客户端、音频采集、二进制协议编解码器等后端基础设施
- 涉及的核心挑战包括：浏览器 WebSocket 限制、自定义二进制协议、音频格式转换、说话人分离

---

### 2. [显影iOS技术栈与迁移](4f0dea8b-a712-47b9-9c66-a34aca52fdb9)

**主题**：将前端项目迁移为 iOS 移动端应用，选择技术栈。

**后端相关内容**：
- 用户要求"保留下所有的代码逻辑和**前后端逻辑**"
- 最终选择了 **Capacitor** 方案（100% 复用 TS/React 代码，无需语言切换）
- 对比了 Capacitor、React Native、纯 Swift + WKWebView 三种方案
- 确认当前项目主要是前端，后端逻辑需要后续集成

---

### 3. [代码数据Mock检查](e072fd34-d5ab-464c-9831-cbb8b0141ad6)

**主题**：检查 demo 代码中的数据是"有真实功能但用了假数据 mock"还是"直接写死了"。

**后端相关内容**：
- 用户明确说"只做了前端，**没有开始做后端**"，希望功能都是写好的只是用了假数据
- 检查发现了**关键数据流断裂问题**：
  - `DataAnalysisPage` 和 `Visualization3DPage` 完全不接收前面传来的数据，全部硬编码
  - `HistoryPage` 记录完全写死，删除/筛选功能是假的
  - `SettingsPage` 设置不持久化
- 录制流程前半段（首页 → 模式选择 → 录制 → 编辑）数据流是通的，但从 `DataAnalysisPage` 开始数据链完全断裂
- 给出了 P0-P2 的修复优先级清单

---

**总结**：这 3 个对话都围绕"显影"项目，核心问题是项目目前纯前端、无后端，且部分页面数据流存在断裂。后续需要：① 搭建后端代理层接入豆包 ASR；② 修复前端数据流断裂；③ 通过 Capacitor 打包为 iOS 应用。

Now I have a good understanding of the 3 conversations. Let me summarize them for the user.

1. **de4d2b92** - 豆包 ASR 接入方案 - This conversation is about integrating Volcengine's (ByteDance/Doubao) ASR API into the 显影 project. It discusses the WebSocket proxy server, binary protocol encoding/decoding, audio capture, streaming ASR client, and file ASR. The "后端" mentions are about the fact that the current project has no backend or API calls, and they need to set up a backend proxy layer.


2. **4f0dea8b** - 显影 iOS 技术栈与迁移 - This conversation covers migrating the existing React frontend into an iOS app using Capacitor while maintaining all the frontend and backend logic.
3. **e072fd34** - 代码数据检查 - This conversation examines whether the current code uses properly mocked data for future backend integration or just hardcoded values, revealing broken data flows in DataAnalysisPage and Visualization3DPage.

Let me format a nice summary for the user.


---

## 用户

现在我应该是修复了很多东西了，当然我没有具体接那个飞书啊，然后豆包API的部分，但是我把框架搭了嘛，那所以你帮我看一下

如果还要把这个APP上线的话，在Xcode上build完之后，我还要做什么准备补？或者说如果我只先给我自己一个人去用，就当做一个demo的，但是他一定要支持所有的那些功能都是真的，我怎么去弄呢？

我先不处理那个后端数据库给其他人，因为我先给我自己用的情况下。我是一个文科生啊，你自己帮我思考一下，给一个保姆级教程


## 助手

让我先全面了解一下项目当前的状态，看看你已经修复了哪些、还缺什么。

The user wants me to:
1. Check the current state of their "显影" project to see what's been fixed/built
2. Figure out what they still need to do to get the app working as a real demo for themselves
3. They want all features to actually work (not just mock data)
4. They don't need multi-user backend/database for now - just for personal use
5. They're a liberal arts student, so they need a very beginner-friendly guide
6. They've already set up the framework but haven't integrated Feishu or Doubao API yet

Let me first explore the current state of the project to understand what's been built and what's missing.


## 助手

现在我已经全面了解了项目的当前状态。让我再确认几个关键细节。

Now I have a comprehensive understanding of the project. Let me also read the key configuration files and the ARCHITECTURE.md to understand the full picture, then create a plan.

Let me summarize what's been done and what's missing:

**Already built:**
1. React + Vite + Capacitor framework ✅
2. Audio recording with AudioWorklet (real audio capture) ✅
3. Volcengine ASR integration code (streaming + file) ✅
4. Feishu Bitable integration code ✅
5. WebSocket proxy server ✅
6. iOS native WebSocket plugin ✅


7. Data flow from RecordingPage → PostRecordingEditPage → DataAnalysisPage (partially) ✅
8. Platform detection (web vs native) ✅
9. PCM worklet processor ✅

**What's missing for a working personal demo:**

1. **API Keys & Configuration:**
   - Need real Volcengine API keys (app key, access key, resource IDs)
   - Need real Feishu app credentials (app ID, app secret, bitable tokens)
   - Or: Can they use it without Feishu? The code seems to gracefully degrade

2. **Data persistence (localStorage/IndexedDB):**
   - No persistence for recordings, history, gallery, settings
   - HistoryPage uses mock data
   - GalleryPage uses mock data
   - SettingsPage doesn't persist

3. **Data flow gaps:**
   - DataAnalysisPage → Visualization3DPage: no data passed
   - HistoryPage/GalleryPage: not connected to real recordings
   - HomePage file upload: doesn't actually process files

4. **iOS deployment:**
   - Apple Developer account ($99/year) for personal use or free provisioning
   - Code signing
   - Build and install on device

5. **Backend for iOS:**
   - The proxy server runs on localhost - won't work on a real iOS device
   - iOS uses native WebSocket directly for ASR (bypasses proxy) ✅
   - But Feishu integration on iOS - does it go through proxy or direct?

Looking at the platform detection and service code, native iOS bypasses the proxy for ASR with direct WebSocket, but Feishu integration likely still routes through the proxy, which would break on a real device since the proxy is localhost-only. I need to figure out whether Feishu also needs special native handling or if it can work differently on iOS.

The user wants a step-by-step tutorial for a personal demo without worrying about multi-user backend. They mentioned skipping Feishu for now, so the real priorities are: getting Volcengine ASR working with their own API keys, persisting recordings and history locally, and deploying to their iPhone with free provisioning. I should focus the tutorial on those core features rather than trying to make everything work at once.

The tricky part is handling the proxy server on a real iPhone—ASR streaming uses native WebSocket which bypasses the proxy, but I need to verify whether file ASR uploads also work directly on iOS or if they need special handling. Since they're just testing personally, I can probably simplify this by having them test on the simulator first where the proxy works, then figure out the iOS-specific networking if needed. The core issue is that without Feishu, the analysis page needs to generate real statistics from the actual transcript data rather than falling back to mock data. Since the user emphasized that all features must be functional, I need to build out the data analysis pipeline to compute speaker counts, word frequencies, and time distributions from the raw transcripts. This means organizing the work into three phases: setting up Volcengine credentials and configuration, fixing the data persistence and flow throughout the app, and finally building and deploying to iOS. I should also clarify whether they have a paid Apple Developer account or plan to use free provisioning, since that affects the deployment timeline.


## 助手

Now let me check how DataAnalysisPage handles the data when it has real transcripts vs mock data, and check a few more files.


## 助手

Now I have a comprehensive understanding. Let me also check the SettingsPage briefly and the volcengine config to understand what's needed.


## 助手

Now I have a very comprehensive understanding of the project. Let me create a detailed, beginner-friendly plan.

Key findings:
1. The project has a well-structured codebase with React + Vite + Capacitor
2. ASR services (Volcengine) are coded but need real API keys
3. Feishu integration is coded but user wants to skip it
4. Data persistence is completely missing (no localStorage/IndexedDB)
5. Several pages still use hardcoded data
6. The iOS project exists and seems properly configured
7. The proxy server exists for web development

For a personal demo that "all features are real", the user needs:


First, I'll set up Volcengine API keys by registering and configuring them in .env.local. Then I need to build out a localStorage persistence layer to handle recordings, history, gallery, and settings data, fix the data flow so DataAnalysisPage works with actual transcript data instead of relying on Feishu, and make the HistoryPage, GalleryPage, and SettingsPage all dynamic and properly connected to the persistent storage. Finally, I'll handle the graceful removal of Feishu dependencies where they're blocking functionality.

For file ASR, I need a public audio URL, so I'm either skipping file uploads entirely and relying on streaming ASR, or setting up object storage like TOS. Then for iOS, I'll build and deploy through Xcode with free provisioning, but I'm wondering whether the Feishu proxy integration will work the same way on native iOS as it does on the web—since ASR uses native WebSocket and bypasses the proxy, I need to verify if Feishu calls also bypass it or if they still route through the proxy on device.

Looking at the Feishu client, it probably uses the proxy path, which means on iOS native it would fail since there's no proxy running—but that's okay since I'm skipping Feishu anyway. The real constraint is that file ASR with speaker diarization requires object storage, whereas streaming ASR works fine with just API keys, so the decision hinges on whether speaker diarization is actually needed.

Checking RecordingPage, it looks like there's a manual speaker assignment system, so streaming ASR could provide the transcription text while users manually tag who said what—that's workable as a basic version. For a fully-featured setup, they'd need Volcengine API keys for streaming ASR, object storage for file ASR, and Feishu for annotation, but the first two are the real requirements. I'm also thinking about what "上线" means in this context—whether they're building for personal use or something more.

For personal use on their own iPhone, they don't need App Store distribution; they can just use Xcode's free provisioning with their Apple ID, though it requires re-signing every 7 days, or they could pay for the Developer Program for yearly provisioning. My plan is to tackle this in phases: set up Volcengine API integration, add a local storage layer for persistence, skip Feishu for now, wire up the 3D visualization with real data, persist the history and settings, then handle iOS deployment to a physical device.

For the audio upload challenge, I'm thinking the simplest path is to focus on streaming ASR first since that works in real-time, skip file-based ASR entirely to avoid needing object storage, keep Feishu disabled, add localStorage for data persistence, fix the data flow to work with streaming transcription, and then deploy to iPhone—this gives them a working demo without the complexity of managing file uploads.

Now I'm realizing I should also verify whether the iOS app can actually connect directly to Volcengine's API, since that affects whether we need a backend proxy or if we can call it directly from the client.

Let me organize this into a comprehensive, beginner-friendly plan with clear phases. I'll include both Apple Developer account options since the user might not have one yet, and structure everything as a step-by-step tutorial that walks through the storage layer, fixing the data flow so analysis computes from actual transcripts, and getting the file upload working properly.


## 助手

Good, now I can see how the recording actually works. The RecordingPage uses real `useAudioCapture` and `useStreamingASR` hooks. It captures real audio and sends it to the streaming ASR service. The ASR returns utterances with speaker information.

Let me also check how the PostRecordingEditPage handles the Feishu integration - specifically what happens when Feishu is not configured.


## 助手

Now I have a very complete picture. Let me also check the DataAnalysisPage's `buildParticipants` function to understand how it processes annotated data.


## 助手

Now I have a very complete understanding. Let me also check how the App.tsx renders the Visualization3DPage - whether it passes data or not.


## 助手

我现在对项目有了全面了解。让我整理一份完整的计划。

Now I have everything I need. Let me create the comprehensive plan.

Summary of what's needed:

**Current Status:**
- Framework: React + Vite + Capacitor ✅
- Audio capture (AudioWorklet, PCM) ✅
- Streaming ASR (Volcengine) code ✅
- File ASR code ✅
- Feishu integration code ✅
- iOS native WebSocket plugin ✅
- Proxy server ✅
- Platform detection (web/native) ✅

**What's Missing/Broken:**

1. **API Keys**: `.env.local` has placeholders, no real keys


2. **Data persistence**: Nothing survives a refresh or app restart
3. **DataAnalysisPage**: Falls back to mock data when Feishu data isn't available, but doesn't actually generate analysis from the raw transcripts
4. **Visualization3DPage**: Only gets navigation callbacks, no actual data to display
5. **HistoryPage, GalleryPage, SettingsPage**: All hardcoded or not persisted
6. **turningPoints**: Always hardcoded in DataAnalysisPage
7. **File ASR**: Missing the audio upload endpoint
8. **Feishu integration**: Requires real credentials and Bitable configuration

For a personal demo without Feishu, the real problem is that DataAnalysisPage needs to generate meaningful analysis directly from raw transcript data—speaker names, text content, and timestamps—rather than relying on Feishu's AI annotations. My approach is to set up Volcano Engine API access first, then build a local storage layer to persist recordings and settings, and finally make DataAnalysisPage work independently by processing the transcript data it receives.

From there, I'll wire up the 3D visualization to accept real transcript and speaker data, persist the history and gallery to localStorage, and handle iOS deployment through Capacitor. The optional final phase covers file-based ASR and Feishu integration if needed later.

Actually, I'm realizing the user is a humanities student asking for a "step-by-step tutorial," which means they probably want me to handle most of the code implementation while giving them clear instructions for the parts they need to do manually—like API registration and Xcode setup.

Let me organize this into concrete action items: which files to modify, which new files to create, and then separate guides for the external setup steps like Volcengine configuration and iOS deployment. I'll order everything so they can follow it sequentially without getting stuck.

For the audio transcription piece, I'm thinking we can simplify the initial setup by using streaming ASR instead of file ASR—they'd lose automatic speaker identification but they're already manually assigning speakers anyway, so that's not a blocker. Feishu integration can wait since the error handling already gracefully skips it.

Now I'll structure this as phases with clear dependencies so it's obvious what I'm building versus what they need to handle manually.
