/**
 * Admin Layout (Server Component)
 *
 * Layout protégé pour le panel Super Admin.
 *
 * SYSTÈME D'AUTHENTIFICATION SÉPARÉ :
 * Utilise le cookie dédié `academia_admin_session` (pas le cookie tenant).
 * Vérification cryptographique complète via verifyAdminSession() :
 *   - Signature HMAC
 *   - Expiration
 *   - Whitelist ADMIN_EMAILS
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import AdminLayoutClient from '@/components/admin/AdminLayout';
import { verifyAdminSession } from '@/lib/admin/admin-auth-server';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get('academia_admin_session');

  if (!adminCookie) {
    redirect('/admin-login');
  }

  let session;
  try {
    const decoded = JSON.parse(decodeURIComponent(adminCookie.value));
    session = verifyAdminSession(decoded);
  } catch {
    session = null;
  }

  if (!session) {
    redirect('/admin-login');
  }

  // Vérification stricte du rôle PLATFORM_SUPER_ADMIN
  if (session.user.role !== 'PLATFORM_SUPER_ADMIN') {
    redirect('/admin-login');
  }

  return (
    <AdminLayoutClient user={session.user}>
      {children}
    </AdminLayoutClient>
  );
}

