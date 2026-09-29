/**
 * ============================================================================
 * PORTAL AUTH SWITCH-OPTIONS API (BFF)
 * ============================================================================
 *
 * GET /api/portal/auth/switch-options
 *
 * Liste les portails vers lesquels l'utilisateur connecté peut basculer
 * (double casquette : profil Teacher actif ↔ poste administratif actif).
 * Le frontend s'en sert pour n'afficher le bouton « Basculer » QUE si la
 * deuxième casquette existe réellement.
 * ============================================================================
 */

import { NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';
import { getServerSession } from '@/lib/auth/session';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user || !session.token) {
      return NextResponse.json(
        { success: false, available: [], current: null, teacher: null },
        { status: 401 },
      );
    }

    const response = await fetch(`${API_BASE_URL}/portal/auth/switch-options`, {
      method: 'GET',
      headers: {
        ...bffHeaders(),
        Authorization: `Bearer ${session.token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // Backend indisponible ou JWT rejeté → aucune option (bouton masqué)
      return NextResponse.json(
        { success: false, available: [], current: null, teacher: null, message: 'Options de bascule indisponibles.' },
        { status: response.status === 401 ? 401 : 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error('Portal auth switch-options API error:', error);
    return NextResponse.json(
      { success: false, available: [], current: null, teacher: null },
      { status: 500 },
    );
  }
}
