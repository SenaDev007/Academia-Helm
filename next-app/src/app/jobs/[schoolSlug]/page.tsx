/**
 * ============================================================================
 * TENANT CAREERS PAGE — Server Component with ISR
 * ============================================================================
 *
 * Pre-fetches schools AND jobs data server-side,
 * eliminating the sequential client-side waterfall.
 * Falls back gracefully to client-side loading if the backend is slow.
 *
 * ISR: revalidates every 30 seconds — job data changes more frequently.
 */

import { Suspense } from 'react';
import { CareersContent } from '../CareersContent';
import { getApiBaseUrl } from '@/lib/utils/urls';
import { normalizeApiUrl } from '@/lib/utils/api-urls';

export const revalidate = 30;

interface School {
  id: string;
  tenantId: string;
  name: string;
  schoolName: string;
  tenantName: string;
  slug: string;
  logoUrl?: string;
  city?: string;
  country?: string;
  primaryPhone?: string;
  primaryEmail?: string;
  address?: string;
  activeJobsCount?: number;
}

const FETCH_TIMEOUT_MS = 5000; // 5s max — don't block page render

async function fetchWithTimeout(url: string, revalidateSeconds: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(normalizeApiUrl(url), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: revalidateSeconds },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchSchools(): Promise<School[]> {
  try {
    const API_BASE = getApiBaseUrl();
    const url = API_BASE.endsWith('/api')
      ? `${API_BASE}/public/schools/with-jobs`
      : `${API_BASE}/api/public/schools/with-jobs`;

    const res = await fetchWithTimeout(url, 60);

    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('[Tenant Careers] Schools fetch timed out — falling back to client-side load');
    } else {
      console.error('[Tenant Careers] Schools fetch error:', err);
    }
    return [];
  }
}

async function fetchJobs(tenantId: string): Promise<any[]> {
  try {
    const API_BASE = getApiBaseUrl();
    const url = `${API_BASE}/hr/recruitment/jobs?tenantId=${encodeURIComponent(tenantId)}`;

    const res = await fetchWithTimeout(url, 30);

    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.filter((j: any) => j.status === 'PUBLIÉE') : [];
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('[Tenant Careers] Jobs fetch timed out — falling back to client-side load');
    } else {
      console.error('[Tenant Careers] Jobs fetch error:', err);
    }
    return [];
  }
}

export default async function TenantCareersPage({
  params,
}: {
  params: Promise<{ schoolSlug: string }>;
}) {
  const { schoolSlug } = await params;

  // Fetch schools first to find the matching tenant
  const schools = await fetchSchools();
  const matchedSchool = schools.find(s => s.slug === schoolSlug) ?? null;

  // If no matching school, still render with available schools
  // (CareersContent will show the school list for the user to choose)
  let initialJobs: any[] = [];
  if (matchedSchool) {
    initialJobs = await fetchJobs(matchedSchool.tenantId || matchedSchool.id);
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">
        Chargement du portail carrières...
      </div>
    }>
      <CareersContent
        forcedSchoolSlug={schoolSlug}
        initialSchools={schools}
        initialSchool={matchedSchool}
        initialJobs={initialJobs}
      />
    </Suspense>
  );
}
