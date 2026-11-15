/**
 * ============================================================================
 * STUDENT ENROLLMENT FORM - Formulaire d'inscription d'élève
 * ============================================================================
 *
 * Nouveau formulaire basé sur le pattern AdmissionForm.tsx qui fonctionne.
 * Utilise useModuleContext() + fetch() direct (pas de financeService).
 *
 * 4 étapes : Identité → Parents → Classe → Validation
 * ============================================================================
 */
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  CheckCircle, AlertCircle, BookOpen, Loader2, Camera, Upload, X, RefreshCw,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { compressImageFileToDataUrl } from '@/lib/media';

// ─── Types ───

interface Guardian {
  id?: string;
  studentGuardianId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  relationship: string;
  isPrimary: boolean;
}

export interface EnrollmentSubmitData {
  operation: 'PRE_REGISTER' | 'ADMIT';
  student: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    nationality?: string;
    placeOfBirth?: string;
    npi?: string;
    photoUrl?: string;
    address?: string;
  };
  guardians: Guardian[];
  classId?: string;
  schoolLevelId?: string;
  enrollmentType?: 'NEW' | 'REPEAT';
  /**
   * ⭐ nov. 2026 (demande promoteur) — « on devra demander à l'utilisateur
   * s'il faut créer en même temps le compte du parent avec ses identifiants » :
   * true (défaut) = compte parent créé à l'inscription ET identifiants de
   * connexion envoyés au parent par SMS (Termii) + email + Helm Connect
   * (pattern « modal d'encaissement » du module Finance). false = étape
   * skippée — le compte restera créable depuis l'onglet Famille → sous-onglet
   * « Création de compte ».
   */
  createParentAccounts?: boolean;
}

interface StudentEnrollmentFormProps {
  academicYearId?: string;
  schoolLevelId?: string;
  onSubmit: (data: EnrollmentSubmitData) => Promise<any>;
  onCancel: () => void;
  initialData?: any;
  /**
   * ⭐ nov. 2026 — afficher l'étape « Créer en même temps les comptes parents »
   * (wizard de création uniquement). Le modal « Modifier l'inscription »
   * passe false : les comptes parents s'y gèrent via l'onglet Familles →
   * sous-onglet « Création de compte ».
   */
  showParentAccountStep?: boolean;
}

// ─── Composant principal ───

