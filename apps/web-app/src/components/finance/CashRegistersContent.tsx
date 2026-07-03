'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Plus, Lock, Unlock, Archive, Edit, Trash2, BarChart3, X,
  Safe, Smartphone, Building2, Store, Banknote, TrendingUp, Clock,
  ArrowUpRight, ArrowDownRight, Receipt, ChevronRight, Sparkles,
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';

interface CashRegister {
  id: string;
  code: string;
  name: string;
  description?: string;
  location?: string;
  openingBalance: string | number;
  currentBalance: string | number;
  isOpen: boolean;
  isActive: boolean;
  openedAt?: string;
  closedAt?: string;
  responsibleUser?: { id: string; firstName: string; lastName: string; email: string };
  openedBy?: { id: string; firstName: string; lastName: string };
  closedBy?: { id: string; firstName: string; lastName: string };
  _count?: { transactions: number };
}

// Helper : choisir l'icône selon le code/nom de la caisse
function getCaisseIcon(reg: CashRegister) {
  const code = (reg.code || '').toUpperCase();
  const name = (reg.name || '').toLowerCase();
  if (code === 'MAIN' || name.includes('principal') || name.includes('coffre')) return Safe;
  if (name.includes('mobile') || name.includes('cellulaire')) return Smartphone;
  if (name.includes('cantine') || name.includes('shop') || name.includes('boutique')) return Store;
  if (name.includes('accueil') || name.includes('bureau')) return Building2;
  if (name.includes('banque') || name.includes('bank')) return Banknote;
  return Wallet;
}

// Couleurs pour les caisses secondaires (cycle)
const CAISSE_COLORS = [
  { bg: 'from-blue-500 to-cyan-500', ring: 'ring-blue-400', glow: 'shadow-blue-500/30', text: 'text-blue-600' },
  { bg: 'from-purple-500 to-pink-500', ring: 'ring-purple-400', glow: 'shadow-purple-500/30', text: 'text-purple-600' },
  { bg: 'from-amber-500 to-orange-500', ring: 'ring-amber-400', glow: 'shadow-amber-500/30', text: 'text-amber-600' },
  { bg: 'from-emerald-500 to-teal-500', ring: 'ring-emerald-400', glow: 'shadow-emerald-500/30', text: 'text-emerald-600' },
  { bg: 'from-rose-500 to-red-500', ring: 'ring-rose-400', glow: 'shadow-rose-500/30', text: 'text-rose-600' },
  { bg: 'from-indigo-500 to-violet-500', ring: 'ring-indigo-400', glow: 'shadow-indigo-500/30', text: 'text-indigo-600' },
];

// Noms de caisses prédéfinis avec auto-génération de code, emplacement et description
const PREDEFINED_CAISSES = [
  { name: 'Caisse principale', code: 'MAIN', location: 'Bureau de la Direction', description: 'Coffre-fort principal de l\'établissement — toutes les recettes y sont consolidées.' },
  { name: 'Caisse d\'accueil', code: 'ACCUEIL', location: 'Bureau d\'accueil', description: 'Caisse du secrétariat pour les paiements courants (inscriptions, frais divers).' },
  { name: 'Caisse cantine', code: 'CANTEEN', location: 'Réfectoire / Cantine', description: 'Caisse dédiée à la collecte des frais de cantine et snack.' },
  { name: 'Caisse mobile', code: 'MOBILE', location: 'Mobile / Terrain', description: 'Caisse mobile pour les encaissements sur le terrain (événements, sorties).' },
  { name: 'Caisse comptabilité', code: 'COMPTA', location: 'Service comptabilité', description: 'Caisse du service comptable pour les virements et dépenses.' },
  { name: 'Caisse economat', code: 'ECO', location: 'Économat / Magasin', description: 'Caisse de l\'économat pour les achats et approvisionnements.' },
  { name: 'Caisse examen', code: 'EXAMEN', location: 'Salle des examens', description: 'Caisse dédiée aux frais d\'examens et concours.' },
  { name: 'Caisse transport', code: 'TRANSPORT', location: 'Service transport', description: 'Caisse pour la collecte des frais de transport scolaire.' },
  { name: 'Caisse activités', code: 'ACTIVITES', location: 'Service activités parascolaires', description: 'Caisse pour les activités parascolaires, sorties et événements.' },
  { name: 'Caisse banque', code: 'BANQUE', location: 'Banque partenaire', description: 'Caisse de liaison avec le compte bancaire de l\'établissement.' },
];

