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
    `- NEVER invent data: no fake testimonials, no fictional school names, no made-up statistics.\n` +
    `- Use ONLY facts from the system prompt. If you don't have specific data, say so honestly.\n` +
    `- Reason step-by-step before answering. Think about what the prospect REALLY needs.\n` +
    `- Be conversational, warm, natural — like a real human advisor, not a script.\n` +
    `- Adapt each response to the specific question asked. Never repeat the same generic answer.\n` +
    `- End with a relevant follow-up question (not always the same one).\n` +
    `- ${langRule}\n`
  );
}

function normalizeSaraOutput(raw: string): string {
  let text = String(raw || '').trim();
  if (!text) return text;

  // Remplacer les références à d'autres IA (sécurité)
  text = text
    .replace(/\b(ChatGPT|OpenAI|Gemini|Google|Microsoft|Bard)\b/gi, 'SARA')
    .replace(/\bAnthropic\b/gi, 'notre IA');

  // Nettoyer les espaces
  text = text.replace(/\s+/g, ' ').trim();

  // Ponctuation finale si manquante
  if (!/[.!?…]\s*$/.test(text)) {
    text += '.';
  }

  return text;
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
function getAIProvider(): { provider: 'openrouter' | 'anthropic'; apiKey: string; model: string; baseUrl: string } {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (openrouterKey) {
    return {
      provider: 'openrouter',
      apiKey: openrouterKey,
      model: process.env.OPENROUTER_MODEL || 'zai-org/GLM-5.1-FP8',
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://api.us-west-2.modal.direct/v1',
    };
  }

  return {
    provider: 'anthropic',
    apiKey: anthropicKey || '',
    model: process.env.ORION_LLM_MODEL || 'claude-3-5-sonnet-latest',
    baseUrl: '',
  };
}

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, model, baseUrl } = getAIProvider();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Le service IA n\'est pas encore activé. Veuillez réessayer ultérieurement.' },
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
            `INSTRUCTIONS DE RÉPONSE :\n` +
            `- Analyse la question du prospect et réfléchis avant de répondre.\n` +
            `- Adapte ta réponse au contexte spécifique de chaque question.\n` +
            `- Sois naturel, chaleureux et persuasif — pas robotique.\n` +
            `- Termine par une question pertinente et différente à chaque fois.\n` +
            `---`,
        },
        ...messages,
      ];

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          max_tokens: 800,
          temperature: 0.85,
        }),
        signal: AbortSignal.timeout(60000),
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Erreur lors du traitement de la requête. Veuillez réessayer.' },
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
            `INSTRUCTIONS DE RÉPONSE :\n` +
            `- Analyse la question du prospect et réfléchis avant de répondre.\n` +
            `- Adapte ta réponse au contexte spécifique de chaque question.\n` +
            `- Sois naturel, chaleureux et persuasif — pas robotique.\n` +
            `- Termine par une question pertinente et différente à chaque fois.\n` +
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
          max_tokens: 800,
          temperature: 0.85,
          messages: anthropicMessages,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Erreur lors du traitement de la requête. Veuillez réessayer.' },
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
