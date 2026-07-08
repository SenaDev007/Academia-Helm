/**
 * ============================================================================
 * SOUS-MODULE 5 — Dépenses & Budget (Academia Helm)
 * ============================================================================
 *
 * Refonte UI complète :
 *   - Suppression du ModuleHeader "Dépenses & Budget" en double (géré par layout)
 *   - Toolbar avec boutons Excel/PDF + Nouvelle dépense (comme Encaissements)
 *   - KPIs : total, en attente, approuvées, rejetées
 *   - Recherche textuelle + ligne de totaux
 *   - Onglet Budget avec barres de progression visuelles
 *   - Modal création amélioré (date dépense, meilleur layout)
 *   - Modal détail avec audit + approbateur
 *
 * ============================================================================
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  Eye, CheckCircle, XCircle, FileSpreadsheet, FileText, Plus, Search,
  TrendingDown, Clock, CheckCircle2, XCircle as XCircleIcon, Wallet,
  Loader2, Upload, Link2, Calendar, AlertTriangle, Trash2, Pencil,
} from 'lucide-react';
import {
  ModuleContentArea,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAppSession } from '@/contexts/AppSessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';
import { exportExpensesToExcel } from '@/lib/exports/excel-exports';
import { expensesFilename } from '@/lib/exports/filename-helpers';
import { loadPdfLibs } from '@/lib/exports/pdf-loader';
import { loadXlsx } from '@/lib/exports/xlsx-loader';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, Legend,
} from 'recharts';

type Tab = 'dashboard' | 'expenses' | 'budget' | 'categories';

export default function ExpensesPage() {
  const confirmDialog = useConfirmDialog();
  const { toast } = useToast();
  const { academicYear } = useModuleContext();
  const { tenant } = useAppSession();

  // ─── Données ───
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  // ─── UI ───
  const [tab, setTab] = useState<Tab>('dashboard');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [search, setSearch] = useState('');

  // ─── Modals ───
  const [modalCreate, setModalCreate] = useState(false);
  const [detailExpense, setDetailExpense] = useState<any | null>(null);
  const [modalBudget, setModalBudget] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ categoryId: '', allocatedAmount: '' });
  const [rejectModal, setRejectModal] = useState<{ id: string; studentName: string; amount: number; description: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // ─── Modal catégorie (CRUD) ───
  const [modalCategory, setModalCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', code: '' });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  // ─── Upload justificatif (fichier) ───
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // ─── Sélecteurs utilisateurs pour le modal dépense ───
  const [expenseUsers, setExpenseUsers] = useState<any[]>([]);
  const [requestedById, setRequestedById] = useState('');
  const [manualRequester, setManualRequester] = useState('');
  const [pendingApproverId, setPendingApproverId] = useState('');
  const [cashRegisters, setCashRegisters] = useState<any[]>([]);
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState('');
  useEffect(() => {
    fetch('/api/settings/users', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const allUsers = Array.isArray(d) ? d : (d?.data ?? []);
        const ADMIN_ROLES = ['DIRECTOR', 'ADMIN', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER', 'ACCOUNTANT', 'CASHIER', 'SECRETARY', 'SECRETARY_ACCOUNTANT', 'COMPTABLE', 'SECRETAIRE_COMPTABLE', 'DIRECTEUR', 'DIRECTEUR_GENERAL', 'SCHOOL_OWNER', 'SCHOOL_ADMIN'];
        const filtered = allUsers.filter((u: any) => {
          const role = (u.role || u.roles?.[0] || '').toUpperCase();
          return ADMIN_ROLES.some(r => role.includes(r));
        });
        setExpenseUsers(filtered);
        const comptable = filtered.find((u: any) => {
          const role = (u.role || '').toUpperCase();
          return role.includes('COMPTABLE') || role.includes('SECRETARY') || role.includes('ACCOUNTANT') || role.includes('CASHIER');
        });
        if (comptable) setRequestedById(comptable.id);
        const promoter = filtered.find((u: any) => {
          const role = (u.role || '').toUpperCase();
          return role.includes('PROMOTEUR') || role.includes('PROMOTER') || role.includes('PLATFORM_OWNER');
        });
        if (promoter) setPendingApproverId(promoter.id);
      })
      .catch(() => setExpenseUsers([]));

    // Charger les caisses actives
    fetch('/api/finance/cash-registers', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : (d?.data ?? []);
        // Filtrer les caisses actives (pas la caisse ONLINE qui n'est jamais débitée)
        const active = list.filter((c: any) => c.isActive !== false && c.code !== 'ONLINE');
        setCashRegisters(active);
        // Par défaut : la première caisse active (ex: ACCUEIL)
        if (active.length > 0) setSelectedCashRegisterId(active[0].id);
      })
      .catch(() => setCashRegisters([]));
  }, []);

  // ─── Formulaire nouvelle dépense ───
  const [form, setForm] = useState({
    categoryId: '',
    description: '',
    amount: '',
    receiptUrl: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    vendor: '',
    invoiceRef: '',
  });

  // ─── Chargement ───
  const loadExpenses = async () => {
    if (!academicYear?.id) return;
    const params = new URLSearchParams({ academicYearId: academicYear.id });
    if (filterStatus) params.set('status', filterStatus);
    if (filterCategory) params.set('categoryId', filterCategory);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    try {
      const data = await financeService.getExpenses(Object.fromEntries(params.entries()));
      setExpenses(Array.isArray(data) ? data : []);
    } catch {
      setExpenses([]);
    }
  };

  const loadBudgets = async () => {
    if (!academicYear?.id) return;
    try {
      const data = await financeService.getExpenseBudgets(academicYear.id);
      setBudgets(Array.isArray(data) ? data : []);
    } catch {
      setBudgets([]);
    }
  };

  const loadMonthlyStats = async () => {
    if (!academicYear?.id) return;
    try {
      const data = await financeService.getExpenseMonthlyStats(academicYear.id);
      setMonthlyStats(Array.isArray(data) ? data : []);
    } catch {
      setMonthlyStats([]);
    }
  };

  useEffect(() => {
    if (!academicYear?.id) return;
    setLoading(true);
    financeService.getExpenseCategories()
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => setCategories([]));
    loadExpenses().then(() => setLoading(false));
    loadBudgets();
    loadMonthlyStats();
  }, [academicYear?.id, filterStatus, filterCategory, filterFrom, filterTo]);

  useEffect(() => {
    if (academicYear?.id && tab === 'budget') loadBudgets();
  }, [tab, academicYear?.id]);

  // ─── KPIs ───
  const kpis = useMemo(() => {
    const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const pending = expenses.filter((e) => e.status === 'PENDING');
    const approved = expenses.filter((e) => e.status === 'APPROVED');
    const rejected = expenses.filter((e) => e.status === 'REJECTED');
    const pendingAmount = pending.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const approvedAmount = approved.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const rejectedAmount = rejected.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return {
      total,
      pendingCount: pending.length,
      pendingAmount,
      approvedCount: approved.length,
      approvedAmount,
      rejectedCount: rejected.length,
      rejectedAmount,
    };
  }, [expenses]);

  // ─── Données pour graphiques ───
  // Répartition par catégorie (camembert)
  const categoryStats = useMemo(() => {
    const byCat: Record<string, number> = {};
    expenses.filter((e) => e.status === 'APPROVED').forEach((e) => {
      const catName = e.category?.name || 'Autre';
      byCat[catName] = (byCat[catName] || 0) + (Number(e.amount) || 0);
    });
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
    return Object.entries(byCat)
      .map(([name, value], i) => ({ name, value, fill: colors[i % colors.length] }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Répartition par statut (camembter)
  const statusStats = useMemo(() => [
    { name: 'Approuvées', value: kpis.approvedCount, fill: '#10b981' },
    { name: 'En attente', value: kpis.pendingCount, fill: '#f59e0b' },
    { name: 'Rejetées', value: kpis.rejectedCount, fill: '#ef4444' },
  ].filter(s => s.value > 0), [kpis]);

  // ─── Filtre recherche ───
  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter((e) =>
      (e.description || '').toLowerCase().includes(q) ||
      (e.category?.name || '').toLowerCase().includes(q) ||
      (e.requester ? `${e.requester.firstName} ${e.requester.lastName}` : '').toLowerCase().includes(q)
    );
  }, [expenses, search]);

  // ─── Handlers ───
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear?.id || !form.categoryId || !form.description || !form.amount) return;
    try {
      // Upload du justificatif si un fichier est sélectionné
      let receiptUrl: string | undefined = form.receiptUrl || undefined;
      if (receiptFile) {
        const uploadedUrl = await handleUploadReceipt(receiptFile);
        if (uploadedUrl) {
          receiptUrl = uploadedUrl;
        }
      }
      // Nettoyer les undefined → ne pas les envoyer (évite les erreurs de validation)
      const payload: Record<string, any> = {
        academicYearId: academicYear.id,
        categoryId: form.categoryId,
        description: form.description,
        amount: Number(form.amount),
      };
      if (receiptUrl) payload.receiptUrl = receiptUrl;
      if (form.expenseDate) payload.expenseDate = form.expenseDate;
      if (form.vendor) payload.vendor = form.vendor;
      if (form.invoiceRef) payload.invoiceRef = form.invoiceRef;
      // Demandé par : priorité au select, puis saisie manuelle
      if (requestedById) payload.requestedById = requestedById;
      else if (manualRequester) payload.requestedById = manualRequester;
      // À approuver par
      if (pendingApproverId) payload.pendingApproverId = pendingApproverId;
      // Caisse source (sera débitée à l'approbation)
      if (selectedCashRegisterId) payload.cashRegisterId = selectedCashRegisterId;

      if (editingExpenseId) {
        // Modification → PUT
        const res = await fetch(`/api/finance/expenses/${editingExpenseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.message || err?.error || 'Erreur modification');
        }
        toast({ title: '✅ Dépense modifiée', description: 'La dépense a été mise à jour.' });
        setEditingExpenseId(null);
      } else {
        // Création → POST
        await financeService.createExpense(payload);
        toast({ title: '✅ Dépense créée', description: 'La dépense a été soumise pour validation.' });
      }
      setModalCreate(false);
      setForm({ categoryId: '', description: '', amount: '', receiptUrl: '', expenseDate: new Date().toISOString().slice(0, 10), vendor: '', invoiceRef: '' });
      setReceiptFile(null);
      loadExpenses();
      loadBudgets();
      loadMonthlyStats();
    } catch (error: any) {
      toast({ title: 'Erreur création', description: error?.message || 'Erreur lors de la création', variant: 'destructive' });
      console.error('Erreur lors de la création:', error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await financeService.approveExpense(id);
      loadExpenses();
      loadBudgets();
      loadMonthlyStats();
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Erreur lors de l\'approbation. Vérifiez vos permissions.');
    }
  };

  const handleReject = async (id: string, reason: string) => {
    setRejecting(true);
    try {
      await financeService.rejectExpense(id, reason);
      setRejectModal(null);
      setRejectReason('');
      loadExpenses();
      loadBudgets();
      loadMonthlyStats();
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Erreur lors du rejet.');
    } finally {
      setRejecting(false);
    }
  };

  const handleSetBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear?.id || !budgetForm.categoryId || !budgetForm.allocatedAmount) return;
    try {
      const res = await fetch('/api/finance/expenses-v2/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          academicYearId: academicYear.id,
          categoryId: budgetForm.categoryId,
          allocatedAmount: Number(budgetForm.allocatedAmount),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || err?.error || `Erreur HTTP ${res.status}`);
      }
      toast({ title: '✅ Budget enregistré', description: 'Le budget a été défini pour cette catégorie.' });
      setModalBudget(false);
      setBudgetForm({ categoryId: '', allocatedAmount: '' });
      loadBudgets();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur lors de l\'enregistrement du budget', variant: 'destructive' });
      console.error(error);
    }
  };

  // ─── Sauvegarder catégorie (création ou modification) ───
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;
    setSavingCategory(true);
    try {
      const url = editingCategoryId
        ? `/api/finance/expenses/categories/${editingCategoryId}`
        : '/api/finance/expenses/categories';
      const method = editingCategoryId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(categoryForm),
      });
      if (!res.ok) throw new Error('Erreur lors de l\'enregistrement');
      setModalCategory(false);
      setCategoryForm({ name: '', description: '', code: '' });
      setEditingCategoryId(null);
      // Recharger les catégories
      const data = await financeService.getExpenseCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Erreur');
    } finally {
      setSavingCategory(false);
    }
  };

  // ─── Upload justificatif (fichier) ───
  const handleUploadReceipt = async (file: File): Promise<string | null> => {
    setUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'expense_receipt');
      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erreur upload');
      const data = await res.json();
      return data.url || data.filePath || null;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    } finally {
      setUploadingReceipt(false);
    }
  };

  // ─── Supprimer catégorie ───
  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    const ok = await confirmDialog.danger(
      `La catégorie « ${categoryName} » sera supprimée définitivement.`,
      'Supprimer la catégorie'
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/finance/expenses/categories/${categoryId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      toast({ title: '✅ Catégorie supprimée', description: `« ${categoryName} » a été supprimée.` });
      const data = await financeService.getExpenseCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur', variant: 'destructive' });
    }
  };

  // ─── Export PDF ───
  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const { jsPDF, autoTable } = await loadPdfLibs();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // En-tête
      doc.setFont('times', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(13, 31, 110);
      doc.text(tenant?.name || 'Établissement', pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(13);
      doc.text('Liste des dépenses', pageWidth / 2, 26, { align: 'center' });
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      if (academicYear?.name) {
        doc.text(`Année scolaire : ${academicYear.name}`, pageWidth / 2, 32, { align: 'center' });
      }
      doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 37, { align: 'center' });

      const tableData = filteredExpenses.map((e) => [
        e.createdAt ? new Date(e.createdAt).toLocaleDateString('fr-FR') : '—',
        e.category?.name ?? '—',
        e.description || '—',
        (Number(e.amount) || 0).toLocaleString('fr-FR') + ' FCFA',
        e.requester ? `${e.requester.firstName} ${e.requester.lastName}` : '—',
        e.status === 'APPROVED' ? 'Approuvé' : e.status === 'PENDING' ? 'En attente' : e.status === 'REJECTED' ? 'Rejeté' : e.status,
      ]);
      const totalAmount = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      tableData.push(['', '', 'TOTAL', totalAmount.toLocaleString('fr-FR') + ' FCFA', '', '']);

      autoTable(doc, {
        head: [['Date', 'Catégorie', 'Description', 'Montant', 'Demandé par', 'Statut']],
        body: tableData,
        startY: 42,
        theme: 'grid',
        headStyles: { fillColor: [13, 31, 110], textColor: 255, fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          3: { halign: 'right', fontStyle: 'bold' },
          5: { halign: 'center' },
        },
        didParseCell: (data: any) => {
          if (data.row.index === tableData.length - 1 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [146, 64, 14];
          }
          // Couleur statut
          if (data.section === 'body' && data.column.index === 5 && data.row.index < tableData.length - 1) {
            const status = data.cell.raw;
            if (status === 'Approuvé') {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = 'bold';
            } else if (status === 'En attente') {
              data.cell.styles.textColor = [217, 119, 6];
            } else if (status === 'Rejeté') {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });

      doc.save(`depenses-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      await exportExpensesToExcel(filteredExpenses, expensesFilename(academicYear?.label));
    } catch (e: any) {
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  // ─── Export Budget Excel ───
  const handleExportBudgetExcel = async () => {
    try {
      const XLSX = await loadXlsx();
      const data: any[][] = [
        ['', tenant?.name || 'Établissement', ''],
        ['', 'Budget par catégorie', ''],
        [academicYear?.name ? `Année scolaire : ${academicYear.name}` : '', '', ''],
        ['', '', ''],
        ['Catégorie', 'Budget alloué', 'Dépensé', 'Restant', '% utilisé', 'Statut'],
      ];
      budgets.forEach((b: any) => {
        const pct = b.percentUsed ?? 0;
        const statut = pct >= 100 ? 'Dépassé' : pct >= 85 ? 'Critique' : pct >= 60 ? 'Attention' : 'Sous contrôle';
        data.push([
          b.category?.name ?? b.categoryId,
          Number(b.allocatedAmount) || 0,
          Number(b.spent ?? 0),
          Number(b.remaining ?? 0),
          pct,
          statut,
        ]);
      });
      data.push(['']);
      data.push([
        'TOTAL',
        budgets.reduce((s, b) => s + (Number(b.allocatedAmount) || 0), 0),
        budgets.reduce((s, b) => s + (Number(b.spent) || 0), 0),
        budgets.reduce((s, b) => s + (Number(b.remaining) || 0), 0),
        '', '',
      ]);
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Budget');
      XLSX.writeFile(wb, `budget-depenses-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) {
      console.error(e);
    }
  };

  // ─── Export Budget PDF ───
  const handleExportBudgetPdf = async () => {
    setExporting('pdf');
    try {
      const { jsPDF, autoTable } = await loadPdfLibs();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // En-tête école
      doc.setFont('times', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(13, 31, 110);
      doc.text(tenant?.name || 'Établissement', pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(13);
      doc.text('Budget par catégorie', pageWidth / 2, 26, { align: 'center' });
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      if (academicYear?.name) {
        doc.text(`Année scolaire : ${academicYear.name}`, pageWidth / 2, 32, { align: 'center' });
      }
      doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 37, { align: 'center' });

      const tableData = budgets.map((b: any) => {
        const pct = b.percentUsed ?? 0;
        const statut = pct >= 100 ? 'Dépassé' : pct >= 85 ? 'Critique' : pct >= 60 ? 'Attention' : 'Sous contrôle';
        return [
          b.category?.name ?? '—',
          (Number(b.allocatedAmount) || 0).toLocaleString('fr-FR'),
          (Number(b.spent ?? 0)).toLocaleString('fr-FR'),
          (Number(b.remaining ?? 0)).toLocaleString('fr-FR'),
          `${pct}%`,
          statut,
        ];
      });
      const totalAllocated = budgets.reduce((s, b) => s + (Number(b.allocatedAmount) || 0), 0);
      const totalSpent = budgets.reduce((s, b) => s + (Number(b.spent) || 0), 0);
      const totalRemaining = budgets.reduce((s, b) => s + (Number(b.remaining) || 0), 0);
      tableData.push(['TOTAL', totalAllocated.toLocaleString('fr-FR'), totalSpent.toLocaleString('fr-FR'), totalRemaining.toLocaleString('fr-FR'), '', '']);

      autoTable(doc, {
        head: [['Catégorie', 'Budget alloué (FCFA)', 'Dépensé (FCFA)', 'Restant (FCFA)', '% utilisé', 'Statut']],
        body: tableData,
        startY: 42,
        theme: 'grid',
        headStyles: { fillColor: [13, 31, 110], textColor: 255, fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'center' },
        },
        didParseCell: (data: any) => {
          if (data.row.index === tableData.length - 1 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [146, 64, 14];
          }
          // Statut colors
          if (data.section === 'body' && data.column.index === 5 && data.row.index < tableData.length - 1) {
            const s = data.cell.raw;
            const colors: Record<string, [number, number, number]> = {
              'Sous contrôle': [22, 163, 74], 'Attention': [217, 119, 6],
              'Critique': [234, 88, 12], 'Dépassé': [220, 38, 38],
            };
            if (colors[s]) { data.cell.styles.textColor = colors[s]; data.cell.styles.fontStyle = 'bold'; }
          }
        },
      });
      doc.save(`budget-depenses-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) { console.error(e); } finally { setExporting(null); }
  };

  const getStatusBadge = (status: string) => {
    const v: Record<string, { variant: 'default' | 'outline' | 'destructive'; label: string; className?: string }> = {
      APPROVED: { variant: 'default', label: 'Approuvé', className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
      PENDING: { variant: 'outline', label: 'En attente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
      REJECTED: { variant: 'destructive', label: 'Rejeté' },
    };
    const c = v[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
  };

  const totalAmount = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // ─── KPI Card ───
  const KpiCard = ({ icon: Icon, label, value, subtext, color }: any) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
      {subtext && <p className="text-[10px] text-slate-500 mt-0.5">{subtext}</p>}
    </div>
  );

  return (
    <>
      {confirmDialog.dialog}
      <div className="space-y-4">
        {/* ─── Sous-onglets Dépenses ─── */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <Button
            variant={tab === 'dashboard' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('dashboard')}
            className={tab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-600'}
          >
            <TrendingDown className="w-4 h-4 mr-1.5" />
            Tableau de bord
          </Button>
          <Button
            variant={tab === 'expenses' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('expenses')}
            className={tab === 'expenses' ? 'bg-indigo-600 text-white' : 'text-slate-600'}
          >
            <TrendingDown className="w-4 h-4 mr-1.5" />
            Dépenses
          </Button>
          <Button
            variant={tab === 'budget' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('budget')}
            className={tab === 'budget' ? 'bg-indigo-600 text-white' : 'text-slate-600'}
          >
            <Wallet className="w-4 h-4 mr-1.5" />
            Budget
          </Button>
          <Button
            variant={tab === 'categories' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('categories')}
            className={tab === 'categories' ? 'bg-indigo-600 text-white' : 'text-slate-600'}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Catégories
          </Button>
        </div>

        {/* ─── Contenu onglet Tableau de bord ─── */}
        {tab === 'dashboard' && (
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Total dépenses</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(kpis.total)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{expenses.length} dépense(s)</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-2">
                  <Clock className="w-4 h-4" />
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">En attente</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(kpis.pendingAmount)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{kpis.pendingCount} à valider</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Approuvées</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(kpis.approvedAmount)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{kpis.approvedCount} validée(s)</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center mb-2">
                  <XCircleIcon className="w-4 h-4" />
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Rejetées</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(kpis.rejectedAmount)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{kpis.rejectedCount} rejetée(s)</p>
              </div>
            </div>

            {/* Message si aucune donnée */}
            {expenses.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
                <TrendingDown className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Aucune dépense enregistrée pour le moment.</p>
                <p className="text-xs text-slate-400 mt-1">Les graphiques apparaîtront dès qu'une dépense sera approuvée.</p>
                <Button size="sm" className="mt-4" onClick={() => setTab('expenses')}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Créer une dépense
                </Button>
              </div>
            )}

            {/* Graphiques : évolution mensuelle + répartition par catégorie (côte à côte) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Évolution mensuelle (barres) */}
              {monthlyStats.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-indigo-500" />
                    Évolution mensuelle (dépensé)
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={monthlyStats} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Total']} labelStyle={{ color: '#1e293b', fontWeight: 600 }} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {monthlyStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.total > 500000 ? '#dc2626' : entry.total > 200000 ? '#f59e0b' : '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Répartition par catégorie (camembert) */}
              {categoryStats.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                    Répartition par catégorie
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={categoryStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(entry: any) => `${entry.name.length > 12 ? entry.name.substring(0, 10) + '…' : entry.name}: ${(entry.value / 1000).toFixed(0)}k`}>
                        {categoryStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Graphiques : statut + tendance (côte à côte) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Répartition par statut (camembert) */}
              {statusStats.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    Répartition par statut
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={statusStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(entry: any) => `${entry.name}: ${entry.value}`}>
                        {statusStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Tendance mensuelle (ligne) */}
              {monthlyStats.length > 1 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-indigo-500" />
                    Tendance des dépenses (ligne)
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={monthlyStats} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Total']} labelStyle={{ color: '#1e293b', fontWeight: 600 }} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Budget summary */}
            {budgets.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-indigo-500" />
                  Budget {academicYear?.name || ''} — Synthèse par catégorie
                </h3>
                <div className="space-y-3">
                  {budgets.map((b: any) => {
                    const pct = b.percentUsed ?? 0;
                    const barColor = pct >= 100 ? 'bg-rose-500' : pct >= 85 ? 'bg-rose-400' : pct >= 60 ? 'bg-amber-400' : 'bg-emerald-500';
                    return (
                      <div key={b.id} className="flex items-center gap-3">
                        <div className="w-32 text-sm font-medium text-slate-700 truncate">{b.category?.name ?? b.categoryId}</div>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <div className="w-24 text-right text-xs text-slate-600">{formatCurrency(b.spent ?? 0)} / {formatCurrency(b.allocatedAmount)}</div>
                        <div className={`w-12 text-right text-xs font-semibold ${pct >= 85 ? 'text-rose-600' : pct >= 60 ? 'text-amber-600' : 'text-emerald-600'}`}>{pct}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Contenu onglet Dépenses ─── */}
        {tab === 'expenses' && (
          <ModuleContentArea
            layout="custom"
            toolbar={
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Filtres gauche */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Recherche */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    <Search className="w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher…"
                      className="text-sm bg-transparent border-none focus:outline-none focus:ring-0 px-1 py-0.5 w-[160px]"
                    />
                    {search && (
                      <button onClick={() => setSearch('')} className="text-xs text-slate-500 hover:text-rose-600" title="Effacer">✕</button>
                    )}
                  </div>
                  {/* Statut */}
                  <Select value={filterStatus || 'ALL'} onValueChange={(v) => setFilterStatus(v === 'ALL' ? '' : v)}>
                    <SelectTrigger className="w-[140px] h-8"><SelectValue placeholder="Statut" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tous les statuts</SelectItem>
                      <SelectItem value="PENDING">En attente</SelectItem>
                      <SelectItem value="APPROVED">Approuvées</SelectItem>
                      <SelectItem value="REJECTED">Rejetées</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Catégorie */}
                  <Select value={filterCategory || 'ALL'} onValueChange={(v) => setFilterCategory(v === 'ALL' ? '' : v)}>
                    <SelectTrigger className="w-[160px] h-8"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Toutes les catégories</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {/* Période */}
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="text-xs bg-transparent border-none focus:outline-none px-1 py-0.5" title="Du" />
                    <span className="text-slate-400 text-xs">→</span>
                    <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="text-xs bg-transparent border-none focus:outline-none px-1 py-0.5" title="Au" />
                    {(filterFrom || filterTo) && (
                      <button onClick={() => { setFilterFrom(''); setFilterTo(''); }} className="text-xs text-slate-500 hover:text-rose-600 ml-1" title="Effacer">✕</button>
                    )}
                  </div>
                  {/* Exports */}
                  <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exporting !== null || filteredExpenses.length === 0} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-8">
                    {exporting === 'excel' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1.5" />}
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting !== null || filteredExpenses.length === 0} className="border-rose-300 text-rose-700 hover:bg-rose-50 h-8">
                    {exporting === 'pdf' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />}
                    PDF
                  </Button>
                </div>
                {/* Bouton droite */}
                <Button size="sm" onClick={() => { setEditingExpenseId(null); setForm({ categoryId: '', description: '', amount: '', receiptUrl: '', expenseDate: new Date().toISOString().slice(0, 10), vendor: '', invoiceRef: '' }); setModalCreate(true); }}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Nouvelle dépense
                </Button>
              </div>
            }
          >
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Date</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Demandé par</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-gray-500 py-12">Chargement…</TableCell></TableRow>
                  ) : filteredExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500 py-12">
                        {search || filterStatus || filterCategory || filterFrom || filterTo
                          ? 'Aucune dépense ne correspond aux filtres.'
                          : 'Aucune dépense enregistrée. Cliquez sur "Nouvelle dépense" pour commencer.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <TableRow key={expense.id} className="hover:bg-slate-50">
                        <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                          {expense.createdAt ? new Date(expense.createdAt).toLocaleDateString('fr-FR') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {expense.category?.name ?? expense.categoryId}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          <div className="flex items-center gap-1.5">
                            {expense.description}
                            {expense.receiptUrl && (
                              <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer" title="Voir le justificatif">
                                <Link2 className="w-3 h-3 text-blue-500" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {expense.requester ? [expense.requester.firstName, expense.requester.lastName].filter(Boolean).join(' ') : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {getStatusBadge(expense.status)}
                            {expense.overBudget && (
                              <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-300" title="Cette dépense dépasse le budget de sa catégorie">
                                ⚠ Dépassement
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailExpense(expense)} title="Voir détails">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {expense.status === 'PENDING' && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-indigo-100" onClick={() => {
                                  setForm({
                                    categoryId: expense.categoryId,
                                    description: expense.description,
                                    amount: String(Number(expense.amount) || 0),
                                    receiptUrl: expense.receiptUrl || '',
                                    expenseDate: expense.expenseDate ? new Date(expense.expenseDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                                    vendor: expense.vendor || '',
                                    invoiceRef: expense.invoiceRef || '',
                                  });
                                  setEditingExpenseId(expense.id);
                                  setModalCreate(true);
                                }} title="Modifier">
                                  <Pencil className="h-3.5 w-3.5 text-indigo-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-emerald-100" onClick={async () => { const ok = await confirmDialog.warning('Cette dépense sera approuvée et ne pourra plus être modifiée.', 'Approuver la dépense'); if (ok) handleApprove(expense.id); }} title="Approuver">
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-rose-100" onClick={() => {
                                  setRejectModal({
                                    id: expense.id,
                                    studentName: expense.requester ? `${expense.requester.firstName} ${expense.requester.lastName}` : '—',
                                    amount: Number(expense.amount) || 0,
                                    description: expense.description,
                                  });
                                  setRejectReason('');
                                }} title="Rejeter">
                                  <XCircle className="h-3.5 w-3.5 text-rose-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-rose-100" onClick={async () => {
                                  const ok = await confirmDialog.danger('Cette dépense sera définitivement supprimée.', 'Supprimer la dépense');
                                  if (!ok) return;
                                  try {
                                    const res = await fetch(`/api/finance/expenses-v2/${expense.id}`, { method: 'DELETE', credentials: 'include' });
                                    if (!res.ok) throw new Error('Erreur');
                                    toast({ title: '✅ Dépense supprimée' });
                                    loadExpenses(); loadBudgets(); loadMonthlyStats();
                                  } catch (e: any) { toast({ title: 'Erreur', description: e?.message, variant: 'destructive' }); }
                                }} title="Supprimer">
                                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {/* Ligne de totaux */}
                {filteredExpenses.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                      <td colSpan={3} className="px-3 py-2 text-right text-slate-700 text-sm">
                        TOTAUX ({filteredExpenses.length} dépense{filteredExpenses.length > 1 ? 's' : ''})
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm text-indigo-700 whitespace-nowrap">
                        {formatCurrency(totalAmount)}
                      </td>
                      <td colSpan={3} className="px-3 py-2"></td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>
          </ModuleContentArea>
        )}

        {/* ─── Contenu onglet Budget ─── */}
        {tab === 'budget' && (
          <ModuleContentArea
            layout="custom"
            toolbar={
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-slate-600">
                  <span className="font-semibold">{budgets.length}</span> budget{budgets.length > 1 ? 's' : ''} configuré{budgets.length > 1 ? 's' : ''}
                  {' · '}
                  Total alloué : <span className="font-semibold text-indigo-700">{formatCurrency(budgets.reduce((s, b) => s + (Number(b.allocatedAmount) || 0), 0))}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportBudgetExcel} disabled={budgets.length === 0} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                    <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportBudgetPdf} disabled={budgets.length === 0} className="border-rose-300 text-rose-700 hover:bg-rose-50">
                    <FileText className="w-4 h-4 mr-1.5" /> PDF
                  </Button>
                  <Button size="sm" onClick={() => setModalBudget(true)}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Définir un budget
                  </Button>
                </div>
              </div>
            }
          >
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Budget alloué</TableHead>
                    <TableHead className="text-right">Dépensé</TableHead>
                    <TableHead className="text-right">Restant</TableHead>
                    <TableHead className="w-[200px]">Utilisation</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500 py-12">
                        <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        Aucun budget configuré. Cliquez sur « Définir un budget » pour commencer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    budgets.map((b: any) => {
                      const pct = b.percentUsed ?? 0;
                      const barColor = pct >= 100 ? 'bg-rose-500' : pct >= 85 ? 'bg-rose-400' : pct >= 60 ? 'bg-amber-400' : 'bg-emerald-500';
                      const textColor = pct >= 85 ? 'text-rose-600' : pct >= 60 ? 'text-amber-600' : 'text-emerald-600';
                      const statusBadge = pct >= 100
                        ? <Badge variant="destructive" className="text-[10px]">Dépassé</Badge>
                        : pct >= 85
                          ? <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">Critique</Badge>
                          : pct >= 60
                            ? <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Attention</Badge>
                            : <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Sous contrôle</Badge>;
                      return (
                        <TableRow key={b.id} className="hover:bg-slate-50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-indigo-400" />
                              {b.category?.name ?? b.categoryId}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-slate-700">{formatCurrency(b.allocatedAmount)}</TableCell>
                          <TableCell className="text-right font-mono text-slate-600">{formatCurrency(b.spent ?? 0)}</TableCell>
                          <TableCell className={`text-right font-mono font-semibold ${(b.remaining ?? 0) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {formatCurrency(b.remaining ?? 0)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full ${barColor} transition-all`}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-semibold ${textColor} whitespace-nowrap w-10 text-right`}>{pct}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{statusBadge}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-indigo-100"
                                onClick={() => {
                                  setBudgetForm({
                                    categoryId: b.categoryId,
                                    allocatedAmount: String(Number(b.allocatedAmount) || 0),
                                  });
                                  setModalBudget(true);
                                }}
                                title="Modifier le budget"
                              >
                                <Pencil className="h-3.5 w-3.5 text-indigo-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-rose-100"
                                onClick={async () => {
                                  const ok = await confirmDialog.danger(
                                    `Le budget pour « ${b.category?.name ?? b.categoryId} » sera définitivement supprimé.`,
                                    'Supprimer le budget'
                                  );
                                  if (!ok) return;
                                  try {
                                    const res = await fetch(`/api/finance/expenses-v2/budgets/${b.id}`, {
                                      method: 'DELETE',
                                      credentials: 'include',
                                    });
                                    if (!res.ok) throw new Error('Erreur');
                                    toast({ title: '✅ Budget supprimé', description: 'Le budget a été définitivement supprimé.' });
                                    loadBudgets();
                                  } catch (e: any) {
                                    toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
                                  }
                                }}
                                title="Supprimer le budget"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
                {budgets.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                      <td className="px-3 py-2 text-slate-700 text-sm">TOTAL</td>
                      <td className="px-3 py-2 text-right font-mono text-sm text-indigo-700">{formatCurrency(budgets.reduce((s, b) => s + (Number(b.allocatedAmount) || 0), 0))}</td>
                      <td className="px-3 py-2 text-right font-mono text-sm text-slate-600">{formatCurrency(budgets.reduce((s, b) => s + (Number(b.spent) || 0), 0))}</td>
                      <td className="px-3 py-2 text-right font-mono text-sm text-emerald-700">{formatCurrency(budgets.reduce((s, b) => s + (Number(b.remaining) || 0), 0))}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>
          </ModuleContentArea>
        )}

        {/* ─── Contenu onglet Catégories ─── */}
        {tab === 'categories' && (
          <ModuleContentArea
            layout="custom"
            toolbar={
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-slate-600">
                  <span className="font-semibold">{categories.length}</span> catégorie(s) de dépenses
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setCategoryForm({ name: '', description: '', code: '' });
                    setModalCategory(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Nouvelle catégorie
                </Button>
              </div>
            }
          >
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Nom</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-12">
                        <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        Aucune catégorie. Cliquez sur « Nouvelle catégorie » pour commencer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((cat) => (
                      <TableRow key={cat.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell><Badge variant="outline">{cat.code || '—'}</Badge></TableCell>
                        <TableCell className="text-sm text-slate-600">{cat.description || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={cat.isActive !== false ? 'default' : 'outline'} className={cat.isActive !== false ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600'}>
                            {cat.isActive !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setCategoryForm({ name: cat.name, description: cat.description || '', code: cat.code || '' });
                              setEditingCategoryId(cat.id);
                              setModalCategory(true);
                            }}
                            title="Modifier"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-rose-100"
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </ModuleContentArea>
        )}
      </div>

      {/* ─── Modal création dépense ─── */}
      {modalCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={() => setModalCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* En-tête */}
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-blue-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-indigo-600" />
                Nouvelle dépense
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                La dépense sera enregistrée avec le statut « En attente » et devra être approuvée.
              </p>
            </div>
            {/* Formulaire */}
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Catégorie *</Label>
                  <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Date de dépense</Label>
                  <Input
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Description *</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  required
                  rows={2}
                  placeholder="Motif de la dépense…"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Montant (FCFA) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                  className="font-mono font-semibold"
                  placeholder="ex: 50000"
                />
              </div>
              {/* Fournisseur + Référence facture (côte à côte) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Fournisseur</Label>
                  <Input
                    type="text"
                    value={form.vendor}
                    onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                    placeholder="Optionnel"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Réf. facture</Label>
                  <Input
                    type="text"
                    value={form.invoiceRef}
                    onChange={(e) => setForm((f) => ({ ...f, invoiceRef: e.target.value }))}
                    placeholder="Optionnel"
                  />
                </div>
              </div>
              {/* Demandé par + À approuver par (côte à côte) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Demandé par</Label>
                  {expenseUsers.length > 0 && (
                    <select
                      value={requestedById}
                      onChange={(e) => { setRequestedById(e.target.value); setManualRequester(''); }}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white mb-1"
                    >
                      <option value="">— Sélectionner —</option>
                      {expenseUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}{u.role ? ` (${u.role})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <Input
                    type="text"
                    value={manualRequester}
                    onChange={(e) => { setManualRequester(e.target.value); setRequestedById(''); }}
                    placeholder="Ou saisir le nom…"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">À approuver par</Label>
                  <select
                    value={pendingApproverId}
                    onChange={(e) => setPendingApproverId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">— Sélectionner —</option>
                    {expenseUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}{u.role ? ` (${u.role})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    💡 Une notification sera envoyée à cette personne pour approuver ou rejeter.
                  </p>
                </div>
              </div>
              {/* Caisse source */}
              {cashRegisters.length > 0 && (
                <div>
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Caisse source</Label>
                  <select
                    value={selectedCashRegisterId}
                    onChange={(e) => setSelectedCashRegisterId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">— Aucune (non imputée) —</option>
                    {cashRegisters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) — Solde : {formatCurrency(Number(c.currentBalance ?? 0))}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    💡 Le montant de la dépense sera débité de cette caisse à l'approbation.
                  </p>
                </div>
              )}
              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
                  Justificatif (fichier)
                </Label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors">
                      {uploadingReceipt ? (
                        <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="text-sm text-slate-600 truncate">
                        {receiptFile ? receiptFile.name : (uploadingReceipt ? 'Upload en cours…' : 'Cliquer pour sélectionner un fichier')}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*,.pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setReceiptFile(f);
                      }}
                    />
                  </label>
                  {receiptFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setReceiptFile(null)}
                      title="Retirer le fichier"
                    >
                      <XCircle className="w-4 h-4 text-rose-500" />
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  💡 Un justificatif peut être obligatoire selon le seuil configuré par l'établissement.
                  {' '}Formats acceptés : PDF, JPG, PNG.
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setModalCreate(false)}>Annuler</Button>
                <Button type="submit">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Soumettre la dépense
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal détail dépense ─── */}
      {detailExpense && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={() => setDetailExpense(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* En-tête coloré selon statut */}
            <div className={`px-6 py-4 border-b border-slate-200 ${
              detailExpense.status === 'APPROVED' ? 'bg-emerald-50' :
              detailExpense.status === 'PENDING' ? 'bg-amber-50' :
              detailExpense.status === 'REJECTED' ? 'bg-rose-50' : 'bg-slate-50'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">{detailExpense.description}</h3>
                {getStatusBadge(detailExpense.status)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {detailExpense.category?.name ?? detailExpense.categoryId} · {formatCurrency(detailExpense.amount)} FCFA
              </p>
            </div>
            {/* Corps */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Date</div>
                  <div className="font-medium text-slate-800">
                    {detailExpense.createdAt ? new Date(detailExpense.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Montant</div>
                  <div className="font-mono font-bold text-indigo-700">{formatCurrency(detailExpense.amount)} FCFA</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Demandé par</div>
                  <div className="font-medium text-slate-800">
                    {detailExpense.requester ? `${detailExpense.requester.firstName} ${detailExpense.requester.lastName}` : '—'}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Approuvé par</div>
                  <div className="font-medium text-slate-800">
                    {detailExpense.approver ? `${detailExpense.approver.firstName} ${detailExpense.approver.lastName}` : '—'}
                  </div>
                </div>
              </div>

              {detailExpense.description && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Description</div>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{detailExpense.description}</p>
                </div>
              )}

              {detailExpense.receiptUrl && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Justificatif</div>
                  <a
                    href={detailExpense.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <Link2 className="w-4 h-4" />
                    Voir le justificatif
                  </a>
                </div>
              )}

              {/* Fournisseur + Réf facture */}
              {(detailExpense.vendor || detailExpense.invoiceRef) && (
                <div className="grid grid-cols-2 gap-3">
                  {detailExpense.vendor && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Fournisseur</div>
                      <div className="font-medium text-slate-800 text-sm">{detailExpense.vendor}</div>
                    </div>
                  )}
                  {detailExpense.invoiceRef && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Réf. facture</div>
                      <div className="font-mono text-slate-800 text-sm">{detailExpense.invoiceRef}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Alerte dépassement budget */}
              {detailExpense.overBudget && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-rose-700">
                    <strong>Dépassement de budget :</strong> Cette dépense dépasse le budget alloué à sa catégorie.
                    Seul le Promoteur peut l'approuver.
                  </p>
                </div>
              )}

              {/* Motif du rejet */}
              {detailExpense.status === 'REJECTED' && detailExpense.rejectReason && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wide text-rose-600 font-semibold mb-1">Motif du rejet</div>
                  <p className="text-sm text-rose-800">{detailExpense.rejectReason}</p>
                </div>
              )}

              {detailExpense.approvedAt && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  {detailExpense.status === 'REJECTED' ? 'Rejetée le' : 'Approuvée le'} {new Date(detailExpense.approvedAt).toLocaleDateString('fr-FR')}
                </div>
              )}

              {/* Actions si PENDING */}
              {detailExpense.status === 'PENDING' && (
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={async () => {
                      const ok = await confirmDialog.warning('Cette dépense sera approuvée et ne pourra plus être modifiée.', 'Approuver la dépense');
                      if (ok) { handleApprove(detailExpense.id); setDetailExpense(null); }
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Approuver
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-rose-300 text-rose-700 hover:bg-rose-50"
                    onClick={() => {
                      setRejectModal({
                        id: detailExpense.id,
                        studentName: detailExpense.requester ? `${detailExpense.requester.firstName} ${detailExpense.requester.lastName}` : '—',
                        amount: Number(detailExpense.amount) || 0,
                        description: detailExpense.description,
                      });
                      setRejectReason('');
                      setDetailExpense(null);
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Rejeter
                  </Button>
                </div>
              )}
            </div>
            {/* Pied */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <Button variant="outline" onClick={() => setDetailExpense(null)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal définir budget ─── */}
      {modalBudget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={() => setModalBudget(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-blue-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-600" />
                Définir un budget
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Allouez un budget annuel pour une catégorie de dépenses.
              </p>
            </div>
            <form onSubmit={handleSetBudget} className="p-6 space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Catégorie *</Label>
                <Select value={budgetForm.categoryId} onValueChange={(v) => setBudgetForm((f) => ({ ...f, categoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une catégorie" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Montant alloué (FCFA) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={budgetForm.allocatedAmount}
                  onChange={(e) => setBudgetForm((f) => ({ ...f, allocatedAmount: e.target.value }))}
                  required
                  className="font-mono font-semibold"
                  placeholder="ex: 500000"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  💡 Si un budget existe déjà pour cette catégorie, il sera mis à jour.
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setModalBudget(false)}>Annuler</Button>
                <Button type="submit">
                  <Wallet className="w-4 h-4 mr-1.5" />
                  Enregistrer le budget
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal catégorie (création/modification) ─── */}
      {modalCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={() => !savingCategory && setModalCategory(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-blue-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                {editingCategoryId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
              </h3>
            </div>
            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Nom *</Label>
                <Input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="ex: Maintenance, Fournitures, Salaires…"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Code</Label>
                <Input
                  type="text"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="ex: MAINT, FOURN, SAL (optionnel)"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Description</Label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Description optionnelle"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => { setModalCategory(false); setEditingCategoryId(null); }} disabled={savingCategory}>Annuler</Button>
                <Button type="submit" disabled={savingCategory}>
                  {savingCategory ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                  {editingCategoryId ? 'Modifier' : 'Créer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal motif de rejet ─── */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={() => !rejecting && setRejectModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* En-tête rouge */}
            <div className="bg-gradient-to-br from-rose-600 to-rose-700 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-full p-2">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Rejeter la dépense</h3>
                  <p className="text-xs text-rose-100 mt-0.5">Un motif est obligatoire</p>
                </div>
              </div>
            </div>
            {/* Corps */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Description :</span>
                  <span className="font-medium text-slate-800 text-right max-w-[60%]">{rejectModal.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Demandé par :</span>
                  <span className="font-medium text-slate-700">{rejectModal.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Montant :</span>
                  <span className="font-bold text-rose-700">{formatCurrency(rejectModal.amount)} FCFA</span>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
                  Motif du rejet * <span className="text-rose-600 normal-case font-normal">(obligatoire)</span>
                </Label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  disabled={rejecting}
                  placeholder="Expliquez pourquoi cette dépense est rejetée…"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-rose-500 disabled:bg-slate-50"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  💡 Ce motif sera enregistré dans l'audit log et visible par le demandeur.
                </p>
              </div>
            </div>
            {/* Actions */}
            <div className="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t border-slate-200">
              <Button type="button" variant="outline" onClick={() => setRejectModal(null)} disabled={rejecting}>
                Annuler
              </Button>
              <Button
                type="button"
                onClick={() => handleReject(rejectModal.id, rejectReason)}
                disabled={!rejectReason.trim() || rejecting}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {rejecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rejet…
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Confirmer le rejet
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
