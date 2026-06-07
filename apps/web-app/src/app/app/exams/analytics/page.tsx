/**
 * ============================================================================
 * MODULE 3 : ANALYTIQUES & ORION
 * ============================================================================
 */

'use client';

import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Target, 
  AlertCircle,
  Zap,
  TrendingDown,
  PieChart,
  LineChart
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { EXAMS_SUB_MODULES } from '../sub-modules';

export default function AnalyticsPage() {
  return (
    <ModuleContainer
      header={{
        title: 'Analytique & Intelligence ORION',
        description: 'Analyse prédictive et suivi des performances académiques.',
        icon: 'barChart3',
      }}
      subModules={{ 
        modules: EXAMS_SUB_MODULES,
        activeModuleId: 'analytics'
      }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-6">
            {/* Orion Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Card className="border-l-4 border-l-amber-500 shadow-sm overflow-hidden bg-amber-50/30">
                  <CardHeader className="pb-2">
                     <div className="flex items-center space-x-2 text-amber-700">
                        <Zap className="w-5 h-5 fill-amber-500" />
                        <CardTitle className="text-sm font-black uppercase tracking-wider">Alerte Performance</CardTitle>
                     </div>
                  </CardHeader>
                  <CardContent>
                     <p className="text-sm text-amber-900 font-medium">La classe de 4ème B présente une chute de 15% de sa moyenne en Mathématiques par rapport au mois dernier.</p>
                     <Badge className="mt-4 bg-amber-200 text-amber-800 border-none">Analyse Requise</Badge>
                  </CardContent>
               </Card>

               <Card className="border-l-4 border-l-blue-500 shadow-sm overflow-hidden bg-blue-50/30">
                  <CardHeader className="pb-2">
                     <div className="flex items-center space-x-2 text-blue-700">
                        <Target className="w-5 h-5 fill-blue-500" />
                        <CardTitle className="text-sm font-black uppercase tracking-wider">Insight Réussite</CardTitle>
                     </div>
                  </CardHeader>
                  <CardContent>
                     <p className="text-sm text-blue-900 font-medium">Le programme de renforcement en Anglais a permis d'augmenter le taux de passage de 65% à 82% au Primaire.</p>
                     <Badge className="mt-4 bg-blue-200 text-blue-800 border-none">Impact Positif</Badge>
                  </CardContent>
               </Card>
            </div>

            {/* Performance Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <Card className="lg:col-span-2 shadow-sm border-gray-100">
                  <CardHeader>
                     <CardTitle className="text-md flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
                        Courbe de progression par niveau
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px] flex items-end space-x-8 px-8">
                     {['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'].map((lvl) => (
                        <div key={lvl} className="flex-1 flex flex-col items-center space-y-2">
                           <div className="w-full bg-blue-100 rounded-t-lg relative group cursor-pointer hover:bg-blue-600 transition-all" style={{ height: `${Math.random() * 80 + 20}%` }}>
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] px-2 py-1 rounded">
                                 {Math.floor(Math.random() * 5 + 12)}/20
                              </div>
                           </div>
                           <span className="text-xs font-bold text-gray-500">{lvl}</span>
                        </div>
                     ))}
                  </CardContent>
               </Card>

               <div className="space-y-4">
                  <Card className="shadow-sm border-gray-100">
                     <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-500 uppercase">Taux de Réussite Global</CardTitle>
                     </CardHeader>
                     <CardContent>
                        <div className="text-3xl font-black text-gray-900">78.4%</div>
                        <Progress value={78.4} className="h-2 mt-4 bg-gray-100" />
                        <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-bold uppercase">
                           <span>Cible: 85%</span>
                           <span className="text-green-600">+2.1% vs l'an dernier</span>
                        </div>
                     </CardContent>
                  </Card>
                  
                  <Card className="shadow-sm border-gray-100">
                     <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-500 uppercase">Élèves à Risque</CardTitle>
                     </CardHeader>
                     <CardContent>
                        <div className="text-3xl font-black text-red-600">12</div>
                        <p className="text-xs text-gray-500 mt-1">Moyenne générale &lt; 08/20</p>
                        <Button variant="link" className="p-0 h-auto text-blue-600 text-xs mt-4">Voir la liste détaillée</Button>
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
