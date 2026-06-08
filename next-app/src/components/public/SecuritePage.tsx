/**
 * Sécurité Page Component
 */

import PremiumHeader from '../layout/PremiumHeader';
import Link from 'next/link';
import { Shield, Lock, Database, CheckCircle, ArrowRight } from 'lucide-react';

export default function SecuritePage() {
  return (
    <div className="min-h-screen bg-white">
      <PremiumHeader />
      <div className="h-20" />
      
      <section className="py-24 md:py-32 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-6">
            Sécurité des données. Méthode éprouvée. Durabilité garantie.
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed">
            Academia Helm est une plateforme SaaS professionnelle, conçue selon les standards de sécurité.
          </p>
        </div>
      </section>

      <section className="py-16 bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card-institutional">
              <Shield className="icon-card-primary" />
              <h3 className="text-xl font-bold text-navy-900 mb-4">Architecture multi-tenant isolée</h3>
              <p className="text-slate-600">
                Chaque établissement dispose d'un environnement de données isolé.
              </p>
            </div>
            <div className="card-institutional">
              <Lock className="icon-card-primary" />
              <h3 className="text-xl font-bold text-navy-900 mb-4">Chiffrement des données</h3>
              <p className="text-slate-600">
                Les données sensibles sont chiffrées en transit et au repos.
              </p>
            </div>
            <div className="card-institutional">
              <Database className="icon-card-primary" />
              <h3 className="text-xl font-bold text-navy-900 mb-4">Sauvegardes automatiques</h3>
              <p className="text-slate-600">
                Vos données sont sauvegardées automatiquement chaque jour.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

