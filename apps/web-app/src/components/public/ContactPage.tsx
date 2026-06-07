/**
 * Contact Page Component
 */

import PremiumHeader from '../layout/PremiumHeader';
import Link from 'next/link';
import { Mail, Phone, MapPin, ArrowRight } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <PremiumHeader />
      <div className="h-20" />
      
      <section className="py-24 md:py-32 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-6">
            Contact institutionnel
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed">
            Academia Helm est une plateforme destinée aux promoteurs et directeurs d'établissements privés.
          </p>
        </div>
      </section>

      <section className="py-16 bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg p-6 border border-gray-200 text-center">
              <Mail className="w-8 h-8 text-navy-900 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-navy-900 mb-2">Email</h3>
              <p className="text-slate-600 text-sm">contact@academiahub.com</p>
              <p className="text-xs text-gray-500 mt-2">Réponse sous 48h ouvrées</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200 text-center">
              <Phone className="w-8 h-8 text-navy-900 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-navy-900 mb-2">Téléphone</h3>
              <p className="text-slate-600 text-sm">+229 XX XX XX XX</p>
              <p className="text-xs text-gray-500 mt-2">Lun-Ven, 8h-17h (GMT+1)</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200 text-center">
              <MapPin className="w-8 h-8 text-navy-900 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-navy-900 mb-2">Adresse</h3>
              <p className="text-slate-600 text-sm">Cotonou, Bénin</p>
              <p className="text-xs text-gray-500 mt-2">Sur rendez-vous uniquement</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

