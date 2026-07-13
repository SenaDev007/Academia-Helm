/**
 * Années scolaires pour le header = données réelles (Paramètres).
 * L'année active (isActive en BDD) est exposée en isCurrent pour que le sélecteur l'affiche par défaut.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/settings/academic-years`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), { headers });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => [])
      : [];
    const years = Array.isArray(data) ? data : [];
    const mapped = years.map((y: { id: string; name: string; startDate?: string; endDate?: string; isActive?: boolean; admissionEnabled?: boolean; admissionOpenDate?: string; admissionCloseDate?: string; [k: string]: unknown }) => ({
      id: y.id,
      name: y.name,
      startDate: y.startDate ?? '',
      endDate: y.endDate ?? '',
      isCurrent: Boolean(y.isActive),
      // ⭐ Paramètres d'admission publique (portail public).
      // Sans ces champs, l'onglet Admissions > Paramétrage ne peut pas recharger
      // les valeurs sauvegardées — elles apparaissent vides après rechargement.
      admissionEnabled: y.admissionEnabled !== false,
      admissionOpenDate: y.admissionOpenDate ?? null,
      admissionCloseDate: y.admissionCloseDate ?? null,
    }));
    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching academic years:', error);
    return NextResponse.json([], { status: 200 });
  }
}
