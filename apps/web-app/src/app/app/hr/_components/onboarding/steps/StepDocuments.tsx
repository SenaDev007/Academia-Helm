'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import { DocumentUploadCard } from '../components/DocumentUploadCard';
import { DOCUMENT_CONFIG, REQUIRED_DOCUMENTS } from '../types';

interface StepDocumentsProps {
  documents: { [documentType: string]: File | null };
  uploadedDocuments: { [documentType: string]: boolean };
  onFileSelect: (documentType: string, file: File) => void;
  onFileRemove: (documentType: string) => void;
}

export function StepDocuments({ documents, uploadedDocuments, onFileSelect, onFileRemove }: StepDocumentsProps) {
  const requiredUploaded = REQUIRED_DOCUMENTS.filter((d) => uploadedDocuments[d] || documents[d]).length;
  const totalRequired = REQUIRED_DOCUMENTS.length;
  const allRequiredUploaded = requiredUploaded >= totalRequired;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <CheckCircle className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">Pi&egrave;ces Justificatives</h4>
          <p className="text-[11px] text-slate-400">T&eacute;l&eacute;versez les documents requis pour le dossier RH</p>
        </div>
      </div>

      {/* Progress indicator */}
      <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
        allRequiredUploaded
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-amber-50 border-amber-200 text-amber-700'
      }`}>
        {allRequiredUploaded ? (
          <CheckCircle className="h-4 w-4 shrink-0" />
        ) : (
          <AlertCircle className="h-4 w-4 shrink-0" />
        )}
        <span>
          {allRequiredUploaded
            ? 'Tous les documents obligatoires ont \u00e9t\u00e9 fournis'
            : `${requiredUploaded}/${totalRequired} documents obligatoires fournis`}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-white/60 ml-2">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(requiredUploaded / totalRequired) * 100}%`,
              backgroundColor: allRequiredUploaded ? '#059669' : '#f5b335',
            }}
          />
        </div>
      </div>

      {/* Document cards */}
      <div className="space-y-3">
        {Object.keys(DOCUMENT_CONFIG).map((docType) => (
          <DocumentUploadCard
            key={docType}
            documentType={docType}
            file={documents[docType] || null}
            uploaded={!!uploadedDocuments[docType]}
            onFileSelect={(file) => onFileSelect(docType, file)}
            onFileRemove={() => onFileRemove(docType)}
          />
        ))}
      </div>
    </div>
  );
}
