/**
 * POST /api/admin-auth/logout
 *
 * Déconnecte l'admin : supprime le cookie `academia_admin_session`.
 */

import { NextResponse } from 'next/server';
import { clearAdminSessionCookie } from '@/lib/admin/admin-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const res = NextResponse.json({ message: 'Déconnexion réussie' });
  res.headers.set('Set-Cookie', clearAdminSessionCookie());
  return res;
}
