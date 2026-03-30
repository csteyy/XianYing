/**
 * ASR API integration test.
 * Tests both file recognition and streaming ASR connectivity.
 *
 * Usage: npx tsx server/testASR.ts
 */
import WebSocket from 'ws';
import { gzipSync } from 'zlib';

const API_KEY = process.env.VITE_VOLCENGINE_API_KEY ?? '';
const STREAM_RESOURCE_ID = process.env.VITE_VOLCENGINE_STREAM_RESOURCE_ID ?? 'volc.seedasr.sauc.duration';
const FILE_RESOURCE_ID = process.env.VITE_VOLCENGINE_FILE_RESOURCE_ID ?? 'volc.seedasr.auc';

const SAMPLE_AUDIO_URL =
  'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/console/bigtts/zh_female_cancan_mars_bigtts.mp3';

if (!API_KEY) {
  console.error('❌ VITE_VOLCENGINE_API_KEY not set. Source .env.local first.');
  process.exit(1);
}

console.log('='.repeat(60));
console.log('  火山引擎 ASR API 集成测试');
console.log('='.repeat(60));
console.log(`  API Key: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}`);
console.log(`  流式 Resource ID: ${STREAM_RESOURCE_ID}`);
console.log(`  文件 Resource ID: ${FILE_RESOURCE_ID}`);
console.log('='.repeat(60));
console.log();

// ─── Test 1: File ASR (submit + query) ──────────────────────

async function testFileASR() {
  console.log('📁 [Test 1] 文件识别 ASR (submit + query)');
  console.log(`   音频: ${SAMPLE_AUDIO_URL.slice(0, 60)}...`);

  const requestId = crypto.randomUUID();

  // Submit
  console.log('   → 提交任务...');
  const submitRes = await fetch(
    'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'X-Api-Resource-Id': FILE_RESOURCE_ID,
        'X-Api-Request-Id': requestId,
        'X-Api-Sequence': '-1',
      },
      body: JSON.stringify({
        user: { uid: 'test-xianying' },
        audio: {
          url: SAMPLE_AUDIO_URL,
          format: 'mp3',
          codec: 'raw',
          rate: 16000,
          bits: 16,
          channel: 1,
        },
        request: {
          model_name: 'bigmodel',
          enable_itn: true,
          enable_punc: true,
          enable_speaker_info: true,
          show_utterances: true,
        },
      }),
    },
  );

  const submitStatus = submitRes.headers.get('x-api-status-code');
  const submitMsg = submitRes.headers.get('x-api-message');
  console.log(`   ← Submit status: ${submitStatus} (${submitMsg})`);

  if (submitStatus !== '20000000') {
    console.error('   ❌ 文件识别提交失败');
    return false;
  }

  console.log('   ✅ 任务提交成功，开始轮询...');

  // Poll
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const queryRes = await fetch(
      'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'X-Api-Resource-Id': FILE_RESOURCE_ID,
          'X-Api-Request-Id': requestId,
        },
        body: JSON.stringify({}),
      },
    );

    const statusCode = queryRes.headers.get('x-api-status-code');

    if (statusCode === '20000000') {
      const result = await queryRes.json();
      const text = (result as any)?.result?.text ?? '';
      const utterances = (result as any)?.result?.utterances ?? [];
      console.log(`   ✅ 识别完成！`);
      console.log(`   📝 文本: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`);
      console.log(`   🔢 分句数: ${utterances.length}`);
      if (utterances.length > 0) {
        const hasSpeaker = utterances.some((u: any) => u.speaker !== undefined);
        console.log(`   👥 说话人信息: ${hasSpeaker ? '有' : '无'}`);
      }
      return true;
    }

    if (statusCode === '20000001') {
      process.stdout.write(`   ⏳ 处理中... (${i + 1})\r`);
      continue;
    }

    if (statusCode === '20000002') {
      process.stdout.write(`   ⏳ 排队中... (${i + 1})\r`);
      continue;
    }

    const msg = queryRes.headers.get('x-api-message');
    console.error(`   ❌ 查询失败: ${statusCode} - ${msg}`);
    return false;
  }

  console.error('   ❌ 轮询超时');
  return false;
}

