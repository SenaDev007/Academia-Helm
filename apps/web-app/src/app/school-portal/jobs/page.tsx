'use client';

/**
 * ============================================================================
 * TENANT JOBS PAGE — Page recrutement spécifique à l'école
 * ============================================================================
 *
 * Affiche UNIQUEMENT les offres d'emploi de l'école tenante (pas toutes les écoles).
 * Accessible sur {slug}.academiahelm.com/jobs
 *
 * Réutilise le composant CareersContent avec forcedSchoolSlug.
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { CareersContent } from '@/app/jobs/CareersContent';
import { extractTenantSlug } from '@/lib/tenant/constants';
import TenantSchoolLoader from '@/components/ui/TenantSchoolLoader';

export default function TenantJobsPage() {
  const [slug, setSlug] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = extractTenantSlug(window.location.hostname);
    setSlug(s);
    setReady(true);
  }, []);

  if (!ready) return <TenantSchoolLoader />;

  return <CareersContent forcedSchoolSlug={slug || undefined} />;
}
