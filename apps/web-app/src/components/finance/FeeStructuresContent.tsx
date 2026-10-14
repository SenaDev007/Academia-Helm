'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Copy, UserCog, Pencil, Trash2, X, ChevronDown, Calendar, Clock, CalendarClock, CheckSquare, Square } from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { financeService } from '@/services/finance.service';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { invalidateApiCache } from '@/lib/api/get-cache';
import { getAcademicYears } from '@/services/settings.service';
import FeeStructureModal from './FeeStructureModal';
import FeeOverrideModal from './FeeOverrideModal';
import { formatCurrency } from '@/lib/utils';

const FEE_TYPES = [
  { value: 'INSCRIPTION', label: 'Inscription' },
  { value: 'REINSCRIPTION', label: 'Réinscription' },
  { value: 'TUITION', label: 'Scolarité' },
  // ⭐ Oct. 2026 (exigence promoteur — uniforme tous tenants) :
  //    CANTEEN (« Cantine ») et OTHER (« Autre ») RETIRÉS du sélecteur
  //    « Nouveau frais » ET du filtre Type — la cantine dispose de son
  //    module dédié et « Autre » n'a pas de sémantique de suivi.
  //    EXAMEN est conservé : suivi dédié dans l'onglet « Frais des examens ».
  { value: 'EXAMEN', label: "Frais d'examen" },
  // ⭐ Frais généraux — suivi dans l'onglet dédié du module Finance
  { value: 'GENERAL', label: 'Frais généraux' },
];

// Libellés d'AFFICHAGE — inclut les types retirés du sélecteur pour que les
// structures historiques (données legacy CANTEEN/OTHER) restent lisibles.
const FEE_TYPE_LABELS: Record<string, string> = {
  INSCRIPTION: 'Inscription',
  REINSCRIPTION: 'Réinscription',
  TUITION: 'Scolarité',
  CANTEEN: 'Cantine',
  EXAMEN: "Frais d'examen",
  GENERAL: 'Frais généraux',
  OTHER: 'Autre',
};

function classOrder(name: string): number {
  const n = (name || '').trim().toUpperCase();
  if (n === 'MATERNELLE 1' || n === 'M1' || n === 'MAT1') return 0;
  if (n === 'MATERNELLE 2' || n === 'M2' || n === 'MAT2') return 1;
  if (n === 'CI') return 10;
  if (n === 'CP') return 11;
  if (n === 'CE1') return 12;
  if (n === 'CE2') return 13;
  if (n === 'CM1') return 14;
  if (n === 'CM2') return 15;
  if (n === '6E' || n === '6ÈME' || n === '6EME') return 20;
  if (n === '5E' || n === '5ÈME' || n === '5EME') return 21;
  if (n === '4E' || n === '4ÈME' || n === '4EME') return 22;
  if (n === '3E' || n === '3ÈME' || n === '3EME') return 23;
  if (n === '2NDE') return 24;
  if (n === '1ERE' || n === '1ÈRE') return 25;
  if (n === 'TERMINALE' || n === 'TLE') return 26;
  return 100 + (name.charCodeAt(0) || 0);
}

