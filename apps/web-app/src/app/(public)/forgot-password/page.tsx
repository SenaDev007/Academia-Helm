/**
 * Page Forgot Password (route publique)
 */

import type { Metadata } from 'next';
import ForgotPasswordPage from '@/components/auth/ForgotPasswordPage';
import { generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Mot de passe oublié',
  description: 'Réinitialisez le mot de passe de votre compte Academia Helm.',
  path: '/forgot-password',
  noIndex: true,
});

export default function Page() {
  return <ForgotPasswordPage />;
}

