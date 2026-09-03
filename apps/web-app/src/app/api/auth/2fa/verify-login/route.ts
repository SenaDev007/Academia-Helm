/**
 * ============================================================================
 * 2FA VERIFY-LOGIN — BFF Route (⭐ V5, double authentification TOTP)
 * ============================================================================
 *
 * Flux :
 *   1. POST /api/auth/login          → { requires2fa: true, twoFactorTempToken }
 *   2. L'écran de connexion affiche le champ « code à 6 chiffres »
 *   3. POST /api/auth/2fa/verify-login { twoFactorTempToken, code, ... }
 *      → cette route → backend /auth/2fa/verify-login → payload complet
 *      (user + tenant + tokens) → MÊME traitement de session que /login
 *      (cookies + setServerSession) → réponse identique à un login réussi.
 */

import type { Tenant } from '@/types';
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';
import { setServerSession } from '@/lib/auth/session';
import { loadTenantFromApi } from '@/lib/utils/load-tenant';

interface VerifyLoginBody {
  twoFactorTempToken: string;
  code: string;
  tenantSubdomain?: string;
  tenant_id?: string;
  portal_type?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyLoginBody = await request.json();
    if (!body.twoFactorTempToken || !body.code) {
      return NextResponse.json(
        { success: false, message: 'Jeton 2FA et code requis.' },
        { status: 400 },
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const verifyUrl = apiBaseUrl.endsWith('/api')
      ? `${apiBaseUrl}/auth/2fa/verify-login`
      : `${apiBaseUrl}/api/auth/2fa/verify-login`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let backendResponse;
    try {
      backendResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers: bffHeaders(),
        body: JSON.stringify({
          twoFactorTempToken: body.twoFactorTempToken,
          code: body.code,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        {
          success: false,
          message:
            fetchError.name === 'AbortError'
              ? 'Le serveur ne répond pas. Réessayez dans quelques instants.'
              : 'Impossible de joindre le serveur.',
        },
        { status: 502 },
      );
    }

    const backendData = await backendResponse.json().catch(() => null);

    if (!backendResponse.ok || !backendData?.user) {
      return NextResponse.json(
        {
          success: false,
          message:
            backendData?.message ||
            (backendResponse.status === 401
              ? 'Code de vérification invalide.'
              : `Erreur ${backendResponse.status}`),
        },
        { status: backendResponse.status || 401 },
      );
    }

    // ── Même traitement de session que /api/auth/login ──
    const tenantId = backendData.tenant?.id || backendData.user.tenantId || body.tenant_id || '';
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const token = backendData.accessToken;

    let tenant: Tenant | null = backendData.tenant
      ? {
          id: backendData.tenant.id,
          name: backendData.tenant.name,
          slug: backendData.tenant.slug,
          subdomain: backendData.tenant.subdomain || backendData.tenant.slug,
          status: 'active' as const,
          subscriptionStatus: 'ACTIVE_SUBSCRIBED' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : await loadTenantFromApi(tenantId, token);

    if (!tenant) {
      tenant = {
        id: tenantId,
        name: tenantId ? 'Mon École' : '',
        slug: body.tenantSubdomain || '',
        subdomain: body.tenantSubdomain || '',
        status: 'active' as const,
        subscriptionStatus: 'ACTIVE_SUBSCRIBED' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Tenant;
    }

    const resolvedTenantId = tenant.id || tenantId;
    if (!tenant.id && resolvedTenantId) {
      tenant = { ...tenant, id: resolvedTenantId };
    }

    const user: any = {
      id: backendData.user.id,
      email: backendData.user.email,
      firstName: backendData.user.firstName || '',
      lastName: backendData.user.lastName || '',
      role: backendData.user.role || 'USER',
      portal: (body.portal_type || 'SCHOOL') as any,
      function: backendData.user.function || '',
      accreditations: backendData.user.accreditations || [],
      levelScopes: backendData.user.levelScopes || [],
      classScopes: backendData.user.classScopes || [],
      tenantId: tenantId || resolvedTenantId,
      isPlatformOwner: backendData.user.isPlatformOwner || backendData.user.role === 'PLATFORM_OWNER',
      permissions: [],
      createdAt: new Date().toISOString(),
    };

    const session = { user, tenant, token, expiresAt };
    await setServerSession(session);

    return NextResponse.json({
      success: true,
      user,
      tenant,
      accessToken: backendData.accessToken,
      refreshToken: backendData.refreshToken,
      serverSessionId: backendData.serverSessionId,
      expiresAt,
    });
  } catch (error: any) {
    console.error('[2FA verify-login API] Error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Erreur lors de la vérification.' },
      { status: 500 },
    );
  }
}
