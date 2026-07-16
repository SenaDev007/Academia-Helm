/**
 * ============================================================================
 * QHSE ALERTS & NOTIFICATIONS (Standardisé)
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Bell, AlertTriangle, ShieldAlert, CheckCircle2, Info, Loader2, Settings as SettingsIcon } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

interface AlertItem {
  id: string | number;
  title?: string;
  level?: string;
  severity?: string;
  time?: string;
  createdAt?: string;
  type?: string;
  category?: string;
  message?: string;
  description?: string;
  read?: boolean;
}

export default function QHSEAlerts() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: alerts, loading, error, refetch } = useModulesList<AlertItem>('qhse', 'alerts', academicYear?.id);

  const [markingAll, setMarkingAll] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | number | null>(null);

  const handleMarkRead = async (alertId: string | number) => {
    try {
      setActionLoading(alertId);
      await modulesApi.patch(`qhse/alerts/${alertId}/read`, {}, buildModulesApiOptions(academicYear?.id));
      await refetch();
      toast({ title: 'Alerte marquée comme lue', description: "L'alerte a été marquée comme lue." });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors du marquage', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await Promise.all(
        alerts.map((a) => modulesApi.patch(`qhse/alerts/${a.id}/read`, {}, buildModulesApiOptions(academicYear?.id))),
      );
      await refetch();
      toast({ title: 'Marquage global', description: 'Toutes les alertes ont été marquées comme lues.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors du marquage global', variant: 'destructive' });
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des alertes...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <Bell className="w-5 h-5 mr-2 text-rose-600" /> Centre d'Alertes QHSE
          </h3>
          <p className="text-slate-500 text-sm">Alertes critiques et notifications de conformité en temps réel.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <SettingsIcon className="w-5 h-5" />
          </Button>
          <Button variant="destructive" onClick={handleMarkAllRead} disabled={markingAll}>
            {markingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Tout Marquer Lu
          </Button>
        </div>
      </div>

      {alerts.length === 0 ? (
        <Card className="text-center py-16 text-slate-500 shadow-sm">
          Aucune alerte QHSE pour cette année scolaire.
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => {
            const level = alert.level || alert.severity || 'INFO';
            const time = alert.time || (alert.createdAt ? new Date(alert.createdAt).toLocaleString('fr-FR') : '—');
            const type = alert.type || alert.category || 'QHSE';
            const message = alert.message || alert.description || '';
            const title = alert.title || 'Alerte';
            const isCritical = level === 'CRITIQUE' || level === 'CRITICAL';
            const isImportant = level === 'IMPORTANT' || level === 'HIGH';
            return (
              <Card key={alert.id ?? i} className={`p-6 ${
                isCritical ? 'bg-rose-50 border-rose-100' :
                isImportant ? 'bg-amber-50 border-amber-100' : 'shadow-sm'
              } flex items-start gap-4 relative overflow-hidden`}>
                <div className={`p-4 rounded-xl shrink-0 ${
                  isCritical ? 'bg-rose-600 text-white' :
                  isImportant ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {isCritical ? <ShieldAlert className="w-6 h-6" /> : isImportant ? <AlertTriangle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
                    <span className="text-xs text-slate-400">{time}</span>
                  </div>
                  {message && <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">{message}</p>}
                  <div className="flex items-center gap-3 mt-3">
                    <Badge variant="outline" className="bg-slate-50">Source : {type}</Badge>
                    <Button
                      variant="link"
                      className="text-blue-600 h-auto p-0 ml-auto"
                    >
                      Voir les détails
                    </Button>
                    <Button
                      variant="link"
                      className="text-emerald-600 h-auto p-0"
                      onClick={() => handleMarkRead(alert.id)}
                      disabled={actionLoading === alert.id || alert.read}
                    >
                      {actionLoading === alert.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {alert.read ? 'Lu' : 'Marquer comme lu'}
                    </Button>
                  </div>
                </div>

                {isCritical && (
                  <div className="absolute top-0 right-0 p-2">
                    <div className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
