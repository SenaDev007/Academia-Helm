import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

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

    const backendResponse = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: bffHeaders(),
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
