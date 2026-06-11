/**
 * ============================================================================
 * INFO CARD - CARTE D'INFORMATION
 * ============================================================================
 * 
 * Composant standard pour afficher des informations structurées
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InfoCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: 'default' | 'bordered' | 'elevated';
  className?: string;
}

export function InfoCard({
  title,
  description,
  icon,
  children,
  footer,
  variant = 'default',
  className,
}: InfoCardProps) {
  const variantStyles = {
    default: 'bg-white',
    bordered: 'bg-white border border-gray-200',
    elevated: 'bg-white shadow-md',
  };

  return (
    <div className={cn('rounded-lg p-6', variantStyles[variant], className)}>
      <div className="flex items-start space-x-4">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
          {description && (
            <p className="text-sm text-gray-600 mb-4">{description}</p>
          )}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-4 pt-4 border-t border-gray-200">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
