'use client';

/**
 * ============================================================================
 * NotificationDropdown — Cloche + panneau déroulant
 * ============================================================================
 *
 * Affiche :
 *   - Une icône cloche avec badge du nombre de non lues
 *   - Au clic, un panneau déroulant avec la liste des notifications
 *   - Boutons : "Tout marquer comme lu", "Supprimer" par notif
 *   - Clic sur une notif → marquer comme lue + naviguer vers l'URL (data.url)
 *
 * Utilise le hook useNotifications (polling 30s + son + toast).
 * ============================================================================
 */

import { useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, X, FileText, UserPlus, AlertCircle, Info } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Formate la date en "il y a X". */
function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);
  if (diffSec < 60) return 'à l\'instant';
  if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)} h`;
  if (diffSec < 604800) return `il y a ${Math.floor(diffSec / 86400)} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Icône selon le type de notification. */
function getNotifIcon(type: string) {
  switch (type) {
    case 'ADMISSION_SUBMITTED':
      return <UserPlus className="w-4 h-4 text-blue-600" />;
    case 'CANDIDATURE_SUBMITTED':
      return <UserPlus className="w-4 h-4 text-violet-600" />;
    case 'SYSTEM':
      return <Info className="w-4 h-4 text-slate-600" />;
    default:
      return <FileText className="w-4 h-4 text-slate-500" />;
  }
}

export default function NotificationDropdown() {
  const {
    unreadCount,
    notifications,
    isLoading,
    isOpen,
    setIsOpen,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen]);

  const handleClickNotif = (notif: typeof notifications[0]) => {
    if (!notif.isRead) markAsRead(notif.id);
    const url = notif.data?.url;
    if (url) {
      router.push(url);
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bouton cloche */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all"
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panneau déroulant */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold text-white bg-red-500 rounded-full px-2 py-0.5">
                  {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 hover:bg-emerald-100 rounded-lg text-emerald-700 transition"
                  title="Tout marquer comme lu"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Liste */}
          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Bell className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-500">Aucune notification</p>
                <p className="text-xs text-slate-400 mt-1">Vous êtes à jour !</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      'group relative px-4 py-3 hover:bg-slate-50 transition cursor-pointer',
                      !notif.isRead && 'bg-blue-50/40',
                    )}
                    onClick={() => handleClickNotif(notif)}
                  >
                    <div className="flex gap-3">
                      <div className="shrink-0 mt-0.5">
                        {getNotifIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {notif.title}
                          </p>
                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                          {notif.body}
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-slate-400">{timeAgo(notif.createdAt)}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                            {!notif.isRead && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notif.id);
                                }}
                                className="p-1 hover:bg-emerald-100 rounded text-emerald-700 transition"
                                title="Marquer comme lu"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notif.id);
                              }}
                              className="p-1 hover:bg-rose-100 rounded text-rose-600 transition"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-center">
              <p className="text-[10px] text-slate-400">
                Cliquez sur une notification pour l'ouvrir
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
