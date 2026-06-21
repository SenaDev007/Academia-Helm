'use client';

import { useState, useEffect, useCallback, memo, useRef } from 'react';
import {
  Pencil, Loader2, Plus, Trash2, ChevronUp, ChevronDown,
  Eye, FileText, Save, AlertCircle, ArrowLeft,
} from 'lucide-react';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { useModuleContext } from '@/hooks/useModuleContext';
import { toast } from '@/components/ui/toast';
import { motion } from 'framer-motion';

const PRIMARY = '#1A2BA6';

/**
 * RichTextContent — uncontrolled contentEditable wrapper.
 *
 * Why uncontrolled? Because re-setting `dangerouslySetInnerHTML` on every
 * keystroke (after the parent state updates) causes the caret to jump to the
 * start of the editor. Instead, we set the innerHTML imperatively only when
 * the `initialContent` prop actually differs from what's already in the DOM
 * (i.e. on initial load or when fresh articles are fetched). Typing is
 * handled natively by the browser; we just propagate the resulting HTML
 * upward via `onInput`.
 */
interface RichTextContentProps {
  initialContent: string;
  onInput: (html: string) => void;
}

const RichTextContent = memo(function RichTextContent({ initialContent, onInput }: RichTextContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== initialContent) {
      el.innerHTML = initialContent || '';
    }
  }, [initialContent]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onInput(e.currentTarget.innerHTML)}
      className="px-3 py-2 text-sm text-slate-700 focus:outline-none min-h-[80px] prose prose-sm max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:cursor-text"
      data-placeholder="Contenu de l'article (utilisez la barre d'outils pour le formatage)"
    />
  );
}, (prev, next) => prev.initialContent === next.initialContent);

interface Article {
  title: string;
  content: string;
}

interface ContractDocumentEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contract: any;
}

