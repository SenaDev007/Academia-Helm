/**
 * Page Forgot Password (route auth — layout cohérent avec login)
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import ForgotPasswordPage from '@/components/auth/ForgotPasswordPage';
import { generateSEOMetadata } from '@/lib/seo';
import { Loader } from 'lucide-react';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Mot de passe oublié',
  description: 'Réinitialisez le mot de passe de votre compte Academia Helm.',
  path: '/forgot-password',
});

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" style={{ color: '#1d4fa5' }} />
      </div>
    }>
      <ForgotPasswordPage />
    </Suspense>
  );
}
