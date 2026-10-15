import type { Tenant } from '@/types';
/**
 * ============================================================================
 * HELM ENSEIGNANT — BFF REGISTER (inscription enseignant autonome)
 * ============================================================================
 *
 * Proxy vers NestJS POST /api/teacher-portal/register :
 *   - email + mot de passe + identité + niveaux choisis (maternelle /
 *     primaire / secondaire)
 *   - le backend provisionne tout l'univers (tenant TEACHER, niveaux, année,
 *     classes, matières, affectations) en une transaction atomique
 *   - la réponse est une session connectée (même contrat que le login)
 *   - pose la session Helm (academia_session / academia_token / x-tenant-id)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';
import { setServerSession } from '@/lib/auth/session';
import { loadTenantFromApi } from '@/lib/utils/load-tenant';
import { verifyTurnstile, getClientIp } from '@/lib/auth/turnstile';

const API_BASE_URL = getApiBaseUrlForRoutes();

interface BackendResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    tenantId?: string;
    avatarUrl?: string | null;
  };
  teacher?: {
    id: string;
    matricule: string;
  };
  scope?: unknown;
  token: string;
  sessionId: string;
  portalType: string;
  justRegistered?: boolean;
  levels?: string[];
  /** ⭐ Abonnement (TRIAL à l'inscription → paiement d'activation). */
  subscription?: {
    status: string;
    currentPeriodEnd: string | null;
    daysRemaining: number | null;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Vérification Cloudflare Turnstile (si configurée) ──
    const turnstileResult = await verifyTurnstile(body.turnstileToken, getClientIp(request));
    if (!turnstileResult.success) {
      return NextResponse.json(
        { success: false, message: turnstileResult.error || 'Vérification de sécurité échouée.' },
        { status: 403 },
      );
    }

    const { turnstileToken, ...proxyBody } = body;

    const response = await fetch(`${API_BASE_URL}/teacher-portal/register`, {
      method: 'POST',
      headers: bffHeaders(),
      body: JSON.stringify(proxyBody),
    });

    const data: BackendResponse = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
    const tenantId = data.user.tenantId || '';

    // Charger le tenant personnel créé
    let tenant = await loadTenantFromApi(tenantId, data.token);

    if (!tenant) {
      tenant = {
        id: tenantId,
        name: 'Mon espace enseignant',
        slug: '',
        subdomain: '',
        status: 'active',
        subscriptionStatus: 'TRIAL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as Tenant;
    }

    const user = {
      id: data.user.id,
      email: data.user.email,
      firstName: data.user.firstName || '',
      lastName: data.user.lastName || '',
      avatarUrl: (data.user as any).avatarUrl || undefined,
      role: (data.user.role || 'ENSEIGNANT') as any,
      portal: 'TEACHER' as any,
      tenantId,
      teacherId: data.teacher?.id || undefined,
      teacherMatricule: data.teacher?.matricule || undefined,
      permissions: [],
      createdAt: new Date().toISOString(),
    };

    const session = {
      user,
      tenant,
      token: data.token,
      expiresAt,
      portalType: 'TEACHER' as const,
    };

    await setServerSession(session);

    return NextResponse.json({
      success: true,
      user,
      tenant,
      portalType: data.portalType,
      scope: data.scope ?? null,
      accessToken: data.token,
      portalSessionId: data.sessionId,
      expiresAt,
      justRegistered: data.justRegistered ?? false,
      levels: data.levels ?? [],
      // ⭐ À l'inscription : TRIAL → le wizard redirige vers /prof/checkout
      //    (étape de paiement de l'onboarding — activation du compteur).
      subscription: data.subscription ?? null,
    });
  } catch (error: any) {
    console.error('Teacher-portal register BFF error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to register',
        message: error.message || 'Erreur lors de l’inscription',
      },
      { status: 500 },
    );
  }
}