// ─── Test 2: Streaming ASR (WebSocket) ──────────────────────

function testStreamingASR(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('🎙️  [Test 2] 流式语音识别 ASR (WebSocket)');

    const connectId = crypto.randomUUID();
    const url = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async';

    console.log(`   → 连接 ${url.slice(0, 50)}...`);

    const ws = new WebSocket(url, {
      headers: {
        'x-api-key': API_KEY,
        'X-Api-Resource-Id': STREAM_RESOURCE_ID,
        'X-Api-Connect-Id': connectId,
      },
    });

    let gotResponse = false;

    const timeout = setTimeout(() => {
      if (gotResponse) {
        console.log('   ✅ 流式 ASR 测试通过（收到响应后主动关闭连接）');
        ws.close();
        resolve(true);
      } else {
        console.error('   ❌ 连接超时 (10s)，未收到任何响应');
        ws.close();
        resolve(false);
      }
    }, 6000);

    ws.on('open', () => {
      console.log('   ✅ WebSocket 连接成功！');

      const config = {
        audio: { format: 'pcm', rate: 16000, bits: 16, channel: 1, codec: 'raw' },
        request: {
          model_name: 'bigmodel',
          enable_itn: true,
          enable_punc: true,
          show_utterances: true,
          result_type: 'full',
        },
      };

      const jsonBytes = Buffer.from(JSON.stringify(config), 'utf-8');
      const compressed = gzipSync(jsonBytes);

      const frame = Buffer.alloc(4 + 4 + compressed.length);
      frame[0] = 0x11;
      frame[1] = 0x10;
      frame[2] = 0x11;
      frame[3] = 0x00;
      frame.writeUInt32BE(compressed.length, 4);
      compressed.copy(frame, 8);

      ws.send(frame);
      console.log('   → 已发送配置帧');

      const emptyCompressed = gzipSync(Buffer.alloc(0));
      const lastFrame = Buffer.alloc(4 + 4 + emptyCompressed.length);
      lastFrame[0] = 0x11;
      lastFrame[1] = 0x22;
      lastFrame[2] = 0x01;
      lastFrame[3] = 0x00;
      lastFrame.writeUInt32BE(emptyCompressed.length, 4);
      emptyCompressed.copy(lastFrame, 8);

      ws.send(lastFrame);
      console.log('   → 已发送结束帧');
    });

    ws.on('message', (data: Buffer) => {
      const msgType = (data[1] >> 4) & 0x0f;
      if (msgType === 0x09) {
        gotResponse = true;
        console.log('   ✅ 收到服务端响应帧 (FullServerResponse)');
      } else if (msgType === 0x0f) {
        const code = data.readUInt32BE(4);
        const msgLen = data.readUInt32BE(8);
        const msg = data.subarray(12, 12 + msgLen).toString('utf-8');
        console.error(`   ❌ 服务端错误: code=${code}, msg="${msg}"`);
      }
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      console.log(`   🔌 连接关闭: code=${code}, reason="${reason?.toString() ?? ''}"`);
      resolve(gotResponse);
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      console.error(`   ❌ WebSocket 错误: ${err.message}`);
      resolve(false);
    });
  });
}

// ─── Run ─────────────────────────────────────────────────────

async function main() {
  let allPassed = true;

  try {
    const fileOk = await testFileASR();
    if (!fileOk) allPassed = false;
  } catch (err) {
    console.error('   ❌ 文件识别测试异常:', err);
    allPassed = false;
  }

  console.log();

  try {
    const streamOk = await testStreamingASR();
    if (!streamOk) allPassed = false;
  } catch (err) {
    console.error('   ❌ 流式识别测试异常:', err);
    allPassed = false;
  }

  console.log();
  console.log('='.repeat(60));
  if (allPassed) {
    console.log('  ✅ 所有测试通过！两条 ASR 链路均可用。');
  } else {
    console.log('  ⚠️  部分测试未通过，请检查上方输出。');
  }
  console.log('='.repeat(60));
}

main();
