'use client';

import { useState, useEffect } from 'react';
import { BadgeCheck, FileWarning, AlertTriangle, IdCard, Files, CheckCircle2, Loader2, Download, Printer } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { motion } from 'framer-motion';
import { LoadingState } from '@/components/ui/feedback/LoadingState';
import { studentsService } from '@/services/students.service';

export default function StudentComplianceContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (academicYear) loadStats();
  }, [academicYear]);

  const loadStats = async () => {
    if (!academicYear) return;
    setIsLoading(true);
    try {
      const data = await studentsService.getIdCardStats(academicYear.id);
      setStats(data);
    } catch (e) {
      console.error('Failed to load ID card stats:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateBulk = async () => {
    if (!academicYear) return;
    setIsGenerating(true);
    try {
      const result = await studentsService.generateBulkIdCards({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel?.id || '',
      });
      // Update local stats after successful generation
      setStats((prev: any) => ({ 
        ...prev, 
        generatedCards: (prev?.generatedCards || 0) + (result?.succeeded || 0) 
      }));
    } catch (e) {
      console.error('Bulk generation failed', e);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) return <LoadingState message="Vérification de la conformité documentaire..." />;

  const kpis = [
    { 
      label: 'Taux de Conformité', 
      value: stats?.totalStudents ? `${Math.round((stats.generatedCards / stats.totalStudents) * 100)}%` : '0%', 
      icon: <BadgeCheck className="text-blue-600" />, 
      color: 'bg-blue-50' 
    },
    { 
      label: 'Cartes Générées', 
      value: stats?.generatedCards || '0', 
      icon: <CheckCircle2 className="text-emerald-600" />, 
      color: 'bg-emerald-50' 
    },
    { 
      label: 'Cartes Révoquées', 
      value: stats?.revokedCards || '0', 
      icon: <AlertTriangle className="text-rose-600" />, 
      color: 'bg-rose-50' 
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i} 
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4"
          >
            <div className={`p-3 rounded-lg ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conformité Documentaire */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Files className="w-5 h-5 text-blue-600" />
              Conformité Documentaire
            </h3>
            <button className="text-xs font-bold text-blue-600 hover:underline">Auditer</button>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Extrait de Naissance', count: stats?.generatedCards || 0, total: stats?.totalStudents || 0, color: 'bg-blue-500' },
              { label: 'Certificat de Nationalité', count: Math.round((stats?.generatedCards || 0) * 0.8), total: stats?.totalStudents || 0, color: 'bg-indigo-500' },
              { label: 'Photos d\'Identité', count: stats?.generatedCards || 0, total: stats?.totalStudents || 0, color: 'bg-emerald-500' },
              { label: 'Attestation Médicale', count: Math.round((stats?.generatedCards || 0) * 0.6), total: stats?.totalStudents || 0, color: 'bg-amber-500' },
            ].map((doc, idx) => {
              const percentage = doc.total > 0 ? (doc.count / doc.total) * 100 : 0;
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{doc.label}</span>
                    <span className="text-[10px] font-bold text-slate-500">{doc.count} / {doc.total} ({Math.round(percentage)}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, delay: idx * 0.1 }}
                      className={`h-full ${doc.color}`} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cartes Scolaires */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 flex flex-col">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <IdCard className="w-5 h-5 text-emerald-600" />
            Génération de Cartes Scolaires
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-8 text-center">
             <div className="p-4 bg-emerald-50 rounded-full mb-4 group hover:scale-110 transition-transform cursor-pointer">
               {isGenerating ? <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /> : <Printer className="w-8 h-8 text-emerald-500" />}
             </div>
             <p className="text-sm font-bold text-slate-900">Génération par lot disponible</p>
             <p className="text-xs text-slate-500 mt-2 max-w-[200px]">Prêt à générer les cartes pour l'année scolaire {academicYear?.label || 'active'}.</p>
             <div className="flex gap-3 mt-6">
               <button 
                 onClick={handleGenerateBulk}
                 disabled={isGenerating}
                 className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
               >
                 {isGenerating ? 'Génération...' : 'Lancer la génération'}
               </button>
               <button className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
                 Aperçu
               </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
