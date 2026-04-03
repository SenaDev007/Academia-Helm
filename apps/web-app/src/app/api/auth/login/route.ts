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
  };
  accessToken: string;
  refreshToken: string;
  serverSessionId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginCredentials = await request.json();
    
    // Appeler le backend NestJS directement
    const apiBaseUrl = getApiBaseUrlForRoutes();
    // S'assurer qu'on n'a pas de double /api dans l'URL
    const loginUrl = apiBaseUrl.endsWith('/api') 
      ? `${apiBaseUrl}/auth/login`
      : `${apiBaseUrl}/api/auth/login`;
    
    console.log('[Login API] Calling backend at:', loginUrl);
    
    // Créer un AbortController pour gérer le timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes
    
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
      
      // Gérer les erreurs de connexion
      if (fetchError.code === 'EACCES' || fetchError.name === 'AggregateError') {
        throw new Error(
          'Impossible de se connecter au serveur backend. ' +
          'Vérifiez que l\'API est démarrée sur le port 3000.'
        );
      }
      
      if (fetchError.name === 'AbortError') {
        throw new Error('Le serveur backend ne répond pas dans les temps impartis.');
      }
      
      throw fetchError;
    }

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({
        message: `Erreur HTTP ${backendResponse.status}: ${backendResponse.statusText}`,
      }));
      console.error('[Login API] Backend error:', errorData);
      throw new Error(errorData.message || `Erreur ${backendResponse.status} lors de la connexion`);
    }

    const backendData: BackendLoginResponse = await backendResponse.json();
    
    // Tenant : priorité backend > body (connexion avec école sélectionnée en mode dev)
    const tenantId = backendData.user.tenantId || body.tenant_id || '';
    
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
    const token = backendData.accessToken;
    
    // Charger le tenant complet depuis l'API backend avec le token reçu
    let tenant = await loadTenantFromApi(tenantId, token);
    
    // Fallback si le chargement échoue ou si pas de tenant (PLATFORM_OWNER)
    if (!tenant) {
      tenant = {
        id: tenantId,
        name: tenantId ? 'Mon École' : '',
        slug: body.tenantSubdomain || '',
        subdomain: body.tenantSubdomain || '',
        status: 'active',
        subscriptionStatus: 'ACTIVE_SUBSCRIBED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // S'assurer que tenant.id est toujours renseigné quand on a un tenant_id (évite "contexte établissement manquant")
    const resolvedTenantId = tenant.id || tenantId;
    if (!tenant.id && resolvedTenantId) {
      tenant = { ...tenant, id: resolvedTenantId };
    }

    const user = {
      id: backendData.user.id,
      email: backendData.user.email,
      firstName: backendData.user.firstName || '',
      lastName: backendData.user.lastName || '',
      role: (backendData.user.role || 'USER') as any,
      tenantId: backendData.user.tenantId || resolvedTenantId,
      permissions: [], // Sera chargé via /context/bootstrap
      createdAt: new Date().toISOString(),
    };

    const session = {
      user,
      tenant,
      token,
      expiresAt,
    };
    
    // Stocker la session dans les cookies
    await setServerSession(session);
    
    return NextResponse.json({
      success: true,
      user,
      tenant,
      /** Pour pedagogyFetch / sync (Bearer) — aligné sur select-tenant */
      accessToken: backendData.accessToken,
      refreshToken: backendData.refreshToken,
      /** Ligne PostgreSQL `sessions` (refresh JWT) */
      serverSessionId: backendData.serverSessionId,
      expiresAt,
    });
  } catch (error: any) {
    console.error('[Login API] Error:', error);
    
    // Message d'erreur plus détaillé
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
        message: errorMessage 
      },
      { status: 401 }
    );
  }
}

