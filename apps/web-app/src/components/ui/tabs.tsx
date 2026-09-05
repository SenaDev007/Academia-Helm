/**
 * Tabs Component
 * 
 * Composant tabs minimal pour débloquer le build Vercel
 */

import React, { createContext, useContext, useState } from 'react';
import { cn } from '@/lib/utils';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

export interface TabsProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({ children, value: controlledValue, defaultValue, onValueChange, className }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div className={cn('w-full', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        // CDC responsive §5.4 — scroll horizontal contrôlé quand les onglets débordent,
        // l'onglet actif reste visible, jamais de compression illisible du texte
        'flex h-11 max-w-full items-center gap-0.5 overflow-x-auto rounded-md bg-gray-100 p-1 text-gray-500 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:h-10',
        className
      )}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps {
  children: React.ReactNode;
  value: string;
  className?: string;
  disabled?: boolean;
}

export function TabsTrigger({ children, value, className, disabled }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  const isActive = context?.value === value;

  if (!context) {
    console.warn('TabsTrigger must be used inside Tabs component');
    return (
      <button className={className} type="button">
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        // CDC §5.2 — cible tactile 44px en base (mobile-first), compact dès sm:
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3 text-sm font-medium ring-offset-white transition-all min-h-[40px] sm:min-h-0 sm:py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900',
        className
      )}
      onClick={() => context.onValueChange(value)}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps {
  children: React.ReactNode;
  value: string;
  className?: string;
}

export function TabsContent({ children, value, className }: TabsContentProps) {
  const context = useContext(TabsContext);
  const isActive = context?.value === value;

  if (!context) {
    console.warn('TabsContent must be used inside Tabs component');
    return null;
  }

  if (!isActive) {
    return null;
  }

  return (
    <div
      className={cn(
        'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        className
      )}
    >
      {children}
    </div>
  );
}
