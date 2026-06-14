/**
 * Page Reset Password (route auth)
 *
 * NOTE: Le flux de reset est maintenant intégré dans ForgotPasswordPage
 * en 3 étapes (email → OTP → nouveau mot de passe).
 * Cette page existe uniquement pour la compatibilité avec les anciens liens
 * de réinitialisation envoyés par email (format JWT token).
 * Elle redirige vers le nouveau flux forgot-password.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { generateSEOMetadata, detectRequestHostname } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const hostname = await detectRequestHostname();
  return generateSEOMetadata({
    title: 'Réinitialisation du mot de passe',
    description: 'Saisissez votre nouveau mot de passe pour Academia Helm.',
    path: '/reset-password',
    hostname,
    noIndex: true,
  });
}

export default function Page() {
  // Rediriger vers le nouveau flux professionnel de récupération
  redirect('/forgot-password');
}
