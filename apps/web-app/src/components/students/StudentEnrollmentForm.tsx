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

import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle, AlertCircle, BookOpen, Loader2, Camera, Upload, X, RefreshCw,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { compressImageFileToDataUrl } from '@/lib/media';

// ─── Types ───

interface Guardian {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
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
  };
  guardians: Guardian[];
  classId?: string;
  schoolLevelId?: string; // UUID de school_levels sélectionné par l'utilisateur
}

interface StudentEnrollmentFormProps {
  academicYearId?: string;
  schoolLevelId?: string;
  onSubmit: (data: EnrollmentSubmitData) => Promise<any>;
  onCancel: () => void;
  initialData?: any;
}

// ─── Composant principal ───

export default function StudentEnrollmentForm({
  academicYearId: propYearId,
  schoolLevelId: propLevelId,
  onSubmit,
  onCancel,
  initialData,
}: StudentEnrollmentFormProps) {
  const { academicYear, schoolLevel } = useModuleContext();

  // Niveau scolaire sélectionnable (state interne, pas figé par le contexte)
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>(propLevelId || schoolLevel?.id || schoolLevel?.schoolLevelId || '');

  // IDs effectifs
  const yearId = propYearId || academicYear?.id || '';

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Données formulaire — pré-rempli depuis initialData si mode édition
  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    dateOfBirth: initialData?.dateOfBirth || '',
    gender: initialData?.gender || '',
    nationality: initialData?.nationality || 'Béninoise',
    placeOfBirth: initialData?.placeOfBirth || '',
    npi: initialData?.npi || '',
    photoUrl: initialData?.photoUrl || '',
    classId: initialData?.classId || '',
  });

  // Parents — pré-rempli depuis initialData si mode édition
  const [guardians, setGuardians] = useState<Guardian[]>(
    initialData?.guardians?.length > 0
      ? initialData.guardians.map((g: any) => ({
          firstName: g.firstName || '',
          lastName: g.lastName || '',
          phone: g.phone || '',
          email: g.email || '',
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
  // une section physique (CE1-A, CE1-B) se fera plus tard via le module Affectations.
  // On extrait les niveaux uniques des AcademicClass (qui ont levelId + level.name).
  useEffect(() => {
    fetch('/api/academic-classes?isActive=true', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const allClasses = Array.isArray(data) ? data : (data?.data || data?.classes || []);
        // Extraire les niveaux uniques
        const levelMap = new Map<string, { id: string; name: string; code?: string }>();
        allClasses.forEach((c: any) => {
          const levelId = c.levelId || c.schoolLevelId;
          if (levelId && !levelMap.has(levelId)) {
            levelMap.set(levelId, {
              id: levelId,
              name: c.level?.name || c.level?.code || c.schoolLevel?.name || c.schoolLevel?.code || 'Niveau',
              code: c.level?.code || c.schoolLevel?.code,
            });
          }
        });
        const levels = Array.from(levelMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        setSchoolLevels(levels);
        // Si aucun niveau sélectionné, prendre le premier
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
      const dataUrl = await compressImageFileToDataUrl(file, 600, 0.8);
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
        },
        guardians,
        // ⭐ classId = classe OFFICIELLE (AcademicClass) — envoyé aussi bien comme
        // classId (legacy) que comme academicClassId (nouveau) pour assurer la
        // compatibilité ascendante côté backend.
        classId: formData.classId || undefined,
        academicClassId: formData.classId || undefined,
        schoolLevelId: selectedLevelId || undefined,
      });
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'inscription");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Filtrage des classes par niveau ───
  const filteredClasses = selectedLevelId
    ? classesList.filter(c => (c.levelId || c.schoolLevelId) === selectedLevelId)
    : classesList;

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
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Prénom" value={g.firstName} onChange={e => updateGuardian(idx, 'firstName', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="text" placeholder="Nom" value={g.lastName} onChange={e => updateGuardian(idx, 'lastName', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="tel" placeholder="Téléphone" value={g.phone} onChange={e => updateGuardian(idx, 'phone', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="email" placeholder="Email" value={g.email} onChange={e => updateGuardian(idx, 'email', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
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
            <div className="flex justify-between"><span className="text-gray-500">Parents:</span><span className="font-medium">{guardians.filter(g => g.firstName).length} parent(s)</span></div>
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
