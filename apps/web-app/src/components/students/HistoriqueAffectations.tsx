'use client';

/**
 * ============================================================================
 * HISTORIQUE DES AFFECTATIONS — 4e sous-onglet du module Affectations
 * ============================================================================
 *
 * Affiche tous les mouvements (ClassTransfer) enregistrés dans le tenant :
 *   - INITIAL_ASSIGNMENT : affectation initiale vers une classe physique
 *   - CLASS_CHANGE       : changement de classe physique (CE1-A → CE1-B)
 *   - SERIES_CHANGE      : changement de série officielle
 *   - PROMOTION          : passage à la classe supérieure
 *
 * Endpoint : GET /api/students/class-transfers-history?academicYearId=...
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import {
  History, Loader2, Search, Filter, Calendar, ArrowRight, Users,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { cn } from '@/lib/utils';

interface ClassTransferRecord {
  id: string;
  studentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    matricule?: string | null;
    studentCode?: string;
  };
  fromClassId: string | null;
  fromClass?: { id: string; name: string; code?: string } | null;
  toClassId: string | null;
  toClass?: { id: string; name: string; code?: string } | null;
  transferDate: string;
  reason?: string | null;
  transferType: string;
  fromSeriesId?: string | null;
  toSeriesId?: string | null;
}

const TRANSFER_TYPE_META: Record<string, { label: string; color: string; icon: any }> = {
  INITIAL_ASSIGNMENT: { label: 'Affectation initiale', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Users },
  CLASS_CHANGE: { label: 'Changement de classe', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: ArrowRight },
  SERIES_CHANGE: { label: 'Changement de série', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: ArrowRight },
  PROMOTION: { label: 'Promotion', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: ArrowRight },
};

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function HistoriqueAffectations() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [transfers, setTransfers] = useState<ClassTransferRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');

  useEffect(() => {
    if (academicYear?.id) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id, schoolLevel?.id]);

  const loadHistory = async () => {
    if (!academicYear?.id) return;
    setIsLoading(true);
    try {
      const data = await studentsService.getClassTransfersHistory(academicYear.id).catch(() => []);
      setTransfers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load history:', e);
      setTransfers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtres
  const filteredTransfers = useMemo(() => {
    let list = transfers;
    if (filterType) {
      list = list.filter(t => t.transferType === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        `${t.student.firstName} ${t.student.lastName}`.toLowerCase().includes(q) ||
        (t.student.matricule || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [transfers, filterType, searchQuery]);

  // Stats par type
  const stats = useMemo(() => {
    const s: Record<string, number> = { INITIAL_ASSIGNMENT: 0, CLASS_CHANGE: 0, SERIES_CHANGE: 0, PROMOTION: 0 };
    transfers.forEach(t => {
      if (s[t.transferType] !== undefined) s[t.transferType]++;
      else s[t.transferType] = (s[t.transferType] || 0) + 1;
    });
    return s;
  }, [transfers]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Affectations initiales', value: stats.INITIAL_ASSIGNMENT, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Changements de classe', value: stats.CLASS_CHANGE, color: 'bg-blue-50 text-blue-600' },
          { label: 'Changements de série', value: stats.SERIES_CHANGE, color: 'bg-purple-50 text-purple-600' },
          { label: 'Promotions', value: stats.PROMOTION, color: 'bg-amber-50 text-amber-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
            <div className={cn('p-2 rounded-lg', stat.color)}><History className="w-4 h-4" /></div>
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase">{stat.label}</p>
              <p className="text-base font-bold text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            Historique des mouvements
          </h3>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un élève..."
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-slate-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tous les types</option>
              <option value="INITIAL_ASSIGNMENT">Affectations initiales</option>
              <option value="CLASS_CHANGE">Changements de classe</option>
              <option value="SERIES_CHANGE">Changements de série</option>
              <option value="PROMOTION">Promotions</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-700">Aucun mouvement enregistré</p>
              <p className="text-xs text-slate-500 mt-1">
                Les affectations et changements de classe/série apparaîtront ici une fois effectués.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Élève</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">De</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vers</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Motif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTransfers.map(t => {
                  const meta = TRANSFER_TYPE_META[t.transferType] || { label: t.transferType, color: 'bg-slate-50 text-slate-700 border-slate-200', icon: History };
                  const fromLabel = t.fromClass?.name || (t.fromSeriesId ? `Série ${t.fromSeriesId.substring(0, 8)}…` : '—');
                  const toLabel = t.toClass?.name || (t.toSeriesId ? `Série ${t.toSeriesId.substring(0, 8)}…` : '—');
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(t.transferDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-800">
                          {t.student.lastName.toUpperCase()} {t.student.firstName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {t.student.matricule || t.student.studentCode || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border', meta.color)}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fromLabel}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-sm font-medium text-slate-700">{toLabel}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 italic max-w-xs truncate">
                        {t.reason || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {filteredTransfers.length > 0 && (
          <div className="p-2 border-t border-slate-100 bg-slate-50/50 text-[10px] text-slate-500 text-center">
            {filteredTransfers.length} mouvement(s) affiché(s) sur {transfers.length} total
          </div>
        )}
      </div>
    </div>
  );
}
