#!/usr/bin/env python3
"""Refactor LoginPage.tsx for dynamic school levels + classes + targetClass rename."""

from pathlib import Path

FILE = Path('/home/z/my-project/apps/web-app/src/components/auth/LoginPage.tsx')
content = FILE.read_text()

# ============================================================
# 1. Replace hardcoded cards block with dynamic school levels
# ============================================================
old_cards = """                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { type: 'MATERNELLE' as const, label: 'Maternelle', Icon: Baby, desc: 'M1 – M2' },
                          { type: 'PRIMARY' as const, label: 'Primaire', Icon: BookOpen, desc: 'CI – CM2' },
                          { type: 'SECONDARY' as const, label: 'Secondaire', Icon: GradCap, desc: '6ème – Tle' },
                          { type: 'PROSPECT_PARENT' as const, label: 'Juste info', Icon: Users, desc: 'Parent prospect' },
                        ]).map((opt) => (
                          <button
                            key={opt.type}
                            type="button"
                            onClick={() => {
                              setPreEnrollment((prev) => ({ ...prev, candidateType: opt.type, targetLevel: '' }));
                              // Reset du wizard à l'étape 1 quand on change de type de candidat
                              setPreEnrollmentStep(1);
                              setError(null);
                            }}
                            className="flex flex-col items-center gap-1 rounded-xl border-2 p-3 min-h-[44px] text-center transition-all"
                            style={{
                              borderColor: preEnrollment.candidateType === opt.type ? GOLD : `${NAVY}18`,
                              background: preEnrollment.candidateType === opt.type ? `${GOLD}12` : `${NAVY}04`,
                            }}
                          >
                            <opt.Icon className="h-5 w-5" style={{ color: NAVY }} />
                            <span className="text-xs font-bold" style={{ color: NAVY }}>{opt.label}</span>
                            <span className="text-[10px] text-slate-500">{opt.desc}</span>
                          </button>
                        ))}
                      </div>"""

new_cards = """                      <div className="grid grid-cols-2 gap-2">
                        {schoolInfoLoading ? (
                          <div className="col-span-2 text-center py-3 text-xs text-slate-400">
                            Chargement des niveaux...
                          </div>
                        ) : schoolLevels.length === 0 ? (
                          <div className="col-span-2 text-center py-3 text-xs text-amber-600 bg-amber-50 rounded-lg">
                            Aucun niveau scolaire configuré pour cet établissement.
                            Contactez l'administration.
                          </div>
                        ) : (
                          <>
                            {schoolLevels.map((level) => {
                              // Icône selon le nom du niveau (best-effort)
                              const levelName = (level.name || '').toUpperCase();
                              const Icon = levelName.includes('MATERNELLE') ? Baby
                                : levelName.includes('PRIMAIRE') ? BookOpen
                                : levelName.includes('SECONDAIRE') ? GradCap
                                : BookOpen;
                              // Description : nombre de classes disponibles pour ce niveau
                              const classCount = schoolClasses.filter(c => c.schoolLevelId === level.id).length;
                              const desc = classCount > 0
                                ? `${classCount} classe${classCount > 1 ? 's' : ''}`
                                : 'Aucune classe';
                              return (
                                <button
                                  key={level.id}
                                  type="button"
                                  onClick={() => {
                                    setPreEnrollment((prev) => ({ ...prev, candidateType: level.id, targetClass: '' }));
                                    setPreEnrollmentStep(1);
                                    setError(null);
                                  }}
                                  className="flex flex-col items-center gap-1 rounded-xl border-2 p-3 min-h-[44px] text-center transition-all"
                                  style={{
                                    borderColor: preEnrollment.candidateType === level.id ? GOLD : `${NAVY}18`,
                                    background: preEnrollment.candidateType === level.id ? `${GOLD}12` : `${NAVY}04`,
                                  }}
                                >
                                  <Icon className="h-5 w-5" style={{ color: NAVY }} />
                                  <span className="text-xs font-bold" style={{ color: NAVY }}>{level.name}</span>
                                  <span className="text-[10px] text-slate-500">{desc}</span>
                                </button>
                              );
                            })}
                            {/* Carte "Juste info" — toujours présente (parent prospect) */}
                            <button
                              type="button"
                              onClick={() => {
                                setPreEnrollment((prev) => ({ ...prev, candidateType: 'PROSPECT_PARENT', targetClass: '' }));
                                setPreEnrollmentStep(1);
                                setError(null);
                              }}
                              className="flex flex-col items-center gap-1 rounded-xl border-2 p-3 min-h-[44px] text-center transition-all"
                              style={{
                                borderColor: preEnrollment.candidateType === 'PROSPECT_PARENT' ? GOLD : `${NAVY}18`,
                                background: preEnrollment.candidateType === 'PROSPECT_PARENT' ? `${GOLD}12` : `${NAVY}04`,
                              }}
                            >
                              <Users className="h-5 w-5" style={{ color: NAVY }} />
                              <span className="text-xs font-bold" style={{ color: NAVY }}>Juste info</span>
                              <span className="text-[10px] text-slate-500">Parent prospect</span>
                            </button>
                          </>
                        )}
                      </div>"""

assert old_cards in content, "Could not find old cards block"
content = content.replace(old_cards, new_cards)
print("[1] Cards block replaced")

# ============================================================
# 2. Replace getLevelsForCandidateType with getClassesForCandidateType
# ============================================================
old_func = """  const getLevelsForCandidateType = (type: PublicCandidateType): string[] => {
    switch (type) {
      case 'MATERNELLE':
        return ['Maternelle 1 (M1)', 'Maternelle 2 (M2)'];
      case 'PRIMARY':
        return ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
      case 'SECONDARY':
        return ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'];
      default:
        return [];
    }
  };"""

