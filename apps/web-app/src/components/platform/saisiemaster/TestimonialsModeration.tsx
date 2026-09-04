"use client";

/**
 * Modération des témoignages SaisieMaster — Back-office admin.
 *
 * Affiche tous les témoignages (en attente + publiés) avec actions :
 *  - Publier / Dépublier
 *  - Mettre en avant / Retirer mise en avant
 *  - Supprimer
 *
 * Les requêtes passent par le proxy Next.js /api/platform/* qui vérifie
 * le cookie admin (academia_admin_session) avant de forwarder.
 */

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Star,
  CheckCircle2,
  XCircle,
  Trash2,
  Sparkles,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Testimonial {
  id: string;
  prospectId: string | null;
  authorName: string;
  authorRole: string;
  schoolName: string;
  city: string | null;
  rating: number;
  content: string;
  isPublished: boolean;
  isFeatured: boolean;
  createdAt: string;
  publishedAt: string | null;
}

type Filter = 'all' | 'pending' | 'published';

export default function SaisieMasterTestimonialsModeration() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTestimonials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter === 'pending') params.set('onlyPending', 'true');
      if (filter === 'published') params.set('onlyPublished', 'true');

      const res = await fetch(
        `/api/platform/saisiemaster/testimonials?${params.toString()}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setTestimonials(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
      setTestimonials([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchTestimonials();
  }, [fetchTestimonials]);

  const handleAction = async (
    id: string,
    action: 'publish' | 'unpublish' | 'feature' | 'unfeature' | 'delete',
  ) => {
    setActionLoading(`${id}-${action}`);
    try {
      let res: Response;
      if (action === 'delete') {
        res = await fetch(
          `/api/platform/saisiemaster/testimonials/${encodeURIComponent(id)}`,
          { method: 'DELETE', credentials: 'include' },
        );
      } else {
        res = await fetch(
          `/api/platform/saisiemaster/testimonials/${encodeURIComponent(id)}/${action}`,
          { method: 'POST', credentials: 'include' },
        );
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }

      toast.success(`Action "${action}" effectuée`);
      // Refresh list
      await fetchTestimonials();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Échec de l\'action');
    } finally {
      setActionLoading(null);
    }
  };

  // Stats
  const pendingCount = testimonials.filter((t) => !t.isPublished).length;
  const publishedCount = testimonials.filter((t) => t.isPublished).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[#008751]" />
            Témoignages SaisieMaster
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Modération des avis déposés par les utilisateurs SaisieMaster
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchTestimonials()}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {testimonials.length}
          </p>
        </Card>
        <Card className="p-4 border-[#FD7E14]/30 bg-[#FD7E14]/5">
          <p className="text-xs text-[#FD7E14] uppercase tracking-wider">En attente</p>
          <p className="text-2xl font-bold text-[#FD7E14] mt-1">
            {pendingCount}
          </p>
        </Card>
        <Card className="p-4 border-[#198754]/30 bg-[#198754]/5 col-span-2 sm:col-span-1">
          <p className="text-xs text-[#198754] uppercase tracking-wider">Publiés</p>
          <p className="text-2xl font-bold text-[#198754] mt-1">
            {publishedCount}
          </p>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'pending', 'published'] as Filter[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
          >
            {f === 'all' && 'Tous'}
            {f === 'pending' && 'En attente'}
            {f === 'published' && 'Publiés'}
          </Button>
        ))}
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
      {loading && testimonials.length === 0 ? (
        <Card className="p-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>
        </Card>
      ) : testimonials.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="mt-3 font-medium text-foreground">Aucun témoignage</p>
          <p className="text-sm text-muted-foreground mt-1">
            Les témoignages déposés par les utilisateurs SaisieMaster apparaîtront ici.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {testimonials.map((t) => (
            <TestimonialCard
              key={t.id}
              testimonial={t}
              actionLoading={actionLoading}
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Carte témoignage
// ============================================================================

function TestimonialCard({
  testimonial,
  actionLoading,
  onAction,
}: {
  testimonial: Testimonial;
  actionLoading: string | null;
  onAction: (
    id: string,
    action: 'publish' | 'unpublish' | 'feature' | 'unfeature' | 'delete',
  ) => void;
}) {
  const dateFmt = new Date(testimonial.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isActing = (action: string) =>
    actionLoading === `${testimonial.id}-${action}`;

  return (
    <Card className="p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Colonne gauche : contenu */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header : auteur + note + statut */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold text-foreground">
                {testimonial.authorName}
                {testimonial.isFeatured && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-bold text-[#FCD116] bg-[#FCD116]/10 px-1.5 py-0.5 rounded">
                    <Sparkles className="h-3 w-3" />
                    À LA UNE
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {testimonial.authorRole} · {testimonial.schoolName}
                {testimonial.city ? ` · ${testimonial.city}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={
                      s <= testimonial.rating
                        ? 'h-4 w-4 fill-[#FCD116] text-[#FCD116]'
                        : 'h-4 w-4 text-muted-foreground/30'
                    }
                  />
                ))}
              </div>
              <span
                className={
                  'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ' +
                  (testimonial.isPublished
                    ? 'bg-[#198754]/15 text-[#198754]'
                    : 'bg-[#FD7E14]/15 text-[#FD7E14]')
                }
              >
                {testimonial.isPublished ? 'PUBLIÉ' : 'EN ATTENTE'}
              </span>
            </div>
          </div>

          {/* Contenu du témoignage */}
          <blockquote className="text-sm text-foreground/90 leading-relaxed border-l-2 border-[#FCD116] pl-3 italic">
            {testimonial.content}
          </blockquote>

          {/* Métadonnées */}
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Créé le {dateFmt}
            {testimonial.publishedAt
              ? ` · Publié le ${new Date(testimonial.publishedAt).toLocaleDateString('fr-FR')}`
              : ''}
          </p>
        </div>

        {/* Colonne droite : actions */}
        <div className="flex flex-row lg:flex-col gap-2 shrink-0 lg:w-44">
          {testimonial.isPublished ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(testimonial.id, 'unpublish')}
              disabled={!!actionLoading}
              className="gap-1.5 text-xs flex-1 lg:flex-none"
            >
              {isActing('unpublish') ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              Dépublier
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onAction(testimonial.id, 'publish')}
              disabled={!!actionLoading}
              className="gap-1.5 text-xs flex-1 lg:flex-none bg-[#198754] hover:bg-[#198754]/90 text-white"
            >
              {isActing('publish') ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Publier
            </Button>
          )}

          {testimonial.isFeatured ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(testimonial.id, 'unfeature')}
              disabled={!!actionLoading}
              className="gap-1.5 text-xs flex-1 lg:flex-none"
            >
              {isActing('unfeature') ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Retirer une
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(testimonial.id, 'feature')}
              disabled={!!actionLoading}
              className="gap-1.5 text-xs flex-1 lg:flex-none border-[#FCD116]/40 text-[#b35a00] hover:bg-[#FCD116]/10"
            >
              {isActing('feature') ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              À la une
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm('Supprimer définitivement ce témoignage ?')) {
                onAction(testimonial.id, 'delete');
              }
            }}
            disabled={!!actionLoading}
            className="gap-1.5 text-xs flex-1 lg:flex-none text-[#DC3545] hover:bg-[#DC3545]/5"
          >
            {isActing('delete') ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Supprimer
          </Button>
        </div>
      </div>
    </Card>
  );
}
