import { Suspense } from 'react';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { ProfRegisterForm } from '@/components/prof/ProfRegisterForm';

/**
 * Helm Enseignant — Page d'inscription (publique).
 * Wizard 3 étapes : identité → niveaux → récapitulatif.
 */
export default function ProfRegisterPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/prof" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-base font-bold text-slate-900">Helm Enseignant</span>
          </Link>
          <Link href="/prof/login" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
            J’ai déjà un compte
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense
          fallback={
            <div className="flex h-96 items-center justify-center text-slate-400">
              Chargement…
            </div>
          }
        >
          <ProfRegisterForm />
        </Suspense>
      </main>
    </div>
  );
}
