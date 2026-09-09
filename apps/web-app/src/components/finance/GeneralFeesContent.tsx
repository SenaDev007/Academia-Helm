'use client';

/**
 * ============================================================================
 * GENERAL FEES CONTENT — Onglet « Frais généraux » du module Finance
 * ============================================================================
 *
 * ⭐ Demande utilisateur (sept. 2026) :
 *    « nous allons créer un autre onglet juste après l'onglet compte élèves.
 *    Nous allons créer l'onglet frais généraux afin de pouvoir lister
 *    exactement comme on l'a fait pour l'onglet compte élèves. Ce sera la
 *    même structure […] un seul tableau pour pouvoir récupérer les frais
 *    généraux des élèves pour que l'école puisse savoir que par rapport aux
 *    frais généraux, voici ce qui doit être récupéré pour cette année
 *    scolaire. »
 *
 * Structure identique à Comptes élèves :
 *   - Bandeau de KPIs ( dus / payé / solde / élèves concernés ) — totaux
 *     serveur (pas seulement la page active) ;
 *   - Filtres Niveau → Classe + recherche élève ;
 *   - UN seul tableau : Élève | Classe | Frais généraux dus | Payé | Solde |
 *     Statut — avec le détail par frais (ligne secondaire) ;
 *   - Pagination serveur.
 *
 * ⭐ Déduction automatique : quand un paiement est encaissé (Encaissements →
 *    sous-onglet Frais généraux), l'allocation met à jour les
 *    AccountBreakdown côté backend. Ce composant recharge ses données :
 *   - au montage (navigation vers l'onglet) ;
 *   - à l'événement global 'finance-accounts-changed' (émi après chaque
 *     encaissement / personnalisation / configuration de frais).
 */

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { ChevronLeft, ChevronRight, Search, Users, CheckCircle2, AlertCircle, Coins, Sparkles, Receipt } from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { financeService } from '@/services/finance.service';
import { formatCurrency, cn } from '@/lib/utils';
import { useL } from '@/lib/i18n/bilingual';

const STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  UNPAID: 'bg-orange-100 text-orange-800',
  NONE: 'bg-gray-100 text-gray-800',
};

function classOrder(name: string): number {
  const n = (name || '').trim().toUpperCase();
  if (n === 'MATERNELLE 1' || n === 'M1') return 0;
  if (n === 'MATERNELLE 2' || n === 'M2') return 1;
  if (n === 'CI') return 10;
  if (n === 'CP') return 11;
  if (n === 'CE1') return 12;
  if (n === 'CE2') return 13;
  if (n === 'CM1') return 14;
  if (n === 'CM2') return 15;
  if (n === '6E' || n === '6ÈME') return 20;
  if (n === '5E' || n === '5ÈME') return 21;
  if (n === '4E' || n === '4ÈME') return 22;
  if (n === '3E' || n === '3ÈME') return 23;
  if (n === '2NDE') return 24;
  if (n === '1ERE' || n === '1ÈRE') return 25;
  if (n === 'TERMINALE' || n === 'TLE') return 26;
  return 100 + (name.charCodeAt(0) || 0);
}

const PAGE_SIZE = 50;

