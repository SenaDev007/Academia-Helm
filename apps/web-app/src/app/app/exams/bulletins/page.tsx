/**
 * ============================================================================
 * MODULE 3 : BULLETINS & SYNTHÈSES
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { 
  FileCheck, 
  RefreshCcw, 
  Printer, 
  Share2, 
  ChevronRight,
  TrendingUp,
  Download,
  Eye,
  Award,
  AlertCircle
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicSettings } from '@/hooks/useAcademicSettings';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { toast } from '@/components/ui/toast';
import { EXAMS_SUB_MODULES } from '../sub-modules';

export default function BulletinsPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { getAppreciation, getScoreColor, isPassingGrade, maxScore } = useAcademicSettings();
  const [bulletins, setBulletins] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Note: En production, on récupérerait les périodes (Trimestres/Semestres)
  const currentPeriodId = "T1"; // Mock

  useEffect(() => {
    async function loadClasses() {
      if (!schoolLevel?.id || !academicYear?.id) return;
      try {
        // En vrai service, on filtrerait les classes par schoolLevel
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
    if (selectedClassId) loadBulletins();
  }, [selectedClassId]);

  const loadBulletins = async () => {
    try {
      setLoading(true);
      const res = await institutionalExamsService.getClassBulletins(selectedClassId, currentPeriodId);
      setBulletins(res);
    } catch (error) {
      console.error('Error loading bulletins', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      await institutionalExamsService.generateBulletins(selectedClassId, currentPeriodId);
      toast({ title: "Calcul terminé", description: "Les moyennes et rangs ont été mis à jour." });
      loadBulletins();
    } catch (error) {
      toast({ title: "Erreur", description: "Échec du calcul des moyennes", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (studentId: string) => {
    try {
      setDownloadingId(studentId);
      await institutionalExamsService.downloadBulletin(studentId, currentPeriodId);
      toast({ title: "Téléchargement réussi", description: "Le bulletin est en cours de téléchargement." });
    } catch (error: any) {
      const message = error.response?.status === 403 
        ? "Accès refusé : Cet élève a des arriérés de scolarité." 
        : "Erreur lors de la génération du PDF.";
      toast({ 
        title: "Action bloquée", 
        description: message, 
        variant: "destructive" 
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <ModuleContainer
      header={{
        title: 'Bulletins & Synthèses',
        description: 'Génération des moyennes, classements et documents officiels.',
        icon: 'fileCheck',
      }}
      subModules={{ 
        modules: EXAMS_SUB_MODULES,
        activeModuleId: 'bulletins'
      }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-6">
            {/* Filters and Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
              <div className="flex items-center space-x-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400">Classe</label>
                  <select 
                    value={selectedClassId} 
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="block w-48 text-sm font-semibold border-none bg-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400">Période</label>
                  <Badge variant="outline" className="block py-2 bg-blue-50 text-blue-700 border-blue-100">
                    Trimestre 1
                  </Badge>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button 
                  onClick={handleGenerate} 
                  disabled={generating} 
                  variant="outline"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <RefreshCcw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
                  Recalculer les Moyennes
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Printer className="w-4 h-4 mr-2" />
                  Impression Masse
                </Button>
                <Button variant="outline">
                  <Share2 className="w-4 h-4 mr-2" />
                  Publier
                </Button>
              </div>
            </div>

            {/* Bulletins Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="w-16 text-center">Rang</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead className="text-center">Moyenne</TableHead>
                    <TableHead className="text-center">Total Coeff</TableHead>
                    <TableHead>Mention</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulletins.map((b) => (
                    <TableRow key={b.id} className="hover:bg-gray-50/50 transition-colors">
                      <TableCell className="text-center font-black text-blue-600">
                        {b.classRank}<sup>{b.classRank === 1 ? 'er' : 'e'}</sup>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-gray-900">{b.student.lastName} {b.student.firstName}</div>
                        <div className="text-[10px] text-gray-400">{b.student.matricule}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`font-black text-sm px-3 border-none ${isPassingGrade(Number(b.generalAverage)) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {Number(b.generalAverage).toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-gray-500 font-medium">
                        {Number(b.totalCoefficient).toFixed(1)}
                      </TableCell>
                      <TableCell>
                        <MentionBadge average={Number(b.generalAverage)} getAppreciation={getAppreciation} getScoreColor={getScoreColor} />
                      </TableCell>
                      <TableCell>
                        {b.isPublished ? (
                          <Badge className="bg-blue-100 text-blue-700 border-none">Publié</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-400">Brouillon</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-gray-600 hover:text-blue-600"
                            onClick={() => handleDownload(b.studentId)}
                            disabled={downloadingId === b.studentId}
                          >
                            {downloadingId === b.studentId ? (
                              <RefreshCcw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {bulletins.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-20">
                        <div className="max-w-xs mx-auto">
                            <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">Les moyennes n'ont pas encore été calculées pour cette classe.</p>
                            <Button variant="link" onClick={handleGenerate} className="text-blue-600">Lancer le calcul maintenant</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      }}
    />
  );
}

function MentionBadge({ average, getAppreciation, getScoreColor }: {
  average: number;
  getAppreciation: (avg: number) => string;
  getScoreColor: (avg: number) => string;
}) {
  const label = getAppreciation(average);
  const colorClass = getScoreColor(average);
  if (!label) return <Badge className="bg-gray-100 text-gray-500 border-none">—</Badge>;
  return <Badge className={`border-none ${colorClass}`}>{label}</Badge>;
}
