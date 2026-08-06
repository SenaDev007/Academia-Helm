'use client';

/**
 * ============================================================================
 * PORTAIL PARENT — Dashboard
 * ============================================================================
 * Vue d'ensemble : cartes par enfant + scolarité + suivi journalier
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, Loader2, GraduationCap, Wallet, CalendarCheck,
  BookOpen, AlertCircle, CheckCircle2, XCircle, Clock,
  Phone, Mail, TrendingUp, RefreshCw, ChevronRight,
} from 'lucide-react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useParentChildren, useParentToday } from '@/lib/query/parent-hooks';
import StudentAvatar from '@/components/parent/StudentAvatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_CONFIG = {
  PRESENT: { label: 'Présent', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  ABSENT: { label: 'Absent', color: 'bg-red-100 text-red-700', icon: XCircle },
  LATE: { label: 'En retard', color: 'bg-amber-100 text-amber-700', icon: Clock },
};

export default function ParentDashboard() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const [selectedChild, setSelectedChild] = useState<any>(null);

  // ✅ React Query hooks (même pattern que useMyClasses pour les teachers)
  const { data: children = [], isLoading: loading, refetch, error } = useParentChildren(academicYear?.id);
  const { data: todayData, isLoading: loadingToday } = useParentToday(
    selectedChild?.id,
    academicYear?.id,
  );

  // Auto-select first child when children load
  useEffect(() => {
    if (children.length > 0 && !selectedChild) {
      setSelectedChild(children[0]);
    }
  }, [children, selectedChild]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Chargement de vos enfants…</span>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="text-center py-20">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="font-medium text-gray-600">Aucun enfant lié à votre compte</p>
        <p className="text-sm text-gray-400 mt-1">
          Contactez l'administration de l'école pour lier vos enfants à votre compte.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Mes Enfants
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {children.length} enfant(s) · {academicYear?.label || 'Année courante'}
          </p>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg" title="Rafraîchir">
          <RefreshCw className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Cartes enfants */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children.map((child) => {
          const isSelected = selectedChild?.id === child.id;
          const account = child.account || {};
          const balance = account.balance || 0;
          const isPaid = balance <= 0;

          return (
            <Link
              key={child.id}
              href={`/app/parent/children/${child.id}`}
              className={cn(
                "block text-left p-5 rounded-2xl border-2 transition-all",
                "border-gray-200 bg-white hover:border-blue-300 hover:shadow-md cursor-pointer"
              )}
            >
              {/* Photo + Nom */}
              <div className="flex items-center gap-3 mb-3">
                <StudentAvatar
                  firstName={child.firstName}
                  lastName={child.lastName}
                  photoUrl={child.photoUrl}
                  size="md"
                  variant="blue"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">
                    {child.firstName} {child.lastName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {child.className || 'Classe non assignée'} · {child.matricule || '—'}
                  </p>
                </div>
              </div>

              {/* Statut scolarité */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold mb-2",
                isPaid
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              )}>
                <Wallet className="w-4 h-4" />
                {isPaid ? (
                  <span>Scolarité à jour</span>
                ) : (
                  <span>Reste à payer : {balance.toLocaleString('fr-FR')} FCFA</span>
                )}
              </div>

              {/* Enseignant */}
              {child.teacher && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Titulaire : {child.teacher.name}</span>
                </div>
              )}

              {/* Lien détail */}
              <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold mt-3">
                Voir le détail
                <ChevronRight className="w-3 h-3" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Détail enfant sélectionné */}
      {selectedChild && (
        <ChildDetail
          child={selectedChild}
          todayData={todayData}
          loadingToday={loadingToday}
        />
      )}
    </div>
  );
}

// ============================================================================
// Détail enfant — Suivi journalier + scolarité + assiduité
// ============================================================================