export default function GeneralFeesContent() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  // ⭐ Libellés dans la langue du profil (piste EN → anglais)
  const L = useL();

  const [rows, setRows] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [filterLevelId, setFilterLevelId] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination serveur + KPIs globaux
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [sums, setSums] = useState<{ due: number; paid: number; remaining: number; studentsWithGeneralFees: number }>({
    due: 0, paid: 0, remaining: 0, studentsWithGeneralFees: 0,
  });

  // Ligne détail ouverte (détail par frais généraux)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Chargement des niveaux + classes (BFF same-origin — pattern FeeOverridesContent)
  // ⭐ FIX 2026-09-09 : les classes suivent l'année du CONTEXTE (selecteur
  //    global du header) — avant : année active serveur, jamais rechargées.
  useEffect(() => {
    fetch('/api/school-levels')
      .then((res) => res.json())
      .then((d) => setLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setLevels([]));
  }, []);
  useEffect(() => {
    fetch(`/api/all-classes${academicYear?.id ? `?academicYearId=${academicYear.id}` : ''}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((d) => setClasses(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setClasses([]));
  }, [academicYear?.id]);

  // Mapping education_levels → school_levels (pour le filtre par niveau)
  const eduToSchoolLevelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const level of levels) {
      const code = level.code;
      const matchingClass = classes.find((c: any) => c.schoolLevel?.code === code);
      if (matchingClass) {
        map[level.id] = matchingClass.schoolLevelId;
      }
    }
    return map;
  }, [levels, classes]);

  // Classes filtrées par niveau
  const filteredClasses = useMemo(() => {
    const sorted = [...classes].sort((a, b) => classOrder(a.name) - classOrder(b.name));
    if (!filterLevelId) return sorted;
    const schoolLevelId = eduToSchoolLevelMap[filterLevelId] || filterLevelId;
    return sorted.filter((c: any) => c.schoolLevelId === schoolLevelId || c.schoolLevel?.id === schoolLevelId);
  }, [classes, filterLevelId, eduToSchoolLevelMap]);

  const loadRows = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        academicYearId: academicYear.id,
        page: String(currentPage),
        limit: String(PAGE_SIZE),
      };
      if (filterClassId) params.classId = filterClassId;
      if (filterLevelId) {
        const schoolLevelId = eduToSchoolLevelMap[filterLevelId];
        if (schoolLevelId) params.schoolLevelId = schoolLevelId;
      }
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await financeService.getGeneralFeeAccounts(params);
      const items = Array.isArray(data) ? data : (data?.data ?? []);
      setRows(items);
      setTotalRows(Array.isArray(data) ? data.length : (data?.total ?? 0));
      setTotalPages(Array.isArray(data) ? 1 : (data?.totalPages ?? 1));
      if (!Array.isArray(data) && data?.sums) {
        setSums({
          due: Number(data.sums.due ?? 0),
          paid: Number(data.sums.paid ?? 0),
          remaining: Number(data.sums.remaining ?? 0),
          studentsWithGeneralFees: Number(data.sums.studentsWithGeneralFees ?? 0),
        });
      } else {
        // Fallback : calcul sur la page active
        setSums({
          due: items.reduce((s: number, r: any) => s + Number(r.generalDue ?? 0), 0),
          paid: items.reduce((s: number, r: any) => s + Number(r.generalPaid ?? 0), 0),
          remaining: items.reduce((s: number, r: any) => s + Number(r.generalBalance ?? 0), 0),
          studentsWithGeneralFees: items.length,
        });
      }
    } catch (e: any) {
      console.error(e);
      toast({
        title: L('Erreur de chargement', 'Loading error'),
        description: e?.message || L("Impossible de charger les frais généraux.", 'Unable to load general fees.'),
        variant: 'destructive',
      });
      setRows([]);
      setTotalRows(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id, currentPage, filterClassId, filterLevelId, searchQuery, eduToSchoolLevelMap]);

  // Rechargement (search avec debounce 250ms — pattern FeeOverridesContent)
  useEffect(() => {
    if (!academicYear?.id) return;
    const timeout = setTimeout(() => { loadRows(); }, searchQuery ? 250 : 0);
    return () => clearTimeout(timeout);
  }, [academicYear?.id, currentPage, filterLevelId, filterClassId, searchQuery, loadRows]);

  // Reset page à 1 quand les filtres changent
  useEffect(() => { setCurrentPage(1); }, [filterLevelId, filterClassId, searchQuery]);

  // ⭐ Déduction automatique : recharger quand un encaissement / une
  //    personnalisation / une configuration de frais change les soldes
  //    (même mécanique que StudentAccountsContent).
  useEffect(() => {
    const handler = () => { loadRows(); };
    window.addEventListener('finance-accounts-changed', handler);
    return () => window.removeEventListener('finance-accounts-changed', handler);
  }, [loadRows]);

  const studentName = (r: any) =>
    `${r.student?.lastName || ''} ${r.student?.firstName || ''}`.trim() || '—';

  const statusLabel = (s: string) => {
    switch (s) {
      case 'PAID': return L('Payé', 'Paid');
      case 'PARTIAL': return L('Partiel', 'Partial');
      case 'UNPAID': return L('Impayé', 'Unpaid');
      default: return L('—', '—');
    }
  };

  return (
    <ModuleContentArea layout="custom">
      {/* ⭐ Bandeau de statistiques — KPIs sur le TOTAL serveur (pas la page active) */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-indigo-500" />
            {L('Frais généraux dus', 'General fees due')}
          </p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(sums.due)}</p>
          <p className="text-[10px] text-slate-400">
            {L('à recouvrer pour l\u2019année', 'to collect for the year')} {academicYear?.name || academicYear?.label || '—'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            {L('Frais généraux payés', 'General fees paid')}
          </p>
          <p className="text-2xl font-bold text-emerald-700">{formatCurrency(sums.paid)}</p>
          <p className="text-[10px] text-slate-400">{L('encaissés à ce jour', 'collected so far')}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            {L('Solde restant', 'Remaining balance')}
          </p>
          <p className="text-2xl font-bold text-rose-600">{formatCurrency(sums.remaining)}</p>
          <p className="text-[10px] text-slate-400">
            {sums.due > 0 ? `${Math.round((sums.remaining / sums.due) * 100)}% ${L('du dû', 'of due')}` : '—'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-500" />
            {L('Élèves concernés', 'Students concerned')}
          </p>
          <p className="text-2xl font-bold text-slate-800">{totalRows}</p>
          <p className="text-[10px] text-slate-400">
            {L('sur', 'on')} {totalPages} page(s) · {L('payés', 'paid')} : {rows.filter((r) => r.status === 'PAID').length}
          </p>
        </div>
      </div>

      {/* Filtres : Niveau → Classe + Recherche */}
      <div className="mb-4 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            {L('Rechercher un élève', 'Search student')}
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={L('Nom, prénom ou matricule...', 'Name, first name or ID...')}
              className="pl-10 w-full sm:w-[260px]"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{L('Niveau', 'Level')}</Label>
          <Select value={filterLevelId || 'ALL'} onValueChange={(v) => { setFilterLevelId(v === 'ALL' ? '' : v); setFilterClassId(''); }}>
            <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder={L('Tous les niveaux', 'All levels')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{L('Tous les niveaux', 'All levels')}</SelectItem>
              {levels.map((l) => (<SelectItem key={l.id} value={l.id}>{l.label ?? l.code ?? l.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{L('Classe', 'Class')}</Label>
          <Select value={filterClassId || 'ALL'} onValueChange={(v) => setFilterClassId(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder={L('Toutes les classes', 'All classes')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{L('Toutes les classes', 'All classes')}</SelectItem>
              {filteredClasses.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ⭐ UN SEUL TABLEAU — frais généraux par élève (structure Comptes élèves) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>{L('Élève', 'Student')}</TableHead>
                <TableHead>{L('Classe', 'Class')}</TableHead>
                <TableHead className="text-right">{L('Frais généraux dus', 'General fees due')}</TableHead>
                <TableHead className="text-right">{L('Payé', 'Paid')}</TableHead>
                <TableHead className="text-right">{L('Solde', 'Balance')}</TableHead>
                <TableHead className="text-center">{L('Statut', 'Status')}</TableHead>
                <TableHead className="text-center">{L('Détails', 'Details')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-500 py-8">{L('Chargement...', 'Loading...')}</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Coins className="w-10 h-10 text-slate-300" />
                      <p>
                        {L(
                          'Aucun frais général pour cette année scolaire.',
                          'No general fees for this school year.',
                        )}
                      </p>
                      <p className="text-xs text-slate-400 max-w-md">
                        {L(
                          'Créez un frais de type « Frais généraux » depuis Configuration des frais → Nouveau frais, puis suivez ici ce qui doit être recouvré par élève.',
                          'Create a fee of type "General fees" from Fee Configuration → New fee, then track here what must be collected per student.',
                        )}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.map((r) => (
                <Fragment key={r.accountId}>
                  <TableRow className={cn('hover:bg-slate-50', r.status === 'PAID' && 'bg-green-50/30')}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{studentName(r)}</span>
                        <span className="text-xs text-slate-500">
                          {r.student?.matricule ? L('Matricule', 'ID') + ' : ' + r.student.matricule : r.student?.studentCode ? 'Code : ' + r.student.studentCode : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.className || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(r.generalDue)}
                      {/* Détail par frais général (ligne secondaire) */}
                      <div className="text-[10px] text-slate-500 font-normal">
                        {(r.breakdowns ?? []).map((b: any, i: number) => (
                          <div key={b.id ?? i} className="flex items-center gap-1 justify-end">
                            {b.feeStructure?.name}
                            {b.hasOverride && (
                              <Sparkles className="w-2.5 h-2.5 text-purple-500" title={L('Personnalisé', 'Personalized')} />
                            )}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-700">
                      {formatCurrency(r.generalPaid)}
                      <div className="text-[10px] text-slate-500 font-normal">
                        {(r.breakdowns ?? []).map((b: any, i: number) => (
                          <div key={b.id ?? i} className="text-right">
                            {Number(b.paidAmount) > 0 ? formatCurrency(Number(b.paidAmount)) : ''}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      <span className={Number(r.generalBalance) <= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {formatCurrency(r.generalBalance)}
                      </span>
                      <div className="text-[10px] text-slate-500 font-normal">
                        {(r.breakdowns ?? []).map((b: any, i: number) => (
                          <div key={b.id ?? i} className="text-right">
                            {Number(b.paidAmount) < Number(b.adjustedAmount ?? b.initialAmount ?? 0)
                              ? formatCurrency(Number(b.remainingAmount))
                              : ''}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-800'}>
                        {statusLabel(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(expandedId === r.accountId ? null : r.accountId)}
                      >
                        <Receipt className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {/* Ligne détail — décompte par frais général */}
                  {expandedId === r.accountId && (
                    <TableRow className="bg-slate-50/60">
                      <TableCell colSpan={7} className="py-3">
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            {L('Décompte des frais généraux', 'General fees breakdown')} — {studentName(r)}
                          </p>
                          {(r.breakdowns ?? []).map((b: any, i: number) => {
                            const due = Number(b.adjustedAmount ?? b.initialAmount ?? 0);
                            const paid = Number(b.paidAmount ?? 0);
                            const rem = Number(b.remainingAmount ?? Math.max(0, due - paid));
                            const pct = due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0;
                            return (
                              <div key={b.id ?? i} className="flex items-center gap-3 text-sm bg-white border border-slate-200 rounded-lg px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-slate-700 truncate">{b.feeStructure?.name}</span>
                                    {b.hasOverride && (
                                      <Badge variant="outline" className="text-[10px] text-purple-700 border-purple-300 bg-purple-50 flex-shrink-0">
                                        <Sparkles className="w-2.5 h-2.5 mr-0.5" />{L('Pers.', 'Pers.')}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                    <div
                                      className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-amber-400')}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="text-xs text-slate-500 whitespace-nowrap">{formatCurrency(due)}</span>
                                <span className="text-xs text-emerald-600 whitespace-nowrap">{formatCurrency(paid)}</span>
                                <span className="text-xs font-semibold text-rose-600 whitespace-nowrap">{formatCurrency(rem)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination (pattern FeeOverridesContent / StudentAccountsContent) */}
        {!loading && totalRows > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              {totalRows} {L('élève(s)', 'student(s)')} · {L('page', 'page')} {currentPage}/{totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </ModuleContentArea>
  );
}
