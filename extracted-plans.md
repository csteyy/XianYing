---
## 显影字体体系重构：从全衬线到 Claude 风格双字体体系

### 背景分析

#### Claude 的字体策略

Claude/Anthropic 的设计遵循一个清晰的分层：

- **品牌/展示级**：Copernicus（logo）、Tiempos Text（落地页大标题）— 衬线体，赋予"编辑感/文艺感"
- **功能/界面级**：系统无衬线体 — 所有正文、导航、按钮、表单、标签、Badge、元数据
- **网站主体**：`ui-serif, Georgia, Cambria, "Times New Roman", serif` 用于官网长文本（类似报纸排版）

核心原则：**衬线体用于"品牌个性"，无衬线体用于"功能可读性"**。

#### 当前项目问题

1. `index.html` 用 `!important` 强制所有元素为衬线体 — 这是一个"核弹式"覆盖，阻止了任何字体变化
2. `globals.css` 中 `--font-sans` 变量名写的却是衬线体字体栈 — 语义混乱
3. `index.css`（编译后 Tailwind）body 也设了衬线体 — 多重覆盖
4. 没有 `font-serif` 工具类可用 — Tailwind 编译产物中缺少 `--font-serif` 变量
5. 结果：所有文本（正文、按钮、Badge、导航标签、搜索框 placeholder...）全是宋体/Georgia，小字号下可读性不佳

### 字体分层方案

#### 衬线体（Serif） — 保留的元素

仅用于**品牌/展示/editorial** 级别，通过显式 `font-serif` class 标记：

- **HomePage.tsx** line 106: `h1` "显·影" 品牌标题（`text-5xl font-bold`）
- **HomePage.tsx** line 115-117: 副标题 "让不可见的互动，显影为艺术"
- **OnboardingGuide.tsx** line 75: 引导步骤标题（`h2`）

**可选（建议保留衬线）**：各页面的 h2 页面标题（"历史记录"、"作品库"、"设置"、"会后编辑"、"数据分析"、"3D 可视化"、"选择启动模式"），形成 serif h2 + sans-serif body 的编辑式层次。这些在 9 个组件中共约 10 处 `<h2>`。

#### 无衬线体（Sans-serif） — 改为默认

所有功能性文本，不需要逐个组件改动（通过修改全局默认即可）：

- 所有 `h3`、`h4` 章节/卡片标题（"新建记录"、"上传录音文件"、"场景信息"、"发言人管理"...）
- 所有 `p` 正文、描述文本、`text-sm`/`text-xs` 说明
- 所有按钮文字（Button 组件 + 自定义 button）
- 所有底部导航标签（BottomNav `text-xs` labels）
- 所有表单元素（Input、Select、Textarea）
- 所有 Badge、Chip、Filter 控件
- 所有搜索框 placeholder
- 所有元数据（日期、时长、参与者等）

#### 等宽体（Monospace） — 不变

- 录制计时器（RecordingPage Badge `font-mono`）
- 录制时长（PostRecordingEditPage `font-mono text-lg`）
- 图表数值（chart.tsx `font-mono`）

### 具体文件改动

#### 1. index.html — 移除核弹式覆盖

删除 line 8-13 的 `<style>` 块，移除 `!important` 全局衬线体覆盖。这是最关键的一步。

#### 2. globals.css — 重构字体变量和全局规则

- `--font-sans` 改为真正的无衬线字体栈
- 新增 `--font-serif` 变量
- `html, body` 字体改为无衬线
- 表单元素继承规则保留（`font-family: inherit`）

#### 3. index.css — 同步编译产物

- `--font-sans` 改为无衬线栈
- 新增 `--font-serif` 主题变量
- body 字体改为引用 `--font-sans`
- 新增 `.font-serif` 工具类

#### 4. 组件改动 — 为保留衬线的元素添加 `font-serif`

**必须添加**（3 处）：HomePage h1 + 副标题、OnboardingGuide 步骤标题

**建议添加**（约 10 处 h2 页面标题）：PostRecordingEditPage、RecordingPage、GalleryPage、HistoryPage、RecordingModeSelectionPage、Visualization3DPage、SettingsPage、DataAnalysisPage

