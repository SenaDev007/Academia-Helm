'use client';

import { useState, useEffect } from 'react';
import { User, MapPin, GraduationCap, Users, Shield, BookOpen, Globe, School, Save, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import PhoneInput from '@/components/ui/phone-input';

interface AdmissionFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
}

export default function AdmissionForm({ initialData, onSubmit }: AdmissionFormProps) {
  const { academicYear, schoolLevel, tenantId } = useModuleContext();
  const [levels, setLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [isLoadingLevels, setIsLoadingLevels] = useState(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    academicYearId: academicYear?.id || '',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    gender: initialData?.gender || '',
    birthDate: initialData?.birthDate ? new Date(initialData.birthDate).toISOString().split('T')[0] : '',
    birthPlace: initialData?.birthPlace || '',
    nationality: initialData?.nationality || 'Béninoise',
    address: initialData?.address || '',
    requestedLevelId: initialData?.requestedLevelId || schoolLevel?.id || '',
    requestedClassId: initialData?.requestedClassId || '',
    requestedSeriesId: initialData?.requestedSeriesId || '',
    wantsBilingual: initialData?.wantsBilingual || false,
    previousSchool: initialData?.previousSchool || '',
    previousLevel: initialData?.previousLevel || '',
    changeReason: initialData?.changeReason || '',
    mainGuardianName: initialData?.mainGuardianName || '',
    mainGuardianPhone: initialData?.mainGuardianPhone || '',
    mainGuardianEmail: initialData?.mainGuardianEmail || '',
    mainGuardianRelationship: initialData?.mainGuardianRelationship || 'PÈRE',
    mainGuardianAddress: initialData?.mainGuardianAddress || '',
    mainGuardianProfession: initialData?.mainGuardianProfession || '',
  });

  useEffect(() => {
    loadLevels();
  }, []);

  useEffect(() => {
    if (formData.requestedLevelId && levels.length > 0) {
      loadClasses(formData.requestedLevelId);
      loadSeries(formData.requestedLevelId);
    }
  }, [formData.requestedLevelId, levels]);

  const loadLevels = async () => {
    setIsLoadingLevels(true);
    try {
      // ⚠️ IMPORTANT : l'URL correcte est /api/school-levels (pas /api/settings/school-levels).
      // /api/school-levels récupère les niveaux depuis EducationStructureService
      // (Paramètres > Structure pédagogique) et les retourne au format
      // { id, code, label, isActive }.
      const res = await fetch('/api/school-levels', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLevels(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to load school levels:', e);
    } finally {
      setIsLoadingLevels(false);
    }
  };

  const loadClasses = async (levelId: string) => {
    setIsLoadingClasses(true);
    try {
      // ⚠️ On utilise /api/classes avec schoolLevelId=ALL pour récupérer TOUTES
      // les classes du tenant (table Class, pas AcademicClass qui n'existe pas).
      // Puis on filtre côté client par schoolLevelId.
      //
      // Avant on utilisait /api/pedagogy/academic-structure/classes mais la table
      // academic_classes n'existe pas en production → l'endpoint retournait []
      // → le select de classe était vide en édition.
      //
      // schoolLevelId=ALL est crucial : sinon l'API filtre par le schoolLevelId
      // du header x-school-level-id (contexte admin), et les classes d'autres
      // niveaux ne sont pas retournées.
      const res = await fetch(
        '/api/classes?limit=100&schoolLevelId=ALL',
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        const allClasses = Array.isArray(data) ? data : [];
        console.log('[AdmissionForm] Loaded classes:', allClasses.length, allClasses.map(c => ({ id: c.id?.substring(0, 8), name: c.name })));
        // Filtrer côté client par le schoolLevelId sélectionné.
        // Les classes retournées ont un champ schoolLevelId (UUID de school_levels).
        // levelId ici est aussi un UUID de education_levels (le select du formulaire
        // utilise les education_levels). On doit donc faire un matching par nom.
        const selectedLevel = levels.find(l => l.id === levelId);
        const levelCode = selectedLevel?.code?.toUpperCase() || '';
        const levelName = selectedLevel?.name?.toUpperCase() || '';
        const filtered = allClasses.filter((c: any) => {
          // c.schoolLevel est inclus (relation), avec un champ name
          const classLevelName = (c.schoolLevel?.name || '').toUpperCase();
          const classLevelCode = (c.schoolLevel?.code || '').toUpperCase();
          // Match par nom ou code : MATERNELLE matche MATERNELLE, etc.
          if (!levelCode && !levelName) return true; // pas de filtre si pas de niveau sélectionné
          return classLevelName === levelName ||
                 classLevelCode === levelCode ||
                 classLevelName.includes(levelCode) ||
                 levelCode.includes(classLevelName);
        });
        setClasses(filtered);
      }
    } catch (e) {
      console.error('Failed to load classes:', e);
      setClasses([]);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  const loadSeries = async (levelId: string) => {
    try {
      const res = await fetch(`/api/education-series?levelId=${levelId}`);
      if (res.ok) {
        const data = await res.json();
        setSeries(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      // Les séries sont optionnelles (n'existent que pour le Secondaire)
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation basique
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      return;
    }
    if (!formData.requestedLevelId) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Construire l'objet à envoyer au backend
      // schoolLevelId = requestedLevelId (le niveau souhaité EST le niveau scolaire)
      const payload = {
        academicYearId: formData.academicYearId,
        schoolLevelId: formData.requestedLevelId,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        gender: formData.gender || undefined,
        dateOfBirth: formData.birthDate || undefined,
        birthPlace: formData.birthPlace || undefined,
        nationality: formData.nationality || undefined,
        address: formData.address || undefined,
        requestedClassId: formData.requestedClassId || undefined,
        requestedSeriesId: formData.requestedSeriesId || undefined,
        wantsBilingual: formData.wantsBilingual,
        previousSchool: formData.previousSchool || undefined,
        previousLevel: formData.previousLevel || undefined,
        changeReason: formData.changeReason || undefined,
        mainGuardianName: formData.mainGuardianName || undefined,
        mainGuardianPhone: formData.mainGuardianPhone || undefined,
        mainGuardianEmail: formData.mainGuardianEmail || undefined,
        mainGuardianRelationship: formData.mainGuardianRelationship || undefined,
        mainGuardianAddress: formData.mainGuardianAddress || undefined,
        mainGuardianProfession: formData.mainGuardianProfession || undefined,
      };

      await onSubmit(payload);
    } catch (e: any) {
      console.error('AdmissionForm submit error:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 py-2">
      {/* Section 1: Identité */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="p-1.5 bg-blue-50 rounded-lg">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Identité du Candidat</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Nom *</label>
            <input
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              placeholder="Ex: KOFFI"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Prénom(s) *</label>
            <input
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              placeholder="Ex: Jean-Marie"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Sexe</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
            >
              <option value="">Sélectionner</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Date de Naissance</label>
            <input
              type="date"
              name="birthDate"
              value={formData.birthDate}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Lieu de Naissance</label>
            <input
              name="birthPlace"
              value={formData.birthPlace}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              placeholder="Ex: Cotonou"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Nationalité</label>
            <input
              name="nationality"
              value={formData.nationality}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              placeholder="Ex: Béninoise"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Adresse</label>
            <input
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              placeholder="Ex: Cotonou, Quartier Akpakpa"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Voeux Académiques */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="p-1.5 bg-indigo-50 rounded-lg">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Vœux Académiques</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Niveau Souhaité *</label>
            <select
              name="requestedLevelId"
              value={formData.requestedLevelId}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              required
            >
              <option value="">Sélectionner un niveau</option>
              {levels.map(l => (
                <option key={l.id} value={l.id}>{l.label || l.code}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Classe Souhaitée (Optionnel)</label>
            <select
              name="requestedClassId"
              value={formData.requestedClassId}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
            >
              <option value="">Aucune préférence</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.code}</option>
              ))}
              {/* Fallback : si requestedClassId (depuis initialData) n'est pas dans
                  la liste chargée (ex: classe supprimée, ou level filter mismatch),
                  on l'ajoute manuellement pour qu'il soit visible dans le select. */}
              {formData.requestedClassId &&
                !classes.some(c => c.id === formData.requestedClassId) && (
                <option value={formData.requestedClassId}>
                  Classe {formData.requestedClassId.substring(0, 8)}… ( hors liste)
                </option>
              )}
            </select>
          </div>
        </div>

        {series.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Série Souhaitée (Optionnel)</label>
            <select
              name="requestedSeriesId"
              value={formData.requestedSeriesId}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
            >
              <option value="">Aucune préférence</option>
              {series.map(s => (
                <option key={s.id} value={s.id}>{s.name || s.code}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Établissement Précédent</label>
            <input
              name="previousSchool"
              value={formData.previousSchool}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              placeholder="Ex: École Primaire Publique de Cotonou"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Dernier Niveau Fréquenté</label>
            <input
              name="previousLevel"
              value={formData.previousLevel}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              placeholder="Ex: CE1, 5ème, Maternelle 2..."
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase">Motif de Changement (Optionnel)</label>
          <input
            name="changeReason"
            value={formData.changeReason}
            onChange={handleInputChange}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
            placeholder="Ex: Déménagement, recherche de meilleure qualité pédagogique..."
          />
        </div>

        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <input
            type="checkbox"
            id="wantsBilingual"
            name="wantsBilingual"
            checked={formData.wantsBilingual}
            onChange={handleInputChange}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="wantsBilingual" className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-400" />
            Candidature pour le cursus bilingue (Français/Anglais)
          </label>
        </div>
      </div>

      {/* Section 3: Responsable Légal */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="p-1.5 bg-amber-50 rounded-lg">
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Responsable Légal Principal</h3>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Nom complet du responsable</label>
              <input
                name="mainGuardianName"
                value={formData.mainGuardianName}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                placeholder="Ex: M. KOFFI Emmanuel"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Lien de parenté</label>
              <select
                name="mainGuardianRelationship"
                value={formData.mainGuardianRelationship}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              >
                <option value="PÈRE">Père</option>
                <option value="MÈRE">Mère</option>
                <option value="TUTEUR">Tuteur légal</option>
                <option value="ONCLE">Oncle</option>
                <option value="TANTE">Tante</option>
                <option value="GRAND-PARENT">Grand-parent</option>
                <option value="FRÈRE/SŒUR">Frère / Sœur</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Téléphone</label>
              <PhoneInput
                value={formData.mainGuardianPhone}
                onChange={(value) => setFormData(prev => ({ ...prev, mainGuardianPhone: value }))}
                name="mainGuardianPhone"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">E-mail</label>
              <input
                type="email"
                name="mainGuardianEmail"
                value={formData.mainGuardianEmail}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                placeholder="Ex: emmanuel.koffi@email.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Adresse du Responsable</label>
              <input
                name="mainGuardianAddress"
                value={formData.mainGuardianAddress}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                placeholder="Ex: Cotonou, Quartier Akpakpa"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Profession</label>
              <input
                name="mainGuardianProfession"
                value={formData.mainGuardianProfession}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                placeholder="Ex: Comptable, Enseignant, Commerçant..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hidden field for academic year */}
      <input type="hidden" name="academicYearId" value={formData.academicYearId} />

      {/* Submit button — VISIBLE et fonctionnel */}
      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-md transition-all"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</>
          ) : (
            <><Save className="w-4 h-4" /> Enregistrer le dossier</>
          )}
        </button>
      </div>
    </form>
  );
}
