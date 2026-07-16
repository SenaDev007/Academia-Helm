/**
 * ============================================================================
 * LIBRARY INVENTORY — Branché sur backend réel (Standardisé)
 * ============================================================================
 *
 * Endpoint (création campagne) : POST /modules-complementaires/library/inventory/campaigns
 * Endpoint (scan exemplaire)   : POST /modules-complementaires/library/inventory/scan
 *
 * Note : la liste des campagnes reste en mock car le backend n'expose pas
 * encore de GET dédié pour les récupérer.
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { ClipboardCheck, Barcode, Plus, ChevronRight, PackageSearch, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface NewCampaignFormData {
  title: string;
  period: string;
}

const emptyCampaignForm: NewCampaignFormData = { title: '', period: '' };

export default function LibraryInventory() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState<NewCampaignFormData>(emptyCampaignForm);
  const [scanCode, setScanCode] = useState('');
  const [submittingCampaign, setSubmittingCampaign] = useState(false);
  const [submittingScan, setSubmittingScan] = useState(false);

  const handleCreateCampaign = async () => {
    try {
      setSubmittingCampaign(true);
      await modulesApi.post(
        'library/inventory/campaigns',
        campaignForm,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setCampaignForm(emptyCampaignForm);
      toast({ title: 'Campagne créée', description: "La campagne d'inventaire a été créée avec succès." });
    } catch (e: any) {
      console.error('Erreur création campagne :', e?.message || e);
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la création de la campagne', variant: 'destructive' });
    } finally {
      setSubmittingCampaign(false);
    }
  };

  const handleScan = async () => {
    try {
      setSubmittingScan(true);
      await modulesApi.post(
        'library/inventory/scan',
        { code: scanCode },
        buildModulesApiOptions(academicYear?.id),
      );
      setScanModalOpen(false);
      setScanCode('');
      toast({ title: 'Exemplaire scanné', description: 'Le scan a été enregistré avec succès.' });
    } catch (e: any) {
      console.error('Erreur scan :', e?.message || e);
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors du scan', variant: 'destructive' });
    } finally {
      setSubmittingScan(false);
    }
  };

  const campaigns = [
    { id: 'INV-2026-01', title: 'Inventaire Annuel - Section Collège', period: 'Mai 2026', progress: 65, status: 'IN_PROGRESS', found: 420, total: 650 },
    { id: 'INV-2025-02', title: 'Contrôle Trimestriel - Littérature', period: 'Janv 2026', progress: 100, status: 'VALIDATED', found: 145, total: 148 },
    { id: 'INV-2025-01', title: 'Inventaire Rentrée Scolaire', period: 'Sept 2025', progress: 100, status: 'COMPLETED', found: 1240, total: 1248 },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <PackageSearch className="w-5 h-5 mr-2 text-blue-600" />
            Campagnes d'Inventaire
          </h3>
          <p className="text-slate-500 text-sm">Contrôlez l'intégrité de votre patrimoine documentaire.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setScanModalOpen(true)}>
            <Barcode className="w-4 h-4 mr-2" /> Mode Scan
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nouvelle Campagne
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {campaigns.map((camp) => (
          <Card key={camp.id} className="p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3">
                  <h4 className="text-lg font-semibold text-slate-900">{camp.title}</h4>
                  <Badge variant="outline" className={
                    camp.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                    camp.status === 'VALIDATED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500'
                  }>
                    {camp.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-xs text-slate-400 flex items-center">
                    <ClipboardCheck className="w-3.5 h-3.5 mr-2" />
                    Période: {camp.period}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center">
                    <Barcode className="w-3.5 h-3.5 mr-2" />
                    ID: {camp.id}
                  </div>
                </div>
              </div>

              <div className="flex-1 max-w-sm">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-500">Progression</span>
                  <span className="text-slate-900 font-semibold">{camp.progress}% ({camp.found}/{camp.total})</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${camp.progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                    style={{ width: `${camp.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline">
                  Rapport
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal Nouvelle Campagne */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle Campagne d&rsquo;Inventaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="camp-title">Titre</Label>
              <Input
                id="camp-title"
                type="text"
                placeholder="ex : Inventaire Annuel - Section Collège"
                value={campaignForm.title}
                onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="camp-period">Période</Label>
              <Input
                id="camp-period"
                type="text"
                placeholder="ex : Mai 2026"
                value={campaignForm.period}
                onChange={(e) => setCampaignForm({ ...campaignForm, period: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submittingCampaign}>
              Annuler
            </Button>
            <Button onClick={handleCreateCampaign} disabled={submittingCampaign}>
              {submittingCampaign && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submittingCampaign ? 'Envoi…' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Mode Scan */}
      <Dialog open={scanModalOpen} onOpenChange={setScanModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scanner un exemplaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="scan-code">Code-barres / ID</Label>
              <Input
                id="scan-code"
                type="text"
                placeholder="ex : BC-1234"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScanModalOpen(false)} disabled={submittingScan}>
              Annuler
            </Button>
            <Button onClick={handleScan} disabled={submittingScan}>
              {submittingScan && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submittingScan ? 'Scan…' : 'Scanner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
