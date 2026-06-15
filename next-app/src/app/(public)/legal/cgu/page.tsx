/**
 * CGU Page
 * 
 * Page publique affichant les Conditions Générales d'Utilisation
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import PremiumHeader from '@/components/layout/PremiumHeader';
import { generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Conditions générales d’utilisation (CGU)',
  description:
    'Conditions générales d’utilisation de la plateforme Academia Helm (pilotage éducatif, comptes, responsabilités).',
  keywords: ['CGU Academia Helm', 'conditions utilisation logiciel école'],
  path: '/legal/cgu',
});

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-white">
      <PremiumHeader />
      <div className="h-20" />
      
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
            <h1 className="text-4xl font-bold text-navy-900 mb-4">
              Conditions Générales d'Utilisation (CGU)
            </h1>
            <p className="text-slate-600 mb-8">
              Academia Helm - Plateforme de pilotage éducatif
            </p>
            
            <div className="prose prose-lg max-w-none text-slate-700">
              <p className="text-sm text-slate-500 mb-8">
                <strong>Version 1.0</strong> • Date d'entrée en vigueur : 2025
              </p>
              
              <div className="space-y-6">
                <p className="text-sm text-slate-600">
                  Les présentes Conditions Générales d'Utilisation (CGU) sont disponibles 
                  en format complet dans le fichier{' '}
                  <Link 
                    href="/legal/CGU.md" 
                    className="text-soft-gold hover:underline"
                    target="_blank"
                  >
                    CGU.md
                  </Link>
                  {' '}ou peuvent être consultées directement sur la plateforme.
                </p>
                
                <p className="text-sm text-slate-600">
                  Pour toute question relative aux CGU, contactez-nous à{' '}
                  <a href="mailto:contact@academiahub.com" className="text-soft-gold hover:underline">
                    contact@academiahub.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

