"use client";

/**
 * Workspace de gestion des prospects SaisieMaster — back-office admin.
 *
 * Fonctionnalités :
 *  - Liste de tous les prospects (nom, email, téléphone, ville, école, stats)
 *  - Recherche par nom/école/ville
 *  - Filtres par statut (LEAD, CONTACTED, CONVERTED, LOST)
 *  - Boutons de contact direct : Email + WhatsApp
 *  - Bibliothèque de templates professionnels (présentation, modules, démo,
 *    closing, follow-up)
 *  - Prévisualisation du message avec variables remplacées
 *  - Ouverture directe du client email ou WhatsApp avec message pré-rempli
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Mail,
  MessageCircle,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  Star,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  CONTACT_TEMPLATES,
  fillTemplate,
  buildWhatsAppUrl,
  buildMailtoUrl,
  type ContactTemplate,
  type TemplateCategory,
} from "./contact-templates";

interface Prospect {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  schoolName: string;
  phoneNumber: string | null;
  city: string | null;
  status: string;
  signupDate: string;
  lastLoginAt: string | null;
  loginCount: number;
  classesCreated: number;
  gradesEntered: number;
  exportsCount: number;
  sessionsCount: number;
  lastSessionAt: string | null;
}

type StatusFilter = 'all' | 'LEAD' | 'CONTACTED' | 'CONVERTED' | 'LOST';

const STATUS_LABELS: Record<string, string> = {
  LEAD: 'Nouveau',
  CONTACTED: 'Contacté',
  CONVERTED: 'Converti',
  LOST: 'Perdu',
};

const STATUS_COLORS: Record<string, string> = {
  LEAD: 'bg-[#0D6EFD]/15 text-[#0D6EFD]',
  CONTACTED: 'bg-[#FD7E14]/15 text-[#FD7E14]',
  CONVERTED: 'bg-[#198754]/15 text-[#198754]',
  LOST: 'bg-[#DC3545]/15 text-[#DC3545]',
};

export default function SaisieMasterProspectsWorkspace() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [adminName, setAdminName] = useState('Sènakpon AKPOVI');

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/platform/saisiemaster/prospects', {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setProspects(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
      setProspects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProspects();
  }, [fetchProspects]);

  // Filtrage local
  const filteredProspects = useMemo(() => {
    let result = prospects;
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.schoolName.toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q) ||
        (p.phoneNumber || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [prospects, statusFilter, search]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: prospects.length,
      leads: prospects.filter((p) => p.status === 'LEAD').length,
      contacted: prospects.filter((p) => p.status === 'CONTACTED').length,
      converted: prospects.filter((p) => p.status === 'CONVERTED').length,
      activeThisWeek: prospects.filter((p) => {
        if (!p.lastLoginAt) return false;
        const days = (Date.now() - new Date(p.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24);
        return days < 7;
      }).length,
    };
  }, [prospects]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-[#008751]" />
            Prospects SaisieMaster
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Liste des directeurs inscrits sur SaisieMaster avec relances email et WhatsApp
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchProspects()}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
        </Card>
        <Card className="p-4 border-[#0D6EFD]/30 bg-[#0D6EFD]/5">
          <p className="text-xs text-[#0D6EFD] uppercase tracking-wider">Nouveaux</p>
          <p className="text-2xl font-bold text-[#0D6EFD] mt-1">{stats.leads}</p>
        </Card>
        <Card className="p-4 border-[#FD7E14]/30 bg-[#FD7E14]/5">
          <p className="text-xs text-[#FD7E14] uppercase tracking-wider">Contactés</p>
          <p className="text-2xl font-bold text-[#FD7E14] mt-1">{stats.contacted}</p>
        </Card>
        <Card className="p-4 border-[#198754]/30 bg-[#198754]/5">
          <p className="text-xs text-[#198754] uppercase tracking-wider">Convertis</p>
          <p className="text-2xl font-bold text-[#198754] mt-1">{stats.converted}</p>
        </Card>
        <Card className="p-4 border-[#FCD116]/30 bg-[#FCD116]/5 col-span-2 md:col-span-1">
          <p className="text-xs text-[#b35a00] uppercase tracking-wider">Actifs 7j</p>
          <p className="text-2xl font-bold text-[#b35a00] mt-1">{stats.activeThisWeek}</p>
        </Card>
      </div>

      {/* Filtres + recherche */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, école, ville, email, téléphone..."
            className="w-full h-10 pl-10 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/40"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(['all', 'LEAD', 'CONTACTED', 'CONVERTED', 'LOST'] as StatusFilter[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'Tous' : STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="p-4 border-[#DC3545]/30 bg-[#DC3545]/5">
          <div className="flex items-start gap-2 text-sm text-[#DC3545]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Erreur de chargement</p>
              <p className="text-xs mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading */}
      {loading && prospects.length === 0 ? (
        <Card className="p-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Chargement des prospects…</p>
        </Card>
      ) : filteredProspects.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="mt-3 font-medium text-foreground">Aucun prospect</p>
          <p className="text-sm text-muted-foreground mt-1">
            Les prospects SaisieMaster apparaîtront ici dès qu'ils s'inscriront.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredProspects.map((p) => (
            <ProspectRow
              key={p.id}
              prospect={p}
              adminName={adminName}
              onSelect={() => setSelectedProspect(p)}
            />
          ))}
        </div>
      )}

      {/* Modal de contact (templates) */}
      {selectedProspect && (
        <ContactModal
          prospect={selectedProspect}
          adminName={adminName}
          onClose={() => setSelectedProspect(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Ligne prospect
// ============================================================================

function ProspectRow({
  prospect,
  adminName,
  onSelect,
}: {
  prospect: Prospect;
  adminName: string;
  onSelect: () => void;
}) {
  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return '—';
    return phone;
  };

  // Nettoie le numéro pour WhatsApp (international sans + ni espaces)
  const cleanPhone = (phone: string | null) => {
    if (!phone) return '';
    return phone.replace(/[^\d]/g, '');
  };

  const hasPhone = !!prospect.phoneNumber && cleanPhone(prospect.phoneNumber).length >= 8;

  return (
    <Card className="p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Avatar + nom + école */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="grid place-items-center h-10 w-10 rounded-full bg-gradient-to-br from-[#008751]/15 to-[#FCD116]/15 text-[#0D6EFD] text-sm font-bold shrink-0">
            {(prospect.firstName[0] || '?')}{(prospect.lastName[0] || '')}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-foreground truncate">
                {prospect.firstName} {prospect.lastName}
              </p>
              <span
                className={
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ' +
                  (STATUS_COLORS[prospect.status] || 'bg-muted text-muted-foreground')
                }
              >
                {STATUS_LABELS[prospect.status] || prospect.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {prospect.schoolName}
              {prospect.city ? ` · ${prospect.city}` : ''}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Inscrit le {formatDate(prospect.signupDate)}
              {prospect.lastLoginAt && ` · Dernier login ${formatDate(prospect.lastLoginAt)}`}
            </p>
          </div>
        </div>

        {/* Stats compactes */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1" title="Classes créées">
            <TrendingUp className="h-3.5 w-3.5 text-[#0D6EFD]" />
            {prospect.classesCreated}
          </span>
          <span className="inline-flex items-center gap-1" title="Notes saisies">
            <Star className="h-3.5 w-3.5 text-[#FCD116]" />
            {prospect.gradesEntered}
          </span>
          <span className="inline-flex items-center gap-1" title="Exports">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#198754]" />
            {prospect.exportsCount}
          </span>
          <span className="inline-flex items-center gap-1" title="Sessions">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {prospect.sessionsCount}
          </span>
        </div>

        {/* Coordonnées */}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground lg:w-56 shrink-0">
          <span className="inline-flex items-center gap-1.5 truncate">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate" title={prospect.email}>{prospect.email}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 truncate">
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[#198754]" />
            <span className="truncate" title={formatPhone(prospect.phoneNumber)}>
              {formatPhone(prospect.phoneNumber)}
            </span>
          </span>
        </div>

        {/* Actions directes */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              window.location.href = `mailto:${prospect.email}`;
            }}
            className="gap-1.5 text-xs"
          >
            <Mail className="h-3.5 w-3.5" />
            Email
          </Button>
          {hasPhone ? (
            <Button
              size="sm"
              onClick={() => {
                const url = buildWhatsAppUrl(prospect.phoneNumber!, '');
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              className="gap-1.5 text-xs bg-[#198754] hover:bg-[#198754]/90 text-white"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </Button>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">Pas de téléphone</span>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={onSelect}
            className="gap-1.5 text-xs bg-[#0D1F6E] hover:bg-[#0D1F6E]/90 text-white"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Templates
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// Modal de templates
// ============================================================================

function ContactModal({
  prospect,
  adminName: initialAdminName,
  onClose,
}: {
  prospect: Prospect;
  adminName: string;
  onClose: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<ContactTemplate | null>(null);
  const [adminName, setAdminName] = useState(initialAdminName);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') return CONTACT_TEMPLATES;
    return CONTACT_TEMPLATES.filter((t) => t.category === selectedCategory);
  }, [selectedCategory]);

  const vars = {
    firstName: prospect.firstName,
    schoolName: prospect.schoolName,
    city: prospect.city || '',
    adminName,
  };

  const filledBody = selectedTemplate ? fillTemplate(selectedTemplate.body, vars) : '';
  const filledSubject = selectedTemplate?.subject
    ? fillTemplate(selectedTemplate.subject, vars)
    : '';

  const handleSendWhatsApp = () => {
    if (!selectedTemplate || !prospect.phoneNumber) return;
    const url = buildWhatsAppUrl(prospect.phoneNumber, filledBody);
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.success('WhatsApp ouvert avec le message pré-rempli');
  };

  const handleSendEmail = () => {
    if (!selectedTemplate) return;
    const url = buildMailtoUrl(prospect.email, filledSubject, filledBody);
    window.location.href = url;
    toast.success('Client email ouvert avec le message pré-rempli');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(filledBody);
      toast.success('Message copié dans le presse-papier');
    } catch {
      toast.error('Échec de la copie');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border bg-gradient-to-r from-[#0D1F6E] to-[#1A3A8F] text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Contacter {prospect.firstName} {prospect.lastName}
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                {prospect.schoolName} · {prospect.city || '—'} · {prospect.email} · {prospect.phoneNumber || 'Pas de téléphone'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10"
              aria-label="Fermer"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 grid md:grid-cols-2 gap-5">
          {/* Colonne gauche : liste des templates */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Catégorie
              </label>
              <div className="flex flex-wrap gap-1 mt-2">
                {(['all', 'presentation', 'modules', 'demo', 'closing', 'followup'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedCategory(c)}
                    className={
                      'px-2.5 py-1 rounded text-xs font-medium transition-colors ' +
                      (selectedCategory === c
                        ? 'bg-[#0D6EFD] text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70')
                    }
                  >
                    {c === 'all' && 'Tous'}
                    {c === 'presentation' && 'Présentation'}
                    {c === 'modules' && 'Modules'}
                    {c === 'demo' && 'Démo'}
                    {c === 'closing' && 'Closing'}
                    {c === 'followup' && 'Relance'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {filteredTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  className={
                    'w-full text-left p-3 rounded-md border transition-colors ' +
                    (selectedTemplate?.id === t.id
                      ? 'border-[#0D6EFD] bg-[#0D6EFD]/5'
                      : 'border-border hover:bg-muted/50')
                  }
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <span
                      className={
                        'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold ' +
                        (t.channel === 'whatsapp'
                          ? 'bg-[#198754]/15 text-[#198754]'
                          : t.channel === 'email'
                            ? 'bg-[#0D6EFD]/15 text-[#0D6EFD]'
                            : 'bg-[#FCD116]/15 text-[#b35a00]')
                      }
                    >
                      {t.channel === 'whatsapp' && 'WhatsApp'}
                      {t.channel === 'email' && 'Email'}
                      {t.channel === 'both' && 'Email+WA'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {t.body.slice(0, 100)}…
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Colonne droite : prévisualisation */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Prévisualisation
            </label>
            {selectedTemplate ? (
              <>
                {filledSubject && (
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Sujet</p>
                    <p className="text-sm font-medium text-foreground">{filledSubject}</p>
                  </div>
                )}
                <div className="rounded-md border border-border bg-background p-3 max-h-[40vh] overflow-y-auto">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Message</p>
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">
                    {filledBody}
                  </pre>
                </div>

                <div className="flex flex-wrap gap-2">
                  {prospect.phoneNumber && (
                    <Button
                      onClick={handleSendWhatsApp}
                      className="gap-1.5 bg-[#198754] hover:bg-[#198754]/90 text-white"
                      size="sm"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Ouvrir WhatsApp
                    </Button>
                  )}
                  <Button
                    onClick={handleSendEmail}
                    className="gap-1.5 bg-[#0D6EFD] hover:bg-[#0D6EFD]/90 text-white"
                    size="sm"
                  >
                    <Mail className="h-4 w-4" />
                    Ouvrir Email
                  </Button>
                  <Button
                    onClick={handleCopy}
                    variant="outline"
                    size="sm"
                  >
                    Copier
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed border-border p-8 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">
                  Sélectionnez un template pour voir la prévisualisation
                </p>
              </div>
            )}

            {/* Édition nom admin */}
            <div className="rounded-md border border-border p-3 bg-muted/20">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                Votre nom (apparaît dans les messages)
              </label>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="mt-1.5 w-full h-9 px-3 rounded border border-border bg-background text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
