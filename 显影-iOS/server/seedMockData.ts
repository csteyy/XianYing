/**
 * Seed 100 mock transcripts to Google Sheet for end-to-end testing.
 *
 * Usage:
 *   npx tsx server/seedMockData.ts               # write only (preserves =AI() formulas)
 *   npx tsx server/seedMockData.ts --annotate     # write + rule-based annotation fallback
 *
 * Requires wsProxy running on localhost:3001.
 */

const PROXY_BASE = 'http://localhost:3001';

interface TranscriptForSheet {
  speaker: string;
  text: string;
  timestamp: string;
  startTimeMs?: number;
  endTimeMs?: number;
  durationSec?: number;
  emotion?: string;
  gender?: string;
  speechRate?: number;
  volume?: number;
}

// 4 speakers, ~9 min meeting, natural distribution
const speakers = [
  { name: '阿林', gender: '男' },
  { name: '小夏', gender: '女' },
  { name: '大鹏', gender: '男' },
  { name: 'Mia', gender: '女' },
];

const emotions: ('Positive' | 'Negative' | 'Neutral')[] = ['Positive', 'Negative', 'Neutral'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number) { return Math.round((min + Math.random() * (max - min)) * 10) / 10; }
function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const lines: { speaker: string; text: string; emotion: 'Positive' | 'Negative' | 'Neutral' }[] = [
  // -- 开场 (1-5)
  { speaker: '阿林', text: '好，大家都到齐了。今天主要讨论三个议题：上周遗留的性能问题、新功能排期、以及用户反馈的处理', emotion: 'Neutral' },
  { speaker: '小夏', text: '阿林，我这边有个紧急的事情想先说一下，关于录音模块的崩溃问题', emotion: 'Negative' },
  { speaker: '阿林', text: '好，那先处理紧急的。小夏你说', emotion: 'Neutral' },
  { speaker: '小夏', text: '昨天线上有三个用户反馈录音到一半 App 就闪退了，我查了一下日志，是内存溢出', emotion: 'Negative' },
  { speaker: '大鹏', text: '是不是音频缓冲区没有及时释放？我之前就提醒过这个风险', emotion: 'Negative' },

  // -- 性能讨论 (6-15)
  { speaker: '小夏', text: '对，就是这个问题。长时间录音超过 30 分钟就会出问题', emotion: 'Negative' },
  { speaker: 'Mia', text: '这个优先级应该很高吧？用户会因为这个直接卸载的', emotion: 'Negative' },
  { speaker: '阿林', text: '嗯，确实。大鹏你能不能今天先看一下这个？', emotion: 'Neutral' },
  { speaker: '大鹏', text: '可以，我大概需要半天时间。核心问题是 AudioBuffer 的生命周期管理', emotion: 'Neutral' },
  { speaker: '小夏', text: '太好了！修完之后我来做回归测试', emotion: 'Positive' },
  { speaker: '大鹏', text: '还有一个相关的问题，3D 可视化页面的 WebGL 上下文偶尔会丢失', emotion: 'Negative' },
  { speaker: 'Mia', text: '这个我也遇到过，切换页面回来就白屏了', emotion: 'Negative' },
  { speaker: '大鹏', text: '根本原因是浏览器在后台回收了 GPU 资源，需要加一个重建逻辑', emotion: 'Neutral' },
  { speaker: '阿林', text: '那这两个问题你一起处理？工期多久？', emotion: 'Neutral' },
  { speaker: '大鹏', text: '内存问题半天，WebGL 重建大概一天，加起来一天半吧', emotion: 'Neutral' },

  // -- 新功能讨论 (16-30)
  { speaker: '阿林', text: '好，记下了。接下来说说新功能排期', emotion: 'Neutral' },
  { speaker: '小夏', text: '我最想做的是引导教程，用户调研显示 60% 的新用户不知道怎么开始录音', emotion: 'Neutral' },
  { speaker: 'Mia', text: '60%？这个数据从哪来的？', emotion: 'Neutral' },
  { speaker: '小夏', text: '上周做的用户访谈，一共访了 20 个人，有 12 个卡在了第一步', emotion: 'Neutral' },
  { speaker: '大鹏', text: '不是吧，按钮不是很明显了吗？那个大红色的录音按钮', emotion: 'Negative' },
  { speaker: '小夏', text: '问题不在按钮，是用户不理解「场景模式」和「手动模式」的区别', emotion: 'Neutral' },
  { speaker: 'Mia', text: '确实，我自己第一次用也搞不清楚。可以加个对比说明卡片', emotion: 'Positive' },
  { speaker: '阿林', text: '方案上有什么想法吗？', emotion: 'Neutral' },
  { speaker: '小夏', text: '我想做一个三步引导：选模式 → 开始录音 → 查看结果。每步配动画', emotion: 'Positive' },
  { speaker: 'Mia', text: '我来画原型！可以参考 Notion 的 onboarding，做得特别优雅', emotion: 'Positive' },
  { speaker: '大鹏', text: '但是引导教程会增加首屏加载时间，需要懒加载', emotion: 'Neutral' },
  { speaker: '小夏', text: '对，只在第一次打开时加载，之后跳过', emotion: 'Neutral' },
  { speaker: '阿林', text: '好，引导教程排进下周。Mia 出原型，小夏写交互，大鹏配合性能优化', emotion: 'Positive' },
  { speaker: 'Mia', text: '没问题，我周三前出初稿', emotion: 'Positive' },
  { speaker: '大鹏', text: '懒加载的话我得改一下 webpack 的 split chunk 配置', emotion: 'Neutral' },

  // -- 用户反馈 (31-45)
  { speaker: '阿林', text: '好，第三个议题：用户反馈。上周收到了 47 条反馈，我分了类', emotion: 'Neutral' },
  { speaker: 'Mia', text: '47 条？比上个月多了不少', emotion: 'Neutral' },
  { speaker: '阿林', text: '对。其中最多的是关于语音识别准确率的投诉，占了 15 条', emotion: 'Negative' },
  { speaker: '小夏', text: '这个确实是痛点。特别是多人同时说话的时候，识别率会骤降', emotion: 'Negative' },
  { speaker: '大鹏', text: '火山引擎那边有没有新的模型可以用？他们上周好像发了个新版本', emotion: 'Neutral' },
  { speaker: '小夏', text: '有，我看到了。新模型对中文方言支持好了很多', emotion: 'Positive' },
  { speaker: 'Mia', text: '方言？我们的用户主要说普通话吧？', emotion: 'Neutral' },
  { speaker: '小夏', text: '不一定。用户调研里有 30% 带口音，广东话和四川话最多', emotion: 'Neutral' },
  { speaker: '大鹏', text: '那我们可以申请一下新模型的测试资格', emotion: 'Positive' },
  { speaker: '阿林', text: '小夏你去对接一下火山那边？', emotion: 'Neutral' },
  { speaker: '小夏', text: '好的，我今天下午就发邮件', emotion: 'Positive' },
  { speaker: 'Mia', text: '除了识别准确率，还有用户说我们的分析图表太简陋了', emotion: 'Negative' },
  { speaker: '阿林', text: '图表简陋？具体是哪方面？', emotion: 'Neutral' },
  { speaker: 'Mia', text: '主要是数据维度太少。用户希望看到每个人的发言时长占比、情绪变化趋势这些', emotion: 'Neutral' },
  { speaker: '大鹏', text: '这些数据我们其实都有，只是还没展示出来', emotion: 'Neutral' },

  // -- 图表增强 (46-60)
  { speaker: '阿林', text: '那这块 Mia 你来主导？你对数据可视化比较有感觉', emotion: 'Neutral' },
  { speaker: 'Mia', text: '可以。我计划加三个维度：发言时长占比环形图、情绪变化折线图、互动频次热力图', emotion: 'Positive' },
  { speaker: '大鹏', text: '热力图的话数据量要求比较大，至少需要 50 条以上的对话才有意义', emotion: 'Neutral' },
  { speaker: '小夏', text: '那前端可以设一个阈值，数据不够就不展示热力图', emotion: 'Neutral' },
  { speaker: 'Mia', text: '对，降级处理。数据少就显示简化版本', emotion: 'Positive' },
  { speaker: '大鹏', text: '图表库用什么？ECharts 还是 D3？', emotion: 'Neutral' },
  { speaker: 'Mia', text: '我倾向用 ECharts，开箱即用，而且对移动端的触摸交互支持好', emotion: 'Positive' },
  { speaker: '大鹏', text: '但是 ECharts 包体积很大，会不会影响加载速度？', emotion: 'Negative' },
  { speaker: 'Mia', text: '可以按需引入，只加载需要的模块', emotion: 'Neutral' },
  { speaker: '阿林', text: '好，技术选型你们俩再商量一下，给我一个结论', emotion: 'Neutral' },

  // -- Google Sheet 集成 (56-70)
  { speaker: '小夏', text: '对了，Google Sheet 打标这块进展怎么样了？', emotion: 'Neutral' },
  { speaker: '大鹏', text: '滑动窗口的 AI 公式已经写好了，每行给前后各两行上下文', emotion: 'Neutral' },
  { speaker: '阿林', text: '什么叫滑动窗口？能简单解释一下吗？', emotion: 'Neutral' },
  { speaker: '大鹏', text: '就是分析第 5 行的时候，把第 3 到第 7 行一起传给 AI，这样它能理解对话场景', emotion: 'Neutral' },
  { speaker: '小夏', text: '窗口大小是 5 行？会不会太小了？', emotion: 'Neutral' },
  { speaker: '大鹏', text: '测试下来 5 行够用了，太大会导致 AI 公式计算变慢', emotion: 'Neutral' },
  { speaker: 'Mia', text: '计算速度大概多快？', emotion: 'Neutral' },
  { speaker: '大鹏', text: '100 行的话大概 30 秒到 1 分钟，需要在浏览器里打开 Sheet 才会触发计算', emotion: 'Neutral' },
  { speaker: '阿林', text: '也就是说不能全自动？还需要人打开一下？', emotion: 'Negative' },
  { speaker: '大鹏', text: '对，这是 Google AI 函数的限制。不过我们做了一个备选方案，超时后会用规则引擎自动填充', emotion: 'Neutral' },

  // -- 讨论升温 (71-85)
  { speaker: '小夏', text: '但是规则引擎的准确率肯定不如 AI 公式吧？', emotion: 'Negative' },
  { speaker: '大鹏', text: '是的，大概 70% 左右。AI 公式能到 90% 以上', emotion: 'Neutral' },
  { speaker: 'Mia', text: '那能不能让用户手动修正？在可视化页面加个编辑功能', emotion: 'Positive' },
  { speaker: '阿林', text: '这个想法好。先自动打标，再让用户校正', emotion: 'Positive' },
  { speaker: '小夏', text: '等等，这样用户负担会不会太重？100 条对话一个个改？', emotion: 'Negative' },
  { speaker: '大鹏', text: '不用全改，只标出低置信度的让用户确认就行', emotion: 'Neutral' },
  { speaker: 'Mia', text: '对！可以用颜色标注置信度。绿色表示 AI 很确定，黄色表示可能有误', emotion: 'Positive' },
  { speaker: '阿林', text: '这个方案不错，既减轻了用户负担又保证了质量', emotion: 'Positive' },
  { speaker: '小夏', text: '那这个功能排在引导教程之后？', emotion: 'Neutral' },
  { speaker: '阿林', text: '对，先解决用户进不来的问题，再优化用完之后的体验', emotion: 'Neutral' },
  { speaker: '大鹏', text: '说到进不来，我想提一个事情。iOS 端的构建流程太复杂了', emotion: 'Negative' },
  { speaker: '小夏', text: '怎么说？不是 Capacitor 一键打包吗？', emotion: 'Neutral' },
  { speaker: '大鹏', text: '理论上是，但每次 Xcode 的签名配置都要重新搞，浪费很多时间', emotion: 'Negative' },
  { speaker: 'Mia', text: '能不能写个自动化脚本？', emotion: 'Neutral' },
  { speaker: '大鹏', text: '可以试试，用 fastlane 来管理证书和签名', emotion: 'Positive' },

  // -- 收尾讨论 (86-100)
  { speaker: '阿林', text: '好，这个放到 backlog 里。接下来说说时间线，我们目前的 milestone 是什么时候？', emotion: 'Neutral' },
  { speaker: 'Mia', text: '下下周五，3 月 27 号，要给导师做一次 demo 演示', emotion: 'Neutral' },
  { speaker: '阿林', text: '那我们倒推一下。还有不到两周时间', emotion: 'Neutral' },
  { speaker: '小夏', text: '时间挺紧的。优先级建议是：内存修复 > 引导教程 > 图表增强', emotion: 'Neutral' },
  { speaker: '大鹏', text: '同意。内存修复今天就能搞定，引导教程三天，图表增强可以先做个简版', emotion: 'Positive' },
  { speaker: 'Mia', text: '简版的话我两天就能出来，只做发言占比和情绪趋势', emotion: 'Positive' },
  { speaker: '阿林', text: '好，那 demo 演示的功能就是：录音 → AI 标注 → 3D 可视化 → 数据分析', emotion: 'Positive' },
  { speaker: '小夏', text: '别忘了 Google Sheet 的联动也要展示，这是我们的亮点', emotion: 'Positive' },
  { speaker: '大鹏', text: '对，滑动窗口 AI 公式是个很有说服力的技术点', emotion: 'Positive' },
  { speaker: 'Mia', text: '我还想建议一下，demo 的时候用真实的会议录音而不是 mock 数据', emotion: 'Neutral' },
  { speaker: '阿林', text: '好主意。那下周我们自己开一次讨论会，全程录音，作为 demo 素材', emotion: 'Positive' },
  { speaker: '小夏', text: '太好了！这样还能顺便测试长时间录音的稳定性', emotion: 'Positive' },
  { speaker: '大鹏', text: '等一下，如果到时候 App 在 demo 的时候崩了怎么办？', emotion: 'Negative' },
  { speaker: '阿林', text: '所以内存修复必须先搞定。大鹏，这是最高优先级', emotion: 'Neutral' },
  { speaker: '大鹏', text: '明白，今天下午就提 PR', emotion: 'Positive' },
  { speaker: 'Mia', text: '那我整理一下 demo 演示的脚本，把每个功能点的展示顺序理清楚', emotion: 'Neutral' },
  { speaker: '小夏', text: '好，到时候我负责操作演示，你在旁边补充说明', emotion: 'Positive' },
  { speaker: '阿林', text: '行，那今天的会就到这里。各位辛苦了，加油干！', emotion: 'Positive' },
  { speaker: '大鹏', text: '散会！', emotion: 'Positive' },
  { speaker: 'Mia', text: '大家加油，下周见！', emotion: 'Positive' },
];

