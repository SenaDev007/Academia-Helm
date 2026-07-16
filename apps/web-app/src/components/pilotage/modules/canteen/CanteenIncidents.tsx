/**
 * ============================================================================
 * CANTEEN INCIDENTS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint (lecture)   : GET  /modules-complementaires/canteen/incidents
 * Endpoint (création)  : POST /modules-complementaires/canteen/incidents
 *
 * Refonte juillet 2026 (Task 7-d) :
 *  - alert() → toast() via useToast()
 *  - fixed inset-0 modal → <Dialog> shadcn
 *  - <input>/<label>/<button> HTML → <Input>/<Label>/<Button> shadcn
 *  - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-semibold
 *  - bouton "Signaler un Incident" bg-red-600 → <Button variant="destructive">
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import {
  Search, Plus,
  AlertCircle, Activity, CheckCircle2,
  User, MoreHorizontal,
  FileText, Camera, Loader2, ShieldAlert,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface IncidentItem {
  id: string;
  type?: string;
  category?: string;
  severity?: string;
  title?: string;
  subject?: string;
  student?: string;
  studentName?: string;
  date?: string;
  incidentDate?: string;
  createdAt?: string;
  desc?: string;
  description?: string;
  comment?: string;
  status?: string;
  [key: string]: any;
}

interface NewIncidentFormData {
  type: string;
  description: string;
  severity: string;
}

const emptyIncidentForm: NewIncidentFormData = { type: 'HYGIENE', description: '', severity: 'MEDIUM' };

export default function CanteenIncidents() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<NewIncidentFormData>(emptyIncidentForm);
  const [submitting, setSubmitting] = useState(false);
  const { data: incidents, loading, error, refetch } = useModulesList<IncidentItem>(
    'canteen',
    'incidents',
    academicYear?.id,
  );

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'canteen/incidents',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(emptyIncidentForm);
      await refetch();
      toast({ title: 'Incident signalé', description: 'L’incident a été enregistré.' });
    } catch (e: any) {
      console.error('Erreur création incident :', e?.message || e);
      toast({
        title: 'Erreur signalement',
        description: e?.message || 'Erreur lors de la création de l’incident',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = incidents.filter((i) => {
    const s = (i.status ?? '').toLowerCase();
    return s.includes('cours') || s.includes('open') || s.includes('ouvert');
  }).length;
  const resolvedCount = incidents.filter((i) => {
    const s = (i.status ?? '').toLowerCase();
    return s.includes('résolu') || s.includes('resolu') || s.includes('resolved');
  }).length;
  const monthCount = incidents.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des incidents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Incident Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusCard
          title="Incidents Ouverts"
          value={String(openCount).padStart(2, '0')}
          desc="Action requise immédiate"
          icon={AlertCircle}
          color="red"
        />
        <StatusCard
          title="Hygiène & Salubrité"
          value="100%"
          desc="Dernière inspection : Hier"
          icon={ShieldAlert}
          color="emerald"
        />
        <StatusCard
          title="Incidents (Mois)"
          value={String(monthCount).padStart(2, '0')}
          desc="Tendance en baisse"
          icon={Activity}
          color="blue"
        />
        <StatusCard
          title="Résolus (Total)"
          value={String(resolvedCount).padStart(2, '0')}
          desc="Délai moyen : 4h"
          icon={CheckCircle2}
          color="blue"
        />
      </div>

      <Card className="p-0 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-gray-50 to-white">
          <div>
            <h3 className="font-semibold text-navy-900 text-lg">Journal d’Hygiène & Sécurité</h3>
            <p className="text-gray-500 text-sm mt-1">Traçabilité des incidents et mesures correctives</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher un incident..."
                className="pl-10 w-64"
              />
            </div>
            <Button variant="destructive" onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Signaler un Incident
            </Button>
          </div>
        </div>

        {incidents.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            Aucun incident enregistré pour cette année scolaire.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {incidents.map((inc) => (
              <IncidentRow
                key={inc.id}
                type={inc.type ?? inc.category ?? 'Incident'}
                severity={inc.severity ?? 'MEDIUM'}
                title={inc.title ?? inc.subject ?? 'Incident'}
                student={inc.student ?? inc.studentName}
                date={inc.date ?? inc.incidentDate ?? inc.createdAt ?? '—'}
                desc={inc.desc ?? inc.description ?? inc.comment ?? ''}
                status={inc.status ?? 'En cours'}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Modal Signaler un Incident */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Signaler un Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="inc-type">Type</Label>
              <select
                id="inc-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="HYGIENE">Hygiène</option>
                <option value="SECURITE">Sécurité</option>
                <option value="QUALITE">Qualité</option>
                <option value="ALLERGIE">Allergie</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-severity">Sévérité</Label>
              <select
                id="inc-severity"
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="LOW">Faible</option>
                <option value="MEDIUM">Moyenne</option>
                <option value="HIGH">Élevée</option>
                <option value="CRITICAL">Critique</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-desc">Description</Label>
              <textarea
                id="inc-desc"
                rows={4}
                placeholder="Décrivez l’incident..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi…' : 'Signaler'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusCard({ title, value, desc, icon: Icon, color }: any) {
  const colors: any = {
    red: 'text-red-600 bg-red-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    indigo: 'text-blue-600 bg-blue-50',
  };
  return (
    <Card className="p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-gray-500 text-xs font-medium">{title}</p>
      <p className="text-2xl font-semibold text-navy-900 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{desc}</p>
    </Card>
  );
}

function IncidentRow({ type, severity, title, student, date, desc, status }: any) {
  const severityStyles: any = {
    'CRITICAL': 'bg-red-500 text-white',
    'CRITIQUE': 'bg-red-500 text-white',
    'HIGH': 'bg-orange-500 text-white',
    'MEDIUM': 'bg-amber-500 text-white',
    'LOW': 'bg-blue-500 text-white',
  };
  const severityStyle = severityStyles[severity] ?? severityStyles['MEDIUM'];

  const statusStyles: any = {
    'En cours': 'bg-amber-50 text-amber-600 border-amber-100',
    'Résolu': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Resolved': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  const statusStyle = statusStyles[status] ?? statusStyles['En cours'];

  return (
    <div className="p-6 hover:bg-red-50/20 transition-all">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex items-start space-x-4 flex-1">
          <div className={`p-3 rounded-xl ${severityStyle}`}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-medium text-gray-500">{type}</span>
              <span className="text-gray-200">|</span>
              <span className="text-xs text-gray-400">{date}</span>
            </div>
            <h4 className="text-base font-semibold text-navy-900">{title}</h4>
            {student && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
                <User className="w-3 h-3 mr-1" />
                {student}
              </Badge>
            )}
            {desc && <p className="text-sm text-gray-500 italic mt-2 max-w-2xl">« {desc} »</p>}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <Badge variant="outline" className={statusStyle}>
            {status}
          </Badge>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon">
              <FileText className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Camera className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
