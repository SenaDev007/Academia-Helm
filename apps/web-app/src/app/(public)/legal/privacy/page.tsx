/**
 * Politique de Confidentialité
 * 
 * Page officielle de la politique de confidentialité d'Academia Helm
 */

import PremiumHeader from '@/components/layout/PremiumHeader';
import InstitutionalFooter from '@/components/public/InstitutionalFooter';
import { bgColor, textColor, typo } from '@/lib/design-tokens';

// Force dynamic rendering to avoid build timeouts
export const dynamic = 'force-dynamic';

export default function PrivacyPolicyPage() {
  return (
    <>
      <PremiumHeader />
      <main className={`min-h-screen ${bgColor('app')} ${textColor('primary')}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className={`${typo('h1')} ${textColor('primary')} mb-8`}>
            Politique de Confidentialité
          </h1>
          
          <div className={`${typo('base')} ${textColor('primary')} space-y-6 leading-relaxed`}>
            <section>
              <h2 className={`${typo('h2')} ${textColor('primary')} mb-4 mt-8`}>
                1. Collecte des données
              </h2>
              <p>
                Academia Helm collecte les données nécessaires au fonctionnement de la plateforme de gestion scolaire.
                Ces données incluent les informations relatives aux établissements, aux élèves, aux enseignants,
                et aux opérations administratives et financières.
              </p>
            </section>

            <section>
              <h2 className={`${typo('h2')} ${textColor('primary')} mb-4 mt-8`}>
                2. Utilisation des données
              </h2>
              <p>
                Les données collectées sont utilisées exclusivement pour fournir les services de gestion scolaire
                demandés par l'établissement. Academia Helm ne vend, ne loue, ni ne partage vos données avec des tiers
                à des fins commerciales.
              </p>
            </section>

            <section>
              <h2 className={`${typo('h2')} ${textColor('primary')} mb-4 mt-8`}>
                3. Protection des données
              </h2>
              <p>
                Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour
                protéger vos données contre tout accès non autorisé, perte, destruction ou altération.
              </p>
            </section>

            <section>
              <h2 className={`${typo('h2')} ${textColor('primary')} mb-4 mt-8`}>
                4. Vos droits
              </h2>
              <p>
                Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression,
                de limitation du traitement, de portabilité et d'opposition concernant vos données personnelles.
              </p>
            </section>

            <section>
              <h2 className={`${typo('h2')} ${textColor('primary')} mb-4 mt-8`}>
                5. Contact
              </h2>
              <p>
                Pour toute question concernant cette politique de confidentialité, vous pouvez nous contacter à :
                <br />
                <strong>Email :</strong> support@academiahub.com
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

