/**
 * ============================================================================
 * TABLE ACTIONS - ACTIONS SUR LES LIGNES DE TABLEAU
 * ============================================================================
 * 
 * Composant standard pour les actions sur les lignes de tableau
 * 
 * ============================================================================
 */

'use client';

import { MoreVertical, Edit, Trash2, Eye, Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TableAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

export interface TableActionsProps {
  actions: TableAction[];
  variant?: 'dropdown' | 'inline';
}

export function TableActions({ actions, variant = 'dropdown' }: TableActionsProps) {
  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2">
        {actions.map((action, index) => {
          const Icon = action.icon || Eye;
          return (
            <Button
              key={index}
              variant={action.variant === 'destructive' ? 'destructive' : 'ghost'}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              <Icon className="w-4 h-4" />
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
        <MoreVertical className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, index) => {
          const Icon = action.icon || Eye;
          return (
            <DropdownMenuItem
              key={index}
              onClick={action.onClick}
              disabled={action.disabled}
              className={action.variant === 'destructive' ? 'text-red-600' : ''}
            >
              <Icon className="w-4 h-4 mr-2" />
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
