/**
 * ============================================================================
 * KPI CARDS - CARTES SYNTHÈSE — Design Win Agro
 * ============================================================================
 *
 * Cartes KPI clés : Effectifs, Assiduité, Recettes, Alertes
 * Données réelles depuis /api/general/consolidated-report
 *
 * Design Win Agro appliqué (palette Helm conservée) :
 *  - card-shimmer (effet de brillance au hover)
 *  - hover y: -8 + shadow grow (style Win Agro)
 *  - separator line with shine animation (style Win Agro)
 *  - icône avec halo coloré premium
 *  - badge « Actif » avec ping pulse (style Win Agro)
 *
 * NB: `isLoading` est déprécié — on l'ignore volontairement pour éviter le
 * spinner infini (le parent peut passer les données quand elles arrivent,
 * sinon on affiche des zéros). L'état loading doit être géré en dehors.
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Users, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';
// ⭐ P4-final : KPIs bilingues (piste EN → anglais)
import { useL } from '@/lib/i18n/bilingual';

interface KPICardsProps {
  data?: any;
  /** Déprécié — ignoré pour éviter le spinner infini. */
  isLoading?: boolean;
  /** Surcharge optionnelle de l'academicYearId (non utilisé ici, gardé pour compat). */
  academicYearId?: string;
  /** Surcharge optionnelle du schoolLevelId (non utilisé ici, gardé pour compat). */
  schoolLevelId?: string;
}

export default function KPICards({ data }: KPICardsProps) {
  // ⭐ Libellés dans la langue du profil (piste EN → anglais)
  const L = useL();
  const kpis = [
    {
      // ⭐ 2026-09-12 : libellé FR correct (était resté en anglais « Enrolment »)
      label: L('Effectifs', 'Enrolment'),
      value: data?.enrollment?.total || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100',
      format: 'number' as const,
    },
    {
      label: L('Assiduité', 'Attendance'),
      value: data?.attendance?.rate || 0,
      suffix: '%',
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-100',
      format: 'percent' as const,
    },
    {
      label: L('Recettes', 'Revenue'),
      value: data?.revenue?.total || 0,
      prefix: 'F CFA',
      icon: DollarSign,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-100',
      format: 'currency' as const,
    },
    {
      label: L('Alertes actives', 'Active alerts'),
      value: data?.alerts?.count || 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-100',
      format: 'number' as const,
    },
  ];

  if (!data) {
    // Affichage initial : zéros plutôt que spinner infini
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-100 rounded w-24 mb-4" />
            <div className="h-8 bg-gray-100 rounded w-32 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  const formatValue = (value: number, prefix?: string, suffix?: string) => {
    const locale = L('fr-FR', 'en-GB');
    if (prefix) {
      return `${value.toLocaleString(locale)} ${prefix}`;
    }
    if (suffix) {
      return `${value.toLocaleString(locale)} ${suffix}`;
    }
    return value.toLocaleString(locale);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon;
        const hasData = kpi.value > 0;
        return (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.08, duration: 0.5, ease: 'easeOut' }}
            whileHover={{ y: -8, transition: { duration: 0.2 } }}
            className={`bg-white rounded-2xl border shadow-lg p-6 transition-all duration-300 card-shimmer group ${hasData ? kpi.borderColor : 'border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-4">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className={`p-3 rounded-xl ${kpi.bgColor}`}
              >
                <Icon className={`w-6 h-6 ${kpi.color}`} />
              </motion.div>
              {hasData && kpi.format !== 'currency' && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                  </span>
                  {L('Actif', 'Live')}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
              <p className={`text-3xl font-bold ${hasData ? 'text-gray-900' : 'text-gray-300'}`}>
                {formatValue(kpi.value, kpi.prefix, kpi.suffix)}
              </p>
              {/* Separator line with shine animation (style Win Agro) */}
              <div
                className={`w-8 h-1 rounded-full mt-3 transition-all duration-300 group-hover:w-16 ${hasData ? '' : 'opacity-30'}`}
                style={{
                  background: idx === 0 ? '#1E4FA3' : idx === 1 ? '#16a34a' : idx === 2 ? '#F5B700' : '#dc2626',
                }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
