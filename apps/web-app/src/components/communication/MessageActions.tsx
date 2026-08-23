'use client';

/**
 * ============================================================================
 * HELM CONNECT — Message Actions (reply/forward/delete/copy/pin)
 * ============================================================================
 *
 * Actions WhatsApp/Telegram-style sur les messages :
 *   - Répondre (reply)
 *   - Transférer (forward)
 *   - Copier
 *   - Épingler (pin)
 *   - Supprimer pour soi (delete for me)
 *   - Supprimer pour tous (delete for everyone — sender only)
 *   - Sélectionner (multi-select mode)
 *
 * ⭐ Formatage du texte (V2.7) :
 *   - *gras*, _italique_, ~barré~, `code`, [surligné]
 *   - Rendu en Markdown léger dans les bulles
 *
 * ⭐ Backend endpoints nécessaires :
 *   POST /api/chat/messages/:id/delete-for-me
 *   POST /api/chat/messages/:id/delete-for-everyone
 *   POST /api/chat/messages/:id/forward
 *   (Le pin/unpin existe déjà dans document-center.service.ts)
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Reply, Forward, Copy, Pin, Trash2, Check, X, MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface MessageActionCallbacks {
  onReply: (messageId: string) => void;
  onForward: (messageId: string) => void;
  onCopy: (messageId: string, content: string) => void;
  onPin: (messageId: string) => void;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForEveryone: (messageId: string) => void;
}

interface MessageActionsProps {
  messageId: string;
  content: string;
  isOwn: boolean;
  isPinned: boolean;
  conversationId: string;
  callbacks: MessageActionCallbacks;
  trigger: React.ReactNode;  // The message bubble itself
}

export default function MessageActions({
  messageId,
  content,
  isOwn,
  isPinned,
  conversationId,
  callbacks,
  trigger,
}: MessageActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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

  // Build menu items based on permissions
  const items: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
  }> = [
    {
      label: 'Répondre',
      icon: <Reply className="w-4 h-4" />,
      onClick: () => { callbacks.onReply(messageId); setIsOpen(false); },
    },
    {
      label: 'Transférer',
      icon: <Forward className="w-4 h-4" />,
      onClick: () => { callbacks.onForward(messageId); setIsOpen(false); },
    },
    {
      label: 'Copier',
      icon: <Copy className="w-4 h-4" />,
      onClick: () => {
        navigator.clipboard.writeText(content).then(() => {
          toast.success('Message copié');
        });
        setIsOpen(false);
      },
    },
    {
      label: isPinned ? 'Désépingler' : 'Épingler',
      icon: <Pin className="w-4 h-4" />,
      onClick: () => { callbacks.onPin(messageId); setIsOpen(false); },
    },
    {
      label: 'Supprimer pour moi',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => { callbacks.onDeleteForMe(messageId); setIsOpen(false); },
      danger: true,
    },
  ];

  // Only the sender can delete for everyone
  if (isOwn) {
    items.push({
      label: 'Supprimer pour tous',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => { callbacks.onDeleteForEveryone(messageId); setIsOpen(false); },
      danger: true,
    });
  }

  return (
    <div
      ref={containerRef}
      className="relative group"
      onContextMenu={(e) => {
        e.preventDefault();
        setIsOpen(true);
      }}
    >
      {trigger}
      {/* ⭐ Hover action button — appears on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          'absolute top-0.5 right-0.5 p-1 rounded-full bg-white/90 shadow-sm border border-slate-200',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          isOpen && 'opacity-100'
        )}
        title="Actions du message"
      >
        <MoreVertical className="w-3 h-3 text-slate-500" />
      </button>
      {/* Dropdown menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-full mt-1 min-w-[180px] bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1',
            isOwn ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 text-left',
                item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700'
              )}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Render text content with simple Markdown formatting (like WhatsApp).
 * Supports: *bold*, _italic_, ~strike~, `code`, [highlighted]
 */
export function renderFormattedText(text: string): React.ReactNode {
  if (!text) return null;

  // Split into parts by format markers
  // Order matters: code first (so its content isn't re-formatted)
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Match: *bold*, _italic_, ~strike~, `code`, [highlighted]
  const regex = /(\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`|\[[^\]]+\])/;
  while (remaining.length > 0) {
    const match = remaining.match(regex);
    if (!match || match.index === undefined || match.index >= remaining.length) {
      parts.push(remaining);
      break;
    }
    // Add text before the match
    if (match.index > 0) {
      parts.push(remaining.substring(0, match.index));
    }
    // Add formatted text
    const matchedText = match[0];
    if (matchedText.startsWith('*')) {
      parts.push(<strong key={key++} className="font-bold">{matchedText.slice(1, -1)}</strong>);
    } else if (matchedText.startsWith('_')) {
      parts.push(<em key={key++} className="italic">{matchedText.slice(1, -1)}</em>);
    } else if (matchedText.startsWith('~')) {
      parts.push(<span key={key++} className="line-through">{matchedText.slice(1, -1)}</span>);
    } else if (matchedText.startsWith('`')) {
      parts.push(<code key={key++} className="px-1 py-0.5 bg-slate-100 rounded text-xs font-mono">{matchedText.slice(1, -1)}</code>);
    } else if (matchedText.startsWith('[')) {
      parts.push(<mark key={key++} className="bg-amber-200 px-0.5 rounded">{matchedText.slice(1, -1)}</mark>);
    }
    remaining = remaining.substring(match.index + matchedText.length);
  }

  return <>{parts.map((p, i) => <span key={i}>{p}</span>)}</>;
}
