/**
 * ============================================================================
 * STUDENT ENROLLMENT FORM - FORMULAIRE D'INSCRIPTION AVEC RÉGIME TARIFAIRE
 * ============================================================================
 * 
 * Formulaire complet d'inscription d'élève avec sélection du régime tarifaire
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Info, CheckCircle, Users, FileText, BookOpen, Camera } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatGradeLabel } from '@/lib/utils';
import { localDb } from '@/lib/offline/local-db.service';

interface FeeRegime {
  id: string;
  code: string;
  label: string;
  description?: string;
  isDefault: boolean;
  rules: Array<{
    feeType: string;
    discountType: string;
    discountValue: number;
  }>;
}

type EnrollmentOperation = 'PRE_REGISTER' | 'ADMIT';

interface StudentEnrollmentFormProps {
  academicYearId: string;
  schoolLevelId: string;
  onSubmit: (data: {
    operation: EnrollmentOperation;
    student: any;
    feeProfile: {
      feeRegimeId: string;
      justification?: string;
    };
    guardians: Array<{
      firstName: string;
      lastName: string;
      relationship: string;
      phone?: string;
      email?: string;
      isPrimary?: boolean;
    }>;
    classId?: string;
  }) => Promise<void>;
  onCancel: () => void;
  initialData?: any;
}

export default function StudentEnrollmentForm({
  academicYearId,
  schoolLevelId,
  onSubmit,
  onCancel,
  initialData,
}: StudentEnrollmentFormProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<EnrollmentOperation>('ADMIT');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>(initialData?.photoUrl || '');
  const [photoSyncStatus, setPhotoSyncStatus] = useState<'idle' | 'pending' | 'synced'>('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Données du formulaire
  const [formData, setFormData] = useState({
    // Informations élève
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    dateOfBirth: initialData?.dateOfBirth || '',
    gender: initialData?.gender || '',
    nationality: initialData?.nationality || '',
    primaryLanguage: initialData?.primaryLanguage || 'FR',
    placeOfBirth: initialData?.placeOfBirth || '',
    npi: initialData?.npi || '',
    photoUrl: initialData?.photoUrl || '',
    classId: '',
    // Régime tarifaire
    feeRegimeId: '',
    justification: '',
  });

  // Parents / tuteurs
  const [guardians, setGuardians] = useState<
    Array<{
      firstName: string;
      lastName: string;
      relationship: string;
      phone?: string;
      email?: string;
      isPrimary?: boolean;
    }>
  >([]);

  // Régimes disponibles
  const [regimes, setRegimes] = useState<FeeRegime[]>([]);
  const [selectedRegime, setSelectedRegime] = useState<FeeRegime | null>(null);
  const [isLoadingRegimes, setIsLoadingRegimes] = useState(false);

  // Classes (chargées depuis la BDD, filtrées par niveau scolaire)
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  // Charger les régimes tarifaires
  useEffect(() => {
    loadRegimes();
  }, [academicYearId, schoolLevelId]);

  // Charger les classes depuis le backend (config Paramètres), filtrées par niveau
  useEffect(() => {
    if (!academicYearId) {
      setClassesList([]);
      return;
    }
    setIsLoadingClasses(true);
    const params = new URLSearchParams({ academicYearId });
    if (schoolLevelId && schoolLevelId !== 'ALL') params.set('schoolLevelId', schoolLevelId);
    fetch(`/api/classes?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.data ?? data?.classes ?? [];
        setClassesList(list.map((c: any) => ({ id: c.id, name: c.name || c.code || c.id })));
      })
      .catch(() => setClassesList([]))
      .finally(() => setIsLoadingClasses(false));
  }, [academicYearId, schoolLevelId]);

  const loadRegimes = async () => {
    setIsLoadingRegimes(true);
    try {
      const params = new URLSearchParams({
        academicYearId,
        schoolLevelId,
      });

      const response = await fetch(`/api/finance/fee-regimes?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRegimes(data);

        // Sélectionner le régime par défaut
        const defaultRegime = data.find((r: FeeRegime) => r.isDefault);
        if (defaultRegime) {
          setSelectedRegime(defaultRegime);
          setFormData((prev) => ({ ...prev, feeRegimeId: defaultRegime.id }));
        }
      }
    } catch (error) {
      console.error('Failed to load fee regimes:', error);
      setError('Impossible de charger les régimes tarifaires');
    } finally {
      setIsLoadingRegimes(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleRegimeChange = (regimeId: string) => {
    const regime = regimes.find((r) => r.id === regimeId);
    setSelectedRegime(regime || null);
    handleInputChange('feeRegimeId', regimeId);
    
    // Réinitialiser la justification si ce n'est pas une réduction
    if (regime?.code !== 'REDUCTION') {
      handleInputChange('justification', '');
    }
  };

  const handlePhotoChange = async (file: File | null) => {
    if (!file) return;
    setPhotoUploading(true);
    setError(null);

    // Aperçu immédiat (même hors-ligne)
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(previewUrl);

    try {
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

      // Mode offline-first : stocker la photo dans IndexedDB et marquer pour synchronisation
      if (isOffline) {
        const id = `student-photo-${Date.now()}`;
        await localDb.execute('student_photos', 'add', {
          id,
          blob: file,
          syncStatus: 'PENDING',
          createdAt: new Date().toISOString(),
        });
        setPhotoSyncStatus('pending');
        setPhotoUploading(false);
        return;
      }

      // En ligne : upload immédiat vers l'API Next
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/students/upload-photo', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data?.photoUrl) {
        throw new Error(data?.error || 'Erreur lors de l\'upload de la photo');
      }
      setFormData((prev) => ({ ...prev, photoUrl: data.photoUrl }));
      setPhotoPreviewUrl(data.photoUrl);
      setPhotoSyncStatus('synced');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'upload de la photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  const syncOfflinePhotos = async () => {
    try {
      const records = await localDb.query<any>('student_photos');
      const pending = (records || []).filter((r: any) => r.syncStatus === 'PENDING');
      if (!pending.length) return;

      for (const record of pending) {
        const blob: Blob | undefined = record.blob;
        if (!blob) continue;
        const fd = new FormData();
        fd.append('file', blob);
        const res = await fetch('/api/students/upload-photo', {
          method: 'POST',
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.photoUrl) {
          // Conserver en PENDING ; l'utilisateur pourra réessayer plus tard
          continue;
        }
        await localDb.execute('student_photos', 'put', {
          ...record,
          syncStatus: 'SYNCED',
          syncedAt: new Date().toISOString(),
          remoteUrl: data.photoUrl,
        });
        setFormData((prev) => ({ ...prev, photoUrl: data.photoUrl }));
        setPhotoPreviewUrl(data.photoUrl);
        setPhotoSyncStatus('synced');
      }
    } catch {
      // Pas bloquant pour le wizard
    }
  };

  const stopCamera = () => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
        setIsCameraActive(true);
      } else {
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch (err: any) {
      setCameraError(
        err?.message || 'Impossible d’accéder à la caméra. Vérifiez les permissions du navigateur.',
      );
      setIsCameraActive(false);
    }
  };

  const captureFromCamera = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (!videoWidth || !videoHeight) return;

    // Ratio cible 3:4
    const targetRatio = 3 / 4;
    let srcWidth = videoWidth;
    let srcHeight = Math.round(videoWidth / targetRatio);
    if (srcHeight > videoHeight) {
      srcHeight = videoHeight;
      srcWidth = Math.round(videoHeight * targetRatio);
    }
    const srcX = Math.floor((videoWidth - srcWidth) / 2);
    const srcY = Math.floor((videoHeight - srcHeight) / 2);

    const outWidth = 300;
    const outHeight = 400;
    canvas.width = outWidth;
    canvas.height = outHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(
      video,
      srcX,
      srcY,
      srcWidth,
      srcHeight,
      0,
      0,
      outWidth,
      outHeight,
    );

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'student-photo.jpg', { type: 'image/jpeg' });
        await handlePhotoChange(file);
        stopCamera();
      },
      'image/jpeg',
      0.9,
    );
  };

  // Synchroniser automatiquement les photos capturées hors-ligne quand la connexion revient
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      syncOfflinePhotos();
    };

    window.addEventListener('online', handleOnline);
    // Tentative de synchro au montage si déjà en ligne
    if (navigator.onLine) {
      syncOfflinePhotos();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      stopCamera();
    };
  }, []);

  const validateStep1 = (): boolean => {
    if (!formData.firstName.trim()) {
      setError('Le prénom est obligatoire');
      return false;
    }
    if (!formData.lastName.trim()) {
      setError('Le nom est obligatoire');
      return false;
    }
    return true;
  };

  const validateRegimeStep = (): boolean => {
    if (!formData.feeRegimeId) {
      setError('Veuillez sélectionner un régime tarifaire');
      return false;
    }

    const regime = regimes.find((r) => r.id === formData.feeRegimeId);
    if (regime?.code === 'REDUCTION' && !formData.justification.trim()) {
      setError('Une justification est obligatoire pour les réductions');
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) {
      return;
    }
    if (step === 5 && !validateRegimeStep()) {
      return;
    }
    setStep((prev) => Math.min(6, prev + 1));
  };

  /** Reprendre = effacer la photo actuelle et permettre une nouvelle capture / import */
  const handleReprendre = () => {
    if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoPreviewUrl('');
    setFormData((prev) => ({ ...prev, photoUrl: '' }));
    setPhotoSyncStatus('idle');
    setError(null);
    stopCamera();
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => Math.max(1, prev - 1));
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (operation === 'ADMIT' && !formData.classId) {
      setError('Veuillez sélectionner une classe pour l’admission/inscription');
      return;
    }
    if (!validateRegimeStep()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        operation,
        student: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth || undefined,
          gender: formData.gender || undefined,
          nationality: formData.nationality || undefined,
          primaryLanguage: formData.primaryLanguage,
          placeOfBirth: formData.placeOfBirth || undefined,
          npi: formData.npi || undefined,
          photoUrl: formData.photoUrl || undefined,
        },
        feeProfile: {
          feeRegimeId: formData.feeRegimeId,
          justification: formData.justification || undefined,
        },
        guardians,
        classId: formData.classId || undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'inscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRegimeBadgeColor = (code: string) => {
    switch (code) {
      case 'STANDARD':
        return 'bg-blue-100 text-blue-800';
      case 'ENFANT_ENSEIGNANT':
        return 'bg-green-100 text-green-800';
      case 'REDUCTION':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRegimeLabel = (code: string) => {
    switch (code) {
      case 'STANDARD':
        return 'Standard';
      case 'ENFANT_ENSEIGNANT':
        return 'Enfant d\'enseignant';
      case 'REDUCTION':
        return 'Réduction exceptionnelle';
      default:
        return code;
    }
  };

  return (
    <div className="space-y-6">
      {/* Indicateur d'étapes — Étape 1 Identité, Étape 2 Photo, puis Parents, Documents, Classe, Validation */}
      <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
        {[
          { num: 1, label: 'Identité' },
          { num: 2, label: 'Photo' },
          { num: 3, label: 'Parents' },
          { num: 4, label: 'Documents' },
          { num: 5, label: 'Classe & régime' },
          { num: 6, label: 'Validation' },
        ].map(({ num, label }) => (
          <div key={num} className="flex items-center">
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${
                step >= num ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step > num ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : num}
            </div>
            <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-medium">{label}</span>
            {num < 6 && <div className="w-2 sm:w-3 h-0.5 bg-gray-200 ml-1" />}
          </div>
        ))}
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Étape 1 : Identité */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-800">
                Remplissez les informations de base de l'élève. Vous pourrez sélectionner le régime tarifaire à l'étape suivante.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prénom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de naissance
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Genre
              </label>
              <select
                value={formData.gender}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nationalité
              </label>
              <input
                type="text"
                value={formData.nationality}
                onChange={(e) => handleInputChange('nationality', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Béninoise"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Langue principale
              </label>
              <select
                value={formData.primaryLanguage}
                onChange={(e) => handleInputChange('primaryLanguage', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="FR">Français</option>
                <option value="EN">Anglais</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lieu de naissance
            </label>
            <input
              type="text"
              value={formData.placeOfBirth}
              onChange={(e) => handleInputChange('placeOfBirth', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              NPI (Numéro d&apos;Identification Personnel)
            </label>
            <input
              type="text"
              value={formData.npi}
              onChange={(e) => handleInputChange('npi', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Étape 2 : 📸 Photo d'identité élève (wireframe) */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="border-b border-gray-200 pb-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              Photo d&apos;identité élève
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Format 3:4 (300×400 px min), JPG. Utilisée pour la carte scolaire et le dossier.
            </p>
          </div>

          {/* Aperçu caméra ou photo capturée */}
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-sm aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200 flex items-center justify-center">
              {isCameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    autoPlay
                    muted
                  />
                  <div className="absolute inset-0 border-4 border-white/60 rounded-lg pointer-events-none m-2">
                    <div className="absolute inset-x-4 top-1/3 h-px bg-white/50" />
                    <div className="absolute left-1/2 top-1/4 bottom-1/3 w-px -translate-x-1/2 bg-white/50" />
                  </div>
                </>
              ) : photoPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreviewUrl}
                  alt="Aperçu photo élève"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-6 text-gray-500">
                  <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune photo</p>
                  <p className="text-xs mt-1">Prenez la photo ou importez depuis la galerie</p>
                </div>
              )}
            </div>

            {cameraError && (
              <p className="mt-2 text-sm text-red-600 text-center">{cameraError}</p>
            )}

            <div className="flex flex-wrap gap-2 justify-center mt-4 w-full max-w-sm">
              {!isCameraActive && !photoPreviewUrl && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Activer la caméra
                </button>
              )}
              {isCameraActive && (
                <>
                  <button
                    type="button"
                    onClick={captureFromCamera}
                    disabled={photoUploading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    Prendre la photo
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Annuler
                  </button>
                </>
              )}
              {photoPreviewUrl && !isCameraActive && (
                <button
                  type="button"
                  onClick={handleReprendre}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Reprendre
                </button>
              )}
              <label className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer inline-flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
                />
                Importer depuis galerie
              </label>
            </div>

            {photoUploading && (
              <p className="mt-2 text-sm text-blue-600">Upload en cours…</p>
            )}
            {photoSyncStatus === 'pending' && (
              <p className="mt-2 text-sm text-amber-600">
                Photo enregistrée hors-ligne — envoi automatique au retour de la connexion.
              </p>
            )}
            <p className="mt-3 text-xs text-gray-500 text-center max-w-sm">
              Mobile : mode portrait recommandé. Visage centré, fond clair, bonne luminosité. Compression automatique.
            </p>
          </div>
        </div>
      )}

      {/* Étape 3 : Parents */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start space-x-3">
            <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800 mb-1">
                Parents et tuteurs
              </p>
              <p className="text-sm text-blue-700">
                Ajoutez au moins un parent ou tuteur légal. Vous pourrez compléter ou modifier ces informations plus tard.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {guardians.map((g, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium text-gray-900">
                    Responsable #{index + 1}
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={!!g.isPrimary}
                        onChange={(e) => {
                          const next = guardians.map((item, i) => ({
                            ...item,
                            isPrimary: i === index ? e.target.checked : item.isPrimary && !e.target.checked,
                          }));
                          setGuardians(next);
                        }}
                      />
                      Principal
                    </label>
                    <button
                      type="button"
                      onClick={() => setGuardians(guardians.filter((_, i) => i !== index))}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nom
                    </label>
                    <input
                      type="text"
                      value={g.lastName}
                      onChange={(e) => {
                        const next = [...guardians];
                        next[index] = { ...next[index], lastName: e.target.value };
                        setGuardians(next);
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Prénom
                    </label>
                    <input
                      type="text"
                      value={g.firstName}
                      onChange={(e) => {
                        const next = [...guardians];
                        next[index] = { ...next[index], firstName: e.target.value };
                        setGuardians(next);
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Lien
                    </label>
                    <input
                      type="text"
                      value={g.relationship}
                      onChange={(e) => {
                        const next = [...guardians];
                        next[index] = { ...next[index], relationship: e.target.value };
                        setGuardians(next);
                      }}
                      placeholder="Mère, Père, Tuteur..."
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={g.phone || ''}
                      onChange={(e) => {
                        const next = [...guardians];
                        next[index] = { ...next[index], phone: e.target.value };
                        setGuardians(next);
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={g.email || ''}
                      onChange={(e) => {
                        const next = [...guardians];
                        next[index] = { ...next[index], email: e.target.value };
                        setGuardians(next);
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setGuardians([
                ...guardians,
                { firstName: '', lastName: '', relationship: '', isPrimary: guardians.length === 0 },
              ])
            }
            className="px-3 py-2 text-sm font-medium text-blue-600 border border-dashed border-blue-300 rounded-md hover:bg-blue-50"
          >
            Ajouter un responsable
          </button>
        </div>
      )}

      {/* Étape 4 : Documents */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start space-x-3">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800 mb-1">
                Documents officiels
              </p>
              <p className="text-sm text-blue-700">
                Vérifiez que vous disposez des documents obligatoires (acte de naissance, photo, pièces d&apos;identité, etc.).
                Leur numérisation et dépôt se font ensuite dans l&apos;onglet <strong>Documents</strong> du dossier élève.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-700">
            Cette étape sert de rappel. Aucune pièce n&apos;est téléchargée ici, pour garder l&apos;inscription rapide.
          </p>
        </div>
      )}

      {/* Étape 5 : Classe & régime tarifaire */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start space-x-3">
            <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800 mb-1">
                Classe et régime de scolarité
              </p>
              <p className="text-sm text-blue-700">
                Choisissez la classe cible (facultatif) et le régime de scolarité. Le régime impacte toute l&apos;année scolaire
                et ne peut être modifié que par la direction.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Classe (optionnel)
            </label>
            <select
              value={formData.classId}
              onChange={(e) => handleInputChange('classId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Choisir une classe"
            >
              <option value="">Aucune classe (affectation ultérieure)</option>
              {isLoadingClasses ? (
                <option value="" disabled>Chargement des classes...</option>
              ) : (
                classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatGradeLabel(c.name) || c.name}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Classes configurées dans Paramètres, filtrées par le niveau scolaire sélectionné.
            </p>
          </div>

          {isLoadingRegimes ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-600">Chargement des régimes...</p>
            </div>
          ) : regimes.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-800">
                Aucun régime tarifaire configuré pour ce niveau. Veuillez configurer les régimes dans les paramètres financiers.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {regimes.map((regime) => (
                  <label
                    key={regime.id}
                    className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.feeRegimeId === regime.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <input
                        type="radio"
                        name="feeRegime"
                        value={regime.id}
                        checked={formData.feeRegimeId === regime.id}
                        onChange={() => handleRegimeChange(regime.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getRegimeBadgeColor(
                                regime.code
                              )}`}
                            >
                              {getRegimeLabel(regime.code)}
                            </span>
                            {regime.isDefault && (
                              <span className="text-xs text-gray-500">(Par défaut)</span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {regime.label}
                        </p>
                        {regime.description && (
                          <p className="text-sm text-gray-600 mb-2">
                            {regime.description}
                          </p>
                        )}
                        {regime.rules.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium text-gray-700">
                              Règles de réduction :
                            </p>
                            {regime.rules.map((rule, idx) => (
                              <div key={idx} className="text-xs text-gray-600 ml-4">
                                • {rule.feeType}:{' '}
                                {rule.discountType === 'FIXED'
                                  ? `${rule.discountValue.toLocaleString('fr-FR')} FCFA`
                                  : `${rule.discountValue}%`}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Justification pour réduction */}
              {selectedRegime?.code === 'REDUCTION' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Justification de la réduction <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.justification}
                    onChange={(e) => handleInputChange('justification', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Expliquez la raison de la réduction (ex: situation sociale, bourse, etc.)"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Cette justification sera validée par la direction.
                  </p>
                </div>
              )}

              {/* Avertissement */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mt-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800 mb-1">
                      Important
                    </p>
                    <p className="text-sm text-yellow-700">
                      Le régime tarifaire sélectionné sera appliqué pour toute l'année scolaire.
                      Toute modification nécessitera une validation par la direction.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Étape 6 : Validation */}
      {step === 6 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">
              Vérification finale
            </p>
            <p className="text-sm text-blue-700">
              Relisez les informations principales avant d&apos;enregistrer l&apos;inscription. Vous pourrez ajuster les détails
              (documents, changements de classe) plus tard dans le dossier élève.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Type d’opération</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-3 p-3 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="operation"
                  value="ADMIT"
                  checked={operation === 'ADMIT'}
                  onChange={() => setOperation('ADMIT')}
                  className="mt-1"
                />
                <span className="text-sm">
                  <span className="font-medium text-gray-900">Admission / Inscription</span>
                  <span className="block text-gray-600 mt-0.5">
                    Génère le matricule interne et valide l’inscription (classe obligatoire).
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="operation"
                  value="PRE_REGISTER"
                  checked={operation === 'PRE_REGISTER'}
                  onChange={() => setOperation('PRE_REGISTER')}
                  className="mt-1"
                />
                <span className="text-sm">
                  <span className="font-medium text-gray-900">Pré-inscription</span>
                  <span className="block text-gray-600 mt-0.5">
                    Dossier candidat (peut rester incomplet) — sans admission immédiate.
                  </span>
                </span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Identité</h4>
              <p className="text-gray-700">
                {formData.lastName} {formData.firstName}
              </p>
              {formData.dateOfBirth && (
                <p className="text-gray-700">
                  Né(e) le {new Date(formData.dateOfBirth).toLocaleDateString('fr-FR')}
                </p>
              )}
              {formData.nationality && (
                <p className="text-gray-700">Nationalité : {formData.nationality}</p>
              )}
              {formData.npi && (
                <p className="text-gray-700">NPI : {formData.npi}</p>
              )}
              <p className="text-gray-700 mt-1">
                Photo : {formData.photoUrl || photoPreviewUrl ? 'Oui (carte scolaire)' : 'Non'}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Régime & classe</h4>
              {selectedRegime && (
                <p className="text-gray-700">
                  Régime : {getRegimeLabel(selectedRegime.code)} ({selectedRegime.label})
                </p>
              )}
              {formData.classId && (
                <p className="text-gray-700">Classe cible : {formData.classId}</p>
              )}
            </div>
          </div>
          {guardians.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Parents / tuteurs</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                {guardians.map((g, i) => (
                  <li key={i}>
                    {g.lastName} {g.firstName} ({g.relationship || 'Responsable'}){g.isPrimary ? ' — Principal' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Actions - footer sticky pour garder les boutons visibles */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="sticky bottom-0 bg-white/95 backdrop-blur flex items-center justify-between pt-4 border-t border-gray-200"
      >
        <div>
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Retour
            </button>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Annuler
          </button>
          {step < 6 ? (
            <motion.button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.99 }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Suivant
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.feeRegimeId}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.99 }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{operation === 'PRE_REGISTER' ? 'Enregistrer la pré-inscription' : "Enregistrer l'admission"}</span>
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

