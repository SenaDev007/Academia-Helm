import { redirect } from 'next/navigation';

/**
 * Page Article Blog — masquée
 *
 * 🗑️ 2026-10-15 — Blog masqué (non fonctionnel pour le moment).
 * Toutes les requêtes vers /blog/[slug] sont redirigées vers la page d'accueil.
 *
 * Pour réactiver : restaurer l'ancien contenu depuis git history
 * (commit cb5113fe8 ou antérieur).
 */
export default function BlogArticlePage() {
  redirect('/');
}
