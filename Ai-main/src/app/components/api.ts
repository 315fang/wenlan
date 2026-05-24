// ============================================================
// Dify / Wenlan backend integration helpers
// Endpoints mirror the routes in your Next.js repo (315fang/wenlan):
//   POST /api/chat        — forwards to DIFY_AGENT_BASE_URL
//   POST /api/transcribe  — forwards to MIMO speech-to-text
// In the Figma Make preview these are mocked.  Replace
// `MOCK = true` with `false` when wired to the real backend.
// ============================================================

export type ChatRole = 'user' | 'ai';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  ts: number;
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

const MOCK = true;

const luxuryReplies: Record<string, string> = {
  default:
    '我是问小兰，问兰品牌的专属智能客服。我可以陪您聊聊问兰系列的成分配伍、肌肤适配方案，也可以帮您查找官方素材、解答商务对接的问题。请告诉我您今天想了解什么。',
  '你是谁':
    '我是问小兰，问兰项目的专属智能客服，专门帮客户、代理和取用官方素材的手机端用户解答问题、查找图片、复制文案和查询联系方式。',
  成分:
    '我来给您介绍一下。问兰核心系列以「东方草本 × 法式酵研」为骨架，主轴成分包括：白松露多肽、雪绒花干细胞萃取、5%烟酰胺，以及低敏神经酰胺复合物。所有配方都通过了 24 小时斑贴测试，并支持孕妇使用。',
  价格:
    '我帮您整理一下目前的零售价目区间：\n\n• 入门精萃水乳套组：¥380 – ¥580\n• 焕活精华系列：¥680 – ¥980\n• 紧致赋活面霜：¥980 – ¥1,280\n\n如果您需要了解代理价目或区域政策，可以在「商务中心」留下联系方式，我这边会让对接顾问尽快回复您。',
  素材:
    '我已经为您匹配到三组最新的官方素材：\n\n1. 春夏「松露光感」主视觉（4K + 9:16）\n2. 朋友圈三连图文案 · 共 6 套\n3. 体验官口播脚本 · 60s 版本\n\n您点击「素材中心」就可以下载啦。',
};

function pickReply(prompt: string): string {
  const key = Object.keys(luxuryReplies).find((k) => k !== 'default' && prompt.includes(k));
  return luxuryReplies[key ?? 'default'];
}

/**
 * Streamed chat call.  In production this should hit `/api/chat` and
 * iterate over the SSE stream returned by Dify.  Here we simulate the
 * stream so the UI can be developed against realistic timing.
 */
export async function streamChat(
  prompt: string,
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (!MOCK) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: prompt, response_mode: 'streaming' }),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`Chat failed: ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      onDelta(chunk);
    }
    return full;
  }

  const full = pickReply(prompt);
  let acc = '';
  const tokens = full.split('');
  for (const t of tokens) {
    if (signal?.aborted) break;
    await new Promise((r) => setTimeout(r, 18));
    acc += t;
    onDelta(t);
  }
  return acc;
}

/**
 * Send a recorded blob to /api/transcribe (MiMo v2.5 audio understanding).
 */
export async function transcribe(blob: Blob): Promise<string> {
  if (!MOCK) {
    const form = new FormData();
    form.append('audio', blob, 'voice.webm');
    const res = await fetch('/api/transcribe', { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Transcribe failed: ${res.status}`);
    const data = await res.json();
    return data.text ?? '';
  }
  await new Promise((r) => setTimeout(r, 600));
  return '请帮我推荐一款适合换季敏感肌的精华';
}
