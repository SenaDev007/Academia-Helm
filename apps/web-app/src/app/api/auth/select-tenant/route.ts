/**
 * ============================================================================
 * SELECT TENANT API ROUTE
 * ============================================================================
 * 
 * Proxy Next.js pour l'endpoint backend /auth/select-tenant.
 * Accepte le token via Authorization ou cookie (PO après login).
 * Met à jour la session cookie avec le tenant choisi.
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerToken, setServerSession } from '@/lib/auth/session';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || await getServerToken();
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization header or session cookie required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tenant_id } = body;

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      );
    }

    const baseUrl = normalizeApiUrl(getApiBaseUrlForRoutes());
    const url = `${baseUrl.replace(/\/$/, '')}/auth/select-tenant`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenant_id }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Mettre à jour la session cookie avec le tenant choisi (user + tenant + token)
    if (data.user && data.tenant && data.accessToken) {
      await setServerSession({
        user: {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.firstName ?? '',
          lastName: data.user.lastName ?? '',
          role: data.user.role || 'USER',
          tenantId: data.tenant.id,
          permissions: data.user.permissions || [],
          createdAt: data.user.createdAt || new Date().toISOString(),
        },
        tenant: {
          id: data.tenant.id,
          name: data.tenant.name,
          slug: data.tenant.slug || '',
          subdomain: data.tenant.subdomain || '',
          status: 'active',
          subscriptionStatus: 'ACTIVE_SUBSCRIBED',
          createdAt: data.tenant.createdAt || new Date().toISOString(),
          updatedAt: data.tenant.updatedAt || new Date().toISOString(),
          trialEndsAt: undefined,
          nextPaymentDueAt: undefined,
        },
        token: data.accessToken,
        expiresAt,
      });
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      tenant: data.tenant,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      serverSessionId: data.serverSessionId as string | undefined,
      expiresAt,
    });
  } catch (error: any) {
    console.error('Error in select tenant:', error);
    const isConnectionRefused = error?.cause?.code === 'ECONNREFUSED' || error?.code === 'ECONNREFUSED';
    const message = isConnectionRefused
      ? 'API backend injoignable. Vérifiez que le serveur Nest (api-server) est démarré.'
      : error?.message || 'Internal server error';
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: isConnectionRefused ? 503 : 500 }
    );
  }
}
