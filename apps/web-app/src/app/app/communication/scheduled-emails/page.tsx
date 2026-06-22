'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, Mail, Send, Trash2, XCircle, Loader2, Plus,
  CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Search,
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { getClientAuthorizationHeader, tryRefreshAccessToken } from '@/lib/auth/client-access-token';
import { getApiBaseUrl } from '@/lib/utils/urls';
import { toast } from '@/components/ui/toast';

const PRIMARY = '#1A2BA6';

// ─── Types ────────────────────────────────────────────────────────────────

interface ScheduledEmail {
  id: string;
  tenant_id: string;
  to_email: string;
  to_name: string | null;
  recipient_type: string | null;
  recipient_id: string | null;
  subject: string;
  html_body: string;
  text_body: string | null;
  category: string | null;
  subcategory: string | null;
  module: string | null;
  reply_to_override: string | null;
  scheduled_at: string;
  timezone: string;
  status: string; // PENDING | SENT | FAILED | CANCELLED
  sent_at: string | null;
  email_log_id: string | null;
  error_message: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getTenantId(): string | null {
  if (typeof document === 'undefined') return null;
  // Try cookie first (set by middleware)
  const match = document.cookie.match(/(?:^|;\s*)x-tenant-id=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  // Fallback to localStorage
  try {
    const session = JSON.parse(localStorage.getItem('academia_session') || '{}');
    return session?.tenant?.id || session?.user?.tenantId || null;
  } catch {
    return null;
  }
}

async function commFetch<T>(
  path: string,
  options?: { method?: string; body?: any },
  _isRetry = false,
): Promise<T> {
  const baseUrl = getApiBaseUrl(); // ex: https://api.academiahelm.com/api
  const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  const method = options?.method ?? 'GET';

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getClientAuthorizationHeader(),
    },
    credentials: 'include',
    cache: 'no-store',
    ...(options?.body && { body: JSON.stringify(options.body) }),
  });

  if (res.status === 401 && !_isRetry) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) return commFetch<T>(path, options, true);
  }

  const text = await res.text();
  if (!res.ok) {
    let err: { message?: string } = {};
    try { err = JSON.parse(text); } catch {}
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  if (!text.trim()) return null as T;
  return JSON.parse(text) as T;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function statusConfig(status: string) {
  switch (status) {
    case 'SENT': return { label: 'Envoyé', color: '#059669', bg: '#ecfdf5', icon: CheckCircle2 };
    case 'PENDING': return { label: 'En attente', color: '#ca8a04', bg: '#fefce8', icon: Clock };
    case 'FAILED': return { label: 'Échec', color: '#dc2626', bg: '#fef2f2', icon: AlertCircle };
    case 'CANCELLED': return { label: 'Annulé', color: '#6b7280', bg: '#f3f4f6', icon: XCircle };
    default: return { label: status, color: '#6b7280', bg: '#f3f4f6', icon: AlertCircle };
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function ScheduledEmailsPage() {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');

  const fetchEmails = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) {
      setError('Tenant ID non trouvé');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({ tenantId });
      if (filterStatus) params.set('status', filterStatus);
      const data = await commFetch<ScheduledEmail[]>(
        `/communication/scheduled-emails?${params.toString()}`,
      );
      setEmails(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  async function handleCancel(id: string) {
    const tenantId = getTenantId();
    if (!tenantId) return;
    if (!confirm('Annuler cet email programmé ?')) return;
    try {
      await commFetch(`/communication/scheduled-emails/${id}/cancel?tenantId=${tenantId}`, { method: 'PUT' });
      toast({ variant: 'success', title: 'Email annulé avec succès' });
      fetchEmails();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err.message });
    }
  }

  async function handleDelete(id: string) {
    const tenantId = getTenantId();
    if (!tenantId) return;
    if (!confirm('Supprimer définitivement cet email programmé ?')) return;
    try {
      await commFetch(`/communication/scheduled-emails/${id}?tenantId=${tenantId}`, { method: 'DELETE' });
      toast({ variant: 'success', title: 'Email supprimé' });
      fetchEmails();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err.message });
    }
  }

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-6 w-6" style={{ color: PRIMARY }} />
              Emails programmés
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Programmez l'envoi d'emails à une date/heure précise (candidats, parents, staff).
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm hover:opacity-90 transition"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus className="h-4 w-4" /> Programmer un email
          </button>
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2">
          {['', 'PENDING', 'SENT', 'FAILED', 'CANCELLED'].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filterStatus === s
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s ? statusConfig(s).label : 'Tous'}
            </button>
          ))}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
            <AlertCircle className="h-5 w-5 inline mr-2" />
            {error}
            <button onClick={fetchEmails} className="ml-3 underline font-semibold">Réessayer</button>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Mail className="h-12 w-12 mb-3" />
            <p className="text-sm">Aucun email programmé</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm font-semibold underline"
              style={{ color: PRIMARY }}
            >
              Programmer le premier
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {emails.map((email) => {
              const cfg = statusConfig(email.status);
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={email.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ color: cfg.color, backgroundColor: cfg.bg }}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                        {email.category && (
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            {email.category}
                            {email.subcategory ? ` · ${email.subcategory}` : ''}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-slate-900 truncate">{email.subject}</h3>
                      <p className="text-sm text-slate-600 mt-0.5">
                        <strong>À :</strong> {email.to_email}
                        {email.to_name ? ` (${email.to_name})` : ''}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Programmé : {formatDate(email.scheduled_at)}
                        </span>
                        {email.sent_at && (
                          <span className="flex items-center gap-1">
                            <Send className="h-3 w-3" />
                            Envoyé : {formatDate(email.sent_at)}
                          </span>
                        )}
                        {email.error_message && (
                          <span className="text-rose-600">⚠ {email.error_message}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {email.status === 'PENDING' && (
                        <button
                          onClick={() => handleCancel(email.id)}
                          className="p-2 rounded-lg hover:bg-amber-50 text-amber-600 transition"
                          title="Annuler"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(email.id)}
                        className="p-2 rounded-lg hover:bg-rose-50 text-rose-500 transition"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal formulaire */}
        {showForm && (
          <ScheduledEmailForm
            onClose={() => setShowForm(false)}
            onSuccess={() => {
              setShowForm(false);
              fetchEmails();
            }}
          />
        )}
      </div>
    </ModuleContentArea>
  );
}

// ─── Formulaire de création ──────────────────────────────────────────────

function ScheduledEmailForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [toEmail, setToEmail] = useState('');
  const [toName, setToName] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [category, setCategory] = useState('RECRUTEMENT');
  const [replyToOverride, setReplyToOverride] = useState('');
  const [saving, setSaving] = useState(false);

  // Pré-remplir avec la date du lendemain à 8h00 par défaut
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    setScheduledDate(tomorrow.toISOString().split('T')[0]);
    setScheduledTime('08:00');
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const tenantId = getTenantId();
    if (!tenantId) {
      toast({ variant: 'error', title: 'Tenant ID non trouvé' });
      return;
    }

    if (!toEmail.trim() || !subject.trim() || !htmlBody.trim() || !scheduledDate || !scheduledTime) {
      toast({ variant: 'error', title: 'Tous les champs obligatoires doivent être remplis' });
      return;
    }

    // Combiner date + heure en ISO string
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();

    if (new Date(scheduledAt) <= new Date()) {
      toast({ variant: 'error', title: 'La date/heure doit être dans le futur' });
      return;
    }

    setSaving(true);
    try {
      await commFetch(`/communication/scheduled-emails?tenantId=${tenantId}`, {
        method: 'POST',
        body: {
          toEmail: toEmail.trim(),
          toName: toName.trim() || undefined,
          recipientType: 'EXTERNE',
          subject: subject.trim(),
          htmlBody: htmlBody,
          textBody: htmlBody.replace(/<[^>]*>/g, ''),
          category: category || undefined,
          module: category === 'RECRUTEMENT' ? 'hr' : category === 'FINANCE' ? 'finance' : 'communication',
          replyToOverride: replyToOverride.trim() || undefined,
          scheduledAt,
        },
      });
      toast({ variant: 'success', title: 'Email programmé avec succès !' });
      onSuccess();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Plus className="h-5 w-5" style={{ color: PRIMARY }} />
            Programmer un email
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <XCircle className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Destinataire */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email destinataire *
              </label>
              <input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                required
                placeholder="candidat@example.com"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom destinataire (optionnel)
              </label>
              <input
                type="text"
                value={toName}
                onChange={(e) => setToName(e.target.value)}
                placeholder="Aurore AKOVI"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10"
              />
            </div>
          </div>

          {/* Sujet */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Sujet *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder="📅 Rappel d'entretien demain à 10h"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10"
            />
          </div>

          {/* Contenu */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contenu (HTML autorisé) *
            </label>
            <textarea
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              required
              rows={6}
              placeholder="<p>Bonjour,</p><p>Votre entretien est programmé demain à 10h.</p>"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Vous pouvez utiliser des balises HTML : &lt;p&gt;, &lt;strong&gt;, &lt;a href="..."&gt;, etc.
            </p>
          </div>

          {/* Date + Heure */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Heure *</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10"
              />
            </div>
          </div>

          {/* Catégorie + Reply-to */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10"
              >
                <option value="RECRUTEMENT">Recrutement</option>
                <option value="PEDAGOGIE">Pédagogie</option>
                <option value="FINANCE">Finance</option>
                <option value="COMMUNICATION">Communication</option>
                <option value="SYSTEM">Système</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reply-to (optionnel)
              </label>
              <input
                type="email"
                value={replyToOverride}
                onChange={(e) => setReplyToOverride(e.target.value)}
                placeholder="recruteur@ecole.com"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Si vide, le destinataire répondra à noreply@academiahelm.com
              </p>
            </div>
          </div>

          {/* Info */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex gap-2">
            <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">💡 Bon à savoir</p>
              <p>
                L'email sera envoyé automatiquement à la date/heure prévue (à la minute près).
                Le destinataire verra <code>noreply@academiahelm.com</code> comme expéditeur,
                mais pourra répondre à l'adresse indiquée dans "Reply-to" si remplie.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition"
              style={{ backgroundColor: PRIMARY }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Programmer l'envoi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
