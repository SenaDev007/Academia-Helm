'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, X, User, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getModalMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { financeService } from '@/services/finance.service';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatCurrency } from '@/lib/utils';

export default function FeeOverrideModal({
  structures,
  onClose,
  editingOverride,
}: {
  structures: any[];
  onClose: () => void;
  editingOverride?: any | null;
}) {
  const isEdit = Boolean(editingOverride);
  const [studentId, setStudentId] = useState(editingOverride?.studentId ?? '');
  const [feeStructureId, setFeeStructureId] = useState(editingOverride?.feeStructureId ?? '');
  const [reductionPercent, setReductionPercent] = useState('');
  const [reductionAmount, setReductionAmount] = useState('');
  const [customAmount, setCustomAmount] = useState(editingOverride ? String(editingOverride.customAmount ?? '') : '');
  const [reason, setReason] = useState(editingOverride?.reason ?? '');
  const [students, setStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(
    editingOverride?.student
      ? `${editingOverride.student.lastName || ''} ${editingOverride.student.firstName || ''}`.trim()
      : ''
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  // Sélecteurs cascade niveau → classe → élève (pattern NewPaymentModal)
  const [levels, setLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const { academicYear } = useModuleContext();
  const { shouldReduceMotion } = useMotionBudget();
  const modalMotion = getModalMotion(shouldReduceMotion);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);

  // ⭐ Charge les student-accounts pour l'année académique courante.
  // Pattern identique à NewPaymentModal : filtre par academicYearId (obligatoire),
  // inclut student.studentEnrollments (pour le filtre par classe) + student.matricule
  // (pour la recherche). Ne déclenche que si academicYear.id est disponible.
  //
  // ⭐ FIX: Quand une classe est sélectionnée (selectedClassId), on filtre côté backend
  // via le paramètre classId pour ne charger QUE les élèves de cette classe (au lieu de
  // paginer 50 par 50 côté serveur). On augmente aussi la limite à 9999 pour récupérer
  // TOUS les élèves (au lieu de la limite par défaut de 50 qui empêchait de trouver
  // les élèves en page 2+).
  useEffect(() => {
    if (!academicYear?.id) { setStudents([]); return; }
    const params: any = { academicYearId: academicYear.id, limit: '9999' };
    if (selectedClassId) params.classId = selectedClassId;
    financeService.getStudentAccounts(params)
      .then((d) => setStudents(Array.isArray(d) ? d : d?.data ?? []))
      .catch(() => setStudents([]));
  }, [academicYear?.id, selectedClassId]);

  // Charge les niveaux scolaires activés
  useEffect(() => {
    fetch('/api/school-levels')
      .then((r) => r.json())
      .then((d) => setLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setLevels([]));
  }, []);

  // Charge les classes (toutes — filtrées par niveau côté client)
  // ⭐ FIX 2026-09-09 : classes de l'année du CONTEXTE + rechargement au switch.
  useEffect(() => {
    fetch(`/api/all-classes${academicYear?.id ? `?academicYearId=${academicYear.id}` : ''}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : (d.data ?? []);
        setClasses(list);
      })
      .catch(() => setClasses([]));
  }, [academicYear?.id]);

  // Classes filtrées par niveau sélectionné
  const filteredClasses = useMemo(() => {
    if (!selectedLevelId) return classes;
    const selectedLevel = levels.find((l) => l.id === selectedLevelId);
    const schoolLevelId = selectedLevel?.schoolLevelId || selectedLevelId;
    return classes.filter((c: any) =>
      c.schoolLevelId === schoolLevelId ||
      c.schoolLevel?.code === selectedLevel?.code ||
      c.schoolLevel?.id === schoolLevelId
    );
  }, [classes, selectedLevelId, levels]);

  // Filtrage pour l'autocomplétion (sans limite — on affiche tous les résultats matchés).
  // Combine filtres : niveau + recherche par nom/prénom/matricule.
  // ⚠️ Le filtre par classe est désormais géré côté backend (le useEffect ci-dessus
  // passe classId dans la query), donc on ne refiltre PAS ici par classe — la liste
  // `students` contient déjà uniquement les élèves de la classe sélectionnée.
  // ⚠️ Les student-accounts ont la structure :
  //   { id, studentId, student: { firstName, lastName, matricule, studentEnrollments: [...] } }
  const filteredStudents = useMemo(() => {
    let result = students;

    // Filtre par niveau : on récupère les classIds rattachés au niveau sélectionné,
    // puis on ne garde que les accounts dont l'élève a une inscription dans l'une de ces classes.
    // (Uniquement quand aucune classe n'est sélectionnée — sinon le backend filtre déjà.)
    if (selectedLevelId && !selectedClassId) {
      const selectedLevel = levels.find((l) => l.id === selectedLevelId);
      const schoolLevelId = selectedLevel?.schoolLevelId || selectedLevelId;
      const levelCode = selectedLevel?.code;
      const levelClassIds = new Set(
        classes
          .filter((c: any) =>
            c.schoolLevelId === schoolLevelId ||
            c.schoolLevel?.code === levelCode ||
            c.schoolLevel?.id === schoolLevelId
          )
          .map((c: any) => c.id)
      );
      result = result.filter((a: any) => {
        const enrollments = a.student?.studentEnrollments ?? a.studentEnrollments ?? [];
        return enrollments.some((e: any) => levelClassIds.has(e.classId));
      });
    }

    // Filtre par recherche (nom/prénom/matricule/code étudiant) — uniquement en mode recherche texte
    if (!selectedClassId && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((a: any) => {
        const s = a.student ?? a;
        const name = `${s.lastName || ''} ${s.firstName || ''} ${s.matricule || ''} ${s.studentCode || ''}`.toLowerCase();
        return name.includes(q);
      });
    }

    return result;
  }, [students, selectedLevelId, selectedClassId, searchQuery, levels, classes]);

  // Liste triée par nom de famille — utilisée pour le dropdown <Select> quand une classe
  // est sélectionnée (remplace la recherche texte par une liste déroulante exhaustive).
  const studentsByLastName = useMemo(() => {
    return [...filteredStudents].sort((a: any, b: any) => {
      const sa = a.student ?? a;
      const sb = b.student ?? b;
      return (sa.lastName || '').localeCompare(sb.lastName || '', 'fr', { sensitivity: 'base' });
    });
  }, [filteredStudents]);

  // ⭐ `students` contient maintenant des student-accounts ; on match par `studentId`
  // (l'ID de l'élève, pas celui de l'account) car overrideFeeStructure attend un studentId.
  // On renvoie l'objet `student` imbriqué pour préserver l'API interne (selectedStudent.lastName, etc.).
  const selectedStudent = useMemo(() => {
    const acc = students.find((a: any) => a.studentId === studentId);
    return acc?.student ?? null;
  }, [students, studentId]);
  const selectedFee = structures.find((s) => s.id === feeStructureId);
  // En mode édition, utiliser le feeStructure de l'override comme fallback
  // (structures peut ne pas être encore chargé au montage du modal)
  const effectiveFee = selectedFee ?? editingOverride?.feeStructure;
  const originalAmount = effectiveFee ? Number(effectiveFee.totalAmount) : 0;

  // Helper : nom intelligent du frais (enrichi avec la classe si manquante)
  // Affichage identique au tableau de configuration : "Frais de scolarité — CI — 40000 FCFA"
  // ⭐ FIX nov. 2026 : prioriser academicClass (classe officielle — utilisée par les
  //    écoles comme CSP Mon Avenir Plus) sur class (classe physique), avec fallback
  //    sur la liste locale `classes`. Avant, un frais rattaché à une classe officielle
  //    s'affichait "Frais de scolarité — montant" SANS le nom de la classe → impossible
  //    de distinguer deux frais homonymes de classes différentes.
  const feeDisplayName = (s: any): string => {
    const baseName = s.name ?? '';
    const classId = s.academicClassId || s.classId;
    if (!classId) return baseName;
    const className =
      s.academicClass?.name ??
      s.class?.name ??
      classes.find((c: any) => c.id === classId)?.name;
    if (!className) return baseName;
    if (baseName.includes(className)) return baseName;
    return `${baseName} — ${className}`;
  };

  // ⭐ FIX nov. 2026 : frais triés par nom de classe puis par nom — les frais de
  //    classes différentes (ex: "Frais de scolarité CP/CE1/CE2") se regroupent
  //    visuellement dans le sélecteur au lieu d'être mélangés.
  const sortedStructures = useMemo(() => {
    const classNameOf = (s: any): string =>
      s.academicClass?.name ??
      s.class?.name ??
      classes.find((c: any) => c.id === (s.academicClassId || s.classId))?.name ??
      '';
    return [...structures].sort((a: any, b: any) => {
      const clsA = classNameOf(a);
      const clsB = classNameOf(b);
      if (clsA !== clsB) return clsA.localeCompare(clsB, 'fr', { sensitivity: 'base' });
      return (a.name ?? '').localeCompare(b.name ?? '', 'fr');
    });
  }, [structures, classes]);

  // Fermer les suggestions au clic en dehors
  useEffect(() => {
    if (!showSuggestions) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSuggestions]);

  // Pré-remplir les champs de réduction en mode édition
  // quand originalAmount devient disponible (après chargement de structures ou fallback)
  useEffect(() => {
    if (!isEdit || !editingOverride || originalAmount <= 0) return;
    const custom = Number(editingOverride.customAmount ?? 0);
    const reduction = Math.max(0, originalAmount - custom);
    const pct = originalAmount > 0 ? (reduction / originalAmount) * 100 : 0;
    // Ne pré-remplir qu'une seule fois (quand les champs sont vides)
    setReductionAmount((prev) => prev === '' ? reduction.toFixed(0) : prev);
    setReductionPercent((prev) => prev === '' ? pct.toFixed(2) : prev);
  }, [isEdit, editingOverride, originalAmount]);

  // Sélection d'un élève depuis les suggestions.
  // `a` est un student-account ; on stocke `a.studentId` (l'ID de l'élève) dans `studentId`.
  const selectStudent = (a: any) => {
    setStudentId(a.studentId);
    const s = a.student ?? a;
    setSearchQuery(`${s.lastName || ''} ${s.firstName || ''}`.trim());
    setShowSuggestions(false);
  };

  // Handler : changement de frais concerné → reset des réductions
  const handleFeeStructureChange = (id: string) => {
    setFeeStructureId(id);
    setReductionPercent('');
    setReductionAmount('');
    setCustomAmount('');
  };

  // Handler : réduction en pourcentage
  // Calcule automatiquement le montant de la réduction et le montant personnalisé final
  const handleReductionPercentChange = (v: string) => {
    setReductionPercent(v);
    if (originalAmount <= 0) return;
    const pct = parseFloat(v);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setReductionAmount('');
      setCustomAmount(originalAmount.toFixed(0));
      return;
    }
    const reduction = (originalAmount * pct) / 100;
    setReductionAmount(reduction.toFixed(0));
    const final = Math.max(0, originalAmount - reduction);
    setCustomAmount(final.toFixed(0));
  };

  // Handler : réduction en montant
  // Calcule automatiquement le montant personnalisé final (initial − réduction)
  const handleReductionAmountChange = (v: string) => {
    setReductionAmount(v);
    setReductionPercent(''); // clear percent when user types amount directly
    if (originalAmount <= 0) return;
    const amt = parseFloat(v);
    if (isNaN(amt) || amt < 0) {
      setCustomAmount(originalAmount.toFixed(0));
      return;
    }
    const final = Math.max(0, originalAmount - amt);
    setCustomAmount(final.toFixed(0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(customAmount);
    if (!studentId || !feeStructureId || isNaN(amount) || !reason.trim()) return;
    setLoading(true);
    try {
      if (isEdit && editingOverride) {
        // Mode édition : appeler updateFeeOverride
        await financeService.updateFeeOverride(editingOverride.id, {
          customAmount: amount,
          reason: reason.trim(),
        });
      } else {
        // Mode création : appeler overrideFeeStructure
        await financeService.overrideFeeStructure({
          studentId,
          feeStructureId,
          customAmount: amount,
          reason: reason.trim(),
        });
      }
      onClose();
    } catch (error: any) {
      alert(error?.message || 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
      <motion.div
        initial={modalMotion.initial}
        animate={modalMotion.animate}
        transition={modalMotion.transition}
        className="bg-white rounded-xl p-6 max-w-lg w-full border border-blue-100 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {isEdit ? 'Modifier la personnalisation' : 'Personnalisation élève'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sélecteurs cascade : Niveau scolaire → Classe (filtre les élèves ci-dessous) */}
          {!isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Niveau scolaire</Label>
                <Select value={selectedLevelId || 'ALL'} onValueChange={(v) => {
                  setSelectedLevelId(v === 'ALL' ? '' : v);
                  setSelectedClassId('');
                  setStudentId('');
                }}>
                  <SelectTrigger><SelectValue placeholder="Tous les niveaux" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les niveaux</SelectItem>
                    {levels.map((l) => (<SelectItem key={l.id} value={l.id}>{l.label ?? l.code ?? l.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Classe</Label>
                <Select value={selectedClassId || 'ALL'} onValueChange={(v) => {
                  setSelectedClassId(v === 'ALL' ? '' : v);
                  setStudentId('');
                }}>
                  <SelectTrigger><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes les classes</SelectItem>
                    {filteredClasses.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Recherche d'élève avec autocomplétion — input + dropdown de suggestions */}
          <div>
            <Label>Rechercher un élève</Label>
            {isEdit ? (
              // Mode édition : élève verrouillé (affichage lecture seule)
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700">
                {editingOverride?.student
                  ? `${editingOverride.student.lastName || ''} ${editingOverride.student.firstName || ''}`.trim()
                  : '—'}
                {editingOverride?.student?.matricule
                  ? ` (${editingOverride.student.matricule})`
                  : ''}
              </div>
            ) : selectedClassId ? (
              // ⭐ FIX: Quand une classe est sélectionnée, on affiche un <Select> listant
              // TOUS les élèves de la classe (récupérés côté backend via classId), triés par
              // nom de famille. Cela évite le bug de pagination (50 élèves/page) qui empêchait
              // de trouver les élèves au-delà de la page 1.
              <Select
                value={studentId}
                onValueChange={(v) => {
                  const acc = students.find((a: any) => a.studentId === v);
                  if (acc) selectStudent(acc);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={studentsByLastName.length === 0 ? 'Aucun élève dans cette classe' : 'Sélectionner un élève'} />
                </SelectTrigger>
                <SelectContent>
                  {studentsByLastName.map((a: any) => {
                    const s = a.student ?? a;
                    const label = `${s.lastName || ''} ${s.firstName || ''}`.trim();
                    const matricule = s.matricule ? ` (${s.matricule})` : s.studentCode ? ` (${s.studentCode})` : '';
                    return (
                      <SelectItem key={a.id ?? a.studentId} value={a.studentId}>
                        {label}{matricule}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <div className="relative" ref={suggestionsRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                    setStudentId(''); // reset si on tape à nouveau
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Tapez un nom, prénom ou matricule..."
                  className="pl-10"
                  autoComplete="off"
                />
              {/* Dropdown d'autocomplétion — cliquer pour sélectionner directement */}
              {showSuggestions && searchQuery.trim() && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-slate-500 text-center">
                      Aucun élève trouvé pour « {searchQuery} »
                    </p>
                  ) : (
                    filteredStudents.map((a) => {
                      const s = a.student ?? a;
                      return (
                        <button
                          key={a.id ?? a.studentId}
                          type="button"
                          onClick={() => selectStudent(a)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors flex items-center gap-2"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {s.lastName || ''} {s.firstName || ''}
                            </p>
                            <p className="text-xs text-slate-500">
                              {s.matricule ? `Matricule: ${s.matricule}` : s.studentCode ? `Code: ${s.studentCode}` : '—'}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            )}
            {selectedStudent && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                ✓ Élève sélectionné : <span className="font-semibold">{selectedStudent.lastName} {selectedStudent.firstName}</span>
                {selectedStudent.matricule ? ` (${selectedStudent.matricule})` : ''}
              </p>
            )}
          </div>

          {/* Frais concerné — affichage enrichi avec classe + montant */}
          <div>
            <Label>Frais concerné</Label>
            {isEdit ? (
              // Mode édition : frais verrouillé (affichage lecture seule)
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700">
                {selectedFee ? feeDisplayName(selectedFee) : '—'}
              </div>
            ) : (
              <Select value={feeStructureId} onValueChange={handleFeeStructureChange}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un frais" /></SelectTrigger>
                <SelectContent>
                  {sortedStructures.filter((f: any) => f.isActive).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                    {feeDisplayName(s)} — {formatCurrency(Number(s.totalAmount))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            )}
            {selectedFee && (
              <p className="text-xs text-slate-500 mt-1">
                Montant initial : <span className="font-semibold text-slate-700">{formatCurrency(originalAmount)}</span>
              </p>
            )}
          </div>

          {/* Section réduction : % OU montant → calcul auto du montant personnalisé */}
          {selectedFee && (
            <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600" />
                <Label className="text-sm font-semibold m-0">Réduction</Label>
              </div>
              <p className="text-xs text-slate-500 -mt-1">
                Choisissez le mode de réduction : pourcentage ou montant. Le montant personnalisé est calculé automatiquement.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Réduction (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={reductionPercent}
                    onChange={(e) => handleReductionPercentChange(e.target.value)}
                    placeholder="Ex: 10"
                  />
                </div>
                <div>
                  <Label className="text-xs">Réduction (XOF)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={reductionAmount}
                    onChange={(e) => handleReductionAmountChange(e.target.value)}
                    placeholder="Ex: 5000"
                  />
                </div>
              </div>
              {/* Récapitulatif visuel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-500 block">Initial</span>
                  <p className="font-semibold text-slate-700">{formatCurrency(originalAmount)}</p>
                </div>
                <div>
                  <span className="text-slate-500 block">Réduction</span>
                  <p className="font-semibold text-rose-600">
                    −{formatCurrency(parseFloat(reductionAmount) || 0)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 block">À payer</span>
                  <p className="font-bold text-emerald-700">{formatCurrency(parseFloat(customAmount) || 0)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Montant personnalisé (auto-calculé, read-only) */}
          <div>
            <Label>Montant personnalisé (XOF)</Label>
            <Input
              type="number"
              min={0}
              value={customAmount}
              readOnly
              className="bg-blue-50 font-semibold cursor-not-allowed border-blue-200"
              placeholder="Sélectionnez un frais et appliquez une réduction"
            />
            <p className="text-xs text-blue-600 mt-1">
              💡 Ce montant est calculé automatiquement : Montant initial − Réduction.
            </p>
          </div>

          <div>
            <Label>Motif (obligatoire)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: réduction cas social, bourse..."
              required
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading || !customAmount}>
              {loading ? 'Envoi...' : isEdit ? 'Enregistrer les modifications' : 'Valider la personnalisation'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
