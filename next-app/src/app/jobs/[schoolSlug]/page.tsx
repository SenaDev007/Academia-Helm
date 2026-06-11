'use client';

import { useParams } from 'next/navigation';
import { CareersContent } from '../CareersContent';

export default function TenantCareersPage() {
  const params = useParams();
  const schoolSlug = typeof params?.schoolSlug === 'string' ? params.schoolSlug : undefined;

  return <CareersContent forcedSchoolSlug={schoolSlug} />;
}
