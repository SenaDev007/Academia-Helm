/**
 * ============================================================================
 * DASHBOARD MODULE ÉLÈVES & SCOLARITÉ
 * ============================================================================
 * Vue d’ensemble : KPI, accès aux sous-modules, actions rapides.
 * Affiché par défaut à l’ouverture du module.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Archive,
  UserPlus,
  CreditCard,
  User,
  History,
  DollarSign,
  Share2,
  Plus,
  FileText,
  Clock,
  Upload,
  Download,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { toast } from '@/components/ui/toast';

export interface StudentsModuleDashboardProps {
  /** Callback pour naviguer vers un sous-module (changer l’onglet actif) */
  onNavigateToSubModule?: (subModuleId: string) => void;
  /** Ouvrir la modal nouvelle inscription */
  onNewEnrollment?: () => void;
  /** Ouvrir la modal import */
  onImport?: () => void;
}

const SUB_MODULES = [
  { id: 'admissions', label: 'Admissions & cycle de vie', description: 'Pré-inscription, admission, réinscription, affectation classe, transfert', icon: UserPlus, color: 'blue' },
  { id: 'dossiers', label: 'Identité & Dossiers', description: 'Tableau des élèves, dossier, parents, contacts', icon: User, color: 'indigo' },
  { id: 'movements', label: 'Historique & Mouvements', description: 'Traçabilité, dossier académique consolidé', icon: History, color: 'slate' },
  { id: 'compliance', label: 'Documents & Conformité', description: 'Carte scolaire, QR, certificats, conformité', icon: CreditCard, color: 'violet' },
  { id: 'educmaster', label: 'Interopérabilité nationale', description: 'Export EDUCMASTER, format officiel, logs', icon: Share2, color: 'amber' },
  { id: 'analytics', label: 'Analyse ORION & Stats', description: 'Statistiques avancées, détection d\'anomalies', icon: BookOpen, color: 'emerald' },
];

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-700 border-blue-200',
  indigo: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
  slate: 'bg-slate-500/10 text-slate-700 border-slate-200',
  emerald: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  violet: 'bg-violet-500/10 text-violet-700 border-violet-200',
  amber: 'bg-amber-500/10 text-amber-700 border-amber-200',
};

export default function StudentsModuleDashboard({
  onNavigateToSubModule,
  onNewEnrollment,
  onImport,
}: StudentsModuleDashboardProps) {
  const { academicYear, schoolLevel } = useModuleContext();
  const [statistics, setStatistics] = useState<{
    total?: number;
    active?: number;
    preRegistered?: number;
    admitted?: number;
    pending?: number;
    archived?: number;
    withdrawn?: number;
    admissionsPending?: number;
    admissionsAccepted?: number;
    admissionsRejected?: number;
    byGender?: Array<{ gender: string | null; _count: number }>;
    byStatus?: Array<{ status: string; _count: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!academicYear || !schoolLevel) {
      setStatistics(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    studentsService.getStatistics(academicYear.id, schoolLevel.id)
      .then(setStatistics)
      .catch((e) => {
        console.error('[Dashboard] getStatistics failed:', e?.message);
        // Ne pas afficher de toast "Erreur" si c'est juste qu'il n'y a pas de données
        // (ex: élèves supprimés, tenant vide). L'utilisateur voit déjà l'état vide.
        // On affiche le toast seulement pour les vraies erreurs réseau (401, 500, etc.).
        const status = e?.response?.status || e?.status;
        if (status && status >= 500) {
          toast({ title: 'Erreur serveur', description: 'Impossible de charger les statistiques', variant: 'error' });
        }
        setStatistics(null);
      })
      .finally(() => setLoading(false));
  }, [academicYear?.id, schoolLevel?.id]);

  const levelLabel =
    schoolLevel?.code === 'MATERNELLE'
      ? 'Maternelle'
      : schoolLevel?.code === 'PRIMAIRE'
        ? 'Primaire'
        : schoolLevel?.code === 'SECONDAIRE'
          ? 'Secondaire'
          : schoolLevel?.label ?? schoolLevel?.code ?? '—';

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-blue-600" />
            Vue d’ensemble
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {academicYear?.name} • {levelLabel}
          </p>
        </div>
      </div>

      {/* KPI — 5 cartes séparées par statut */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Élèves actifs (officiellement inscrits) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500">Élèves inscrits</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">
                {loading ? '—' : (statistics?.active ?? 0).toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-emerald-50 rounded-lg">
              <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Pré-inscrits */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500">Pré-inscrits</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">
                {loading ? '—' : (statistics?.preRegistered ?? 0).toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Admissions acceptées (non converties) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500">Adm. acceptées</p>
              <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">
                {loading ? '—' : (statistics?.admissionsAccepted ?? 0).toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-amber-50 rounded-lg">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            </div>
          </div>
        </div>

        {/* Admissions en attente */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500">Adm. en attente</p>
              <p className="text-xl sm:text-2xl font-bold text-orange-600 mt-1">
                {loading ? '—' : (statistics?.admissionsPending ?? 0).toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-orange-50 rounded-lg">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Archivés */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500">Archivés</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-600 mt-1">
                {loading ? '—' : (statistics?.archived ?? 0).toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-gray-100 rounded-lg">
              <Archive className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Répartition par statut (si dispo) */}
      {statistics?.byStatus && statistics.byStatus.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Répartition par statut</h3>
          <div className="flex flex-wrap gap-2">
            {statistics.byStatus.map((s) => (
              <span
                key={s.status}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
              >
                {s.status} : {s._count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions rapides */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Actions rapides</h3>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onNewEnrollment}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer un nouvel élève
          </button>
          <button
            type="button"
            onClick={onImport}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button
            type="button"
            onClick={() => onNavigateToSubModule?.('f-interop')}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export EDUCMASTER
          </button>
        </div>
      </div>

      {/* Sous-modules */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            Sous-modules
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Cliquez pour accéder à chaque domaine du module Élèves & Scolarité
          </p>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SUB_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onNavigateToSubModule?.(mod.id)}
                className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 text-left hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
              >
                <div className={`p-2.5 rounded-lg border ${COLOR_MAP[mod.color] ?? COLOR_MAP.blue}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">
                    {mod.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{mod.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
