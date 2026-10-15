/**
 * ============================================================================
 * CANTEEN DIETS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint : GET /modules-complementaires/canteen/diets?academicYearId=...
 * Endpoint : GET /modules-complementaires/canteen/allergies?academicYearId=...
 *
 * Refonte juillet 2026 (Task 7-d) :
 *  - <input>/<button> HTML → <Input>/<Button> shadcn
 *  - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-semibold
 *  - bandeau navy-900 → slate-900
 * ============================================================================
 */

'use client';

import React from 'react';
import {
  Search, Filter,
  ShieldAlert, Clipboard, Heart,
  ChevronRight, Info, CheckCircle2, Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DietItem {
  id: string;
  student?: string;
  studentName?: string;
  name?: string;
  class?: string;
  className?: string;
  diet?: string;
  dietType?: string;
  regime?: string;
  severity?: string;
  forbidden?: string;
  forbiddenFoods?: string;
  excludedFoods?: string;
  [key: string]: any;
}

export default function CanteenDiets() {
  const { academicYear } = useModuleContext();
  const { data: diets, loading, error } = useModulesList<DietItem>(
    'canteen',
    'diets',
    academicYear?.id,
  );

  const criticalCount = (diets ?? []).filter((d) => {
    const s = (d.severity ?? '').toUpperCase();
    return s === 'CRITICAL' || s === 'CRITIQUE';
  }).length;
  const paiCount = (diets ?? []).filter((d) => {
    const s = (d.severity ?? '').toUpperCase();
    return s.includes('PAI') || s.includes('MEDICAL');
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des profils alimentaires...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Risk Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <RiskCard
          title="Allergies Critiques"
          value={String(criticalCount).padStart(2, '0')}
          icon={ShieldAlert}
          color="red"
        />
        <RiskCard
          title="Régimes Spéciaux"
          value={String((diets ?? []).length).padStart(2, '0')}
          icon={Heart}
          color="blue"
        />
        <RiskCard
          title="Médicalisés (PAI)"
          value={String(paiCount).padStart(2, '0')}
          icon={Clipboard}
          color="amber"
        />
        <RiskCard
          title="Mises à jour (Mois)"
          value={String((diets ?? []).length).padStart(2, '0')}
          icon={CheckCircle2}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main List */}
        <Card className="lg:col-span-2 p-0 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-navy-900 text-lg">Profils Alimentaires</h3>
              <p className="text-gray-500 text-sm mt-1">Suivi de la sécurité alimentaire des élèves</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Élève, allergie..."
                  className="pl-10 w-56"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {(diets ?? []).length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              Aucun profil alimentaire spécial enregistré pour cette année scolaire.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(diets ?? []).map((diet) => (
                <DietRow
                  key={diet.id}
                  student={diet.student ?? diet.studentName ?? diet.name ?? '—'}
                  class={diet.class ?? diet.className ?? '—'}
                  diet={diet.diet ?? diet.dietType ?? diet.regime ?? 'Standard'}
                  severity={diet.severity ?? 'LOW'}
                  forbidden={diet.forbidden ?? diet.forbiddenFoods ?? diet.excludedFoods ?? '—'}
                />
              ))}
            </div>
          )}

          {diets.length > 3 && (
            <div className="p-4 bg-gray-50/50 flex justify-center">
              <Button variant="link" size="sm">
                Voir tous les profils
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </Card>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <Card className="p-6 bg-slate-900 text-white border-slate-800 shadow-md">
            <h4 className="font-semibold text-lg mb-3">Alerte Menu</h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Le menu de demain (Mafé) contient des <span className="text-amber-400 font-semibold">Arachides</span>.
              <span className="text-white font-semibold block mt-2">{criticalCount} élève(s) concerné(s) par cette alerte.</span>
            </p>
            <Button variant="secondary" className="w-full bg-white text-slate-900 hover:bg-slate-100">
              Générer les Repas Spéciaux
            </Button>
          </Card>

          <Card className="p-6 shadow-sm">
            <h4 className="font-semibold text-navy-900 mb-4 flex items-center space-x-2">
              <Info className="w-5 h-5 text-blue-500" />
              <span>Consignes d’Urgence</span>
            </h4>
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs font-semibold text-blue-600 mb-1">Protocole Allergie</p>
                <p className="text-xs text-blue-800">Toujours vérifier le double étiquetage des plats en cas d’allergie critique signalée.</p>
              </div>
              <Button variant="outline" className="w-full">
                Télécharger le Guide QHSE
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RiskCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    red: 'bg-red-50 text-red-600 border-red-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <Card className="p-6 shadow-sm flex items-center space-x-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-gray-500 text-xs font-medium">{title}</p>
        <p className="text-2xl font-semibold text-navy-900 mt-1">{value}</p>
      </div>
    </Card>
  );
}

function DietRow({ student, class: className, diet, severity, forbidden }: any) {
  const severityStyles: any = {
    'CRITICAL': 'bg-red-100 text-red-600 border-red-200',
    'CRITIQUE': 'bg-red-100 text-red-600 border-red-200',
    'HIGH': 'bg-orange-100 text-orange-600 border-orange-200',
    'MEDIUM': 'bg-amber-100 text-amber-600 border-amber-200',
    'LOW': 'bg-blue-100 text-blue-600 border-blue-200',
  };
  const severityStyle = severityStyles[severity] ?? severityStyles['LOW'];

  return (
    <div className="p-6 hover:bg-slate-50 transition-all">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-gray-500 font-semibold text-sm">
            {typeof student === 'string' ? student.split(' ').map((n: string) => n[0]).join('') : '—'}
          </div>
          <div>
            <h4 className="font-semibold text-navy-900 text-base">{student}</h4>
            <p className="text-xs text-gray-500">{className}</p>
            <Badge variant="outline" className={`mt-2 ${severityStyle}`}>
              {diet} — {severity}
            </Badge>
          </div>
        </div>
        <div className="flex-1 max-w-md">
          <p className="text-xs font-medium text-gray-500 mb-1">Aliments Interdits</p>
          <p className="text-xs text-gray-600 italic">« {forbidden} »</p>
          <div className="mt-3 flex items-center space-x-3">
            <Button variant="link" size="sm" className="p-0 h-auto">Fiche Médicale</Button>
            <span className="text-gray-200">|</span>
            <Button variant="link" size="sm" className="p-0 h-auto">Contacter Parent</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
