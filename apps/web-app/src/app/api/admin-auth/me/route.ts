/**
 * GET /api/admin-auth/me
 *
 * Renvoie l'utilisateur admin actuellement connecté (depuis le cookie
 * `academia_admin_session`). 401 si non connecté.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/admin-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  // Récupérer le cookie
  const cookie = _request.cookies.get('academia_admin_session')?.value;
  if (!cookie) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  try {
    const decoded = JSON.parse(decodeURIComponent(cookie));
    const session = verifyAdminSession(decoded);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({
      authenticated: true,
      user: session.user,
      expiresAt: session.expiresAt,
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
