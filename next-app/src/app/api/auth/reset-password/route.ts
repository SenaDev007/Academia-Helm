import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const endpoint = apiBaseUrl.endsWith('/api') 
      ? `${apiBaseUrl}/auth/reset-password`
      : `${apiBaseUrl}/api/auth/reset-password`;
    
    const backendResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: body.token, newPassword: body.newPassword }),
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
