import { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

async function readSaraSystemPrompt(): Promise<string> {
  const promptPath = path.join(
    process.cwd(),
    'src',
    'data',
    'sara',
    'system_prompt.txt',
  );
  return await readFile(promptPath, 'utf8');
}

function sanitizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  const sanitized: ChatMessage[] = [];
  for (const item of messages) {
    if (!item || typeof item !== 'object') continue;
    const role = (item as any).role;
    const content = (item as any).content;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string') continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    sanitized.push({ role, content: trimmed });
  }
  return sanitized.slice(-20);
}

function normalizeSaraOutput(raw: string): string {
  let text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return text;

  text = text
    .replace(/\b(ChatGPT|OpenAI|Gemini|Google|Microsoft|Bard)\b/gi, 'SARA')
    .replace(/\bAnthropic\b/gi, 'notre IA');

  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const limited = parts.slice(0, 4).join(' ').trim();
  text = limited || text;

  if (!/[?]\s*$/.test(text)) {
    if (!/[.!?]\s*$/.test(text)) text += '.';
    text += ' Souhaitez-vous que je vous propose le plan le plus adapté à votre effectif ?';
  }

  return text.trim();
}

function detectOutputLanguage(lastUserMessage: string): 'FR' | 'EN' {
  const msg = (lastUserMessage || '').trim();
  if (!msg) return 'FR';

  const englishHints = [
    ' the ', ' and ', ' or ', ' please', ' pricing', ' price',
    ' how ', ' what ', ' can you', ' help', ' school', ' students',
  ];
  const lower = ` ${msg.toLowerCase()} `;
  const score = englishHints.reduce((acc, w) => (lower.includes(w) ? acc + 1 : acc), 0);
  return score >= 2 ? 'EN' : 'FR';
}

function detectUnsafeTopic(text: string): boolean {
  const t = (text || '').toLowerCase();
  if (!t) return false;

  const blocked = [
    'politique', 'élection', 'président', 'gouvernement', 'parti',
    'religion', 'islam', 'christianisme', 'église', 'mosquée',
    'haine', 'racisme', 'xénophobie', 'tuer', 'arme', 'bombe',
    'pirater', 'hacker', 'arnaque', 'fraude', 'carte volée', 'drogue',
    'diagnostic', 'symptôme', 'traitement', 'avocat', 'tribunal', 'plainte',
    'porno', 'sexuel',
  ];

  return blocked.some((k) => t.includes(k));
}

function buildRefusalMessage(outputLanguage: 'FR' | 'EN'): string {
  if (outputLanguage === 'EN') {
    return normalizeSaraOutput(
      "I can't help with that topic. I'm SARA, your Academia Helm advisor — modules, pricing, onboarding, security, I cover it all. What's your school size? Let me find the perfect plan for you.",
    );
  }

  return normalizeSaraOutput(
    "Je ne peux pas vous aider sur ce sujet. Je suis SARA, votre conseillère Academia Helm — modules, tarification, onboarding, sécurité, je réponds à tout. Quel est l'effectif de votre école ? Laissez-moi vous trouver le plan idéal.",
  );
}

function buildLandingPolicyPrompt(outputLanguage: 'FR' | 'EN'): string {
  const langRule =
    outputLanguage === 'EN'
      ? 'Reply ONLY in English.'
      : 'Réponds UNIQUEMENT en français.';

  return (
    `POLICY LANDING PAGE — CLOSER MODE (non négociable)\n` +
    `- You are SARA, Closer Senior #1 for Academia Helm. Your goal: CONVERT every prospect into a client.\n` +
    `- Refuse topics unrelated to Academia Helm. Redirect politely.\n` +
    `- Never invent pricing/offers. Use ONLY the official Helm pricing grid from the system prompt.\n` +
    `- Maximum 4 sentences. End with exactly ONE question or clear call-to-action.\n` +
    `- Apply closing techniques: assumptive close, urgency close, alternative close, summary close.\n` +
    `- After answering a question, ALWAYS guide toward conversion (demo, trial, plan selection, advisor contact).\n` +
    `- When a prospect hesitates, use the puppy dog close: invite them to try.\n` +
    `- When they object on price, reframe as daily cost and ROI.\n` +
    `- When they ask about features, summarize value then close.\n` +
    `- NEVER let a conversation end without a clear next step toward conversion.\n` +
    `- ${langRule}\n`
  );
}

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(sse({ type: 'error', message: 'ANTHROPIC_API_KEY non configurée' }), {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  const body = await request.json().catch(() => ({}));
  const messages = sanitizeMessages(body?.messages);
  const systemPrompt = await readSaraSystemPrompt();
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const outputLanguage = detectOutputLanguage(lastUser);
  const policy = buildLandingPolicyPrompt(outputLanguage);

  // Refus server-side si sujet interdit
  if (detectUnsafeTopic(lastUser)) {
    return new Response(sse({ type: 'final', text: buildRefusalMessage(outputLanguage) }), {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  const anthropicMessages: ChatMessage[] = [
    {
      role: 'user',
      content:
        `${systemPrompt}\n\n` +
        `---\n` +
        `${policy}\n` +
        `---\n` +
        `RÈGLE DE SORTIE : Réponds directement au prospect (max 4 phrases), applique une technique de closing, puis termine par UNE question ou un call-to-action clair vers la conversion.\n` +
        `---`,
    },
    ...messages,
  ];

  const encoder = new TextEncoder();
  let accumulated = '';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(sse(obj)));

      try {
        send({ type: 'status', value: 'starting' });

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: process.env.ORION_LLM_MODEL || 'claude-3-5-sonnet-latest',
            max_tokens: 600,
            temperature: 0.6,
            stream: true,
            messages: anthropicMessages,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok || !response.body) {
          const details = await response.json().catch(() => null);
          send({ type: 'error', message: 'Anthropic API error', details });
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const jsonStr = trimmed.replace(/^data:\s*/, '');
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
              const evt = JSON.parse(jsonStr);
              if (
                evt?.type === 'content_block_delta' &&
                evt?.delta?.type === 'text_delta' &&
                typeof evt?.delta?.text === 'string'
              ) {
                const delta = evt.delta.text;
                accumulated += delta;
                send({ type: 'delta', text: delta });
              }

              if (evt?.type === 'message_stop') {
                const finalText = normalizeSaraOutput(accumulated);
                send({ type: 'final', text: finalText });
                controller.close();
                return;
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }

        const finalText = normalizeSaraOutput(accumulated);
        send({ type: 'final', text: finalText });
        controller.close();
      } catch (err: any) {
        send({ type: 'error', message: err?.message || 'Erreur streaming' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
