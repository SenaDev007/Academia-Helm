/**
 * ============================================================================
 * ADMIN AUTH LAYOUT — Layout pour les pages d'authentification admin
 * ============================================================================
 *
 * Ce layout est complètement SÉPARÉ du layout (auth) qui gère les pages
 * d'authentification de l'app école (/login, /forgot-password, /reset-password).
 *
 * Le back-office admin a ses propres pages d'auth :
 *   - /admin-login (page de connexion admin)
 *
 * Pas de wrapper — le composant AdminLoginPage gère son propre design
 * (fond navy foncé + accents dorés, différent du design école).
 * ============================================================================
 */

export default function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-full overflow-hidden">
      {children}
    </div>
  );
}
