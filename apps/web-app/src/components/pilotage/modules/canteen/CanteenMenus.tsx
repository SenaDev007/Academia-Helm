/**
 * ============================================================================
 * CANTEEN MENUS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint : GET /modules-complementaires/canteen/menus?academicYearId=...
 * Endpoint : POST /modules-complementaires/canteen/menus
 *
 * Refonte juillet 2026 (Task 7-d) :
 *  - alert() → toast() via useToast()
 *  - window.confirm() → useConfirmDialog().danger()
 *  - fixed inset-0 modals → <Dialog> shadcn
 *  - <input>/<label>/<button> HTML → <Input>/<Label>/<Button> shadcn
 *  - <table> HTML → <Table> shadcn
 *  - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-semibold
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import {
  Plus, Calendar, Search, Filter, Download,
  ChevronLeft, ChevronRight,
  Clock, ChefHat, Eye, Edit, Trash2,
  Sparkles, CheckCircle2, Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

interface MenuItem {
  id: string;
  date?: string;
  menuDate?: string;
  period?: string;
  mealType?: string;
  main?: string;
  mainCourse?: string;
  dish?: string;
  level?: string;
  schoolLevel?: string;
  targetLevel?: string;
  cost?: number;
  estimatedCost?: number;
  status?: string;
  [key: string]: any;
}

interface MenuFormData {
  date: string;
  mealType: string;
  dishes: string;
}

const emptyMenuForm: MenuFormData = { date: '', mealType: 'DEJEUNER', dishes: '' };

// ⭐ 2026-10-15 — Liste de plats africains / béninois catégorisés
//    pour faciliter la sélection rapide lors de la planification des menus.
const BENIN_DISHES: Record<string, string[]> = {
  PETIT_DEJEUNER: [
    'Bouillie de maïs (Akassa)',
    'Bouillie de mil',
    'Pain beurre + chocolat chaud',
    'Pain + sardine tomate',
    'Beignets (Ata)',
    'Akara + pain',
    'Pâte de maïs + sauce tomate',
    'Lait + pain + banane',
    'Pain + omelette',
    'Bouillie de sorgho',
  ],
  DEJEUNER: [
    'Riz au poisson (Djèwou)',
    'Riz sauce tomate + poulet',
    'Riz gras (Wolof)',
    'Pâte de maïs + sauce arachide',
    'Pâte de maïs + sauce tomate',
    'Pâte de manioc + sauce feuilles',
    'Pâte de manioc + sauce arachide',
    'Akassa + sauce poisson',
    'Akassa + sauce tomate + viande',
    'Igname pilée + sauce épina',
    'Attieké + poisson braisé',
    'Spaghetti sauce tomate',
    'Macaroni + poulet',
    'Foufou (pâte d\'igname) + sauce',
    'Tô (pâte de maïs) + sauce gombo',
    'Riz + sauce arachide + viande',
    'Riz + légumes + poisson fumé',
    'Pâte blanche + sauce graine',
    'Yam fufu + sauce épinard',
    'Riz au gras + oeuf',
  ],
  GOUTER: [
    'Beignets + café',
    'Pain + chocolat',
    'Ata (beignets) + jus',
    'Frites + sauce tomate',
    'Croissant + lait',
    'Pain + beurre + confiture',
    'Biscuits + jus de fruit',
    'Maïs grillé + fruit',
  ],
};

export default function CanteenMenus() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MenuFormData>(emptyMenuForm);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { data: menus, loading, error, refetch } = useModulesList<MenuItem>(
    'canteen',
    'menus',
    academicYear?.id,
  );

  const openCreate = () => {
    setFormData(emptyMenuForm);
    setEditingId(null);
    setCreateOpen(true);
  };

  const openEdit = (menu: MenuItem) => {
    setEditingId(menu.id);
    setFormData({
      date: menu.date ?? menu.menuDate ?? '',
      mealType: menu.mealType ?? menu.period ?? 'DEJEUNER',
      dishes: menu.main ?? menu.mainCourse ?? menu.dish ?? '',
    });
    setEditOpen(true);
  };

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'canteen/menus',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setCreateOpen(false);
      setFormData(emptyMenuForm);
      await refetch();
      toast({ title: 'Menu planifié', description: 'Le menu a été créé avec succès.' });
    } catch (e: any) {
      console.error('Erreur création menu :', e?.message || e);
      toast({
        title: 'Erreur création menu',
        description: e?.message || 'Erreur lors de la création du menu',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      setSubmitting(true);
      await modulesApi.put(
        `canteen/menus/${editingId}`,
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setEditOpen(false);
      setEditingId(null);
      setFormData(emptyMenuForm);
      await refetch();
      toast({ title: 'Menu mis à jour', description: 'Les modifications ont été enregistrées.' });
    } catch (e: any) {
      console.error('Erreur mise à jour menu :', e?.message || e);
      toast({
        title: 'Erreur mise à jour',
        description: e?.message || 'Erreur lors de la mise à jour du menu',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (menuId: string) => {
    const ok = await confirmDialog.danger(
      'Voulez-vous vraiment supprimer ce menu ? Cette action est irréversible.',
      'Supprimer le menu',
    );
    if (!ok) return;
    try {
      setActionLoading(menuId);
      await modulesApi.delete(
        `canteen/menus/${menuId}`,
        buildModulesApiOptions(academicYear?.id),
      );
      await refetch();
      toast({ title: 'Menu supprimé' });
    } catch (e: any) {
      console.error('Erreur suppression menu :', e?.message || e);
      toast({
        title: 'Erreur suppression',
        description: e?.message || 'Erreur lors de la suppression du menu',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des menus...</span>
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

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            Vue Liste
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('calendar')}
          >
            Calendrier
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          {/* 🗑️ 2026-10-15 — Sarah AI masqué (non fonctionnel)
          <Button variant="outline" size="sm">
            <Sparkles className="w-4 h-4 mr-2" />
            Sarah AI
          </Button> */}
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Planifier
          </Button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <Card className="p-0 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher un plat, une date..."
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {menus.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              Aucun menu planifié pour cette année scolaire.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Date & Période</TableHead>
                  <TableHead>Menu Principal</TableHead>
                  <TableHead>Niveau Scolaire</TableHead>
                  <TableHead className="text-center">Coût Est.</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {menus.map((menu) => (
                  <MenuRow
                    key={menu.id}
                    menuId={menu.id}
                    date={menu.date ?? menu.menuDate ?? '—'}
                    period={menu.period ?? menu.mealType ?? '—'}
                    main={menu.main ?? menu.mainCourse ?? menu.dish ?? '—'}
                    level={menu.level ?? menu.schoolLevel ?? menu.targetLevel ?? 'Tous les niveaux'}
                    cost={menu.cost ?? menu.estimatedCost ?? 0}
                    status={menu.status ?? 'Brouillon'}
                    onEdit={() => openEdit(menu)}
                    onDelete={() => handleDelete(menu.id)}
                    actionLoading={actionLoading}
                  />
                ))}
              </TableBody>
            </Table>
          )}

          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Affichage de {menus.length} menu{menus.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="icon">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm">1</Button>
              <Button variant="outline" size="icon">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-8 shadow-sm flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="p-6 bg-blue-50 rounded-full mb-6">
            <Calendar className="w-12 h-12 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-navy-900 mb-2">Vue Calendrier Interactive</h3>
          <p className="text-gray-500 max-w-sm text-sm">Organisez visuellement vos menus par semaine ou par mois.</p>
          <Button className="mt-6" onClick={openCreate}>Activer la vue</Button>
        </Card>
      )}

      {/* Modal Planifier (création) */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Planifier un menu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="menu-date">Date</Label>
              <Input
                id="menu-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="menu-mealtype">Type de repas</Label>
              <select
                id="menu-mealtype"
                value={formData.mealType}
                onChange={(e) => setFormData({ ...formData, mealType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="DEJEUNER">Déjeuner</option>
                <option value="PETIT_DEJEUNER">Petit Déjeuner</option>
                <option value="GOUTER">Goûter</option>
                {/* 🗑️ Dîner supprimé — la cantine scolaire ne sert pas de dîner */}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="menu-dishes">Plat principal</Label>
              {/* ⭐ 2026-10-15 — Liste de plats béninois par catégorie */}
              <select
                id="menu-dishes"
                value={formData.dishes}
                onChange={(e) => setFormData({ ...formData, dishes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">— Sélectionner un plat —</option>
                {(BENIN_DISHES[formData.mealType] || BENIN_DISHES.DEJEUNER).map((dish) => (
                  <option key={dish} value={dish}>{dish}</option>
                ))}
                <option value="custom">Autre (saisir manuellement)…</option>
              </select>
              {formData.dishes === 'custom' && (
                <Input
                  type="text"
                  placeholder="Saisir le nom du plat"
                  value=""
                  onChange={(e) => setFormData({ ...formData, dishes: e.target.value })}
                  className="mt-2"
                  autoFocus
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi…' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Modification */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le menu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-menu-date">Date</Label>
              <Input
                id="edit-menu-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-menu-mealtype">Type de repas</Label>
              <select
                id="edit-menu-mealtype"
                value={formData.mealType}
                onChange={(e) => setFormData({ ...formData, mealType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="DEJEUNER">Déjeuner</option>
                <option value="PETIT_DEJEUNER">Petit Déjeuner</option>
                <option value="GOUTER">Goûter</option>
                {/* 🗑️ Dîner supprimé — la cantine scolaire ne sert pas de dîner */}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-menu-dishes">Plat principal</Label>
              <select
                id="edit-menu-dishes"
                value={BENIN_DISHES[formData.mealType]?.includes(formData.dishes) ? formData.dishes : 'custom'}
                onChange={(e) => setFormData({ ...formData, dishes: e.target.value === 'custom' ? formData.dishes : e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">— Sélectionner un plat —</option>
                {(BENIN_DISHES[formData.mealType] || BENIN_DISHES.DEJEUNER).map((dish) => (
                  <option key={dish} value={dish}>{dish}</option>
                ))}
                <option value="custom">Autre (conserver la valeur actuelle)</option>
              </select>
              <Input
                type="text"
                placeholder="Nom du plat"
                value={formData.dishes}
                onChange={(e) => setFormData({ ...formData, dishes: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog.dialog}
    </div>
  );
}

function MenuRow({ menuId, date, period, main, level, cost, status, onEdit, onDelete, actionLoading }: any) {
  const statusColors: any = {
    'Publié': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Brouillon': 'bg-gray-50 text-gray-500 border-gray-100',
    'Modifié': 'bg-amber-50 text-amber-600 border-amber-100',
  };
  const formattedCost = typeof cost === 'number' ? `${cost.toLocaleString('fr-FR')} F` : cost;
  const isLoading = actionLoading === menuId;

  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900">{date}</p>
            <div className="flex items-center space-x-1 mt-0.5">
              <Clock className="w-3 h-3 text-gray-400" />
              <p className="text-xs text-gray-500">{period}</p>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <ChefHat className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-medium text-navy-800">{main}</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="bg-gray-100">{level}</Badge>
      </TableCell>
      <TableCell className="text-center">
        <p className="text-sm font-semibold text-navy-900">{formattedCost}</p>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusColors[status] ?? statusColors['Brouillon']}>
          {status === 'Publié' && <CheckCircle2 className="w-3 h-3 mr-1" />}
          {status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end space-x-1">
          <Button variant="ghost" size="icon">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} disabled={isLoading}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
