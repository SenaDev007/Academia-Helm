/**
 * Landing Page Institutionnelle — Academia Federis
 * ═══════════════════════════════════════════════════════════════════════════
 * REFONTE DESIGN WinAgro-inspired (2026-09-27) — palette navy/or et police
 * Inter CONSERVÉES, ADN visuel WinAgro importé :
 *   - Hero immersif : dégradés navy superposés, cercles flottants lumineux,
 *     grain SVG, titre révélé par vagues échelonnées, badge ping, CTA or
 *     avec balayage lumineux + pulsation, séparateur incliné de section
 *   - Bande de statistiques avec compteurs animés (IntersectionObserver)
 *   - Cartes numérotées (01, 02…) avec survol soulevé + shimmer
 *   - Offre premium cerclée d'or avec badge couronne (ADN WinAgro)
 *   - Titres de section : badge pilule + liseré or animé (scaleX)
 *
 * Copywriting conforme à la proposition validée (27 septembre 2026) :
 * promesses mesurées, pas de superlatifs non démontrés, deux offres
 * (Federis Essentiel / Federis Institution), vocabulaire métier patronat.
 *
 * Sections : Hero · Stats · Enjeux · Fonctionnalités · Processus ·
 * Intégration Helm · Sécurité · Offres · Appel final · Contact · Pied de page.
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Crown, GraduationCap, Network, ShieldCheck } from 'lucide-react';
import FederisHeader from '../federis/FederisHeader';
import AppIcon from '@/components/ui/AppIcon';
import { useFederisPath } from '@/lib/federis/useFederisPath';
import {
  FedSectionTitle,
  FedStagger,
  FedStaggerItem,
  FedFadeIn,
  FedCountUp,
  FedAnimatedUnderline,
  FedPingDot,
} from '../federis/federis-motion';

export default function PatronatExamensLanding() {
  const { path: federisPath } = useFederisPath();

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <FederisHeader />

      {/* ═══════════════ HERO (ADN WinAgro : couches, grain, vagues échelonnées) ═══════════════ */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden bg-[#0b1d3a] pt-28 pb-24">
        {/* Couches de fond : dégradés dynamiques superposés (ADN WinAgro) */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0b1d3a]/95 via-[#0b1d3a]/85 to-[#071528]/95 mix-blend-multiply" />

          {/* Cercles lumineux flottants */}
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[110px] fed-animate-float" />
          <div className="absolute bottom-10 right-10 w-[480px] h-[480px] bg-amber-500/8 rounded-full blur-[150px] fed-animate-float-delayed" />
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-blue-400/10 rounded-full blur-[90px] fed-animate-float" style={{ animationDelay: '1s' }} />

          {/* Grain SVG (bruit de luxe — ADN WinAgro) */}
          <svg
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none mix-blend-overlay"
          >
            <filter id="fedNoise">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#fedNoise)" />
          </svg>

          {/* Texture pointillée */}
          <div className="absolute inset-0 fed-grain-light opacity-[0.08] mix-blend-overlay" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Badge pilule avec point ping (ADN WinAgro) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-amber-300 font-bold text-xs uppercase tracking-[0.2em] mb-8"
          >
            <FedPingDot />
            L&rsquo;espace numérique des patronats scolaires
          </motion.div>

          {/* Titre révélé par vagues échelonnées (ADN WinAgro) */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-8 leading-[1.1] tracking-tight">
            <motion.span
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
              className="block"
            >
              Coordonnez votre patronat.
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35, ease: 'easeOut' }}
              className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500"
            >
              Organisez vos examens
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55, ease: 'easeOut' }}
              className="block mt-2"
            >
              avec{' '}
              <FedAnimatedUnderline className="text-amber-400 font-black">méthode</FedAnimatedUnderline>
              .
            </motion.span>
          </h1>

          {/* Sous-titre */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.75, ease: 'easeOut' }}
            className="text-lg md:text-xl text-blue-100/80 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Academia Federis accompagne les patronats dans la coordination de leurs écoles membres
            et la préparation des examens nationaux : inscriptions, candidats, centres de
            composition, surveillance, délibérations et publication des résultats.
          </motion.p>

          {/* CTA — or pulsé avec shimmer + fantôme verre (ADN WinAgro) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9, ease: 'easeOut' }}
            className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6"
          >
            <motion.div
              whileHover={{ scale: 1.05, boxShadow: '0px 12px 30px rgba(245, 158, 11, 0.45)' }}
              whileTap={{ scale: 0.97 }}
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ scale: { repeat: Infinity, duration: 2.6, ease: 'easeInOut' } }}
              className="w-full sm:w-auto"
            >
              <Link
                href={federisPath('/register')}
                prefetch={true}
                className="fed-btn-gold fed-btn-shimmer w-full sm:w-auto px-10 py-5 text-base"
              >
                Demander la création de mon espace
                <ArrowRight className="w-5 h-5 shrink-0" />
              </Link>
            </motion.div>
            <Link
              href={federisPath('/login')}
              prefetch={true}
              className="fed-btn-ghost w-full sm:w-auto px-10 py-5 text-base"
            >
              Accéder à Academia Federis
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.15 }}
            className="mt-10 text-sm text-blue-100/50 italic"
          >
            Une application dédiée au pilotage collectif des examens, par Academia Helm.
          </motion.p>
        </div>

        {/* Séparateur incliné (ADN WinAgro) */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-[#f7f9fc] fed-clip-slant" />
      </section>

      {/* ═══════════════ BANDE DE STATISTIQUES (compteurs animés — ADN Stats WinAgro) ═══════════════ */}
      <section className="py-20 bg-[#f7f9fc] relative overflow-hidden">
        {/* Accents d'arrière-plan flottants */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-80 h-80 bg-blue-100/50 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-96 h-96 bg-amber-100/40 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                value: 3,
                suffix: '',
                label: 'Niveaux d\u2019examens',
                subText: 'CM2, 3ème et Terminale — les classes à enjeux des patronats.',
                icon: <GraduationCap className="w-5 h-5" />,
              },
              {
                value: 5,
                suffix: '',
                label: 'Rôles structurés',
                subText: 'Coordonnateur, secrétaire, trésorier, organisateur, chargé de mission.',
                icon: <Network className="w-5 h-5" />,
              },
              {
                value: 6,
                suffix: '',
                label: 'Étapes coordonnées',
                subText: 'De la configuration de la session à la publication des résultats.',
                icon: <AppIcon name="exams" size="menu" />,
              },
              {
                value: 100,
                suffix: '%',
                label: 'Traçabilité',
                subText: 'Chaque opération sensible est consignée et attribuée à un responsable.',
                icon: <ShieldCheck className="w-5 h-5" />,
              },
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1, ease: 'easeOut' }}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="relative p-8 rounded-3xl bg-white border border-blue-100 shadow-lg hover:shadow-xl hover:border-blue-300/50 transition-all duration-300 flex flex-col justify-between h-full group fed-card-shimmer"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-5xl font-black text-[#0b1d3a] tracking-tight group-hover:text-[#1e3a8a] transition-colors duration-300">
                      <FedCountUp value={stat.value} suffix={stat.suffix} />
                    </span>
                    <div className="w-10 h-10 bg-[#eff6ff] text-[#1e3a8a] rounded-xl flex items-center justify-center">
                      {stat.icon}
                    </div>
                  </div>
                  {/* Liseré or qui s'étend au survol (ADN Stats WinAgro) */}
                  <div className="w-12 h-1 bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] rounded-full mb-4 group-hover:w-20 transition-all duration-300" />
                  <h3 className="font-bold text-lg text-[#0b1d3a] tracking-wide mb-2">
                    {stat.label}
                  </h3>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{stat.subText}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ LES ENJEUX (cartes numérotées — ADN WhyUs WinAgro) ═══════════════ */}
      <section className="py-24 bg-white relative overflow-hidden">
        {/* Accent flou décoratif */}
        <div className="absolute bottom-10 right-0 w-72 h-72 bg-blue-50 rounded-full blur-3xl opacity-60 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <FedSectionTitle
            badge="Les enjeux"
            title={
              <>
                Quand plusieurs écoles préparent une même session,{' '}
                <span className="text-[#1e3a8a]">la coordination fait la différence.</span>
              </>
            }
            subtitle="Suivre les inscriptions, répartir les candidats, préparer les centres de composition et consolider les résultats demande une information fiable et partagée. Academia Federis donne aux responsables du patronat un espace commun pour organiser ces opérations et suivre les étapes importantes de chaque session."
          />

          <FedStagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
            {[
              {
                num: '01',
                tag: 'INFORMATION',
                title: 'Des informations dispersées',
                desc: 'Rassemblez les informations utiles des écoles membres dans un cadre de travail commun.',
                icon: 'network',
              },
              {
                num: '02',
                tag: 'INSCRIPTIONS',
                title: 'Des inscriptions difficiles à consolider',
                desc: 'Suivez les dossiers des candidats, les pièces attendues et les corrections à apporter.',
                icon: 'user',
              },
              {
                num: '03',
                tag: 'LOGISTIQUE',
                title: 'Une logistique exigeante',
                desc: 'Préparez les centres, salles, affectations et listes de surveillance.',
                icon: 'building',
              },
              {
                num: '04',
                tag: 'PILOTAGE',
                title: 'Un suivi à renforcer',
                desc: 'Visualisez l\u2019avancement de la session et les points qui demandent une décision.',
                icon: 'dashboard',
              },
            ].map((f) => (
              <FedStaggerItem key={f.num}>
                <motion.div
                  whileHover={{
                    y: -6,
                    scale: 1.02,
                    borderColor: 'rgba(30, 58, 138, 0.25)',
                    boxShadow:
                      '0 20px 25px -5px rgba(11, 29, 58, 0.08), 0 8px 10px -6px rgba(11, 29, 58, 0.08)',
                  }}
                  className="bg-[#f7f9fc]/50 border border-blue-100 rounded-2xl p-6 shadow-sm transition-all duration-300 flex flex-col h-full fed-card-shimmer"
                >
                  <div className="relative mb-5">
                    <div className="w-12 h-12 bg-[#eff6ff] rounded-xl flex items-center justify-center">
                      <AppIcon name={f.icon as any} size="menu" className="text-[#1e3a8a]" />
                    </div>
                    {/* Numéro de carte — badge coin (ADN WhyUs WinAgro) */}
                    <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-sm text-[10px] font-black text-[#1e3a8a] shadow-sm border border-blue-100">
                      {f.num}
                    </span>
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a] mb-2">
                    {f.tag}
                  </p>
                  <h3 className="text-base font-bold text-[#0b1d3a] mb-2.5 leading-tight">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              </FedStaggerItem>
            ))}
          </FedStagger>
        </div>
      </section>

      {/* ═══ FONCTIONNALITÉS (section sombre navy + grain — ADN WinAgro) ═══ */}
      <section
        id="fonctionnalites"
        className="py-24 bg-[#071528] px-4 sm:px-6 lg:px-8 scroll-mt-20 relative overflow-hidden"
      >
        {/* Cercles lumineux flottants */}
        <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-blue-600/10 rounded-full blur-[110px] pointer-events-none fed-animate-float" />
        <div className="absolute bottom-20 left-0 w-[320px] h-[320px] bg-amber-500/6 rounded-full blur-[90px] pointer-events-none fed-animate-float-delayed" />
        <div className="absolute inset-0 fed-grain-light opacity-[0.06] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <FedSectionTitle
            dark
            badge="Fonctionnalités"
            title={
              <>
                Les opérations du patronat,{' '}
                <span className="text-amber-400">réunies dans un même espace.</span>
              </>
            }
          />

          <FedStagger className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
            {[
              {
                title: 'Écoles membres',
                desc: 'Suivez les demandes de rattachement, les établissements participants et les informations partagées pour chaque session.',
                icon: 'building',
              },
              {
                title: 'Inscriptions et candidats',
                desc: 'Centralisez les dossiers d\u2019inscription, repérez les informations manquantes et préparez les matricules et numéros de table.',
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
                desc: 'Consultez des indicateurs de préparation, d\u2019inscription et d\u2019organisation. Exportez les rapports.',
                icon: 'grades',
              },
            ].map((f, i) => (
              <FedStaggerItem key={i}>
                <motion.div
                  whileHover={{ y: -8, borderColor: 'rgba(251, 191, 36, 0.3)', backgroundColor: 'rgba(15, 36, 68, 0.75)' }}
                  className="bg-[#0f2444]/55 border border-blue-400/12 p-7 rounded-2xl transition-all duration-300 h-full fed-card-shimmer"
                >
                  <div className="w-12 h-12 bg-amber-500/15 rounded-xl flex items-center justify-center mb-6">
                    <AppIcon name={f.icon as any} size="menu" className="text-amber-400" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-3">{f.title}</h3>
                  <p className="text-blue-100/60 text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              </FedStaggerItem>
            ))}
          </FedStagger>
        </div>
      </section>

      {/* ═══════════════ PROCESSUS (étapes numérotées) ═══════════════ */}
      <section id="processus" className="py-24 bg-[#f7f9fc] px-4 sm:px-6 lg:px-8 scroll-mt-20 relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100/40 rounded-full blur-[110px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <FedSectionTitle
            badge="Processus"
            title={
              <>
                Une session organisée <span className="text-[#1e3a8a]">étape par étape.</span>
              </>
            }
          />

          <FedStagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
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
            ].map((s) => (
              <FedStaggerItem key={s.step}>
                <motion.div
                  whileHover={{ y: -6, borderColor: 'rgba(30, 58, 138, 0.25)' }}
                  className="bg-white border border-blue-100 p-8 rounded-2xl shadow-sm transition-all duration-300 h-full fed-card-shimmer"
                >
                  <div className="flex items-center space-x-4 mb-5">
                    {/* Numéro d'étape dans une pastille or (ADN WinAgro) */}
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] text-[#0b1d3a] font-black flex items-center justify-center text-sm flex-shrink-0 shadow-md shadow-amber-500/30">
                      {s.step}
                    </div>
                    <h3 className="text-base font-bold text-[#0b1d3a]">{s.title}</h3>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed pl-[60px]">{s.desc}</p>
                </motion.div>
              </FedStaggerItem>
            ))}
          </FedStagger>
        </div>
      </section>

      {/* ═══════════════ INTÉGRATION ACADEMIA HELM ═══════════════ */}
      <section className="py-24 bg-white px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="bg-gradient-to-br from-[#1e3a8a] to-[#0b1d3a] rounded-[40px] p-10 md:p-16 relative overflow-hidden shadow-2xl fed-card-shimmer"
          >
            {/* Décors flottants internes */}
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-400/10 rounded-full blur-[90px] fed-animate-float pointer-events-none" />
            <div className="absolute -bottom-24 -left-16 w-72 h-72 bg-amber-500/8 rounded-full blur-[80px] fed-animate-float-delayed pointer-events-none" />
            <div className="absolute inset-0 fed-grain-light opacity-[0.05] pointer-events-none" />

            <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-400/30 text-amber-300 px-4 py-1.5 rounded-full text-xs font-bold tracking-[0.15em] uppercase mb-6"
                >
                  <Network className="w-3.5 h-3.5" />
                  Interopérabilité
                </motion.div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-6 leading-tight">
                  En lien avec l&rsquo;écosystème{' '}
                  <FedAnimatedUnderline className="text-amber-400">Academia Helm</FedAnimatedUnderline>.
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
                <motion.div whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                  <Link
                    href="/contact?subject=integration-federis"
                    className="inline-flex items-center gap-2 text-amber-400 font-bold hover:text-amber-300 transition-colors"
                  >
                    Découvrir l&rsquo;intégration Academia Helm
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              </div>

              {/* Panneau verre (ADN glassmorphism WinAgro) */}
              <div className="flex justify-center">
                <div className="relative w-full max-w-sm">
                  <div className="absolute inset-0 bg-amber-500 rounded-full blur-[80px] opacity-15 fed-animate-pulse-slow" />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    whileHover={{ y: -6 }}
                    className="relative fed-glass-dark p-8 rounded-[32px]"
                  >
                    <div className="flex items-center justify-between mb-8">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#3b82f6] to-[#1e3a8a] rounded-xl flex items-center justify-center shadow-lg">
                        <AppIcon name="network" size="menu" className="text-white" />
                      </div>
                      <span className="text-[10px] font-bold text-blue-100/50 uppercase tracking-widest">
                        Écosystème Academia
                      </span>
                    </div>
                    <div className="space-y-4">
                      {['Écoles membres', 'Effectifs des classes d\u2019examen', 'Candidats concernés'].map(
                        (item, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -14 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.4, delay: 0.3 + i * 0.12 }}
                          className="flex items-center space-x-4"
                        >
                          <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <AppIcon name="check" size="action" className="text-amber-400" />
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-bold text-white/90 mb-1.5">{item}</div>
                            <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                whileInView={{ width: `${65 + i * 12}%` }}
                                viewport={{ once: true }}
                                transition={{ duration: 1, delay: 0.5 + i * 0.15, ease: 'easeOut' }}
                                className="h-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] rounded-full"
                              />
                            </div>
                          </div>
                        </motion.div>
                        ),
                      )}
                    </div>
                    <div className="mt-8 pt-6 border-t border-white/10 text-center">
                      <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">
                        Accès contrôlé, selon l&rsquo;autorisation de l&rsquo;école
                      </span>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════ SÉCURITÉ ET TRAÇABILITÉ ═══════════════ */}
      <section id="securite" className="py-24 bg-[#f7f9fc] px-4 sm:px-6 lg:px-8 scroll-mt-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[380px] h-[380px] bg-blue-100/40 rounded-full blur-[110px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FedFadeIn>
              <div className="fed-badge mb-5">Sécurité et traçabilité</div>
              <h2 className="text-3xl md:text-4xl font-black text-[#0b1d3a] mb-6 leading-tight">
                Des accès adaptés aux{' '}
                <span className="text-[#1e3a8a]">responsabilités de chacun.</span>
              </h2>
              <motion.div
                animate={{
                  scaleX: [0, 1, 1, 0],
                  transformOrigin: ['0% 50%', '0% 50%', '100% 50%', '100% 50%'],
                }}
                transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: 'easeInOut' }}
                className="fed-separator mb-8"
              />
              <p className="text-lg text-slate-500 mb-10 leading-relaxed">
                Les opérations d&rsquo;un patronat impliquent des données et des documents qui ne
                doivent pas être accessibles indistinctement. Academia Federis est conçu pour
                organiser les accès par rôle, suivre les opérations importantes et soutenir le
                contrôle humain des décisions liées aux examens.
              </p>
              <motion.div whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <Link
                  href="/contact?subject=securite-federis"
                  className="inline-flex items-center gap-2 text-[#1e3a8a] font-bold hover:text-[#0b1d3a] transition-colors"
                >
                  En savoir plus sur nos engagements
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </FedFadeIn>

            <FedStagger className="space-y-4">
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
                <FedStaggerItem key={i}>
                  <motion.div
                    whileHover={{ x: 6, borderColor: 'rgba(30, 58, 138, 0.25)' }}
                    className="flex items-center space-x-5 bg-white border border-blue-100 p-6 rounded-2xl shadow-sm transition-all duration-300 fed-card-shimmer"
                  >
                    <div className="w-11 h-11 bg-[#eff6ff] rounded-xl flex items-center justify-center flex-shrink-0">
                      <AppIcon name={item.icon as any} size="menu" className="text-[#1e3a8a]" />
                    </div>
                    <p className="text-slate-700 font-semibold leading-snug">{item.title}</p>
                  </motion.div>
                </FedStaggerItem>
              ))}
            </FedStagger>
          </div>
        </div>
      </section>

      {/* ═══════════════ OFFRES (carte premium couronnée — ADN Services WinAgro) ═══════════════ */}
      <section id="offres" className="py-24 bg-white px-4 sm:px-6 lg:px-8 scroll-mt-20 relative overflow-hidden">
        <div className="absolute bottom-20 left-0 w-80 h-80 bg-amber-100/30 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <FedSectionTitle
            badge="Nos offres"
            title={
              <>
                Deux formules pour accompagner{' '}
                <span className="text-[#1e3a8a]">votre patronat.</span>
              </>
            }
            subtitle="Choisissez l&rsquo;offre adaptée au nombre d&rsquo;écoles membres et aux campagnes que vous coordonnez. Les prix sont proposés par année scolaire."
          />

          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto mt-16">
            {/* Federis Essentiel — carte claire */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              whileHover={{
                y: -10,
                scale: 1.02,
                borderColor: 'rgba(30, 58, 138, 0.3)',
                boxShadow: '0 20px 25px -5px rgba(11, 29, 58, 0.1), 0 8px 10px -6px rgba(11, 29, 58, 0.1)',
              }}
              className="relative p-10 rounded-3xl border-2 border-blue-100 bg-white shadow-lg transition-all duration-300 fed-card-shimmer flex flex-col"
            >
              <h3 className="text-2xl font-black text-[#0b1d3a]">Federis Essentiel</h3>
              <p className="text-slate-500 text-sm mt-2 mb-8">
                Pour les patronats qui structurent leurs premières campagnes d&rsquo;examens.
              </p>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-5xl font-black text-[#0b1d3a] tracking-tight">100 000</span>
                <span className="text-slate-500 font-semibold">FCFA / année scolaire</span>
              </div>
              <div className="w-12 h-1 bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] rounded-full mb-6" />
              <ul className="space-y-4 mb-10 flex-1">
                {[
                  "Jusqu'à 5 écoles membres",
                  "Jusqu'à 500 candidatures validées par année scolaire",
                  '1 campagne active à la fois',
                  'Inscriptions, import de candidats, centres et salles, listes et suivi des résultats',
                  "Contrôle des accès par rôle et traçabilité des opérations importantes",
                ].map((f, fi) => (
                  <li key={fi} className="flex items-start space-x-3">
                    <div className="w-5 h-5 bg-[#eff6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AppIcon name="check" size="action" className="text-[#1e3a8a]" />
                    </div>
                    <span className="text-slate-600 text-sm leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/contact?subject=demo-federis-essentiel"
                className="fed-btn-navy w-full py-4 text-base"
              >
                Demander une démonstration
              </Link>
            </motion.div>

            {/* Federis Institution — carte premium cerclée or (ADN premium WinAgro) */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.12, ease: 'easeOut' }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="relative h-full"
            >
              {/* Badge couronne premium — posé sur le bord supérieur, à l’extérieur
                  du cadre : fed-card-shimmer rogne ses enfants (overflow:hidden),
                  le badge vit donc dans ce wrapper non rognant (ADN WinAgro) */}
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20 px-4 py-1 rounded-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#0b1d3a] font-black text-xs uppercase tracking-widest shadow-md flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 shrink-0" /> Recommandée
              </div>

              <motion.div
                whileHover={{
                  borderColor: 'rgba(245, 158, 11, 0.55)',
                  boxShadow: '0 24px 32px -8px rgba(245, 158, 11, 0.25)',
                }}
                className="p-10 rounded-3xl border-2 border-amber-500 shadow-2xl shadow-amber-500/15 bg-gradient-to-b from-white to-amber-50/40 transition-all duration-300 fed-card-shimmer flex flex-col h-full"
              >
                <h3 className="text-2xl font-black text-[#0b1d3a]">Federis Institution</h3>
                <p className="text-slate-500 text-sm mt-2 mb-8">
                  Pour les patronats qui coordonnent plusieurs établissements, centres et équipes.
                </p>
                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-5xl font-black text-[#0b1d3a] tracking-tight">250 000</span>
                  <span className="text-slate-500 font-semibold">FCFA / année scolaire</span>
                </div>
                <div className="w-12 h-1 bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] rounded-full mb-6" />
                <ul className="space-y-4 mb-10 flex-1">
                  {[
                    "Jusqu'à 25 écoles membres",
                    "Jusqu'à 3 000 candidatures validées par année scolaire",
                    "Jusqu'à 3 campagnes actives simultanément",
                    'Toutes les fonctions d\u2019Essentiel, plus pilotage multi-campagnes et rapports étendus',
                    'Banque d\u2019épreuves avec gestion des versions et des droits d\u2019accès',
                    'Prise en main assistée et traitement prioritaire des demandes',
                  ].map((f, fi) => (
                    <li key={fi} className="flex items-start space-x-3">
                      <div className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AppIcon name="check" size="action" className="text-amber-600" />
                      </div>
                      <span className="text-slate-600 text-sm leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ scale: { repeat: Infinity, duration: 2.4, ease: 'easeInOut' } }}
                >
                  <Link
                    href="/contact?subject=demo-federis-institution"
                    className="fed-btn-gold fed-btn-shimmer w-full py-4 text-base"
                  >
                    Parler à notre équipe
                  </Link>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-10 max-w-3xl mx-auto leading-relaxed">
            Tarifs et capacités proposés à titre de cadrage, par entité souscriptrice. Les mesures
            de sécurité fondamentales, le cloisonnement des patronats et la protection des documents
            s&rsquo;appliquent aux deux offres. Au-delà des capacités prévues, un devis est établi
            dans le cadre de l&rsquo;offre Institution.
          </p>
        </div>
      </section>

      {/* ═══════════════ APPEL FINAL (couche sombre + lueurs flottantes) ═══════════════ */}
      <section className="py-24 bg-[#0b1d3a] px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-25%] left-[15%] w-full h-full bg-blue-600/15 rounded-full blur-[150px] fed-animate-float" />
          <div className="absolute bottom-[-30%] right-[10%] w-96 h-96 bg-amber-500/10 rounded-full blur-[130px] fed-animate-float-delayed" />
          <div className="absolute inset-0 fed-grain-light opacity-[0.06]" />
        </div>

        {/* Séparateur incliné supérieur */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-white fed-clip-slant-reverse" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <FedFadeIn>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">
              Préparez votre prochaine session avec une organisation{' '}
              <FedAnimatedUnderline className="text-amber-400">mieux coordonnée</FedAnimatedUnderline>.
            </h2>
            <p className="text-lg text-blue-100/70 mb-10 max-w-2xl mx-auto">
              Découvrez comment Academia Federis peut accompagner votre patronat, de la mobilisation
              des écoles membres à la publication des résultats.
            </p>
          </FedFadeIn>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6"
          >
            <motion.div
              whileHover={{ scale: 1.05, boxShadow: '0px 12px 30px rgba(245, 158, 11, 0.45)' }}
              whileTap={{ scale: 0.97 }}
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ scale: { repeat: Infinity, duration: 2.6, ease: 'easeInOut' } }}
              className="w-full sm:w-auto"
            >
              <Link
                href={federisPath('/register')}
                className="fed-btn-gold fed-btn-shimmer w-full sm:w-auto px-10 py-5 text-base"
              >
                Demander la création de mon espace
              </Link>
            </motion.div>
            <Link href="/contact?subject=demo-federis" className="fed-btn-ghost w-full sm:w-auto px-10 py-5 text-base">
              Contacter l&rsquo;équipe
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════ CONTACT (cartes verre institutionnelles) ═══════════════ */}
      <section className="py-24 bg-white px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-10 left-0 w-72 h-72 bg-blue-50 rounded-full blur-3xl opacity-60 pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10">
          <FedSectionTitle
            badge="Contact"
            title={
              <>
                Parlons de votre patronat <span className="text-[#1e3a8a]">et de vos examens.</span>
              </>
            }
            subtitle="Présentez-nous votre organisation, le nombre d&rsquo;écoles concernées et les étapes que vous souhaitez mieux coordonner. Notre équipe vous orientera vers la formule et le parcours adaptés."
          />

          <FedStagger className="grid sm:grid-cols-3 gap-6 mt-14">
            {[
              {
                icon: 'mail',
                label: 'Courriel',
                value: 'support@academiahelm.com',
                href: 'mailto:support@academiahelm.com',
              },
              {
                icon: 'phone',
                label: 'Téléphone',
                value: '+229 01 41 36 08 03',
                href: 'tel:+2290141360803',
              },
              {
                icon: 'globe',
                label: 'Localisation',
                value: 'Parakou, Bénin — Afrique de l\u2019Ouest',
                href: null,
              },
            ].map((c, i) => (
              <FedStaggerItem key={i}>
                <motion.div
                  whileHover={{ y: -6, borderColor: 'rgba(30, 58, 138, 0.25)' }}
                  className="text-center p-8 bg-[#f7f9fc] rounded-2xl border border-blue-100 h-full transition-all duration-300 fed-card-shimmer"
                >
                  <div className="w-12 h-12 mx-auto bg-[#eff6ff] rounded-xl flex items-center justify-center mb-4">
                    <AppIcon name={c.icon as any} size="menu" className="text-[#1e3a8a]" />
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    {c.label}
                  </div>
                  {c.href ? (
                    <a
                      href={c.href}
                      className="text-[#1e3a8a] font-bold hover:text-[#0b1d3a] transition-colors break-all"
                    >
                      {c.value}
                    </a>
                  ) : (
                    <span className="text-[#1e3a8a] font-bold">{c.value}</span>
                  )}
                </motion.div>
              </FedStaggerItem>
            ))}
          </FedStagger>
        </div>
      </section>

      {/* ═══════════════ PIED DE PAGE INSTITUTIONNEL (ADN Footer WinAgro) ═══════════════ */}
      <footer className="bg-[#071528] text-blue-100/70 border-t-4 border-amber-500/80 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Grain décoratif */}
        <div className="absolute inset-0 fed-grain-light opacity-[0.04] pointer-events-none" />

        <div className="max-w-7xl mx-auto py-16 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Marque */}
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="fed-logo-beam w-14 h-14 flex items-center justify-center p-1 shadow-md">
                  <Image
                    src="/images/logo-Academia Hub.webp"
                    alt="Academia Federis — par Academia Helm"
                    width={44}
                    height={44}
                    className="h-11 w-11 object-contain rounded-full"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-black leading-tight text-white tracking-wide">
                    Academia Federis
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400">
                    Par Academia Helm
                  </span>
                </div>
              </div>
              <p className="text-sm text-blue-100/50 leading-relaxed max-w-md">
                L&rsquo;application dédiée à la coordination des patronats scolaires et des examens
                nationaux — fédérer les écoles, organiser les examens, piloter la réussite.
              </p>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link href={federisPath('/register')} className="fed-btn-gold fed-btn-shimmer px-6 py-3 text-sm">
                  Créer un espace patronat →
                </Link>
              </motion.div>
            </div>

            {/* Navigation */}
            <div>
              <h3 className="text-white text-sm font-black tracking-widest uppercase mb-6 border-b border-blue-400/20 pb-2">
                Navigation
              </h3>
              <ul className="space-y-4 text-sm">
                <li>
                  <a href="#fonctionnalites" className="hover:text-amber-400 transition-colors duration-200">
                    Fonctionnalités
                  </a>
                </li>
                <li>
                  <a href="#processus" className="hover:text-amber-400 transition-colors duration-200">
                    Organisation des examens
                  </a>
                </li>
                <li>
                  <a href="#securite" className="hover:text-amber-400 transition-colors duration-200">
                    Sécurité et traçabilité
                  </a>
                </li>
                <li>
                  <a href="#offres" className="hover:text-amber-400 transition-colors duration-200">
                    Offres
                  </a>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-amber-400 transition-colors duration-200">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-14 pt-8 border-t border-blue-400/10 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-blue-100/40">
              © {new Date().getFullYear()} Academia Helm. Tous droits réservés.
            </p>
            <div className="flex gap-6">
              <Link
                href="/legal/terms"
                className="text-xs text-blue-100/40 hover:text-amber-400 transition-colors"
              >
                Conditions d&rsquo;utilisation
              </Link>
              <Link
                href="/legal/privacy"
                className="text-xs text-blue-100/40 hover:text-amber-400 transition-colors"
              >
                Confidentialité
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

