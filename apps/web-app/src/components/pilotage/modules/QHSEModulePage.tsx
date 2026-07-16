/**
 * ============================================================================
 * QHSE MODULE PAGE (Standardisé sur pattern Finance)
 * ============================================================================
 * Gère la Qualité, Hygiène, Sécurité et Environnement.
 *
 * Sous-modules : Dashboard, Incidents, Risques, Hygiène, Sécurité, Santé,
 * Audits, Plans d'action, Procédures, Contrôles, Alertes, Rapports,
 * Conformité, Paramètres.
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import {
  ShieldCheck, AlertTriangle, Activity, CheckCircle2,
  FileText, ClipboardList, Stethoscope,
  Plus, Download, Settings, Bell,
  LayoutDashboard, Scale, HardHat, Droplets, BookOpen,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';

// Sub-components
import QHSEDashboard from './qhse/QHSEDashboard';
import QHSEIncidents from './qhse/QHSEIncidents';
import QHSERisks from './qhse/QHSERisks';
import QHSEHygiene from './qhse/QHSEHygiene';
import QHSESecurity from './qhse/QHSESecurity';
import QHSEHealth from './qhse/QHSEHealth';
import QHSEAudits from './qhse/QHSEAudits';
import QHSEActionPlans from './qhse/QHSEActionPlans';
import QHSEDocuments from './qhse/QHSEDocuments';
import QHSEPeriodicControls from './qhse/QHSEPeriodicControls';
import QHSEAlerts from './qhse/QHSEAlerts';
import QHSEReports from './qhse/QHSEReports';
import QHSECompliance from './qhse/QHSECompliance';
import QHSESettings from './qhse/QHSESettings';

interface QHSEStats {
  openIncidents?: number;
  totalRisks?: number;
  pendingAudits?: number;
  complianceRate?: number;
  [key: string]: any;
}

export default function QHSEModulePage() {
  const { academicYear, isLoading: contextLoading } = useModuleContext();
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const { data: stats } = useModulesDashboard<QHSEStats>('qhse', academicYear?.id);

  if (contextLoading) return <div className="p-8 text-center">Chargement...</div>;

  const complianceRate = Math.min(Math.max(stats?.complianceRate ?? 0, 0), 100);

  return (
    <ModuleContainer
      header={{
        title: 'QHSE',
        description:
          "Pilotage Qualité, Hygiène, Sécurité et Environnement : incidents, risques, audits, plans d'action, contrôles, conformité et rapports",
        icon: 'shield',
        kpis: stats
          ? [
              {
                label: 'Incidents Ouverts',
                value: String(stats.openIncidents ?? 0),
                icon: 'warning',
                trend: 'up',
              },
              {
                label: 'Risques Suivis',
                value: String(stats.totalRisks ?? 0),
                icon: 'shield',
                trend: 'neutral',
              },
              {
                label: 'Audits en Cours',
                value: String(stats.pendingAudits ?? 0),
                icon: 'shieldCheck',
                trend: 'neutral',
              },
              {
                label: 'Conformité',
                value: `${complianceRate}%`,
                icon: 'shieldCheck',
                trend: 'up',
              },
            ]
          : [],
        actions: (
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 transition-all">
              <Plus className="w-4 h-4" /> Signaler un Incident
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition-all">
              <Download className="w-4 h-4" /> Exporter
            </button>
          </div>
        ),
      }}
      subModules={{
        activeModuleId: activeSubModuleId,
        onModuleChange: setActiveSubModuleId,
        modules: [
          { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'incidents', label: 'Incidents', icon: <AlertTriangle className="w-4 h-4" /> },
          { id: 'risks', label: 'Risques', icon: <Activity className="w-4 h-4" /> },
          { id: 'hygiene', label: 'Hygiène', icon: <Droplets className="w-4 h-4" /> },
          { id: 'security', label: 'Sécurité', icon: <HardHat className="w-4 h-4" /> },
          { id: 'health', label: 'Santé', icon: <Stethoscope className="w-4 h-4" /> },
          { id: 'audits', label: 'Audits', icon: <ClipboardList className="w-4 h-4" /> },
          { id: 'plans', label: "Plans d'action", icon: <CheckCircle2 className="w-4 h-4" /> },
          { id: 'docs', label: 'Procédures', icon: <FileText className="w-4 h-4" /> },
          { id: 'controls', label: 'Contrôles', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'alerts', label: 'Alertes', icon: <Bell className="w-4 h-4" /> },
          { id: 'reports', label: 'Rapports', icon: <Download className="w-4 h-4" /> },
          { id: 'compliance', label: 'Conformité', icon: <Scale className="w-4 h-4" /> },
          { id: 'settings', label: 'Paramètres', icon: <Settings className="w-4 h-4" /> },
        ],
      }}
      content={
        activeSubModuleId === 'dashboard' ? { layout: 'default', children: <QHSEDashboard /> } :
        activeSubModuleId === 'incidents' ? { layout: 'default', children: <QHSEIncidents /> } :
        activeSubModuleId === 'risks' ? { layout: 'default', children: <QHSERisks /> } :
        activeSubModuleId === 'hygiene' ? { layout: 'default', children: <QHSEHygiene /> } :
        activeSubModuleId === 'security' ? { layout: 'default', children: <QHSESecurity /> } :
        activeSubModuleId === 'health' ? { layout: 'default', children: <QHSEHealth /> } :
        activeSubModuleId === 'audits' ? { layout: 'default', children: <QHSEAudits /> } :
        activeSubModuleId === 'plans' ? { layout: 'default', children: <QHSEActionPlans /> } :
        activeSubModuleId === 'docs' ? { layout: 'default', children: <QHSEDocuments /> } :
        activeSubModuleId === 'controls' ? { layout: 'default', children: <QHSEPeriodicControls /> } :
        activeSubModuleId === 'alerts' ? { layout: 'default', children: <QHSEAlerts /> } :
        activeSubModuleId === 'reports' ? { layout: 'default', children: <QHSEReports /> } :
        activeSubModuleId === 'compliance' ? { layout: 'default', children: <QHSECompliance /> } :
        activeSubModuleId === 'settings' ? { layout: 'default', children: <QHSESettings /> } :
        { layout: 'default', children: <QHSEDashboard /> }
      }
    />
  );
}
