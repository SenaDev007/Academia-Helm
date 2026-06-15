import { NextRequest, NextResponse } from 'next/server';
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

  // Limiter l'historique pour éviter des prompts énormes
  return sanitized.slice(-20);
}

function detectOutputLanguage(lastUserMessage: string): 'FR' | 'EN' {
  const msg = (lastUserMessage || '').trim();
  if (!msg) return 'FR';

  const englishHints = [
    ' the ',
    ' and ',
    ' or ',
    ' please',
    ' pricing',
    ' price',
    ' how ',
    ' what ',
    ' can you',
    ' help',
    ' school',
    ' students',
  ];
  const lower = ` ${msg.toLowerCase()} `;
  const score = englishHints.reduce((acc, w) => (lower.includes(w) ? acc + 1 : acc), 0);
  return score >= 2 ? 'EN' : 'FR';
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

function normalizeSaraOutput(raw: string): string {
  let text = String(raw || '').trim();
  if (!text) return text;

  text = text
    .replace(/\b(ChatGPT|OpenAI|Gemini|Google|Microsoft|Bard)\b/gi, 'SARA')
    .replace(/\bAnthropic\b/gi, 'notre IA')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const limited = parts.slice(0, 4).join(' ').trim();
  text = limited || text;

  if (!/[?！?]\s*$/.test(text)) {
    if (!/[.!?]\s*$/.test(text)) text += '.';
    text += ' Souhaitez-vous que je vous propose le plan le plus adapté à votre effectif ?';
  }

  return text.trim();
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
      "I can't help with that topic. I'm SARA, your Academia Helm advisor — modules, pricing, onboarding, security, I cover it all. What's your school size (number of students)? Let me find the perfect plan for you.",
    );
  }

  return normalizeSaraOutput(
    "Je ne peux pas vous aider sur ce sujet. Je suis SARA, votre conseillère Academia Helm — modules, tarification, onboarding, sécurité, je réponds à tout. Quel est l'effectif de votre école ? Laissez-moi vous trouver le plan idéal.",
  );
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY non configurée' },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const messages = sanitizeMessages(body?.messages);

    const systemPrompt = await readSaraSystemPrompt();
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const outputLanguage = detectOutputLanguage(lastUser);
    const policy = buildLandingPolicyPrompt(outputLanguage);

    // Refus server-side si sujet interdit
    if (detectUnsafeTopic(lastUser)) {
      return NextResponse.json({ text: buildRefusalMessage(outputLanguage) });
    }

    // Anthropic Messages API
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ORION_LLM_MODEL || 'claude-3-5-sonnet-latest',
        max_tokens: 500,
        temperature: 0.6,
        messages: anthropicMessages,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Anthropic API error', details: data },
        { status: response.status },
      );
    }

    const text =
      Array.isArray(data?.content) && data.content[0]?.text
        ? String(data.content[0].text)
        : '';

    if (!text.trim()) {
      return NextResponse.json(
        { error: 'Réponse vide du modèle' },
        { status: 502 },
      );
    }

    return NextResponse.json({ text: normalizeSaraOutput(text) });
  } catch (error: any) {
    console.error('SARA chat API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate SARA response',
        message: error?.message || 'Erreur inconnue',
      },
      { status: 500 },
    );
  }
}
