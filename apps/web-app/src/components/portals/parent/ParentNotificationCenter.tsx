'use client';

/**
 * ============================================================================
 * ParentNotificationCenter — Centre de notifications pédagogiques (V3-4)
 * ============================================================================
 *
 * Affiche les notifications Yeshua Connect envoyées aux parents par les modules
 * pédagogiques : Absences / Examens / Bulletins / Devoirs / Discipline.
 *
 * Wired to the real useNotifications hook (no more MOCK).
 * Categories filter by notification type:
 *   - Absences    → ABSENCE_CREATED, ABSENCE_JUSTIFIED
 *   - Examens     → EXAM_SCHEDULED, EVALUATION_SCHEDULED
 *   - Bulletins   → BULLETIN_PUBLISHED
 *   - Devoirs     → NEW_HOMEWORK
 *   - Discipline  → SANCTION_CREATED
 * ============================================================================
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  MessageSquare,
  FileText,
  Archive,
  ChevronRight,
  MoreVertical,
  History,
  CalendarX,
  CalendarCheck,
  GraduationCap,
  Award,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useRouter } from 'next/navigation';

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

const CATEGORIES = [
  { id: 'all', label: 'Toutes', icon: Bell, types: null },
  { id: 'absences', label: 'Absences', icon: CalendarX, types: ['ABSENCE_CREATED', 'ABSENCE_JUSTIFIED'] },
  { id: 'examens', label: 'Examens', icon: GraduationCap, types: ['EXAM_SCHEDULED', 'EVALUATION_SCHEDULED'] },
  { id: 'bulletins', label: 'Bulletins', icon: Award, types: ['BULLETIN_PUBLISHED'] },
  { id: 'devoirs', label: 'Devoirs', icon: BookOpen, types: ['NEW_HOMEWORK'] },
  { id: 'discipline', label: 'Discipline', icon: ShieldAlert, types: ['SANCTION_CREATED'] },
];

const PEDAGOGICAL_TYPES = new Set([
  'ABSENCE_CREATED',
  'ABSENCE_JUSTIFIED',
  'EXAM_SCHEDULED',
  'EVALUATION_SCHEDULED',
  'BULLETIN_PUBLISHED',
  'NEW_HOMEWORK',
  'SANCTION_CREATED',
]);

function getPedagogicalIcon(type: string) {
  switch (type) {
    case 'ABSENCE_CREATED':
      return <CalendarX className="w-6 h-6 text-amber-600" />;
    case 'ABSENCE_JUSTIFIED':
      return <CalendarCheck className="w-6 h-6 text-emerald-600" />;
    case 'EXAM_SCHEDULED':
    case 'EVALUATION_SCHEDULED':
      return <GraduationCap className="w-6 h-6 text-blue-700" />;
    case 'BULLETIN_PUBLISHED':
      return <Award className="w-6 h-6 text-yellow-600" />;
    case 'SANCTION_CREATED':
      return <ShieldAlert className="w-6 h-6 text-red-600" />;
    case 'NEW_HOMEWORK':
      return <BookOpen className="w-6 h-6 text-violet-700" />;
    default:
      return <FileText className="w-6 h-6 text-slate-500" />;
  }
}

export default function ParentNotificationCenter() {
  const [activeCat, setActiveCat] = useState('all');
  const {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications();
  const router = useRouter();

  // Filter to only pedagogical notifications (V3-4 scope) + apply active category filter
  const filtered = useMemo(() => {
    let list = notifications.filter((n: any) => PEDAGOGICAL_TYPES.has(n.type));
    if (activeCat !== 'all') {
      const cat = CATEGORIES.find((c) => c.id === activeCat);
      if (cat?.types) {
        list = list.filter((n: any) => cat.types!.includes(n.type));
      }
    }
    return list;
  }, [notifications, activeCat]);

  const handleClick = (notif: any) => {
    if (!notif.isRead) markAsRead(notif.id);
    const url = notif.data?.url;
    if (url) router.push(url);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            Centre de Notifications
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold text-white bg-red-500 rounded-full px-2 py-0.5">
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">
            Suivi Pédagogique — Yeshua Connect
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearAllNotifications}
            className="p-2.5 bg-slate-50 rounded-xl text-slate-500 hover:text-indigo-600 transition-all"
            title="Vider toutes les notifications"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Tout marquer comme lu
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="px-8 py-4 border-b border-slate-50 overflow-x-auto no-scrollbar flex items-center gap-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeCat === cat.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Bell className="w-12 h-12 mb-3 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">Aucune notification</p>
            <p className="text-xs text-slate-400 mt-1">
              Vous serez notifié des absences, examens, bulletins et sanctions de votre enfant.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((notif: any) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`p-6 hover:bg-slate-50/50 transition-all flex items-start gap-4 cursor-pointer group ${
                  !notif.isRead ? 'bg-indigo-50/30' : ''
                }`}
                onClick={() => handleClick(notif)}
              >
                <div
                  className={`p-3 rounded-2xl shrink-0 ${
                    notif.priority === 'HIGH' ? 'bg-rose-50' : 'bg-slate-100'
                  }`}
                >
                  {getPedagogicalIcon(notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm font-bold ${
                          !notif.isRead ? 'text-slate-900' : 'text-slate-600'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      {!notif.isRead && (
                        <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">
                      {timeAgo(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed truncate md:whitespace-normal line-clamp-2">
                    {notif.body}
                  </p>

                  <div className="mt-4 flex items-center gap-2">
                    {!notif.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notif.id);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all"
                      >
                        Accuser réception
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(notif.data?.url || '/app/parent');
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-all"
                    >
                      Détails
                    </button>
                  </div>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notif.id);
                    }}
                    className="p-2 text-slate-300 hover:text-rose-600"
                    title="Supprimer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer / Weekly Summary Link */}
      <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Notifications Yeshua Connect
          </span>
        </div>
        <button
          onClick={() => router.push('/app/parent/messages')}
          className="text-indigo-600 text-xs font-bold flex items-center gap-1 hover:gap-2 transition-all"
        >
          Ouvrir Yeshua Connect <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
