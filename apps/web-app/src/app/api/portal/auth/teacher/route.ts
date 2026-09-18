import type { Tenant } from '@/types';
/**
 * ============================================================================
 * PORTAL AUTH TEACHER API PROXY
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';
import { setServerSession } from '@/lib/auth/session';
import { loadTenantFromApi } from '@/lib/utils/load-tenant';
import { verifyTurnstile, getClientIp } from '@/lib/auth/turnstile';

const API_BASE_URL = getApiBaseUrlForRoutes();

interface BackendResponse {
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
  /// ⭐ P4 (filtre Rôles × Pistes × Niveaux) : périmètre serveur résolu au
  ///    login (niveaux, pistes, locale UI recommandée, classes de l'enseignant)
  scope?: unknown;
  token: string;
  sessionId: string;
  portalType: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Vérification Cloudflare Turnstile ──
    const turnstileResult = await verifyTurnstile(body.turnstileToken, getClientIp(request));
    if (!turnstileResult.success) {
      return NextResponse.json(
        { success: false, message: turnstileResult.error || 'Vérification de sécurité échouée.' },
        { status: 403 },
      );
    }

    // Ne pas transmettre le token Turnstile au backend NestJS
    const { turnstileToken, ...proxyBody } = body;

    const response = await fetch(`${API_BASE_URL}/portal/auth/teacher`, {
      method: 'POST',
      headers: bffHeaders(),
      body: JSON.stringify(proxyBody),
    });

    const data: BackendResponse = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Gérer la session après connexion réussie
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
    // IMPORTANT : backend renvoie user.tenantId (UUID) — l'utiliser en priorité
    // car body.tenantId peut être un slug (non résolu par /tenants/:id)
    const tenantId = data.user.tenantId || body.tenantId || '';

    // Charger le tenant complet depuis l'API backend avec le token reçu
    let tenant = await loadTenantFromApi(tenantId, data.token);

    // Fallback si le chargement échoue (utiliser valeurs minimales)
    if (!tenant) {
      tenant = {
        id: tenantId,
        name: 'Mon École',
        // Conserver le slug envoyé par le client pour cohérence URL
        slug: typeof body.tenantId === 'string' && !body.tenantId.match(/^[0-9a-f]{8}-/) ? body.tenantId : '',
        subdomain: typeof body.tenantId === 'string' && !body.tenantId.match(/^[0-9a-f]{8}-/) ? body.tenantId : '',
        status: 'active',
        subscriptionStatus: 'ACTIVE_SUBSCRIBED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Tenant;
    }

    // Construire l'objet user complet avec les champs requis
    // ⭐ teacherId : le backend renvoie le profil Teacher pédagogique lié au
    //    matricule utilisé — indispensable pour le personnel double-casquette
    //    (rôle DB administratif + poste d'enseignement) : les pages de l'UI
    //    enseignant (classes, pédagogie, saisie...) utilisent user.teacherId
    //    en priorité et ainsi chargent les classes du profil Teacher, sans
    //    dépendre d'une résolution User→Teacher par email côté backend.
    const user = {
      id: data.user.id,
      email: data.user.email,
      firstName: data.user.firstName || '',
      lastName: data.user.lastName || '',
      // ⭐ Photo de profil (users.avatarUrl) — affichée par les avatars des portails
      avatarUrl: (data.user as any).avatarUrl || undefined,
      role: (data.user.role || 'USER') as any,
      portal: 'TEACHER' as any,
      tenantId: data.user.tenantId || tenantId,
      teacherId: data.teacher?.id || undefined,
      teacherMatricule: data.teacher?.matricule || undefined,
      permissions: [], // Sera chargé via /context/bootstrap
      createdAt: new Date().toISOString(),
    };

    const session = {
      user,
      tenant,
      token: data.token,
      expiresAt,
      // ⭐ Portail choisi à la connexion — prévaut sur user.role pour la redirection
      portalType: 'TEACHER' as const,
    };

    // Stocker la session dans les cookies
    await setServerSession(session);

    return NextResponse.json({
      success: true,
      user,
      tenant,
      portalType: data.portalType,
      /// ⭐ P4 (filtre Rôles × Pistes × Niveaux) : relayer le périmètre serveur
      ///    au client — le LoginPage le persiste (persistClientSession →
      ///    user_scope) et la langue UI / piste / sélecteurs verrouillés en
      ///    découlent. AVANT ce relais, le scope du backend était jeté ici et
      ///    un enseignant anglophone voyait l'UI rester en français.
      scope: data.scope ?? null,
      accessToken: data.token,
      portalSessionId: data.sessionId,
      expiresAt,
    });
  } catch (error: any) {
    console.error('Portal auth teacher API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to authenticate',
        message: error.message || 'Erreur lors de la connexion'
      },
      { status: 500 }
    );
  }
}