function ChildDetail({ child, todayData, loadingToday }: { child: any; todayData: any; loadingToday: boolean }) {
  const account = child.account || {};
  const balance = account.balance || 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* En-tête enfant */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
            {(child.firstName?.[0] || '')}{(child.lastName?.[0] || '')}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{child.firstName} {child.lastName}</h2>
            <p className="text-sm text-blue-100">
              {child.className || '—'} · {child.levelName || child.levelCode || '—'}
            </p>
            <p className="text-xs text-blue-200 mt-1">
              Matricule : {child.matricule || '—'} · {child.gender === 'MALE' ? 'Garçon' : 'Fille'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Suivi journalier */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase mb-3 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-blue-600" />
            Suivi du jour — {format(new Date(), 'EEEE d MMMM', { locale: fr })}
          </h3>

          {loadingToday ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-sm text-gray-500">Chargement…</span>
            </div>
          ) : todayData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Présence */}
              <div className="p-3 rounded-xl border border-gray-200">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Présence</div>
                {todayData.attendance ? (
                  (() => {
                    const cfg = STATUS_CONFIG[todayData.attendance.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PRESENT;
                    const Icon = cfg.icon;
                    return (
                      <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-bold", cfg.color)}>
                        <Icon className="w-4 h-4" />
                        {cfg.label}
                      </div>
                    );
                  })()
                ) : (
                  <span className="text-sm text-gray-400">Non relevée</span>
                )}
              </div>

              {/* Cours du jour */}
              <div className="p-3 rounded-xl border border-gray-200">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Cours du jour</div>
                {todayData.cahierJournal?.todayEntries ? (
                  <div className="text-sm text-gray-700">
                    {Object.keys(todayData.cahierJournal.todayEntries).length} matière(s) programmée(s)
                    {todayData.cahierJournal.status === 'VALIDATED' && (
                      <span className="ml-1 text-emerald-600 text-xs">✓ Validé</span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Cahier journal non disponible</span>
                )}
              </div>

              {/* Devoirs */}
              <div className="p-3 rounded-xl border border-gray-200">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Devoirs à faire</div>
                <div className="text-sm font-bold text-blue-600">
                  {todayData.homeworks?.length || 0} devoir(s)
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Données du jour non disponibles</p>
          )}
        </div>

        {/* Scolarité */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase mb-3 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600" />
            Scolarité
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-gray-50">
              <div className="text-xs text-gray-500">Total dû</div>
              <div className="text-lg font-bold text-gray-900">{(account.totalDue || 0).toLocaleString('fr-FR')}</div>
              <div className="text-xs text-gray-400">FCFA</div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50">
              <div className="text-xs text-emerald-600">Payé</div>
              <div className="text-lg font-bold text-emerald-700">{(account.totalPaid || 0).toLocaleString('fr-FR')}</div>
              <div className="text-xs text-emerald-400">FCFA</div>
            </div>
            <div className="p-3 rounded-xl bg-red-50">
              <div className="text-xs text-red-600">Restant</div>
              <div className="text-lg font-bold text-red-700">{balance.toLocaleString('fr-FR')}</div>
              <div className="text-xs text-red-400">FCFA</div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50">
              <div className="text-xs text-amber-600">Arriérés</div>
              <div className="text-lg font-bold text-amber-700">{(account.arrearsAmount || 0).toLocaleString('fr-FR')}</div>
              <div className="text-xs text-amber-400">FCFA</div>
            </div>
          </div>
        </div>

        {/* Enseignant */}
        {child.teacher && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase mb-3 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-600" />
              Enseignant titulaire
            </h3>
            <div className="p-3 rounded-xl border border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">{child.teacher.name}</div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {child.teacher.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {child.teacher.email}
                    </span>
                  )}
                  {child.teacher.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {child.teacher.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Devoirs détaillés */}
        {todayData?.homeworks?.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Devoirs en cours
            </h3>
            <div className="space-y-2">
              {todayData.homeworks.map((hw: any) => (
                <div key={hw.id} className="p-3 rounded-xl border border-gray-200 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-gray-900">{hw.title}</div>
                    {hw.subjectName && (
                      <div className="text-xs text-blue-600 font-semibold">{hw.subjectName}</div>
                    )}
                    {hw.description && (
                      <div className="text-xs text-gray-500 mt-1" dangerouslySetInnerHTML={{ __html: hw.description.substring(0, 150) }} />
                    )}
                    {hw.dueDate && (
                      <div className="text-xs text-amber-600 mt-1">
                        À rendre : {format(new Date(hw.dueDate), 'd MMM yyyy', { locale: fr })}
                      </div>
                    )}
                  </div>
                  {hw.taskStatus && (
                    <div className={cn(
                      "px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap",
                      hw.taskStatus.status === 'DONE' && "bg-emerald-100 text-emerald-700",
                      hw.taskStatus.status === 'PENDING' && "bg-amber-100 text-amber-700",
                      hw.taskStatus.status === 'NOT_DONE' && "bg-red-100 text-red-700",
                      hw.taskStatus.status === 'LATE' && "bg-red-100 text-red-700",
                    )}>
                      {hw.taskStatus.status === 'DONE' ? '✓ Fait' :
                       hw.taskStatus.status === 'PENDING' ? '⏳ En attente' :
                       hw.taskStatus.status === 'NOT_DONE' ? '✗ Non fait' :
                       hw.taskStatus.status === 'LATE' ? '⚠ En retard' :
                       hw.taskStatus.status}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