export default function StudentEnrollmentForm({
  academicYearId: propYearId,
  schoolLevelId: propLevelId,
  onSubmit,
  onCancel,
  initialData,
  showParentAccountStep = true,
}: StudentEnrollmentFormProps) {
  const { academicYear, schoolLevel } = useModuleContext();

  // Niveau scolaire sélectionnable (state interne, pas figé par le contexte)
  // ⭐ FIX 2026-09-07 : schoolLevel?.id peut être la sentinelle 'ALL' (option
  //    virtuelle « Tous les niveaux ») — jamais un UUID valide pour le backend
  //    (preRegister/admit + AccessScopeGuard) → on l'exclut de l'initialisation.
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);
  const initialLevelId =
    propLevelId ||
    schoolLevel?.schoolLevelId ||
    (schoolLevel?.id && schoolLevel.id !== 'ALL' ? schoolLevel.id : '') ||
    '';
  const [selectedLevelId, setSelectedLevelId] = useState<string>(initialLevelId);

  // IDs effectifs
  const yearId = propYearId || academicYear?.id || '';

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ⭐ nov. 2026 (demande promoteur) — « compte du parent créé dans
  //    l'onboarding, en le demandant en même temps » : case à cocher à
  //    l'étape Parents. Défaut : cochée (comportement 2026-09-19 confirmé).
  //    Décochée = skip → l'onglet Famille → sous-onglet « Création de
  //    compte » permettra de créer le compte plus tard.
  const [createParentAccounts, setCreateParentAccounts] = useState(true);

  // Données formulaire — pré-rempli depuis initialData si mode édition
  // ⭐ enrollmentType : 'NEW' (nouvel élève → frais d'INSCRIPTION) ou
  //    'REPEAT' (ancien élève → frais de RÉINSCRIPTION).
  //    Par défaut 'NEW' sauf si initialData fournit déjà un type.
  // ⭐ FIX : convertir dateOfBirth ISO (2020-05-15T00:00:00.000Z) en YYYY-MM-DD
  //    pour l'input type="date" qui n'accepte que ce format.
  const rawDate = initialData?.dateOfBirth || '';
  const dateForInput = rawDate
    ? (rawDate.includes('T') ? rawDate.split('T')[0] : rawDate)
    : '';

  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    dateOfBirth: dateForInput,
    gender: initialData?.gender || '',
    nationality: initialData?.nationality || 'Béninoise',
    placeOfBirth: initialData?.placeOfBirth || '',
    npi: initialData?.npi || '',
    photoUrl: initialData?.photoUrl || '',
    address: initialData?.address || '',
    // ⭐ 2026-10-01 — Numéro Educmaster (requis pour l'export Educmaster des
    //    élèves de 6e vers la plateforme gouvernementale MEMP).
    //    13 chiffres (ex: 1130424010714). Optionnel pour les autres classes.
    educMasterMatricule: (initialData as any)?.educMasterMatricule || '',
    classId: initialData?.classId || '',
    enrollmentType: (initialData?.enrollmentType as 'NEW' | 'REPEAT') || 'NEW',
  });

  // Parents — pré-rempli depuis initialData si mode édition
  // ⭐ FIX : inclure l'adresse du guardian (manquait avant)
  const [guardians, setGuardians] = useState<Guardian[]>(
    initialData?.guardians?.length > 0
      ? initialData.guardians.map((g: any) => ({
          id: g.id || '',
          studentGuardianId: g.studentGuardianId || '',
          firstName: g.firstName || '',
          lastName: g.lastName || '',
          phone: g.phone || '',
          email: g.email || '',
          address: g.address || '',
          relationship: g.relationship || 'Père',
          isPrimary: g.isPrimary ?? false,
        }))
      : [{ firstName: '', lastName: '', phone: '', email: '', relationship: 'Père', isPrimary: true }]
  );

  // Classes
  const [classesList, setClassesList] = useState<any[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  // Photo
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(initialData?.photoUrl || '');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ─── Chargement des niveaux scolaires depuis /api/academic-classes ───
  // ⭐ On utilise les classes OFFICIELLES (AcademicClass) pour l'inscription.
  // Le parent choisit une classe officielle (CP, CE1, 6ème…), l'affectation à
  // ⭐ FIX : Charger les niveaux scolaires depuis /api/school-levels.
  // Cette API retourne des objets avec:
  //   - id: UUID de education_levels (PAS school_levels)
  //   - code: "MATERNELLE" (majuscule)
  //   - label: "Maternelle" (nom d'affichage)
  //   - schoolLevelId: UUID de school_levels (le VRAI UUID pour le backend)
  //
  // On utilise schoolLevelId comme id du select (pour que le preRegister
  // reçoive le bon UUID), et label comme nom d'affichage.
  useEffect(() => {
    fetch('/api/school-levels', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const allLevels = Array.isArray(data) ? data : (data?.data || []);
        const levels = allLevels
          .filter((sl: any) => sl.schoolLevelId) // seulement si on a le vrai UUID
          .map((sl: any) => ({
            id: sl.schoolLevelId,                    // ← VRAI UUID de school_levels
            name: sl.label || sl.name || sl.code || 'Niveau',  // ← "Maternelle" pas "MATERNELLE"
            code: sl.code,
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setSchoolLevels(levels);
        if (!selectedLevelId && levels.length > 0) {
          setSelectedLevelId(levels[0].id);
        }
      })
      .catch(() => setSchoolLevels([]));
  }, []);

  // ─── Chargement des classes officielles (filtrées par niveau sélectionné) ───
  useEffect(() => {
    if (!yearId) {
      setClassesList([]);
      return;
    }
    setIsLoadingClasses(true);
    fetch('/api/academic-classes?isActive=true', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const allClasses = Array.isArray(data) ? data : (data?.data || data?.classes || []);
        setClassesList(allClasses);
      })
      .catch(() => setClassesList([]))
      .finally(() => setIsLoadingClasses(false));
  }, [yearId]);

  // ─── Handlers ───

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  // Changement de niveau scolaire → reset classe
  const handleLevelChange = (newLevelId: string) => {
    setSelectedLevelId(newLevelId);
    setFormData(prev => ({ ...prev, classId: '' }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, { maxEdge: 600, quality: 0.8 });
      setPhotoPreview(dataUrl);
      setFormData(prev => ({ ...prev, photoUrl: dataUrl }));
    } catch (err) {
      setError('Erreur lors du téléversement de la photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  // ─── Caméra ───
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setError(null);
    } catch (err: any) {
      setError('Impossible d\'accéder à la caméra: ' + (err.message || ''));
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Centrer et cropper en carré
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPhotoPreview(dataUrl);
    setFormData(prev => ({ ...prev, photoUrl: dataUrl }));
    stopCamera();
  };

  const updateGuardian = (idx: number, field: string, value: string) => {
    setGuardians(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g));
  };

  const addGuardian = () => {
    setGuardians(prev => [...prev, { firstName: '', lastName: '', phone: '', email: '', relationship: 'Mère', isPrimary: false }]);
  };

  const removeGuardian = (idx: number) => {
    setGuardians(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── Validation ───
  // ⭐ FIX: Seuls firstName et lastName sont obligatoires. Tous les autres champs
  // (dateOfBirth, gender, placeOfBirth, nationality, npi, photo) sont optionnels
  // pour permettre une création rapide d'élève avec juste le nom.

  const validateStep1 = () => {
    if (!formData.firstName.trim()) return setError('Le prénom est obligatoire'), false;
    if (!formData.lastName.trim()) return setError('Le nom est obligatoire'), false;
    return true;
  };

  const validateStep3 = () => {
    // ⭐ FIX: Les parents sont optionnels — l'utilisateur peut créer un élève avec juste
    // son nom et ajouter les parents plus tard. On ne bloque plus la navigation si le
    // parent principal n'a pas de nom/prénom.
    return true;
  };

  const validateStep4 = () => {
    // ⭐ Task 28 : le régime a été supprimé — on valide juste que tout est OK
    return true;
  };

  const handleNext = () => {
    setError(null);
    if (step === 1 && !validateStep1()) return;
    if (step === 3 && !validateStep3()) return;
    if (step === 4 && !validateStep4()) return;
    setStep(s => Math.min(5, s + 1));
  };

  const handleBack = () => {
    setError(null);
    setStep(s => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        operation: 'ADMIT',
        student: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth || undefined,
          gender: formData.gender || undefined,
          nationality: formData.nationality || undefined,
          placeOfBirth: formData.placeOfBirth || undefined,
          npi: formData.npi || undefined,
          photoUrl: formData.photoUrl || undefined,
          address: formData.address || undefined,
          // ⭐ 2026-10-01 — Numéro Educmaster (requis pour l'export des 6e)
          educMasterMatricule: formData.educMasterMatricule || undefined,
        },
        guardians,
        // ⭐ classId = classe OFFICIELLE (AcademicClass) — envoyé aussi bien comme
        // classId (legacy) que comme academicClassId (nouveau) pour assurer la
        // compatibilité ascendante côté backend.
        classId: formData.classId || undefined,
        academicClassId: formData.classId || undefined,
        schoolLevelId: selectedLevelId || undefined,
        // ⭐ enrollmentType : 'NEW' (frais d'INSCRIPTION) ou 'REPEAT' (frais de RÉINSCRIPTION)
        enrollmentType: formData.enrollmentType,
        // ⭐ nov. 2026 — création du compte parent + envoi des identifiants
        // (uniquement en wizard de création — pas en « Modifier l'inscription »,
        // où les comptes parents se gèrent dans Familles → Création de compte)
        createParentAccounts: showParentAccountStep ? createParentAccounts : undefined,
      });
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'inscription");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Filtrage des classes par niveau ───
  // ⭐ FIX: `selectedLevelId` est le `schoolLevelId` (UUID de school_levels).
  // Mais `academic-classes.levelId` est un UUID d'une autre table (education_levels).
  // On doit donc construire un mapping: academic-class → schoolLevelId.
  //
  // Stratégie: pour chaque academic-class, on cherche le school-level dont le
  // `label` (ex: "Maternelle") correspond au `level.name` de l'academic-class.
  // On utilise ce mapping pour filtrer les classes par `selectedLevelId`.
  //
  // ⭐ FIX 2026-09-07 « miroir bilingue » : les niveaux EN (Nursery/Primary)
  //    partagent le schoolLevelId de leur miroir FR. Sans filtre de piste, la
  //    liste mélangeait les classes FR (CI, CP…) et EN (Primary 1-6) pour un
  //    même niveau. → piste EN sélectionnée = classes EN ; piste FR = classes
  //    FR/non marquées. L'élève garde UN schoolLevelId (paiement unique).
  const filteredClasses = useMemo(() => {
    if (!selectedLevelId || classesList.length === 0) return classesList;

    // Construire le mapping level.name → schoolLevelId depuis schoolLevels
    const labelToSchoolLevelId = new Map<string, string>();
    schoolLevels.forEach((sl: any) => {
      if (sl.id && sl.name) {
        labelToSchoolLevelId.set(sl.name.toLowerCase(), sl.id);
      }
    });

    // Code du niveau sélectionné (MATERNELLE / NURSERY / PRIMAIRE / PRIMARY…)
    const selectedLevelCode = (schoolLevels.find((sl: any) => sl.id === selectedLevelId)?.code || '').toUpperCase();
    const isEnLevel = ['NURSERY', 'PRIMARY', 'SECONDARY'].includes(selectedLevelCode);

    // Filtrer les classes: on cherche les classes dont le level.name correspond
    // à un school-level dont l'id est selectedLevelId
    return classesList.filter((c: any) => {
      const levelName = c.level?.name || c.schoolLevel?.name || '';
      if (!levelName) return false;
      const mappedSchoolLevelId = labelToSchoolLevelId.get(levelName.toLowerCase());
      if (mappedSchoolLevelId !== selectedLevelId) return false;
      // ⭐ Cohérence de piste : niveau EN miroir → classes EN ; niveau FR → FR/null
      const track = (c.languageTrack || '').toUpperCase() || null;
      if (isEnLevel) return track === 'EN';
      return track === 'FR' || track === null;
    });
  }, [selectedLevelId, classesList, schoolLevels]);

  // ─── Render ───

  const steps = [
    { num: 1, label: 'Identité' },
    { num: 2, label: 'Photo' },
    { num: 3, label: 'Parents' },
    { num: 4, label: 'Classe' },
    { num: 5, label: 'Validation' },
  ];

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
        {steps.map(({ num, label }) => (
          <div key={num} className="flex items-center">
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${step >= num ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {step > num ? <CheckCircle className="w-4 h-4" /> : num}
            </div>
            <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-medium">{label}</span>
            {num < 5 && <div className="w-2 sm:w-3 h-0.5 bg-gray-200 ml-1" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ─── Étape 1 : Identité ─── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
              <input type="text" value={formData.firstName} onChange={e => handleInputChange('firstName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input type="text" value={formData.lastName} onChange={e => handleInputChange('lastName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
              <input type="date" value={formData.dateOfBirth} onChange={e => handleInputChange('dateOfBirth', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sexe</label>
              <select value={formData.gender} onChange={e => handleInputChange('gender', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">—</option>
                <option value="M">Garçon</option>
                <option value="F">Fille</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieu de naissance</label>
              <input type="text" value={formData.placeOfBirth} onChange={e => handleInputChange('placeOfBirth', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nationalité</label>
              <input type="text" value={formData.nationality} onChange={e => handleInputChange('nationality', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NPI (optionnel)</label>
            <input type="text" value={formData.npi} onChange={e => handleInputChange('npi', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {/* ⭐ 2026-10-01 — Numéro Educmaster (requis pour l'export Educmaster des
              élèves de 6e vers la plateforme MEMP du gouvernement béninois).
              Format : 13 chiffres (ex: 1130424010714). */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numéro Educmaster <span className="text-gray-400 font-normal">(requis pour les 6e, sinon optionnel)</span>
            </label>
            <input
              type="text"
              value={formData.educMasterMatricule}
              onChange={e => handleInputChange('educMasterMatricule', e.target.value.replace(/\s/g, ''))}
              placeholder="ex: 1130424010714 (13 chiffres)"
              maxLength={13}
              pattern="[0-9]{13}"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Identifiant attribué par la plateforme Educmaster du MEMP. Indispensable pour l'export
              des élèves de 6e vers la plateforme gouvernementale.
            </p>
          </div>
        </div>
      )}

      {/* ⭐ Adresse de l'élève — champ manquant avant */}
      {step === 1 && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse (optionnel)</label>
        <input type="text" value={formData.address} onChange={e => handleInputChange('address', e.target.value)}
          placeholder="Quartier, ville..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      )}

      {/* ─── Étape 2 : Photo ─── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4">
            {/* Aperçu photo si déjà prise */}
            {photoPreview && !isCameraActive && (
              <div className="relative">
                <img src={photoPreview} alt="Photo" className="w-32 h-32 rounded-full object-cover border-4 border-blue-200" />
                <button onClick={() => { setPhotoPreview(''); setFormData(prev => ({ ...prev, photoUrl: '' })); }}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Mode caméra actif */}
            {isCameraActive && (
              <div className="flex flex-col items-center gap-3">
                <video ref={videoRef} className="w-64 h-64 rounded-full object-cover border-4 border-blue-400" playsInline />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-2">
                  <button onClick={capturePhoto}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                    <Camera className="w-4 h-4" /> Capturer
                  </button>
                  <button onClick={stopCamera}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Pas de photo et caméra inactive : proposer upload + caméra */}
            {!photoPreview && !isCameraActive && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-32 h-32 rounded-full border-4 border-dashed border-gray-300 flex items-center justify-center">
                  {photoUploading ? <Loader2 className="w-8 h-8 text-blue-500 animate-spin" /> : <Camera className="w-8 h-8 text-gray-400" />}
                </div>
                <div className="flex gap-2">
                  <button onClick={startCamera}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                    <Camera className="w-4 h-4" /> Prendre une photo
                  </button>
                  <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Importer
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>
              </div>
            )}

            {/* Photo déjà présente : proposer de reprendre */}
            {photoPreview && !isCameraActive && (
              <div className="flex gap-2">
                <button onClick={startCamera}
                  className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4" /> Reprendre
                </button>
                <label className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-4 h-4" /> Importer
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Étape 3 : Parents ─── */}
      {step === 3 && (
        <div className="space-y-4">
          {guardians.map((g, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-800">Parent/Tuteur {idx + 1} {g.isPrimary && <span className="text-xs text-blue-600">(principal)</span>}</h4>
                {guardians.length > 1 && (
                  <button onClick={() => removeGuardian(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="Prénom" value={g.firstName} onChange={e => updateGuardian(idx, 'firstName', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="text" placeholder="Nom" value={g.lastName} onChange={e => updateGuardian(idx, 'lastName', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="tel" placeholder="Téléphone" value={g.phone} onChange={e => updateGuardian(idx, 'phone', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="email" placeholder="Email" value={g.email} onChange={e => updateGuardian(idx, 'email', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {/* ⭐ Adresse du parent — champ manquant avant */}
              <input type="text" placeholder="Adresse" value={g.address} onChange={e => updateGuardian(idx, 'address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={g.relationship} onChange={e => updateGuardian(idx, 'relationship', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Père">Père</option>
                <option value="Mère">Mère</option>
                <option value="Tuteur">Tuteur légal</option>
                <option value="Oncle">Oncle</option>
                <option value="Tante">Tante</option>
                <option value="Grand-parent">Grand-parent</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
          ))}
          <button onClick={addGuardian} className="text-sm text-blue-600 hover:underline">
            + Ajouter un parent/tuteur
          </button>

          {/* ⭐ nov. 2026 (demande promoteur) — « on devra demander à l'utilisateur
              s'il faut créer en même temps le compte du parent avec ses
              identifiants » : la question est posée ICI, en même temps que la
              saisie des parents. Si cochée : compte créé + identifiants envoyés
              au parent par SMS (Termii), email et Helm Connect (exactement
              comme le modal d'encaissement du module Finance). Si décochée :
              skip — le compte restera créable dans l'onglet Famille →
              sous-onglet « Création de compte » (voir StudentFamiliesContent). */}
          {showParentAccountStep && (
          <div className={`rounded-xl border p-4 transition-all ${
            createParentAccounts
              ? 'border-emerald-300 bg-emerald-50/70'
              : 'border-slate-200 bg-slate-50'
          }`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={createParentAccounts}
                onChange={e => setCreateParentAccounts(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm">
                <span className="block font-semibold text-slate-800">
                  Créer en même temps les comptes parents (portail parent)
                </span>
                <span className="block mt-1 text-xs text-slate-600 leading-relaxed">
                  Les informations de connexion (adresse du portail + numéro de
                  téléphone ou email, sans mot de passe) seront envoyées
                  automatiquement au parent par <strong>SMS</strong> (Termii),{' '}
                  <strong>email</strong> et{' '}<strong>Helm Connect</strong> —
                  exactement comme l'envoi du reçu dans le module Finance.
                </span>
                {!createParentAccounts && (
                  <span className="block mt-2 text-[11px] text-amber-700">
                    ⚠️ Étape ignorée : les parents ne pourront pas se connecter au
                    portail. Vous pourrez créer leurs comptes plus tard dans
                    l'onglet « Familles » → sous-onglet « Création de compte ».
                  </span>
                )}
              </span>
            </label>
          </div>
          )}
        </div>
      )}

      {/* ─── Étape 4 : Classe ─── */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Classe officielle</p>
              <p className="text-sm text-blue-700">Choisissez le niveau et la classe officielle pour l'année scolaire. Les frais seront automatiquement liés à la classe sélectionnée.</p>
            </div>
          </div>

          {/* Niveau scolaire (sélecteur qui filtre les classes) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Niveau scolaire</label>
            {schoolLevels.length === 0 ? (
              // ⭐ FIX 2026-09-07 « vérification multi-rôles » : compte dont le
              //    périmètre ne couvre AUCUN niveau actif (ex: affectation
              //    Secondaire alors que le niveau est désactivé) → message
              //    explicite au lieu d'un sélecteur vide silencieux.
              <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                <span className="font-semibold">Aucun niveau scolaire disponible.</span>{' '}
                Votre compte n&apos;a accès à aucun niveau activé pour cet
                établissement. Demandez au promoteur de vérifier votre affectation
                (RH → Personnel) ou les niveaux actifs (Paramètres → Structure).
              </div>
            ) : (
              <select
                value={selectedLevelId}
                onChange={e => handleLevelChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Sélectionner un niveau —</option>
                {schoolLevels.map(sl => (
                  <option key={sl.id} value={sl.id}>{sl.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* ⭐ Classe OFFICIELLE (filtrée par le niveau sélectionné) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Classe officielle <span className="text-xs text-gray-400">(CP, CE1, 6ème…)</span>
            </label>
            {!selectedLevelId ? (
              <p className="text-sm text-gray-400 italic">Sélectionnez d'abord un niveau scolaire</p>
            ) : isLoadingClasses ? (
              <p className="text-sm text-gray-500">Chargement des classes...</p>
            ) : filteredClasses.length === 0 ? (
              <p className="text-sm text-amber-600">Aucune classe configurée pour ce niveau.</p>
            ) : (
              <select value={formData.classId} onChange={e => handleInputChange('classId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Sélectionner une classe —</option>
                {filteredClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.code}</option>
                ))}
              </select>
            )}
          </div>

          {/* ⭐ Toggle Nouvel élève / Ancien élève
              Détermine le type de frais à appliquer :
              - Nouvel élève → frais d'INSCRIPTION (exclut REINSCRIPTION)
              - Ancien élève → frais de RÉINSCRIPTION (exclut INSCRIPTION).
                S'il n'y a pas de frais de réinscription configurés,
                l'élève ne paiera que la scolarité. */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="text-xs font-bold text-blue-700 uppercase">Statut de l'élève</div>
              <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                Impacte les frais
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, enrollmentType: 'NEW' })}
                className={`text-left p-3 rounded-lg border transition-all ${
                  formData.enrollmentType === 'NEW'
                    ? 'border-blue-500 bg-white ring-2 ring-blue-200'
                    : 'border-slate-200 bg-white/50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-4 h-4 rounded-full border-2 ${formData.enrollmentType === 'NEW' ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`} />
                  <span className="text-sm font-semibold text-slate-900">Nouvel élève</span>
                </div>
                <p className="text-xs text-slate-500 ml-6">Première inscription → Frais d'inscription</p>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, enrollmentType: 'REPEAT' })}
                className={`text-left p-3 rounded-lg border transition-all ${
                  formData.enrollmentType === 'REPEAT'
                    ? 'border-blue-500 bg-white ring-2 ring-blue-200'
                    : 'border-slate-200 bg-white/50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-4 h-4 rounded-full border-2 ${formData.enrollmentType === 'REPEAT' ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`} />
                  <span className="text-sm font-semibold text-slate-900">Ancien élève</span>
                </div>
                <p className="text-xs text-slate-500 ml-6">Déjà inscrit → Frais de réinscription</p>
              </button>
            </div>
            {formData.enrollmentType === 'REPEAT' && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                ⚠️ S'il n'y a pas de frais de réinscription configurés pour cette
                classe, l'élève ne paiera que la scolarité.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Étape 5 : Validation ─── */}
      {step === 5 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800">Récapitulatif</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Nom:</span><span className="font-medium">{formData.lastName} {formData.firstName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Date de naissance:</span><span className="font-medium">{formData.dateOfBirth || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Sexe:</span><span className="font-medium">{formData.gender === 'M' ? 'Garçon' : formData.gender === 'F' ? 'Fille' : '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Classe:</span><span className="font-medium">{filteredClasses.find(c => c.id === formData.classId)?.name || 'Non assignée'}</span></div>
            <div className="flex justify-between">
              <span className="text-gray-500">Statut élève:</span>
              <span className="font-medium">
                {formData.enrollmentType === 'NEW' ? '🌟 Nouvel élève (frais d\'inscription)' : '↻ Ancien élève (frais de réinscription)'}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-gray-500">Parents:</span><span className="font-medium">{guardians.filter(g => g.firstName).length} parent(s)</span></div>
            {showParentAccountStep && (
            <div className="flex justify-between">
              <span className="text-gray-500">Comptes parents:</span>
              <span className={`font-medium ${createParentAccounts ? 'text-emerald-700' : 'text-amber-700'}`}>
                {createParentAccounts
                  ? 'Créés — identifiants envoyés (SMS + email + Helm Connect)'
                  : 'Ignorés (créables dans Familles → Création de compte)'}
              </span>
            </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Navigation ─── */}
      <div className="flex justify-between pt-4 border-t border-gray-100">
        <button onClick={step === 1 ? onCancel : handleBack}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">
          {step === 1 ? 'Annuler' : '← Retour'}
        </button>
        {step < 5 ? (
          <button onClick={handleNext}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition">
            Suivant →
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={isSubmitting}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition disabled:opacity-50">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2 inline" /> : null}
            Enregistrer l'inscription
          </button>
        )}
      </div>
    </div>
  );
}
