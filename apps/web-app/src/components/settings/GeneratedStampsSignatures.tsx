/**
 * Cachets & Signatures générés — par niveau scolaire et par rôle (département administratif).
 * Chaque niveau peut avoir ses cachets (circulaire, rectangulaire, ovale) et les signatures
 * de chaque responsable (Directeur, Comptable, etc.). Niveau "Global" = établissement entier.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Stamp, RefreshCw, PenTool, Loader2, AlertTriangle, GraduationCap, User } from 'lucide-react';
import * as settingsService from '@/services/settings.service';

type StampFormat = settingsService.StampFormat;
type StampsListItem = settingsService.StampsListItem;
type SignatureListItem = settingsService.SignatureListItem;

const FORMAT_LABELS: Record<StampFormat, string> = {
  circular: 'Circulaire',
  rectangular: 'Rectangulaire',
  oval: 'Ovale',
};

interface LevelOption {
  id: string | null;
  name: string;
}

interface GeneratedStampsSignaturesProps {
  tenantId: string | null | undefined;
}

export default function GeneratedStampsSignatures({ tenantId }: GeneratedStampsSignaturesProps) {
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [stampsList, setStampsList] = useState<StampsListItem[]>([]);
  const [signaturesList, setSignaturesList] = useState<SignatureListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingStampsFor, setGeneratingStampsFor] = useState<string | null>(null);
  const [generatingSigFor, setGeneratingSigFor] = useState<string | null>(null);
  const [formats, setFormats] = useState<StampFormat[]>(['circular', 'rectangular', 'oval']);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sigForm, setSigForm] = useState<Record<string, { first: string; last: string }>>({});

  const load = useCallback(async () => {
    if (!tenantId) {
      setLevels([]);
      setStampsList([]);
      setSignaturesList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [structure, stamps, signatures] = await Promise.all([
        settingsService.getEducationStructure(tenantId),
        settingsService.getStampsList(tenantId),
        settingsService.getSignaturesList(tenantId),
      ]);
      const levelList: LevelOption[] = [{ id: null, name: 'Global (établissement)' }];
      const struct = structure as { levels?: { id: string; name: string; order?: number }[] };
      if (Array.isArray(struct?.levels)) {
        [...struct.levels]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .forEach((l) => levelList.push({ id: l.id, name: l.name }));
      }
      setLevels(levelList);
      setStampsList(Array.isArray(stamps) ? stamps : []);
      setSignaturesList(Array.isArray(signatures) ? signatures : []);

      const next: Record<string, { first: string; last: string }> = {};
      (Array.isArray(signatures) ? signatures : []).forEach((s) => {
        const key = `${s.educationLevelId ?? 'global'}_${s.role}`;
        next[key] = { first: s.holderFirstName ?? '', last: s.holderLastName ?? '' };
      });
      setSigForm((prev) => ({ ...prev, ...next }));
    } catch (e) {
      setError((e as Error)?.message ?? 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const getStampsForLevel = (levelId: string | null) =>
    stampsList.find((s) => (s.educationLevelId ?? null) === (levelId ?? null));

  const getSignatureByLevelAndRole = (levelId: string | null, role: string) =>
    signaturesList.find(
      (s) => (s.educationLevelId ?? null) === (levelId ?? null) && s.role === role
    );

  const handleGenerateStamps = async (educationLevelId: string | null) => {
    if (!tenantId) return;
    setGeneratingStampsFor(educationLevelId ?? 'global');
    setError(null);
    setSuccess(null);
    try {
      await settingsService.generateStamps(tenantId, {
        formats: formats.length ? formats : ['circular', 'rectangular', 'oval'],
        educationLevelId,
      });
      await load();
      setSuccess('Cachets générés pour ce niveau.');
    } catch (e) {
      setError((e as Error)?.message ?? 'Erreur génération cachets');
    } finally {
      setGeneratingStampsFor(null);
    }
  };

  const handleGenerateSignature = async (
    educationLevelId: string | null,
    role: string,
    holderFirstName: string,
    holderLastName: string
  ) => {
    if (!tenantId || !role?.trim()) return;
    const first = holderFirstName.trim();
    const last = holderLastName.trim();
    if (!first || !last) {
      setError('Prénom et nom du responsable sont requis.');
      return;
    }
    const key = `${educationLevelId ?? 'global'}_${role}`;
    setGeneratingSigFor(key);
    setError(null);
    setSuccess(null);
    try {
      await settingsService.generateSignature(tenantId, {
        role,
        holderFirstName: first,
        holderLastName: last,
        educationLevelId,
      });
      await load();
      setSuccess('Signature générée.');
    } catch (e) {
      setError((e as Error)?.message ?? 'Erreur génération signature');
    } finally {
      setGeneratingSigFor(null);
    }
  };

  const assetUrl = (
    type: 'circular' | 'rectangular' | 'oval' | 'signature',
    educationLevelId?: string | null,
    signatureId?: string | null
  ) => settingsService.getStampsAssetUrl(type, tenantId ?? undefined, educationLevelId, signatureId);

  const toggleFormat = (f: StampFormat) => {
    setFormats((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const sigFormKey = (levelId: string | null, role: string) => `${levelId ?? 'global'}_${role}`;
  const setSigFormField = (levelId: string | null, role: string, field: 'first' | 'last', value: string) => {
    const key = sigFormKey(levelId, role);
    setSigForm((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { first: '', last: '' }), [field]: value },
    }));
  };

  if (!tenantId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
        Sélectionnez un établissement pour gérer les cachets et signatures par niveau scolaire.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-medium mb-1">Cachets et signatures par niveau scolaire</p>
          <p>
            Les cachets et signatures sont rattachés à chaque niveau (Global, Maternelle, Primaire, Secondaire). Vous pouvez générer les cachets (formats circulaire, rectangulaire, ovale) et la signature de chaque responsable (Directeur, Comptable, etc.) par niveau. Renseignez l&apos;onglet Identité avant de générer les cachets.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm">{success}</div>
      )}

      {/* Choix des formats (commun à tous les niveaux) */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
        <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <Stamp className="w-5 h-5" />
          Formats des cachets à générer
        </h4>
        <div className="flex flex-wrap gap-4">
          {(['circular', 'rectangular', 'oval'] as StampFormat[]).map((f) => (
            <label key={f} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formats.includes(f)}
                onChange={() => toggleFormat(f)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">{FORMAT_LABELS[f]}</span>
            </label>
          ))}
        </div>
      </div>

      {levels.map((level) => {
        const stamps = getStampsForLevel(level.id);
        const levelIdForAsset = level.id ?? undefined;

        return (
          <div key={level.id ?? 'global'} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-3 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-800">{level.name}</h3>
            </div>
            <div className="p-6 space-y-6">
              {/* Cachets pour ce niveau */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Cachets</h4>
                <div className="flex flex-wrap items-end gap-4 mb-4">
                  <div className="flex gap-4 flex-wrap">
                    <div className="w-28 h-28 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                      {stamps?.circularStampUrl ? (
                        <img
                          src={assetUrl('circular', levelIdForAsset)}
                          alt="Circulaire"
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">Circulaire</span>
                      )}
                    </div>
                    <div className="w-40 h-20 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                      {stamps?.rectangularStampUrl ? (
                        <img
                          src={assetUrl('rectangular', levelIdForAsset)}
                          alt="Rectangulaire"
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">Rect.</span>
                      )}
                    </div>
                    <div className="w-32 h-24 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                      {stamps?.ovalStampUrl ? (
                        <img
                          src={assetUrl('oval', levelIdForAsset)}
                          alt="Ovale"
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">Ovale</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGenerateStamps(level.id)}
                    disabled={generatingStampsFor !== null || formats.length === 0}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    {generatingStampsFor === (level.id ?? 'global') ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Générer
                  </button>
                </div>
              </div>

              {/* Signatures par rôle pour ce niveau */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Signatures des responsables
                </h4>
                <div className="space-y-4">
                  {settingsService.SIGNATURE_ROLES.map(({ value: role, label: roleLabel }) => {
                    const sig = getSignatureByLevelAndRole(level.id, role);
                    const key = sigFormKey(level.id, role);
                    const form = sigForm[key] ?? (sig ? { first: sig.holderFirstName, last: sig.holderLastName } : { first: '', last: '' });
                    return (
                      <div
                        key={role}
                        className="flex flex-wrap items-center gap-4 p-3 border border-gray-100 rounded-lg bg-gray-50/50"
                      >
                        <span className="text-sm font-medium text-gray-700 w-40 shrink-0">{roleLabel}</span>
                        <div className="w-48 h-14 border border-gray-200 rounded bg-white flex items-center justify-center overflow-hidden shrink-0">
                          {sig?.signatureUrl ? (
                            <img
                              src={assetUrl('signature', undefined, sig.id)}
                              alt={sig.holderName}
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            <span className="text-gray-400 text-xs">Aucune signature</span>
                          )}
                        </div>
                        <div className="flex gap-2 flex-wrap items-center">
                          <input
                            type="text"
                            placeholder="Prénom"
                            value={form.first}
                            onChange={(e) => setSigFormField(level.id, role, 'first', e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Nom"
                            value={form.last}
                            onChange={(e) => setSigFormField(level.id, role, 'last', e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleGenerateSignature(level.id, role, form.first, form.last)
                            }
                            disabled={generatingSigFor !== null}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                          >
                            {generatingSigFor === key ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <PenTool className="w-3 h-3" />
                            )}
                            {sig?.signatureUrl ? 'Régénérer' : 'Générer'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
