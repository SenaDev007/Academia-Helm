'use client';

import { MinDurationScreen } from '@/components/loading/MinDurationScreen';

export default function ModuleLoading() {
  return (
    <MinDurationScreen ready={false} variant="default" />
  );
}
