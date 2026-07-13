/**
 * ============================================================================
 * Educmaster — Hub d'interopérabilité nationale
 * ============================================================================
 *
 * Export des données élèves vers les systèmes nationaux (Educmaster, ANIP).
 * Design cohérent avec les autres onglets du module Élèves.
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useModuleContext } from '@/hooks/useModuleContext';
import { toast } from '@/components/ui/toast';
import { studentsService } from '@/services/students.service';
import {
  Globe, Loader2, Download,
  CheckCircle2, AlertCircle,
} from 'lucide-react';

export default function StudentInteropContent() {
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const [syncingLevelId, setSyncingLevelId] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const handleExportEducmaster = async (level: { id: string; code: string; label: string; schoolLevelId?: string | null }) => {
    if (!academicYear) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner une année scolaire', variant: 'error' });
      return;
    }
    // ⭐ On envoie le CODE (MATERNELLE/PRIMAIRE) au backend — méthode la plus fiable pour
    // résoudre le SchoolLevel côté serveur (élimine l'ambiguïté entre education_levels.id
    // et school_levels.id qui causait le 404 "Niveau scolaire non trouvé").
    setSyncingLevelId(level.id);
    try {
      await studentsService.exportEducmasterExcel(academicYear.id, level.code);
      setLastExport(`${level.label} — ${new Date().toLocaleString('fr-FR')}`);
      toast({ title: '✅ Export généré', description: `Export Educmaster ${level.label} téléchargé.`, variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Erreur réseau lors de l\'export', variant: 'error' });
    } finally {
      setSyncingLevelId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header — white card cohérent avec les autres onglets */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Educmaster — Interopérabilité nationale</h2>
              <p className="text-xs text-slate-500">Export des données élèves vers les systèmes ministériels</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Service actif</span>
          </div>
        </div>
        {lastExport && (
          <div className="px-4 py-2 border-t border-slate-100 bg-emerald-50/50 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-emerald-700 font-medium">Dernier export : {lastExport}</span>
          </div>
        )}
      </div>

      {/* Cartes d'export */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Educmaster par niveau */}
        {availableLevels
          .filter(l => l.id !== 'ALL' && ['MATERNELLE', 'PRIMAIRE'].includes(l.code))
          .map((level) => (
            <div key={level.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                {/* ⭐ Icône Excel officielle (vert Excel) */}
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#E8F5E9' }}>
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#217346">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/>
                    <text x="8" y="18" fontSize="8" fill="white" fontWeight="bold">X</text>
                  </svg>
                </div>
              </div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">Educmaster — {level.label}</h4>
              <p className="text-xs text-slate-500 mb-3">Génération du fichier Excel conforme au template gouvernemental pour le niveau {level.label.toLowerCase()}.</p>
              <button
                onClick={() => handleExportEducmaster(level)}
                disabled={!!syncingLevelId}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
                title={`Exporter ${level.label} en Excel`}
              >
                {syncingLevelId === level.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {syncingLevelId === level.id ? 'Export...' : `Exporter ${level.code}`}
              </button>
            </div>
          ))
        }
      </div>

      {/* Rappel de conformité */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-amber-900 mb-1">Rappel de conformité</h4>
          <p className="text-xs text-amber-800 leading-relaxed">
            Avant tout export, assurez-vous que tous les élèves ont un matricule valide et que les données obligatoires
            (Nom, Prénom, Date de naissance, Lieu de naissance) sont complètes. Le moteur ORION signalera toute anomalie bloquante.
          </p>
        </div>
      </div>
    </div>
  );
}
