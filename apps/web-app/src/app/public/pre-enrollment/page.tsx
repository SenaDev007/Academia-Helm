/**
 * ============================================================================
 * PUBLIC PRE-ENROLLMENT PAGE — Conforme au document academia-helm-portails.md
 * ============================================================================
 *
 * Portail Public : Pré-inscription & acquisition — aucune authentification requise
 *
 * Rôles : Visiteur, Parent Prospect, Candidat Maternelle/Primaire/Secondaire
 * Cette page redirige vers la LoginPage avec le bon contexte.
 *
 * ============================================================================
 */

import { redirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<{ school?: string; tenant?: string; tenant_id?: string }>;
}

export default async function PublicPreEnrollmentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const school = params.school || params.tenant || '';
  const tenantId = params.tenant_id || '';

  // Rediriger vers la page login avec le contexte PUBLIC
  const queryParams = new URLSearchParams({
    portal: 'public',
    ...(school && { tenant: school }),
    ...(tenantId && { tenant_id: tenantId }),
    ...(school && { school_name: school }),
  });

  redirect(`/login?${queryParams.toString()}`);
}
