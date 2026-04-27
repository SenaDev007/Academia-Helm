/**
 * SOUS-MODULE 5 — Dépenses & Budget (Academia Helm)
 */
'use client';

import { useState, useEffect } from 'react';
import { Eye, CheckCircle, XCircle, Wallet } from 'lucide-react';
import {
  ModuleHeader,
  SubModuleNavigation,
  ModuleContentArea,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';

const formatXOF = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);

export default function ExpensesPage() {
  const { academicYear } = useModuleContext();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'expenses' | 'budget'>('expenses');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [modalCreate, setModalCreate] = useState(false);
  const [detailExpense, setDetailExpense] = useState<any | null>(null);
  const [form, setForm] = useState({ categoryId: '', description: '', amount: '', receiptUrl: '' });

  const loadExpenses = async () => {
    if (!academicYear?.id) return;
    const params = new URLSearchParams({ academicYearId: academicYear.id });
    if (filterStatus) params.set('status', filterStatus);
    if (filterCategory) params.set('categoryId', filterCategory);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    const res = await fetch(`/api/finance/expenses-v2?${params}`, { credentials: 'include' });
    const data = await res.json();
    if (res.ok && Array.isArray(data)) setExpenses(data);
  };

  const loadBudgets = async () => {
    if (!academicYear?.id) return;
    const res = await fetch(`/api/finance/expenses-v2/budgets?academicYearId=${academicYear.id}`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setBudgets(Array.isArray(data) ? data : []);
    }
  };

  useEffect(() => {
    if (!academicYear?.id) return;
    setLoading(true);
    fetch('/api/finance/expenses/categories', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCategories(Array.isArray(d) ? d : []));
    loadExpenses().then(() => setLoading(false));
    loadBudgets();
  }, [academicYear?.id, filterStatus, filterCategory, filterFrom, filterTo]);

  useEffect(() => {
    if (academicYear?.id && tab === 'budget') loadBudgets();
  }, [tab, academicYear?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear?.id || !form.categoryId || !form.description || !form.amount) return;
    const res = await fetch('/api/finance/expenses-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        academicYearId: academicYear.id,
        categoryId: form.categoryId,
        description: form.description,
        amount: Number(form.amount),
        receiptUrl: form.receiptUrl || undefined,
      }),
    });
    if (res.ok) {
      setModalCreate(false);
      setForm({ categoryId: '', description: '', amount: '', receiptUrl: '' });
      loadExpenses();
      loadBudgets();
    }
  };

  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/finance/expenses-v2/${id}/approve`, { method: 'PATCH', credentials: 'include' });
    if (res.ok) loadExpenses();
  };

  const handleReject = async (id: string) => {
    const res = await fetch(`/api/finance/expenses-v2/${id}/reject`, { method: 'PATCH', credentials: 'include' });
    if (res.ok) loadExpenses();
  };

  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  const getStatusBadge = (status: string) => {
    const v: Record<string, { variant: 'default' | 'outline' | 'destructive'; label: string }> = {
      APPROVED: { variant: 'default', label: 'Approuvé' },
      PENDING: { variant: 'outline', label: 'En attente' },
      REJECTED: { variant: 'destructive', label: 'Rejeté' },
    };
    const c = v[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const pendingCount = expenses.filter((e) => e.status === 'PENDING').length;
  const approvedSum = expenses.filter((e) => e.status === 'APPROVED').reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Dépenses & Budget"
        description="Dépenses avec workflow d'approbation et budget annuel par catégorie."
        icon="finance"
        kpis={[
          { label: 'Dépenses approuvées', value: formatXOF(approvedSum) },
          { label: 'En attente', value: String(pendingCount) },
          { label: 'Année', value: academicYear?.label ?? '—' },
        ]}
        actions={<Button onClick={() => setModalCreate(true)}>Nouvelle dépense</Button>}
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/expenses" />

      <div className="flex gap-2 mb-4">
        <Button variant={tab === 'expenses' ? 'default' : 'outline'} size="sm" onClick={() => setTab('expenses')}>Dépenses</Button>
        <Button variant={tab === 'budget' ? 'default' : 'outline'} size="sm" onClick={() => setTab('budget')}><Wallet className="w-4 h-4 mr-1" /> Budget</Button>
      </div>

      {modalCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-semibold mb-4">Nouvelle dépense</h3>
            <form onSubmit={handleCreate}>
              <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                <SelectTrigger className="mb-2"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} required className="mb-2" />
              <Input type="number" placeholder="Montant (XOF)" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required className="mb-2" />
              <Input placeholder="URL justificatif (optionnel)" value={form.receiptUrl} onChange={(e) => setForm((f) => ({ ...f, receiptUrl: e.target.value }))} className="mb-4" />
              <div className="flex gap-2">
                <Button type="submit">Soumettre</Button>
                <Button type="button" variant="outline" onClick={() => setModalCreate(false)}>Annuler</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="font-semibold mb-4">{detailExpense.description}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div><strong>Catégorie:</strong> {detailExpense.category?.name ?? detailExpense.categoryId}</div>
              <div><strong>Date:</strong> {detailExpense.createdAt ? new Date(detailExpense.createdAt).toLocaleDateString('fr-FR') : '—'}</div>
              <div><strong>Montant:</strong> {formatXOF(Number(detailExpense.amount))}</div>
              <div><strong>Statut:</strong> {detailExpense.status}</div>
              <div className="col-span-2"><strong>Description:</strong> {detailExpense.description}</div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setDetailExpense(null)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <ModuleContentArea layout="table" filters={
          <div className="flex space-x-2">
            <Select value={filterStatus || 'ALL'} onValueChange={(v) => setFilterStatus(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous</SelectItem>
                <SelectItem value="PENDING">En attente</SelectItem>
                <SelectItem value="APPROVED">Approuvées</SelectItem>
                <SelectItem value="REJECTED">Rejetées</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory || 'ALL'} onValueChange={(v) => setFilterCategory(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} placeholder="Du" className="w-[140px]" />
            <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} placeholder="Au" className="w-[140px]" />
          </div>
        }>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Demandé par</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-500">Chargement…</TableCell></TableRow>
              ) : expenses.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-500">Aucune dépense.</TableCell></TableRow>
              ) : (
                expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.createdAt ? new Date(expense.createdAt).toLocaleDateString('fr-FR') : '—'}</TableCell>
                    <TableCell>{expense.category?.name ?? expense.categoryId}</TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>{formatXOF(Number(expense.amount))}</TableCell>
                    <TableCell>{expense.requester ? [expense.requester.firstName, expense.requester.lastName].filter(Boolean).join(' ') : '—'}</TableCell>
                    <TableCell>{getStatusBadge(expense.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDetailExpense(expense)}><Eye className="h-4 w-4" /></Button>
                      {expense.status === 'PENDING' && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => { if (window.confirm('Approuver cette dépense ?')) handleApprove(expense.id); }}><CheckCircle className="h-4 w-4 text-green-600" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (window.confirm('Rejeter cette dépense ?')) handleReject(expense.id); }}><XCircle className="h-4 w-4 text-red-600" /></Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ModuleContentArea>
      )}

      {tab === 'budget' && (
        <ModuleContentArea layout="table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Dépensé</TableHead>
                <TableHead>Restant</TableHead>
                <TableHead>% utilisé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-500">Aucun budget configuré. Définir les budgets par catégorie côté API (POST /api/finance/expenses-v2/budgets).</TableCell></TableRow>
              ) : (
                budgets.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.category?.name ?? b.categoryId}</TableCell>
                    <TableCell>{formatXOF(Number(b.allocatedAmount))}</TableCell>
                    <TableCell>{formatXOF(b.spent ?? 0)}</TableCell>
                    <TableCell>{formatXOF(b.remaining ?? 0)}</TableCell>
                    <TableCell>
                      <span className={b.percentUsed >= 85 ? 'text-red-600 font-medium' : b.percentUsed >= 60 ? 'text-yellow-600' : 'text-green-600'}>{b.percentUsed ?? 0} %</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ModuleContentArea>
      )}
    </div>
  );
}
