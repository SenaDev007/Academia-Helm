/**
 * Dev Login API Route
 * 
 * Route handler pour la connexion automatique en mode développement
 * Utilise les identifiants PLATFORM_OWNER depuis le backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { setServerSession } from '@/lib/auth/session';

interface BackendLoginResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    tenantId?: string;
  };
  accessToken: string;
  refreshToken: string;
}

export async function POST(request: NextRequest) {
  try {
    // Vérifier que c'est en développement
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Dev login is only available in development mode' 
        },
        { status: 403 }
      );
    }

    // Appeler le backend NestJS
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const devLoginUrl = apiBaseUrl.endsWith('/api') 
      ? `${apiBaseUrl}/auth/dev-login`
      : `${apiBaseUrl}/api/auth/dev-login`;
    
    console.log('[Dev Login API] Calling backend at:', devLoginUrl);
    
    // Créer un AbortController pour gérer le timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes
    
    let backendResponse;
    try {
      backendResponse = await fetch(devLoginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error('[Dev Login API] Fetch error:', fetchError);
      
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
      console.error('[Dev Login API] Backend error:', errorData);
      throw new Error(errorData.message || `Erreur ${backendResponse.status} lors de la connexion`);
    }

    const backendData: BackendLoginResponse = await backendResponse.json();
    
    // Mapper la réponse du backend vers le format attendu par le frontend
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
    const token = backendData.accessToken;
    
    // Créer un tenant par défaut si nécessaire (sera chargé depuis la DB plus tard)
    const tenant = {
      id: backendData.user.tenantId || '',
      name: 'Mon École',
      subdomain: 'default-tenant',
      subscriptionStatus: 'ACTIVE_SUBSCRIBED' as const,
      createdAt: new Date().toISOString(),
      trialEndsAt: null,
      nextPaymentDueAt: null,
    };

    const session = {
      user: backendData.user,
      tenant,
      token,
      expiresAt,
    };
    
    // Stocker la session dans les cookies
    await setServerSession(session);
    
    return NextResponse.json({
      success: true,
      user: backendData.user,
      tenant,
    });
  } catch (error: any) {
    console.error('[Dev Login API] Error:', error);
    
    // Message d'erreur plus détaillé
    let errorMessage = 'Erreur lors de la connexion en mode développement';
    
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
