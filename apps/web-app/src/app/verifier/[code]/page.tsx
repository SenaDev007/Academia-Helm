/**
 * ============================================================================
 * PAGE PUBLIQUE DE VÉRIFICATION — QR CODE DE DISTINCTION (TABLEAU D'HONNEUR)
 * ============================================================================
 *
 * URL: /verifier/[code]
 *   où [code] = code de vérification au format AH-YYYY-XXXX-XXXX-XXXX
 *   (généré par makeVerificationCodeWithNonce côté backend).
 *
 * Cette page est publique (pas d'authentification requise) — c'est elle que
 * le QR code des certificats de distinction pointe vers.
 * Le parent ou quiconque scanne le QR code arrive ici et voit les informations
 * authentifiées de l'émission : élève, distinction, période, école, statut.
 *
 * Sécurité :
 *   - Le code est un HMAC-SHA256 tronqué + nonce → infalsifiable
 *   - L'endpoint backend /api/public/distinctions/verify/:code recherche
 *     l'émission en base (DistinctionRecord) via le verificationCode unique
 *   - Aucune donnée sensible (pas de notes, pas de finances) — seulement
 *     les infos publiques de la distinction
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle, XCircle, User, Award, GraduationCap, Trophy, Medal,
  Calendar, Building, School, AlertCircle, Shield, Loader2,
  TrendingUp, CalendarCheck, HeartHandshake,
} from 'lucide-react';

interface VerificationResult {
  valid: boolean;
  code?: string;
  nonce?: string;
  status?: string;
  issuedOn?: string;
  error?: string;
  revokedAt?: string;
  student?: {
    name: string;
    matricule: string | null;
    className: string | null;
  };
  distinction?: {
    code: string;
    label: string;
    title: string;
    subtitle?: string | null;
    category: 'mention' | 'special' | 'graduation';
  };
  period?: {
    academicYear: string | null;
  };
  results?: {
    average: number;
    base: number;
    rank: number;
    classSize: number;
  } | null;
  school?: {
    name: string;
  };
  documentType?: string;
  issuedAt?: string;
  verifiedAt?: string;
}

const ICON_BY_CATEGORY: Record<string, any> = {
  mention: Award,
  special: Trophy,
  graduation: GraduationCap,
};

const CATEGORY_LABEL: Record<string, string> = {
  mention: 'Mention académique',
  special: 'Prix spécial',
  graduation: 'Diplôme de fin de cycle',
};

const CATEGORY_COLOR: Record<string, string> = {
  mention: 'bg-blue-600',
  special: 'bg-emerald-600',
  graduation: 'bg-purple-600',
};

// Palette par code (pour afficher un accent visuel correspondant au certificat)
const COLOR_BY_CODE_PREFIX: Record<string, string> = {
  MAT_OR: '#F59E0B',
  MAT_ARGENT: '#3B82F6',
  MAT_BRONZE: '#EF6C57',
  MAT_EXPLO: '#14B8A6',
  MAT_GRAD: '#7C3AED',
  PRI_FELIC: '#0B1F4B',
  PRI_ENCOU: '#1D4ED8',
  PRI_HONNEUR: '#0F766E',
  PRI_COURAGE: '#C2410C',
  PRI_GRAD: '#4338CA',
  SEC_FELIC: '#6B1F2A',
  SEC_ENCOU: '#1E3A5F',
  SEC_HONNEUR: '#334155',
  SEC_PROGRES: '#0F5C63',
  SEC_ASSIDUITE: '#3F3D8F',
  SEC_COMPORTEMENT: '#166534',
  SEC_GRAD: '#2B1B4D',
};

export default function PublicDistinctionVerifierPage() {
  const params = useParams();
  const codeParam = params.code as string;
  const decodedCode = decodeURIComponent(codeParam || '');

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    if (!decodedCode) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { getApiBaseUrl } = await import('@/lib/utils/urls');
        const apiUrl = getApiBaseUrl();
        const response = await fetch(`${apiUrl}/public/distinctions/verify/${encodeURIComponent(decodedCode)}`);
        const data: VerificationResult = await response.json().catch(() => ({ valid: false, error: 'Réponse invalide' }));
        setResult(data);
      } catch (err) {
        console.error('Error verifying distinction:', err);
        setResult({ valid: false, error: 'Impossible de vérifier ce code' });
      } finally {
        setLoading(false);
      }
    })();
  }, [decodedCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Vérification du certificat...</p>
          <p className="text-sm text-slate-500 mt-2">Authentification du QR code en cours</p>
        </div>
      </div>
    );
  }

  if (!decodedCode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Code manquant</h1>
          <p className="text-slate-600">Aucun code de vérification fourni dans l'URL.</p>
        </div>
      </div>
    );
  }

  if (!result?.valid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Vérification échouée</h1>
          <p className="text-slate-600 mb-4">
            {result?.error || 'Ce code de vérification est invalide.'}
          </p>
          {result?.revokedAt && (
            <p className="text-sm text-red-600 mb-2">
              Révoqué le : {new Date(result.revokedAt).toLocaleDateString('fr-FR')}
            </p>
          )}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500 break-all">Code scanné : {decodedCode}</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Certificat valide ──────────────────────────────────────────────
  const accentColor = result.distinction?.code
    ? COLOR_BY_CODE_PREFIX[result.distinction.code] || '#0F766E'
    : '#0F766E';
  const Icon = result.distinction?.category
    ? ICON_BY_CATEGORY[result.distinction.category] || Award
    : Award;
  const categoryLabel = result.distinction?.category
    ? CATEGORY_LABEL[result.distinction.category]
    : 'Distinction';
  const categoryColor = result.distinction?.category
    ? CATEGORY_COLOR[result.distinction.category]
    : 'bg-blue-600';

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header — Bandeau de validation */}
        <div className="bg-white rounded-t-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-5" style={{ backgroundColor: accentColor }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Shield className="w-9 h-9 text-white" />
                <div>
                  <h1 className="text-xl font-bold text-white">Certificat Authentifié</h1>
                  <p className="text-sm text-white/90">
                    Tableau d'honneur — Academia Helm
                  </p>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur px-3 py-1 rounded-full">
                <span className="text-white text-sm font-semibold flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> VALIDÉ
                </span>
              </div>
            </div>
          </div>

          {/* Bandeau catégorie + distinction */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor + '20' }}>
                <Icon className="w-7 h-7" style={{ color: accentColor }} />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                  {categoryLabel}
                </p>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  {result.distinction?.title || result.distinction?.label}
                </h2>
                {result.distinction?.subtitle && (
                  <p className="text-sm text-slate-600">{result.distinction.subtitle}</p>
                )}
              </div>
            </div>
          </div>

          {/* Élève */}
          <div className="p-6">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center border-4 border-slate-100">
                  <User className="w-10 h-10 text-slate-400" />
                </div>
              </div>

              {/* Détails */}
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {result.student?.name || 'Élève'}
                  </h3>
                  {result.student?.matricule && (
                    <p className="text-slate-600 mt-1 text-sm">
                      Matricule : <span className="font-semibold">{result.student.matricule}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.student?.className && (
                    <div className="flex items-center gap-2">
                      <School className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Classe</p>
                        <p className="font-medium text-slate-900 text-sm">{result.student.className}</p>
                      </div>
                    </div>
                  )}
                  {result.period?.academicYear && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Année scolaire</p>
                        <p className="font-medium text-slate-900 text-sm">{result.period.academicYear}</p>
                      </div>
                    </div>
                  )}
                  {result.school?.name && (
                    <div className="flex items-center gap-2 md:col-span-2">
                      <Building className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Établissement</p>
                        <p className="font-medium text-slate-900 text-sm">{result.school.name}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Résultats (moyenne, rang, base) */}
                {result.results && (
                  <div className="pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-500 mb-2 font-semibold uppercase">Résultats</p>
                    <div className="flex flex-wrap gap-3">
                      <div className="px-3 py-1.5 rounded-lg bg-slate-100">
                        <span className="text-xs text-slate-500">Moyenne : </span>
                        <span className="font-bold text-slate-900">
                          {result.results.average.toFixed(2)} / {result.results.base}
                        </span>
                      </div>
                      {result.results.rank != null && (
                        <div className="px-3 py-1.5 rounded-lg bg-amber-100">
                          <span className="text-xs text-amber-700">Rang : </span>
                          <span className="font-bold text-amber-900">
                            {result.results.rank}{result.results.rank === 1 ? 'er' : 'e'}
                            {result.results.classSize != null && ` / ${result.results.classSize}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Carte d'informations d'émission */}
        <div className="bg-white rounded-b-2xl shadow-lg p-6 border-t border-slate-100">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-500" />
            Informations d'émission
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Date d'émission</p>
              <p className="font-medium text-slate-900">
                {result.issuedOn ? new Date(result.issuedOn).toLocaleDateString('fr-FR') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Statut</p>
              <p className="font-medium text-slate-900">
                {result.status === 'EMITTED' ? '✅ Émis et valide' :
                 result.status === 'REISSUED' ? '🔄 Réémis' :
                 result.status === 'REVOKED' ? '❌ Révoqué' :
                 result.status || '—'}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-slate-500">Code de vérification</p>
              <p className="font-mono text-xs text-slate-700 break-all bg-slate-100 px-2 py-1 rounded mt-1">
                {result.code}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Vérifié le</p>
              <p className="font-medium text-slate-900">
                {result.verifiedAt ? new Date(result.verifiedAt).toLocaleString('fr-FR') : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Pied — Avis de protection */}
        <div className="bg-white rounded-lg shadow p-4 mt-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <p className="font-semibold mb-1">Certificat authentifié par Academia Helm</p>
              <p>
                Ce QR code a été généré par la plateforme Academia Helm avec un code de vérification
                HMAC-SHA256 unique incluant un nonce cryptographique. Chaque émission produit un QR
                code différent, infalsifiable et individuellement authentifiable.
                Aucune donnée sensible (notes détaillées, finances, historique disciplinaire) n'est
                exposée sur cette page publique.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Academia Helm */}
        <div className="text-center mt-6 text-xs text-slate-500">
          <p>Academia Helm — Plateforme de gestion scolaire</p>
        </div>
      </div>
    </div>
  );
}
