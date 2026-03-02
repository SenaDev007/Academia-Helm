/**
 * MODULE 2 — Cahier du semainier (SM6)
 * Suivi hebdomadaire, soumission, validation direction.
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import Link from 'next/link';
import { CalendarDays, FileText, BookOpen, ArrowRight } from 'lucide-react';

export default function SemainierPage() {
  return (
    <ModuleContainer
      header={{
        title: 'Cahier du semainier',
        description: 'Suivi hebdomadaire, entrées quotidiennes, soumission à la direction',
        icon: 'bookOpen',
      }}
      content={{
        layout: 'custom',
        children: (
          <div className="space-y-6">
            <p className="text-gray-600">
              Le semainier permet de consigner les activités de la semaine, les entrées quotidiennes
              et les incidents éventuels, puis de soumettre le tout à la direction pour validation.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-900">Semainier actuel</span>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  Consulter ou compléter le semainier de la semaine en cours (espace enseignant).
                </p>
                <Link
                  href="/app/pedagogy/workspace"
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                >
                  Espace pédagogique <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-amber-600" />
                  <span className="font-medium text-gray-900">Fiches & cahiers</span>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  Fiches pédagogiques, cahier journal et cahier de texte complètent le suivi.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/app/pedagogy/lesson-plans"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Fiches
                  </Link>
                  <Link
                    href="/app/pedagogy/daily-logs"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Cahier journal
                  </Link>
                  <Link
                    href="/app/pedagogy/class-diaries"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Cahier de texte
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-900">Workflow</span>
              </div>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Enseignant : création / mise à jour du semainier, entrées quotidiennes</li>
                <li>Soumission en fin de semaine vers la direction</li>
                <li>Direction : validation ou commentaire</li>
                <li>Indicateurs agrégés dans le Contrôle pédagogique et ORION</li>
              </ul>
            </div>
          </div>
        ),
      }}
    />
  );
}
