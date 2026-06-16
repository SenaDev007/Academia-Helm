/**
 * Admin Login Page
 *
 * Page d'authentification dédiée au back-office Academia Helm.
 * Placée dans le groupe (auth) pour éviter le layout admin.
 *
 * Suspense nécessaire car AdminLoginPage utilise useSearchParams()
 * (Next.js 16 requirement).
 */

import { Suspense } from 'react';
import AdminLoginPage from '@/components/admin/AdminLoginPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AdminLoginPage />
    </Suspense>
  );
}