export default function FeeStructuresContent({ onAccountsChanged }: { onAccountsChanged?: () => void }) {
  const confirmDialog = useConfirmDialog();
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [structures, setStructures] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevelId, setFilterLevelId] = useState<string>('');
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [filterFeeType, setFilterFeeType] = useState<string>('');
  const [modalNewFee, setModalNewFee] = useState(false);
  const [editingFee, setEditingFee] = useState<any | null>(null);
  // ⭐ FIX (sept. 2026 — bug « le modal ne se ferme pas après enregistrement ») :
  //    la création/modification d'un frais déclenche le recalcul de TOUS les comptes
  //    élèves (jusqu'à ~20 s pour une grande école). Sans feedback, l'utilisateur
  //    croyait que le clic ne faisait rien → re-cliquait → FRAIS EN DOUBLE.
  //    → état `saving` : bouton avec spinner + désactivé pendant l'opération.
  const [saving, setSaving] = useState(false);
  const [modalOverride, setModalOverride] = useState(false);
  const [copyYearModal, setCopyYearModal] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [copyTo, setCopyTo] = useState('');
  // ⭐ Task 24 : sélection multiple pour suppression en masse
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [installmentPopoverId, setInstallmentPopoverId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Mapping education_levels UUID → SchoolLevel UUID (le vrai levelId pour fee_structures)
  // levels vient de /api/school-levels (avec code = "MATERNELLE"/"PRIMAIRE"/"SECONDAIRE")
  // Chaque niveau exposé par /api/school-levels contient un champ `schoolLevelId` qui est
  // le vrai UUID dans la table `school_levels` (FK de fee_structures.levelId).
  // ⚠️ Ne PAS utiliser AcademicClass.levelId qui pointe vers `pedagogy_academic_levels`
  // (table différente) — cela provoque une FK violation P2003 côté backend.
  const eduToSchoolLevelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const level of levels) {
      // ⭐ Utiliser directement schoolLevelId exposé par /api/school-levels
      if (level.schoolLevelId) {
        map[level.id] = level.schoolLevelId;
      }
    }
    return map;
  }, [levels]);

  // Convertir education_levels UUID → SchoolLevel UUID (vrai FK pour fee_structures)
  // Retourne undefined si non trouvé (évite d'envoyer un mauvais ID au backend).
  const toSchoolLevelId = (eduId: string): string | undefined => {
    return eduToSchoolLevelMap[eduId] || undefined;
  };

  // Filtrer les classes officielles par niveau
  // ⭐ On filtre par NOM de niveau (Maternelle/Primaire/Secondaire) et non par ID,
  // car AcademicClass.levelId pointe vers pedagogy_academic_levels (AcademicLevel),
  // tandis que levels viennent de school_levels (SchoolLevel) — ce sont 2 tables différentes.
  // Le match par nom est insensible à la casse et gère les variantes (MATERNELLE vs Maternelle).
  const filteredSortedClasses = useMemo(() => {
    const sorted = [...classes].sort((a, b) => classOrder(a.name) - classOrder(b.name));
    if (!filterLevelId) return sorted;
    const selectedLevel = levels.find((l) => l.id === filterLevelId);
    if (!selectedLevel) return sorted;
    const levelCode = (selectedLevel.code || '').toLowerCase();
    const levelLabel = (selectedLevel.label || '').toLowerCase();
    return sorted.filter((c: any) => {
      const levelName = (c.level?.name || '').toLowerCase();
      const classLevelCode = (c.level?.code || '').toLowerCase();
      return levelName === levelCode || levelName === levelLabel ||
             classLevelCode === levelCode || classLevelCode === levelLabel ||
             c.schoolLevelId === selectedLevel.schoolLevelId;
    });
  }, [classes, filterLevelId, levels]);

  useEffect(() => {
    if (filterClassId && !filteredSortedClasses.find((c) => c.id === filterClassId)) {
      setFilterClassId('');
    }
  }, [filteredSortedClasses, filterClassId]);

  const loadStructures = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { academicYearId: academicYear.id };
      if (filterLevelId) {
        const slId = toSchoolLevelId(filterLevelId);
        if (slId) params.levelId = slId;
      }
      if (filterClassId) params.classId = filterClassId;
      if (filterFeeType) params.feeType = filterFeeType;
      const data = await financeService.getFeeStructures(params);
      setStructures(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [academicYear?.id, filterLevelId, filterClassId, filterFeeType, eduToSchoolLevelMap]);

  useEffect(() => { loadStructures(); }, [loadStructures]);

  // Fermer le popover au clic en dehors ou sur Escape
  useEffect(() => {
    if (!installmentPopoverId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setInstallmentPopoverId(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInstallmentPopoverId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [installmentPopoverId]);

  // ⭐ FIX 2026-09-09 (« bascule d'année globale ») : les classes officielles
  //    (CE1, CM2, 6ème…) étaient chargées UNE SEULE FOIS au montage avec
  //    l'année ACTIVE serveur (find(isActive)) — ignorant le sélecteur d'année
  //    du header. Résultat : après bascule vers 2025-2026, la liste des frais
  //    affichait bien 2025-2026 mais le filtre/modale « classe » proposait
  //    les classes de l'année active (2026-2027) → classId hors-année,
  //    structures introuvables pour la classe choisie.
  //    → On utilise l'année du CONTEXTE (useModuleContext, prop du sélecteur
  //    global) et on RECHARGE quand elle change.
  useEffect(() => {
    if (!academicYear?.id) return;
    const authHeaders = getClientAuthorizationHeader();
    // ⭐ Utiliser /api/academic-classes (classes OFFICIELLES : CE1, CM2, 6ème, etc.)
    // au lieu de /api/all-classes (classes PHYSIQUES : CE1-A, CE1-B, etc.)
    // Les classes officielles sont utilisées pour la configuration des frais.
    fetch(`/api/academic-classes?academicYearId=${academicYear.id}`, {
      headers: { ...authHeaders },
      credentials: 'include',
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((d) => {
        const cls = Array.isArray(d) ? d : (d.data ?? []);
        setClasses(cls);
      })
      .catch(() => setClasses([]));
  }, [academicYear?.id]);

  // La liste des années n'est utile que pour la modale « copier d'une année
  // à l'autre » (source/cible) — pas pour la sélection de données.
  useEffect(() => {
    getAcademicYears()
      .then((d) => {
        const years = Array.isArray(d) ? d : (d.data ?? []);
        setAcademicYears(years);
      })
      .catch(() => setAcademicYears([]));

    fetch('/api/school-levels')
      .then((res) => res.json())
      .then((d) => setLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setLevels([]));
  }, []);

  const levelDisplay = (s: any): string => {
    if (s.level?.label) return s.level.label;
    if (s.level?.code) return s.level.code;
    if (s.level?.name) return s.level.name;
    return '—';
  };
  const classDisplay = (s: any): string => {
    // ⭐ Prioriser academicClass (classe officielle) sur class (classe physique).
    if (s.academicClass?.name) return s.academicClass.name;
    if (s.class?.name) return s.class.name;
    if (s.academicClassId) { const cls = classes.find((c) => c.id === s.academicClassId); if (cls) return cls.name ?? '—'; }
    if (s.classId) { const cls = classes.find((c) => c.id === s.classId); if (cls) return cls.name ?? '—'; }
    return '—';
  };

  // ⭐ Task 27 : tri par défaut par niveau (Maternelle → Primaire → Secondaire)
  // puis par nom de classe, puis par nom de frais.
  const LEVEL_ORDER: Record<string, number> = {
    'MATERNELLE': 1,
    'PRIMAIRE': 2,
    'SECONDAIRE': 3,
  };
  const levelSortKey = (s: any): number => {
    const code = s.level?.code?.toUpperCase() ?? '';
    for (const [key, val] of Object.entries(LEVEL_ORDER)) {
      if (code.includes(key)) return val;
    }
    return 99; // Niveau inconnu → à la fin
  };

  const sortedStructures = [...structures].sort((a, b) => {
    const lvlA = levelSortKey(a);
    const lvlB = levelSortKey(b);
    if (lvlA !== lvlB) return lvlA - lvlB;
    // Même niveau → tri par nom de classe
    const clsA = classDisplay(a);
    const clsB = classDisplay(b);
    if (clsA !== clsB) return clsA.localeCompare(clsB);
    // Même classe → tri par nom de frais
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  // Helper : nom intelligent du frais
  // Si le frais a une classe (academicClassId ou classId) mais que le nom ne contient pas déjà le nom de la classe,
  // on enrichit le nom avec " — NomClasse" (ex: "Frais de scolarité" → "Frais de scolarité — CE1")
  // Cas d'usage : création groupée où le nom générique a été utilisé pour toutes les classes
  const feeDisplayName = (s: any): string => {
    const baseName = s.name ?? '';
    // ⭐ Prioriser academicClass (classe officielle) sur class (classe physique).
    const classId = s.academicClassId || s.classId;
    if (!classId) return baseName;
    const className = s.academicClass?.name ?? s.class?.name ?? classes.find((c) => c.id === classId)?.name;
    if (!className) return baseName;
    // Si le nom contient déjà le nom de la classe (ex: "Frais de scolarité — CE1"), on garde tel quel
    if (baseName.includes(className)) return baseName;
    // Sinon on enrichit
    return `${baseName} — ${className}`;
  };

  // Helper : libellé du mode d'échéance d'une tranche
  const dueDateTypeLabel = (i: any): string => {
    const t = i.dueDateType ?? 'FIXED';
    if (t === 'AT_ENROLLMENT') return "À l'inscription";
    if (t === 'DAYS_AFTER_ENROLLMENT') return `${i.daysOffset ?? 0} jour(s) après inscription`;
    return 'Date fixe';
  };

  // Helper : description lisible de l'échéance d'une tranche
  const dueDateDescription = (i: any): string => {
    const t = i.dueDateType ?? 'FIXED';
    if (t === 'AT_ENROLLMENT') {
      return 'Sera calculée à l\'inscription de l\'élève';
    }
    if (t === 'DAYS_AFTER_ENROLLMENT') {
      return `${i.daysOffset ?? 0} jour(s) après l'inscription`;
    }
    if (i.dueDate) {
      return new Date(i.dueDate).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
      });
    }
    return '—';
  };

  // Helper : icône selon le mode d'échéance
  const dueDateIcon = (i: any) => {
    const t = i.dueDateType ?? 'FIXED';
    if (t === 'AT_ENROLLMENT') return <Calendar className="w-3.5 h-3.5 text-emerald-600" />;
    if (t === 'DAYS_AFTER_ENROLLMENT') return <CalendarClock className="w-3.5 h-3.5 text-amber-600" />;
    return <Clock className="w-3.5 h-3.5 text-slate-500" />;
  };

  // ⭐ FIX (sept. 2026 — bug « le modal de configuration des frais charge
  //    indéfiniment / délai d'attente dépassé ») :
  //    Le recalcul des comptes élèves tourne désormais EN ARRIÈRE-PLAN côté
  //    backend (réponse immédiate). Pour que l'onglet « Comptes élèves » (page
  //    séparée) rattrape les données une fois le recalcul terminé (~5-10 s),
  //    on invalide le cache GET et on rediffuse l'événement global avec un
  //    petit décalage. Sans cela, un GET effectué pendant le recalcul mettait
  //    des totaux intermédiaires en cache 45 s.
  const scheduleAccountsCatchUp = useCallback(() => {
    [10_000, 25_000].forEach((ms) => {
      setTimeout(() => {
        try {
          invalidateApiCache();
          window.dispatchEvent(new CustomEvent('finance-accounts-changed'));
        } catch {
          /* non bloquant */
        }
      }, ms);
    });
  }, []);

  const handleCreate = async (body: any) => {
    if (!academicYear?.id) return;
    if (saving) return; // anti double-clic
    setSaving(true);
    try {
      // Conversion levelId education_levels → school_levels
      const convertedLevelId = body.levelId ? toSchoolLevelId(body.levelId) : undefined;

      // Cas 1 : création groupée pour plusieurs classes (classIds est un tableau)
      // ⭐ Les classIds sont maintenant des IDs de classes OFFICIELLES (AcademicClass).
      // On envoie academicClassId au lieu de classId.
      if (Array.isArray(body.classIds) && body.classIds.length > 0) {
        const classIds = body.classIds;
        const basePayload: any = {
          academicYearId: academicYear.id,
          name: body.name,
          feeType: body.feeType,
          customFeeTypeLabel: body.customFeeTypeLabel,
          totalAmount: body.totalAmount,
          isInstallment: body.isInstallment,
          isMandatory: body.isMandatory,
          levelId: convertedLevelId,
          installments: body.installments,
        };

        // ⭐ FIX (sept. 2026) : créations PARALLÈLES (au lieu d'une boucle
        //    séquentielle) — la réponse du backend est désormais immédiate
        //    (le recalcul des comptes est passé en arrière-plan), donc autant
        //    créer les N frais d'un coup : de ~N × 30 s de spinner bloqué à
        //    ~1-2 s au total.
        const results = await Promise.allSettled(
          classIds.map((cid: string) =>
            // ⭐ Envoyer academicClassId (classe officielle) au lieu de classId (classe physique).
            financeService.createFeeStructure({ ...basePayload, academicClassId: cid }),
          ),
        );
        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        const failCount = results.length - successCount;
        const lastError = results
          .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
          .map((r) => (r.reason as any)?.message || String(r.reason))
          .pop();
        // ⚠️ Ne pas avaler silencieusement les erreurs — les logger (aide à
        //    diagnostiquer les FK violations, etc.)
        results.forEach((r, i) => {
          if (r.status === 'rejected') console.error('createFeeStructure failed for class', classIds[i], r.reason);
        });

        setModalNewFee(false);
        if (failCount === 0) {
          toast({
            title: 'Configuration réussie',
            description: `${successCount} frais créés avec succès (un par classe sélectionnée). Les comptes élèves concernés sont mis à jour dans quelques secondes.`,
          });
        } else if (successCount === 0) {
          // Échec total — ne pas dire "réussi" dans le titre
          toast({
            title: 'Échec de la configuration',
            description: `Échec sur les ${failCount} classe(s). ${lastError ?? ''}`.trim(),
            variant: 'destructive',
          });
        } else {
          // Échec partiel — "Partiellement réussi" reste approprié
          toast({
            title: 'Configuration partielle',
            description: `${successCount} créés, ${failCount} en échec sur ${classIds.length} classes. ${lastError ?? ''}`.trim(),
            variant: 'destructive',
          });
        }
        await loadStructures();
        // ⭐ Déclencher le rafraîchissement des comptes élèves (recalcul
        //    arrière-plan → rafraîchissement différé pour rattraper les totaux)
        onAccountsChanged?.();
        scheduleAccountsCatchUp();
        return;
      }

      // Cas 2 : création unique (niveau ou classe unique)
      const payload = { ...body, academicYearId: academicYear.id };
      if (payload.levelId) payload.levelId = convertedLevelId;
      delete payload.classIds; // nettoyer au cas où
      await financeService.createFeeStructure(payload);
      setModalNewFee(false);
      toast({ title: 'Succès', description: 'Frais configuré avec succès. Les comptes élèves concernés sont mis à jour dans quelques secondes.' });
      await loadStructures();
      // ⭐ Déclencher le rafraîchissement des comptes élèves (recalcul
      //    arrière-plan → rafraîchissement différé pour rattraper les totaux)
      onAccountsChanged?.();
      scheduleAccountsCatchUp();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (body: any) => {
    if (!editingFee?.id) return;
    if (saving) return; // anti double-clic
    setSaving(true);
    try {
      const payload = { ...body };
      if (payload.levelId) payload.levelId = toSchoolLevelId(payload.levelId);
      // En édition : on prend la 1ère classe du tableau classIds (si présent) pour academicClassId
      // (l'édition reste sur une seule classe à la fois)
      // ⭐ Les classIds sont maintenant des IDs de classes OFFICIELLES (AcademicClass).
      if (Array.isArray(payload.classIds) && payload.classIds.length > 0) {
        payload.academicClassId = payload.classIds[0];
      }
      delete payload.classIds;
      await financeService.updateFeeStructure(editingFee.id, payload);
      setEditingFee(null);
      toast({ title: 'Succès', description: 'Frais modifié avec succès. Les comptes élèves concernés sont mis à jour dans quelques secondes.' });
      await loadStructures();
      // ⭐ Déclencher le rafraîchissement des comptes élèves : immédiat + différé
      //    (le recalcul est désormais en arrière-plan côté backend — quelques secondes)
      onAccountsChanged?.();
      scheduleAccountsCatchUp();
      // ⭐ Aussi dispatch l'événement global (cross-page, au cas où
      //    StudentAccountsContent est sur une route séparée)
      window.dispatchEvent(new CustomEvent('finance-accounts-changed'));
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await financeService.deleteFeeStructure(id);
      // ⭐ FIX 9 sept. 2026 : la suppression déclenche désormais un recalcul
      //    arrière-plan des comptes du périmètre du frais (le fantôme
      //    « +1000 F sur le total dû » venait de l'absence de ce recalcul).
      toast({
        title: 'Succès',
        description: 'Frais supprimé. Les comptes élèves concernés sont mis à jour dans quelques secondes.',
      });
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      await loadStructures();
      scheduleAccountsCatchUp();
      window.dispatchEvent(new CustomEvent('finance-accounts-changed'));
    } catch (error: any) {
      toast({
        title: 'Suppression impossible',
        description: error?.message || 'Ce frais a des paiements liés et ne peut pas être supprimé.',
        variant: 'destructive',
      });
    }
  };

  // ⭐ Task 24 : Suppression multiple
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirmDialog.danger(
      `${selectedIds.size} frais seront supprimés DÉFINITIVEMENT de la base de données.`,
      'Supprimer la sélection'
    );
    if (!ok) return;
    setBulkDeleting(true);
    try {
      const result = await financeService.bulkDeleteFeeStructures(Array.from(selectedIds));
      const deletedCount = result.deleted?.length || 0;
      const blockedCount = result.blocked?.length || 0;
      if (deletedCount > 0 && blockedCount === 0) {
        toast({
          title: 'Succès',
          description: `${deletedCount} frais supprimé(s). Les comptes élèves concernés sont mis à jour dans quelques secondes.`,
        });
      } else if (deletedCount > 0 && blockedCount > 0) {
        toast({
          title: 'Suppression partielle',
          description: `${deletedCount} supprimé(s), ${blockedCount} bloqué(s) (paiements liés).`,
          // ⭐ FIX 9 sept. 2026 : 'default' n'est pas un ToastVariant valide
          // (success|warning|error|info|destructive|loading) → 'warning'.
          variant: 'warning',
        });
      } else if (deletedCount === 0 && blockedCount > 0) {
        toast({
          title: 'Aucune suppression',
          description: `Les ${blockedCount} frais sélectionnés ont des paiements liés et ne peuvent pas être supprimés.`,
          variant: 'destructive',
        });
      }
      setSelectedIds(new Set());
      await loadStructures();
      // ⭐ FIX 9 sept. 2026 : rattraper les comptes après le recalcul arrière-plan
      if (deletedCount > 0) {
        scheduleAccountsCatchUp();
        window.dispatchEvent(new CustomEvent('finance-accounts-changed'));
      }
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedStructures.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedStructures.map(s => s.id)));
    }
  };

  const handleCopyToYear = async () => {
    if (!copyFrom || !copyTo) return;
    try {
      await financeService.copyFeeStructuresToYear({ fromAcademicYearId: copyFrom, toAcademicYearId: copyTo });
      setCopyYearModal(false); setCopyFrom(''); setCopyTo('');
      toast({ title: 'Succès', description: 'Frais copiés.' });
      await loadStructures();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    }
  };

  const feeTypeLabel = (t: string) => FEE_TYPE_LABELS[t] ?? FEE_TYPES.find((f) => f.value === t)?.label ?? t;
  const modalClasses = useMemo(() => [...classes].sort((a, b) => classOrder(a.name) - classOrder(b.name)), [classes]);

  return (
    <>
      {confirmDialog.dialog}
      <div className="space-y-4">
        <ModuleContentArea layout="custom" toolbar={
          <div className="flex items-center justify-end flex-wrap gap-3">
            <div className="flex gap-2">
              <Button onClick={() => setModalNewFee(true)}><Plus className="w-4 h-4 mr-2" />Nouveau frais</Button>
              <Button variant="outline" onClick={() => setCopyYearModal(true)}><Copy className="w-4 h-4 mr-2" />Copier année</Button>
              <Button variant="outline" onClick={() => setModalOverride(true)}><UserCog className="w-4 h-4 mr-2" />Personnalisation</Button>
            </div>
          </div>
        }>
          <div className="mb-4 flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Niveau</Label>
              <Select value={filterLevelId || 'ALL'} onValueChange={(v) => { setFilterLevelId(v === 'ALL' ? '' : v); setFilterClassId(''); }}>
                <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Tous les niveaux" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les niveaux</SelectItem>
                  {levels.map((l) => (<SelectItem key={l.id} value={l.id}>{l.label ?? l.code ?? l.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Classe</Label>
              <Select value={filterClassId || 'ALL'} onValueChange={(v) => setFilterClassId(v === 'ALL' ? '' : v)}>
                <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes les classes</SelectItem>
                  {filteredSortedClasses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Type</Label>
              <Select value={filterFeeType || 'ALL'} onValueChange={(v) => setFilterFeeType(v === 'ALL' ? '' : v)}>
                <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Tous les types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les types</SelectItem>
                  {FEE_TYPES.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ⭐ Task 24 : Barre d'actions pour suppression multiple */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-sm font-semibold text-amber-800">
                {selectedIds.size} sélectionné(s)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs"
                >
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="text-xs"
                >
                  {bulkDeleting ? (
                    <span className="animate-pulse">Suppression…</span>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Supprimer ({selectedIds.size})
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  {/* ⭐ Task 24 : Colonne checkbox pour sélection multiple */}
                  <TableHead className="w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="flex items-center justify-center w-5 h-5"
                      title={selectedIds.size === sortedStructures.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    >
                      {selectedIds.size === sortedStructures.length && sortedStructures.length > 0
                        ? <CheckSquare className="w-4 h-4 text-blue-600" />
                        : <Square className="w-4 h-4 text-slate-400" />}
                    </button>
                  </TableHead>
                  <TableHead>Nom du frais</TableHead><TableHead>Type</TableHead><TableHead>Niveau</TableHead><TableHead>Classe</TableHead>
                  <TableHead className="text-right">Montant</TableHead><TableHead>Tranches</TableHead><TableHead>Oblig.</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (<TableRow><TableCell colSpan={9} className="text-center text-gray-500 py-8">Chargement...</TableCell></TableRow>
                ) : structures.length === 0 ? (<TableRow><TableCell colSpan={9} className="text-center text-gray-500 py-12">
                  <div className="flex flex-col items-center gap-3"><Plus className="w-10 h-10 text-slate-300" /><p>Aucun frais configuré.</p><Button onClick={() => setModalNewFee(true)} size="sm"><Plus className="w-4 h-4 mr-2" />Configurer un frais</Button></div>
                </TableCell></TableRow>
                ) : sortedStructures.map((s) => (
                  <TableRow key={s.id} className={`hover:bg-slate-50 ${selectedIds.has(s.id) ? 'bg-blue-50/40' : ''}`}>
                    {/* ⭐ Task 24 : Checkbox de sélection */}
                    <TableCell className="w-10">
                      <button
                        type="button"
                        onClick={() => toggleSelect(s.id)}
                        className="flex items-center justify-center w-5 h-5"
                      >
                        {selectedIds.has(s.id)
                          ? <CheckSquare className="w-4 h-4 text-blue-600" />
                          : <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{feeDisplayName(s)}</TableCell>
                    <TableCell><Badge variant="outline">{feeTypeLabel(s.feeType)}</Badge></TableCell>
                    <TableCell className="text-sm">{s.levelId ? <strong>{levelDisplay(s)}</strong> : <span className="text-slate-400">Tous</span>}</TableCell>
                    <TableCell className="text-sm">{s.classId ? <strong>{classDisplay(s)}</strong> : <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(s.totalAmount)}</TableCell>
                    <TableCell>
                      {s.isInstallment ? (
                        <div className="space-y-1">
                          {/* Badge cliquable — hover plus clair (pas plus foncé) */}
                          <button
                            type="button"
                            onClick={() => setInstallmentPopoverId(installmentPopoverId === s.id ? null : s.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold cursor-pointer transition-colors hover:bg-blue-100 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            title="Cliquez pour voir les tranches"
                          >
                            {s.structureInstallments?.length || 0} tranche(s)
                            <ChevronDown className={`w-3 h-3 transition-transform ${installmentPopoverId === s.id ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Badges secondaires (info rapide sur les modes) */}
                          <div className="flex gap-1 flex-wrap">
                            {s.structureInstallments?.some((i: any) => i.dueDateType === 'AT_ENROLLMENT') && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0">
                                <Calendar className="w-2.5 h-2.5" />1ère = inscr.
                              </span>
                            )}
                            {s.structureInstallments?.some((i: any) => i.dueDateType === 'DAYS_AFTER_ENROLLMENT') && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0">
                                <CalendarClock className="w-2.5 h-2.5" />Jours après inscr.
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">Non</span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={s.isMandatory ? 'default' : 'outline'}>{s.isMandatory ? 'Obligatoire' : 'Facultatif'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditingFee(s)} title="Modifier"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} title="Supprimer"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        </ModuleContentArea>

        {modalNewFee && <FeeStructureModal academicYearId={academicYear?.id ?? ''} levels={levels} classes={modalClasses} eduToSchoolLevelMap={eduToSchoolLevelMap} saving={saving} onClose={() => setModalNewFee(false)} onSubmit={handleCreate} />}
        {editingFee && <FeeStructureModal academicYearId={academicYear?.id ?? ''} levels={levels} classes={modalClasses} eduToSchoolLevelMap={eduToSchoolLevelMap} feeId={editingFee.id} initialData={editingFee} saving={saving} onClose={() => setEditingFee(null)} onSubmit={handleUpdate} />}
        {modalOverride && <FeeOverrideModal structures={structures} onClose={() => setModalOverride(false)} />}
        {copyYearModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Copier vers nouvelle année</h3>
              <div className="mb-3"><label className="block text-sm font-medium mb-1">Année source</label>
                <Select value={copyFrom || 'NONE'} onValueChange={(v) => setCopyFrom(v === 'NONE' ? '' : v)}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="NONE">— Choisir —</SelectItem>{academicYears.map((y) => (<SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>))}</SelectContent></Select>
              </div>
              <div className="mb-4"><label className="block text-sm font-medium mb-1">Année cible</label>
                <Select value={copyTo || 'NONE'} onValueChange={(v) => setCopyTo(v === 'NONE' ? '' : v)}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="NONE">— Choisir —</SelectItem>{academicYears.map((y) => (<SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>))}</SelectContent></Select>
              </div>
              <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => { setCopyYearModal(false); setCopyFrom(''); setCopyTo(''); }}>Annuler</Button><Button onClick={handleCopyToYear} disabled={!copyFrom || !copyTo || copyFrom === copyTo}>Copier</Button></div>
            </div>
          </div>
        )}

        {/* Hologramme flottant — détails des tranches (au-dessus du tableau, pas dedans) */}
        {installmentPopoverId && (() => {
          const s = structures.find((st) => st.id === installmentPopoverId);
          if (!s) return null;
          return (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
              onClick={() => setInstallmentPopoverId(null)}
              style={{ backdropFilter: 'blur(2px)', background: 'rgba(15, 23, 42, 0.25)' }}
            >
              <div
                ref={popoverRef}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white/95 rounded-2xl shadow-2xl border border-blue-200 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
                style={{ boxShadow: '0 25px 50px -12px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(59, 130, 246, 0.1)' }}
              >
                {/* Header du hologramme — effet glassmorphism */}
                <div className="relative px-5 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white overflow-hidden">
                  {/* Effet de brillance en arrière-plan */}
                  <div className="absolute inset-0 opacity-20" style={{
                    background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
                  }} />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center ring-2 ring-white/30">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold tracking-wide">Tranches de paiement</p>
                        <p className="text-xs text-white/80">
                          {s.structureInstallments?.length || 0} tranche(s) · Total : {formatCurrency(s.totalAmount)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInstallmentPopoverId(null)}
                      className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                      title="Fermer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Nom du frais concerné — enrichi intelligemment avec la classe si manquante */}
                <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Frais</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{feeDisplayName(s)}</p>
                  {s.classId && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Classe : <span className="font-medium text-slate-700">{classDisplay(s)}</span>
                    </p>
                  )}
                </div>

                {/* Liste des tranches */}
                <div className="max-h-[50vh] overflow-y-auto">
                  {[...(s.structureInstallments || [])]
                    .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                    .map((i: any, idx: number) => {
                      const mode = i.dueDateType ?? 'FIXED';
                      const modeBg = mode === 'AT_ENROLLMENT'
                        ? 'bg-emerald-50/70 border-l-emerald-500'
                        : mode === 'DAYS_AFTER_ENROLLMENT'
                          ? 'bg-amber-50/70 border-l-amber-500'
                          : 'bg-slate-50/70 border-l-slate-400';
                      return (
                        <div key={i.id ?? idx} className={`px-5 py-3 border-b border-slate-100 last:border-b-0 border-l-4 ${modeBg}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-700 shadow-sm">
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{i.label}</p>
                                <p className="text-xs text-slate-500">{dueDateTypeLabel(i)}</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-slate-900 whitespace-nowrap">
                              {formatCurrency(i.amount)}
                            </p>
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 pl-9">
                            {dueDateIcon(i)}
                            <span>{dueDateDescription(i)}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Footer du hologramme — somme de contrôle */}
                <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-600">Somme des tranches :</span>
                  <span className="text-sm font-bold text-blue-700">{formatCurrency(s.totalAmount)}</span>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </>
  );
}
