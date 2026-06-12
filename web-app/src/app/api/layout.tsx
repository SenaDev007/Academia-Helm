/**
 * Layout des routes API - force le rendu dynamique pour toutes les routes /api/*
 * Évite les erreurs "couldn't be rendered statically" (request.headers, searchParams, etc.)
 */
export const dynamic = 'force-dynamic';

export default function ApiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