export function ContractDocumentEditor({ isOpen, onClose, onSuccess, contract }: ContractDocumentEditorProps) {
  const { tenant } = useModuleContext();
  const [articles, setArticles] = useState<Article[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch articles from the backend (single source of truth)
  const fetchArticles = useCallback(async () => {
    if (!contract?.id || !tenant?.id) return;
    setLoading(true);
    try {
      // Step 1: Try custom articles from contract terms (saved by user)
      const contractData: any = await hrFetch(hrUrl(`contracts/${contract.id}`, { tenantId: tenant.id }));
      const customArticles = contractData?.terms?.customArticles;

      if (Array.isArray(customArticles) && customArticles.length > 0) {
        setArticles(customArticles);
        setHasChanges(false);
        return;
      }

      // Step 2: Try articles from linked template
      if (contractData?.templateId) {
        try {
          const templates: any[] = await hrFetch(hrUrl('contracts/templates/list', { tenantId: tenant.id }));
          const linkedTemplate = templates?.find((t: any) => t.id === contractData.templateId);
          if (linkedTemplate?.template) {
            try {
              const parsed = JSON.parse(linkedTemplate.template);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setArticles(parsed);
                setHasChanges(false);
                return;
              }
            } catch { /* not JSON, ignore */ }
          }
        } catch { /* ignore template fetch error */ }
      }

      // Step 3: Fetch default articles from backend API
      try {
        const defaultData: any = await hrFetch(hrUrl(`contracts/templates/default/${contract.contractType}`, { tenantId: tenant.id }));
        if (defaultData?.template) {
          const parsed = JSON.parse(defaultData.template);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setArticles(parsed);
            setHasChanges(false);
            return;
          }
        }
      } catch { /* ignore default fetch error */ }

      // Step 4: Fallback — use preview to extract articles
      const data: any = await hrFetch(hrUrl(`contracts/${contract.id}/preview`, { tenantId: tenant.id }));
      if (data?.html) {
        setPreviewHtml(data.html);
      }
      if (data?.templateVars) {
        const isCDI = contract.contractType === 'CDI';
        const isStage = contract.contractType === 'STAGE';
        const isConsultant = contract.contractType === 'CONSULTANT';
        const tv = data.templateVars;

        setArticles([
          { title: "Article 1 — Objet du contrat", content: `Le présent contrat a pour objet l'engagement du Salarié en qualité de <strong>{{staffPosition}}</strong> au sein de l'établissement <strong>{{schoolName}}</strong>. Le Salarié exercera ses fonctions sous l'autorité de la Direction de l'établissement scolaire.` },
          { title: "Article 2 — Date d'effet", content: `Le présent contrat prend effet à compter du <strong>{{startDate}}</strong>.` },
          { title: "Article 3 — Type de contrat", content: isCDI ? `Le présent contrat est un <strong>Contrat à Durée Indéterminée (CDI)</strong>.` : isConsultant ? `Le présent contrat est un <strong>Contrat de Consultation</strong> pour la période du <strong>{{startDate}}</strong> au <strong>{{endDate}}</strong>.` : `Le présent contrat est conclu pour la période du <strong>{{startDate}}</strong> au <strong>{{endDate}}</strong>.` },
          { title: "Article 4 — Période d'essai", content: `Le présent contrat est assorti d'une période d'essai de <strong>{{probationDuration}}</strong>. Durant cette période, chacune des parties pourra mettre fin au contrat conformément aux dispositions légales en vigueur.` },
          { title: "Article 5 — Missions et responsabilités", content: `Le Salarié s'engage à accomplir notamment les missions suivantes : <strong>{{jobResponsibilities}}</strong>. Cette liste n'est pas exhaustive et peut être adaptée en fonction des besoins de l'établissement.` },
          { title: "Article 6 — Lieu de travail", content: `Le Salarié exercera principalement ses fonctions à : <strong>{{workLocation}}</strong>. Toute affectation dans un autre lieu de travail pourra être décidée par l'Employeur, après consultation du Salarié, dans l'intérêt du service.` },
          { title: "Article 7 — Durée du travail", content: `La durée hebdomadaire de travail est fixée à <strong>{{weeklyHours}} heures</strong>. Les horaires de travail sont : {{workSchedule}}. Toute modification des horaires sera portée à la connaissance du Salarié dans un délai raisonnable.` },
          { title: "Article 8 — Rémunération", content: isStage ? `Le stagiaire percevra une gratification mensuelle nette de <strong>{{baseSalary}} {{currency}}</strong>, payée par <strong>{{paymentMode}}</strong>.` : `En contrepartie de son travail, le Salarié percevra une rémunération composée comme suit :<br>- Salaire de base : <strong>{{baseSalary}} {{currency}}</strong><br>- Prime de fonction : <strong>{{functionBonus}} {{currency}}</strong><br>- Indemnité de transport : <strong>{{transportBonus}} {{currency}}</strong><br>- Autres avantages : <strong>{{otherBenefits}}</strong><br><br>Soit un salaire brut mensuel de <strong>{{grossSalary}} {{currency}}</strong>, versé mensuellement par <strong>{{paymentMode}}</strong>.` },
          { title: "Article 9 — Congés", content: `Le Salarié bénéficiera des congés conformément à la législation du travail en vigueur dans le pays ({{country}}). Les périodes de congé seront fixées d'un commun accord entre l'Employeur et le Salarié, dans le respect du fonctionnement de l'établissement scolaire et du calendrier académique.` },
          { title: "Article 10 — Obligation de confidentialité", content: `Le Salarié s'engage à préserver la confidentialité de toutes les informations dont il aurait connaissance dans l'exercice de ses fonctions, notamment les données relatives aux élèves, aux familles, à la gestion financière et administrative de l'établissement. Cette obligation perdure après la fin du contrat.` },
          { title: "Article 11 — Protection des données", content: `Conformément à la législation en matière de protection des données personnelles, le Salarié est informé que ses données personnelles sont traitées dans le cadre de la gestion de la relation de travail. Il dispose d'un droit d'accès, de rectification et de suppression de ses données.` },
          { title: "Article 12 — Discipline et règlement intérieur", content: `Le Salarié s'engage à respecter le règlement intérieur de l'établissement, qui lui a été communiqué et dont il accuse réception. Toute infraction pourra faire l'objet de sanctions disciplinaires conformément aux dispositions légales en vigueur.` },
          { title: "Article 13 — Absences", content: `Toute absence doit être justifiée et préalablement autorisée par l'Employeur, sauf en cas de force majeure. Les absences injustifiées pourront entraîner une retenue sur salaire et, le cas échéant, des sanctions disciplinaires.` },
          { title: "Article 14 — Résiliation du contrat", content: isCDI ? `Le présent contrat pourra être résilié par chacune des parties, moyennant un préavis de un (1) mois. En cas de faute grave, le contrat pourra être rompu sans préavis ni indemnités. La démission devra être notifiée par écrit.` : `Le présent contrat prend fin à l'échéance du terme fixé, sans qu'il soit besoin de notification. Il pourra toutefois être résilié avant terme en cas de faute grave ou de force majeure.` },
          { title: "Article 15 — Droit applicable", content: `Le présent contrat est soumis au droit du travail applicable en <strong>{{country}}</strong>. Toute clause non prévue expressément sera régie par les dispositions légales et conventionnelles en vigueur.` },
          { title: "Article 16 — Dispositions finales", content: `Le présent contrat est établi en deux (2) exemplaires originaux, dont un remis à chaque partie. Les modifications apportées au présent contrat feront l'objet d'un avenant écrit. Fait à <strong>{{city}}</strong>, le <strong>{{signatureDate}}</strong>.` },
        ]);
      }
      setHasChanges(false);
    } catch (err) {
      console.error('Error fetching articles:', err);
      toast({ variant: 'error', title: 'Erreur lors du chargement des articles.' });
    } finally {
      setLoading(false);
    }
  }, [contract?.id, tenant?.id, contract?.contractType]);

  useEffect(() => {
    if (isOpen && contract?.id) {
      fetchArticles();
    }
  }, [isOpen, contract?.id, fetchArticles]);

  if (!isOpen) return null;
  const isSigned = !!contract?.signedAt;
  if (isSigned) return null;

  function updateArticle(index: number, field: 'title' | 'content', value: string) {
    setArticles((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setHasChanges(true);
  }

  function addArticle() {
    const nextNum = articles.length + 1;
    setArticles((prev) => [...prev, { title: `Article ${nextNum} — `, content: '' }]);
    setHasChanges(true);
  }

  function removeArticle(index: number) {
    if (!confirm(`Supprimer "${articles[index].title}" ?`)) return;
    setArticles((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  }

  function moveArticle(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= articles.length) return;
    setArticles((prev) => {
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated;
    });
    setHasChanges(true);
  }

  async function handleSave(closeAfter = false) {
    if (articles.length === 0) {
      toast({ variant: 'error', title: 'Au moins un article est requis.' });
      return;
    }
    for (const art of articles) {
      if (!art.title.trim()) {
        toast({ variant: 'error', title: 'Chaque article doit avoir un titre.' });
        return;
      }
    }
    try {
      setSaving(true);
      await hrFetch(hrUrl(`contracts/${contract.id}/articles`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: { articles },
      });
      toast({ variant: 'success', title: `${articles.length} articles sauvegardés avec succès !` });
      setHasChanges(false);
      onSuccess();
      if (closeAfter) onClose();
    } catch (err) {
      console.error(err);
      toast({ variant: 'error', title: 'Erreur lors de la sauvegarde des articles.' });
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    // Save first, then fetch preview
    if (hasChanges) {
      await handleSave(false);
    }
    try {
      const data: any = await hrFetch(hrUrl(`contracts/${contract.id}/preview`, { tenantId: tenant.id }));
      if (data?.html) {
        setPreviewHtml(data.html);
      }
      setActiveTab('preview');
    } catch (err) {
      toast({ variant: 'error', title: 'Erreur lors de la prévisualisation.' });
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-slate-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#1A2BA6] transition">
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="rounded-lg p-1.5" style={{ backgroundColor: `${PRIMARY}15` }}>
              <FileText className="h-4 w-4" style={{ color: PRIMARY }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Éditeur de contrat</h2>
              <p className="text-[10px] text-slate-500">
                {contract?.staff?.firstName} {contract?.staff?.lastName} — {contract?.contractType}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Modifications non sauvegardées
            </span>
          )}
          <button
            onClick={handlePreview}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition"
          >
            <Eye className="h-3.5 w-3.5" /> Aperçu
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !hasChanges}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition"
            style={{ backgroundColor: PRIMARY }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Sauvegarder
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Sauvegarder & Fermer
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-5 py-2 bg-white border-b border-slate-100 shrink-0">
        <button
          onClick={() => setActiveTab('edit')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
            activeTab === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Pencil className="h-3 w-3" /> Édition ({articles.length} articles)
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
            activeTab === 'preview' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Eye className="h-3 w-3" /> Aperçu
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : activeTab === 'edit' ? (
          <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
            {/* Info banner */}
            <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-800 flex gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p>
                Modifiez librement le titre et le contenu de chaque article.
                Utilisez la barre d'outils (<strong className="font-bold">B</strong>, <em className="italic">I</em>, <u>U</u>, listes) au-dessus
                de chaque article pour mettre en forme le texte — le HTML est préservé automatiquement.
                Après signature, toute modification nécessitera un avenant.
              </p>
            </div>

            {/* Articles list */}
            {articles.map((art, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Article {idx + 1}</span>
                  <div className="flex-1" />
                  <button
                    onClick={() => moveArticle(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 transition"
                    title="Monter"
                  >
                    <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                  <button
                    onClick={() => moveArticle(idx, 'down')}
                    disabled={idx === articles.length - 1}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 transition"
                    title="Descendre"
                  >
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                  <button
                    onClick={() => removeArticle(idx)}
                    className="p-1 rounded hover:bg-red-100 transition"
                    title="Supprimer cet article"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <input
                    type="text"
                    value={art.title}
                    onChange={(e) => updateArticle(idx, 'title', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10"
                    placeholder="Titre de l'article"
                  />
                  <div className="border border-slate-200 rounded-lg overflow-hidden focus-within:border-[#1A2BA6] focus-within:ring-2 focus-within:ring-[#1A2BA6]/10">
                    {/* Formatting toolbar */}
                    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-100 bg-slate-50">
                      <button
                        type="button"
                        title="Gras"
                        onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold'); }}
                        className="px-2.5 py-1 text-sm font-bold text-slate-700 hover:bg-slate-200 rounded-md transition"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        title="Italique"
                        onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic'); }}
                        className="px-2.5 py-1 text-sm italic text-slate-700 hover:bg-slate-200 rounded-md transition"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        title="Souligné"
                        onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline'); }}
                        className="px-2.5 py-1 text-sm underline text-slate-700 hover:bg-slate-200 rounded-md transition"
                      >
                        U
                      </button>
                      <div className="w-px h-5 bg-slate-200 mx-1" />
                      <button
                        type="button"
                        title="Liste à puces"
                        onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertUnorderedList'); }}
                        className="px-2 py-1 text-sm text-slate-700 hover:bg-slate-200 rounded-md transition"
                      >
                        •
                      </button>
                      <button
                        type="button"
                        title="Liste numérotée"
                        onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertOrderedList'); }}
                        className="px-2 py-1 text-sm text-slate-700 hover:bg-slate-200 rounded-md transition"
                      >
                        1.
                      </button>
                    </div>
                    {/* Rich text editor */}
                    <RichTextContent
                      initialContent={art.content || ''}
                      onInput={(html) => updateArticle(idx, 'content', html)}
                    />
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Add article button */}
            <button
              onClick={addArticle}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-[#1A2BA6] hover:text-[#1A2BA6] hover:bg-blue-50/50 transition"
            >
              <Plus className="h-4 w-4" /> Ajouter un article
            </button>
          </div>
        ) : (
          /* Preview tab */
          <div className="h-full">
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full border-0"
                title="Aperçu du contrat"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                <Eye className="h-8 w-8" />
                <p className="text-sm">Cliquez sur &quot;Aperçu&quot; pour générer la prévisualisation</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
