/**
 * Page Login - Academia Helm
 */

import type { Metadata } from 'next';
import LoginPage from '@/components/auth/LoginPage';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Connexion - ${BRAND.name}`,
  description: `${BRAND.description}. ${BRAND.slogan}`,
};

export default function Page() {
  return <LoginPage />;
}

