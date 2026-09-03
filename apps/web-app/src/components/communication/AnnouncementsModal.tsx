'use client';

/**
 * ============================================================================
 * HELM CONNECT — Announcements Modal (V1)
 * ============================================================================
 *
 * Système d'annonces officielles pour Academia Helm.
 *
 * Fonctionnalités :
 *   - Liste paginée des annonces (publishers voient les brouillons, les autres voient
 *     seulement les annonces publiées qui les ciblent)
 *   - Formulaire de publication (réservé aux rôles administration/direction)
 *   - Accusé de lecture (click "Marquer comme lu" ou "Confirmer avoir lu")
 *   - Statistiques de lecture (pourcentage lu/total destinataires)
 *
 * Slogan Helm Connect : « Communiquez. Collaborez. Restez connectés. »
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, X, Plus, Megaphone, Paperclip, Clock, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Announcement {
  id: string;
  authorName?: string;
  authorRole?: string;
  title: string;
  body: string;
  priority: string;
  targetType: string;
  targetLevel?: string;
  targetClassId?: string;
  requiresConfirmation: boolean;
  publishedAt?: string;
  readCount?: number;
  totalRecipients?: number;
  readByCurrentUser?: boolean;
  confirmedByCurrentUser?: boolean;
  // ⭐ V6 (spec §5) — validité + pièces jointes
  expiresAt?: string | null;
  attachments?: Array<{ url: string; name: string; size?: number; mime?: string }> | null;
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  LOW:    { bg: 'bg-slate-100', text: 'text-slate-700', label: 'INFO',      icon: 'ℹ️' },
  NORMAL: { bg: 'bg-blue-50',   text: 'text-blue-700',  label: 'ANNONCE',    icon: '📢' },
  HIGH:   { bg: 'bg-amber-50',  text: 'text-amber-700', label: 'IMPORTANT', icon: '⚠️' },
  URGENT: { bg: 'bg-rose-50',   text: 'text-rose-700',  label: 'URGENT',    icon: '🔴' },
};

const TARGET_LABELS: Record<string, string> = {
  ALL_SCHOOL: "Toute l'école",
  LEVEL: 'Niveau',
  CLASS: 'Classe',
  TEACHERS: 'Enseignants',
  PARENTS: 'Parents',
  GROUP: 'Groupe',
  CHANNEL: 'Canal',
};

export default function AnnouncementsModal({
  currentUserId,
  onClose,
}: {
  currentUserId: string;
  onClose: () => void;
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    priority: 'NORMAL' as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
    targetType: 'ALL_SCHOOL',
    requiresConfirmation: false,
    scheduledAt: '',             // ⭐ V2.1 — ISO datetime-local string for scheduled publish
    // ⭐ V6 (spec §5) — validité (expiresAt) + pièces jointes
    expiresAt: '',               // date de fin de validité (input type=date)
    attachments: [] as Array<{ url: string; name: string; size?: number; mime?: string }>,
  });
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  // ⭐ V6 (spec §8) — SARA : rédaction assistée (POST /chat/v2/sara/draft)
  const [saraLoading, setSaraLoading] = useState(false);

  const draftWithSara = async () => {
    const intent = form.title.trim() || 'une communication scolaire générale';
    const audienceMap: Record<string, string> = {
      ALL_SCHOOL: "toute la communauté éducative (parents, enseignants, élèves)",
      TEACHERS: 'les enseignants de l\u00e9tablissement',
      PARENTS: 'les parents d\u0027élèves',
      LEVEL: 'les parents et élèves d\u0027un niveau scolaire',
      CLASS: 'les parents et élèves d\u0027une classe',
    };
    setSaraLoading(true);
    try {
      const res = await fetch('/api/chat/v2/sara/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent,
          targetAudience: audienceMap[form.targetType] || 'la communauté éducative',
          tone: form.priority === 'URGENT' || form.priority === 'HIGH' ? 'urgent' : 'professional',
          keyPoints: form.body.trim() ? [form.body.trim().substring(0, 200)] : [],
          language: 'fr',
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`SARA indisponible (${res.status})`);
      const data = await res.json();
      setForm(prev => ({ ...prev, body: data.content || prev.body }));
      toast.success('Brouillon SARA inséré — ajustez librement');
    } catch (e: any) {
      toast.error('SARA : ' + e.message);
    } finally {
      setSaraLoading(false);
    }
  };

  // ⭐ V6 (spec §5) — upload d'une pièce jointe d'annonce : POST multipart
  //    /api/chat/attachments (endpoint fichiers du chat), puis on attache
  //    {url, name, size, mime} au formulaire.
  const uploadAnnouncementAttachment = async (files: File[]) => {
    setAttachmentUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('senderId', currentUserId);
        const res = await fetch('/api/chat/attachments', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Upload échoué (${res.status})`);
        const data = await res.json();
        setForm(prev => ({
          ...prev,
          attachments: [...prev.attachments, {
            url: data.attachmentUrl || data.url || '',
            name: data.attachmentName || file.name,
            size: data.attachmentSize || file.size,
            mime: data.attachmentMime || file.type,
          }],
        }));
      }
      toast.success('Pièce(s) jointe(s) ajoutée(s)');
    } catch (e: any) {
      toast.error('Jointe impossible : ' + e.message);
    } finally {
      setAttachmentUploading(false);
    }
  };

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/chat/announcements?userId=${currentUserId}&limit=50`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message || `Erreur ${res.status}`);
      }
      const data = await res.json();
      setAnnouncements(data.items || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const publishAnnouncement = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Le titre et le contenu sont obligatoires');
      return;
    }
    setPublishing(true);
    try {
      // ⭐ V2.1: If scheduledAt is set, send as scheduled (publishNow=false).
      //    Otherwise publish immediately.
      const isScheduled = !!form.scheduledAt;
      const res = await fetch('/api/chat/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: currentUserId,
          title: form.title,
          body: form.body,
          priority: form.priority,
          targetType: form.targetType,
          requiresConfirmation: form.requiresConfirmation,
          publishNow: !isScheduled,
          scheduledAt: isScheduled ? new Date(form.scheduledAt).toISOString() : undefined,
          // ⭐ V6 (spec §5) — validité + pièces jointes
          expiresAt: form.expiresAt ? new Date(form.expiresAt + 'T23:59:59').toISOString() : undefined,
          attachments: form.attachments.length > 0 ? form.attachments : undefined,
        }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message || (err as any)?.backendError?.message || `Erreur ${res.status}`);
      }
      toast.success(
        isScheduled
          ? `Annonce programmée pour le ${new Date(form.scheduledAt).toLocaleString('fr-FR')}`
          : 'Annonce publiée avec succès'
      );
      setForm({
        title: '',
        body: '',
        priority: 'NORMAL',
        targetType: 'ALL_SCHOOL',
        requiresConfirmation: false,
        scheduledAt: '',
        expiresAt: '',
        attachments: [],
      });
      setShowForm(false);
      loadAnnouncements();
    } catch (e: any) {
      toast.error('Échec : ' + e.message);
    } finally {
      setPublishing(false);
    }
  };

  const markAsRead = async (id: string, requiresConfirmation: boolean) => {
    try {
      const endpoint = requiresConfirmation ? 'confirm' : 'read';
      await fetch(`/api/chat/announcements/${id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      });
      loadAnnouncements();
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#E6F4FF/5]0]">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[1677FF]" />
              Annonces officielles
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Helm Connect — communication institutionnelle
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <button
            onClick={() => loadAnnouncements()}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            Actualiser
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[1677FF] text-white rounded-lg text-xs font-bold hover:bg-[0958D9]"
          >
            <Plus className="w-3.5 h-3.5" />
            {showForm ? 'Annuler' : 'Publier une annonce'}
          </button>
        </div>

        {/* New announcement form */}
        {showForm && (
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
            <input
              type="text"
              placeholder="Titre de l'annonce *"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#3B9EFF/3]0]"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
            <textarea
              placeholder="Contenu de l'annonce *"
              rows={4}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#3B9EFF/3]0]"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
            {/* ⭐ V6 (spec §8) — SARA : rédaction assistée par l'IA */}
            <button
              onClick={draftWithSara}
              disabled={saraLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[11px] font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
              title="Laisser l'IA SARA rédiger un brouillon à partir du titre et de la cible"
            >
              {saraLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {saraLoading ? 'SARA rédige…' : 'Rédiger avec SARA'}
            </button>
            <div className="flex gap-2 flex-wrap">
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              >
                <option value="LOW">ℹ️ Info</option>
                <option value="NORMAL">📢 Annonce</option>
                <option value="HIGH">⚠️ Important</option>
                <option value="URGENT">🔴 Urgent</option>
              </select>
              <select
                value={form.targetType}
                onChange={(e) => setForm({ ...form, targetType: e.target.value as any })}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              >
                <option value="ALL_SCHOOL">Toute l'école</option>
                <option value="TEACHERS">Enseignants</option>
                <option value="PARENTS">Parents</option>
                <option value="LEVEL">Niveau (V2)</option>
                <option value="CLASS">Classe (V2)</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs text-slate-700 px-2 py-1.5">
                <input
                  type="checkbox"
                  checked={form.requiresConfirmation}
                  onChange={(e) => setForm({ ...form, requiresConfirmation: e.target.checked })}
                />
                Accusé de lecture obligatoire
              </label>
              {/* ⭐ V2.1 — Scheduled publish */}
              <label className="flex items-center gap-1.5 text-xs text-slate-700 px-2 py-1.5">
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                />
                <span className="text-[10px] text-slate-500">(vide = publication immédiate)</span>
              </label>
              {/* ⭐ V6 (spec §5) — validité de l'annonce (masquée/apurée à l'expiration) */}
              <label className="flex items-center gap-1.5 text-xs text-slate-700 px-2 py-1.5">
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                  title="L'annonce sera retirée automatiquement après cette date"
                />
                <span className="text-[10px] text-slate-500">Validité (fin)</span>
              </label>
            </div>
            {/* ⭐ V6 (spec §5) — pièces jointes de l'annonce : upload réel via
                l'endpoint fichiers du chat, puis {url, name, size, mime}. */}
            <div className="mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center gap-1.5">
                  <Paperclip className="w-3 h-3" />
                  {attachmentUploading ? 'Envoi…' : 'Joindre un fichier'}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;
                      uploadAnnouncementAttachment(files);
                      e.target.value = '';
                    }}
                  />
                </label>
                {form.attachments.map((att, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-[#E6F4FF] text-[#0958D9] rounded-lg text-[10px] font-medium max-w-[180px]">
                    <Paperclip className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{att.name}</span>
                    <button
                      onClick={() => setForm({ ...form, attachments: form.attachments.filter((_, idx) => idx !== i) })}
                      className="text-[#0958D9]/60 hover:text-red-500 flex-shrink-0"
                      title="Retirer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                onClick={publishAnnouncement}
                disabled={publishing || !form.title.trim() || !form.body.trim()}
                className="flex-1 px-4 py-2 bg-[1677FF] text-white text-sm font-bold rounded-lg hover:bg-[0958D9] disabled:opacity-50"
              >
                {publishing ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Publier'
                )}
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="p-4 text-center text-sm text-rose-600">{error}</div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-12 text-center">
              <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aucune annonce pour le moment</p>
            </div>
          ) : (
            announcements.map((a) => {
              const style = PRIORITY_STYLES[a.priority] || PRIORITY_STYLES.NORMAL;
              const targetLabel = TARGET_LABELS[a.targetType] || a.targetType;
              const readPercent =
                a.totalRecipients && a.totalRecipients > 0
                  ? Math.round(((a.readCount || 0) / a.totalRecipients) * 100)
                  : 0;
              return (
                <div
                  key={a.id}
                  className="p-4 border-b border-slate-100 hover:bg-slate-50/50"
                >
                  {/* Priority badge + target */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded',
                        style.bg,
                        style.text
                      )}
                    >
                      {style.icon} {style.label}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      🎯 {targetLabel}
                      {a.targetLevel ? ` — ${a.targetLevel}` : ''}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {a.publishedAt
                        ? new Date(a.publishedAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Brouillon'}
                    </span>
                  </div>
                  {/* Title */}
                  <h4 className="text-sm font-bold text-slate-900 mb-1">{a.title}</h4>
                  {/* Body */}
                  <p className="text-sm text-slate-700 whitespace-pre-wrap mb-2">{a.body}</p>
                  {/* ⭐ V6 (spec §5) — pièces jointes de l'annonce */}
                  {Array.isArray(a.attachments) && a.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {a.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={att.url?.startsWith('http') ? att.url : `${typeof window !== 'undefined' && window.location.origin ? '' : ''}${att.url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#E6F4FF] text-[#0958D9] rounded-lg text-[10px] font-medium hover:bg-[#D0E8FF] max-w-[220px]"
                          title={att.name}
                        >
                          <Paperclip className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{att.name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {/* ⭐ V6 (spec §5) — date de validité */}
                  {a.expiresAt && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
                      <Clock className="w-3 h-3" />
                      Valide jusqu'au {new Date(a.expiresAt).toLocaleDateString('fr-FR')}
                    </div>
                  )}
                  {/* Author + read stats */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      ✍️ {a.authorName || 'Administration'}
                      {a.requiresConfirmation && (
                        <span className="ml-2 text-amber-600 font-semibold">
                          • Accusé obligatoire
                        </span>
                      )}
                    </span>
                    {a.totalRecipients !== undefined && a.totalRecipients > 0 && (
                      <span
                        title={`${a.readCount}/${a.totalRecipients} destinataires ont lu`}
                      >
                        👁️ {a.readCount || 0}/{a.totalRecipients} ({readPercent}%)
                      </span>
                    )}
                  </div>
                  {/* Read progress bar */}
                  {a.totalRecipients !== undefined && a.totalRecipients > 0 && (
                    <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[3B9EFF] transition-all"
                        style={{ width: `${readPercent}%` }}
                      />
                    </div>
                  )}
                  {/* Action button */}
                  {a.publishedAt && !a.confirmedByCurrentUser && (
                    <button
                      onClick={() => markAsRead(a.id, a.requiresConfirmation)}
                      className={cn(
                        'mt-2 px-3 py-1 text-[11px] font-semibold rounded',
                        a.requiresConfirmation
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      )}
                    >
                      {a.requiresConfirmation
                        ? '✓ Confirmer avoir lu'
                        : '✓ Marquer comme lu'}
                    </button>
                  )}
                  {a.confirmedByCurrentUser && (
                    <div className="mt-2 text-[11px] text-[1677FF] font-semibold">
                      ✓ Lu et confirmé
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
