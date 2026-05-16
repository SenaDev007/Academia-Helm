/**
 * ============================================================================
 * MODULE 3 : SAISIE DES NOTES
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { 
  Save, 
  ChevronLeft, 
  CheckCircle2, 
  AlertCircle,
  Search,
  User,
  MoreVertical,
  ClipboardList,
  Send,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useModuleContext } from '@/hooks/useModuleContext';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { toast } from '@/components/ui/toast';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { format } from 'date-fns';

export default function GradesPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<any>(null);
  const [gradingSheet, setGradingSheet] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadEvaluations() {
      if (!schoolLevel?.id || !academicYear?.id) return;
      try {
        setLoading(true);
        const res = await institutionalExamsService.getEvaluations({
          schoolLevelId: schoolLevel.id,
          academicYearId: academicYear.id,
          status: 'OPEN_FOR_GRADING'
        });
        setEvaluations(res);
      } catch (error) {
        console.error('Error loading evaluations', error);
      } finally {
        setLoading(false);
      }
    }
    loadEvaluations();
  }, [schoolLevel, academicYear]);

  const handleSelectEvaluation = async (ev: any) => {
    setSelectedEvaluation(ev);
    try {
      const sheet = await institutionalExamsService.getGradingSheet(ev.id);
      setGradingSheet(sheet);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de charger la grille de saisie", variant: "destructive" });
    }
  };

  const handleScoreChange = (studentId: string, score: string) => {
    setGradingSheet(prev => prev.map(row => 
      row.studentId === studentId ? { ...row, score: score === '' ? null : parseFloat(score) } : row
    ));
  };

  const handleSave = async () => {
    if (!selectedEvaluation) return;
    try {
      setSaving(true);
      await institutionalExamsService.saveGrades(selectedEvaluation.id, gradingSheet);
      toast({ title: "Succès", description: "Notes enregistrées avec succès" });
    } catch (error) {
      toast({ title: "Erreur", description: "Échec de l'enregistrement", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (selectedEvaluation) {
    return (
      <ModuleContainer
        header={{
          title: `Saisie : ${selectedEvaluation.title}`,
          description: `${selectedEvaluation.class.name} • ${selectedEvaluation.subject.name} (Barème /${selectedEvaluation.maxScore})`,
          icon: 'clipboardList',
        }}
        subModules={{ 
          modules: EXAMS_SUB_MODULES,
          activeModuleId: 'grades'
        }}
        content={{
          layout: 'full',
          children: (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <Button variant="ghost" onClick={() => setSelectedEvaluation(null)}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Retour à la liste
                </Button>
                <div className="flex items-center space-x-2">
                  <Button variant="outline">Importer Excel</Button>
                  {(selectedEvaluation.status === 'PLANNED' || selectedEvaluation.status === 'OPEN_FOR_GRADING') && (
                    <>
                      <Button onClick={handleSave} disabled={saving} className="bg-white text-blue-600 border-blue-200 hover:bg-blue-50">
                        <Save className="w-4 h-4 mr-2" />
                        Enregistrer Brouillon
                      </Button>
                      <Button 
                        onClick={async () => {
                          try {
                            setSaving(true);
                            await institutionalExamsService.saveGrades(selectedEvaluation.id, gradingSheet);
                            await institutionalExamsService.submitEvaluation(selectedEvaluation.id);
                            toast({ title: "Soumis", description: "L'évaluation a été envoyée pour validation." });
                            setSelectedEvaluation(null);
                          } catch (error: any) {
                            toast({ 
                              title: "Erreur", 
                              description: error.response?.data?.message || "Échec de la soumission", 
                              variant: "destructive" 
                            });
                          } finally {
                            setSaving(false);
                          }
                        }} 
                        disabled={saving} 
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Soumettre pour Validation
                      </Button>
                    </>
                  )}
                  {selectedEvaluation.status === 'VALIDATED' && (
                    <Badge className="bg-green-100 text-green-700 border-green-200 p-2 px-4">
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Évaluation Verrouillée
                    </Badge>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Élève</TableHead>
                      <TableHead className="w-32">Note / {selectedEvaluation.maxScore}</TableHead>
                      <TableHead className="w-24">Absent</TableHead>
                      <TableHead>Commentaire</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradingSheet.map((row, index) => (
                      <TableRow key={row.studentId}>
                        <TableCell className="text-gray-400 font-mono text-xs">{index + 1}</TableCell>
                        <TableCell className="font-medium">{row.studentName}</TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            step="0.25"
                            min="0"
                            max={selectedEvaluation.maxScore}
                            value={row.score ?? ''}
                            onChange={(e) => handleScoreChange(row.studentId, e.target.value)}
                            disabled={selectedEvaluation.status === 'VALIDATED' || selectedEvaluation.status === 'SUBMITTED'}
                            className="w-24 font-bold text-center"
                            placeholder="--"
                          />
                        </TableCell>
                        <TableCell>
                          <input 
                            type="checkbox" 
                            checked={row.isAbsent}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setGradingSheet(prev => prev.map(r => 
                                r.studentId === row.studentId ? { ...r, isAbsent: checked, score: checked ? 0 : r.score } : r
                              ));
                            }}
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            placeholder="Observation..." 
                            value={row.comment}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGradingSheet(prev => prev.map(r => 
                                r.studentId === row.studentId ? { ...r, comment: val } : r
                              ));
                            }}
                            className="text-sm bg-transparent border-none focus:bg-gray-50"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )
        }}
      />
    );
  }

  return (
    <ModuleContainer
      header={{
        title: 'Saisie des Notes',
        description: 'Sélectionnez une évaluation pour saisir les résultats des élèves.',
        icon: 'clipboardList',
      }}
      subModules={{ 
        modules: EXAMS_SUB_MODULES,
        activeModuleId: 'grades'
      }}
      content={{
        layout: 'full',
        children: (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {evaluations.map((ev) => (
              <div 
                key={ev.id} 
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={() => handleSelectEvaluation(ev)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-100">
                    En Saisie
                  </Badge>
                </div>
                <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{ev.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{ev.class.name} • {ev.subject.name}</p>
                <div className="flex items-center text-xs text-gray-400 space-x-3">
                  <span className="flex items-center"><User className="w-3 h-3 mr-1" /> {ev._count.grades} notes</span>
                  <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {format(new Date(ev.evaluationDate), 'dd/MM/yyyy')}</span>
                </div>
              </div>
            ))}
            {evaluations.length === 0 && !loading && (
              <div className="col-span-full py-20 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">Aucune évaluation n'est actuellement ouverte pour la saisie.</p>
                <Button variant="link" className="text-blue-600 mt-2">Voir toutes les évaluations</Button>
              </div>
            )}
          </div>
        )
      }}
    />
  );
}
