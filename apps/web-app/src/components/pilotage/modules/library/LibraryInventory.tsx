/**
 * ============================================================================
 * LIBRARY INVENTORY — Branché sur backend réel
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
import { motion } from 'framer-motion';
import { ClipboardCheck, Barcode, ShieldCheck, AlertCircle, Plus, ChevronRight, PackageSearch, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface NewCampaignFormData {
  title: string;
  period: string;
}

const emptyCampaignForm: NewCampaignFormData = { title: '', period: '' };

export default function LibraryInventory() {
  const { academicYear } = useModuleContext();
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
      alert('Campagne d\'inventaire créée avec succès.');
    } catch (e: any) {
      console.error('Erreur création campagne :', e?.message || e);
      alert(e?.message || 'Erreur lors de la création de la campagne');
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
      alert('Exemplaire scanné avec succès.');
    } catch (e: any) {
      console.error('Erreur scan :', e?.message || e);
      alert(e?.message || 'Erreur lors du scan');
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
    <div className="space-y-8">
      {/* Header & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <PackageSearch className="w-6 h-6 mr-3 text-blue-600" />
            Campagnes d'Inventaire
          </h3>
          <p className="text-slate-500 text-sm font-medium">Contrôlez l'intégrité de votre patrimoine documentaire.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScanModalOpen(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            <Barcode className="w-4 h-4 text-slate-400" />
            <span>Mode Scan</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/10"
          >
            <Plus className="w-4 h-4 text-[#C9A84C]" />
            <span>Nouvelle Campagne</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {campaigns.map((camp, i) => (
          <motion.div
            key={camp.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all group"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <h4 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{camp.title}</h4>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    camp.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600' :
                    camp.status === 'VALIDATED' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {camp.status}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <ClipboardCheck className="w-3.5 h-3.5 mr-2" />
                    Période: {camp.period}
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <Barcode className="w-3.5 h-3.5 mr-2" />
                    ID: {camp.id}
                  </div>
                </div>
              </div>

              <div className="flex-1 max-w-sm">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                  <span className="text-slate-500">Progression</span>
                  <span className="text-slate-900">{camp.progress}% ({camp.found}/{camp.total})</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${camp.progress}%` }}
                    className={`h-full rounded-full ${camp.progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex items-center px-6 py-3 bg-slate-50 hover:bg-navy-900 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                  Rapport
                  <ChevronRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modal Nouvelle Campagne */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-black text-slate-900">Nouvelle Campagne d&rsquo;Inventaire</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Titre</label>
                <input
                  type="text"
                  placeholder="ex : Inventaire Annuel - Section Collège"
                  value={campaignForm.title}
                  onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Période</label>
                <input
                  type="text"
                  placeholder="ex : Mai 2026"
                  value={campaignForm.period}
                  onChange={(e) => setCampaignForm({ ...campaignForm, period: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setModalOpen(false)}
                disabled={submittingCampaign}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={submittingCampaign}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submittingCampaign ? 'Envoi…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mode Scan */}
      {scanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-black text-slate-900">Scanner un exemplaire</h3>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Code-barres / ID</label>
              <input
                type="text"
                placeholder="ex : BC-1234"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setScanModalOpen(false)}
                disabled={submittingScan}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleScan}
                disabled={submittingScan}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submittingScan ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {submittingScan ? 'Scan…' : 'Scanner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
