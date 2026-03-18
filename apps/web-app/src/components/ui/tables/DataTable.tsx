/**
 * ============================================================================
 * DATA TABLE - TABLEAU DE DONNÉES STANDARD
 * ============================================================================
 * 
 * Composant standard pour afficher des tableaux de données
 * Utilisé dans tous les modules pour les listes
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = 'Aucune donnée disponible',
  loading = false,
  onRowClick,
  className,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto -mx-4 sm:mx-0 rounded-xl border border-gray-200', className)}>
      <Table className="min-w-full text-xs md:text-sm">
        <TableHeader>
          <TableRow>
            {Object.values(columns).map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={cn(onRowClick && 'cursor-pointer hover:bg-gray-50')}
            >
              {Object.values(columns).map((column) => (
                <TableCell key={column.key} className={column.className}>
                  {column.render
                    ? column.render(item)
                    : (item as any)[column.key] || '-'}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
