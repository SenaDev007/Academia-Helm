'use client';

/**
 * ============================================================================
 * HELM CONNECT — Dropdown Menu component
 * ============================================================================
 * Simple dropdown menu — click trigger to open, click outside to close.
 * Used in the sidebar header to group secondary actions (Notifications, 
 * New channel, Announcements, etc.) under a "..." button to save space.
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DropdownMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  align?: 'left' | 'right';
}

export default function DropdownMenu({
  trigger,
  items,
  align = 'right',
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleItemClick = (item: DropdownMenuItem) => {
    item.onClick();
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && (
        <div
          className={cn(
            'absolute top-full mt-1 min-w-[180px] bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleItemClick(item)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 text-left',
                item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700'
              )}
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
