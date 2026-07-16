/**
 * ============================================================================
 * SHOP SALES SECTION - Section ventes boutique pour TransactionsContent
 * ============================================================================
 *
 * Affiche la liste des ventes boutique dans l'onglet "Encaissements" du module
 * Finance. Permet de visualiser les ventes boutique à côté des FinanceTransactions,
 * et indique si une vente est liée à une FinanceTransaction (multi-action).
 *
 * Utilisé dans TransactionsContent.tsx pour faire le lien Boutique ↔ Finance.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, Loader2, Package, Link2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';

export default function ShopSalesSection({
  academicYearId,
  onGoToShop,
}: {
  academicYearId: string;
  onGoToShop?: () => void;
}) {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!academicYearId) return;
    setLoading(true);
    financeService
      .getShopSales({ academicYearId })
      .then((data) => {
        setSales(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Erreur chargement ventes boutique:', err);
        setSales([]);
      })
      .finally(() => setLoading(false));
  }, [academicYearId]);

  // Statistiques rapides
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.totalAmount ?? 0), 0);
  const multiActionCount = sales.filter((s) => s.notes?.includes('MULTI_ACTION_TX:')).length;

  // Afficher seulement les 5 premières si non étendu
  const displayedSales = expanded ? sales : sales.slice(0, 5);

  if (loading) {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart className="w-4 h-4 text-violet-700" />
          <h3 className="text-sm font-bold text-violet-900">Ventes Boutique</h3>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-violet-700" />
            <h3 className="text-sm font-bold text-violet-900">Ventes Boutique</h3>
          </div>
          {onGoToShop && (
            <Button
              size="sm"
              variant="outline"
              onClick={onGoToShop}
              className="text-xs h-7 border-violet-300 text-violet-700 hover:bg-violet-100"
            >
              <ExternalLink className="w-3 h-3 mr-1" /> Aller au module Boutique
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500 italic">
          Aucune vente boutique enregistrée pour cette année académique.
          Les ventes effectuées dans le module Boutique ou via un encaissement
          multi-action apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-violet-700" />
          <h3 className="text-sm font-bold text-violet-900">Ventes Boutique</h3>
          <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-300 bg-violet-50">
            {sales.length} vente{sales.length > 1 ? 's' : ''}
          </Badge>
          {multiActionCount > 0 && (
            <Badge variant="outline" className="text-[10px] text-indigo-700 border-indigo-300 bg-indigo-50">
              <Link2 className="w-2.5 h-2.5 mr-0.5" />
              {multiActionCount} multi-action
            </Badge>
          )}
          <span className="text-xs text-slate-500 ml-2">
            Total : <strong className="text-violet-900">{formatCurrency(totalRevenue)}</strong>
          </span>
        </div>
        {onGoToShop && (
          <Button
            size="sm"
            variant="outline"
            onClick={onGoToShop}
            className="text-xs h-7 border-violet-300 text-violet-700 hover:bg-violet-100"
          >
            <ExternalLink className="w-3 h-3 mr-1" /> Boutique
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-violet-100/50">
            <TableHead className="text-violet-900">Vente</TableHead>
            <TableHead className="text-violet-900">Client</TableHead>
            <TableHead className="text-violet-900">Articles</TableHead>
            <TableHead className="text-right text-violet-900">Montant</TableHead>
            <TableHead className="text-violet-900">Mode</TableHead>
            <TableHead className="text-violet-900">Date</TableHead>
            <TableHead className="text-center text-violet-900">Lien</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayedSales.map((sale) => {
            const isMultiAction = sale.notes?.includes('MULTI_ACTION_TX:');
            const itemsCount = sale.items?.length ?? 0;
            return (
              <TableRow key={sale.id} className="hover:bg-violet-50">
                <TableCell className="font-mono text-xs">{sale.saleNumber}</TableCell>
                <TableCell className="font-medium text-xs">
                  {sale.student
                    ? `${sale.student.lastName} ${sale.student.firstName}`
                    : sale.customerName || '—'}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3 h-3 text-violet-500" />
                    <span>{itemsCount} article{itemsCount > 1 ? 's' : ''}</span>
                  </div>
                  {sale.items && sale.items.length > 0 && (
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]">
                      {sale.items.map((it: any) => it.product?.name || 'Article').join(', ')}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold text-violet-900">
                  {formatCurrency(sale.totalAmount)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {sale.paymentMode === 'CASH' ? 'Espèces' : sale.paymentMode}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {sale.saleDate
                    ? new Date(sale.saleDate).toLocaleDateString('fr-FR')
                    : '—'}
                </TableCell>
                <TableCell className="text-center">
                  {isMultiAction ? (
                    <Badge variant="outline" className="text-[10px] text-indigo-700 border-indigo-300 bg-indigo-50">
                      <Link2 className="w-2.5 h-2.5 mr-0.5" />
                      Reçu combiné
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-slate-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {sales.length > 5 && (
        <div className="flex justify-center mt-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-violet-700"
          >
            {expanded
              ? 'Voir moins'
              : `Voir les ${sales.length - 5} ventes restantes`}
          </Button>
        </div>
      )}
    </div>
  );
}
