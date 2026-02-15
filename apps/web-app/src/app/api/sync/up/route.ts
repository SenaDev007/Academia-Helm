/**
 * Sync Up API Route
 * 
 * Synchronisation montante : Client → Server
 * Reçoit les événements de l'Outbox locale et les applique au serveur
 * 
 * PRINCIPE : PostgreSQL est la source de vérité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import type { SyncUpRequest, SyncUpResponse, OutboxEvent } from '@/types';
import { getServerSession } from '@/lib/auth/session';

const API_URL = getApiBaseUrlForRoutes();

/**
 * POST /api/sync/up
 * 
 * Synchronisation montante : Client → Server
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentification
    const session = await getServerSession(request);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = session.tenantId || session.tenant?.id;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID missing' },
        { status: 400 }
      );
    }

    const body: SyncUpRequest = await request.json();

    // 2. Validation basique
    if (!body.clientId || !body.events || !Array.isArray(body.events)) {
      return NextResponse.json(
        { error: 'Requête invalide : clientId et events requis' },
        { status: 400 }
      );
    }

    if (body.events.length > 1000) {
      return NextResponse.json(
        { error: 'Trop d\'événements : maximum 1000 par requête' },
        { status: 400 }
      );
    }

    // 3. Vérifier que tous les événements appartiennent au tenant
    for (const event of body.events) {
      if (event.tenantId !== tenantId) {
        return NextResponse.json(
          { error: 'Tenant ID mismatch dans les événements' },
          { status: 403 }
        );
      }
    }

    // 4. Déléguer la logique métier au backend
    // Le backend :
    // 1. Valide chaque événement
    // 2. Détecte les conflits (version locale vs version serveur)
    // 3. Applique les changements acceptés
    // 4. Enregistre dans l'audit trail
    const response = await fetch(`${API_URL}/sync/up`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erreur lors de la synchronisation' }));
      return NextResponse.json(
        { error: error.message || 'Erreur lors de la synchronisation montante' },
        { status: response.status }
      );
    }

    const result: SyncUpResponse = await response.json();

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Sync up error:', error);
    return NextResponse.json(
      { error: 'Erreur interne lors de la synchronisation montante', message: error.message },
      { status: 500 }
    );
  }
}

