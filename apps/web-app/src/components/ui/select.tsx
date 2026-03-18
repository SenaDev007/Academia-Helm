/**
 * Select Component
 * 
 * Composant select minimal pour débloquer le build Vercel
 */

import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  contentRef: React.RefObject<HTMLDivElement>;
}

const SelectContext = createContext<SelectContextType | null>(null);

export interface SelectProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
}

export function Select({ children, value: controlledValue, defaultValue, onValueChange, name }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || '');
  const [open, setOpen] = useState(false);
  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const contentRef = useRef<HTMLDivElement>(null);

  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
    setOpen(false);
  };

  return (
    <SelectContext.Provider value={{ 
      value: String(value || ''), 
      onValueChange: handleValueChange, 
      open, 
      setOpen,
      contentRef
    }}>
      <div className="relative">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return child;
          }
          return child;
        })}
        {name && <input type="hidden" name={name} value={value} />}
      </div>
    </SelectContext.Provider>
  );
}

export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  const context = useContext(SelectContext);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!context?.open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        context.contentRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !context.contentRef.current.contains(event.target as Node)
      ) {
        context.setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [context?.open, context?.contentRef]);

  if (!context) {
    return <button className={className} {...props}>{children}</button>;
  }

  return (
    <button
      type="button"
      ref={triggerRef}
      className={cn(
        'flex w-full min-h-[44px] items-center justify-between rounded-xl border border-gray-300 bg-white px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base',
        'ring-offset-white placeholder:text-gray-500',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      onClick={() => context.setOpen(!context.open)}
      {...props}
    >
      {children}
    </button>
  );
}

export interface SelectValueProps {
  placeholder?: string;
  children?: React.ReactNode;
}

export function SelectValue({ placeholder, children }: SelectValueProps) {
  const context = useContext(SelectContext);
  
  if (!context) {
    return <span>{placeholder || 'Sélectionner...'}</span>;
  }

  // If children are provided, use them (for custom display)
  if (children) {
    return <span>{children}</span>;
  }

  // Otherwise show placeholder or value
  const displayValue = context.value ? context.value : placeholder || 'Sélectionner...';
  return <span>{displayValue}</span>;
}

export interface SelectContentProps {
  children: React.ReactNode;
}

export function SelectContent({ children }: SelectContentProps) {
  const context = useContext(SelectContext);
  
  if (!context) {
    return null;
  }

  if (!context.open) {
    return null;
  }

  return (
    <div
      ref={context.contentRef}
      className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-[300px] overflow-auto p-1"
    >
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child) && (child.type as any)?.displayName === 'SelectItem') {
          return React.cloneElement(child, {
            key: index,
            onClick: () => {
              const value = (child.props as any).value;
              context.onValueChange(value);
            },
          } as any);
        }
        return child;
      })}
    </div>
  );
}

SelectContent.displayName = 'SelectContent';

export interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function SelectItem({ value, children, onClick, className, ...props }: SelectItemProps) {
  const context = useContext(SelectContext);
  const isSelected = context?.value === value;

  return (
    <div
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
        'hover:bg-gray-100 focus:bg-gray-100',
        isSelected && 'bg-blue-50 text-blue-900',
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

SelectItem.displayName = 'SelectItem';
