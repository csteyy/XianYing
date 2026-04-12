import { extractKeywords } from '../utils/transformAnnotatedToStorm';
import { updateSessionTitle } from './sessionStore';

interface TranscriptEntry {
  speaker: string;
  text: string;
}

const SYSTEM_PROMPT = `你是"显影"应用的标题生成器。根据提供的多人对话转录片段，生成一个简短的中文场景标题。

规则：
1. 标题长度：4-12个汉字，不超过15字
2. 标题应概括对话的核心主题或场景氛围，而非罗列细节
3. 禁止使用引号、书名号、标点符号
4. 禁止出现"对话""讨论""交流"等泛化词汇，要具体
5. 风格参考：诗意简洁，如"雨后初晴的午后""产品迭代复盘""深夜创业畅想"
6. 只输出标题本身，不要任何解释、前缀或后缀`;

function buildUserPrompt(
  transcripts: TranscriptEntry[],
  speakerCount: number,
  durationMin: number,
): string {
  const maxSamples = 15;
  const step = Math.max(1, Math.floor(transcripts.length / maxSamples));
  const sampled: TranscriptEntry[] = [];
  for (let i = 0; i < transcripts.length && sampled.length < maxSamples; i += step) {
    sampled.push(transcripts[i]);
  }

  const condensed = sampled
    .map((t) => {
      const text = t.text.length > 80 ? t.text.slice(0, 80) + '…' : t.text;
      return `${t.speaker}: ${text}`;
    })
    .join('\n');

  return `以下是一段${speakerCount}人对话的转录摘要（共${transcripts.length}条发言，时长约${durationMin}分钟）：

${condensed}

请生成场景标题。`;
}

function cleanTitle(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^["'"「『【《]+/, '').replace(/["'"」』】》]+$/, '');
  t = t.replace(/[，。、；：！？\-—…·,.;:!?]/g, '');
  t = t.split('\n')[0].trim();
  if (t.length > 15) t = t.slice(0, 15);
  return t;
}

function fallbackTitle(transcripts: TranscriptEntry[]): string {
  const texts = transcripts.map((t) => t.text);
  const kws = extractKeywords(texts, 3);
  if (kws.length > 0) return kws.join('·');
  return '未命名场景';
}

function getLLMConfig() {
  const baseUrl = import.meta.env.VITE_TITLE_LLM_BASE_URL as string | undefined;
  const model = (import.meta.env.VITE_TITLE_LLM_MODEL as string) || 'deepseek-v3-2-251201';
  const apiKey = (import.meta.env.VITE_TITLE_LLM_API_KEY as string) || '';
  return { baseUrl, model, apiKey };
}

export async function generateTitle(
  transcripts: TranscriptEntry[],
  speakerCount: number,
  durationMin: number,
): Promise<string> {
  if (transcripts.length === 0) return '未命名场景';

  const { baseUrl, model, apiKey } = getLLMConfig();

  if (!baseUrl) {
    return fallbackTitle(transcripts);
  }

  const userPrompt = buildUserPrompt(transcripts, speakerCount, durationMin);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 30,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn('[TitleGen] LLM returned', res.status);
      return fallbackTitle(transcripts);
    }

    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    const title = cleanTitle(content);
    return title || fallbackTitle(transcripts);
  } catch (err) {
    console.warn('[TitleGen] LLM call failed, using fallback:', err);
    return fallbackTitle(transcripts);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fire-and-forget background title generation.
 * Writes the result to sessionStore regardless of component lifecycle.
 * Also returns the generated title so callers can update UI if still mounted.
 */
export function generateTitleInBackground(
  transcripts: TranscriptEntry[],
  speakerCount: number,
  durationMin: number,
  sessionId: string,
): Promise<string> {
  const promise = generateTitle(transcripts, speakerCount, durationMin).then(
    (title) => {
      updateSessionTitle(sessionId, title);
      return title;
    },
  );
  promise.catch(() => {});
  return promise;
}
