/**
 * Select Component
 *
 * Composant select custom avec support de l'affichage du libellé
 * (et non de la valeur/UUID) quand un item est sélectionné.
 *
 * Bug corrigé : SelectValue affichait l'UUID au lieu du libellé.
 * Solution : Le SelectContent enregistre un mapping value→label
 * dans le context, et SelectValue utilise ce mapping.
 */

import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
  /** Mapping value → label pour afficher le libellé dans SelectValue */
  labelMap: React.MutableRefObject<Record<string, string>>;
  /** Enregistrer un item (value → label) dans le mapping */
  registerItem: (value: string, label: string) => void;
}

const SelectContext = createContext<SelectContextType | null>(null);

/**
 * ⭐ FIX 2026-09-15 : extraction RÉCURSIVE du libellé d'un SelectItem.
 * Avant, seuls les children de type « string » ou « string[] » étaient
 * enregistrés dans le labelMap — un item avec markup complexe (ex :
 * <span className="flex items-center gap-2"><Icône/><span>Espèces</span></span>)
 * n'était JAMAIS enregistré, et le SelectValue continuait d'afficher le
 * placeholder alors même qu'une valeur était sélectionnée (ex : méthode
 * « Espèces » par défaut dans le modal Nouveau paiement du module Finance).
 * La descente récursive dans props.children fait ressortir tout le texte
 * (les icônes SVG ne contribuent aucun texte — seul le libellé ressort).
 */
function extractItemLabel(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractItemLabel).join('');
  if (React.isValidElement(node)) {
    return extractItemLabel((node.props as any)?.children);
  }
  return '';
}

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
  // ⭐ FIX 2026-09-15 : labelMap est une ref (non réactive) — sans ce compteur
  //    de version, l'enregistrement d'un libellé (qui arrive APRÈS le rendu
  //    initial, via les effets de SelectContent/SelectItem) ne re-render pas
  //    le Select : le SelectValue resterait bloqué sur le placeholder.
  //    Le bump ne se produit QUE quand un libellé change réellement (guard
  //    d'égalité dans registerItem) — aucune boucle de rendu possible.
  const [, setLabelMapVersion] = useState(0);
  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const contentRef = useRef<HTMLDivElement>(null);
  const labelMap = useRef<Record<string, string>>({});

  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
    setOpen(false);
  };

  const registerItem = React.useCallback((itemValue: string, label: string) => {
    if (!itemValue || !label) return;
    // Déjà enregistré à l'identique → aucun re-rendu (évite les boucles)
    if (labelMap.current[itemValue] === label) return;
    labelMap.current[itemValue] = label;
    setLabelMapVersion((v) => v + 1);
  }, []);

  return (
    <SelectContext.Provider value={{
      value: String(value || ''),
      onValueChange: handleValueChange,
      open,
      setOpen,
      contentRef,
      labelMap,
      registerItem,
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

  // Si une valeur est sélectionnée, retrouver son libellé dans le labelMap
  if (context.value) {
    const label = context.labelMap.current[context.value];
    if (label) {
      return <span>{label}</span>;
    }
    // Si le label n'est pas encore enregistré (ex: au premier rendu avant
    // que SelectContent ne soit monté), afficher le placeholder
    // plutôt que l'UUID brut
  }

  // Aucune valeur sélectionnée → afficher le placeholder
  return <span className="text-gray-500">{placeholder || 'Sélectionner...'}</span>;
}

export interface SelectContentProps {
  children: React.ReactNode;
}

export function SelectContent({ children }: SelectContentProps) {
  const context = useContext(SelectContext);

  // ⭐ FIX 2026-09-15 : l'enregistrement value→label se fait désormais en
  //    POST-RENDER (useEffect) et non plus pendant le render — un effet de
  //    bord pendant le render est interdit, et le bump de version du
  //    labelMap y déclencherait le warning React « Cannot update a component
  //    while rendering a different component ». L'effet tourne à chaque
  //    rendu (children identité neuve à chaque render parent) mais le guard
  //    d'égalité de registerItem le rend inactif une fois le libellé posé.
  //    On couvre ainsi l'état FERMÉ (items jamais montés — analyse statique
  //    des props children) et l'état OUVERT (les SelectItem montés
  //    s'enregistrent aussi eux-mêmes via leur propre effet).
  useEffect(() => {
    if (!context) return;
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && (child.type as any)?.displayName === 'SelectItem') {
        const itemValue = (child.props as any).value;
        const label = extractItemLabel((child.props as any).children);
        if (itemValue && label) {
          context.registerItem(itemValue, label);
        }
      }
    });
  });

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
              context.onValueChange((child.props as any).value);
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

  // Enregistrer le mapping value → label à chaque rendu
  // ⭐ FIX 2026-09-15 : extraction récursive — les items avec markup complexe
  //    (icône + libellé dans des <span>) s'enregistrent désormais aussi.
  useEffect(() => {
    if (context && value) {
      const label = extractItemLabel(children);
      if (label) {
        context.registerItem(value, label);
      }
    }
  }, [value, children, context]);

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
