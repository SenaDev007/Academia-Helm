import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { verifyTurnstile, getClientIp } from '@/lib/auth/turnstile';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email?.trim()?.toLowerCase();

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Adresse email requise.' },
        { status: 400 },
      );
    }

    // ── Vérification Cloudflare Turnstile ──
    const turnstileResult = await verifyTurnstile(body.turnstileToken, getClientIp(request));
    if (!turnstileResult.success) {
      return NextResponse.json(
        { success: false, message: turnstileResult.error || 'Vérification de sécurité échouée.' },
        { status: 403 },
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const endpoint = apiBaseUrl.endsWith('/api')
      ? `${apiBaseUrl}/auth/forgot-password`
      : `${apiBaseUrl}/api/auth/forgot-password`;

    console.log(`[Forgot Password BFF] Forwarding OTP request for ${email} to ${endpoint}`);

    const backendResponse = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: bffHeaders(),
      body: JSON.stringify({ email }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      console.error(`[Forgot Password BFF] Backend error (${backendResponse.status}):`, errorData);
      return NextResponse.json(
        {
          success: false,
          message: errorData?.message || 'Erreur lors de la demande de réinitialisation',
        },
        { status: backendResponse.status },
      );
    }

    const data = await backendResponse.json();
    console.log(`[Forgot Password BFF] Backend responded: ${data.message}, emailSent=${data.emailSent}${data.emailError ? `, emailError=${data.emailError}` : ''}`);

    // Only pass safe fields to the client — never expose emailSent or emailError
    // to preserve anti-enumeration security (same response whether user exists or not)
    return NextResponse.json({
      success: true,
      message: data.message,
    });
  } catch (error: any) {
    console.error('[Forgot Password BFF] Error:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erreur de connexion au serveur. Veuillez réessayer dans quelques instants.',
      },
      { status: 500 },
    );
  }
}
