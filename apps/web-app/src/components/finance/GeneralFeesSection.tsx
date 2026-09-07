/**
 * ============================================================================
 * GENERAL FEES SECTION — Section « Frais généraux » pour NewPaymentModal
 * ============================================================================
 *
 * ⭐ SEPT. 2026 (exigence utilisateur, pattern « articles boutique ») :
 *    la secrétaire/comptable peut encaisser des frais généraux (uniforme,
 *    T-shirt, fournitures…) EN MÊME TEMPS que le reste, sans que la
 *    scolarité soit soldée. Deux sources de lignes :
 *
 *    1. Lignes GENERAL DÉJÀ présentes sur le compte de l'élève (paiement
 *       partiel antérieur) → saisie du montant, plafonnée au restant dû.
 *
 *    2. Frais généraux À LA CARTE : sélection dans le catalogue des
 *       FeeStructures feeType=GENERAL actives (multi-select avec cases à
 *       cocher, comme le sélecteur d'articles boutique). Le backend crée
 *       l'AccountBreakdown à la volée au moment de l'encaissement
 *       (generalFeeAddOns → FinanceTransactionService.create) — rien n'est
 *       ajouté au compte si le paiement n'aboutit pas.
 *
 *    Les frais généraux sont imputés EXPLICITEMENT : le parent peut payer
 *    uniforme + inscription sans toucher à la scolarité, ou l'inverse.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Coins, Plus, X, Check, Loader2, Search, Package, CircleDollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { financeService } from '@/services/finance.service';

export interface GeneralFeeAddOn {
  feeStructureId: string;
  name: string;
  /** Montant du frais (FeeStructure.totalAmount) — plafond de la saisie. */
  feeAmount: number;
  /** Montant à encaisser MAINTENANT (saisie libre ≤ feeAmount). */
  amount: string;
}

export interface GeneralFeeAccountLine {
  id: string;
  name: string;
  remaining: number;
}

export interface GeneralFeesSectionProps {
  academicYearId: string;
  /** Lignes GENERAL déjà présentes sur le compte de l'élève. */
  accountLines: GeneralFeeAccountLine[];
  /** Montants saisis pour les lignes du compte (clé = breakdownId). */
  accountAmounts: Record<string, string>;
  onAccountAmountsChange: (amounts: Record<string, string>) => void;
  /** Frais généraux sélectionnés à la carte (catalogue). */
  addOns: GeneralFeeAddOn[];
  onAddOnsChange: (addOns: GeneralFeeAddOn[]) => void;
}

