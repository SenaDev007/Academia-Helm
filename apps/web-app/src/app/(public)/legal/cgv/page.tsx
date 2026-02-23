/**
 * CGV Page
 * 
 * Page publique affichant les Conditions Générales de Vente
 */

import Link from 'next/link';
import PremiumHeader from '@/components/layout/PremiumHeader';

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-white">
      <PremiumHeader />
      <div className="h-20" />
      
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
            <h1 className="text-4xl font-bold text-navy-900 mb-4">
              Conditions Générales de Vente (CGV)
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
                  Les présentes Conditions Générales de Vente (CGV) sont disponibles 
                  en format complet dans le fichier{' '}
                  <Link 
                    href="/legal/CGV.md" 
                    className="text-soft-gold hover:underline"
                    target="_blank"
                  >
                    CGV.md
                  </Link>
                  {' '}ou peuvent être consultées directement sur la plateforme.
                </p>
                
                <p className="text-sm text-slate-600">
                  Pour toute question relative aux CGV, contactez-nous à{' '}
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

