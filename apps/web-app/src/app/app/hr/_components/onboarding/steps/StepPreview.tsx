'use client';

import { useState, useEffect } from 'react';
import { Eye, Edit3, Save, Loader2, FileText, CheckCircle } from 'lucide-react';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1d4fa5] focus:ring-2 focus:ring-[#1d4fa5]/10 transition';

interface StepPreviewProps {
  contractId: string | null;
  tenantId: string;
  articlesSaved: boolean;
  onArticlesSaved: () => void;
  onPdfGenerated: () => void;
}

export function StepPreview({ contractId, tenantId, articlesSaved, onArticlesSaved, onPdfGenerated }: StepPreviewProps) {
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [articles, setArticles] = useState<Array<{ title: string; content: string }>>([]);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  // ⭐ Chargement initial : on charge l'aperçu ET les articles résolus par
  //    défaut (avec variables {{...}} remplacées par les vraies valeurs du
  //    contrat : staff, école, contrat). Cela permet à l'utilisateur de
  //    visualiser les articles directement à l'arrivée à l'étape 5, sans
  //    devoir cliquer "Éditer" pour les charger. S'il y a déjà des
  //    customArticles sauvegardés, on les charge à la place.
  useEffect(() => {
    if (!contractId) return;
    loadPreview();
    loadArticles(); // ⭐ chargement automatique au montage
  }, [contractId]);

  const loadPreview = async () => {
    if (!contractId) return;
    try {
      setLoading(true);
      const res = await hrFetch<any>(hrUrl(`contracts/${contractId}/preview`, { tenantId }));
      if (res.html) setPreviewHtml(res.html);
    } catch (err: any) {
      console.warn('Preview load failed:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  const loadArticles = async () => {
    if (!contractId) return;
    try {
      // ⭐ GET /api/hr/contracts/:id/articles retourne getResolvedArticles :
      //    - Si customArticles existe dans terms → on les charge (avec vars résolues)
      //    - Sinon → on charge les articles par défaut (avec vars résolues)
      //    Cela permet à l'utilisateur d'avoir directement des articles
      //    utilisables, sans devoir cliquer "Éditer" pour les initialiser.
      const res = await hrFetch<any>(hrUrl(`contracts/${contractId}/articles`, { tenantId }));
      if (res?.articles && Array.isArray(res.articles)) {
        setArticles(res.articles);
        // ⭐ Si les articles chargés sont déjà des customArticles (isCustom=true),
        //    on marque articlesSaved=true pour débloquer le bouton "Suivant".
        if (res.isCustom) {
          onArticlesSaved();
        }
      }
    } catch (err: any) {
      console.warn('Articles load failed:', err?.message);
    }
  };

  const handleSaveArticles = async () => {
    if (!contractId) return;
    if (articles.length === 0) {
      toast({ variant: 'error', title: 'Aucun article à sauvegarder' });
      return;
    }
    try {
      setSaving(true);
      await hrFetch(hrUrl(`contracts/${contractId}/articles`, { tenantId }), {
        method: 'PUT',
        body: { articles },
      });
      onArticlesSaved();
      toast({ variant: 'success', title: 'Articles sauvegardés' });
      // Reload preview with updated articles
      await loadPreview();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!contractId) return;
    try {
      setGenerating(true);
      await hrFetch(hrUrl(`contracts/${contractId}/generate-pdf`, { tenantId }), {
        method: 'POST',
      });
      onPdfGenerated();
      toast({ variant: 'success', title: 'PDF généré avec succès' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur de génération PDF', description: err?.message });
    } finally {
      setGenerating(false);
    }
  };

  const switchToEdit = async () => {
    setMode('edit');
    // Les articles sont déjà chargés par loadArticles au montage — pas
    // besoin de recharger.
  };

  const switchToPreview = () => {
    setMode('preview');
    loadPreview();
  };

  if (!contractId) {
    return (
      <div className="p-8 text-center text-slate-400">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Le contrat doit d&apos;abord être créé pour accéder à l&apos;aperçu</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">Aperçu &amp; Édition du Contrat</h4>
            <p className="text-[11px] text-slate-400">Vérifiez et modifiez les articles avant signature</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={switchToPreview}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${mode === 'preview' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Eye className="h-3.5 w-3.5" /> Aperçu
          </button>
          <button
            type="button"
            onClick={switchToEdit}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${mode === 'edit' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Edit3 className="h-3.5 w-3.5" /> Éditer
          </button>
        </div>
      </div>

      {mode === 'preview' && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
              <p className="text-xs text-slate-400 mt-2">Chargement de l&apos;aperçu...</p>
            </div>
          ) : (
            <iframe
              srcDoc={previewHtml}
              className="w-full border-0"
              style={{ height: '450px' }}
              title="Aperçu du contrat"
            />
          )}
        </div>
      )}

      {mode === 'edit' && (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {articles.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Chargement des articles par défaut...</p>
          ) : (
            articles.map((article, idx) => (
              <div key={idx} className="p-3 border border-slate-200 rounded-xl bg-white space-y-2">
                <input
                  type="text"
                  className={inputClass + ' font-bold text-xs'}
                  value={article.title}
                  onChange={(e) => {
                    const updated = [...articles];
                    updated[idx] = { ...updated[idx], title: e.target.value };
                    setArticles(updated);
                  }}
                />
                <textarea
                  className={inputClass + ' min-h-[60px] text-xs'}
                  value={article.content}
                  onChange={(e) => {
                    const updated = [...articles];
                    updated[idx] = { ...updated[idx], content: e.target.value };
                    setArticles(updated);
                  }}
                />
              </div>
            ))
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSaveArticles}
              disabled={saving || articles.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1d4fa5] text-white rounded-xl text-xs font-bold disabled:opacity-50 transition hover:opacity-90"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Sauvegarder les articles
            </button>
          </div>
        </div>
      )}

      {/* ⭐ Auto-validation : si les articles par défaut sont chargés
          et qu'ils sont acceptables tels quels, l'utilisateur peut
          valider sans modifier en cliquant "Utiliser les articles par défaut
          et continuer". Cela débloque l'étape 5 sans obliger à éditer. */}
      {!articlesSaved && articles.length > 0 && (
        <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between gap-3">
          <p className="text-xs text-blue-700 flex-1">
            <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
            Les articles par défaut sont chargés. Vous pouvez les modifier (onglet Éditer) ou les valider tels quels pour continuer.
          </p>
          <button
            type="button"
            onClick={handleSaveArticles}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1d4fa5] text-white rounded-lg text-xs font-bold disabled:opacity-50 transition hover:opacity-90 shrink-0"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
            Valider les articles et continuer
          </button>
        </div>
      )}

      {/* PDF Generation */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          {articlesSaved && <CheckCircle className="h-4 w-4 text-emerald-500" />}
          <span className="text-xs font-semibold text-slate-600">
            {articlesSaved ? 'Articles sauvegardés — Prêt pour la génération PDF' : 'Sauvegardez les articles avant de générer le PDF'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleGeneratePdf}
          disabled={generating || !articlesSaved}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0b2f73] text-white rounded-lg text-xs font-bold disabled:opacity-50 transition hover:opacity-90"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          Générer PDF
        </button>
      </div>
    </div>
  );
}

