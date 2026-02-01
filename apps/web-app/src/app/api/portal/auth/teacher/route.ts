/**
 * ============================================================================
 * PORTAL AUTH TEACHER API PROXY
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/utils/urls';
import { setServerSession } from '@/lib/auth/session';

const API_BASE_URL = getApiBaseUrl();

interface BackendResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    tenantId?: string;
  };
  token: string;
  sessionId: string;
  portalType: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_BASE_URL}/portal/auth/teacher`, {
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

    // Gérer la session après connexion réussie
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
    const tenant = {
      id: data.user.tenantId || body.tenantId || '',
      name: 'Mon École',
      subdomain: '',
      subscriptionStatus: 'ACTIVE_SUBSCRIBED' as const,
      createdAt: new Date().toISOString(),
      trialEndsAt: null,
      nextPaymentDueAt: null,
    };

    const session = {
      user: data.user,
      tenant,
      token: data.token,
      expiresAt,
    };

    // Stocker la session dans les cookies
    await setServerSession(session);

    return NextResponse.json({
      success: true,
      user: data.user,
      tenant,
      portalType: data.portalType,
    });
  } catch (error: any) {
    console.error('Portal auth teacher API error:', error);
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

