import { ReactNode } from 'react';

/**
 * Layout /prof (Helm Enseignant) — pass-through.
 *
 * Les pages marketing (landing, login, register) et l'espace connecté
 * (groupe (connected)) gèrent leur propre chrome. Ce layout existe pour
 * ancrer une frontière Suspense commune (pattern federis).
 */
export default function ProfGroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
