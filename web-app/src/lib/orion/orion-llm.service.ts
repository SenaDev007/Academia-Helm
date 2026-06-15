/**
 * ORION LLM Service
 * 
 * Service pour appeler le LLM avec fallback local
 * 
 * CONTRAINTES :
 * - Validation stricte des réponses
 * - Fallback local si réponse non conforme
 * - Journalisation de toutes les interactions
 */

import type {
  DirectionKpiSummary,
  OrionAlert,
  KpiFinancialMonthly,
  KpiHrMonthly,
} from '@/types';
import { buildOrionQueryPrompt, buildOrionSummaryPrompt } from './orion-prompt-builder';
import { validateOrionResponse } from './orion-response-validator';

/**
 * Configuration LLM
 */
const LLM_CONFIG = {
  provider: (process.env.ORION_LLM_PROVIDER || 'openai') as 'openai' | 'anthropic' | 'local',
  model: process.env.ORION_LLM_MODEL || 'gpt-4',
  temperature: 0.1, // Très basse pour des réponses factuelles
  maxTokens: 1000,
};

/**
 * Réponse LLM brute
 */
interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * Appelle le LLM externe (OpenAI ou Anthropic)
 */
async function callExternalLLM(prompt: string): Promise<LLMResponse> {
  if (LLM_CONFIG.provider === 'openai') {
    return callOpenAI(prompt);
  } else if (LLM_CONFIG.provider === 'anthropic') {
    return callAnthropic(prompt);
  } else {
    throw new Error('Provider LLM non configuré');
  }
}

/**
 * Appelle OpenAI
 */
async function callOpenAI(prompt: string): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY non configurée');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: LLM_CONFIG.model,
      messages: [
        {
          role: 'system',
          content: 'Tu es ORION, un assistant de direction institutionnel. Tu réponds uniquement avec des faits basés sur les données fournies. Ton ton est professionnel et sobre.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: LLM_CONFIG.temperature,
      max_tokens: LLM_CONFIG.maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage,
  };
}

/**
 * Appelle Anthropic
 */
async function callAnthropic(prompt: string): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY non configurée');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: LLM_CONFIG.model,
      max_tokens: LLM_CONFIG.maxTokens,
      temperature: LLM_CONFIG.temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    content: data.content[0].text,
    usage: data.usage,
  };
}

/**
 * Fallback local : Génère une réponse basique si le LLM échoue
 */
function generateLocalFallback(
  query: string,
  kpiData: DirectionKpiSummary
): { facts: string[]; interpretation: string; vigilance: string | null } {
  // Réponse factuelle basique sans LLM
  const facts = [
    `Période : ${kpiData.periodLabel}`,
    `Total élèves : ${kpiData.totalStudents}`,
    `Recettes totales : ${kpiData.totalRevenue.toLocaleString()} ${kpiData.currency}`,
    `Taux de recouvrement : ${kpiData.recoveryRate}%`,
  ];

  const interpretation = `Données disponibles pour la période ${kpiData.periodLabel} : ${kpiData.totalStudents} élèves, recettes de ${kpiData.totalRevenue.toLocaleString()} ${kpiData.currency}, taux de recouvrement de ${kpiData.recoveryRate}%.`;

  return {
    facts,
    interpretation,
    vigilance: kpiData.recoveryRate < 85 ? 'Taux de recouvrement inférieur à 85%.' : null,
  };
}

/**
 * Génère une réponse ORION pour une question
 */
export async function generateOrionResponse(
  query: string,
  kpiData: DirectionKpiSummary,
  alerts: OrionAlert[],
  financialKpi?: KpiFinancialMonthly | null,
  hrKpi?: KpiHrMonthly | null
): Promise<{ facts: string[]; interpretation: string; vigilance: string | null; confidence: number; dataSufficient: boolean }> {
  try {
    // Construire le prompt
    const prompt = buildOrionQueryPrompt(query, kpiData, alerts, financialKpi, hrKpi);

    // Appeler le LLM
    const llmResponse = await callExternalLLM(prompt);

    // Parser la réponse JSON
    let parsedResponse: { facts: string[]; interpretation: string; vigilance: string | null };
    try {
      // Extraire le JSON de la réponse (peut contenir du markdown)
      const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Pas de JSON trouvé dans la réponse');
      }
    } catch (parseError) {
      console.error('Erreur parsing réponse LLM, utilisation du fallback local');
      return {
        ...generateLocalFallback(query, kpiData),
        confidence: 60,
        dataSufficient: true,
      };
    }

    // Valider la réponse
    const validation = validateOrionResponse(parsedResponse);
    if (!validation.valid) {
      console.warn('Réponse LLM non conforme, utilisation du fallback local:', validation.errors);
      return {
        ...generateLocalFallback(query, kpiData),
        confidence: 60,
        dataSufficient: true,
      };
    }

    return {
      ...parsedResponse,
      confidence: 95,
      dataSufficient: true,
    };
  } catch (error) {
    console.error('Erreur LLM, utilisation du fallback local:', error);
    return {
      ...generateLocalFallback(query, kpiData),
      confidence: 60,
      dataSufficient: true,
    };
  }
}

/**
 * Génère un résumé mensuel ORION
 */
export async function generateOrionSummary(
  kpiData: DirectionKpiSummary,
  previousKpiData: DirectionKpiSummary | null,
  alerts: OrionAlert[],
  financialKpi?: KpiFinancialMonthly | null,
  hrKpi?: KpiHrMonthly | null
): Promise<{
  overview: string;
  trends: Array<{ metric: string; direction: 'UP' | 'DOWN' | 'STABLE'; magnitude: number; description: string }>;
  highlights: string[];
}> {
  try {
    const prompt = buildOrionSummaryPrompt(kpiData, previousKpiData, alerts, financialKpi, hrKpi);
    const llmResponse = await callExternalLLM(prompt);

    // Parser la réponse JSON
    const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Pas de JSON trouvé');
  } catch (error) {
    console.error('Erreur génération résumé, fallback local:', error);
    // Fallback local basique
    return {
      overview: `Résumé de la période ${kpiData.periodLabel} : ${kpiData.totalStudents} élèves, recettes de ${kpiData.totalRevenue.toLocaleString()} ${kpiData.currency}.`,
      trends: [],
      highlights: [
        `${kpiData.totalStudents} élèves`,
        `Recettes : ${kpiData.totalRevenue.toLocaleString()} ${kpiData.currency}`,
        `Taux de recouvrement : ${kpiData.recoveryRate}%`,
      ],
    };
  }
}

