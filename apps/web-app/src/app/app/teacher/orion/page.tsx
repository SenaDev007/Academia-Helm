"use client";

/**
 * Teacher ORION — pedagogical alerts and analytics.
 */

import { BarChart3, AlertTriangle, Clock, FileText } from "lucide-react";

export default function TeacherOrionPage() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">ORION — Alertes Pédagogiques</h2>
        </div>
        <p className="text-sm text-slate-500">
          Alertes sur les notes manquantes, élèves en difficulté, cahier de textes non rempli.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">
          Les alertes ORION apparaîtront ici une fois le moteur déployé.
        </p>
      </div>

      {/* Placeholder stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-red-500" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Notes manquantes</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-5 w-5 text-amber-500" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Retards de soumission</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Élèves en difficulté</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
      </div>
    </div>
  );
}
