'use client';

/**
 * ============================================================================
 * ReorderableList — Liste réordonnançable par glisser-déposer (HTML5 natif)
 * ============================================================================
 *
 * Aucune librairie externe — utilise l'API HTML5 Drag & Drop.
 *
 * Chaque item reçoit :
 *   - une poignée de glissement (⋮⋮) visible au survol
 *   - un déplacement visuel pendant le drag (opacity-50)
 *   - un indicateur de position (ligne bleue) avant le drop
 *
 * Props :
 *   - items: T[]                                  → liste actuelle
 *   - onReorder: (next: T[]) => void              → callback avec nouvel ordre
 *   - getKey: (item: T) => string                 → clé unique
 *   - renderItem: (item: T, index: number) => ReactNode
 *   - itemClassName?: string                      → classes additionnelles par item
 * ============================================================================
 */

import { ReactNode, useState, useRef } from 'react';
import { GripVertical } from 'lucide-react';

interface Props {
  items: any[];
  onReorder: (next: any[]) => void;
  getKey: (item: any, index: number) => string;
  renderItem: (item: any, index: number) => ReactNode;
  itemClassName?: string;
  emptyMessage?: string;
}

export function ReorderableList({
  items,
  onReorder,
  getKey,
  renderItem,
  itemClassName = '',
  emptyMessage = 'Aucun élément pour le moment.',
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Nécessaire pour Firefox
    try {
      e.dataTransfer.setData('text/plain', String(index));
    } catch {
      // IE/Edge legacy
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
    dragCounter.current = 0;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== null && dragIndex !== index) {
      setOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setOverIndex(null);
      dragCounter.current = 0;
    }
  };

  const handleDragEnter = () => {
    dragCounter.current += 1;
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    onReorder(next);
    setDragIndex(null);
    setOverIndex(null);
    dragCounter.current = 0;
  };

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">{emptyMessage}</div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => {
        const key = getKey(item, index);
        const isDragging = dragIndex === index;
        const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;

        return (
          <li
            key={key}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragEnter={handleDragEnter}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            className={`group relative flex items-stretch bg-white border rounded-xl transition ${
              isDragging
                ? 'opacity-50 border-blue-400 shadow-lg'
                : isOver
                ? 'border-blue-500 border-t-4'
                : 'border-slate-200 hover:border-slate-300'
            } ${itemClassName}`}
          >
            {/* Poignée de glissement */}
            <div
              className="flex items-center justify-center w-10 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition rounded-l-xl border-r border-slate-100 bg-slate-50/50"
              title="Glisser pour réordonner"
            >
              <GripVertical className="w-4 h-4" />
            </div>

            {/* Contenu */}
            <div className="flex-1 min-w-0 p-3">
              {renderItem(item, index)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
