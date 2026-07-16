/**
 * ============================================================================
 * TRANSPORT MODULE PAGE (MODULE 9.2) — Pattern Finance
 * ============================================================================
 * Gère le parc automobile, les chauffeurs, les itinéraires et le suivi.
 *
 * Refonte 7-e : layout custom → ModuleContainer (pattern Finance)
 * - Onglets SubModuleNavigation standard (bleus soulignés)
 * - KPIs dynamiques chargés via GET /transport/stats (véhicules / routes /
 *   chauffeurs / incidents ouverts) — les anciennes valeurs hardcodées
 *   "94.2% ponctualité" et "12/15 Bus" sont supprimées.
 * - Navigation par sous-modules déléguée à ModuleContainer.subModules.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Bus,
  Users,
  MapPin,
  Route,
  Calendar,
  Clock,
  ShieldAlert,
  PenTool,
  CreditCard,
  FileBarChart,
  Settings,
  Navigation,
  LayoutDashboard,
  Plus,
  Download,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// Sous-composants (aucun ne contient SubModuleNavigation — pattern StudentsModulePage)
import TransportDashboard from './transport/TransportDashboard';
import TransportVehicles from './transport/TransportVehicles';
import TransportDrivers from './transport/TransportDrivers';
import TransportRoutes from './transport/TransportRoutes';
import TransportStops from './transport/TransportStops';
import TransportStudents from './transport/TransportStudents';
import TransportSchedules from './transport/TransportSchedules';
import TransportTrips from './transport/TransportTrips';
import TransportAttendance from './transport/TransportAttendance';
import TransportIncidents from './transport/TransportIncidents';
import TransportMaintenance from './transport/TransportMaintenance';
import TransportPayments from './transport/TransportPayments';
import TransportReports from './transport/TransportReports';
import TransportSettings from './transport/TransportSettings';

interface TransportStats {
  activeVehicles?: number;
  totalVehicles?: number;
  activeRoutes?: number;
  totalRoutes?: number;
  driversCount?: number;
  activeDrivers?: number;
  openIncidents?: number;
  recentIncidents?: number;
}

export default function TransportModulePage() {
  const { academicYear, isLoading: contextLoading } = useModuleContext();
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const [stats, setStats] = useState<TransportStats | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (academicYear?.id) {
      loadTransportStats();
    }
  }, [academicYear?.id]);

  const loadTransportStats = async () => {
    try {
      const res = await fetch(
        `/api/modules-complementaires/transport/stats?academicYearId=${academicYear?.id}`,
      );
      if (res.ok) {
        const data = await res.json();
        setStats(data ?? null);
      }
    } catch (e) {
      console.error('Transport stats load error', e);
    }
  };

  const handleNotImplemented = (label: string) => {
    toast({
      title: 'Action non disponible',
      description: `${label} — utilisez les onglets ci-dessous pour gérer le transport.`,
    });
  };

  if (contextLoading) {
    return <div className="p-8 text-center text-gray-600">Chargement...</div>;
  }

  return (
    <ModuleContainer
      header={{
        title: 'Transport Scolaire',
        description:
          'Gestion intelligente du transport scolaire : parc automobile, chauffeurs, itinéraires, suivi en temps réel et sécurité des élèves.',
        icon: 'transport',
        kpis: stats
          ? [
              {
                label: 'Véhicules actifs',
                value: String(stats.activeVehicles ?? stats.totalVehicles ?? 0),
                icon: 'dashboard',
                trend: 'neutral',
              },
              {
                label: 'Routes actives',
                value: String(stats.activeRoutes ?? stats.totalRoutes ?? 0),
                icon: 'clock',
                trend: 'neutral',
              },
              {
                label: 'Chauffeurs',
                value: String(stats.driversCount ?? stats.activeDrivers ?? 0),
                icon: 'students',
                trend: 'neutral',
              },
              {
                label: 'Incidents ouverts',
                value: String(stats.openIncidents ?? stats.recentIncidents ?? 0),
                icon: 'warning',
                trend: stats.openIncidents ? 'up' : 'neutral',
              },
            ]
          : [],
        actions: (
          <div className="flex items-center gap-2">
            <Button onClick={() => setActiveSubModuleId('vehicles')}>
              <Plus className="w-4 h-4" /> Nouveau Véhicule
            </Button>
            <Button variant="outline" onClick={() => handleNotImplemented('Export rapport')}>
              <Download className="w-4 h-4" /> Exporter
            </Button>
          </div>
        ),
      }}
      subModules={{
        activeModuleId: activeSubModuleId,
        onModuleChange: setActiveSubModuleId,
        modules: [
          { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'vehicles', label: 'Véhicules', icon: <Bus className="w-4 h-4" /> },
          { id: 'drivers', label: 'Personnel', icon: <Users className="w-4 h-4" /> },
          { id: 'routes', label: 'Itinéraires', icon: <Route className="w-4 h-4" /> },
          { id: 'stops', label: 'Arrêts & Zones', icon: <MapPin className="w-4 h-4" /> },
          { id: 'students', label: 'Élèves', icon: <Users className="w-4 h-4" /> },
          { id: 'schedules', label: 'Planning', icon: <Calendar className="w-4 h-4" /> },
          { id: 'trips', label: 'Suivi Trajets', icon: <Navigation className="w-4 h-4" /> },
          { id: 'attendance', label: 'Présences', icon: <Clock className="w-4 h-4" /> },
          { id: 'incidents', label: 'Incidents', icon: <ShieldAlert className="w-4 h-4" /> },
          { id: 'maintenance', label: 'Maintenance', icon: <PenTool className="w-4 h-4" /> },
          { id: 'payments', label: 'Paiements', icon: <CreditCard className="w-4 h-4" /> },
          { id: 'reports', label: 'Rapports', icon: <FileBarChart className="w-4 h-4" /> },
          { id: 'settings', label: 'Paramètres', icon: <Settings className="w-4 h-4" /> },
        ],
      }}
      content={
        activeSubModuleId === 'dashboard' ? { layout: 'default', children: <TransportDashboard /> } :
        activeSubModuleId === 'vehicles' ? { layout: 'default', children: <TransportVehicles /> } :
        activeSubModuleId === 'drivers' ? { layout: 'default', children: <TransportDrivers /> } :
        activeSubModuleId === 'routes' ? { layout: 'default', children: <TransportRoutes /> } :
        activeSubModuleId === 'stops' ? { layout: 'default', children: <TransportStops /> } :
        activeSubModuleId === 'students' ? { layout: 'default', children: <TransportStudents /> } :
        activeSubModuleId === 'schedules' ? { layout: 'default', children: <TransportSchedules /> } :
        activeSubModuleId === 'trips' ? { layout: 'default', children: <TransportTrips /> } :
        activeSubModuleId === 'attendance' ? { layout: 'default', children: <TransportAttendance /> } :
        activeSubModuleId === 'incidents' ? { layout: 'default', children: <TransportIncidents /> } :
        activeSubModuleId === 'maintenance' ? { layout: 'default', children: <TransportMaintenance /> } :
        activeSubModuleId === 'payments' ? { layout: 'default', children: <TransportPayments /> } :
        activeSubModuleId === 'reports' ? { layout: 'default', children: <TransportReports /> } :
        activeSubModuleId === 'settings' ? { layout: 'default', children: <TransportSettings /> } :
        { layout: 'default', children: <TransportDashboard /> }
      }
    />
  );
}
