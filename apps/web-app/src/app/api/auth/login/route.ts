import type { Tenant } from '@/types';
/**
 * Login API Route
 * 
 * Route handler pour l'authentification
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { setServerSession } from '@/lib/auth/session';
import { loadTenantFromApi } from '@/lib/utils/load-tenant';

interface LoginCredentials {
  email: string;
  password: string;
  tenantSubdomain?: string;
  tenant_id?: string;
  portal_type?: string;
}

interface BackendLoginResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    tenantId?: string;
    role?: string;
    isPlatformOwner?: boolean;
  };
  tenant?: {
    id: string;
    name: string;
    slug: string;
    subdomain?: string;
  };
  accessToken: string;
  refreshToken: string;
  serverSessionId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginCredentials = await request.json();
    
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const loginUrl = apiBaseUrl.endsWith('/api') 
      ? `${apiBaseUrl}/auth/login`
      : `${apiBaseUrl}/api/auth/login`;
    
    console.log('[Login API] Calling backend at:', loginUrl);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
    
    let backendResponse;
    try {
      backendResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: body.email,
          password: body.password,
          tenant_id: body.tenant_id,
          portal_type: body.portal_type,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error('[Login API] Fetch error:', fetchError);
      
      if (fetchError.code === 'EACCES' || fetchError.name === 'AggregateError') {
        throw new Error('Impossible de se connecter au serveur backend. Vérifiez que l\'API est démarrée sur le port 3000.');
      }
      
      if (fetchError.name === 'AbortError') {
        throw new Error('Le serveur backend ne répond pas dans les 8 secondes. Veuillez réessayer dans quelques instants.');
      }
      
      throw fetchError;
    }

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({
        message: `Erreur HTTP ${backendResponse.status}: ${backendResponse.statusText}`,
      }));
      console.error('[Login API] Backend error:', errorData);
      return NextResponse.json(
        {
          success: false,
          message: errorData?.message || `Erreur ${backendResponse.status} lors de la connexion`,
        },
        { status: backendResponse.status },
      );
    }

    const backendData: BackendLoginResponse = await backendResponse.json();
    
    // Le backend peut maintenant retourner un tenant directement (y compris pour PLATFORM_OWNER avec tenant_id)
    const tenantId = backendData.tenant?.id || backendData.user.tenantId || body.tenant_id || '';
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const token = backendData.accessToken;
    
    let tenant = backendData.tenant ? {
      id: backendData.tenant.id,
      name: backendData.tenant.name,
      slug: backendData.tenant.slug,
      subdomain: backendData.tenant.subdomain || backendData.tenant.slug,
      status: 'active' as const,
      subscriptionStatus: 'ACTIVE_SUBSCRIBED' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } : await loadTenantFromApi(tenantId, token);
    
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
      role: (backendData.user.role || 'USER') as any,
      portal: (body.portal_type || 'SCHOOL') as any,
      function: (backendData.user as any).function || '',
      accreditations: (backendData.user as any).accreditations || [],
      levelScopes: (backendData.user as any).levelScopes || [],
      classScopes: (backendData.user as any).classScopes || [],
      tenantId: tenantId || resolvedTenantId,
      isPlatformOwner: backendData.user.isPlatformOwner || backendData.user.role === 'PLATFORM_OWNER',
      permissions: [],
      createdAt: new Date().toISOString(),
    };

    const session = {
      user,
      tenant,
      token,
      expiresAt,
    };
    
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
    console.error('[Login API] Error:', error);
    
    let errorMessage = 'Erreur lors de la connexion';
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      errorMessage = 'Le serveur backend ne répond pas. Vérifiez qu\'il est démarré sur le port 3000.';
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.cause) {
      errorMessage = `Erreur de connexion: ${error.cause.message || 'Impossible de joindre le serveur backend'}`;
    }
    
    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
      },
      { status: 500 },
    );
  }
}
