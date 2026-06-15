/**
 * ============================================================================
 * PUBLIC CAREERS PAGE — Hybrid SSR + Client
 * ============================================================================
 *
 * Uses getServerSideProps-like pattern via Server Component for SEO,
 * but renders immediately with a client-side fallback to avoid
 * the "flash of loading skeleton" on first visit.
 *
 * The page shell (header, banner, search) renders instantly server-side.
 * School data loads client-side with a smooth loading transition.
 */

import { CareersContent } from './CareersContent';

export default function PublicCareersPage() {
  return <CareersContent />;
}
