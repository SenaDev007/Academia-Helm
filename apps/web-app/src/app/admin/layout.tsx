/**
 * Admin Layout (Server Component)
 * 
 * Layout protégé pour le panel Super Admin
 * Vérifie l'authentification et le rôle SUPER_ADMIN
 */

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import AdminLayoutClient from '@/components/admin/AdminLayout';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect('/admin-login');
  }

  // Vérification stricte du rôle SUPER_ADMIN
  if (session.user.role !== 'SUPER_ADMIN') {
    redirect('/app'); // Rediriger vers le dashboard normal
  }

  return (
    <AdminLayoutClient user={session.user}>
      {children}
    </AdminLayoutClient>
  );
}

