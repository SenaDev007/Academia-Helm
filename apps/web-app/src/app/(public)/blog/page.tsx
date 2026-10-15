import { redirect } from 'next/navigation';

/**
 * Page Blog — masquée
 *
 * 🗑️ 2026-10-15 — Blog masqué (non fonctionnel pour le moment).
 * Toutes les requêtes vers /blog sont redirigées vers la page d'accueil
 * pour ne pas exposer de contenu incomplet.
 *
 * Pour réactiver : restaurer l'ancien contenu depuis git history
 * (commit cb5113fe8 ou antérieur) et remettre les liens dans
 * header-1.tsx et footer-2.tsx.
 */
export default function BlogPage() {
  redirect('/');
}
