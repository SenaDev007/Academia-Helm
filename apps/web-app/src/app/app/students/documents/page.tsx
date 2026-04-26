/**
 * ============================================================================
 * SOUS-MODULE : DOCUMENTS ADMINISTRATIFS
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Upload, FileText, Trash2 } from 'lucide-react';
import {
  ModuleContainer,
  FormModal,
  ConfirmModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSearchParams } from 'next/navigation';

interface StudentDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
}

interface UploadForm {
  documentType: string;
  fileName: string;
}

const EMPTY_FORM: UploadForm = { documentType: '', fileName: '' };

export default function DocumentsPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId');
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<StudentDocument | null>(null);
  const [form, setForm] = useState<UploadForm>(EMPTY_FORM);

  useEffect(() => {
    if (studentId) loadDocuments();
  }, [studentId, academicYear, schoolLevel]);

  const loadDocuments = async () => {
    if (!studentId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/students/${studentId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!studentId || !form.documentType || !form.fileName) return;
    setIsSaving(true);
    try {
      await fetch(`/api/students/${studentId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: form.documentType,
          fileName: form.fileName,
        }),
      });
      setIsUploadModalOpen(false);
      setForm(EMPTY_FORM);
      loadDocuments();
    } catch (error) {
      console.error('Failed to upload document:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!studentId || !selectedDocument) return;
    try {
      await fetch(`/api/students/${studentId}/documents/${selectedDocument.id}`, {
        method: 'DELETE',
      });
      setIsDeleteModalOpen(false);
      setSelectedDocument(null);
      loadDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      BIRTH_CERTIFICATE: 'Acte de naissance',
      ID_CARD: "Carte d'identité",
      PHOTO: 'Photo',
      MEDICAL_CERTIFICATE: 'Certificat médical',
    };
    return labels[type] || type;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Documents administratifs',
          description: 'Gestion des documents des élèves',
          icon: 'fileText',
          actions: studentId ? (
            <button
              onClick={() => { setForm(EMPTY_FORM); setIsUploadModalOpen(true); }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Upload className="w-4 h-4" />
              <span>Ajouter un document</span>
            </button>
          ) : null,
        }}
        content={{
          layout: 'table',
          isLoading,
          emptyMessage: !studentId
            ? 'Sélectionnez un élève pour voir ses documents'
            : documents.length === 0
            ? 'Aucun document enregistré pour cet élève'
            : undefined,
          children: (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fichier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Taille</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {getDocumentTypeLabel(doc.documentType)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{doc.fileName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatFileSize(doc.fileSize)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => { setSelectedDocument(doc); setIsDeleteModalOpen(true); }}
                        className="text-red-600 hover:text-red-900"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        }}
      />

      <FormModal
        title="Ajouter un document"
        isOpen={isUploadModalOpen}
        onClose={() => { setIsUploadModalOpen(false); setForm(EMPTY_FORM); }}
        size="md"
        actions={
          <>
            <button
              onClick={() => { setIsUploadModalOpen(false); setForm(EMPTY_FORM); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleUpload}
              disabled={isSaving || !form.documentType || !form.fileName}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de document *</label>
            <select
              value={form.documentType}
              onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Type de document"
            >
              <option value="">Sélectionner</option>
              <option value="BIRTH_CERTIFICATE">Acte de naissance</option>
              <option value="ID_CARD">Carte d'identité</option>
              <option value="PHOTO">Photo</option>
              <option value="MEDICAL_CERTIFICATE">Certificat médical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du fichier *</label>
            <input
              type="text"
              value={form.fileName}
              onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))}
              placeholder="Ex: acte-naissance-dupont.pdf"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        title="Supprimer le document"
        message={`Êtes-vous sûr de vouloir supprimer "${selectedDocument?.fileName}" ?`}
        type="danger"
        isOpen={isDeleteModalOpen}
        onConfirm={handleDelete}
        onCancel={() => { setIsDeleteModalOpen(false); setSelectedDocument(null); }}
        confirmLabel="Supprimer"
      />
    </>
  );
}
