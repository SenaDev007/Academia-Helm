/**
 * ============================================================================
 * PUBLIC CAREERS PAGE — Server Component with ISR
 * ============================================================================
 *
 * Pre-fetches schools data server-side so the page renders instantly
 * without the client-side loading waterfall.
 *
 * ISR: revalidates every 60 seconds — school data changes rarely.
 */

import { Suspense } from 'react';
import { CareersContent } from './CareersContent';
import { getApiBaseUrl } from '@/lib/utils/urls';
import { normalizeApiUrl } from '@/lib/utils/api-urls';

export const revalidate = 60;

async function fetchSchools(): Promise<any[]> {
  try {
    const API_BASE = getApiBaseUrl();
    const url = API_BASE.endsWith('/api')
      ? `${API_BASE}/public/schools/with-jobs`
      : `${API_BASE}/api/public/schools/with-jobs`;

    const res = await fetch(normalizeApiUrl(url), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.error('[Jobs Page] Schools fetch failed:', res.status);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[Jobs Page] Schools fetch error:', err);
    return [];
  }
}

export default async function PublicCareersPage() {
  const initialSchools = await fetchSchools();

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">
        Chargement du portail carrières...
      </div>
    }>
      <CareersContent initialSchools={initialSchools} />
    </Suspense>
  );
}