### 字号字重统一修复（防乱版）

#### Review 结论

当前计划方向正确，但如果直接一次性落地，最容易"搞乱 UI"的点有两个：
- `h4` 全局降到 `text-sm` 影响面太大（卡片标题可能发虚）
- `:where()` 选择器修复和字号降级同时做，难以定位回归来源

采用"分阶段 + 门禁"来控风险。

#### 执行边界（必须遵守）

- 只改字体相关：`font-size`、`font-weight`、`font-family`、`text-*`、`font-*`
- 不改任何布局与空间：`padding`、`margin`、`gap`、`flex`、`position`、`height/width`
- 不改颜色与动效
- 每一阶段完成后先做视觉回归，再进入下一阶段

#### 分阶段实施

**Phase 1：修复基础规则一致性（不改视觉层级）**

- 去掉有歧义的 `:where(:not(:has(...)))` 包裹，改成稳定的基础元素规则（`h1/h2/h3/h4/p/label/button/input`）
- 本阶段先保持当前字号映射不变，仅解决"同级标题时粗时不粗"的不一致

**Phase 2：清理明显层级违规（定点修复）**

- Visualization3DPage：将预览区 `text-2xl` / `text-lg` 改为不高于页面标题的层级
- HistoryPage、GalleryPage：去掉 `h4` 的 `font-semibold`，统一为 medium 体系

**Phase 3：执行全量字号统一**

- `h3`: `text-lg` -> `text-base`
- `h4`: `text-base` -> `text-sm`
- 保留 `h2` 页面标题层级不变
- 数值强调位（如时长/计数）先不降级

**Phase 4：视觉验收与回滚策略**

- 验收页：首页、录制模式页、录制页、会后编辑页、历史页、作品库、数据分析、设置页、可视化页
- 验收标准：任一 section 标题不高于页面标题视觉权重；同级标题字重一致；卡片标题可读性不下降
- 回滚阈值：若 `h4 -> text-sm` 导致可读性下降，优先仅回滚 `h4` 到 `text-base`，保留其他修复

### 字体栈选择说明

**无衬线字体栈**（新默认）：`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif` — iOS 上渲染为苹方 + SF Pro

**衬线字体栈**（展示级）：`'Songti SC', 'STSong', 'Noto Serif SC', 'Source Han Serif SC', 'Georgia', 'Times New Roman', serif` — iOS 上渲染为宋体 + Georgia

---

## F列公式/大模型标注流程 — 交互演示设计

### 三标签页结构

1. **📊 交互演示** — 点击左侧表格任意一行，右侧实时展示：目标行的情绪是什么、AI 拿到了哪 5 行上下文、F 列里填的公式长什么样。让组员直观感受"窗口滑动"的过程。

2. **🔬 公式解析** — 把公式拆成 4 个颜色标注的部分，逐一解释每个字段是什么意思、为什么这样写。

3. **💡 为什么要这样做** — 用对比案例说明"只看一行 vs 给 5 行上下文"的判断差异，以及滑动窗口的规律表格，让组员知道填到一万行时行号怎么推算。

### 公式结构（以情绪判定为例）

```
=AI("Analyze the emotional tone of the sentence in row N. Use B{start}:B{end} as context. Output only one: Positive, Negative, Neutral.", B{start}:B{end})
```

四个组成部分：
- **① =AI("...")** — 调用 Google Sheets 内置 AI 函数
- **② row N** — 告诉 AI 要判断第几行
- **③ B{start}:B{end}** — 上下文窗口（核心设计），传给 AI 的 5 行对话范围
- **④ 输出约束** — "Output only one: Positive, Negative, Neutral" 限定输出格式

### 上下文窗口规则

- 窗口始终以目标行为中心滑动，前后各取 2 行
- 起始行 = max(2, 目标行-2)，结束行 = 起始行+4
- 组员只需照着规律填写行号即可延续到 5000/10000 行

### 简化表达原则

