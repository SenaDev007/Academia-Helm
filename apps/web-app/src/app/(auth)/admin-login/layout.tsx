/**
 * Admin Login Layout
 * 
 * Layout spécifique pour la page de login Super Admin
 * Override le layout (auth) pour permettre le design personnalisé
 */

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pas de wrapper, le composant AdminLoginPage gère son propre design
  // Utiliser un div avec h-screen pour s'assurer que le background couvre toute la page
  return (
    <div className="h-screen w-full overflow-hidden">
      {children}
    </div>
  );
}

