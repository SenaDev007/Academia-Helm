import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const endpoint = apiBaseUrl.endsWith('/api')
      ? `${apiBaseUrl}/auth/reset-password`
      : `${apiBaseUrl}/api/auth/reset-password`;

    // Supporte les deux formats :
    // 1. Nouveau format OTP : { email, code, newPassword }
    // 2. Ancien format JWT : { token, newPassword }
    const payload: Record<string, string> = {
      newPassword: body.newPassword,
    };

    if (body.email && body.code) {
      // Nouveau format OTP
      payload.email = body.email;
      payload.code = body.code;
    } else if (body.token) {
      // Ancien format JWT (rétro-compatibilité)
      payload.token = body.token;
    } else {
      return NextResponse.json(
        { success: false, message: 'Paramètres de réinitialisation manquants.' },
        { status: 400 },
      );
    }

    const backendResponse = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          message: errorData?.message || 'Erreur lors de la réinitialisation du mot de passe',
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
    console.error('[Reset Password API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erreur de connexion au serveur',
      },
      { status: 500 },
    );
  }
}
