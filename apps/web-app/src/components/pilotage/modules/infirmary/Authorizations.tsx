/**
 * ============================================================================
 * PARENTAL AUTHORIZATIONS TAB
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import {
  ClipboardCheck,
  UserCheck,
  XCircle,
  Clock,
  FileText,
  Search,
  Download,
  AlertCircle,
  Mail
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface AuthorizationItem {
  id: string;
  student?: string;
  studentName?: string;
  parent?: string;
  parentName?: string;
  type?: string;
  authorizationType?: string;
  status?: string;
  authorizationStatus?: string;
  date?: string;
  period?: string;
  validityPeriod?: string;
  [key: string]: any;
}

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  VALIDATED: { label: 'Validée', color: 'text-emerald-600 bg-emerald-50', icon: UserCheck },
  PENDING: { label: 'En attente', color: 'text-amber-600 bg-amber-50', icon: Clock },
  REFUSED: { label: 'Refusée', color: 'text-rose-600 bg-rose-50', icon: XCircle },
};

export default function Authorizations() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesList<AuthorizationItem>('infirmary', 'authorizations', academicYear?.id);

  const authorizations = data ?? [];

  // Statistiques calculées à partir des données réelles
  const total = authorizations.length;
  const validated = authorizations.filter((a) => (a.status || a.authorizationStatus || '').toUpperCase() === 'VALIDATED').length;
  const pending = authorizations.filter((a) => (a.status || a.authorizationStatus || '').toUpperCase() === 'PENDING').length;
  const validationRate = total > 0 ? Math.round((validated / total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Overview */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl shadow-slate-200">
        <div className="max-w-md">
          <h2 className="text-2xl font-black mb-3 flex items-center">
            <ClipboardCheck className="w-8 h-8 mr-3 text-emerald-400" />
            Autorisations de Soins
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Gérez les permissions parentales pour l'administration de médicaments, les premiers soins et les transferts d'urgence.
          </p>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <p className="text-3xl font-black text-emerald-400">{validationRate}%</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Taux de Validation</p>
          </div>
          <div className="w-px h-12 bg-slate-800" />
          <div className="text-center">
            <p className="text-3xl font-black text-amber-400">{pending}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">En attente</p>
          </div>
          <button className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-black text-sm hover:bg-slate-100 transition-all flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            Relancer Parents
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Chercher une autorisation..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex items-center space-x-2">
            {['Toutes', 'Validées', 'En attente', 'Refusées'].map((f, i) => (
              <button key={i} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                i === 0 ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {authorizations.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              Aucune donnée disponible pour cette année scolaire.
            </div>
          ) : authorizations.map((auth, i) => {
            const student = auth.student || auth.studentName || `Élève ${auth.id}`;
            const parent = auth.parent || auth.parentName || '—';
            const type = auth.type || auth.authorizationType || '—';
            const date = auth.date || auth.period || auth.validityPeriod || '—';
            const rawStatus = (auth.status || auth.authorizationStatus || 'PENDING').toUpperCase();
            const meta = STATUS_META[rawStatus] ?? STATUS_META.PENDING;
            const StatusIcon = meta.icon;
            return (
              <motion.div
                key={auth.id ?? i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center space-x-4 w-full md:w-1/3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">
                    {student.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{student}</h4>
                    <p className="text-xs text-slate-500 font-medium">{parent}</p>
                  </div>
                </div>

                <div className="w-full md:w-1/3">
                  <p className="text-sm font-bold text-slate-700">{type}</p>
                  <p className="text-xs text-slate-400 font-medium">Période: {date}</p>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-1/3">
                  <div className="flex items-center space-x-2">
                    <StatusIcon className={`w-4 h-4 ${meta.color.split(' ')[0]}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${meta.color.split(' ')[0]}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-blue-600 transition-all">
                      <FileText className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-blue-600 transition-all">
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
