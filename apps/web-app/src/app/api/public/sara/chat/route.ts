import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
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

function buildPolicyPrompt(outputLanguage: 'FR' | 'EN'): string {
  const langRule =
    outputLanguage === 'EN'
      ? 'Reply ONLY in English.'
      : 'Réponds UNIQUEMENT en français.';

  return (
    `POLICY (non négociable)\n` +
    `- You are SARA for Academia Helm only. Refuse topics unrelated to Academia Helm.\n` +
    `- Never invent pricing/offers. Use only the official Helm pricing grid.\n` +
    `- Maximum 4 sentences. End with exactly ONE question.\n` +
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

  if (!/[?]\s*$/.test(text)) {
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
      "I can't help with that topic. I'm here only to answer questions about Academia Helm (modules, pricing, onboarding, security) and help you choose the right plan. What's your school size (number of students)?",
    );
  }

  return normalizeSaraOutput(
    "Je ne peux pas vous aider sur ce sujet. Je suis là uniquement pour Academia Helm (modules, tarification, onboarding, sécurité) et pour vous orienter vers le bon plan. Quel est l'effectif de votre école (nombre d'élèves) ?",
  );
}

/**
 * Détermine le provider IA à utiliser
 * Priorité : OPENROUTER_API_KEY > ANTHROPIC_API_KEY
 */
function getAIProvider(): { provider: 'openrouter' | 'anthropic'; apiKey: string; model: string } {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (openrouterKey) {
    return {
      provider: 'openrouter',
      apiKey: openrouterKey,
      model: process.env.OPENROUTER_MODEL || 'z-ai/glm-4.5-air:free',
    };
  }

  return {
    provider: 'anthropic',
    apiKey: anthropicKey || '',
    model: process.env.ORION_LLM_MODEL || 'claude-3-5-sonnet-latest',
  };
}

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, model } = getAIProvider();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY ou ANTHROPIC_API_KEY non configurée' },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const messages = sanitizeMessages(body?.messages);

    const systemPrompt = await readSaraSystemPrompt();
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const outputLanguage = detectOutputLanguage(lastUser);
    const policy = buildPolicyPrompt(outputLanguage);

    // Refus server-side si sujet interdit
    if (detectUnsafeTopic(lastUser)) {
      return NextResponse.json({ text: buildRefusalMessage(outputLanguage) });
    }

    let responseText = '';

    if (provider === 'openrouter') {
      // ─── OpenRouter (compatible OpenAI) ───
      const chatMessages: ChatMessage[] = [
        {
          role: 'system',
          content:
            `${systemPrompt}\n\n` +
            `---\n` +
            `${policy}\n` +
            `---\n` +
            `RÈGLE DE SORTIE : Réponds directement au prospect (max 4 phrases), puis termine par UNE question.\n` +
            `---`,
        },
        ...messages,
      ];

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://academiahelm.com',
          'X-Title': 'Academia Helm - SARA',
        },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          max_tokens: 500,
          temperature: 0.6,
        }),
        signal: AbortSignal.timeout(30000),
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(
          { error: 'OpenRouter API error', details: data },
          { status: response.status },
        );
      }

      responseText = data?.choices?.[0]?.message?.content || '';
    } else {
      // ─── Anthropic (legacy fallback) ───
      const anthropicMessages: ChatMessage[] = [
        {
          role: 'user',
          content:
            `${systemPrompt}\n\n` +
            `---\n` +
            `${policy}\n` +
            `---\n` +
            `RÈGLE DE SORTIE : Réponds directement au prospect (max 4 phrases), puis termine par UNE question.\n` +
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
          model,
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

      responseText =
        Array.isArray(data?.content) && data.content[0]?.text
          ? String(data.content[0].text)
          : '';
    }

    if (!responseText.trim()) {
      return NextResponse.json(
        { error: 'Réponse vide du modèle' },
        { status: 502 },
      );
    }

    return NextResponse.json({ text: normalizeSaraOutput(responseText) });
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
