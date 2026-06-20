/**
 * GET /api/platform/debug
 *
 * Route de debug pour diagnostiquer les erreurs 500 du BFF platform.
 * Affiche : cookie présent ?, session valide ?, headers générés ?, URL backend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { verifyAdminSession } from '@/lib/admin/admin-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const debug: any = {
    timestamp: new Date().toISOString(),
    steps: [],
  };

  // Étape 1 : vérifier le cookie via request.cookies
  try {
    const cookie1 = request.cookies.get('academia_admin_session')?.value;
    debug.steps.push({
      step: 'request.cookies.get',
      success: !!cookie1,
      hasValue: !!cookie1,
      valueLength: cookie1?.length || 0,
    });
  } catch (err: any) {
    debug.steps.push({
      step: 'request.cookies.get',
      success: false,
      error: err.message,
    });
  }

  // Étape 2 : vérifier le cookie via header brut
  try {
    const rawCookie = request.headers.get('cookie') || '';
    const match = rawCookie.match(/academia_admin_session=([^;]+)/);
    const cookie2 = match ? decodeURIComponent(match[1]) : null;
    debug.steps.push({
      step: 'header Cookie brut',
      success: !!cookie2,
      hasValue: !!cookie2,
      rawCookiePresent: !!rawCookie,
      valueLength: cookie2?.length || 0,
    });
  } catch (err: any) {
    debug.steps.push({
      step: 'header Cookie brut',
      success: false,
      error: err.message,
    });
  }

  // Étape 3 : parser le cookie
  let session: any = null;
  try {
    const cookie = request.cookies.get('academia_admin_session')?.value
      || (() => {
        const raw = request.headers.get('cookie') || '';
        const m = raw.match(/academia_admin_session=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : null;
      })();

    if (cookie) {
      const decoded = JSON.parse(cookie);
      debug.steps.push({
        step: 'JSON.parse cookie',
        success: true,
        hasUser: !!decoded.user,
        hasSignature: !!decoded.signature,
        hasExpiresAt: !!decoded.expiresAt,
      });

      // Étape 4 : verifyAdminSession
      try {
        session = verifyAdminSession(decoded);
        debug.steps.push({
          step: 'verifyAdminSession',
          success: !!session,
          email: session?.user?.email || null,
        });
      } catch (err: any) {
        debug.steps.push({
          step: 'verifyAdminSession',
          success: false,
          error: err.message,
        });
      }
    } else {
      debug.steps.push({
        step: 'JSON.parse cookie',
        success: false,
        error: 'no cookie found',
      });
    }
  } catch (err: any) {
    debug.steps.push({
      step: 'JSON.parse cookie',
      success: false,
      error: err.message,
    });
  }

  // Étape 5 : URL backend
  try {
    const backendUrl = nestControllerUrl('platform/dashboard');
    debug.backendUrl = backendUrl;
    debug.steps.push({
      step: 'nestControllerUrl',
      success: true,
      url: backendUrl,
    });
  } catch (err: any) {
    debug.steps.push({
      step: 'nestControllerUrl',
      success: false,
      error: err.message,
    });
  }

  // Étape 6 : test fetch backend direct
  if (session) {
    try {
      const response = await fetch(debug.backendUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-platform-admin-email': session.user.email,
          'x-platform-admin-id': session.user.id,
          'x-platform-admin-role': session.user.role || 'PLATFORM_SUPER_ADMIN',
        },
        cache: 'no-store',
      });
      debug.steps.push({
        step: 'fetch backend direct',
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
      });
    } catch (err: any) {
      debug.steps.push({
        step: 'fetch backend direct',
        success: false,
        error: err.message,
      });
    }
  }

  return NextResponse.json(debug, { status: 200 });
}
