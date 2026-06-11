/**
 * Redirection /auth/login → /login
 * La page de connexion réelle est dans (auth)/login → URL /login
 */

import { redirect } from 'next/navigation';

export default function AuthLoginPage() {
  redirect('/login');
}