export default function CashRegistersContent() {
  const confirmDialog = useConfirmDialog();
  const { toast } = useToast();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<CashRegister | null>(null);
  const [closeModal, setCloseModal] = useState<CashRegister | null>(null);
  const [statsModal, setStatsModal] = useState<CashRegister | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    location: '',
    openingBalance: '0',
    responsibleUserId: '',
  });

  const [closeForm, setCloseForm] = useState({
    countedBalance: '',
    note: '',
  });

  const loadRegisters = useCallback(async () => {
    try {
      setLoading(true);
      const data = await financeService.getCashRegisters();
      setRegisters(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e.message || 'Impossible de charger les caisses',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRegisters();
  }, [loadRegisters]);

  // Identifier la caisse principale (code MAIN ou première créée)
  const mainRegister = useMemo(() => {
    return registers.find((r) => r.code?.toUpperCase() === 'MAIN') || registers[0] || null;
  }, [registers]);

  // Caisses secondaires (toutes sauf la principale)
  const secondaryRegisters = useMemo(() => {
    if (!mainRegister) return registers;
    return registers.filter((r) => r.id !== mainRegister.id);
  }, [registers, mainRegister]);

  // Statistiques globales
  const globalStats = useMemo(() => {
    const totalBalance = registers.reduce((sum, r) => sum + Number(r.currentBalance || 0), 0);
    const openCount = registers.filter((r) => r.isOpen).length;
    const totalTransactions = registers.reduce((sum, r) => sum + (r._count?.transactions || 0), 0);
    return { totalBalance, openCount, totalCaisses: registers.length, totalTransactions };
  }, [registers]);

  // Handler : sélection d'un nom prédéfini → auto-génère code, emplacement, description
  const selectPredefinedCaisse = (predef: typeof PREDEFINED_CAISSES[0]) => {
    setFormData((prev) => ({
      ...prev,
      name: predef.name,
      code: predef.code,
      location: predef.location,
      description: predef.description,
    }));
  };

  // Handler : nom personnalisé → vide les champs auto-générés si le nom ne match plus
  const handleNameChange = (name: string) => {
    const match = PREDEFINED_CAISSES.find((p) => p.name === name);
    setFormData((prev) => ({
      ...prev,
      name,
      // Si le nom correspond à un prédéfini, auto-générer
      ...(match ? { code: match.code, location: match.location, description: match.description } : {}),
    }));
  };

  const handleCreate = async () => {
    if (!formData.code || !formData.name) {
      toast({ title: 'Erreur', description: 'Code et nom sont requis', variant: 'destructive' });
      return;
    }
    try {
      await financeService.createCashRegister({
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        location: formData.location || undefined,
        openingBalance: Number(formData.openingBalance) || 0,
        responsibleUserId: formData.responsibleUserId || undefined,
      });
      toast({ title: '✅ Caisse créée', description: `${formData.code} - ${formData.name}` });
      setCreateModal(false);
      setFormData({ code: '', name: '', description: '', location: '', openingBalance: '0', responsibleUserId: '' });
      loadRegisters();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleUpdate = async () => {
    if (!editModal) return;
    try {
      await financeService.updateCashRegister(editModal.id, {
        name: editModal.name,
        description: editModal.description,
        location: editModal.location,
      });
      toast({ title: '✅ Caisse mise à jour' });
      setEditModal(null);
      loadRegisters();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleOpen = async (reg: CashRegister) => {
    try {
      await financeService.openCashRegister(reg.id, {});
      toast({ title: '🔓 Caisse ouverte', description: `${reg.code} - ${reg.name}` });
      loadRegisters();
      if (selectedRegister?.id === reg.id) {
        setSelectedRegister({ ...reg, isOpen: true });
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleClose = async () => {
    if (!closeModal) return;
    try {
      const result = await financeService.closeCashRegister(closeModal.id, {
        countedBalance: closeForm.countedBalance ? Number(closeForm.countedBalance) : undefined,
      });
      if (result.closure?.hasDiscrepancy) {
        toast({
          title: '⚠️ Écart détecté',
          description: `Écart de ${formatCurrency(result.closure.discrepancy)} XOF`,
          variant: 'destructive',
        });
      } else {
        toast({ title: '🔒 Caisse fermée' });
      }
      setCloseModal(null);
      setCloseForm({ countedBalance: '', note: '' });
      loadRegisters();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleArchive = async (reg: CashRegister) => {
    const ok = await confirmDialog.danger(
      `La caisse "${reg.code} - ${reg.name}" sera archivée. Elle ne pourra plus être utilisée.`,
      'Archiver',
    );
    if (!ok) return;
    try {
      await financeService.archiveCashRegister(reg.id);
      toast({ title: '📦 Caisse archivée' });
      loadRegisters();
      if (selectedRegister?.id === reg.id) setSelectedRegister(null);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleStats = async (reg: CashRegister) => {
    try {
      const data = await financeService.getCashRegisterStats(reg.id);
      setStats(data);
      setStatsModal(reg);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  // Position des caisses secondaires en cercle autour du coffre-fort
  const getPosition = (index: number, total: number) => {
    if (total <= 0) return { x: 0, y: 0 };
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2; // Commence en haut
    const radius = Math.min(280, 140 + total * 20); // Rayon dynamique
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  };

  return (
    <>
      {confirmDialog.dialog}
      <ModuleContentArea
        layout="custom"
        toolbar={
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Gestion des caisses — coffre-fort central et caisses secondaires.
            </p>
            <Button onClick={() => setCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle caisse
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          </div>
        ) : registers.length === 0 ? (
          <div className="text-center py-24">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Safe className="h-16 w-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4 text-lg">Aucune caisse configurée</p>
              <Button onClick={() => setCreateModal(true)} size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Créer le coffre-fort principal
              </Button>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* === BANDEAU STATISTIQUES GLOBALES === */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white rounded-xl p-4 shadow-lg"
              >
                <p className="text-xs text-slate-400 uppercase tracking-wide">Solde total</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(globalStats.totalBalance)}</p>
                <p className="text-xs text-slate-400 mt-0.5">FCFA</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
              >
                <p className="text-xs text-slate-500 uppercase tracking-wide">Caisses ouvertes</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{globalStats.openCount}<span className="text-slate-400 text-lg">/{globalStats.totalCaisses}</span></p>
                <div className="flex gap-1 mt-1">
                  {registers.map((r) => (
                    <div key={r.id} className={`w-2 h-2 rounded-full ${r.isOpen ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                  ))}
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
              >
                <p className="text-xs text-slate-500 uppercase tracking-wide">Transactions totales</p>
                <p className="text-2xl font-bold mt-1 text-indigo-600">{globalStats.totalTransactions}</p>
                <p className="text-xs text-slate-400 mt-0.5">toutes caisses</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
              >
                <p className="text-xs text-slate-500 uppercase tracking-wide">Caisses actives</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">{registers.filter((r) => r.isActive).length}</p>
                <p className="text-xs text-slate-400 mt-0.5">caisses configurées</p>
              </motion.div>
            </div>

            {/* === CONSTELLATION COFFRE-FORT + CAISSES === */}
            <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200 overflow-hidden" style={{ minHeight: '640px' }}>

              {/* Décor : grille subtile en fond */}
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
                backgroundSize: '30px 30px',
              }} />

              {/* SVG pour les lignes de connexion */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                {secondaryRegisters.map((reg, idx) => {
                  const pos = getPosition(idx, secondaryRegisters.length);
                  return (
                    <line
                      key={reg.id}
                      x1="50%"
                      y1="50%"
                      x2={`calc(50% + ${pos.x}px)`}
                      y2={`calc(50% + ${pos.y}px)`}
                      stroke={reg.isOpen ? '#10b981' : '#cbd5e1'}
                      strokeWidth="1.5"
                      strokeDasharray={reg.isOpen ? '0' : '4 4'}
                      opacity="0.5"
                    />
                  );
                })}
              </svg>

              {/* COFFRE-FORT CENTRAL */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ zIndex: 2 }}>
                <motion.button
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedRegister(mainRegister)}
                  className="relative group"
                >
                  {/* Halo pulsant */}
                  {mainRegister?.isOpen && (
                    <motion.div
                      className="absolute inset-0 rounded-3xl bg-emerald-400/30"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.5, 0, 0.5],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                  )}
                  {/* Second halo (décalé) */}
                  {mainRegister?.isOpen && (
                    <motion.div
                      className="absolute inset-0 rounded-3xl bg-indigo-400/20"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.3, 0, 0.3],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: 0.5,
                      }}
                    />
                  )}

                  {/* Carte coffre-fort */}
                  <div className={`relative bg-gradient-to-br ${mainRegister?.isOpen ? 'from-slate-900 via-indigo-900 to-slate-900' : 'from-slate-700 to-slate-900'} text-white rounded-3xl p-6 shadow-2xl ring-2 ${mainRegister?.isOpen ? 'ring-emerald-400/50' : 'ring-slate-500/30'} backdrop-blur-md w-64`}>
                    {/* Effet de brillance */}
                    <div className="absolute inset-0 rounded-3xl opacity-20" style={{
                      background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
                    }} />

                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                          <Safe className="w-6 h-6 text-white" />
                        </div>
                        {mainRegister?.isOpen ? (
                          <div className="flex items-center gap-1.5">
                            <motion.div
                              className="w-2 h-2 rounded-full bg-emerald-400"
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            />
                            <span className="text-xs text-emerald-300 font-medium">Ouverte</span>
                          </div>
                        ) : (
                          <Badge className="bg-slate-600/50 text-slate-300">
                            <Lock className="w-3 h-3 mr-1" />Fermée
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">{mainRegister?.code || 'MAIN'}</p>
                      <p className="text-sm font-semibold text-white mb-3">{mainRegister?.name || 'Caisse principale'}</p>
                      <p className="text-3xl font-bold text-white">{formatCurrency(Number(mainRegister?.currentBalance || 0))}</p>
                      <p className="text-xs text-slate-400 mt-1">FCFA · {mainRegister?._count?.transactions || 0} transactions</p>
                    </div>
                  </div>
                </motion.button>

                {/* Label COFFRE-FORT */}
                <div className="text-center mt-3">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">
                    💎 Coffre-Fort
                  </span>
                </div>
              </div>

              {/* CAISSES SECONDAIRES — disposées en cercle */}
              {secondaryRegisters.map((reg, idx) => {
                const pos = getPosition(idx, secondaryRegisters.length);
                const color = CAISSE_COLORS[idx % CAISSE_COLORS.length];
                const Icon = getCaisseIcon(reg);
                return (
                  <div
                    key={reg.id}
                    className="absolute top-1/2 left-1/2"
                    style={{
                      transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                      zIndex: 2,
                    }}
                  >
                    <motion.button
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3 + idx * 0.1, type: 'spring', stiffness: 200 }}
                      whileHover={{ scale: 1.08, y: -4 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedRegister(reg)}
                      className="relative group"
                    >
                      {/* Halo si ouverte */}
                      {reg.isOpen && (
                        <motion.div
                          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${color.bg} opacity-30`}
                          animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity, delay: idx * 0.3 }}
                        />
                      )}

                      {/* Carte caisse secondaire */}
                      <div className={`relative bg-white rounded-2xl p-4 shadow-lg ring-1 ${reg.isOpen ? `ring-2 ${color.ring} ${color.glow} shadow-xl` : 'ring-slate-200'} w-44 transition-all`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color.bg} flex items-center justify-center shadow-md`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          {reg.isOpen ? (
                            <motion.div
                              className="w-2 h-2 rounded-full bg-emerald-400"
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            />
                          ) : (
                            <Lock className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-mono">{reg.code}</p>
                        <p className="text-xs font-semibold text-slate-800 truncate">{reg.name}</p>
                        <p className={`text-lg font-bold ${color.text} mt-1`}>{formatCurrency(Number(reg.currentBalance || 0))}</p>
                        <p className="text-[10px] text-slate-400">{reg._count?.transactions || 0} transactions</p>
                        {!reg.isActive && (
                          <div className="absolute top-1 right-1">
                            <Archive className="w-3 h-3 text-slate-300" />
                          </div>
                        )}
                      </div>
                    </motion.button>
                  </div>
                );
              })}

              {/* Légende en bas */}
              <div className="absolute bottom-3 left-3 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /> Ouverte</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300" /> Fermée</span>
                <span className="flex items-center gap-1"><Archive className="w-3 h-3" /> Archivée</span>
              </div>
            </div>

            {/* === PANNEAU DÉTAILS (au clic sur une caisse) === */}
            <AnimatePresence mode="wait">
              {selectedRegister && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
                >
                  {/* En-tête du panneau */}
                  <div className={`bg-gradient-to-r ${selectedRegister.code?.toUpperCase() === 'MAIN' || selectedRegister === mainRegister ? 'from-slate-900 to-indigo-900' : 'from-slate-700 to-slate-900'} text-white p-5`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                          {(() => {
                            const Icon = getCaisseIcon(selectedRegister);
                            return <Icon className="w-6 h-6 text-white" />;
                          })()}
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wide">{selectedRegister.code}</p>
                          <h3 className="text-lg font-bold text-white">{selectedRegister.name}</h3>
                          <p className="text-xs text-slate-400">{selectedRegister.location || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedRegister.isOpen ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <motion.div className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                            Ouverte
                          </Badge>
                        ) : selectedRegister.isActive ? (
                          <Badge className="bg-slate-600/50 text-slate-300"><Lock className="w-3 h-3 mr-1" />Fermée</Badge>
                        ) : (
                          <Badge className="bg-slate-600/50 text-slate-300"><Archive className="w-3 h-3 mr-1" />Archivée</Badge>
                        )}
                        <button onClick={() => setSelectedRegister(null)} className="text-slate-400 hover:text-white p-1">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Corps du panneau */}
                  <div className="p-5 space-y-4">
                    {/* KPI cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <p className="text-xs text-slate-500">Solde courant</p>
                        <p className="text-xl font-bold text-slate-900">{formatCurrency(Number(selectedRegister.currentBalance || 0))}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <p className="text-xs text-slate-500">Solde d'ouverture</p>
                        <p className="text-xl font-bold text-slate-700">{formatCurrency(Number(selectedRegister.openingBalance || 0))}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <p className="text-xs text-slate-500">Transactions</p>
                        <p className="text-xl font-bold text-indigo-600">{selectedRegister._count?.transactions || 0}</p>
                      </div>
                    </div>

                    {/* Infos détaillées */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Responsable</p>
                        <p className="font-medium text-slate-800">
                          {selectedRegister.responsibleUser
                            ? `${selectedRegister.responsibleUser.firstName} ${selectedRegister.responsibleUser.lastName}`
                            : 'Non assigné'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Dernière ouverture</p>
                        <p className="font-medium text-slate-800">
                          {selectedRegister.openedAt
                            ? new Date(selectedRegister.openedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Ouverte par</p>
                        <p className="font-medium text-slate-800">
                          {selectedRegister.openedBy
                            ? `${selectedRegister.openedBy.firstName} ${selectedRegister.openedBy.lastName}`
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Dernière fermeture</p>
                        <p className="font-medium text-slate-800">
                          {selectedRegister.closedAt
                            ? new Date(selectedRegister.closedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </p>
                      </div>
                    </div>

                    {selectedRegister.description && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Description</p>
                        <p className="text-sm text-slate-700">{selectedRegister.description}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                      {selectedRegister.isActive && !selectedRegister.isOpen && (
                        <Button onClick={() => handleOpen(selectedRegister)} className="bg-emerald-600 hover:bg-emerald-700">
                          <Unlock className="h-4 w-4 mr-2" />Ouvrir la caisse
                        </Button>
                      )}
                      {selectedRegister.isOpen && (
                        <Button
                          onClick={() => {
                            setCloseModal(selectedRegister);
                            setCloseForm({ countedBalance: String(selectedRegister.currentBalance), note: '' });
                          }}
                          className="bg-rose-600 hover:bg-rose-700"
                        >
                          <Lock className="h-4 w-4 mr-2" />Fermer la caisse
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => handleStats(selectedRegister)}>
                        <BarChart3 className="h-4 w-4 mr-2" />Statistiques
                      </Button>
                      <Button variant="outline" onClick={() => setEditModal(selectedRegister)}>
                        <Edit className="h-4 w-4 mr-2" />Modifier
                      </Button>
                      {selectedRegister.isActive && (
                        <Button variant="outline" onClick={() => handleArchive(selectedRegister)} className="text-rose-600 hover:bg-rose-50">
                          <Archive className="h-4 w-4 mr-2" />Archiver
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </ModuleContentArea>

      {/* === Modal Création === */}
      <Dialog open={createModal} onOpenChange={setCreateModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle caisse</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {/* 1. Nom de la caisse — avec suggestions prédéfinies */}
            <div>
              <Label htmlFor="name">Nom de la caisse *</Label>
              <Input
                id="name"
                placeholder="Sélectionnez un nom ou tapez le vôtre..."
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="mb-2"
              />
              {/* Suggestions prédéfinies — cliquer pour auto-remplir */}
              <div className="flex flex-wrap gap-1.5">
                {PREDEFINED_CAISSES.map((predef) => {
                  const isActive = formData.name === predef.name;
                  return (
                    <button
                      key={predef.code}
                      type="button"
                      onClick={() => selectPredefinedCaisse(predef)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {predef.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">💡 Cliquez sur un nom prédéfini pour auto-générer le code, l'emplacement et la description.</p>
            </div>

            {/* 2. Code + Solde d'ouverture */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  placeholder="ex: CAISSE-01"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label htmlFor="openingBalance">Solde d'ouverture (XOF)</Label>
                <Input
                  id="openingBalance"
                  type="number"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                />
              </div>
            </div>

            {/* 3. Emplacement */}
            <div>
              <Label htmlFor="location">Emplacement</Label>
              <Input
                id="location"
                placeholder="ex: Bureau d'accueil"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            {/* 4. Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Description optionnelle"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModal(false)}>Annuler</Button>
            <Button onClick={handleCreate}>Créer la caisse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Édition === */}
      <Dialog open={!!editModal} onOpenChange={(v) => !v && setEditModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier la caisse {editModal?.code}</DialogTitle>
          </DialogHeader>
          {editModal && (
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="edit-name">Nom</Label>
                <Input
                  id="edit-name"
                  value={editModal.name}
                  onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-location">Emplacement</Label>
                <Input
                  id="edit-location"
                  value={editModal.location || ''}
                  onChange={(e) => setEditModal({ ...editModal, location: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editModal.description || ''}
                  onChange={(e) => setEditModal({ ...editModal, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Annuler</Button>
            <Button onClick={handleUpdate}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Fermeture === */}
      <Dialog open={!!closeModal} onOpenChange={(v) => !v && setCloseModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fermer la caisse {closeModal?.code}</DialogTitle>
          </DialogHeader>
          {closeModal && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-3 rounded-md text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500">Solde théorique :</span>
                  <span className="font-semibold">{formatCurrency(Number(closeModal.currentBalance))} XOF</span>
                </div>
                <div className="text-xs text-slate-400">
                  Dernière ouverture : {closeModal.openedAt ? new Date(closeModal.openedAt).toLocaleString('fr-FR') : '-'}
                </div>
              </div>
              <div>
                <Label htmlFor="countedBalance">Solde physique compté (XOF)</Label>
                <Input
                  id="countedBalance"
                  type="number"
                  value={closeForm.countedBalance}
                  onChange={(e) => setCloseForm({ ...closeForm, countedBalance: e.target.value })}
                  placeholder="Saisir le montant compté en caisse"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Un écart sera signalé si le montant ne correspond pas au solde théorique.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseModal(null)}>Annuler</Button>
            <Button onClick={handleClose}>Fermer la caisse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Statistiques === */}
      <Dialog open={!!statsModal} onOpenChange={(v) => !v && setStatsModal(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Statistiques — {statsModal?.code} {statsModal?.name}</DialogTitle>
          </DialogHeader>
          {stats && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <p className="text-xs text-emerald-600">Volume total</p>
                  <p className="text-lg font-bold text-emerald-900">{formatCurrency(stats.totalVolume)} XOF</p>
                </div>
                <div className="bg-rose-50 p-3 rounded-lg">
                  <p className="text-xs text-rose-600">Annulations</p>
                  <p className="text-lg font-bold text-rose-900">{formatCurrency(stats.reversalVolume)} XOF</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-600">Volume net</p>
                  <p className="text-lg font-bold text-blue-900">{formatCurrency(stats.netVolume)} XOF</p>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Transactions totales</p>
                <p className="text-2xl font-bold">{stats.totalTransactions}</p>
              </div>
              {stats.byMethod && stats.byMethod.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Par méthode de paiement</p>
                  <div className="space-y-1">
                    {stats.byMethod.map((m: any) => (
                      <div key={m.method} className="flex justify-between text-sm bg-slate-50 p-2 rounded">
                        <span className="font-medium">{m.method}</span>
                        <span>{m.count} transactions — {formatCurrency(m.total)} XOF</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatsModal(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
