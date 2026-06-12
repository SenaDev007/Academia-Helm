/**
 * Pedagogy Components Placeholders
 */

'use client';

import { Target, Calendar, LayoutDashboard } from 'lucide-react';

export const PedagogyDashboard = () => (
  <div className="p-12 bg-white rounded-3xl border border-slate-200 border-dashed text-center">
     <LayoutDashboard className="w-12 h-12 mx-auto mb-4 text-slate-300" />
     <h3 className="font-bold text-slate-900">Tableau de Bord Pédagogique</h3>
     <p className="text-sm text-slate-400 mt-2">Vue consolidée de la performance académique et de l'assiduité.</p>
  </div>
);

export const CurriculumTracking = () => (
  <div className="p-12 bg-white rounded-3xl border border-slate-200 border-dashed text-center">
     <Target className="w-12 h-12 mx-auto mb-4 text-slate-300" />
     <h3 className="font-bold text-slate-900">Suivi du Programme Scolaire</h3>
     <p className="text-sm text-slate-400 mt-2">Mesure de l'avancement des cours par rapport au curriculum national.</p>
  </div>
);

export const ScheduleManagement = () => (
  <div className="p-12 bg-white rounded-3xl border border-slate-200 border-dashed text-center">
     <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
     <h3 className="font-bold text-slate-900">Emplois du Temps</h3>
     <p className="text-sm text-slate-400 mt-2">Gestion des horaires de cours, des salles et des remplacements.</p>
  </div>
);
