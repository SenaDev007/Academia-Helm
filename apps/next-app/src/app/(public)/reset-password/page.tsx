/**
 * Page Reset Password (route publique)
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import ResetPasswordPage from '@/components/auth/ResetPasswordPage';
import { generateSEOMetadata } from '@/lib/seo';
import { Loader } from 'lucide-react';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Réinitialisation du mot de passe',
  description: 'Saisissez votre nouveau mot de passe pour Academia Helm.',
  path: '/reset-password',
});

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <ResetPasswordPage />
    </Suspense>
  );
}
