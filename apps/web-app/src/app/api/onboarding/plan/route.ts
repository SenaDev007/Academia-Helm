/**
 * ============================================================================
 * ONBOARDING PLAN API ROUTE
 * ============================================================================
 *
 * Proxy BFF (Backend-For-Frontend) vers le endpoint NestJS
 * /onboarding/draft/:draftId/plan
 *
 * Le frontend envoie { draftId, planCode: 'SEED'|'GROW'|'LEAD'|'NETWORK',
 * billingPeriod: 'monthly'|'yearly' }.
 *
 * Le backend OnboardingService.selectPlan() accepte planId (UUID) OU planCode
 * (SEED/GROW/LEAD/NETWORK) — il détecte automatiquement via la présence de '-'.
 * On envoie donc directement planCode au backend, sans conversion.
 *
 * ⭐ AVANT : ce fichier convertissait planCode SEED → BASIC_MONTHLY (ancien
 * système de plans). Cela provoquait l'affichage de "Plan Mensuel - 1 École"
 * au lieu de "Helm Essentiel" dans l'email de bienvenue.
 * APRÈS : on envoie planCode tel quel (SEED/GROW/LEAD/NETWORK).
 *
 * ⭐ CONTRAT D'ABONNEMENT (Article 4) : la facturation est ANNUELLE uniquement.
 * On force donc `periodType: 'YEARLY'` quel que soit `billingPeriod` envoyé par
 * le frontend (qui peut encore envoyer 'monthly' depuis d'anciennes sessions).
 * Les codes plan restent SEED/GROW/LEAD/NETWORK pour la compatibilité avec
 * l'enum HelmPlan (Prisma) — les noms d'affichage sont Helm Essentiel,
 * Helm Croissance, Helm Performance, Helm Institution.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId, planCode, billingPeriod } = body;

    if (!draftId) {
      return NextResponse.json(
        { error: 'draftId is required' },
        { status: 400 },
      );
    }

    if (!planCode) {
      return NextResponse.json(
        { error: 'planCode is required (SEED, GROW, LEAD, or NETWORK)' },
        { status: 400 },
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const planUrl = `${apiBaseUrl}/onboarding/draft/${draftId}/plan`;

    // ⭐ Envoyer directement planCode au backend.
    // Le backend OnboardingService.selectPlan() détecte que planCode ne contient
    // pas de '-' et le passe à PricingService.calculateTenantPrice({ planCode }).
    // PricingService récupère alors le plan depuis pricing_plans WHERE code = 'SEED'.
    // Pas de conversion BASIC_MONTHLY — les plans SEED/GROW/LEAD/NETWORK sont
    // la source de vérité dans pricing_plans.
    //
    // ⭐ Contrat Article 4 : facturation annuelle uniquement. On force YEARLY
    // quel que soit le billingPeriod envoyé par le frontend.
    const backendBody = {
      planId: planCode, // Le backend gère planCode vs planId via la présence de '-'
      periodType: 'YEARLY',
    };
    void billingPeriod; // Ignoré — contrat en annuel uniquement

    const finalUrl = normalizeApiUrl(planUrl);
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Onboarding Plan] Backend error:', response.status, data);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Onboarding Plan] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to select plan',
        message: error.message || 'Erreur lors de la sélection du plan',
      },
      { status: 500 },
    );
  }
}
