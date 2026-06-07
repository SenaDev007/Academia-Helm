/**
 * Exam Components Placeholders
 */

'use client';

import { Calendar, Users, Award } from 'lucide-react';

export const ExamPlanning = () => (
  <div className="p-12 bg-white rounded-3xl border border-slate-200 border-dashed text-center">
     <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
     <h3 className="font-bold text-slate-900">Planification des Examens</h3>
     <p className="text-sm text-slate-400 mt-2">Calendrier des épreuves, attribution des surveillants et gestion des salles.</p>
  </div>
);

export const DeliberationsManagement = () => (
  <div className="p-12 bg-white rounded-3xl border border-slate-200 border-dashed text-center">
     <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
     <h3 className="font-bold text-slate-900">Délibérations & Commissions</h3>
     <p className="text-sm text-slate-400 mt-2">Gestion des jurys, commissions d'appel et validation finale des résultats.</p>
  </div>
);

export const ResultsProclamation = () => (
  <div className="p-12 bg-white rounded-3xl border border-slate-200 border-dashed text-center">
     <Award className="w-12 h-12 mx-auto mb-4 text-slate-300" />
     <h3 className="font-bold text-slate-900">Proclamations & Résultats</h3>
     <p className="text-sm text-slate-400 mt-2">Publication officielle des résultats, impression des relevés et notifications parents.</p>
  </div>
);
