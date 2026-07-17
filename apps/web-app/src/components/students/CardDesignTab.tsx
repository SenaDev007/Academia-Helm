'use client';

/**
 * ============================================================================
 * CARD DESIGN TAB — Sous-onglet "Paramètres Design" du module Cartes Scolaires
 * ============================================================================
 *
 * Layout 2 colonnes :
 *   - Gauche (40%) : CardDesignControls — sections collapsibles
 *   - Droite  (60%) : CardDesignPreview — aperçu live recto/verso + PDF modal
 *
 * États possédés par ce composant (orchestrateur) :
 *   - settings          : CardDesignSettings (couleurs, flags, textes, heures)
 *   - templates         : CardDesignTemplate[] (4 presets + custom)
 *   - identity          : TenantInfo (nom école, logo, slogan…)
 *   - previewCardId     : id d'une carte réelle déjà générée (pour iframe PDF)
 *
 * Flux de données :
 *   1. Au montage : fetch /api/settings/identity → identity + settings initiaux
 *   2. Au montage : fetch /api/students/id-cards/templates → liste templates
 *   3. Au montage : fetch /api/students/id-cards/grouped-by-class → 1 carte pour preview PDF
 *   4. User édite → CardDesignControls appelle onChange(partial) → settings màj → preview live
 *   5. User "Enregistrer" → PUT /api/settings/identity/card-settings → màj TenantIdentityProfile
 *   6. User "Aperçu PDF" → CardDesignPreview ouvre iframe /preview-html/<previewCardId>
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Palette, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { Button } from '@/components/ui/button';
import { type TenantInfo } from './IdCardVisual';
import CardDesignControls from './CardDesignControls';
import CardDesignPreview from './CardDesignPreview';
import {
  type CardDesignSettings,
  type CardDesignTemplate,
  DEFAULT_CARD_SETTINGS,
} from './card-design.types';

/** Carte factice pour l'aperçu live (sans dépendance backend). */
const SAMPLE_CARD = {
  cardNumber: 'AHM-2025-DEMO-001',
  qrPayload: 'https://verify.academia-helm.bj/card/AHM-2025-DEMO-001?h=demo',
  qrHash: 'demo_hash_abc123',
  generatedAt: new Date().toISOString(),
  validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  student: {
    firstName: 'Aïcha',
    lastName: 'ADANDE',
    matricule: 'MAT-2025-0001',
    dateOfBirth: '2015-03-12',
    gender: 'F',
  },
  guardian: {
    firstName: 'Koffi',
    lastName: 'ADANDE',
    phone: '+229 01 97 00 00 00',
    address: 'Cotonou, Bénin',
  },
  className: 'CM2 A',
  levelName: 'Primaire',
  levelCode: 'PRIMAIRE',
  academicYearName: '2025-2026',
};

