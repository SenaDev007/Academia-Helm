import { NextRequest } from 'next/server';
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
  return sanitized.slice(-20);
}

function normalizeSaraOutput(raw: string): string {
  let text = String(raw || '').trim();
  if (!text) return text;

  // Remplacer les références à d'autres IA (sécurité) — par Sarah (avec le "h")
  text = text
    .replace(/\b(ChatGPT|OpenAI|Gemini|Google|Microsoft|Bard)\b/gi, 'Sarah')
    .replace(/\bAnthropic\b/gi, 'notre équipe');

  // Nettoyer les espaces
  text = text.replace(/\s+/g, ' ').trim();

  // Ponctuation finale si manquante
  if (!/[.!?…]\s*$/.test(text)) {
    text += '.';
  }

  return text;
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
      "I can't help with that topic. I'm here only to answer questions about Academia Helm (modules, pricing, onboarding, security) and help you choose the right plan. What's your school size (number of students)?",
    );
  }

  return normalizeSaraOutput(
    "Je ne peux pas vous aider sur ce sujet. Je suis là uniquement pour Academia Helm (modules, tarification, onboarding, sécurité) et pour vous orienter vers le bon plan. Quel est l'effectif de votre école (nombre d'élèves) ?",
  );
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

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * ⭐ Construit le contexte UI pour le mode inapp (Sarah Guide)
 *
 * Sarah Guide adapte son discours selon l'interface où se trouve l'utilisateur.
 * Chaque UI a ses propres modules, fonctionnalités et vocabulaire.
 */
function buildInAppUIContext(
  uiType: string,
  userRole?: string,
  currentModule?: string,
): string {
  const uiLabels: Record<string, string> = {
    admin: 'Administration école',
    teacher: 'Espace enseignant',
    parent: 'Espace parent',
    promoter: 'Multi-campus',
    platform: 'Platform Admin',
  };

  const uiModules: Record<string, string> = {
    admin: `MODULES ADMIN : Élèves (/app/students), Pédagogie (/app/pedagogy), Examens (/app/exams), Finance (/app/finance), RH (/app/hr), Communication (/app/communication), QHSE (/app/qhse), ORION (/app/orion), ATLAS (/app/atlas), Paramètres (/app/settings)`,
    teacher: `MODULES ENSEIGNANT : Tableau de bord, Notes & Évaluations (/app/teacher/grades), EDT (/app/teacher/timetable), Bibliothèque péda (/app/teacher/library), Communication parents (/app/teacher/communication), Absences (/app/teacher/attendance), Sara Compose (/app/teacher/sara-compose)`,
    parent: `MODULES PARENT : Tableau de bord, Notes & Bulletins (/app/parent/grades), Absences (/app/parent/attendance), Paiements (/app/parent/payments — Wave, MTN, Moov), Messages (/app/parent/messages), Calendrier (/app/parent/calendar)`,
    promoter: `MODULES PROMOTEUR : Dashboard multi-campus (/patronat/dashboard), Écoles (/patronat/schools), Billing (/patronat/billing), Analytics (/patronat/analytics), ORION multi-campus (/patronat/orion)`,
    platform: `MODULES PLATFORM : Dashboard (/platform), Tenants (/platform/tenants), Users (/platform/users), Monitoring (/platform/monitoring), Features (/platform/features), RBAC (/platform/rbac)`,
  };

  const adaptationRules: Record<string, string> = {
    admin: `RÈGLE UI ADMIN : Parle des modules admin complets. Tu peux mentionner ORION et ATLAS. Vocabulaire : "votre école", "vos élèves".`,
    teacher: `RÈGLE UI ENSEIGNANT : Ne mentionne JAMAIS les modules admin (RH, Finance globale, Paramètres). Concentre-toi sur : notes, EDT, bibliothèque, communication parents, absences, Sara Compose. Vocabulaire : "vos classes", "vos élèves", "votre EDT".`,
    parent: `RÈGLE UI PARENT : Ne mentionne JAMAIS les modules admin. Concentre-toi sur : notes de l'enfant, paiements en ligne, absences, messages, calendrier. Mentionne toujours Wave, MTN Money, Moov Money pour les paiements. Vocabulaire : "votre enfant", "vos factures".`,
    promoter: `RÈGLE UI PROMOTEUR : Parle de la vision multi-campus. Concentre-toi sur : établissements, billing, analytics, ROI. Vocabulaire : "vos établissements", "votre groupe scolaire".`,
    platform: `RÈGLE UI PLATFORM : Parle de l'admin technique. Concentre-toi sur : tenants, users, monitoring, feature flags, RBAC. Vocabulaire technique.`,
  };

  const label = uiLabels[uiType] || uiLabels.admin;
  const modules = uiModules[uiType] || uiModules.admin;
  const rule = adaptationRules[uiType] || adaptationRules.admin;

  return `Interface actuelle : ${label}
Rôle utilisateur : ${userRole || 'utilisateur'}
Module courant : ${currentModule || 'dashboard'}

${modules}

${rule}`;
}

