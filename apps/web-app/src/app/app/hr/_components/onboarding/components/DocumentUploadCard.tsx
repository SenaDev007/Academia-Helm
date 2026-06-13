'use client';

import { FileText, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { DOCUMENT_CONFIG, REQUIRED_DOCUMENTS } from '../types';

interface DocumentUploadCardProps {
  documentType: string;
  file: File | null;
  uploaded: boolean;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
}

export function DocumentUploadCard({
  documentType,
  file,
  uploaded,
  onFileSelect,
  onFileRemove,
}: DocumentUploadCardProps) {
  const config = DOCUMENT_CONFIG[documentType];
  if (!config) return null;

  const isRequired = REQUIRED_DOCUMENTS.includes(documentType);
  const isValid = !!file && file.size <= 5 * 1024 * 1024;
  const isTooLarge = !!file && file.size > 5 * 1024 * 1024;

  return (
    <div
      className={`border rounded-xl p-4 bg-white shadow-sm transition-all ${
        uploaded
          ? 'border-emerald-200 bg-emerald-50/30'
          : isRequired && !file
          ? 'border-amber-200 bg-amber-50/20'
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`p-2.5 rounded-lg border ${
              uploaded
                ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                : 'bg-slate-50 border-slate-100 text-slate-400'
            }`}
          >
            {uploaded ? <CheckCircle className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-800 truncate">{config.label}</p>
              {isRequired ? (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                  Obligatoire
                </span>
              ) : (
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                  Facultatif
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {uploaded
                ? 'Téléversé avec succès'
                : file
                ? `${file.name} (${(file.size / 1024).toFixed(1)} Ko)`
                : 'Aucun fichier sélectionné'}
            </p>
            {isTooLarge && (
              <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Fichier trop volumineux (max 5 Mo)
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {file && !uploaded && (
            <button
              type="button"
              onClick={onFileRemove}
              className="p-1.5 text-red-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
              title="Supprimer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {!uploaded && (
            <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold px-3 py-2 rounded-lg transition shrink-0">
              <Upload className="h-3.5 w-3.5" /> Choisir
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) onFileSelect(selectedFile);
                }}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
