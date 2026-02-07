/**
 * ============================================================================
 * ONBOARDING PLAN API ROUTE
 * ============================================================================
 * 
 * Proxy Next.js pour l'endpoint backend /onboarding/draft/:draftId/plan
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId } = body;

    if (!draftId) {
      return NextResponse.json(
        { error: 'draftId is required' },
        { status: 400 }
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    // getApiBaseUrl() retourne déjà l'URL avec /api à la fin
    const planUrl = `${apiBaseUrl}/onboarding/draft/${draftId}/plan`;

    // Convertir planCode en planId en récupérant le plan depuis l'API publique
    let planId: string | null = null;
    
    if (body.planCode) {
      try {
        // Récupérer tous les plans avec pricing depuis l'API publique
        const plansUrl = `${apiBaseUrl}/public/pricing`;
        const normalizedPlansUrl = normalizeApiUrl(plansUrl);
        const plansResponse = await fetch(normalizedPlansUrl);
        
        if (plansResponse.ok) {
          const plans = await plansResponse.json();
          const billingPeriod = body.billingPeriod || 'monthly';
          
          // Construire le code attendu selon le billingPeriod
          // Le frontend envoie 'MONTHLY_1_SCHOOL', mais les plans sont 'BASIC_MONTHLY', 'BASIC_YEARLY', etc.
          let expectedCode = body.planCode;
          
          // Si le code ne correspond pas au format attendu, le construire
          if (!expectedCode.includes('BASIC') && !expectedCode.includes('GROUP')) {
            // Construire le code selon le nombre d'écoles et la période
            const schoolsCount = body.schoolsCount || 1;
            if (schoolsCount === 1) {
              expectedCode = billingPeriod === 'monthly' ? 'BASIC_MONTHLY' : 'BASIC_YEARLY';
            } else if (schoolsCount === 2) {
              expectedCode = billingPeriod === 'monthly' ? 'GROUP_2_MONTHLY' : 'GROUP_2_YEARLY';
            }
          } else if (billingPeriod === 'yearly' && expectedCode.includes('MONTHLY')) {
            expectedCode = expectedCode.replace('MONTHLY', 'YEARLY');
          }
          
          // Chercher le plan correspondant dans la liste
          // La structure de réponse est un tableau d'objets avec { id, code, name, ... }
          const matchingPlan = Array.isArray(plans) 
            ? plans.find((p: any) => 
                p.code === expectedCode || 
                p.code === body.planCode ||
                (p.code?.includes('BASIC') && billingPeriod === 'monthly') ||
                (p.code?.includes('BASIC') && billingPeriod === 'yearly')
              )
            : null;
          
          if (matchingPlan?.id) {
            planId = matchingPlan.id;
          }
        }
      } catch (error) {
        console.warn('Could not fetch plans to convert planCode to planId:', error);
      }
    }

    // Mapper les champs frontend -> backend
    // Le backend OnboardingService utilise PricingService qui accepte planCode ou planId
    // Le DTO attend planId, mais on peut passer planCode et le backend gérera via PricingService
    const backendBody = {
      planId: planId || body.planCode, // Utiliser planId si trouvé, sinon planCode (backend gérera via PricingService.getPlan())
      periodType: body.billingPeriod === 'monthly' ? 'MONTHLY' : 'YEARLY', // Convertir 'monthly' -> 'MONTHLY'
    };

    // Normaliser l'URL pour utiliser 127.0.0.1 au lieu de localhost
    const finalUrl = normalizeApiUrl(planUrl);
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Onboarding plan API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to select plan',
        message: error.message || 'Erreur lors de la sélection du plan'
      },
      { status: 500 }
    );
  }
}
