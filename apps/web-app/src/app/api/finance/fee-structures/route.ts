import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

// ⭐ FIX (sept. 2026 — bug « le modal de configuration des frais ne se ferme
//    pas après enregistrement ») : la création d'un frais déclenche le recalcul
//    synchrone de TOUS les comptes élèves (93 comptes ≈ 21,8 s en prod avant
//    parallélisation backend). Sans maxDuration, la fonction serverless Vercel
//    était tuée au bout de 10-15 s → le frontend ne recevait JAMAIS la réponse
//    → le modal restait ouvert alors que l'enregistrement était bien créé
//    (visible après rechargement de la page).
//    → maxDuration = 60 s + timeout fetch explicite de 55 s : même une école
//      de plusieurs centaines d'élèves reste dans le budget, et le client
//      reçoit toujours une réponse (succès OU erreur explicite).
export const maxDuration = 60;

const MUTATION_TIMEOUT_MS = 55_000;

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.toString();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/fee-structures${q ? `?${q}` : ''}`), { headers , cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    // ⚠️ fetch PLAIN + AbortSignal (PAS fetchWithTimeout) : son retry auto sur
    // timeout/502-504 rejouerait la requête et créerait le frais EN DOUBLE.
    // Une mutation n'est jamais rejouée automatiquement.
    const response = await fetch(normalizeApiUrl(`${API_URL}/finance/fee-structures`), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e: any) {
    const isTimeout = e?.name === 'AbortError' || e?.name === 'TimeoutError' || /timeout|abort/i.test(e?.message ?? '');
    return NextResponse.json(
      {
        message: isTimeout
          ? "L'enregistrement prend plus de temps que prévu (recalcul des comptes élèves). Réessayez — si le frais apparaît déjà dans la liste, il a bien été créé."
          : 'Internal server error',
        error: isTimeout ? 'UPSTREAM_TIMEOUT' : 'Internal server error',
      },
      { status: 504 },
    );
  }
}
