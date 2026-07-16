/**
 * ============================================================================
 * QHSE SANTE & INFIRMERIE (Standardisé)
 * ============================================================================
 */

'use client';

import { Stethoscope, Calendar, Activity, AlertCircle, Pill, Phone, Loader2, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface HealthVisitItem {
  id: string;
  patient?: string;
  patientName?: string;
  reason?: string;
  motif?: string;
  time?: string;
  timeOfVisit?: string;
  status?: string;
  emergency?: boolean;
  isEmergency?: boolean;
}

export default function QHSEHealth() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: visits, loading, error } = useModulesList<HealthVisitItem>('qhse', 'health', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des passages infirmerie...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Passages Jour', value: String(visits.length), icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Urgences', value: String(visits.filter((v) => v.emergency || v.isEmergency).length).padStart(2, '0'), icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Repos actuel', value: String(visits.filter((v) => v.status === 'REPOS').length).padStart(2, '0'), icon: Pill, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Stabilité Sanitaire', value: 'ALERTE', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat, i) => (
          <Card key={i} className="p-6 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400">{stat.label}</p>
              <p className="text-xl font-semibold text-slate-900">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Visits */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Stethoscope className="w-5 h-5 mr-2 text-emerald-600" /> Passages Récents
            </h3>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => toast({ title: 'Information', description: 'Nouveau passage — fonctionnalité à venir.' })}
            >
              <Plus className="w-4 h-4 mr-2" /> Nouveau Passage
            </Button>
          </div>
          {visits.length === 0 ? (
            <Card className="text-center py-16 text-slate-500 shadow-sm">
              Aucun passage infirmerie enregistré pour cette année scolaire.
            </Card>
          ) : (
            <Card className="shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="px-6 py-4">Patient</TableHead>
                    <TableHead className="px-6 py-4">Motif / Symptômes</TableHead>
                    <TableHead className="px-6 py-4">Heure</TableHead>
                    <TableHead className="px-6 py-4 text-right">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visits.map((visit) => {
                    const patient = visit.patient || visit.patientName || 'Patient';
                    const reason = visit.reason || visit.motif || '—';
                    const time = visit.time || visit.timeOfVisit || '—';
                    const status = visit.status || '—';
                    const emergency = visit.emergency || visit.isEmergency;
                    return (
                      <TableRow key={visit.id} className="hover:bg-slate-50 cursor-pointer">
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-semibold text-xs">
                              {patient[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 leading-tight">{patient}</p>
                              <p className="text-xs text-slate-400">{visit.id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {emergency && <AlertCircle className="w-4 h-4 text-rose-600 animate-pulse" />}
                            <p className="text-xs font-medium text-slate-600">{reason}</p>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-xs font-semibold text-slate-900">{time}</TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          <Badge variant="outline" className={
                            status === 'ÉVACUÉ' || status === 'EVACUE' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            status === 'REPOS' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }>
                            {status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        {/* Medical Stock Alert */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Vigilance Pharmacie</h3>
          <Card className="p-6 space-y-4 shadow-sm">
            {/* TODO: endpoint dédié au stock pharmacie non disponible, données locales */}
            {[
              { item: 'Paracétamol (Boîtes)', stock: 5, min: 10, status: 'CRITIQUE' },
              { item: 'Compresses Stériles', stock: 12, min: 20, status: 'FAIBLE' },
              { item: 'Solution Hydro-alcoolique', stock: 45, min: 20, status: 'OK' },
            ].map((stock, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-slate-900">{stock.item}</p>
                  <Badge variant="outline" className={
                    stock.status === 'CRITIQUE' ? 'text-rose-600 border-rose-100' :
                    stock.status === 'FAIBLE' ? 'text-amber-600 border-amber-100' : 'text-emerald-600 border-emerald-100'
                  }>
                    {stock.status}
                  </Badge>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${
                    stock.status === 'CRITIQUE' ? 'bg-rose-600' : stock.status === 'FAIBLE' ? 'bg-amber-600' : 'bg-emerald-600'
                  }`} style={{ width: `${Math.min((stock.stock / stock.min) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
            <Button
              variant="secondary"
              className="w-full bg-slate-900 hover:bg-slate-800"
              onClick={() => toast({ title: 'Information', description: 'Passer une commande — fonctionnalité à venir.' })}
            >
              Passer une Commande
            </Button>
          </Card>

          <div className="bg-rose-50 border border-rose-100 rounded-xl p-6 flex items-start gap-4">
            <Phone className="w-5 h-5 text-rose-600 shrink-0 mt-1" />
            <div>
              <p className="text-sm font-semibold text-rose-900">Numéros d'Urgence</p>
              <p className="text-xs text-rose-800/70 leading-relaxed">Samu: 15 • Pompiers: 18 • Médecin Référent: +225 07...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
