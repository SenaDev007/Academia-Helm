'use client';

/**
 * ============================================================================
 * CARD DESIGN CONTROLS — Panneau gauche (40%) du sous-onglet "Paramètres Design"
 * ============================================================================
 *
 * Sections collapsibles (accordéon custom) :
 *   1. Template      — 4 presets système + liste des templates personnalisés
 *   2. Couleurs      — color pickers primaire + secondaire + live preview
 *   3. Éléments      — toggles photo / QR / barcode / tuteur / urgence / adresse
 *   4. Textes        — conditions d'utilisation + footer
 *   5. Heures maternelle — sortie unique + 3 inputs heure
 *   6. Actions       — Enregistrer / Réinitialiser / Aperçu PDF
 *
 * ⭐ Patrons de design suivis :
 *   - shadcn/ui (Button, Input, Label, Switch, Card, Badge)
 *   - Slate palette cohérente avec StudentIdCardsSection.tsx
 *   - Pas d'indigo/blue sauf pour le bouton primaire (cohérent avec l'existant)
 *
 * ⚠️ La sauvegarde se fait via PUT /api/settings/identity/card-settings (BFF)
 *    qui met à jour le TenantIdentityProfile — pas via les routes templates.
 * ============================================================================
 */

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Palette,
  Eye,
  FileText,
  Clock,
  Save,
  RotateCcw,
  FileDown,
  Layers,
  Copy,
  Trash2,
  Loader2,
  Plus,
  X,
  Shield,
  Type,
  Image as ImageIcon,
  LayoutTemplate,
  QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { studentsService } from '@/services/students.service';
import {
  type CardDesignSettings,
  type CardDesignTemplate,
  SYSTEM_PRESETS_META,
} from './card-design.types';

interface Props {
  settings: CardDesignSettings;
  templates: CardDesignTemplate[];
  isTemplatesLoading: boolean;
  onChange: (partial: Partial<CardDesignSettings>) => void;
  onSave: () => void;
  onReset: () => void;
  onPreviewPdf: () => void;
  onRefreshTemplates: () => void;
  isSaving: boolean;
}

