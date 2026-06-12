/**
 * ============================================================================
 * ACTION CARD - CARTE D'ACTION
 * ============================================================================
 * 
 * Composant standard pour les actions rapides
 * Utilisé dans les dashboards pour les actions fréquentes
 * 
 * ============================================================================
 */

'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export interface ActionCardProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'secondary';
  badge?: string | number;
  className?: string;
}

export function ActionCard({
  title,
  description,
  icon: Icon,
  href,
  onClick,
  variant = 'default',
  badge,
  className,
}: ActionCardProps) {
  const variantStyles = {
    default: 'bg-white border-gray-200 hover:border-gray-300',
    primary: 'bg-blue-50 border-blue-200 hover:border-blue-300',
    secondary: 'bg-gray-50 border-gray-200 hover:border-gray-300',
  };

  const iconStyles = {
    default: 'text-gray-600 bg-gray-100',
    primary: 'text-blue-600 bg-blue-100',
    secondary: 'text-gray-600 bg-gray-200',
  };

  const content = (
    <div
      className={cn(
        'rounded-lg border p-6 transition-all cursor-pointer',
        variantStyles[variant],
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start space-x-4">
        <div className={cn('p-3 rounded-lg', iconStyles[variant])}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
            {badge && (
              <span className="flex-shrink-0 ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-sm text-gray-600">{description}</p>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
