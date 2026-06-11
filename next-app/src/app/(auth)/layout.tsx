/**
 * Auth Layout
 * 
 * Layout pour les pages d'authentification
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      {children}
    </div>
  );
}

