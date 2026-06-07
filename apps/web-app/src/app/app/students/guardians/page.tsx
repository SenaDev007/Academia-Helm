/**
 * ============================================================================
 * SOUS-MODULE : RESPONSABLES LÉGAUX
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, User, Phone, Mail, MapPin, Edit, Trash2 } from 'lucide-react';
import {
  ModuleContainer,
  FormModal,
  ConfirmModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSearchParams } from 'next/navigation';

interface Guardian {
  id: string;
  guardian: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  relationship: string;
  isPrimary: boolean;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode?: string;
  };
}

interface GuardianForm {
  firstName: string;
  lastName: string;
  relationship: string;
  phone: string;
  email: string;
  address: string;
  isPrimary: boolean;
}

const EMPTY_FORM: GuardianForm = {
  firstName: '',
  lastName: '',
  relationship: '',
  phone: '',
  email: '',
  address: '',
  isPrimary: false,
};

export default function GuardiansPage() {
  useModuleContext();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId');
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedGuardian, setSelectedGuardian] = useState<Guardian | null>(null);
  const [form, setForm] = useState<GuardianForm>(EMPTY_FORM);

  useEffect(() => {
    if (studentId) loadGuardians();
  }, [studentId]);

  const loadGuardians = async () => {
    if (!studentId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/students/${studentId}/guardians`);
      if (response.ok) {
        const data = await response.json();
        setGuardians(data);
      }
    } catch (error) {
      console.error('Failed to load guardians:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setSelectedGuardian(null);
    setIsCreateModalOpen(true);
  };

  const openEdit = (guardian: Guardian) => {
    setForm({
      firstName: guardian.guardian.firstName,
      lastName: guardian.guardian.lastName,
      relationship: guardian.relationship,
      phone: guardian.guardian.phone ?? '',
      email: guardian.guardian.email ?? '',
      address: guardian.guardian.address ?? '',
      isPrimary: guardian.isPrimary,
    });
    setSelectedGuardian(guardian);
    setIsEditModalOpen(true);
  };

  const closeModal = () => {
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedGuardian(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!studentId || !form.firstName || !form.lastName || !form.relationship) return;
    setIsSaving(true);
    try {
      if (selectedGuardian) {
        await fetch(
          `/api/students/${studentId}/guardians/${selectedGuardian.guardian.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: form.firstName,
              lastName: form.lastName,
              phone: form.phone || undefined,
              email: form.email || undefined,
              address: form.address || undefined,
              relationship: form.relationship,
              isPrimary: form.isPrimary,
            }),
          }
        );
      } else {
        await fetch(`/api/students/${studentId}/guardians`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone || undefined,
            email: form.email || undefined,
            address: form.address || undefined,
            relationship: form.relationship,
            isPrimary: form.isPrimary,
          }),
        });
      }
      closeModal();
      loadGuardians();
    } catch (error) {
      console.error('Failed to save guardian:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!studentId || !selectedGuardian) return;
    try {
      await fetch(`/api/students/${studentId}/guardians/${selectedGuardian.id}`, {
        method: 'DELETE',
      });
      setIsDeleteModalOpen(false);
      setSelectedGuardian(null);
      loadGuardians();
    } catch (error) {
      console.error('Failed to delete guardian:', error);
    }
  };

  const getRelationshipLabel = (relationship: string) => {
    const labels: Record<string, string> = {
      MOTHER: 'Mère',
      FATHER: 'Père',
      GUARDIAN: 'Tuteur',
      GRANDMOTHER: 'Grand-mère',
      GRANDFATHER: 'Grand-père',
    };
    return labels[relationship] || relationship;
  };

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Responsables légaux',
          description: 'Gestion des responsables légaux des élèves',
          icon: 'users',
          actions: studentId ? (
            <button
              onClick={openCreate}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un responsable</span>
            </button>
          ) : null,
        }}
        content={{
          layout: 'cards',
          isLoading,
          emptyMessage: !studentId
            ? 'Sélectionnez un élève pour voir ses responsables légaux'
            : guardians.length === 0
            ? 'Aucun responsable légal enregistré'
            : undefined,
          children: guardians.map((guardian) => (
            <div
              key={guardian.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {guardian.guardian.firstName} {guardian.guardian.lastName}
                      {guardian.isPrimary && (
                        <span className="ml-2 text-xs text-blue-600 font-medium">
                          (Principal)
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {getRelationshipLabel(guardian.relationship)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openEdit(guardian)}
                    className="text-yellow-600 hover:text-yellow-900"
                    title="Modifier"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedGuardian(guardian);
                      setIsDeleteModalOpen(true);
                    }}
                    className="text-red-600 hover:text-red-900"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {guardian.guardian.phone && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{guardian.guardian.phone}</span>
                  </div>
                )}
                {guardian.guardian.email && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>{guardian.guardian.email}</span>
                  </div>
                )}
                {guardian.guardian.address && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{guardian.guardian.address}</span>
                  </div>
                )}
              </div>
            </div>
          )),
        }}
      />

      <FormModal
        title={selectedGuardian ? 'Modifier le responsable' : 'Ajouter un responsable'}
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={closeModal}
        size="lg"
        actions={
          <>
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !form.firstName || !form.lastName || !form.relationship}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement…' : selectedGuardian ? 'Modifier' : 'Ajouter'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prénom *
              </label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom *
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Relation *
            </label>
            <select
              value={form.relationship}
              onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Relation"
            >
              <option value="">Sélectionner</option>
              <option value="MOTHER">Mère</option>
              <option value="FATHER">Père</option>
              <option value="GUARDIAN">Tuteur</option>
              <option value="GRANDMOTHER">Grand-mère</option>
              <option value="GRANDFATHER">Grand-père</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse
            </label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Responsable principal</span>
            </label>
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        title="Supprimer le responsable"
        message={`Êtes-vous sûr de vouloir supprimer "${selectedGuardian?.guardian.firstName} ${selectedGuardian?.guardian.lastName}" ?`}
        type="danger"
        isOpen={isDeleteModalOpen}
        onConfirm={handleDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setSelectedGuardian(null);
        }}
        confirmLabel="Supprimer"
      />
    </>
  );
}
