/**
 * Modules Page Component
 * 
 * Page dédiée présentant tous les modules d'Academia Helm
 * Design moderne et professionnel
 */

'use client';

import PremiumHeader from '../layout/PremiumHeader';
import InstitutionalFooter from './InstitutionalFooter';
import AppIcon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { bgColor, textColor, typo, radius, shadow } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

export default function ModulesPage() {
  return (
    <div className="min-h-screen bg-white">
      <PremiumHeader />
      <div className="h-20" />
      
      {/* Hero Section */}
      <section className="py-32 bg-gradient-to-b from-white to-cloud px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 right-10 w-96 h-96 bg-gold-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-80 h-80 bg-blue-600 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <div className="inline-flex items-center justify-center px-6 py-2.5 bg-gradient-to-r from-blue-50 to-blue-100 rounded-full mb-8 shadow-sm border border-blue-200">
              <span className={`${typo('caption')} text-blue-900 font-bold uppercase tracking-wider`}>
                Modules Complets
              </span>
            </div>
            <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold ${textColor('primary')} mb-8 leading-tight`}>
              Tous les modules essentiels.<br />
              <span className="text-blue-900 relative inline-block">
                <span className="relative z-10">Sans compromis</span>
                <span className="absolute bottom-0 left-0 right-0 h-3 bg-blue-900/10 -rotate-1"></span>
              </span>.
          </h1>
            <p className={`${typo('large')} ${textColor('secondary')} max-w-3xl mx-auto mb-16 text-lg`}>
              Academia Helm intègre l'ensemble des modules nécessaires
              à une gestion scolaire moderne et rigoureuse.
          </p>
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section className="py-24 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Modules Principaux */}
          <div className="mb-20">
            <div className="flex items-center justify-center mb-12">
              <div className="h-0.5 bg-gradient-to-r from-transparent via-blue-300 to-transparent flex-1 max-w-40"></div>
              <h2 className={`${typo('h2')} ${textColor('primary')} mx-6 font-bold`}>
                Modules Principaux
              </h2>
              <div className="h-0.5 bg-gradient-to-l from-transparent via-blue-300 to-transparent flex-1 max-w-40"></div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { 
                  name: 'Tableau de Bord Central', 
                  icon: 'dashboard' as const, 
                  description: 'Métriques en temps réel : effectifs, revenus, taux de réussite. Graphiques de performance, notifications intelligentes, calendrier intégré, accès rapide à tous les modules.' 
                },
                { 
                  name: 'Gestion des Élèves et Scolarité', 
                  icon: 'scolarite' as const, 
                  description: 'Inscription et admission, organisation des classes, suivi des absences, gestion disciplinaire, transferts de classe, génération de documents (certificats, attestations, trombinoscopes).' 
                },
                { 
                  name: 'Gestion Financière et Économat', 
                  icon: 'finance' as const, 
                  description: 'Configuration des frais par niveau, gestion des paiements (espèces, virement, Mobile Money), contrôle de scolarité, gestion des dépenses, clôture quotidienne, trésorerie.' 
                },
                { 
                  name: 'Planification et Études', 
                  icon: 'classes' as const, 
                  description: 'Gestion des salles, catalogue des matières, assignation des enseignants, génération automatique des emplois du temps, cahier journal, fiches pédagogiques, cahier de textes.' 
                },
                { 
                  name: 'Examens et Évaluation', 
                  icon: 'exams' as const, 
                  description: 'Saisie des notes, génération automatique des bulletins, bordereaux de notes, conseils de classe, tableaux d\'honneur, statistiques et analyses de performance.' 
                },
                { 
                  name: 'Gestion du Personnel et RH', 
                  icon: 'rh' as const, 
                  description: 'Fiches de personnel complètes, gestion des contrats (CDI, CDD, Vacation), évaluations et formations, calcul automatique de la paie, statistiques RH.' 
                },
                { 
                  name: 'Communication', 
                  icon: 'communication' as const, 
                  description: 'SMS et notifications en masse, campagnes email, intégration WhatsApp Business, notifications push, analytics de communication avec métriques de performance.' 
                },
              ].map((module, index) => {
                // Couleurs spécifiques et attrayantes pour chaque module
                const iconColors: Record<string, { from: string; to: string; icon: string; border: string }> = {
                  dashboard: { from: 'from-blue-500', to: 'to-blue-600', icon: 'text-blue-600', border: 'hover:border-blue-400' },
                  scolarite: { from: 'from-purple-500', to: 'to-purple-600', icon: 'text-purple-600', border: 'hover:border-purple-400' },
                  finance: { from: 'from-green-500', to: 'to-green-600', icon: 'text-green-600', border: 'hover:border-green-400' },
                  classes: { from: 'from-orange-500', to: 'to-orange-600', icon: 'text-orange-600', border: 'hover:border-orange-400' },
                  exams: { from: 'from-red-500', to: 'to-red-600', icon: 'text-red-600', border: 'hover:border-red-400' },
                  rh: { from: 'from-indigo-500', to: 'to-indigo-600', icon: 'text-indigo-600', border: 'hover:border-indigo-400' },
                  communication: { from: 'from-pink-500', to: 'to-pink-600', icon: 'text-pink-600', border: 'hover:border-pink-400' },
                };
                const colors = iconColors[module.icon] || { from: 'from-blue-500', to: 'to-blue-600', icon: 'text-blue-600', border: 'hover:border-blue-400' };
                
                return (
                  <div
                    key={index}
                    className={cn(
                      bgColor('card'),
                      'p-8 rounded-2xl border-2 border-gray-200',
                      'shadow-lg hover:shadow-2xl',
                      colors.border,
                      'hover:-translate-y-2',
                      'transition-all duration-300 ease-out',
                      'group cursor-pointer',
                      'bg-white hover:bg-gradient-to-br hover:from-white hover:to-blue-50/30'
                    )}
                  >
                    <div className={cn(
                      'w-16 h-16 bg-gradient-to-br rounded-2xl flex items-center justify-center mb-6',
                      'shadow-lg group-hover:shadow-xl',
                      'group-hover:scale-110 group-hover:rotate-3',
                      'transition-all duration-300',
                      colors.from,
                      colors.to
                    )}>
                      <AppIcon name={module.icon} size="menu" className="text-white group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <h3 className={cn(
                      typo('base'),
                      textColor('primary'),
                      'font-bold mb-3 leading-tight transition-colors duration-300',
                      `group-hover:${colors.icon}`
                    )}>
                      {module.name}
                    </h3>
                    <p className={`${typo('small')} ${textColor('secondary')} text-sm leading-relaxed`}>
                      {module.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modules Supplémentaires */}
          <div className="mb-16">
            <div className="flex items-center justify-center mb-12">
              <div className="h-0.5 bg-gradient-to-r from-transparent via-blue-300 to-transparent flex-1 max-w-40"></div>
              <h2 className={`${typo('h2')} ${textColor('primary')} mx-6 font-bold`}>
                Modules Supplémentaires
              </h2>
              <div className="h-0.5 bg-gradient-to-l from-transparent via-blue-300 to-transparent flex-1 max-w-40"></div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { 
                  name: 'Bibliothèque', 
                  icon: 'library' as const, 
                  description: 'Gestion du catalogue des livres, système de prêts et retours, fichier des lecteurs, rappels automatiques, statistiques d\'emprunt.' 
                },
                { 
                  name: 'Laboratoire', 
                  icon: 'laboratory' as const, 
                  description: 'Gestion des équipements, réservations des laboratoires, inventaire automatique, maintenance programmée, planning d\'occupation.' 
                },
                { 
                  name: 'Transport', 
                  icon: 'transport' as const, 
                  description: 'Gestion des véhicules, itinéraires et conducteurs, suivi des trajets, maintenance préventive, planning des transports.' 
                },
                { 
                  name: 'Cantine', 
                  icon: 'canteen' as const, 
                  description: 'Gestion des repas, menus personnalisables, inscriptions des élèves, paiements intégrés, rapports de fréquentation.' 
                },
                { 
                  name: 'Infirmerie', 
                  icon: 'infirmary' as const, 
                  description: 'Dossiers médicaux des élèves, visites médicales, médicaments disponibles, urgences et alertes, rapports médicaux.' 
                },
                { 
                  name: 'QHSE (Qualité, Hygiène, Sécurité)', 
                  icon: 'qhse' as const, 
                  description: 'Inspections régulières, incidents et rapports, formations sécurité, plans d\'action, conformité réglementaire.' 
                },
                { 
                  name: 'EduCast (Diffusion de Contenu)', 
                  icon: 'educast' as const, 
                  description: 'Diffusion de contenu éducatif, streaming en direct, podcasts et webinaires, archivage des contenus, analytics d\'écoute.' 
                },
                { 
                  name: 'Boutique', 
                  icon: 'shop' as const, 
                  description: 'Vente de fournitures scolaires, gestion des stocks, commandes en ligne, comptabilité intégrée, rapports de vente.' 
                },
              ].map((module, index) => {
                // Couleurs spécifiques et attrayantes pour chaque module supplémentaire
                const iconColors: Record<string, { from: string; to: string; icon: string; border: string }> = {
                  library: { from: 'from-amber-500', to: 'to-amber-600', icon: 'text-amber-600', border: 'hover:border-amber-400' },
                  laboratory: { from: 'from-cyan-500', to: 'to-cyan-600', icon: 'text-cyan-600', border: 'hover:border-cyan-400' },
                  transport: { from: 'from-teal-500', to: 'to-teal-600', icon: 'text-teal-600', border: 'hover:border-teal-400' },
                  canteen: { from: 'from-yellow-500', to: 'to-yellow-600', icon: 'text-yellow-600', border: 'hover:border-yellow-400' },
                  infirmary: { from: 'from-rose-500', to: 'to-rose-600', icon: 'text-rose-600', border: 'hover:border-rose-400' },
                  qhse: { from: 'from-emerald-500', to: 'to-emerald-600', icon: 'text-emerald-600', border: 'hover:border-emerald-400' },
                  educast: { from: 'from-violet-500', to: 'to-violet-600', icon: 'text-violet-600', border: 'hover:border-violet-400' },
                  shop: { from: 'from-fuchsia-500', to: 'to-fuchsia-600', icon: 'text-fuchsia-600', border: 'hover:border-fuchsia-400' },
                };
                const colors = iconColors[module.icon] || { from: 'from-blue-500', to: 'to-blue-600', icon: 'text-blue-600', border: 'hover:border-blue-400' };
                
                return (
                  <div
                    key={index}
                    className={cn(
                      bgColor('card'),
                      'p-8 rounded-2xl border-2 border-gray-200',
                      'shadow-lg hover:shadow-2xl',
                      colors.border,
                      'hover:-translate-y-2',
                      'transition-all duration-300 ease-out',
                      'group cursor-pointer',
                      'bg-white hover:bg-gradient-to-br hover:from-white hover:to-blue-50/30'
                    )}
                  >
                    <div className={cn(
                      'w-16 h-16 bg-gradient-to-br rounded-2xl flex items-center justify-center mb-6',
                      'shadow-lg group-hover:shadow-xl',
                      'group-hover:scale-110 group-hover:rotate-3',
                      'transition-all duration-300',
                      colors.from,
                      colors.to
                    )}>
                      <AppIcon name={module.icon} size="menu" className="text-white group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <h3 className={cn(
                      typo('base'),
                      textColor('primary'),
                      'font-bold mb-3 leading-tight transition-colors duration-300',
                      `group-hover:${colors.icon}`
                    )}>
                      {module.name}
            </h3>
                    <p className={`${typo('small')} ${textColor('secondary')} text-sm leading-relaxed`}>
                      {module.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Separator and Summary */}
          <div className="text-center pt-12 border-t border-gray-200 mt-16">
            <p className={`${typo('h2')} ${textColor('primary')} font-bold`}>
              Tous les modules sont inclus.
              <br />
              Aucune option cachée. Aucun bridage.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-32 ${bgColor('sidebar')} ${textColor('inverse')} px-4 sm:px-6 lg:px-8 relative overflow-hidden`}>
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 right-10 w-96 h-96 bg-gold-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-80 h-80 bg-blue-600 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-gold-500 to-gold-600 rounded-3xl mb-10 shadow-2xl border-2 border-gold-400/30">
            <AppIcon name="success" size="dashboard" className="text-white" />
          </div>
          <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-8 leading-tight`}>
            Tous les modules sont inclus.<br />
            <span className="text-gold-500">Aucune option cachée</span>.
          </h2>
          <p className={`${typo('large')} text-graphite-500 leading-relaxed text-lg max-w-3xl mx-auto mb-12`}>
              Lorsque vous activez Academia Helm, vous obtenez immédiatement l'accès à tous les 15 modules.
            Aucun supplément. Aucun bridage. Accès complet dès le premier jour.
            </p>
            <Link
              href="/signup"
            className="bg-blue-600 text-white px-12 py-5 rounded-subtle font-semibold hover:bg-blue-700 transition-all duration-300 inline-flex items-center justify-center text-lg shadow-xl hover:shadow-2xl hover:scale-105 gap-3"
            >
            <AppIcon name="userPlus" size="action" className="text-white" />
              Activer Academia Helm maintenant
            </Link>
          </div>
      </section>

      {/* Footer */}
      <div className="bg-blue-900 border-t-2 border-gold-500/20">
        <InstitutionalFooter />
        </div>
    </div>
  );
}
