/**
 * Sync Down API Route
 * 
 * Synchronisation descendante : Server → Client
 * Renvoie les changements serveur depuis la dernière synchronisation
 * 
 * PRINCIPE : PostgreSQL est la source de vérité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import type { SyncDownRequest, SyncDownResponse } from '@/types';
import { getServerSession } from '@/lib/auth/session';

const API_URL = getApiBaseUrlForRoutes();

/**
 * POST /api/sync/down
 * 
 * Synchronisation descendante : Server → Client
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

    const body: SyncDownRequest = await request.json();

    // 2. Validation basique
    if (!body.clientId || !body.lastSyncTimestamp) {
      return NextResponse.json(
        { error: 'Requête invalide : clientId et lastSyncTimestamp requis' },
        { status: 400 }
      );
    }

    // 3. Déléguer la logique métier au backend
    // Le backend :
    // 1. Récupère tous les changements depuis lastSyncTimestamp
    // 2. Filtre par tenantId (sécurité multi-tenant)
    // 3. Retourne les changements à appliquer côté Client
    const response = await fetch(`${API_URL}/sync/down`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify({
        ...body,
        tenantId, // S'assurer que le tenantId est inclus
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erreur lors de la synchronisation' }));
      return NextResponse.json(
        { error: error.message || 'Erreur lors de la synchronisation descendante' },
        { status: response.status }
      );
    }

    const result: SyncDownResponse = await response.json();

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Sync down error:', error);
    return NextResponse.json(
      { error: 'Erreur interne lors de la synchronisation descendante', message: error.message },
      { status: 500 }
    );
  }
}

