/**
 * ============================================================================
 * QHSE INCIDENT REGISTER (Standardisé)
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { AlertTriangle, MapPin, Clock, User, Search, Filter, Plus, Eye, Loader2, Paperclip, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface IncidentItem {
  id: string;
  type?: string;
  title?: string;
  gravity?: string;
  severity?: string;
  location?: string;
  person?: string;
  date?: string;
  createdAt?: string;
  status?: string;
}

const EMPTY_FORM = { title: '', type: '', severity: 'FAIBLE', description: '', location: '' };

export default function QHSEIncidents() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: incidents, loading, error, refetch } = useModulesList<IncidentItem>('qhse', 'incidents', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [attachModalFor, setAttachModalFor] = useState<IncidentItem | null>(null);
  const [attachUrl, setAttachUrl] = useState('');
  const [attachName, setAttachName] = useState('');
  const [attaching, setAttaching] = useState(false);

  const handleCreate = async () => {
    if (!formData.title) {
      toast({ title: 'Champ requis', description: 'Le titre est requis', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('qhse/incidents', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
      toast({ title: 'Incident créé', description: "L'incident a été signalé avec succès." });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la création de l\'incident', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttach = async () => {
    if (!attachModalFor) return;
    try {
      setAttaching(true);
      await modulesApi.post(
        `qhse/incidents/${attachModalFor.id}/attachments`,
        { url: attachUrl, name: attachName },
        buildModulesApiOptions(academicYear?.id),
      );
      setAttachModalFor(null);
      setAttachUrl('');
      setAttachName('');
      await refetch();
      toast({ title: 'Pièce jointe ajoutée', description: 'La pièce jointe a été enregistrée.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de l\'ajout de la pièce jointe', variant: 'destructive' });
    } finally {
      setAttaching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des incidents...</span>
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

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher un incident..."
              className="w-full pl-12"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Signaler un Incident
          </Button>
        </div>
      </div>

      {incidents.length === 0 ? (
        <Card className="text-center py-16 text-slate-500 shadow-sm">
          Aucun incident enregistré pour cette année scolaire.
        </Card>
      ) : (
        /* Incident List */
        <Card className="shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="px-6 py-4">ID / Type</TableHead>
                <TableHead className="px-6 py-4">Gravité</TableHead>
                <TableHead className="px-6 py-4">Lieu / Personne</TableHead>
                <TableHead className="px-6 py-4">Date</TableHead>
                <TableHead className="px-6 py-4 text-right">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident, i) => {
                const gravity = incident.gravity || incident.severity || 'FAIBLE';
                const type = incident.type || incident.title || 'Incident';
                const location = incident.location || '—';
                const person = incident.person || '—';
                const date = incident.date || (incident.createdAt ? new Date(incident.createdAt).toLocaleDateString('fr-FR') : '—');
                const status = incident.status || 'DECLARE';
                return (
                  <TableRow key={incident.id || i} className="hover:bg-slate-50 cursor-pointer">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          gravity === 'URGENCE' || gravity === 'CRITIQUE' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'
                        }`}>
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{type}</p>
                          <p className="text-xs text-slate-400">{incident.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge variant="outline" className={
                        gravity === 'URGENCE' || gravity === 'CRITIQUE' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                        gravity === 'IMPORTANT' || gravity === 'HIGH' ? 'bg-amber-50 text-amber-600 border-amber-100' : ''
                      }>
                        {gravity}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> {location}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> {person}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs font-medium text-slate-500">{date}</TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Badge variant="outline" className={
                          status === 'RESOLU' || status === 'CLOTURE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          status === 'DECLARE' ? 'bg-blue-50 text-blue-600 border-blue-100' : ''
                        }>
                          {status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setAttachModalFor(incident)}
                          title="Joindre une pièce jointe"
                        >
                          <Paperclip className="w-5 h-5 text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="w-5 h-5 text-slate-400" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Modal: Nouvel incident */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Signaler un incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="inc-title">Titre</Label>
              <Input
                id="inc-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Chute dans les escaliers"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-type">Type</Label>
              <select
                id="inc-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">— Sélectionner —</option>
                <option value="ACCIDENT">Accident</option>
                <option value="PRESQUE_ACCIDENT">Presque accident</option>
                <option value="INCENDIE">Incendie</option>
                <option value="SECURITE">Sécurité</option>
                <option value="ENVIRONNEMENT">Environnement</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-severity">Gravité</Label>
              <select
                id="inc-severity"
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="FAIBLE">Faible</option>
                <option value="IMPORTANT">Important</option>
                <option value="CRITIQUE">Critique</option>
                <option value="URGENCE">Urgence</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-location">Lieu</Label>
              <Input
                id="inc-location"
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ex: Bâtiment A, 2ème étage"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-desc">Description</Label>
              <textarea
                id="inc-desc"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                placeholder="Décrivez l'incident..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Pièce jointe */}
      <Dialog open={!!attachModalFor} onOpenChange={(o) => !o && setAttachModalFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Joindre une pièce jointe</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500">Incident : <span className="font-semibold">{attachModalFor?.title || attachModalFor?.type || attachModalFor?.id}</span></p>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="attach-name">Nom du fichier</Label>
              <Input
                id="attach-name"
                type="text"
                value={attachName}
                onChange={(e) => setAttachName(e.target.value)}
                placeholder="Ex: photo-incident.jpg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attach-url">URL / Lien</Label>
              <Input
                id="attach-url"
                type="text"
                value={attachUrl}
                onChange={(e) => setAttachUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachModalFor(null)}>
              Annuler
            </Button>
            <Button onClick={handleAttach} disabled={attaching}>
              {attaching && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {attaching ? 'Envoi...' : 'Joindre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
