/**
 * ============================================================================
 * QHSE SECURITE SCOLAIRE (Standardisé)
 * ============================================================================
 */

'use client';

import { ShieldCheck, Lock, Video, Users, Bell, Eye, Radio, Map, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface SecurityItem {
  id: string | number;
  label?: string;
  name?: string;
  title?: string;
  status?: string;
  icon?: any;
  color?: string;
  bg?: string;
  lastCheck?: string;
  lastCheckedAt?: string;
}

const LABEL_ICONS: Record<string, any> = {
  Accès: Lock,
  Vidéo: Video,
  Alarme: Bell,
  Éclairage: Eye,
};

function pickLabelIcon(label?: string) {
  if (!label) return ShieldCheck;
  const key = Object.keys(LABEL_ICONS).find((k) => label.includes(k));
  return key ? LABEL_ICONS[key] : ShieldCheck;
}

export default function QHSESecurity() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: securityItems, loading, error } = useModulesList<SecurityItem>('qhse', 'security', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des équipements de sécurité...</span>
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

      {/* Real-time Monitoring Bar */}
      <div className="bg-slate-900 text-white p-6 rounded-xl flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400">Système Live</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/60 border-l border-white/10 pl-6">
            <Radio className="w-4 h-4" /> {securityItems.length} Équipements suivis
          </div>
          <div className="flex items-center gap-4 text-xs text-white/60 border-l border-white/10 pl-6">
            <Users className="w-4 h-4" /> 45 Visiteurs déclarés
          </div>
        </div>
        <Button
          variant="secondary"
          className="bg-white/10 hover:bg-white/20 text-white"
          onClick={() => toast({ title: 'Information', description: 'Poste de contrôle — fonctionnalité à venir.' })}
        >
          Accéder au Poste de Contrôle
        </Button>
      </div>

      {securityItems.length === 0 ? (
        <Card className="text-center py-16 text-slate-500 shadow-sm">
          Aucun équipement de sécurité enregistré pour cette année scolaire.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {securityItems.map((item, i) => {
            const Icon = item.icon || pickLabelIcon(item.label || item.name);
            const color = item.color || 'text-emerald-600';
            const bg = item.bg || 'bg-emerald-50';
            const label = item.label || item.name || item.title || 'Équipement';
            const status = item.status || 'OPERATIONNEL';
            const lastCheck = item.lastCheck || item.lastCheckedAt || '—';
            return (
              <Card key={item.id ?? i} className="p-6 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-all">
                <div className={`p-5 rounded-xl ${bg} ${color} mb-4`}>
                  <Icon className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">{label}</h4>
                <p className="text-xs text-slate-400 mb-3">{lastCheck}</p>
                <Badge variant="outline" className={
                  status === 'OPERATIONNEL' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                  status === 'MAINTENANCE' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                }>
                  {status}
                </Badge>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visitors Log */}
        <Card className="p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Users className="w-5 h-5 mr-2 text-slate-400" /> Registre Visiteurs
            </h3>
            <Button variant="link" className="text-emerald-600 h-auto p-0">Voir Tout</Button>
          </div>
          <div className="space-y-3">
            {/* TODO: endpoint dédié au registre visiteurs non disponible, données locales */}
            {[
              { id: 1, name: 'Jean Dupont', target: 'Mme Koffi', time: '08:15', type: 'Parent' },
              { id: 2, name: 'Saliou Service', target: 'Direction', time: '09:30', type: 'Fournisseur' },
              { id: 3, name: 'Amina Diallo', target: 'Secrétariat', time: '10:15', type: 'Ancien élève' },
            ].map((v) => (
              <div key={v.id} className="p-4 bg-slate-50 rounded-xl flex items-center justify-between hover:bg-slate-100 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 font-semibold text-xs">
                    {v.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">{v.name}</p>
                    <p className="text-xs text-slate-400">{v.type} • Rdv avec {v.target}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-900">{v.time}</p>
                  <p className="text-xs text-emerald-600">Entrée Validée</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Security Map Preview */}
        <div className="bg-slate-900 rounded-xl p-8 text-white flex flex-col justify-center items-center relative overflow-hidden shadow-xl">
          <Map className="w-24 h-24 mb-6 text-white/20" />
          <h3 className="text-2xl font-semibold text-center">Plan d'Évacuation & Points Chauds</h3>
          <p className="text-sm text-white/40 mt-2 text-center max-w-xs">Visualisez l'état sécuritaire de chaque bâtiment en temps réel.</p>
          <Button
            className="mt-6 bg-emerald-600 hover:bg-emerald-500"
            onClick={() => toast({ title: 'Information', description: 'Carte interactive — fonctionnalité à venir.' })}
          >
            Ouvrir la Carte Interactive
          </Button>
          <div className="absolute top-6 right-6 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-xs">
            3 Zones Sensibles
          </div>
        </div>
      </div>
    </div>
  );
}
