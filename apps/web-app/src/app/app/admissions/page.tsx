/**
 * ============================================================================
 * ADMISSIONS MODULE PAGE — Configuration des admissions par le promoteur
 * ============================================================================
 * Page /app/admissions : permet au promoteur/directeur de configurer toute
 * la section Admissions du site institutionnel public :
 *   - Activation de l'admission (toggle global)
 *   - Titre + sous-titre + CTA final
 *   - Étapes (CRUD : titre, description, icône, ordre, activation)
 *   - Documents requis (CRUD : libellé, description, ordre, activation)
 *
 * Backend : /api/admission-settings (GET/PUT) + /steps (POST/PUT/DELETE) +
 * /documents (POST/PUT/DELETE) — voir AdmissionSettingsController.
 *
 * ⚠️ Accès réservé : promoteur, directeur, admin (voir PilotageSidebar).
 * ============================================================================
 */
import { getServerSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdmissionSettingsWorkspace from './_components/AdmissionSettingsWorkspace';

export const dynamic = 'force-dynamic';

export default async function AdmissionsPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect('/login');
  }
  return <AdmissionSettingsWorkspace />;
}