- 把讲解对象当成"傻子"，用更简单的语言
- 标题改成「F 列的公式到底在干嘛？」，开头一句话说清楚
- Tab 名字：「👆 点一点就懂了」「🔍 公式长啥样」「💡 为什么要这样写」
- 交互演示用 ① ② ③ 三步走，每步只说一句话
- 用 React + Babel CDN 让画面更精美直观

### 技术实现

- 修复字符串内 JSX 语法错误：将字符串拆开，用 `{" "}` 等表达式把文本和 `<span>` 元素交替拼接
- 使用纯 HTML/CSS/JS 或 React+Babel CDN 实现，避免 file:// 加载失败
- 通过本地 HTTP 服务器提供页面以确保脚本正确加载

---

## 会后编辑页面优化（Post-editing page optimizations）

所有修改集中在 `PostRecordingEditPage.tsx` 一个文件中。

### 1. 场景信息三字段改为始终横排

**现状**：使用 `grid-cols-1 md:grid-cols-3`，在移动端会变成竖排。

**改动**：将 `grid-cols-1 md:grid-cols-3` 改为 `grid-cols-3`，确保录制时长、启动模式、对话记录始终横向排列。每个字段保持现有的"标签在上、数据在下"的布局不变。

### 2. 场景名称去除 emoji 和说明文字

**现状**：场景名称显示框内有 `<Sparkles>` emoji 图标；下方有说明文字 "AI 已根据对话内容自动生成场景名称，您可以编辑修改"

**改动**：删除 Sparkles 图标，只保留场景名称纯文本；删除底部说明文字段落；清理不再使用的 Sparkles import。

### 3. 发言人改名后同步到对话预览

**现状**：`transcripts` 直接使用 props 传入的值，不是组件状态。对话预览中 `item.speaker` 始终是原始名称，发言人改名后对话预览不会更新。

**改动**：

- 将 `transcripts` 转为组件内 `useState` 管理的 `transcriptItems` 状态
- 在 `handleSaveSpeakerName` 中，当发言人重命名时，同步更新 `transcriptItems` 中对应的 `speaker` 字段（将旧名称替换为新名称）
- 在合并发言人时，同样更新 `transcriptItems` 中被合并发言人的名称
- 同步修改 `handleComplete`，直接使用已更新的 state 而非再次做 name mapping

关键逻辑：
```typescript
// 在重命名分支中
const oldName = currentSpeaker.name;
setSpeakers(prev => prev.map(s => ...));
setTranscriptItems(prev => prev.map(t => 
  t.speaker === oldName ? { ...t, speaker: newName } : t
));

// 在合并分支中
setTranscriptItems(prev => prev.map(t => 
  t.speaker === oldName ? { ...t, speaker: newName } : t
));
```

---

## Google Sheet Mock 数据 + 可视化字段映射 + 自动化打标

### 背景

当前 Google Sheet (`1ZbIEg_E0nseeF2t8V1RAzW9VdJlYlWQIXkchBGdtGI4`) 已配置 13 列，需扩展到 16 列 (A-P)。

### 一、当前 Google Sheet 列布局

**原始数据 (A-J, 由 App 写入):**

- A: 序号 / B: 发言内容 / C: 说话人 / D: 开始时间(s) / E: 结束时间(s)
- F: 发言时长(s) / G: 性别 / H: ASR情绪 / I: 语速(token/s) / J: 音量(dB)

**AI 打标 (K-M, =AI() 公式):**

- K: 对谁说话 / L: 对话情绪 / M: 是否被打断

**扩展 AI 打标 (N-P):**

- N: 互动类型 — 提问/回应/反驳/补充/总结/打断
- O: 话题标签 — AI 从上下文提取当前讨论话题
- P: 对话转折 — 标记是否为气氛转折点 (Yes/No)

### 二、查看当前 Google Sheet

- 启动 `server/wsProxy.ts`，调用 `POST /gsheets/read` 读取已有 sheet tab
- 如果 Sheet 中没有数据（无 tab），则直接进入 mock 数据写入

### 三、创建中文 Mock 数据

