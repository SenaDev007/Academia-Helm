/**
 * ============================================================================
 * HR MODULE - SETTINGS PAGE
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { 
  Shield, 
  Globe, 
  Clock, 
  FileText, 
  Save, 
  Info,
  Lock,
  History,
  UserCheck,
  Users,
  DollarSign
} from 'lucide-react';
import { ModuleHeader, SubModuleNavigation } from '@/components/modules/blueprint';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePathname } from 'next/navigation';

export default function HRSettingsPage() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  const subModuleTabs = [
    { id: 'overview', label: "Vue d'ensemble", path: '/app/hr', icon: UserCheck, exact: true },
    { id: 'staff', label: 'Personnel', path: '/app/hr/staff', icon: Users },
    { id: 'contracts', label: 'Contrats', path: '/app/hr/contracts', icon: FileText },
    { id: 'leaves', label: 'Congés & Absences', path: '/app/hr/leaves', icon: Clock },
    { id: 'planning', label: 'Planning', path: '/app/hr/planning', icon: Clock },
    { id: 'allowances', label: 'Indemnités', path: '/app/hr/allowances', icon: DollarSign },
    { id: 'payroll', label: 'Paie', path: '/app/hr/payroll', icon: DollarSign },
    { id: 'cnss', label: 'CNSS', path: '/app/hr/cnss', icon: Shield },
    { id: 'reporting', label: 'Rapports', path: '/app/hr/reporting', icon: FileText },
    { id: 'settings', label: 'Paramètres', path: '/app/hr/settings', icon: Shield },
  ];

  return (
    <div className="space-y-6 pb-20">
      <ModuleHeader
        title="Paramètres RH & Légal"
        description="Configuration des règles de paie, des barèmes fiscaux et des politiques de présence."
        icon="rh"
      />

      <div className="px-6">
        <SubModuleNavigation tabs={subModuleTabs} currentPath={pathname} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Configuration légale */}
          <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
            <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Globe size={20} className="text-blue-600" />
                Référentiel Légal
              </CardTitle>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-xs font-bold shadow-md">
                <Save size={14} /> Enregistrer
              </button>
            </CardHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase">Pays de référence</Label>
                <select className="w-full p-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold outline-none">
                  <option>Bénin (BJ)</option>
                  <option>Togo (TG)</option>
                  <option>Côte d'Ivoire (CI)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase">Devise de paie</Label>
                <input type="text" value="XOF" readOnly className="w-full p-2.5 bg-gray-50 border-none rounded-xl text-sm font-black text-blue-600" />
              </div>
              <div className="pt-4 flex items-center justify-between border-t border-gray-50">
                <div className="space-y-0.5">
                  <Label className="font-bold text-gray-800">Calcul automatique IRPP</Label>
                  <p className="text-xs text-gray-400">Appliquer les barèmes progressifs en vigueur</p>
                </div>
                <Switch checked />
              </div>
            </div>
          </Card>

          {/* Politique de présence */}
          <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
            <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Clock size={20} className="text-emerald-600" />
                Temps de Travail
              </CardTitle>
            </CardHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase">Début standard</Label>
                  <input type="time" defaultValue="08:00" className="w-full p-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase">Fin standard</Label>
                  <input type="time" defaultValue="18:00" className="w-full p-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold" />
                </div>
              </div>
              <div className="pt-4 flex items-center justify-between border-t border-gray-50">
                <div className="space-y-0.5">
                  <Label className="font-bold text-gray-800">Déduction absences</Label>
                  <p className="text-xs text-gray-400">Retirer automatiquement du salaire net</p>
                </div>
                <Switch checked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="font-bold text-gray-800">Validation Heures Sup</Label>
                  <p className="text-xs text-gray-400">Exiger une approbation administrative</p>
                </div>
                <Switch checked />
              </div>
            </div>
          </Card>

          {/* Sécurité et Archivage */}
          <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl bg-white p-6">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Lock size={20} className="text-amber-600" />
                Verrouillage & Sécurité
              </CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-2">
                <Shield className="text-gray-400 mb-2" size={20} />
                <h4 className="font-bold text-sm">Clôture Mensuelle</h4>
                <p className="text-[10px] text-gray-500">Verrouiller toute modification après validation de la paie.</p>
                <Switch className="mt-2" checked />
              </div>
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-2">
                <History className="text-gray-400 mb-2" size={20} />
                <h4 className="font-bold text-sm">Audit complet</h4>
                <p className="text-[10px] text-gray-500">Tracer chaque accès aux données salariales sensibles.</p>
                <Switch className="mt-2" checked />
              </div>
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-2">
                <FileText className="text-gray-400 mb-2" size={20} />
                <h4 className="font-bold text-sm">Coffre-fort</h4>
                <p className="text-[10px] text-gray-500">Chiffrer les documents contractuels sur le serveur.</p>
                <Switch className="mt-2" checked />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