/**
 * Détermine le provider IA à utiliser
 * Priorité : NVIDIA_API_KEY > OPENROUTER_API_KEY > ANTHROPIC_API_KEY
 *
 * ⭐ Migration vers NVIDIA GLM-5.2 (integrate.api.nvidia.com/v1)
 */
function getAIProvider(): { provider: 'nvidia' | 'openrouter' | 'anthropic'; apiKey: string; model: string; baseUrl: string } {
  // ⭐ NVIDIA GLM-5.2 (provider principal)
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey) {
    return {
      provider: 'nvidia',
      apiKey: nvidiaKey,
      model: process.env.NVIDIA_MODEL || 'z-ai/glm-5.2',
      baseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    };
  }

  // Legacy OpenRouter / Modal
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    return {
      provider: 'openrouter',
      apiKey: openrouterKey,
      model: process.env.OPENROUTER_MODEL || 'z-ai/glm-5.2',
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    };
  }

  // Fallback Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  return {
    provider: 'anthropic',
    apiKey: anthropicKey || '',
    model: process.env.ORION_LLM_MODEL || 'claude-3-5-sonnet-latest',
    baseUrl: '',
  };
}

export async function POST(request: NextRequest) {
  const { provider, apiKey, model, baseUrl } = getAIProvider();

  if (!apiKey) {
    return new Response(sse({ type: 'error', message: 'Le service IA n\'est pas encore activé. Veuillez réessayer ultérieurement.' }), {
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
  const mode = body?.mode || 'landing'; // 'landing' ou 'inapp'
  const userRole = body?.userRole;
  const currentModule = body?.currentModule;
  const uiType = body?.uiType || 'admin'; // admin, teacher, parent, promoter, platform

  // Charger le prompt de base (commun aux deux modes)
  const basePrompt = await readSaraSystemPrompt();

  // ⭐ Si mode inapp, enrichir le prompt avec le contexte UI
  let systemPrompt = basePrompt;
  if (mode === 'inapp') {
    const uiContext = buildInAppUIContext(uiType, userRole, currentModule);
    systemPrompt = `${basePrompt}

═══════════════════════════════════════════════════════════
MODE IN-APP — GUIDE DE NAVIGATION
═══════════════════════════════════════════════════════════
Tu es actuellement utilisée comme GUIDE DE NAVIGATION dans l'application Academia Helm.
Ta mission : aider l'utilisateur à naviguer, comprendre les modules, accomplir des tâches.

${uiContext}

═══════════════════════════════════════════════════════════
RÈGLES SPÉCIFIQUES AU MODE IN-APP
═══════════════════════════════════════════════════════════
- Tu n'accèdes à AUCUNE donnée de l'école (élèves, paiements, notes, etc.)
- Si l'utilisateur demande des données → redirige vers ORION (Dashboard → ORION)
- Si l'utilisateur demande une action → redirige vers ATLAS (Dashboard → ATLAS)
- Indique toujours le chemin de navigation exact (ex: "Dashboard → Finance → Impayés")
- Adapte ton vocabulaire au rôle de l'utilisateur (${userRole || 'utilisateur'})
- Maximum 6 phrases par réponse — précis et actionnable
- Sois chaleureuse mais professionnelle : "Je vous guide", "Laissez-moi vous montrer"`;
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const outputLanguage = detectOutputLanguage(lastUser);
  const policy = buildPolicyPrompt(outputLanguage);

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

  const encoder = new TextEncoder();
  let accumulated = '';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(sse(obj)));

      try {
        send({ type: 'status', value: 'starting' });

        if (provider === 'nvidia' || provider === 'openrouter') {
          // ─── NVIDIA / OpenRouter Streaming (OpenAI-compatible SSE) ───
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
              max_tokens: 600,
              temperature: 0.7,
              stream: true,
            }),
            signal: AbortSignal.timeout(45000),
          });

          if (!response.ok || !response.body) {
            const details = await response.json().catch(() => null);
            send({ type: 'error', message: 'Erreur lors du traitement. Veuillez réessayer.' });
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

            // OpenAI-compatible SSE: parse line by line
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const jsonStr = trimmed.replace(/^data:\s*/, '');
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const evt = JSON.parse(jsonStr);
                // OpenAI delta format
                const delta = evt?.choices?.[0]?.delta?.content;
                if (typeof delta === 'string') {
                  accumulated += delta;
                  send({ type: 'delta', text: delta });
                }

                // Check for finish
                if (evt?.choices?.[0]?.finish_reason === 'stop') {
                  const finalText = normalizeSaraOutput(accumulated);
                  send({ type: 'final', text: finalText });
                  controller.close();
                  return;
                }
              } catch {
                // Ignore malformed chunks
              }
            }
          }

          // If we didn't get a stop signal, yield what we have
          const finalText = normalizeSaraOutput(accumulated);
          send({ type: 'final', text: finalText });
          controller.close();
        } else {
          // ─── Anthropic Streaming (legacy) ───
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
              max_tokens: 600,
              temperature: 0.7,
              stream: true,
              messages: anthropicMessages,
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (!response.ok || !response.body) {
            const details = await response.json().catch(() => null);
            send({ type: 'error', message: 'Erreur lors du traitement. Veuillez réessayer.' });;
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
                // Anthropic stream format
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
        }
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
