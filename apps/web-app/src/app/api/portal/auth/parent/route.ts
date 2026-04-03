/**
 * ============================================================================
 * PORTAL AUTH PARENT API PROXY
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { setServerSession } from '@/lib/auth/session';
import { loadTenantFromApi } from '@/lib/utils/load-tenant';

const API_BASE_URL = getApiBaseUrlForRoutes();

interface BackendResponse {
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    tenantId?: string;
  };
  guardian?: {
    id: string;
    phone: string;
  };
  token?: string;
  sessionId?: string;
  portalType?: string;
  message?: string;
  phone?: string;
  otp?: string; // En développement seulement
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_BASE_URL}/portal/auth/parent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data: BackendResponse = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Si c'est juste la génération d'OTP (pas encore de token)
    if (data.message && data.message.includes('OTP envoyé') && !data.token) {
      return NextResponse.json({
        success: true,
        message: data.message,
        phone: data.phone,
        otp: data.otp, // En développement seulement
        requiresOtp: true,
      });
    }

    // Si la connexion est complète (avec token)
    if (data.token && data.user) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
      const tenantId = data.user.tenantId || body.tenantId || '';
      
      // Charger le tenant complet depuis l'API backend avec le token reçu
      let tenant = await loadTenantFromApi(tenantId, data.token);
      
      // Fallback si le chargement échoue (utiliser valeurs minimales)
      if (!tenant) {
        tenant = {
          id: tenantId,
          name: 'Mon École',
          slug: '',
          subdomain: '',
          status: 'active',
          subscriptionStatus: 'ACTIVE_SUBSCRIBED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      // Construire l'objet user complet avec les champs requis
      const user = {
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        role: (data.user.role || 'USER') as any,
        tenantId: data.user.tenantId || tenantId,
        permissions: [], // Sera chargé via /context/bootstrap
        createdAt: new Date().toISOString(),
      };

      const session = {
        user,
        tenant,
        token: data.token,
        expiresAt,
      };

      // Stocker la session dans les cookies
      await setServerSession(session);

      return NextResponse.json({
        success: true,
        user,
        tenant,
        portalType: data.portalType,
        accessToken: data.token,
        portalSessionId: data.sessionId,
        expiresAt,
      });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Portal auth parent API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to authenticate',
        message: error.message || 'Erreur lors de la connexion'
      },
      { status: 500 }
    );
  }
}

