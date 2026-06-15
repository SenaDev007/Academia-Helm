/**
 * ============================================================================
 * MODAL BLUEPRINT - MODAL STANDARD
 * ============================================================================
 * 
 * Composant standard pour tous les modals de l'application
 * Types : confirmation, création, édition, validation, rejet
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { X, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ModalType = 'info' | 'warning' | 'error' | 'success' | 'confirmation';

export interface ModalBlueprintProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  type?: ModalType;
  children?: ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function ModalBlueprint({
  open,
  onClose,
  title,
  description,
  type = 'info',
  children,
  primaryAction,
  secondaryAction,
  size = 'md',
  className,
}: ModalBlueprintProps) {
  const typeConfig = {
    info: {
      icon: Info,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    error: {
      icon: XCircle,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    confirmation: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(sizeClasses[size], className)}>
        <DialogHeader>
          <div className="flex items-start space-x-3">
            <div className={cn('p-2 rounded-lg', config.bgColor)}>
              <Icon className={cn('w-5 h-5', config.iconColor)} />
            </div>
            <div className="flex-1">
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-2">{description}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {children && <div className="py-4">{children}</div>}

        <DialogFooter>
          {secondaryAction && (
            <Button
              type="button"
              variant="outline"
              onClick={secondaryAction.onClick}
              disabled={primaryAction?.loading}
            >
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.loading}
              variant={type === 'error' ? 'destructive' : 'default'}
            >
              {primaryAction.loading ? 'Traitement...' : primaryAction.label}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