- 创建一套中文 mock `TranscriptForSheet[]` 数据（3-4 人、15-20 条发言）
- 模拟真实会议场景（产品需求讨论），覆盖：积极/消极/平静情绪、打断事件、多种对话方向
- 通过 `POST /gsheets/write` 写入 Google Sheet 进行端到端测试
- 同时创建对应的 `AnnotatedRecord[]` mock 数据用于本地可视化测试

### 四、可视化字段映射

#### 当前已映射（5 个）

| Google Sheet 列 | AnnotatedRecord 字段 | 可视化效果 |
| -------------- | ------------------ | ---------- |
| C: 说话人 | `speaker` | 粒子身份 + 颜色 |
| K: 对谁说话 | `targetSpeaker` | 电流方向 (source -> target) |
| L: 对话情绪 | `emotion` | 电流颜色 (绿=积极, 红=消极, 蓝=平静) |
| B: 发言内容 | `text` (长度) | 电流时长 (text.length/4 估算) |
| M: 是否被打断 | `interactionType` | 电流碰撞爆炸效果 |

#### 未映射但已有数据的字段（4 个可增强可视化）

- **F: 发言时长 (`durationSec`)** — 改用实际时长替代文本估算，更准确控制电流长度
- **I: 语速 (`speechRate`)** — 映射为电流粒子密度或动画速度，语速快 = 粒子更密集
- **J: 音量 (`volume`)** — 映射为粒子大小或电流粗细
- **D/E: 开始/结束时间** — 映射为真实时间轴播放

### 五、代码修改

#### 5.1 增强 transformAnnotatedToStorm.ts

- `estimateDuration(r.text)` 改为优先使用 `r.durationSec`，fallback 到文本估算
- `SpeechEvent` 新增 `speechRate`、`volume`
- 在 node 聚合中使用 speechRate/volume 的均值作为节点属性
- 将 `startTimeSec` 用于生成真实 timestamp

#### 5.2 更新 stormTypes.ts

- `SpeechEvent` 新增 `speechRate`、`volume`、`topic`
- `StormNode` 新增 `avgSpeechRate`、`avgVolume`

#### 5.3 扩展 Google Sheet 写入/读取

- `generateAIFormulas()` 新增 N/O/P 列的 =AI() 公式
- 表头扩展为 16 列 (A-P)
- `handleGSheetsRead()` 解析 N/O/P 列到 `AnnotatedRecord`

#### 5.4 更新 client.ts

- `AnnotatedRecord` 新增 `detailedInteraction`、`topic`、`isTurningPoint`

### 六、n8n 自动化打标（备选路径）

若 Google `=AI()` 公式不可用（需 Google Workspace AI 订阅），可通过 n8n 创建 workflow：

- Trigger: Webhook 接收录音数据
- Step 1: 写入 Google Sheet (A-J 列)
- Step 2: 调用外部 LLM (DeepSeek/Doubao) 进行 K-P 列标注
- Step 3: 写回 Google Sheet K-P 列
- Step 4: Webhook 回调通知前端标注完成

### 七、/gsheets/annotate 端点（规则推理备选）

当 `=AI()` 公式未生效时，实现 `/gsheets/annotate` 端点，使用规则推理进行打标：

- 对谁说话：上下文推断（上一位不同说话人）
- 情绪分析：关键词匹配 + ASR 情绪 fallback
- 是否打断：下一条发言含打断关键词
- 互动类型：6 类分类（提问/回应/反驳/补充/总结/打断）
- 话题标签：主题关键词映射
- 转折点检测：情绪变化 + 话题切换关键词

### 八、=AI() 公式行为说明

- `=AI()` 公式需要 Google Workspace 开通 Gemini AI 功能才能计算
- 通过 API 写入后首次读取可能返回公式文本而非计算结果（公式需 30s-3 分钟计算）
- `=AI()` 可能仅在用户于浏览器中打开 Google Sheet 时触发计算
- 若 `FORMATTED_VALUE` 返回公式文本，说明公式尚未执行或该 spreadsheet 未启用 AI

### 执行顺序

先从查看 Sheet + Mock 数据 + 字段确认开始，再进入代码修改和自动化。
