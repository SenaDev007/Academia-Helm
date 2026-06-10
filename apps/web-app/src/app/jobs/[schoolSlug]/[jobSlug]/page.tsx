import { Suspense } from 'react';
import { Metadata } from 'next';
import { generateSEOMetadata } from '@/lib/seo';
import { getApiBaseUrl } from '@/lib/utils/urls';
import { CareersContent } from '../../CareersContent';

interface PageProps {
  params: Promise<{ schoolSlug: string; jobSlug: string }>;
}

/**
 * Generate SEO metadata for social sharing (Open Graph, Twitter cards, etc.)
 * This is critical for social media crawlers that don't execute JavaScript.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { jobSlug } = await params;
    const API_URL = getApiBaseUrl();
    const res = await fetch(`${API_URL}/hr/recruitment/jobs/by-slug/${encodeURIComponent(jobSlug)}`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!res.ok) return {};

    const job = await res.json();
    if (!job) return {};

    const title = `${job.title} — ${job.tenant?.name || 'Offre d\\'emploi'}`;
    const description = job.description
      ? job.description.slice(0, 200) + (job.description.length > 200 ? '...' : '')
      : `Offre d'emploi : ${job.title}${job.loc ? ` à ${job.loc}` : ''}${job.contractType ? ` — ${job.contractType}` : ''}`;

    return generateSEOMetadata({
      title,
      description,
      keywords: [job.title, job.contractType, job.loc, job.dept, 'recrutement', 'emploi', 'offre d\\'emploi'].filter(Boolean),
      path: `/jobs/${job.tenant?.slug || ''}/${job.slug}`,
    });
  } catch {
    // If metadata generation fails, return empty metadata (page still renders)
    return {};
  }
}

export default async function JobDetailPage({ params }: PageProps) {
  const { schoolSlug, jobSlug } = await params;

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">Chargement de l'offre d'emploi...</div>}>
      <CareersContent forcedSchoolSlug={schoolSlug} forcedJobSlug={jobSlug} />
    </Suspense>
  );
}
