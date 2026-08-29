'use client';

import { CheckCircle, Info } from 'lucide-react';
import { DocumentUploadCard } from '../components/DocumentUploadCard';
import { DOCUMENT_CONFIG } from '../types';

interface StepDocumentsProps {
  documents: { [documentType: string]: File | null };
  uploadedDocuments: { [documentType: string]: boolean };
  onFileSelect: (documentType: string, file: File) => void;
  onFileRemove: (documentType: string) => void;
}

export function StepDocuments({ documents, uploadedDocuments, onFileSelect, onFileRemove }: StepDocumentsProps) {
  // ⭐ Tous les documents sont optionnels en embauche interne — l'utilisateur
  //    peut en téléverser aucun, certains ou tous, et continuer librement.
  const uploadedCount = Object.keys(DOCUMENT_CONFIG).filter(
    (d) => uploadedDocuments[d] || documents[d]
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <CheckCircle className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">Pi&egrave;ces Justificatives</h4>
          <p className="text-[11px] text-slate-400">T&eacute;l&eacute;versez les documents disponibles pour le dossier RH</p>
        </div>
      </div>

      {/* ⭐ Info : tous les documents sont optionnels */}
      <div className="p-3 rounded-xl border bg-blue-50 border-blue-200 text-blue-700 flex items-center gap-2 text-xs">
        <Info className="h-4 w-4 shrink-0" />
        <span>
          Tous les documents sont <strong>optionnels</strong> en embauche interne. Vous pouvez
          en téléverser maintenant ou plus tard depuis la fiche du personnel.
          {uploadedCount > 0 && (
            <span className="ml-1 text-emerald-700">
              · {uploadedCount} document{uploadedCount > 1 ? 's' : ''} fourni{uploadedCount > 1 ? 's' : ''}
            </span>
          )}
        </span>
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
