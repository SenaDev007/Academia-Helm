import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.email || !body.code) {
      return NextResponse.json(
        { success: false, message: 'Email et code sont requis.' },
        { status: 400 },
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const endpoint = apiBaseUrl.endsWith('/api')
      ? `${apiBaseUrl}/auth/verify-reset-otp`
      : `${apiBaseUrl}/api/auth/verify-reset-otp`;

    const backendResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, code: body.code }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          message: errorData?.message || 'Code invalide ou expiré',
        },
        { status: backendResponse.status },
      );
    }

    const data = await backendResponse.json();

    return NextResponse.json({
      success: true,
      message: data.message,
    });
  } catch (error: any) {
    console.error('[Verify Reset OTP API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erreur de connexion au serveur',
      },
      { status: 500 },
    );
  }
}