new_func = """  // Renvoie les classes disponibles pour un type de candidat (= schoolLevelId).
  // Plus de hardcoding : les classes sont fetchées depuis le backend au mount
  // du composant et filtrées par schoolLevelId ici.
  const getClassesForCandidateType = (type: PublicCandidateType): ClassInfo[] => {
    if (type === 'PROSPECT_PARENT') return [];
    return schoolClasses.filter(c => c.schoolLevelId === type);
  };"""

assert old_func in content, "Could not find getLevelsForCandidateType"
content = content.replace(old_func, new_func)
print("[2] getLevelsForCandidateType → getClassesForCandidateType")

# ============================================================
# 3. Replace the "Classe souhaitée" select block
# ============================================================
old_select = """                        {/* Classe souhaitée (ex "Niveau souhaité") */}
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-900">
                            Classe souhaitée
                          </label>
                          <select
                            required
                            value={preEnrollment.targetLevel}
                            onChange={(e) => setPreEnrollment((prev) => ({ ...prev, targetLevel: e.target.value }))}
                            className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all focus:ring-2"
                            style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          >
                            <option value="">— Sélectionner —</option>
                            {getLevelsForCandidateType(preEnrollment.candidateType).map((level) => (
                              <option key={level} value={level}>{level}</option>
                            ))}
                          </select>
                        </div>"""

new_select = """                        {/* Classe souhaitée — select dynamique alimenté par les classes
                            configurées dans le module Paramètres pour le niveau sélectionné. */}
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-900">
                            Classe souhaitée
                          </label>
                          <select
                            required
                            value={preEnrollment.targetClass}
                            onChange={(e) => setPreEnrollment((prev) => ({ ...prev, targetClass: e.target.value }))}
                            disabled={preEnrollment.candidateType === 'PROSPECT_PARENT'}
                            className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 min-h-[44px] text-sm transition-all focus:ring-2 disabled:bg-slate-100 disabled:text-slate-400"
                            style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          >
                            <option value="">— Sélectionner —</option>
                            {getClassesForCandidateType(preEnrollment.candidateType).map((cls) => (
                              <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                          </select>
                          {preEnrollment.candidateType !== 'PROSPECT_PARENT'
                            && getClassesForCandidateType(preEnrollment.candidateType).length === 0 && (
                            <p className="mt-1 text-[10px] text-amber-600">
                              Aucune classe configurée pour ce niveau. Contactez l'administration.
                            </p>
                          )}
                        </div>"""

assert old_select in content, "Could not find select block"
content = content.replace(old_select, new_select)
print("[3] Select block replaced")

# ============================================================
# 4. Update payload submission (targetLevel → targetClass)
# ============================================================
old_payload = """      // targetLevel = label de classe choisi par le parent (ex: "CI", "6ème", "M1")
      // Le backend applyAdmission() le résout vers un UUID de classe (requestedClassId)
      // via un matching souple (exact, code, startsWith, includes).
      // Si la résolution échoue, l'élève sera orphelin et affectation manuelle requise.
      targetLevel: preEnrollment.targetLevel || undefined,"""

new_payload = """      // targetClass = UUID de la classe choisie par le parent (depuis le select
      // dynamique alimenté par /api/public/school-info). Le backend l'utilise
      // directement comme requestedClassId — pas de matching à faire.
      targetClass: preEnrollment.targetClass || undefined,"""

assert old_payload in content, "Could not find payload targetLevel"
content = content.replace(old_payload, new_payload)
print("[4] Payload targetLevel → targetClass")

# ============================================================
# 5. Update message composition (targetLevel → targetClass)
# ============================================================
old_msg = """      // Message + targetLevel (classe souhaitée libre) → notes
      message: [
        preEnrollment.targetLevel ? `Classe souhaitée : ${preEnrollment.targetLevel}` : null,
        preEnrollment.message,
      ].filter(Boolean).join('\\n\\n') || undefined,"""

new_msg = """      // Message + nom de la classe choisie → notes (pour référence humaine)
      // On récupère le nom lisible de la classe depuis schoolClasses
      const targetClassName = schoolClasses.find(c => c.id === preEnrollment.targetClass)?.name;
      message: [
        targetClassName ? `Classe souhaitée : ${targetClassName}` : null,
        preEnrollment.message,
      ].filter(Boolean).join('\\n\\n') || undefined,"""

# Note: the original message might use \\n\\n literally — need to handle both
if old_msg in content:
    content = content.replace(old_msg, new_msg)
    print("[5a] Message block (with newlines) replaced")
else:
    # Try without escaped newlines
    old_msg2 = old_msg.replace("\\n\\n", "\n\n")
    new_msg2 = new_msg.replace("\\n\\n", "\n\n")
    if old_msg2 in content:
        content = content.replace(old_msg2, new_msg2)
        print("[5b] Message block (literal newlines) replaced")
    else:
        print("[5] WARNING: could not find message block")

# ============================================================
# 6. Update validation (targetLevel → targetClass)
# ============================================================
old_validation = "if (!preEnrollment.targetLevel) return 'Veuillez sélectionner la classe souhaitée.';"
new_validation = "if (!preEnrollment.targetClass && preEnrollment.candidateType !== 'PROSPECT_PARENT') return 'Veuillez sélectionner la classe souhaitée.';"

if old_validation in content:
    content = content.replace(old_validation, new_validation)
    print("[6] Validation updated")
else:
    print("[6] WARNING: validation not found")

FILE.write_text(content)
print(f"\nDone. New file size: {len(content)} chars")
