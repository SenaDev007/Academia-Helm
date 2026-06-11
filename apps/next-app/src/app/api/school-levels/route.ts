/**
 * Niveaux scolaires pour le header = niveaux ACTIVÉS dans Paramètres > Structure.
 * Données provenant de la structure pédagogique (education/structure).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

const LEVEL_LABELS: Record<string, string> = {
  MATERNELLE: 'Maternelle',
  PRIMAIRE: 'Primaire',
  SECONDAIRE: 'Secondaire',
};

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/settings/education/structure`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), { headers, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    const levels = (data?.levels ?? []) as { id: string; name: string; isEnabled?: boolean }[];
    const enabledLevels = levels.filter((l) => l.isEnabled !== false);
    const result = enabledLevels.map((l) => ({
      id: l.id,
      code: l.name,
      label: LEVEL_LABELS[l.name] || l.name,
      isActive: true,
    }));
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, no-cache' },
    });
  } catch (error) {
    console.error('Error fetching school levels from structure:', error);
    return NextResponse.json([], {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
