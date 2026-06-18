'use client';

/**
 * Client wrapper for I18nProvider — allows it to be used in Server Component layouts.
 * Simply wraps children with I18nProvider.
 */

import { I18nProvider } from '@/contexts/I18nContext';
import { ReactNode } from 'react';

export default function I18nWrapper({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
