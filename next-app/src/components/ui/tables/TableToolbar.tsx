/**
 * ============================================================================
 * TABLE TOOLBAR - BARRE D'OUTILS DE TABLEAU
 * ============================================================================
 * 
 * Composant standard pour les outils de recherche/filtrage des tableaux
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { Search, Filter, Download, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TableToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: ReactNode;
  showAddButton?: boolean;
  onAddClick?: () => void;
  addButtonLabel?: string;
  showExport?: boolean;
  onExport?: () => void;
  showFilter?: boolean;
  onFilterClick?: () => void;
  className?: string;
}

export function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  actions,
  showAddButton = false,
  onAddClick,
  addButtonLabel = 'Ajouter',
  showExport = false,
  onExport,
  showFilter = false,
  onFilterClick,
  className,
}: TableToolbarProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 mb-4', className)}>
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-10"
          />
        </div>
        {showFilter && (
          <Button
            variant="outline"
            size="sm"
            onClick={onFilterClick}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtres
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {actions}
        {showExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        )}
        {showAddButton && (
          <Button size="sm" onClick={onAddClick}>
            <Plus className="w-4 h-4 mr-2" />
            {addButtonLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
