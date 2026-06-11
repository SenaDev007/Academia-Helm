/**
 * ============================================================================
 * PUBLIC CAREERS PAGE — Server Component with ISR
 * ============================================================================
 *
 * Pre-fetches schools data server-side so the page renders instantly.
 * Falls back gracefully to client-side loading if the backend is slow.
 *
 * ISR: revalidates every 60 seconds — school data changes rarely.
 */

import { Suspense } from 'react';
import { CareersContent } from './CareersContent';
import { getApiBaseUrl } from '@/lib/utils/urls';
import { normalizeApiUrl } from '@/lib/utils/api-urls';

export const revalidate = 60;

const FETCH_TIMEOUT_MS = 5000; // 5s max — don't block page render

async function fetchSchools(): Promise<any[]> {
  try {
    const API_BASE = getApiBaseUrl();
    const url = API_BASE.endsWith('/api')
      ? `${API_BASE}/public/schools/with-jobs`
      : `${API_BASE}/api/public/schools/with-jobs`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(normalizeApiUrl(url), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error('[Jobs Page] Schools fetch failed:', res.status);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('[Jobs Page] Schools fetch timed out after', FETCH_TIMEOUT_MS, 'ms — falling back to client-side load');
    } else {
      console.error('[Jobs Page] Schools fetch error:', err);
    }
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
