'use client';

import dynamic from 'next/dynamic';

const DistinctionWorkspace = dynamic(
  () => import('@/components/exams/DistinctionWorkspace'),
  { ssr: false },
);

export default function DistinctionPage() {
  return <DistinctionWorkspace />;
}
