# Google Sheet 接入与可视化字段映射

## Google Sheet 基本信息

- **Spreadsheet ID**: `1ZbIEg_E0nseeF2t8V1RAzW9VdJlYlWQIXkchBGdtGI4`
- **Sheet Tabs**: `Sheet1`（原始数据）、`mock_test_meeting`（Mock 测试）、`新结构测试`（AI 公式测试）

## 列布局（16 列，A-P）

### 原始数据 A-J

| 列 | 字段 | 类型 | 说明 |
|----|------|------|------|
| A | 序号 | 数字 | 发言序号 |
| B | 发言内容 | 文本 | 转录文本 |
| C | 说话人 | 文本 | 发言者名称 |
| D | 开始时间 | 数字 | startTimeSec |
| E | 结束时间 | 数字 | endTimeSec |
| F | 发言时长 | 数字 | durationSec |
| G | 性别 | 文本 | gender |
| H | ASR情绪 | 文本 | ASR 引擎检测的情绪 |
| I | 语速 | 数字 | speechRate (tokens/sec) |
| J | 音量 | 数字 | volume (dB) |

### AI 打标 K-M

| 列 | 字段 | 来源 | 说明 |
|----|------|------|------|
| K | 对谁说话 | =AI() / 规则推理 | targetSpeaker |
| L | 对话情绪 | =AI() / 规则推理 | Positive / Negative / Neutral |
| M | 是否被打断 | =AI() / 规则推理 | Yes / No |

### 扩展 AI 打标 N-P

| 列 | 字段 | 来源 | 说明 |
|----|------|------|------|
| N | 互动类型 | 规则推理 | 提问/回应/反驳/补充/总结/打断 |
| O | 话题标签 | 规则推理 | 方案讨论/性能优化/录音体验等 |
| P | 对话转折 | 规则推理 | 是/否（情绪变化+话题切换检测） |

## 可视化字段映射（10 项）

| 字段 | 可视化效果 | 状态 |
|------|-----------|------|
| `speaker` | 粒子身份 + 节点颜色 | 已实现 |
| `targetSpeaker` | 电流/连线方向 | 已实现 |
| `emotion` | 电流颜色（绿positive/红negative/蓝calm）| 已实现 |
| `interactionType` | 碰撞爆炸（打断） | 已实现 |
| `durationSec` | 电流长度（替代 text.length/4 估算） | 新增 |
| `speechRate` | 电流粒子密度 | 新增 |
| `volume` | 电流粗细/强度 | 新增 |
| `detailedInteraction` | 交互标签 | 新增 |
| `topic` | 节点分组聚类 | 新增 |
| `isTurningPoint` | 闪电涟漪特效 | 新增 |

## 代码修改清单

### stormTypes.ts
- `SpeechEvent` 新增：`speechRate`、`volume`、`topic`、`isTurningPoint`、`detailedInteraction`
- `StormNode` 新增：`avgSpeechRate`、`avgVolume`、`gender`

### transformAnnotatedToStorm.ts
- 使用真实 `durationSec` 替代 `text.length / 4` 估算
- 使用 `startTimeSec` 生成真实时间轴
- 聚合 speechRate/volume 到节点属性
- Mock 数据替换为中文版（产品需求讨论场景）

### wsProxy.ts
- 表头从 A-M 扩展到 A-P（16列）
- AI 公式扩展到 N/O/P 列
- 读取解析新增 `detailedInteraction`、`topic`、`isTurningPoint`
- 新增 `/gsheets/annotate` 规则推理端点

### client.ts
- `AnnotatedRecord` 接口新增 `detailedInteraction`、`topic`、`isTurningPoint`
- 新增 `triggerAnnotation()` 方法

### Visualization3DPage.tsx
- 字段映射说明从 5 项更新为 10 项

## 自动化打标方案

### 方案 A：Google Sheets =AI() 公式
- 用户有 Google Workspace AI Pro 会员
- `=AI()` 公式写入后，**需要在浏览器中打开 Sheet 才会触发计算**
- API 读取时返回公式文本 = 尚未计算；返回实际值 = 已计算
- **已知限制**：通过 API 写入的公式无法自动触发计算，必须用户在浏览器中访问

### 方案 B：/gsheets/annotate 规则推理（当前生效）
- 读取 A-J 列原始数据
- 规则推理填充 K-P 列：
  - **对谁说话**：上下文推断（上一位不同说话人）
  - **情绪分析**：关键词匹配 + ASR 情绪 fallback
  - **是否打断**：下一条发言含打断关键词
  - **互动类型**：6 类分类
  - **话题标签**：主题关键词映射
  - **转折点**：情绪变化 + 话题切换关键词
- 不依赖 Google AI，立即生效

### 方案 C：n8n workflow（待实现）
- n8n MCP 工具仅支持 search/get/execute，无法通过 API 创建 workflow
- 需要手动在 n8n 中创建 workflow
- 监听 Sheet 更新 → 调用 LLM API 标注 → 写回 Sheet

### 方案 D：LLM API 替换规则推理（推荐后续升级）
- 将 `/gsheets/annotate` 中的规则推理替换为 DeepSeek/Doubao API 调用
- 更精准的语义理解和标注

## Mock 数据

已创建 `server/seedMockData.ts`，包含 20 条中文会议对话（产品需求讨论场景）：
- 4 位参与者：阿林、小夏、大鹏、Mia
- 完整覆盖所有字段（时间戳、时长、性别、语速、音量）
- 写入 Google Sheet `mock_test_meeting` tab

## 端到端数据流

```
录音结束
  → PostRecordingEditPage 写入 Google Sheet (A-J 原始 + K-P AI 公式)
  → 用户浏览器打开 Sheet 触发 =AI() 计算
      或 调用 /gsheets/annotate 规则推理填充 K-P
  → 读取完整 AnnotatedRecord (16 字段)
  → transformAnnotatedToStorm 转换
  → 3D 可视化渲染 (粒子/电流/爆炸/涟漪)
```