function buildTranscripts(): TranscriptForSheet[] {
  let currentMs = 0;
  return lines.map((line) => {
    const sp = speakers.find((s) => s.name === line.speaker)!;
    const dur = rand(2.0, 8.5);
    const startMs = currentMs;
    const endMs = startMs + Math.round(dur * 1000);
    currentMs = endMs + Math.round(rand(0.3, 1.5) * 1000);

    return {
      speaker: line.speaker,
      text: line.text,
      timestamp: fmt(startMs / 1000),
      startTimeMs: startMs,
      endTimeMs: endMs,
      durationSec: dur,
      emotion: line.emotion,
      gender: sp.gender,
      speechRate: rand(2.5, 5.5),
      volume: rand(45, 80),
    };
  });
}

const MOCK_TRANSCRIPTS = buildTranscripts();

async function seedMockData() {
  const useAnnotate = process.argv.includes('--annotate');
  const tabName = 'mock_ai_test';

  console.log(`[seed] Writing ${MOCK_TRANSCRIPTS.length} mock transcripts to "${tabName}"...`);
  console.log(`[seed] Annotate mode: ${useAnnotate ? 'ON (rule-based fallback)' : 'OFF (preserve =AI() formulas)'}`);

  const res = await fetch(`${PROXY_BASE}/gsheets/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcripts: MOCK_TRANSCRIPTS,
      sessionId: tabName,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[seed] Write failed: ${res.status}`, err);
    process.exit(1);
  }

  const result = await res.json();
  console.log(`[seed] Write success: sheet="${result.sheetName}", rows=${result.rowCount}`);

  if (useAnnotate) {
    console.log(`\n[seed] Triggering rule-based annotation...`);
    const annRes = await fetch(`${PROXY_BASE}/gsheets/annotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetName: tabName, force: true }),
    });
    const annData = await annRes.json();
    console.log(`[seed] Annotate result:`, annData);
  } else {
    console.log(`\n[seed] =AI() formulas preserved. Open the Google Sheet in browser to trigger Gemini computation.`);
    console.log(`[seed] Sheet URL: https://docs.google.com/spreadsheets/d/${process.env.VITE_GOOGLE_SPREADSHEET_ID}`);
  }

  console.log(`\n[seed] Reading back data...`);
  const readRes = await fetch(`${PROXY_BASE}/gsheets/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetName: tabName }),
  });

  const readData = await readRes.json();
  console.log(`[seed] Read status: ${readData.status}, records: ${readData.records.length}`);

  if (readData.records.length > 0) {
    console.log(`\n[seed] First record:`);
    console.log(JSON.stringify(readData.records[0], null, 2));
    console.log(`\n[seed] Last record:`);
    console.log(JSON.stringify(readData.records[readData.records.length - 1], null, 2));
  }
}

seedMockData().catch((err) => {
  console.error('[seed] Fatal:', err);
  process.exit(1);
});
