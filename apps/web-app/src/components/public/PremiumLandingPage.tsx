/**
 * Premium Landing Page Component
 * 
 * Page d'accueil premium pour Academia Helm
 */

import Link from 'next/link';
import PremiumHeader from '../layout/PremiumHeader';
import TestimonialsSection from './TestimonialsSection';

export default function PremiumLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <PremiumHeader />
      
      {/* Hero Section */}
      <section className="py-24 md:py-32 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-6">
            Academia Helm : Le Système de Direction Scolaire que vous méritez.
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed mb-10">
            Une vision claire, une gestion rigoureuse, une autorité assumée.
            Notre plateforme est conçue pour les leaders qui transforment l'éducation.
          </p>
          <div className="flex justify-center space-x-4">
            <Link href="/modules" className="btn-secondary">
              Voir les modules
            </Link>
            <Link href="/signup" className="btn-primary-crimson">
              Activer Academia Helm
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <TestimonialsSection limit={3} featured={true} />

      {/* CTA Section */}
      <section className="py-24 bg-navy-900 text-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            Prêt à transformer la direction de votre établissement ?
          </h2>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center bg-blue-600 text-white px-10 py-5 rounded-md text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Activer Academia Helm maintenant
          </Link>
        </div>
      </section>
    </div>
  );
}

