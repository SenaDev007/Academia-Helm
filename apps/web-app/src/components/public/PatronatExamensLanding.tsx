/**
 * Landing Page Institutionnelle — Academia Federis
 *
 * Copywriting conforme à la proposition validée (27 septembre 2026) :
 * promesses mesurées, pas de superlatifs non démontrés, deux offres
 * (Federis Essentiel / Federis Institution), vocabulaire métier patronat.
 *
 * Sections : Hero · Enjeux · Fonctionnalités · Processus · Intégration Helm ·
 * Sécurité · Offres · Appel final · Contact · Pied de page.
 */

'use client';

import Link from 'next/link';
import FederisHeader from '../federis/FederisHeader';
import AppIcon from '@/components/ui/AppIcon';
import { useFederisPath } from '@/lib/federis/useFederisPath';

export default function PatronatExamensLanding() {
  const { path: federisPath } = useFederisPath();

  return (
    <div className="min-h-screen bg-white">
      <FederisHeader />

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden bg-[#0b1d3a] pt-24 pb-20">
        <div className="absolute inset-0 opacity-15 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500 rounded-full blur-[100px] opacity-40" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <p className="inline-block mb-8 text-amber-400 font-bold text-xs sm:text-sm uppercase tracking-[0.25em]">
            L&rsquo;espace numérique des patronats scolaires
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-8 leading-[1.1] tracking-tight">
            Coordonnez votre patronat.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
              Organisez vos examens avec méthode.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-blue-100/80 mb-12 max-w-3xl mx-auto leading-relaxed">
            Academia Federis accompagne les patronats dans la coordination de leurs écoles membres
            et la préparation des examens nationaux : inscriptions, candidats, centres de
            composition, surveillance, délibérations et publication des résultats.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6">
            <Link
              href={federisPath('/register')}
              prefetch={true}
              className="w-full sm:w-auto bg-amber-500 text-blue-950 px-10 py-5 rounded-xl font-bold hover:bg-amber-400 transition-all duration-300 inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Demander la création de mon espace
              <AppIcon name="arrowRight" size="action" />
            </Link>
            <Link
              href={federisPath('/login')}
              prefetch={true}
              className="w-full sm:w-auto bg-white/5 backdrop-blur-md text-white px-10 py-5 rounded-xl border border-white/20 font-bold hover:bg-white/10 transition-all duration-300 inline-flex items-center justify-center gap-2"
            >
              Accéder à Academia Federis
            </Link>
          </div>
          <p className="mt-10 text-sm text-blue-100/50 italic">
            Une application dédiée au pilotage collectif des examens, par Academia Helm.
          </p>
        </div>
      </section>

      {/* ═══════════════ LES ENJEUX ═══════════════ */}
      <section className="py-24 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-blue-950 mb-6 leading-tight">
              Quand plusieurs écoles préparent une même session, la coordination fait la
              différence.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Suivre les inscriptions, répartir les candidats, préparer les centres de composition
              et consolider les résultats demande une information fiable et partagée. Academia
              Federis donne aux responsables du patronat un espace commun pour organiser ces
              opérations et suivre les étapes importantes de chaque session.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Des informations dispersées',
                desc: 'Rassemblez les informations utiles des écoles membres dans un cadre de travail commun.',
                icon: 'network',
              },
              {
                title: 'Des inscriptions difficiles à consolider',
                desc: 'Suivez les dossiers des candidats, les pièces attendues et les corrections à apporter.',
                icon: 'user',
              },
              {
                title: 'Une logistique exigeante',
                desc: 'Préparez les centres, salles, affectations et listes de surveillance.',
                icon: 'building',
              },
              {
                title: 'Un suivi à renforcer',
                desc: 'Visualisez l’avancement de la session et les points qui demandent une décision.',
                icon: 'dashboard',
              },
            ].map((f, i) => (
              <div
                key={i}
                className="bg-gray-50 border border-gray-100 p-8 rounded-2xl hover:border-blue-200 hover:bg-white hover:shadow-md transition-all duration-300"
              >
                <div className="w-12 h-12 bg-blue-900/10 rounded-xl flex items-center justify-center mb-6">
                  <AppIcon name={f.icon as any} size="menu" className="text-blue-900" />
                </div>
                <h3 className="text-lg font-bold text-blue-950 mb-3">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FONCTIONNALITÉS ═══════════════ */}
      <section id="fonctionnalites" className="py-24 bg-[#0b1d3a] px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Les opérations du patronat, réunies dans un même espace.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Écoles membres',
                desc: 'Suivez les demandes de rattachement, les établissements participants et les informations partagées pour chaque session.',
                icon: 'building',
              },
              {
                title: 'Inscriptions et candidats',
                desc: 'Centralisez les dossiers d’inscription, repérez les informations manquantes et préparez les matricules et numéros de table.',
                icon: 'user',
              },
              {
                title: 'Examens et calendrier',
                desc: 'Définissez les sessions, les échéances, les matières et les étapes de préparation.',
                icon: 'calendar',
              },
              {
                title: 'Centres de composition',
                desc: 'Organisez les centres et les salles, répartissez les candidats selon les capacités disponibles.',
                icon: 'classes',
              },
              {
                title: 'Surveillance et procès-verbaux',
                desc: 'Préparez les affectations des surveillants et des chefs de centre. Consignez les incidents et les PV.',
                icon: 'shieldCheck',
              },
              {
                title: 'Épreuves et documents',
                desc: 'Classez les documents par examen et par session. Gérez les accès selon les responsabilités.',
                icon: 'document',
              },
              {
                title: 'Délibérations et résultats',
                desc: 'Préparez les données de résultats, effectuez les contrôles et organisez leur validation.',
                icon: 'exams',
              },
              {
                title: 'Rapports de pilotage',
                desc: 'Consultez des indicateurs de préparation, d’inscription et d’organisation. Exportez les rapports.',
                icon: 'grades',
              },
            ].map((f, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-6">
                  <AppIcon name={f.icon as any} size="menu" className="text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{f.title}</h3>
                <p className="text-blue-100/60 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ PROCESSUS ═══════════════ */}
      <section id="processus" className="py-24 bg-gray-50 px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-blue-950 mb-6">
              Une session organisée étape par étape.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                step: '1',
                title: 'Configurez la session',
                desc: 'Définissez le calendrier, les examens et les règles de participation.',
              },
              {
                step: '2',
                title: 'Mobilisez les écoles membres',
                desc: 'Identifiez les établissements concernés et suivez leur préparation.',
              },
              {
                step: '3',
                title: 'Consolidez les inscriptions',
                desc: 'Vérifiez les dossiers et traitez les anomalies avant la clôture.',
              },
              {
                step: '4',
                title: 'Préparez les centres',
                desc: 'Répartissez les candidats et produisez les listes utiles aux centres et aux équipes de surveillance.',
              },
              {
                step: '5',
                title: 'Suivez les opérations',
                desc: 'Consignez les incidents et les procès-verbaux dans le respect du processus du patronat.',
              },
              {
                step: '6',
                title: 'Validez les résultats',
                desc: 'Contrôlez, faites valider puis publiez les résultats selon les responsabilités définies.',
              },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-gray-100 p-8 rounded-2xl shadow-sm">
                <div className="flex items-center space-x-4 mb-5">
                  <div className="w-10 h-10 rounded-full bg-blue-900 text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                    {s.step}
                  </div>
                  <h3 className="text-lg font-bold text-blue-950">{s.title}</h3>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed pl-14">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ INTÉGRATION ACADEMIA HELM ═══════════════ */}
      <section className="py-24 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-blue-900 to-[#0b1d3a] rounded-[40px] p-10 md:p-16 relative overflow-hidden">
            <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-block bg-amber-500/20 text-amber-400 px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-6">
                  Interopérabilité
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
                  En lien avec l&rsquo;écosystème Academia Helm.
                </h2>
                <p className="text-lg text-blue-100/70 mb-8 leading-relaxed">
                  Lorsqu&rsquo;une école membre utilise Academia Helm, Federis peut s&rsquo;appuyer
                  sur les données que l&rsquo;école est autorisée à partager afin de limiter les
                  ressaisies et faciliter la préparation des examens.
                </p>
                <p className="text-sm text-blue-100/50 mb-8 leading-relaxed">
                  Les informations accessibles, leur fréquence de mise à jour et les actions
                  possibles dépendent du rattachement de l&rsquo;école et de la configuration de
                  l&rsquo;intégration.
                </p>
                <Link
                  href="/contact?subject=integration-federis"
                  className="inline-flex items-center gap-2 text-amber-400 font-semibold hover:text-amber-300 transition-colors"
                >
                  Découvrir l&rsquo;intégration Academia Helm
                  <AppIcon name="arrowRight" size="submenu" />
                </Link>
              </div>

              <div className="flex justify-center">
                <div className="relative w-full max-w-sm">
                  <div className="absolute inset-0 bg-amber-500 rounded-full blur-[80px] opacity-15" />
                  <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[32px]">
                    <div className="flex items-center justify-between mb-8">
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                        <AppIcon name="network" size="menu" className="text-white" />
                      </div>
                      <span className="text-[10px] font-bold text-blue-100/50 uppercase tracking-widest">
                        Écosystème Academia
                      </span>
                    </div>
                    <div className="space-y-4">
                      {['Écoles membres', 'Effectifs des classes d’examen', 'Candidats concernés'].map(
                        (item, i) => (
                          <div key={i} className="flex items-center space-x-4">
                            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                              <AppIcon name="check" size="action" className="text-amber-400" />
                            </div>
                            <div className="flex-1">
                              <div className="h-2 bg-white/20 rounded-full w-3/4" />
                              <div className="h-2 bg-white/10 rounded-full w-1/2 mt-2" />
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                    <div className="mt-8 pt-6 border-t border-white/10 text-center">
                      <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">
                        Accès contrôlé, selon l&rsquo;autorisation de l&rsquo;école
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ SÉCURITÉ ET TRAÇABILITÉ ═══════════════ */}
      <section id="securite" className="py-24 bg-gray-50 px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold text-blue-950 mb-6 leading-tight">
                Des accès adaptés aux responsabilités de chacun.
              </h2>
              <p className="text-lg text-gray-600 mb-10 leading-relaxed">
                Les opérations d&rsquo;un patronat impliquent des données et des documents qui ne
                doivent pas être accessibles indistinctement. Academia Federis est conçu pour
                organiser les accès par rôle, suivre les opérations importantes et soutenir le
                contrôle humain des décisions liées aux examens.
              </p>
              <Link
                href="/contact?subject=securite-federis"
                className="inline-flex items-center gap-2 text-blue-800 font-semibold hover:text-blue-900 transition-colors"
              >
                En savoir plus sur nos engagements
                <AppIcon name="arrowRight" size="submenu" />
              </Link>
            </div>

            <div className="space-y-4">
              {[
                {
                  title: 'Des espaces et des données séparés par patronat',
                  icon: 'shieldCheck',
                },
                {
                  title: 'Des accès limités selon le rôle et les responsabilités',
                  icon: 'lock',
                },
                {
                  title: 'Une traçabilité des opérations sensibles',
                  icon: 'document',
                },
                {
                  title: 'Une validation humaine avant toute décision ou publication officielle',
                  icon: 'user',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center space-x-5 bg-white border border-gray-100 p-6 rounded-2xl shadow-sm"
                >
                  <div className="w-11 h-11 bg-blue-900/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <AppIcon name={item.icon as any} size="menu" className="text-blue-900" />
                  </div>
                  <p className="text-gray-800 font-medium leading-snug">{item.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ OFFRES ═══════════════ */}
      <section id="offres" className="py-24 bg-white px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-blue-950 mb-6">
              Deux formules pour accompagner votre patronat.
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Choisissez l&rsquo;offre adaptée au nombre d&rsquo;écoles membres et aux campagnes que
              vous coordonnez. Les prix sont proposés par année scolaire.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Federis Essentiel */}
            <div className="relative p-10 rounded-[32px] border-2 border-gray-100 hover:border-blue-200 transition-all duration-300 bg-white">
              <h3 className="text-2xl font-bold text-blue-950">Federis Essentiel</h3>
              <p className="text-gray-500 text-sm mt-2 mb-8">
                Pour les patronats qui structurent leurs premières campagnes d&rsquo;examens.
              </p>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-4xl font-black text-blue-900">100 000</span>
                <span className="text-gray-600 font-medium">FCFA / année scolaire</span>
              </div>
              <ul className="space-y-4 mb-10">
                {[
                  "Jusqu'à 5 écoles membres",
                  "Jusqu'à 500 candidatures validées par année scolaire",
                  '1 campagne active à la fois',
                  'Inscriptions, import de candidats, centres et salles, listes et suivi des résultats',
                  "Contrôle des accès par rôle et traçabilité des opérations importantes",
                ].map((f, fi) => (
                  <li key={fi} className="flex items-start space-x-3">
                    <div className="w-5 h-5 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AppIcon name="check" size="action" className="text-blue-700" />
                    </div>
                    <span className="text-gray-600 text-sm leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/contact?subject=demo-federis-essentiel"
                className="w-full py-4 rounded-xl font-bold text-center block bg-blue-50 text-blue-800 hover:bg-blue-100 transition-all"
              >
                Demander une démonstration
              </Link>
            </div>

            {/* Federis Institution */}
            <div className="relative p-10 rounded-[32px] border-2 border-amber-500 shadow-xl bg-white">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-blue-950 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                Recommandée
              </div>
              <h3 className="text-2xl font-bold text-blue-950">Federis Institution</h3>
              <p className="text-gray-500 text-sm mt-2 mb-8">
                Pour les patronats qui coordonnent plusieurs établissements, centres et équipes.
              </p>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-4xl font-black text-blue-900">250 000</span>
                <span className="text-gray-600 font-medium">FCFA / année scolaire</span>
              </div>
              <ul className="space-y-4 mb-10">
                {[
                  "Jusqu'à 25 écoles membres",
                  "Jusqu'à 3 000 candidatures validées par année scolaire",
                  "Jusqu'à 3 campagnes actives simultanément",
                  'Toutes les fonctions d’Essentiel, plus pilotage multi-campagnes et rapports étendus',
                  'Banque d’épreuves avec gestion des versions et des droits d’accès',
                  'Prise en main assistée et traitement prioritaire des demandes',
                ].map((f, fi) => (
                  <li key={fi} className="flex items-start space-x-3">
                    <div className="w-5 h-5 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AppIcon name="check" size="action" className="text-amber-600" />
                    </div>
                    <span className="text-gray-600 text-sm leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/contact?subject=demo-federis-institution"
                className="w-full py-4 rounded-xl font-bold text-center block bg-amber-500 text-blue-950 hover:bg-amber-400 transition-all shadow-lg"
              >
                Parler à notre équipe
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-10 max-w-3xl mx-auto leading-relaxed">
            Tarifs et capacités proposés à titre de cadrage, par entité souscriptrice. Les mesures
            de sécurité fondamentales, le cloisonnement des patronats et la protection des documents
            s&rsquo;appliquent aux deux offres. Au-delà des capacités prévues, un devis est établi
            dans le cadre de l&rsquo;offre Institution.
          </p>
        </div>
      </section>

      {/* ═══════════════ APPEL FINAL ═══════════════ */}
      <section className="py-24 bg-[#0b1d3a] px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-[-20%] left-[20%] w-full h-full bg-blue-600 rounded-full blur-[150px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Préparez votre prochaine session avec une organisation mieux coordonnée.
          </h2>
          <p className="text-lg text-blue-100/70 mb-10 max-w-2xl mx-auto">
            Découvrez comment Academia Federis peut accompagner votre patronat, de la mobilisation
            des écoles membres à la publication des résultats.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6">
            <Link
              href={federisPath('/register')}
              className="w-full sm:w-auto bg-amber-500 text-blue-950 px-10 py-5 rounded-xl font-bold hover:bg-amber-400 transition-all shadow-xl"
            >
              Demander la création de mon espace
            </Link>
            <Link
              href="/contact?subject=demo-federis"
              className="w-full sm:w-auto bg-white/5 border border-white/20 text-white px-10 py-5 rounded-xl font-bold hover:bg-white/10 transition-all"
            >
              Contacter l&rsquo;équipe
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════ CONTACT ═══════════════ */}
      <section className="py-24 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-blue-950 mb-4">
              Parlons de votre patronat et de vos examens.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Présentez-nous votre organisation, le nombre d&rsquo;écoles concernées et les étapes
              que vous souhaitez mieux coordonner. Notre équipe vous orientera vers la formule et le
              parcours adaptés.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center p-8 bg-gray-50 rounded-2xl border border-gray-100">
              <AppIcon name="mail" size="menu" className="text-blue-900 mx-auto mb-4" />
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                Courriel
              </div>
              <a
                href="mailto:support@academiahelm.com"
                className="text-blue-800 font-semibold hover:text-blue-900 transition-colors break-all"
              >
                support@academiahelm.com
              </a>
            </div>
            <div className="text-center p-8 bg-gray-50 rounded-2xl border border-gray-100">
              <AppIcon name="phone" size="menu" className="text-blue-900 mx-auto mb-4" />
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                Téléphone
              </div>
              <a
                href="tel:+2290141360803"
                className="text-blue-800 font-semibold hover:text-blue-900 transition-colors"
              >
                +229 01 41 36 08 03
              </a>
            </div>
            <div className="text-center p-8 bg-gray-50 rounded-2xl border border-gray-100">
              <AppIcon name="globe" size="menu" className="text-blue-900 mx-auto mb-4" />
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                Localisation
              </div>
              <span className="text-blue-800 font-semibold">
                Parakou, Bénin — Afrique de l&rsquo;Ouest
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ PIED DE PAGE INSTITUTIONNEL ═══════════════ */}
      <footer className="bg-blue-900 border-t-2 border-amber-500/20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <div className="text-lg font-bold text-white mb-1">Academia Federis</div>
              <p className="text-sm text-blue-100/60 max-w-md">
                Par Academia Helm — l&rsquo;application dédiée à la coordination des patronats
                scolaires et des examens nationaux.
              </p>
            </div>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <a href="#fonctionnalites" className="text-sm text-blue-100/70 hover:text-white transition-colors">
                Fonctionnalités
              </a>
              <a href="#processus" className="text-sm text-blue-100/70 hover:text-white transition-colors">
                Organisation des examens
              </a>
              <a href="#securite" className="text-sm text-blue-100/70 hover:text-white transition-colors">
                Sécurité et traçabilité
              </a>
              <a href="#offres" className="text-sm text-blue-100/70 hover:text-white transition-colors">
                Offres
              </a>
              <Link href="/contact" className="text-sm text-blue-100/70 hover:text-white transition-colors">
                Contact
              </Link>
            </nav>
          </div>
          <div className="mt-10 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-blue-100/40">
              © {new Date().getFullYear()} Academia Helm. Tous droits réservés.
            </p>
            <div className="flex gap-6">
              <Link href="/legal/terms" className="text-xs text-blue-100/40 hover:text-blue-100/70 transition-colors">
                Conditions d&rsquo;utilisation
              </Link>
              <Link href="/legal/privacy" className="text-xs text-blue-100/40 hover:text-blue-100/70 transition-colors">
                Confidentialité
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
