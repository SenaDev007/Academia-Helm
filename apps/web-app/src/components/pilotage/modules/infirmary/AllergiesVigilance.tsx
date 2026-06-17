/**
 * ============================================================================
 * ALLERGIES & VIGILANCE TAB
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import {
  ShieldAlert,
  AlertTriangle,
  Utensils,
  Leaf,
  Pill,
  Heart,
  Search,
  Plus,
  Users,
  BellRing
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface VigilanceItem {
  id: string;
  name?: string;
  studentName?: string;
  class?: string;
  className?: string;
  alert?: string;
  alertLabel?: string;
  allergy?: string;
  condition?: string;
  severity?: string;
  contact?: string;
  emergencyContact?: string;
  category?: string;
  vigilanceCategory?: string;
  iconType?: string;
  [key: string]: any;
}

interface VigilanceSummary {
  foodAllergies?: number;
  medicationAllergies?: number;
  sportContraIndications?: number;
  environmental?: number;
  counts?: Record<string, number>;
  [key: string]: any;
}

const CATEGORY_META: Record<string, { icon: any; color: string; label: string }> = {
  FOOD: { icon: Utensils, color: 'text-rose-600 bg-rose-50', label: 'Allergies Alimentaires' },
  MEDICATION: { icon: Pill, color: 'text-blue-600 bg-blue-50', label: 'Allergies Médicamenteuses' },
  SPORT: { icon: Heart, color: 'text-emerald-600 bg-emerald-50', label: 'Contre-indications Sport' },
  ENVIRONMENT: { icon: Leaf, color: 'text-amber-600 bg-amber-50', label: 'Vigilance Environnement' },
};

function pickCategory(item: VigilanceItem): { icon: any; color: string; label: string } {
  const cat = (item.category || item.vigilanceCategory || item.iconType || 'FOOD').toUpperCase();
  return CATEGORY_META[cat] ?? CATEGORY_META.FOOD;
}

export default function AllergiesVigilance() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesList<VigilanceItem & { summary?: VigilanceSummary }>('infirmary', 'vigilance', academicYear?.id);

  const rawList = data ?? [];
  // Si l'endpoint renvoie un objet summary en plus de la liste, on l'extrait
  const summary: VigilanceSummary | undefined = rawList.length > 0 && rawList[0]?.summary ? rawList[0].summary : undefined;
  const vigilanceItems = summary ? rawList.slice(1) : rawList;

  // Compteurs par catégorie (depuis summary si disponible, sinon calculés)
  const counts: Record<string, number> = {
    FOOD: summary?.foodAllergies ?? summary?.counts?.FOOD ?? vigilanceItems.filter((i) => (i.category || i.vigilanceCategory || 'FOOD').toUpperCase() === 'FOOD').length,
    MEDICATION: summary?.medicationAllergies ?? summary?.counts?.MEDICATION ?? vigilanceItems.filter((i) => (i.category || i.vigilanceCategory || '').toUpperCase() === 'MEDICATION').length,
    SPORT: summary?.sportContraIndications ?? summary?.counts?.SPORT ?? vigilanceItems.filter((i) => (i.category || i.vigilanceCategory || '').toUpperCase() === 'SPORT').length,
    ENVIRONMENT: summary?.environmental ?? summary?.counts?.ENVIRONMENT ?? vigilanceItems.filter((i) => (i.category || i.vigilanceCategory || '').toUpperCase() === 'ENVIRONMENT').length,
  };

  const categories = [
    { label: 'Allergies Alimentaires', count: counts.FOOD, icon: Utensils, color: 'text-rose-600 bg-rose-50' },
    { label: 'Allergies Médicamenteuses', count: counts.MEDICATION, icon: Pill, color: 'text-blue-600 bg-blue-50' },
    { label: 'Contre-indications Sport', count: counts.SPORT, icon: Heart, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Vigilance Environnement', count: counts.ENVIRONMENT, icon: Leaf, color: 'text-amber-600 bg-amber-50' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Awareness Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-3xl p-8 text-white shadow-xl shadow-amber-200/50 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl text-center md:text-left">
            <h2 className="text-3xl font-black mb-2 flex items-center justify-center md:justify-start">
              <ShieldAlert className="w-10 h-10 mr-4" />
              Cellule de Vigilance Santé
            </h2>
            <p className="text-amber-50 font-medium text-lg">
              Centralisation des alertes vitales. Ces données sont automatiquement partagées avec les modules Cantine et Transport.
            </p>
          </div>
          <div className="flex gap-4">
            <button className="bg-white text-orange-600 px-6 py-3 rounded-2xl font-black text-sm hover:bg-amber-50 transition-all flex items-center">
              <BellRing className="w-5 h-5 mr-2" />
              Diffuser Alerte Globale
            </button>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <ShieldAlert className="w-64 h-64" />
        </div>
      </div>

      {/* Categories of Vigilance */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map((cat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
            <div className={`p-4 rounded-2xl mb-4 ${cat.color}`}>
              <cat.icon className="w-8 h-8" />
            </div>
            <p className="text-3xl font-black text-slate-900 mb-1">{cat.count}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{cat.label}</p>
          </div>
        ))}
      </div>

      {/* Critical Student List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="font-black text-slate-900 flex items-center">
            <AlertTriangle className="w-6 h-6 mr-2 text-rose-500" />
            Élèves sous Haute Surveillance
          </h3>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Chercher une alerte..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {vigilanceItems.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              Aucune donnée disponible pour cette année scolaire.
            </div>
          ) : vigilanceItems.map((item, i) => {
            const name = item.name || item.studentName || `Élève ${item.id}`;
            const className = item.class || item.className || '';
            const alert = item.alert || item.alertLabel || item.allergy || item.condition || '—';
            const severity = (item.severity || 'MOYENNE').toUpperCase();
            const contact = item.contact || item.emergencyContact || '—';
            const meta = pickCategory(item);
            const Icon = meta.icon;
            return (
              <motion.div
                key={item.id ?? i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center space-x-4 w-full md:w-1/3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400">
                    {name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900">{name}</h4>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{className}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 w-full md:w-1/3">
                  <Icon className={`w-5 h-5 ${meta.color.split(' ')[0]}`} />
                  <p className="text-sm font-bold text-slate-700">{alert}</p>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-1/3">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full tracking-widest ${
                    severity === 'CRITIQUE' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' :
                    severity === 'HAUTE' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {severity}
                  </span>
                  <button className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-blue-600">
                    <Users className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
