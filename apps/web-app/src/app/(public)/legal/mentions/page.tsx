/**
 * Mentions Légales
 * 
 * Page officielle des mentions légales d'Academia Helm
 */

import PremiumHeader from '@/components/layout/PremiumHeader';
import InstitutionalFooter from '@/components/public/InstitutionalFooter';
import { bgColor, textColor, typo } from '@/lib/design-tokens';

// Force dynamic rendering to avoid build timeouts
export const dynamic = 'force-dynamic';

export default function LegalNoticesPage() {
  return (
    <>
      <PremiumHeader />
      <main className={`min-h-screen ${bgColor('app')} ${textColor('primary')}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className={`${typo('h1')} ${textColor('primary')} mb-8`}>
            Mentions Légales
          </h1>
          
          <div className={`${typo('base')} ${textColor('primary')} space-y-6 leading-relaxed`}>
            <section>
              <h2 className={`${typo('h2')} ${textColor('primary')} mb-4 mt-8`}>
                1. Éditeur
              </h2>
              <p>
                <strong>Academia Helm</strong>
                <br />
                Plateforme SaaS de gestion scolaire institutionnelle
                <br />
                <strong>Édité par :</strong> YEHI OR Tech
                <br />
                <strong>Zone d'opération :</strong> Afrique de l'Ouest
              </p>
            </section>

            <section>
              <h2 className={`${typo('h2')} ${textColor('primary')} mb-4 mt-8`}>
                2. Contact
              </h2>
              <p>
                <strong>Support :</strong> support@academiahub.com
              </p>
            </section>

            <section>
              <h2 className={`${typo('h2')} ${textColor('primary')} mb-4 mt-8`}>
                3. Hébergement
              </h2>
              <p>
                La plateforme Academia Helm est hébergée sur des serveurs sécurisés conformes aux standards
                internationaux de sécurité et de protection des données.
              </p>
            </section>

            <section>
              <h2 className={`${typo('h2')} ${textColor('primary')} mb-4 mt-8`}>
                4. Propriété intellectuelle
              </h2>
              <p>
                L'ensemble des éléments de la plateforme Academia Helm (textes, images, logos, design, code)
                sont la propriété exclusive d'Academia Helm et sont protégés par les lois relatives à la
                propriété intellectuelle.
              </p>
            </section>

            <section>
              <h2 className={`${typo('h2')} ${textColor('primary')} mb-4 mt-8`}>
                5. Responsabilité
              </h2>
              <p>
                Academia Helm s'efforce d'assurer la disponibilité et la fiabilité de la plateforme.
                Cependant, Academia Helm ne saurait être tenu responsable des dommages directs ou indirects
                résultant de l'utilisation ou de l'impossibilité d'utiliser la plateforme.
              </p>
            </section>

            <section className="mt-8 pt-6 border-t border-gray-200">
              <p className={`${typo('caption')} ${textColor('secondary')}`}>
                Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </section>
          </div>
        </div>
      </main>
      <InstitutionalFooter />
    </>
  );
}

