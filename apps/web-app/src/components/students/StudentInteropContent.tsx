import React, { useState } from 'react';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useModuleContext } from '@/hooks/useModuleContext';
import { toast } from '@/components/ui/toast';
import { studentsService } from '@/services/students.service';
import { 
  Globe, 
  FileJson, 
  Loader2, 
  Download, 
  RefreshCw, 
  Zap, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export default function StudentInteropContent() {
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const [syncingLevelId, setSyncingLevelId] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const handleExportEducmaster = async (level: { id: string; code: string; label: string }) => {
    if (!academicYear) {
      toast({ 
        title: 'Erreur', 
        description: 'Veuillez sélectionner une année scolaire', 
        variant: 'error' 
      });
      return;
    }

    setSyncingLevelId(level.id);
    try {
      await studentsService.exportEducmasterExcel(academicYear.id, level.id);
      setLastExport(`${level.label} - ${new Date().toLocaleString('fr-FR')}`);
      toast({ 
        title: 'Succès', 
        description: `Export ${level.label} généré avec succès`, 
        variant: 'success' 
      });
    } catch (e: any) {
      toast({ 
        title: 'Erreur', 
        description: e.message || 'Erreur réseau lors de l\'export', 
        variant: 'error' 
      });
    } finally {
      setSyncingLevelId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 p-8 text-white">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20">
              <Globe className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Hub d'Interopérabilité</h3>
              <p className="text-slate-400 text-sm">Synchronisation avec les systèmes nationaux et ministériels</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableLevels.filter(l => l.id !== 'ALL' && ['MATERNELLE', 'PRIMAIRE'].includes(l.code)).map((level) => (
              <div key={level.id} className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 hover:border-blue-500/50 transition-colors group">
                <div className="flex items-center justify-between mb-4">
                  <FileJson className="w-6 h-6 text-blue-400" />
                  <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 px-2 py-1 rounded">V1.4 COMPATIBLE</span>
                </div>
                <h4 className="text-lg font-bold mb-2">EDUCMASTER - {level.label}</h4>
                <p className="text-sm text-slate-400 mb-6">Génération du fichier Excel pour le niveau {level.label.toLowerCase()}.</p>
                <button 
                  onClick={() => handleExportEducmaster(level)}
                  disabled={!!syncingLevelId}
                  className="w-full py-3 bg-white text-slate-900 font-black rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {syncingLevelId === level.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  EXPORTER {level.code}
                </button>
              </div>
            ))}

            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 hover:border-purple-500/50 transition-colors group">
              <div className="flex items-center justify-between mb-4">
                <RefreshCw className="w-6 h-6 text-purple-400" />
                <span className="text-[10px] font-black bg-purple-500/20 text-purple-400 px-2 py-1 rounded">API DIRECT</span>
              </div>
              <h4 className="text-lg font-bold mb-2">ANIP - Registre NPI</h4>
              <p className="text-sm text-slate-400 mb-6">Synchronisation directe des identités via le numéro NPI national (Bénin).</p>
              <button 
                disabled
                className="w-full py-3 bg-slate-700 text-slate-500 font-black rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> BIENTÔT DISPONIBLE
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">État du Service ORION</span>
            </div>
            {lastExport && (
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {lastExport}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-start gap-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-blue-900 mb-1">Rappel de Conformité</h4>
          <p className="text-xs text-blue-700 leading-relaxed">
            Avant tout export, assurez-vous que tous les élèves ont un matricule valide et que les données obligatoires (Nom, Prénom, Date de naissance, Lieu de naissance) sont complètes. 
            Le moteur ORION signalera toute anomalie bloquante.
          </p>
        </div>
      </div>
    </div>
  );
}
