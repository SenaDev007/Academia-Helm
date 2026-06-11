/**
 * ============================================================================
 * MODULE 3 : CONFIGURATION PÉDAGOGIQUE
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { 
  Settings2, 
  Plus, 
  Save, 
  Trash2, 
  Shield, 
  Award, 
  Calculator,
  Layers,
  Scale
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { toast } from '@/components/ui/toast';
import { EXAMS_SUB_MODULES } from '../sub-modules';

export default function ConfigPage() {
  const [types, setTypes] = useState<any[]>([]);
  const [scales, setScales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const [typesRes, scalesRes] = await Promise.all([
          institutionalExamsService.getEvaluationTypes(),
          institutionalExamsService.getGradeScales(),
        ]);
        setTypes(typesRes);
        setScales(scalesRes);
      } catch (error) {
        console.error('Error loading config', error);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  return (
    <ModuleContainer
      header={{
        title: 'Configuration Pédagogique',
        description: 'Définition des barèmes, types d\'évaluations et mentions.',
        icon: 'settings2',
      }}
      subModules={{ 
        modules: EXAMS_SUB_MODULES,
        activeModuleId: 'config'
      }}
      content={{
        layout: 'full',
        children: (
          <Tabs defaultValue="types" className="space-y-6">
            <TabsList className="bg-white p-1 border border-gray-100 shadow-sm rounded-xl">
              <TabsTrigger value="types" className="px-6 py-2 rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                <Layers className="w-4 h-4 mr-2" />
                Types d'Évaluations
              </TabsTrigger>
              <TabsTrigger value="scales" className="px-6 py-2 rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                <Scale className="w-4 h-4 mr-2" />
                Barèmes & Mentions
              </TabsTrigger>
              <TabsTrigger value="rules" className="px-6 py-2 rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                <Calculator className="w-4 h-4 mr-2" />
                Règles de Calcul
              </TabsTrigger>
            </TabsList>

            {/* Evaluation Types */}
            <TabsContent value="types">
              <Card className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Catégories d'Évaluations</CardTitle>
                    <CardDescription>Configurez les types d'examens (Devoir, Composition, etc.) et leurs poids par défaut.</CardDescription>
                  </div>
                  <Button size="sm" className="bg-blue-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter un type
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Poids (Coeff)</TableHead>
                        <TableHead>Barème Max</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {types.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-bold">{t.name}</TableCell>
                          <TableCell><Badge variant="outline">{t.code}</Badge></TableCell>
                          <TableCell>{t.defaultCoefficient}</TableCell>
                          <TableCell>/{t.defaultMaxScore}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="text-gray-400">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Grading Scales */}
            <TabsContent value="scales">
              <Card className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Barèmes des Mentions</CardTitle>
                    <CardDescription>Définissez les seuils de notes pour l'attribution automatique des mentions.</CardDescription>
                  </div>
                  <Button size="sm" className="bg-blue-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Nouvelle Mention
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Note Min</TableHead>
                        <TableHead>Note Max</TableHead>
                        <TableHead>Mention</TableHead>
                        <TableHead>Appréciation Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scales.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-black text-blue-600">{s.minGrade.toFixed(2)}</TableCell>
                          <TableCell className="font-black text-blue-600">{s.maxGrade.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                              {s.mention}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-500 italic text-sm">
                            {s.appreciation}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="text-gray-400">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Calculation Rules */}
            <TabsContent value="rules">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Moteur de Calcul</CardTitle>
                  <CardDescription>Configurez la manière dont les moyennes périodiques sont consolidées.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
                         <div className="flex items-center space-x-2 font-bold text-gray-900">
                            <Calculator className="w-5 h-5 text-blue-600" />
                            <span>Moyenne de Matière</span>
                         </div>
                         <p className="text-xs text-gray-500">Formule : (Σ Notes * Coeff Evaluation) / Σ Coeff Evaluation</p>
                         <div className="flex items-center space-x-2">
                            <input type="checkbox" checked readOnly className="rounded border-gray-300" />
                            <span className="text-sm">Appliquer les coefficients des évaluations</span>
                         </div>
                      </div>

                      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
                         <div className="flex items-center space-x-2 font-bold text-gray-900">
                            <Award className="w-5 h-5 text-amber-600" />
                            <span>Calcul des Rangs</span>
                         </div>
                         <p className="text-xs text-gray-500">Méthode : Classement standard (Ex aequo autorisés)</p>
                         <div className="flex items-center space-x-2">
                            <input type="checkbox" checked readOnly className="rounded border-gray-300" />
                            <span className="text-sm">Prendre en compte les élèves exclus</span>
                         </div>
                      </div>
                   </div>
                   
                   <div className="flex justify-end pt-4">
                      <Button className="bg-blue-600 px-8">
                         <Save className="w-4 h-4 mr-2" />
                         Enregistrer les paramètres
                      </Button>
                   </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )
      }}
    />
  );
}