export default function CardDesignTab() {
  const { academicYear } = useModuleContext();

  // ─── États orchestrateur ───────────────────────────────────────────────────
  const [settings, setSettings] = useState<CardDesignSettings>(DEFAULT_CARD_SETTINGS);
  const [templates, setTemplates] = useState<CardDesignTemplate[]>([]);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(true);
  const [identity, setIdentity] = useState<TenantInfo | null>(null);
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // ─── Charger l'identité + settings initiaux ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings/identity', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const p = Array.isArray(data) ? data[0] : data;
        if (!p) return;
        const tenantInfo: TenantInfo = {
          schoolName: p?.schoolName || p?.name || 'Academia Helm',
          slogan: p?.slogan || 'Excellence • Discipline • Travail',
          address: p?.address || '',
          city: p?.city || '',
          phonePrimary: p?.phonePrimary || p?.phone || '',
          email: p?.email || '',
          website: p?.website || '',
          logoUrl: p?.logoUrl || '',
          maternellePickupMorning: p?.maternellePickupMorning || '12:00',
          maternellePickupAfternoon: p?.maternellePickupAfternoon || '16:30',
          maternelleSingleExit: p?.maternelleSingleExit ?? false,
          maternelleSingleExitTime: p?.maternelleSingleExitTime || '15:30',
          cardPrimaryColor: p?.cardPrimaryColor || DEFAULT_CARD_SETTINGS.cardPrimaryColor,
          cardSecondaryColor: p?.cardSecondaryColor || DEFAULT_CARD_SETTINGS.cardSecondaryColor,
          cardShowQRCode: p?.cardShowQRCode ?? true,
          cardShowPhoto: p?.cardShowPhoto ?? true,
          cardShowGuardian: p?.cardShowGuardian ?? true,
          cardShowEmergencyCall: p?.cardShowEmergencyCall ?? true,
          cardShowSchoolAddress: p?.cardShowSchoolAddress ?? true,
          cardConditionsText:
            p?.cardConditionsText || DEFAULT_CARD_SETTINGS.cardConditionsText,
          cardFooterText: p?.cardFooterText || DEFAULT_CARD_SETTINGS.cardFooterText,
        };
        setIdentity(tenantInfo);
        setSettings({
          cardPrimaryColor: tenantInfo.cardPrimaryColor || DEFAULT_CARD_SETTINGS.cardPrimaryColor,
          cardSecondaryColor: tenantInfo.cardSecondaryColor || DEFAULT_CARD_SETTINGS.cardSecondaryColor,
          cardShowPhoto: tenantInfo.cardShowPhoto ?? true,
          cardShowQRCode: tenantInfo.cardShowQRCode ?? true,
          cardShowBarcode: (p as any)?.cardShowBarcode ?? true,
          cardShowGuardian: tenantInfo.cardShowGuardian ?? true,
          cardShowEmergencyCall: tenantInfo.cardShowEmergencyCall ?? true,
          cardShowSchoolAddress: tenantInfo.cardShowSchoolAddress ?? true,
          cardFooterText: tenantInfo.cardFooterText || DEFAULT_CARD_SETTINGS.cardFooterText,
          cardConditionsText: tenantInfo.cardConditionsText || DEFAULT_CARD_SETTINGS.cardConditionsText,
          maternelleSingleExit: tenantInfo.maternelleSingleExit ?? false,
          maternellePickupMorning: tenantInfo.maternellePickupMorning || '12:00',
          maternellePickupAfternoon: tenantInfo.maternellePickupAfternoon || '16:30',
          maternelleSingleExitTime: tenantInfo.maternelleSingleExitTime || '15:30',
          templateKey: (p as any)?.templateKey || 'CLASSIQUE',
        });
      } catch (e) {
        console.error('[CardDesignTab] identity load error:', e);
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Charger les templates ─────────────────────────────────────────────────
  const loadTemplates = useCallback(async () => {
    setIsTemplatesLoading(true);
    try {
      const list = await studentsService.getCardTemplates();
      setTemplates(list);
    } catch (e) {
      console.error('[CardDesignTab] templates load error:', e);
    } finally {
      setIsTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ─── Charger une carte déjà générée pour l'aperçu PDF réel ─────────────────
  useEffect(() => {
    const academicYearId = academicYear?.id;
    if (!academicYearId) return;
    let cancelled = false;
    (async () => {
      try {
        const grouped = await studentsService
          .getCardsGroupedByClass(academicYearId)
          .catch(() => null);
        if (cancelled || !grouped?.levels?.length) return;
        // Prend la 1re carte du 1er niveau → 1re classe
        const firstLevel = grouped.levels[0];
        const firstClass = firstLevel?.classes?.[0];
        const firstCard = firstClass?.cards?.[0];
        if (firstCard?.id) {
          setPreviewCardId(firstCard.id);
        }
      } catch (e) {
        console.warn('[CardDesignTab] preview card not found:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [academicYear?.id]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleChange = (partial: Partial<CardDesignSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/identity/card-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erreur lors de la sauvegarde');
      }
      toast({
        title: '✅ Paramètres enregistrés',
        description: 'Les nouvelles cartes utiliseront ce design.',
        variant: 'success',
      });
      // Sync l'identity locale avec les nouveaux settings
      setIdentity(prev =>
        prev
          ? {
              ...prev,
              cardPrimaryColor: settings.cardPrimaryColor,
              cardShowQRCode: settings.cardShowQRCode,
              cardShowPhoto: settings.cardShowPhoto,
              cardShowGuardian: settings.cardShowGuardian,
              cardShowEmergencyCall: settings.cardShowEmergencyCall,
              cardShowSchoolAddress: settings.cardShowSchoolAddress,
              cardConditionsText: settings.cardConditionsText,
              cardFooterText: settings.cardFooterText,
              maternelleSingleExit: settings.maternelleSingleExit,
              maternellePickupMorning: settings.maternellePickupMorning,
              maternellePickupAfternoon: settings.maternellePickupAfternoon,
              maternelleSingleExitTime: settings.maternelleSingleExitTime,
            }
          : prev,
      );
    } catch (e: any) {
      toast({
        title: 'Erreur sauvegarde',
        description: e.message || 'Échec de l\'enregistrement.',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const ok = window.confirm(
      'Réinitialiser tous les paramètres de design aux valeurs par défaut ?\n\n' +
      'Ceci remet : couleurs bleu marine, tous les éléments visibles, ' +
      'texte de conditions standard. Vous devrez ensuite cliquer sur « Enregistrer » ' +
      'pour propager la réinitialisation.',
    );
    if (!ok) return;
    setSettings({ ...DEFAULT_CARD_SETTINGS });
    toast({
      title: '↺ Paramètres réinitialisés',
      description: 'Cliquez sur « Enregistrer » pour appliquer.',
      variant: 'info',
    });
  };

  const handlePreviewPdf = () => {
    if (!previewCardId) {
      toast({
        title: 'Aperçu PDF indisponible',
        description:
          'Aucune carte n\'a encore été générée. Générez au moins une carte dans l\'onglet « Liste & Génération ».',
        variant: 'warning',
      });
      return;
    }
    setIsPdfModalOpen(true);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (isBooting) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
        <span className="ml-2 text-sm text-slate-500">Chargement du studio de design…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ─── Bandeau d'info ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-lg">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-violet-700" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">Studio de design des cartes</h3>
            <p className="text-[11px] text-slate-600">
              Personnalisez les couleurs, les éléments affichés et les textes.
              L'aperçu se met à jour en temps réel.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={loadTemplates}
          disabled={isTemplatesLoading}
          className="text-xs"
        >
          {isTemplatesLoading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />}
          Rafraîchir les templates
        </Button>
      </div>

      {/* ─── Layout 2 colonnes 40/60 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Panneau gauche : contrôles (40%) */}
        <div className="lg:col-span-2">
          <CardDesignControls
            settings={settings}
            templates={templates}
            isTemplatesLoading={isTemplatesLoading}
            onChange={handleChange}
            onSave={handleSave}
            onReset={handleReset}
            onPreviewPdf={handlePreviewPdf}
            onRefreshTemplates={loadTemplates}
            isSaving={isSaving}
          />
        </div>

        {/* Panneau droit : aperçu (60%) */}
        <div className="lg:col-span-3">
          <CardDesignPreview
            settings={settings}
            sampleCard={SAMPLE_CARD}
            previewCardId={previewCardId}
            identity={identity}
            isPdfModalOpen={isPdfModalOpen}
            onOpenPdfModal={handlePreviewPdf}
            onClosePdfModal={() => setIsPdfModalOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