export default function GeneralFeesSection({
  academicYearId,
  accountLines,
  accountAmounts,
  onAccountAmountsChange,
  addOns,
  onAddOnsChange,
}: GeneralFeesSectionProps) {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPickerIds, setSelectedPickerIds] = useState<Set<string>>(new Set());

  // Catalogue des frais généraux (FeeStructures GENERAL actives de l'année)
  useEffect(() => {
    if (!academicYearId) return;
    setCatalogLoading(true);
    financeService
      .getFeeStructures({ feeType: 'GENERAL', isActive: 'true', academicYearId })
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        setCatalog(list);
      })
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));
  }, [academicYearId]);

  // Frais du catalogue pas encore visibles (ni sur le compte ni déjà ajoutés)
  const availableCatalog = useMemo(() => {
    const onAccount = new Set(accountLines.map((l) => l.name.trim().toLowerCase()));
    const inAddOns = new Set(addOns.map((a) => a.feeStructureId));
    return catalog.filter(
      (c: any) => !inAddOns.has(c.id) && !onAccount.has(String(c.name ?? '').trim().toLowerCase()),
    );
  }, [catalog, accountLines, addOns]);

  const filteredCatalog = useMemo(() => {
    if (!searchTerm.trim()) return availableCatalog;
    const q = searchTerm.toLowerCase().trim();
    return availableCatalog.filter((c: any) => (c.name || '').toLowerCase().includes(q));
  }, [availableCatalog, searchTerm]);

  const togglePickerSelection = (feeStructureId: string) => {
    setSelectedPickerIds((prev) => {
      const next = new Set(prev);
      if (next.has(feeStructureId)) next.delete(feeStructureId);
      else next.add(feeStructureId);
      return next;
    });
  };

  const handleValidateSelection = () => {
    const selected = availableCatalog.filter((c: any) => selectedPickerIds.has(c.id));
    if (selected.length === 0) return;
    const newAddOns: GeneralFeeAddOn[] = selected.map((c: any) => ({
      feeStructureId: c.id,
      name: String(c.name ?? 'Frais général'),
      feeAmount: Number(c.totalAmount ?? 0),
      amount: String(Number(c.totalAmount ?? 0)),
    }));
    onAddOnsChange([...addOns, ...newAddOns]);
    setSelectedPickerIds(new Set());
    setShowPicker(false);
  };

  const handleRemoveAddOn = (feeStructureId: string) => {
    onAddOnsChange(addOns.filter((a) => a.feeStructureId !== feeStructureId));
  };

  const handleAddOnAmountChange = (feeStructureId: string, value: string) => {
    onAddOnsChange(
      addOns.map((a) => (a.feeStructureId === feeStructureId ? { ...a, amount: value } : a)),
    );
  };

  const parseAmount = (v: string | undefined): number => {
    const n = parseFloat(v ?? '');
    return isNaN(n) || n < 0 ? 0 : n;
  };

  const totalAddOns = addOns.reduce((s, a) => s + parseAmount(a.amount), 0);
  const totalAccountLines = accountLines.reduce((s, l) => s + parseAmount(accountAmounts[l.id]), 0);
  const totalGeneral = totalAddOns + totalAccountLines;

  return (
    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/60 p-4 space-y-3">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-bold text-amber-900">Frais généraux</span>
          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
            Payables en même temps que le reste
          </Badge>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => { setSelectedPickerIds(new Set()); setSearchTerm(''); setShowPicker(true); }}
          className="bg-amber-600 hover:bg-amber-700 text-white h-7 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" /> Ajouter un frais général
        </Button>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Ajoutez les frais généraux à encaisser maintenant (uniforme, fournitures, T-shirt…) — le parent
        peut les payer sans avoir soldé l&apos;inscription ou la scolarité.
      </p>

      {/* 1. Lignes GENERAL déjà sur le compte */}
      {accountLines.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Déjà sur le compte</p>
          {accountLines.map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_150px] items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{l.name}</p>
                <p className="text-[11px] text-slate-400">
                  Restant : <span className="font-semibold text-slate-600">{formatCurrency(l.remaining)}</span>
                  {parseAmount(accountAmounts[l.id]) > l.remaining && (
                    <span className="ml-2 text-rose-600 font-semibold">⚠ Dépasse le restant dû</span>
                  )}
                </p>
              </div>
              <div className="justify-self-end">
                <Input
                  type="number"
                  min={0}
                  max={l.remaining}
                  placeholder="0"
                  className="w-[140px] text-right"
                  value={accountAmounts[l.id] ?? ''}
                  onChange={(e) => onAccountAmountsChange({ ...accountAmounts, [l.id]: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Frais généraux à la carte (sélection catalogue) */}
      {addOns.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">À la carte</p>
          {addOns.map((a) => {
            const amt = parseAmount(a.amount);
            const overset = amt > a.feeAmount;
            return (
              <motion.div
                key={a.feeStructureId}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-[1fr_150px_auto] items-center gap-2 bg-white rounded-lg border border-amber-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{a.name}</p>
                  <p className="text-[11px] text-slate-400">
                    Frais : <span className="font-semibold text-slate-600">{formatCurrency(a.feeAmount)}</span>
                    {overset && (
                      <span className="ml-2 text-rose-600 font-semibold">⚠ Dépasse le montant du frais</span>
                    )}
                  </p>
                </div>
                <div className="justify-self-end">
                  <Input
                    type="number"
                    min={0}
                    max={a.feeAmount}
                    placeholder="0"
                    className="w-[140px] text-right"
                    value={a.amount}
                    onChange={(e) => handleAddOnAmountChange(a.feeStructureId, e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700"
                  onClick={() => handleRemoveAddOn(a.feeStructureId)}
                  title="Retirer"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Aucune ligne — aide à la configuration */}
      {accountLines.length === 0 && addOns.length === 0 && (
        <div className="text-xs text-slate-500 italic py-2 text-center bg-white/50 rounded border border-dashed border-amber-200">
          {catalogLoading
            ? 'Chargement du catalogue des frais généraux…'
            : availableCatalog.length === 0
              ? 'Aucun frais général configuré pour cette année. Créez-en dans Finance → Structures de frais (type « Frais généraux »).'
              : 'Cliquez sur « Ajouter un frais général » pour sélectionner les frais à encaisser (uniforme, fournitures…).'}
        </div>
      )}

      {/* Total frais généraux */}
      {totalGeneral > 0 && (
        <div className="flex justify-between items-center pt-2 border-t border-amber-200">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Total frais généraux {addOns.length > 0 && accountLines.length > 0 ? '(compte + à la carte)' : ''}
          </span>
          <span className="text-sm font-bold text-amber-900">{formatCurrency(totalGeneral)}</span>
        </div>
      )}

      {/* Sélecteur catalogue — multi-select (pattern articles boutique) */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
            onClick={() => setShowPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col"
            >
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800">Frais généraux disponibles</h3>
                  {selectedPickerIds.size > 0 && (
                    <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                      {selectedPickerIds.size} sélectionné{selectedPickerIds.size > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowPicker(false)} className="h-7 w-7 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-3 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Rechercher un frais général..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {catalogLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
                  </div>
                ) : filteredCatalog.length === 0 ? (
                  <div className="text-center py-12 text-sm text-slate-500">
                    {availableCatalog.length === 0
                      ? 'Tous les frais généraux configurés sont déjà inclus.'
                      : 'Aucun frais général ne correspond à votre recherche.'}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredCatalog.map((c: any) => {
                      const amount = Number(c.totalAmount ?? 0);
                      const isSelected = selectedPickerIds.has(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => togglePickerSelection(c.id)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center gap-3 cursor-pointer ${
                            isSelected
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-slate-200 hover:border-amber-300 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'bg-amber-600 border-amber-600' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-amber-100' : 'bg-slate-100'}`}>
                            {isSelected ? (
                              <CircleDollarSign className="w-5 h-5 text-amber-600" />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800 truncate">{c.name}</div>
                            <div className="text-xs text-slate-500">Frais général · année {academicYearId ? 'courante' : ''}</div>
                          </div>
                          <div className="text-sm font-bold text-amber-700 whitespace-nowrap">
                            {formatCurrency(amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {selectedPickerIds.size > 0
                    ? `${selectedPickerIds.size} frais général${selectedPickerIds.size > 1 ? 'aux' : ''} sélectionné${selectedPickerIds.size > 1 ? 's' : ''}`
                    : 'Cochez les frais généraux à ajouter à cet encaissement'}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowPicker(false)}>
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleValidateSelection}
                    disabled={selectedPickerIds.size === 0}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Valider la sélection ({selectedPickerIds.size})
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