// ─── Sous-composant : section collapsible (accordéon) ────────────────────────
function CollapsibleSection({
  id,
  title,
  subtitle,
  icon,
  iconColor,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconColor: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition text-left"
        aria-expanded={isOpen}
        aria-controls={`section-${id}`}
      >
        <span className={cn('p-1.5 rounded-md', iconColor)}>{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">{title}</p>
          {subtitle && <p className="text-[10px] text-slate-500 truncate">{subtitle}</p>}
        </div>
        {isOpen
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      </button>
      {isOpen && (
        <div id={`section-${id}`} className="px-3 pb-3 pt-1 space-y-3 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Sous-composant : ligne toggle (label + switch) ─────────────────────────
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50 transition">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        {description && <p className="text-[10px] text-slate-400">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ─── Sous-composant : color picker (swatch + hex input) ─────────────────────
function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-10 h-8 rounded border border-slate-200 cursor-pointer shrink-0"
          aria-label={`${label} — sélecteur de couleur`}
        />
        <Input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 font-mono text-xs"
          maxLength={7}
        />
      </div>
    </div>
  );
}

export default function CardDesignControls({
  settings,
  templates,
  isTemplatesLoading,
  onChange,
  onSave,
  onReset,
  onPreviewPdf,
  onRefreshTemplates,
  isSaving,
}: Props) {
  // ─── État local UI ─────────────────────────────────────────────────────────
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<CardDesignTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateKey, setNewTemplateKey] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ─── Templates : présélection du preset actif ──────────────────────────────
  const systemPresets = templates.filter(t => t.isSystem);
  const customTemplates = templates.filter(t => !t.isSystem);
  const activeTemplateKey = settings.templateKey || 'CLASSIQUE';

  // ─── Actions ───────────────────────────────────────────────────────────────
  const handleApplyPreset = (template: CardDesignTemplate) => {
    onChange({
      ...template.layout,
      templateKey: template.key,
    });
    toast({
      title: '🎨 Template appliqué',
      description: `Le preset « ${template.name} » a été chargé. Pensez à enregistrer.`,
      variant: 'success',
    });
  };

  const handleOpenDuplicateModal = (template: CardDesignTemplate) => {
    setDuplicateSource(template);
    setNewTemplateName(`${template.name} — Copie`);
    setNewTemplateKey(
      `${template.key}_CUSTOM_${Date.now().toString(36).toUpperCase()}`.substring(0, 48),
    );
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicateSource) return;
    if (!newTemplateName.trim() || !newTemplateKey.trim()) {
      toast({ title: 'Champs requis', description: 'Nom et clé obligatoires.', variant: 'error' });
      return;
    }
    setIsDuplicating(true);
    try {
      await studentsService.createCardTemplate({
        name: newTemplateName.trim(),
        key: newTemplateKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
        layout: { ...duplicateSource.layout },
      });
      toast({
        title: '✅ Template créé',
        description: `« ${newTemplateName.trim()} » est disponible dans vos templates personnalisés.`,
        variant: 'success',
      });
      setDuplicateSource(null);
      setNewTemplateName('');
      setNewTemplateKey('');
      onRefreshTemplates();
    } catch (e: any) {
      toast({
        title: 'Erreur création template',
        description: e?.message || 'Impossible de créer le template.',
        variant: 'error',
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDeleteCustom = async (template: CardDesignTemplate) => {
    const ok = window.confirm(
      `Supprimer le template « ${template.name} » ?\n\n` +
      `Cette action est réversible côté backend (soft delete), mais le template ` +
      `n'apparaîtra plus dans la liste. Les cartes déjà émises conservent leur design.`,
    );
    if (!ok) return;
    setDeletingId(template.id);
    try {
      await studentsService.deleteCardTemplate(template.id);
      toast({
        title: '🗑️ Template supprimé',
        description: `« ${template.name} » a été archivé.`,
        variant: 'success',
      });
      // Si on supprimait le template actif, on revient à CLASSIQUE
      if (settings.templateKey === template.key) {
        onChange({ templateKey: 'CLASSIQUE' });
      }
      onRefreshTemplates();
    } catch (e: any) {
      toast({
        title: 'Erreur suppression',
        description: e?.message || 'Impossible de supprimer le template.',
        variant: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* ═══ 1. Template ═══ */}
      <CollapsibleSection
        id="template"
        title="Template"
        subtitle="Choisissez un preset ou dupliquez-en un"
        icon={<Layers className="w-3.5 h-3.5" />}
        iconColor="bg-violet-100 text-violet-700"
        defaultOpen
      >
        {isTemplatesLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Grille 4 presets système */}
            <div className="grid grid-cols-2 gap-2">
              {SYSTEM_PRESETS_META.map(meta => {
                const template = systemPresets.find(t => t.key === meta.key);
                const isActive = activeTemplateKey === meta.key;
                return (
                  <button
                    key={meta.key}
                    type="button"
                    onClick={() => template && handleApplyPreset(template)}
                    className={cn(
                      'relative p-2 rounded-lg border-2 text-left transition group overflow-hidden',
                      isActive
                        ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                    title={meta.description}
                  >
                    {/* Mini-aperçu couleur */}
                    <div
                      className="h-8 rounded mb-1.5"
                      style={{
                        background: `linear-gradient(135deg, ${meta.primary} 0%, ${meta.secondary} 100%)`,
                      }}
                    />
                    <p className="text-[10px] font-bold text-slate-800">{meta.name}</p>
                    <p className="text-[9px] text-slate-400 truncate">{meta.description}</p>
                    {isActive && (
                      <Badge className="absolute top-1 right-1 bg-violet-600 text-white text-[8px] px-1 py-0">
                        Actif
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Liste des templates personnalisés */}
            {customTemplates.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                  Templates personnalisés ({customTemplates.length})
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {customTemplates.map(tpl => {
                    const isActive = activeTemplateKey === tpl.key;
                    return (
                      <div
                        key={tpl.id}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-lg border transition',
                          isActive
                            ? 'border-violet-300 bg-violet-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50',
                        )}
                      >
                        <div
                          className="w-5 h-5 rounded shrink-0 border border-slate-200"
                          style={{
                            background: `linear-gradient(135deg, ${tpl.layout?.cardPrimaryColor || '#0D1F6E'} 0%, ${tpl.layout?.cardSecondaryColor || '#1A237E'} 100%)`,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(tpl)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="text-xs font-semibold text-slate-800 truncate">{tpl.name}</p>
                          <p className="text-[9px] text-slate-400 font-mono truncate">{tpl.key}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDuplicateModal(tpl)}
                          className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                          title="Dupliquer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustom(tpl)}
                          disabled={deletingId === tpl.id}
                          className="p-1 rounded text-rose-400 hover:bg-rose-100 hover:text-rose-700 transition disabled:opacity-50"
                          title="Supprimer"
                        >
                          {deletingId === tpl.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bouton dupliquer le preset actif */}
            <div className="pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  const tpl = systemPresets.find(t => t.key === activeTemplateKey) || systemPresets[0];
                  if (tpl) handleOpenDuplicateModal(tpl);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Dupliquer le template actif
              </Button>
              <p className="text-[9px] text-slate-400 mt-1 italic">
                Crée un template personnalisé à partir du preset sélectionné, modifiable librement.
              </p>
            </div>
          </>
        )}
      </CollapsibleSection>

      {/* ═══ 2. Couleurs ═══ */}
      <CollapsibleSection
        id="colors"
        title="Couleurs"
        subtitle="Bandeaux et accents des cartes"
        icon={<Palette className="w-3.5 h-3.5" />}
        iconColor="bg-blue-100 text-blue-700"
        defaultOpen
      >
        <ColorPicker
          label="Couleur primaire (bandeaux)"
          value={settings.cardPrimaryColor}
          onChange={v => onChange({ cardPrimaryColor: v })}
        />
        <ColorPicker
          label="Couleur secondaire (dégradés)"
          value={settings.cardSecondaryColor}
          onChange={v => onChange({ cardSecondaryColor: v })}
        />
        {/* Aperçu live */}
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Aperçu dégradé</p>
          <div
            className="h-6 rounded"
            style={{
              background: `linear-gradient(135deg, ${settings.cardPrimaryColor} 0%, ${settings.cardSecondaryColor} 100%)`,
            }}
          />
        </div>
      </CollapsibleSection>

      {/* ═══ 3. Éléments affichés ═══ */}
      <CollapsibleSection
        id="elements"
        title="Éléments affichés"
        subtitle="Visibilité des blocs sur la carte"
        icon={<Eye className="w-3.5 h-3.5" />}
        iconColor="bg-indigo-100 text-indigo-700"
      >
        <div className="space-y-0.5">
          <ToggleRow
            label="Photo de l'élève"
            description="Affichée à gauche sur le recto"
            checked={settings.cardShowPhoto}
            onChange={v => onChange({ cardShowPhoto: v })}
          />
          <ToggleRow
            label="QR Code de vérification"
            description="Verso — scan pour vérifier l'authenticité"
            checked={settings.cardShowQRCode}
            onChange={v => onChange({ cardShowQRCode: v })}
          />
          <ToggleRow
            label="Code-barres"
            description="Verso — numéro de carte encodé"
            checked={settings.cardShowBarcode}
            onChange={v => onChange({ cardShowBarcode: v })}
          />
          <ToggleRow
            label="Tuteur / Gardien"
            description="Recto — nom du parent responsable"
            checked={settings.cardShowGuardian}
            onChange={v => onChange({ cardShowGuardian: v })}
          />
          <ToggleRow
            label="Appel d'urgence"
            description="Recto — téléphone à contacter"
            checked={settings.cardShowEmergencyCall}
            onChange={v => onChange({ cardShowEmergencyCall: v })}
          />
          <ToggleRow
            label="Adresse de l'école"
            description="Bande bas du recto + verso"
            checked={settings.cardShowSchoolAddress}
            onChange={v => onChange({ cardShowSchoolAddress: v })}
          />
        </div>
      </CollapsibleSection>

      {/* ═══ 4. Textes ═══ */}
      <CollapsibleSection
        id="texts"
        title="Textes personnalisables"
        subtitle="Conditions d'utilisation et footer"
        icon={<FileText className="w-3.5 h-3.5" />}
        iconColor="bg-emerald-100 text-emerald-700"
      >
        <div>
          <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Conditions d'utilisation (verso)
          </Label>
          <textarea
            value={settings.cardConditionsText}
            onChange={e => onChange({ cardConditionsText: e.target.value })}
            rows={4}
            maxLength={600}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Saisissez les conditions d'utilisation imprimées au verso de la carte…"
          />
          <p className="text-[9px] text-slate-400 mt-0.5 text-right">
            {settings.cardConditionsText.length}/600
          </p>
        </div>
        <div>
          <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Footer / Mention officielle
          </Label>
          <Input
            type="text"
            value={settings.cardFooterText}
            onChange={e => onChange({ cardFooterText: e.target.value })}
            maxLength={120}
            placeholder="Academia Helm · Document officiel"
          />
          <p className="text-[9px] text-slate-400 mt-0.5 text-right">
            {settings.cardFooterText.length}/120
          </p>
        </div>
      </CollapsibleSection>

      {/* ═══ 5. Heures maternelle ═══ */}
      <CollapsibleSection
        id="maternelle"
        title="Heures maternelle"
        subtitle="Affichées au verso (maternelle uniquement)"
        icon={<Clock className="w-3.5 h-3.5" />}
        iconColor="bg-amber-100 text-amber-700"
      >
        <ToggleRow
          label="Sortie unique"
          description="École bilingue — cours jusqu'à 15h30"
          checked={settings.maternelleSingleExit}
          onChange={v => onChange({ maternelleSingleExit: v })}
        />
        {settings.maternelleSingleExit ? (
          <div>
            <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Heure de sortie unique
            </Label>
            <Input
              type="time"
              value={settings.maternelleSingleExitTime}
              onChange={e => onChange({ maternelleSingleExitTime: e.target.value })}
              className="bg-white"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Sortie du matin
              </Label>
              <Input
                type="time"
                value={settings.maternellePickupMorning}
                onChange={e => onChange({ maternellePickupMorning: e.target.value })}
                className="bg-white"
              />
            </div>
            <div>
              <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Sortie de l'après-midi
              </Label>
              <Input
                type="time"
                value={settings.maternellePickupAfternoon}
                onChange={e => onChange({ maternellePickupAfternoon: e.target.value })}
                className="bg-white"
              />
            </div>
          </div>
        )}
        <p className="text-[9px] text-slate-400 italic">
          Ces heures s'affichent uniquement sur les cartes des élèves de maternelle.
        </p>
      </CollapsibleSection>

      {/* ═══ 6. Police & Textes ═══ */}
      <CollapsibleSection
        id="typography"
        title="Police & Textes"
        subtitle="Famille, taille, style des textes"
        icon={<Type className="w-3.5 h-3.5" />}
        iconColor="bg-indigo-100 text-indigo-700"
      >
        <div className="space-y-2">
          <div>
            <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Famille de police
            </Label>
            <select
              value={settings.cardFontFamily || 'Helvetica'}
              onChange={e => onChange({ cardFontFamily: e.target.value as any })}
              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
            >
              <option value="Helvetica">Helvetica (défaut)</option>
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman (serif)</option>
              <option value="Georgia">Georgia (serif)</option>
              <option value="Verdana">Verdana</option>
              <option value="Trebuchet MS">Trebuchet MS</option>
              <option value="Courier New">Courier New (mono)</option>
            </select>
          </div>

          <div>
            <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Taille des textes
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {(['small', 'medium', 'large'] as const).map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onChange({ cardFontSizeScale: size })}
                  className={cn(
                    'px-2 py-1.5 text-[10px] font-bold uppercase rounded-md border transition',
                    (settings.cardFontSizeScale || 'medium') === size
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  )}
                >
                  {size === 'small' ? 'Petite' : size === 'medium' ? 'Moyenne' : 'Grande'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Style nom élève
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {(['normal', 'uppercase', 'bold'] as const).map(style => (
                <button
                  key={style}
                  type="button"
                  onClick={() => onChange({ cardStudentNameStyle: style })}
                  className={cn(
                    'px-2 py-1.5 text-[10px] font-bold uppercase rounded-md border transition',
                    (settings.cardStudentNameStyle || 'bold') === style
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  )}
                >
                  {style === 'normal' ? 'Normal' : style === 'uppercase' ? 'MAJ' : 'Gras'}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Champs affichés (recto)
            </Label>
            <div className="space-y-1">
              <ToggleRow
                label="Matricule"
                description="Afficher le matricule de l'élève"
                checked={settings.cardShowMatricule ?? true}
                onChange={v => onChange({ cardShowMatricule: v })}
              />
              <ToggleRow
                label="Date/lieu de naissance"
                description="Afficher Né(e) le + lieu"
                checked={settings.cardShowBirthInfo ?? true}
                onChange={v => onChange({ cardShowBirthInfo: v })}
              />
              <ToggleRow
                label="Sexe"
                description="Afficher Masculin/Féminin"
                checked={settings.cardShowGender ?? true}
                onChange={v => onChange({ cardShowGender: v })}
              />
              <ToggleRow
                label="Niveau scolaire"
                description="Afficher le niveau (Maternelle/Primaire/Secondaire)"
                checked={settings.cardShowLevel ?? true}
                onChange={v => onChange({ cardShowLevel: v })}
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══ 7. Photo ═══ */}
      <CollapsibleSection
        id="photo"
        title="Photo élève"
        subtitle="Position, taille, forme"
        icon={<ImageIcon className="w-3.5 h-3.5" />}
        iconColor="bg-emerald-100 text-emerald-700"
      >
        <div className="space-y-2">
          <div>
            <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Position de la photo
            </Label>
            <div className="grid grid-cols-2 gap-1">
              {(['left', 'right'] as const).map(pos => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => onChange({ cardPhotoPosition: pos })}
                  className={cn(
                    'px-2 py-1.5 text-[10px] font-bold uppercase rounded-md border transition',
                    (settings.cardPhotoPosition || 'left') === pos
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  )}
                >
                  {pos === 'left' ? '← Gauche' : 'Droite →'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Taille de la photo
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {(['small', 'medium', 'large'] as const).map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onChange({ cardPhotoSize: size })}
                  className={cn(
                    'px-2 py-1.5 text-[10px] font-bold uppercase rounded-md border transition',
                    (settings.cardPhotoSize || 'medium') === size
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  )}
                >
                  {size === 'small' ? '20mm' : size === 'medium' ? '24mm' : '28mm'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Forme de la photo
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {(['rectangle', 'rounded', 'circle'] as const).map(shape => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => onChange({ cardPhotoShape: shape })}
                  className={cn(
                    'px-2 py-1.5 text-[10px] font-bold uppercase rounded-md border transition',
                    (settings.cardPhotoShape || 'rectangle') === shape
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  )}
                >
                  {shape === 'rectangle' ? 'Rectangle' : shape === 'rounded' ? 'Arrondi' : 'Cercle'}
                </button>
              ))}
            </div>
          </div>

          <ToggleRow
            label="Afficher la photo"
            description="Désactivé = pas de photo sur la carte"
            checked={settings.cardShowPhoto}
            onChange={v => onChange({ cardShowPhoto: v })}
          />
        </div>
      </CollapsibleSection>

      {/* ═══ 8. En-tête & Logo ═══ */}
      <CollapsibleSection
        id="header"
        title="En-tête & Logo"
        subtitle="Style du bandeau, position et taille du logo"
        icon={<LayoutTemplate className="w-3.5 h-3.5" />}
        iconColor="bg-violet-100 text-violet-700"
      >
        <div className="space-y-2">
          <div>
            <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Style du bandeau
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {(['solid', 'gradient', 'striped'] as const).map(style => (
                <button
                  key={style}
                  type="button"
                  onClick={() => onChange({ cardHeaderStyle: style })}
                  className={cn(
                    'px-2 py-1.5 text-[10px] font-bold uppercase rounded-md border transition',
                    (settings.cardHeaderStyle || 'solid') === style
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  )}
                >
                  {style === 'solid' ? 'Plein' : style === 'gradient' ? 'Dégradé' : 'Stries'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Position du logo
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {(['left', 'center', 'right'] as const).map(pos => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => onChange({ cardLogoPosition: pos })}
                  className={cn(
                    'px-2 py-1.5 text-[10px] font-bold uppercase rounded-md border transition',
                    (settings.cardLogoPosition || 'left') === pos
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  )}
                >
                  {pos === 'left' ? '← G' : pos === 'center' ? 'C' : 'D →'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Taille du logo
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {(['small', 'medium', 'large'] as const).map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onChange({ cardLogoSize: size })}
                  className={cn(
                    'px-2 py-1.5 text-[10px] font-bold uppercase rounded-md border transition',
                    (settings.cardLogoSize || 'medium') === size
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  )}
                >
                  {size === 'small' ? '8mm' : size === 'medium' ? '10mm' : '12mm'}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[9px] text-slate-400 italic">
            Le logo est configuré dans Paramètres → Identité de l'établissement.
          </p>
        </div>
      </CollapsibleSection>

      {/* ═══ 9. QR Code ═══ */}
      <CollapsibleSection
        id="qr-code"
        title="QR Code"
        subtitle="Position, taille, logo intégré"
        icon={<QrCode className="w-3.5 h-3.5" />}
        iconColor="bg-blue-100 text-blue-700"
      >
        <div className="space-y-2">
          <ToggleRow
            label="Afficher le QR code"
            description="Code de vérification au verso"
            checked={settings.cardShowQRCode}
            onChange={v => onChange({ cardShowQRCode: v })}
          />

          {settings.cardShowQRCode && (
            <>
              <ToggleRow
                label="Logo école au centre"
                description="Intègre le logo de l'école au milieu du QR code (recommandé)"
                checked={settings.cardQrWithLogo ?? true}
                onChange={v => onChange({ cardQrWithLogo: v })}
              />

              <div>
                <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Position du QR code (verso)
                </Label>
                <div className="grid grid-cols-2 gap-1">
                  {(['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const).map(pos => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => onChange({ cardQrPosition: pos })}
                      className={cn(
                        'px-2 py-1.5 text-[10px] font-bold uppercase rounded-md border transition',
                        (settings.cardQrPosition || 'bottom-right') === pos
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                      )}
                    >
                      {pos === 'bottom-right' ? '↓ Droite' :
                       pos === 'bottom-left' ? '↓ Gauche' :
                       pos === 'top-right' ? '↑ Droite' : '↑ Gauche'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Taille du QR code
                </Label>
                <div className="grid grid-cols-3 gap-1">
                  {(['small', 'medium', 'large'] as const).map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onChange({ cardQrSize: size })}
                      className={cn(
                        'px-2 py-1.5 text-[10px] font-bold uppercase rounded-md border transition',
                        (settings.cardQrSize || 'medium') === size
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                      )}
                    >
                      {size === 'small' ? '16mm' : size === 'medium' ? '20mm' : '24mm'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* ═══ 10. Actions ═══ */}
      <CollapsibleSection
        id="actions"
        title="Actions"
        subtitle="Sauvegarde et aperçu"
        icon={<Shield className="w-3.5 h-3.5" />}
        iconColor="bg-rose-100 text-rose-700"
        defaultOpen
      >
        <div className="grid grid-cols-1 gap-2">
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
          >
            {isSaving
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Sauvegarde…' : 'Enregistrer les paramètres'}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              disabled={isSaving}
              className="text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Réinitialiser
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onPreviewPdf}
              className="text-xs"
            >
              <FileDown className="w-3.5 h-3.5" />
              Aperçu PDF
            </Button>
          </div>
        </div>
        <p className="text-[9px] text-slate-400 italic">
          La sauvegarde met à jour le profil d'identité du tenant (TenantIdentityProfile).
          Les nouvelles cartes générées utiliseront ces paramètres.
        </p>
      </CollapsibleSection>

      {/* ═══ Modal de duplication (création template custom) ═══ */}
      {duplicateSource && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => !isDuplicating && setDuplicateSource(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-violet-100 text-violet-700">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Dupliquer le template</h3>
                  <p className="text-[10px] text-slate-500">
                    Source : <strong>{duplicateSource.name}</strong>
                  </p>
                </div>
              </div>
              {!isDuplicating && (
                <button
                  type="button"
                  onClick={() => setDuplicateSource(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Nom du template *
                </Label>
                <Input
                  type="text"
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  placeholder="Ex. Design Excellence 2025"
                  autoFocus
                />
              </div>
              <div>
                <Label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Clé technique *
                </Label>
                <Input
                  type="text"
                  value={newTemplateKey}
                  onChange={e =>
                    setNewTemplateKey(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 64),
                    )
                  }
                  placeholder="EX: EXCELLENCE_2025"
                  className="font-mono"
                />
                <p className="text-[9px] text-slate-400 mt-1">
                  Lettres majuscules, chiffres et _ uniquement. Max 64 caractères.
                </p>
              </div>
              <div className="p-2 rounded-lg bg-violet-50 border border-violet-200">
                <p className="text-[10px] text-violet-700">
                  Le template sera créé avec les mêmes paramètres que « {duplicateSource.name} ».
                  Vous pourrez ensuite le personnaliser via les sections ci-dessus.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 flex justify-end gap-2 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDuplicateSource(null)}
                disabled={isDuplicating}
                className="text-xs"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDuplicate}
                disabled={isDuplicating || !newTemplateName.trim() || !newTemplateKey.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white text-xs"
              >
                {isDuplicating
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Plus className="w-3.5 h-3.5" />}
                {isDuplicating ? 'Création…' : 'Créer le template'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
