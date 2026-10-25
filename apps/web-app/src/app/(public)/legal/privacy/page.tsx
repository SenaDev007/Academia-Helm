/**
 * Politique de Confidentialité
 *
 * Page officielle de la politique de confidentialité d'Academia Helm
 * (plateforme web + application mobile Android « Academia Helm »).
 *
 * ⚠️ Page référencée comme « URL des règles de confidentialité » dans
 * Google Play Console pour l'app com.yehiortech.academiahelm — toute
 * modification doit rester publique, stable et accessible sans connexion.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Header } from '@/components/ui/header-1';
import { Footer2 } from '@/components/ui/footer-2';
import { bgColor, textColor, typo } from '@/lib/design-tokens';
import { generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Politique de confidentialité',
  description:
    'Politique de confidentialité et traitement des données personnelles sur Academia Helm : plateforme web et application mobile Android (notifications, RGPD, données des enfants, droits des utilisateurs).',
  keywords: [
    'confidentialité Academia Helm',
    'données personnelles école',
    'RGPD',
    'application Android Academia Helm',
  ],
  path: '/legal/privacy',
});

// ✅ Static rendering — page 100% statique (pas de fetch/headers/cookies)
// Permet le prerendering à build time → TTFB <50ms au lieu de ~300ms
export const dynamic = 'force-static';
export const revalidate = false; // Jamais de revalidation (contenu légal stable)

const DERNIERE_MISE_A_JOUR = '25 octobre 2026';

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className={`${typo('h2')} ${textColor('primary')} mb-4 mt-8`}>{children}</h2>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <Header />
      <main className={`min-h-screen ${bgColor('app')} ${textColor('primary')}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className={`${typo('h1')} ${textColor('primary')} mb-4`}>
            Politique de Confidentialité
          </h1>
          <p className={`${typo('caption')} ${textColor('secondary')} mb-8`}>
            Dernière mise à jour : {DERNIERE_MISE_A_JOUR}
          </p>

          <div className={`${typo('base')} ${textColor('primary')} space-y-6 leading-relaxed`}>
            <SectionTitle>1. Éditeur et responsable du traitement</SectionTitle>
            <p>
              Acadia&nbsp;Helm — Academia Helm — est une plateforme de gestion scolaire éditée par{' '}
              <strong>Yehiortech</strong>. La plateforme est accessible par navigateur web à{' '}
              l&apos;adresse academiahelm.com et par l&apos;application mobile Android «&nbsp;Academia Helm&nbsp;»
              distribuée sur Google Play (nom de package{' '}
              <strong>com.yehiortech.academiahelm</strong>).
            </p>
            <p>
              Yehiortech, en sa qualité d&apos;éditeur, détermine les finalités et les moyens du
              traitement des données personnelles collectées dans le cadre de la plateforme et de
              l&apos;application. Les établissements scolaires clients restent responsables des
              données qu&apos;ils saisissent concernant leurs élèves et leur personnel, conformément
              à leurs propres obligations légales.
            </p>

            <SectionTitle>2. Champ d&apos;application</SectionTitle>
            <p>
              La présente politique s&apos;applique à l&apos;ensemble des services Academia Helm&nbsp;:
              le site institutionnel, les portails web (portail école, portail enseignant, portail
              parents), ainsi que l&apos;application mobile Android qui donne accès à ces mêmes
              services. Elle décrit les données que nous collectons, la façon dont nous les
              utilisons, les services tiers qui y participent et les droits dont vous disposez.
            </p>

            <SectionTitle>3. Données collectées sur la plateforme</SectionTitle>
            <p>
              Academia Helm collecte les données nécessaires au fonctionnement de la plateforme de
              gestion scolaire. Ces données incluent les informations relatives aux établissements,
              aux élèves, aux enseignants, aux parents, et aux opérations administratives et
              financières (inscriptions, frais de scolarité, absences, notes, communications).
            </p>
            <p>
              Nous collectons également des données techniques indispensables au service&nbsp;:
              identifiants de compte, mots de passe (stockés sous forme chiffrée), journaux de
              connexion, adresse IP et informations de session, à des fins d&apos;authentification
              et de sécurité.
            </p>

            <SectionTitle>4. Application mobile Android</SectionTitle>
            <p>
              L&apos;application «&nbsp;Academia Helm&nbsp;» pour Android (éditée par{' '}
              <strong>Yehiortech</strong>, package com.yehiortech.academiahelm) est une interface
              d&apos;accès sécurisée à la plateforme academiahelm.com. Les traitements décrits à la
              section 3 s&apos;y appliquent pleinement. L&apos;application traite en outre les
              données techniques suivantes&nbsp;:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Jetons de notifications push</strong> : un identifiant unique généré par
                Google Firebase Cloud Messaging (FCM) permet de vous adresser les notifications liées
                à la vie scolaire (messages, notes, absences, paiements). Ce jeton est rattaché à
                votre compte utilisateur et peut être révoqué à tout moment.
              </li>
              <li>
                <strong>Identifiants techniques de l&apos;appareil</strong> : modèle, version du
                système Android, langue, version de l&apos;application — utilisés pour garantir la
                compatibilité et diagnostiquer les dysfonctionnements.
              </li>
              <li>
                <strong>Données de session</strong> : préférences d&apos;affichage et identifiants
                d&apos;authentification conservés localement sur l&apos;appareil pour maintenir la
                connexion.
              </li>
            </ul>
            <p>
              L&apos;application demande uniquement deux autorisations Android&nbsp;:
              <strong> l&apos;accès réseau (INTERNET)</strong>, nécessaire au chargement de la
              plateforme, et <strong>l&apos;affichage des notifications (POST_NOTIFICATIONS)</strong>.
              Aucune autre autorisation sensible (caméra, micro, contacts, géolocalisation) n&apos;est
              requise. Vous pouvez refuser les notifications dans les réglages Android&nbsp;:
              l&apos;application reste alors pleinement fonctionnelle.
            </p>

            <SectionTitle>5. Utilisation des données</SectionTitle>
            <p>
              Les données collectées sont utilisées exclusivement pour fournir les services de
              gestion scolaire demandés par l&apos;établissement&nbsp;: tenue des dossiers élèves,
              suivi pédagogique, communication entre l&apos;école et les familles, notifications,
              facturation et recouvrement des frais de scolarité, sécurité des comptes. Academia
              Helm ne vend, ne loue, ni ne partage vos données avec des tiers à des fins
              commerciales. Aucune donnée n&apos;est utilisée à des fins publicitaires ou de
              profilage.
            </p>

            <SectionTitle>6. Services tiers et partage</SectionTitle>
            <p>
              Nous faisons appel à des prestataires techniques qui traitent des données uniquement
              sur instruction et pour les finalités décrites dans la présente politique&nbsp;:
              l&apos;hébergeur de la plateforme et de sa base de données, et{' '}
              <strong>Google (Firebase Cloud Messaging / Google Play services)</strong> pour
              l&apos;acheminement des notifications push vers les appareils Android. Dans ce cadre,
              Google peut traiter le jeton FCM de l&apos;appareil et des informations techniques
              minimales (identifiants d&apos;application, horodatage). Aucun autre partage n&apos;est
              réalisé, sauf obligation légale ou judiciaire.
            </p>

            <SectionTitle>7. Protection des données</SectionTitle>
            <p>
              Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles
              appropriées pour protéger vos données contre tout accès non autorisé, perte,
              destruction ou altération&nbsp;: chiffrement des échanges (HTTPS/TLS), authentification
              renforcée, restriction des accès au personnel habilité et sauvegardes régulières.
            </p>

            <SectionTitle>8. Données des enfants</SectionTitle>
            <p>
              La plateforme est conçue pour des établissements d&apos;enseignement et peut contenir
              des données d&apos;élèves mineurs. Ces données sont saisies et utilisées sous la
              responsabilité des établissements, avec l&apos;accord des parents ou tuteurs légaux,
              uniquement à des fins pédagogiques et administratives. Aucune donnée d&apos;enfant
              n&apos;est collectée à des fins publicitaires, de profilage comportemental ou de
              revente, conformément aux règles de Google Play destinées aux applications accessibles
              aux familles.
            </p>

            <SectionTitle>9. Conservation des données</SectionTitle>
            <p>
              Les données sont conservées pendant la durée de la relation contractuelle avec
              l&apos;établissement, puis archivées ou supprimées conformément aux obligations
              légales applicables. Les jetons de notifications sont supprimés lorsque vous vous
              déconnectez, désinstallez l&apos;application ou désactivez les notifications.
            </p>

            <SectionTitle>10. Vos droits</SectionTitle>
            <p>
              Conformément au RGPD et aux législations de protection des données personnelles
              applicables dans les pays où Academia Helm est utilisé, vous disposez d&apos;un droit
              d&apos;accès, de rectification, de suppression, de limitation du traitement, de
              portabilité et d&apos;opposition concernant vos données personnelles. Pour les élèves
              mineurs, ces droits sont exercés par leurs parents ou tuteurs légaux.
            </p>

            <SectionTitle>11. Évolution de cette politique</SectionTitle>
            <p>
              La présente politique peut être mise à jour pour refléter l&apos;évolution du service
              ou de la réglementation. La date de dernière mise à jour figure en tête de page&nbsp;;
              les modifications significatives sont signalées aux utilisateurs concernés.
            </p>

            <SectionTitle>12. Contact</SectionTitle>
            <p>
              Pour toute question ou demande concernant cette politique de confidentialité et
              l&apos;exercice de vos droits, vous pouvez nous contacter à&nbsp;:
              <br />
              <strong>Email&nbsp;:</strong> support@academiahelm.com
            </p>

            <section className="mt-8 pt-6 border-t border-gray-200">
              <p className={`${typo('caption')} ${textColor('secondary')}`}>
                Dernière mise à jour : {DERNIERE_MISE_A_JOUR} — Academia Helm, édité par Yehiortech.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer2 />
    </>
  );
}
