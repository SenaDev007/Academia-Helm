/**
 * Public Layout
 * 
 * Layout pour les pages publiques (landing, pricing, etc.)
 */

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* Spacer pour le header fixe (responsive h-14 md:h-16) */}
      <div className="h-14 md:h-16" />
      {children}
    </div>
  );
}

