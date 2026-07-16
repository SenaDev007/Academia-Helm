/**
 * ============================================================================
 * QHSE PERIODIC CONTROLS (Standardisé)
 * ============================================================================
 * Note: utilise l'endpoint qhse/audits (filtre type=periodic) faute d'endpoint dédié.
 */

'use client';

import { Calendar, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface ControlItem {
  id: string | number;
  title?: string;
  name?: string;
  frequency?: string;
  lastCheck?: string;
  lastCheckedAt?: string;
  nextCheck?: string;
  nextDueDate?: string;
  status?: string;
  responsible?: string;
  assignee?: string;
}

export default function QHSEPeriodicControls() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: controls, loading, error } = useModulesList<ControlItem>('qhse', 'audits', academicYear?.id, { type: 'periodic' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des contrôles périodiques...</span>
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

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <RefreshCw className="w-5 h-5 mr-2 text-amber-600" /> Contrôles Périodiques
          </h3>
          <p className="text-slate-500 text-sm">Programmation des inspections récurrentes obligatoires.</p>
        </div>
        <Button
          onClick={() => toast({ title: 'Information', description: 'Programmation contrôle — fonctionnalité à venir.' })}
        >
          Programmer un Contrôle
        </Button>
      </div>

      {controls.length === 0 ? (
        <Card className="text-center py-16 text-slate-500 shadow-sm">
          Aucun contrôle périodique pour cette année scolaire.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {controls.map((control, i) => {
            const title = control.title || control.name || 'Contrôle';
            const frequency = control.frequency || 'PONCTUEL';
            const lastCheck = control.lastCheck || (control.lastCheckedAt ? new Date(control.lastCheckedAt).toLocaleDateString('fr-FR') : '—');
            const nextCheck = control.nextCheck || control.nextDueDate || '—';
            const status = control.status || 'OK';
            const responsible = control.responsible || control.assignee || '—';
            return (
              <Card key={control.id ?? i} className="p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-xl ${
                      status === 'RETARD' || status === 'LATE' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{title}</h4>
                      <p className="text-xs text-slate-400 mt-1">Fréquence : {frequency}</p>
                    </div>
                  </div>
                  <Badge variant={status === 'RETARD' || status === 'LATE' ? 'destructive' : 'outline'} className={
                    status === 'AUJOURD_HUI' || status === 'TODAY' ? 'bg-amber-100 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  }>
                    {status.replace(/_/g, ' ')}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Dernier passage</p>
                    <p className="text-sm font-semibold text-slate-900">{lastCheck}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Prochain passage</p>
                    <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      {nextCheck}
                      {(status === 'AUJOURD_HUI' || status === 'TODAY') && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-400 border-2 border-white shadow-sm">
                      {responsible[0]}
                    </div>
                    <p className="text-xs text-slate-500">{responsible}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Valider
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
