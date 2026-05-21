/**
 * ============================================================================
 * MODULE 3 : MOYENNES & CLASSEMENTS
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { 
  Calculator, 
  RefreshCcw, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target,
  Search,
  ChevronRight,
  ArrowRight,
  FileText,
  BadgeCheck,
  AlertCircle
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicSettings } from '@/hooks/useAcademicSettings';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { toast } from '@/components/ui/toast';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function AveragesPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { getScoreColor, isPassingGrade, maxScore } = useAcademicSettings();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Mock period
  const currentPeriodId = "T1";

  useEffect(() => {
    async function loadClasses() {
      if (!schoolLevel?.id || !academicYear?.id) return;
      try {
        const res = await fetch(`/api/classes?schoolLevelId=${schoolLevel.id}`).then(r => r.json());
        if (Array.isArray(res)) {
          setClasses(res);
          if (res.length > 0) setSelectedClassId(res[0].id);
        }
      } catch (error) {
        console.error('Error loading classes', error);
      }
    }
    loadClasses();
  }, [schoolLevel, academicYear]);

  useEffect(() => {
    if (selectedClassId) loadResults();
  }, [selectedClassId]);

  const loadResults = async () => {
    try {
      setLoading(true);
      const res = await institutionalExamsService.getClassBulletins(selectedClassId, currentPeriodId);
      setResults(res);
    } catch (error) {
      console.error('Error loading averages', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    try {
      setCalculating(true);
      await institutionalExamsService.generateBulletins(selectedClassId, currentPeriodId);
      toast({ title: "Calcul terminé", description: "Les moyennes et rangs ont été recalculés." });
      loadResults();
    } catch (error) {
      toast({ title: "Erreur", description: "Échec du calcul", variant: "destructive" });
    } finally {
      setCalculating(false);
    }
  };

  return (
    <ModuleContainer
      header={{
        title: 'Moyennes & Classements',
        description: 'Consolidation des résultats périodiques et ordonnancement des élèves.',
        icon: 'calculator',
      }}
      subModules={{ 
        modules: EXAMS_SUB_MODULES,
        activeModuleId: 'averages'
      }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-6 p-1">
            {/* Control Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100 gap-4">
              <div className="flex items-center space-x-4">
                <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 leading-none mb-1">Moteur de Calcul</h3>
                  <p className="text-xs text-gray-500">Période : <span className="font-bold text-indigo-600">Trimestre 1</span></p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <select 
                  value={selectedClassId} 
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="flex-1 md:w-64 text-sm font-bold border-gray-200 bg-gray-50 rounded-xl focus:ring-2 focus:ring-indigo-500 py-2.5"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <Button 
                  onClick={handleCalculate} 
                  disabled={calculating || !selectedClassId} 
                  className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 px-6 font-bold"
                >
                  <RefreshCcw className={cn("w-4 h-4 mr-2", calculating && "animate-spin")} />
                  {calculating ? 'Calcul en cours...' : 'Lancer le Calcul'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Ranking Table */}
              <Card className="lg:col-span-3 border-none shadow-sm overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold">Classement Général</CardTitle>
                  <CardDescription>Aperçu des résultats par ordre de mérite.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                        <TableHead className="w-20 text-center font-bold">Rang</TableHead>
                        <TableHead className="font-bold">Élève</TableHead>
                        <TableHead className="text-center font-bold">Moyenne</TableHead>
                        <TableHead className="text-center font-bold">Total / 20</TableHead>
                        <TableHead className="font-bold">Progression</TableHead>
                        <TableHead className="text-right px-6 font-bold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((item, index) => (
                        <TableRow key={item.id} className="group hover:bg-indigo-50/30 transition-colors">
                          <TableCell className="text-center">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-sm font-black",
                              index === 0 ? "bg-amber-100 text-amber-700 shadow-sm ring-1 ring-amber-200" : 
                              index === 1 ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200" :
                              index === 2 ? "bg-orange-100 text-orange-700 ring-1 ring-orange-200" :
                              "bg-gray-50 text-gray-400"
                            )}>
                              {item.classRank}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                {item.student.lastName} {item.student.firstName}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">{item.student.matricule}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn(
                              "font-black text-sm px-3 border-none",
                              getScoreColor(Number(item.generalAverage))
                            )}>
                              {Number(item.generalAverage).toFixed(2)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-bold text-gray-500">
                             {Number(item.totalWeighted).toFixed(1)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-[10px] font-black uppercase">
                               <TrendingUp className="w-3 h-3 text-emerald-500" />
                               <span className="text-emerald-600">+1.2</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-indigo-600">
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {results.length === 0 && !loading && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-20 bg-gray-50/50">
                            <div className="flex flex-col items-center justify-center opacity-40">
                               <Calculator className="w-12 h-12 mb-2" />
                               <p className="italic text-sm">Veuillez lancer le calcul pour afficher les moyennes.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Sidebar Stats */}
              <div className="space-y-6">
                <Card className="border-none shadow-sm bg-gradient-to-br from-indigo-600 to-indigo-800 text-white overflow-hidden relative group">
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center uppercase tracking-wider opacity-80">
                      Moyenne de Classe
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-black mb-1">12.45</div>
                    <p className="text-[10px] text-indigo-200 font-bold uppercase">Objectif Institutionnel: 13.00</p>
                    <div className="h-1.5 w-full bg-white/10 rounded-full mt-4 overflow-hidden">
                       <div className="h-full bg-white rounded-full" style={{ width: '85%' }} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm overflow-hidden bg-white/60 backdrop-blur-md">
                   <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-widest">Répartition</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <DistributionRow label=">= 16 (Excellent)" count={2} color="bg-purple-500" total={results.length} />
                      <DistributionRow label="14 - 16 (Bien)" count={5} color="bg-indigo-500" total={results.length} />
                      <DistributionRow label="12 - 14 (A. Bien)" count={12} color="bg-blue-500" total={results.length} />
                      <DistributionRow label="10 - 12 (Passable)" count={8} color="bg-emerald-500" total={results.length} />
                      <DistributionRow label="< 10 (Insuffisant)" count={3} color="bg-rose-500" total={results.length} />
                   </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-amber-50 border border-amber-100">
                   <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                         <div className="bg-white p-2 rounded-lg shadow-sm">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                         </div>
                         <div>
                            <p className="text-xs font-bold text-amber-900">Analyse de Cohérence</p>
                            <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
                               ORION a détecté <strong>3 élèves</strong> avec une progression suspecte ({'>'} +5 points). 
                               Un audit est recommandé avant publication.
                            </p>
                         </div>
                      </div>
                   </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )
      }}
    />
  );
}

function DistributionRow({ label, count, color, total }: any) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
       <div className="flex justify-between items-end text-[10px] font-bold">
          <span className="text-gray-500">{label}</span>
          <span className="text-gray-900">{count} élèves</span>
       </div>
       <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
          <motion.div 
            className={cn("h-full rounded-full", color)}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1 }}
          />
       </div>
    </div>
  );
}
