'use client';

/**
 * ============================================================================
 * HELM CONNECT V2.3 — Notification Preferences Modal
 * ============================================================================
 *
 * Gère les préférences de notification de l'utilisateur :
 *   - Mode silencieux global (DND) avec durée : 1h, 8h, 24h, jusqu'à réactivation
 *   - Filtres par type d'événement (messages, annonces, mentions, fichiers)
 *   - Plages horaires "quiet hours" (ex: 22h–07h)
 *
 * ⭐ Endpoints utilisés :
 *   GET    /api/chat/v2/notifications/preferences
 *   PUT    /api/chat/v2/notifications/preferences
 *   POST   /api/chat/v2/notifications/dnd/enable
 *   POST   /api/chat/v2/notifications/dnd/disable
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, X, Bell, BellOff, Moon, Clock, Volume2, VolumeX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NotificationPreferences {
  dndEnabled: boolean;
  dndUntil?: string | null;
  dndExceptions: string[];
  enableMessages: boolean;
  enableGroupMessages: boolean;
  enableAnnouncements: boolean;
  enableMentions: boolean;
  enableFiles: boolean;
  enableInvitations: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone: string;
}

const DEFAULT_PREFS: NotificationPreferences = {
  dndEnabled: false,
  dndUntil: null,
  dndExceptions: ['ANNOUNCEMENT'],
  enableMessages: true,
  enableGroupMessages: true,
  enableAnnouncements: true,
  enableMentions: true,
  enableFiles: true,
  enableInvitations: true,
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: 'UTC',
};

export default function NotificationPreferencesModal({
  currentUserId,
  onClose,
}: {
  currentUserId: string;
  onClose: () => void;
}) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPrefs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/chat/v2/notifications/preferences?userId=${currentUserId}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as any)?.backendError?.message ||
          (err as any)?.message ||
          `Erreur ${res.status}`
        );
      }
      const data = await res.json();
      setPrefs({ ...DEFAULT_PREFS, ...data });
    } catch (e: any) {
      toast.error('Échec : ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  const updatePrefs = async (updates: Partial<NotificationPreferences>) => {
    setSaving(true);
    try {
      const newPrefs = { ...prefs, ...updates };
      setPrefs(newPrefs);
      const res = await fetch('/api/chat/v2/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, ...updates }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as any)?.backendError?.message ||
          (err as any)?.message ||
          `Erreur ${res.status}`
        );
      }
      const data = await res.json();
      setPrefs({ ...DEFAULT_PREFS, ...data });
    } catch (e: any) {
      toast.error('Échec : ' + e.message);
      // Revert on failure
      await loadPrefs();
    } finally {
      setSaving(false);
    }
  };

  const enableDnd = async (duration: '1H' | '8H' | '24H' | 'FOREVER') => {
    setSaving(true);
    try {
      const res = await fetch('/api/chat/v2/notifications/dnd/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          duration,
          exceptions: ['ANNOUNCEMENT'], // Keep announcements passing through DND
        }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as any)?.backendError?.message ||
          (err as any)?.message ||
          `Erreur ${res.status}`
        );
      }
      const data = await res.json();
      setPrefs({ ...prefs, ...data });
      const label =
        duration === '1H' ? '1 heure' :
        duration === '8H' ? '8 heures' :
        duration === '24H' ? '24 heures' :
        'réactivation manuelle';
      toast.success(`Mode silencieux activé pendant ${label}`);
    } catch (e: any) {
      toast.error('Échec : ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const disableDnd = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/chat/v2/notifications/dnd/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as any)?.backendError?.message ||
          (err as any)?.message ||
          `Erreur ${res.status}`
        );
      }
      const data = await res.json();
      setPrefs({ ...prefs, ...data });
      toast.success('Mode silencieux désactivé');
    } catch (e: any) {
      toast.error('Échec : ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSwitch = (
    label: string,
    description: string,
    value: boolean,
    onChange: (v: boolean) => void,
    icon: React.ReactNode
  ) => (
    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="text-slate-500 mt-0.5">{icon}</div>
        <div>
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          <div className="text-xs text-slate-500">{description}</div>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={saving}
        className={cn(
          'w-11 h-6 rounded-full transition-colors relative flex-shrink-0',
          value ? 'bg-[3B9EFF]' : 'bg-slate-300'
        )}
      >
        <div
          className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow',
            value ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#E6F4FF/5]0]">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-[1677FF]" />
              Notifications
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Gérez vos préférences de notification
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* ⭐ Mode silencieux global */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Moon className="w-4 h-4 text-indigo-600" />
                    Mode silencieux
                  </h4>
                  <p className="text-xs text-slate-500">
                    Bloque toutes les notifications sauf les annonces
                  </p>
                </div>
                {prefs.dndEnabled && (
                  <button
                    onClick={disableDnd}
                    disabled={saving}
                    className="text-xs px-2 py-1 bg-rose-50 text-rose-700 rounded font-semibold hover:bg-rose-100"
                  >
                    Désactiver
                  </button>
                )}
              </div>

              {prefs.dndEnabled ? (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <div className="text-sm font-semibold text-indigo-900">
                    🔕 Mode silencieux actif
                  </div>
                  <div className="text-xs text-indigo-700 mt-0.5">
                    {prefs.dndUntil
                      ? `Jusqu'à ${new Date(prefs.dndUntil).toLocaleString('fr-FR')}`
                      : "Jusqu'à réactivation manuelle"}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => enableDnd('1H')}
                    disabled={saving}
                    className="px-2 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded hover:bg-slate-200"
                  >
                    1h
                  </button>
                  <button
                    onClick={() => enableDnd('8H')}
                    disabled={saving}
                    className="px-2 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded hover:bg-slate-200"
                  >
                    8h
                  </button>
                  <button
                    onClick={() => enableDnd('24H')}
                    disabled={saving}
                    className="px-2 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded hover:bg-slate-200"
                  >
                    24h
                  </button>
                  <button
                    onClick={() => enableDnd('FOREVER')}
                    disabled={saving}
                    className="px-2 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded hover:bg-slate-200"
                  >
                    ∞
                  </button>
                </div>
              )}
            </div>

            {/* ⭐ Quiet hours */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                Heures tranquilles
              </h4>
              <div className="flex items-center gap-2 text-xs">
                <span>De</span>
                <input
                  type="time"
                  value={prefs.quietHoursStart || ''}
                  onChange={(e) => updatePrefs({ quietHoursStart: e.target.value || null })}
                  className="px-2 py-1 border border-slate-200 rounded text-xs"
                />
                <span>à</span>
                <input
                  type="time"
                  value={prefs.quietHoursEnd || ''}
                  onChange={(e) => updatePrefs({ quietHoursEnd: e.target.value || null })}
                  className="px-2 py-1 border border-slate-200 rounded text-xs"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Pas de notifications pendant ces heures (sauf annonces).
              </p>
            </div>

            {/* ⭐ Filtres par type */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-[1677FF]" />
                Types d'événements
              </h4>
              <div className="space-y-2">
                {toggleSwitch(
                  'Messages privés',
                  'Conversations 1-à-1',
                  prefs.enableMessages,
                  (v) => updatePrefs({ enableMessages: v }),
                  <Bell className="w-4 h-4" />
                )}
                {toggleSwitch(
                  'Messages de groupe',
                  'Conversations de groupe',
                  prefs.enableGroupMessages,
                  (v) => updatePrefs({ enableGroupMessages: v }),
                  <Bell className="w-4 h-4" />
                )}
                {toggleSwitch(
                  'Annonces officielles',
                  'Annonces de la direction',
                  prefs.enableAnnouncements,
                  (v) => updatePrefs({ enableAnnouncements: v }),
                  <Bell className="w-4 h-4" />
                )}
                {toggleSwitch(
                  'Mentions',
                  'Quand quelqu\'un vous @mentionne',
                  prefs.enableMentions,
                  (v) => updatePrefs({ enableMentions: v }),
                  <Bell className="w-4 h-4" />
                )}
                {toggleSwitch(
                  'Fichiers',
                  'Quand on reçoit un fichier',
                  prefs.enableFiles,
                  (v) => updatePrefs({ enableFiles: v }),
                  <Bell className="w-4 h-4" />
                )}
                {toggleSwitch(
                  'Invitations',
                  'Invitations à rejoindre une conversation',
                  prefs.enableInvitations,
                  (v) => updatePrefs({ enableInvitations: v }),
                  <Bell className="w-4 h-4" />
                )}
              </div>
            </div>

            {saving && (
              <div className="flex items-center justify-center py-2 text-xs text-slate-500">
                <Loader2 className="w-3 h-3 animate-spin mr-1" /> Enregistrement...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
