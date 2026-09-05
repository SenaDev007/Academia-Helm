import type { Tenant } from '@/types';
/**
 * ============================================================================
 * PORTAL AUTH SWITCH API (BFF) — BASCULE DE PORTAIL SANS DÉCONNEXION
 * ============================================================================
 *
 * POST /api/portal/auth/switch  { targetPortal: 'SCHOOL' | 'TEACHER' }
 *
 * Personnel à double casquette (ex : secrétaire + enseignant) : bascule la
 * session courante vers l'autre portail SANS déconnexion ni ressaisie
 * d'identifiants.
 *
 * Fonctionnement :
 *   1. Lit la session courante (cookie academia_session — httpOnly)
 *   2. Appelle le backend NestJS POST /portal/auth/switch-portal avec le
 *      JWT de la session en Bearer (le backend vérifie l'éligibilité :
 *      profil Teacher actif ↔ poste admin actif)
 *   3. Met à jour le cookie de session (portalType, user.portal, teacherId)
 *   4. Renvoie accessToken + portalSessionId → le client met à jour
 *      localStorage (persistClientSession) puis redirige vers /app ou
 *      /app/teacher.
 *
 * ⚠️ AUCUNE déconnexion ici : ni /api/auth/logout, ni clearServerSession —
 *    la bascule remplace la session, l'utilisateur peut rebasculer à
 *    volonté (miroir de ce que ferait le login direct sur l'autre portail).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';
import { getServerSession, setServerSession } from '@/lib/auth/session';

const API_BASE_URL = getApiBaseUrlForRoutes();

interface BackendSwitchResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    tenantId?: string;
  };
  teacher?: {
    id: string;
    matricule: string;
  };
  token: string;
  sessionId: string;
  portalType: 'SCHOOL' | 'TEACHER';
}

export async function POST(request: NextRequest) {
  try {
    // 1. Session courante obligatoire (cookie httpOnly)
    const session = await getServerSession();
    if (!session?.user || !session.token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Session expirée. Reconnectez-vous, puis utilisez le bouton de bascule.',
        },
        { status: 401 },
      );
    }

    // 2. Portail cible depuis le body
    const body = await request.json().catch(() => ({}));
    const targetPortal = String(body?.targetPortal || '').toUpperCase();
    if (targetPortal !== 'SCHOOL' && targetPortal !== 'TEACHER') {
      return NextResponse.json(
        { success: false, message: 'Portail cible invalide (SCHOOL ou TEACHER attendu).' },
        { status: 400 },
      );
    }

    // ⚠️ Filet de sécurité : la cible doit différer du portail courant
    const currentPortal = (
      session.portalType ||
      (session.user as { portal?: string })?.portal ||
      ''
    ).toUpperCase();
    if (currentPortal === targetPortal) {
      return NextResponse.json(
        {
          success: false,
          message:
            targetPortal === 'SCHOOL'
              ? 'Vous êtes déjà sur le portail École.'
              : 'Vous êtes déjà sur le portail Enseignant.',
        },
        { status: 400 },
      );
    }

    // 3. Bascule côté backend (Bearer = JWT de la session courante)
    const response = await fetch(`${API_BASE_URL}/portal/auth/switch-portal`, {
      method: 'POST',
      headers: {
        ...bffHeaders(),
        // ⭐ Le JWT de session porte l'identité ; le backend vérifie
        //    l'éligibilité (double casquette) AVANT d'émettre le nouveau token.
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ targetPortal }),
    });

    const data: BackendSwitchResponse = await response.json();

    if (!response.ok) {
      // Propager le message métier du backend (SWITCH_NOT_ALLOWED…)
      return NextResponse.json(
        {
          success: false,
          message:
            (data as { message?: string })?.message ||
            'Bascule impossible : vous ne disposez pas de la double casquette requise.',
        },
        { status: response.status },
      );
    }

    // 4. Construire la nouvelle session (même schéma que les proxies login)
    const tenantId = data.user.tenantId || session.tenant?.id || '';
    const tenant: Tenant = session.tenant?.id
      ? session.tenant
      : ({
          id: tenantId,
          name: 'Mon École',
          slug: '',
          subdomain: '',
          status: 'active',
          subscriptionStatus: 'ACTIVE_SUBSCRIBED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Tenant);

    const user = {
      id: data.user.id,
      email: data.user.email,
      firstName: data.user.firstName || session.user.firstName || '',
      lastName: data.user.lastName || session.user.lastName || '',
      role: (data.user.role || session.user.role || 'USER') as any,
      portal: targetPortal as any,
      tenantId: tenantId,
      // ⭐ teacherId : indispensable à l'UI enseignant (classes, pédagogie…)
      //    pour le double-casquette — cf. api/portal/auth/teacher/route.ts
      teacherId: data.teacher?.id || undefined,
      teacherMatricule: data.teacher?.matricule || undefined,
      permissions: [], // Rechargées via /context/bootstrap après redirection
      createdAt: new Date().toISOString(),
    };

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    // 5. Remplacer le cookie de session (SANS déconnexion)
    await setServerSession({
      user,
      tenant,
      token: data.token,
      expiresAt,
      portalType: targetPortal as any,
    });

    return NextResponse.json({
      success: true,
      user,
      tenant,
      portalType: data.portalType,
      accessToken: data.token,
      portalSessionId: data.sessionId,
      expiresAt,
    });
  } catch (error: any) {
    console.error('Portal auth switch API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to switch portal',
        message: error?.message || 'Erreur lors de la bascule de portail',
      },
      { status: 500 },
    );
  }
}
