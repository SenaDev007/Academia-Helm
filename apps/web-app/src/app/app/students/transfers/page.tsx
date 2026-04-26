/**
 * ============================================================================
 * SOUS-MODULE : TRANSFERTS
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, ArrowRight, CheckCircle, XCircle, Clock } from 'lucide-react';
import {
  ModuleContainer,
  FormModal,
  CriticalModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

interface TransferRequest {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode?: string;
  };
  fromClass?: { id: string; name: string };
  toClass?: { id: string; name: string };
  fromClassId: string;
  toClassId: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  studentCode?: string;
}

interface Class {
  id: string;
  name: string;
  code: string;
}

interface TransferForm {
  studentId: string;
  fromClassId: string;
  toClassId: string;
  reason: string;
}

const EMPTY_FORM: TransferForm = {
  studentId: '',
  fromClassId: '',
  toClassId: '',
  reason: '',
};

export default function TransfersPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRequest | null>(null);
  const [form, setForm] = useState<TransferForm>(EMPTY_FORM);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (academicYear && schoolLevel) {
      loadTransfers();
      loadStudents();
      loadClasses();
    }
  }, [academicYear, schoolLevel]);

  const loadTransfers = async () => {
    if (!academicYear || !schoolLevel) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
      });
      const response = await fetch(`/api/transfers?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTransfers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to load transfers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStudents = async () => {
    if (!academicYear || !schoolLevel) return;
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
        limit: '200',
      });
      const response = await fetch(`/api/students?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStudents(Array.isArray(data) ? data : (data.data ?? []));
      }
    } catch (error) {
      console.error('Failed to load students:', error);
    }
  };

  const loadClasses = async () => {
    if (!academicYear) return;
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (schoolLevel?.id && schoolLevel.id !== 'ALL') params.set('schoolLevelId', schoolLevel.id);
      const response = await fetch(`/api/classes?${params}`);
      if (response.ok) {
        const data = await response.json();
        setClasses(Array.isArray(data) ? data : (data.data ?? []));
      }
    } catch (error) {
      console.error('Failed to load classes:', error);
    }
  };

  const handleCreate = async () => {
    if (!form.studentId || !form.fromClassId || !form.toClassId) return;
    setIsSaving(true);
    try {
      await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: form.studentId,
          fromClassId: form.fromClassId,
          toClassId: form.toClassId,
          reason: form.reason || undefined,
          academicYearId: academicYear?.id,
        }),
      });
      setIsCreateModalOpen(false);
      setForm(EMPTY_FORM);
      loadTransfers();
    } catch (error) {
      console.error('Failed to create transfer:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmApprove = async () => {
    if (!selectedTransfer) return;
    try {
      await fetch(`/api/transfers/${selectedTransfer.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'director' }),
      });
      setIsApproveModalOpen(false);
      setSelectedTransfer(null);
      loadTransfers();
    } catch (error) {
      console.error('Failed to approve transfer:', error);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedTransfer) return;
    try {
      await fetch(`/api/transfers/${selectedTransfer.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason || undefined }),
      });
      setIsRejectModalOpen(false);
      setSelectedTransfer(null);
      setRejectReason('');
      loadTransfers();
    } catch (error) {
      console.error('Failed to reject transfer:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = { APPROVED: 'Approuvé', PENDING: 'En attente', REJECTED: 'Refusé' };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle className="w-4 h-4" />;
      case 'PENDING': return <Clock className="w-4 h-4" />;
      case 'REJECTED': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getClassName = (id: string) => classes.find((c) => c.id === id)?.name ?? id;

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Transferts',
          description: 'Gestion des changements de classe des élèves',
          icon: 'arrowRight',
          actions: (
            <button
              onClick={() => {
                setForm(EMPTY_FORM);
                setIsCreateModalOpen(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau transfert</span>
            </button>
          ),
        }}
        content={{
          layout: 'table',
          isLoading,
          children: (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Élève</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">De</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vers</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raison</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transfers.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                      Aucun transfert enregistré
                    </td>
                  </tr>
                )}
                {transfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {transfer.student.lastName} {transfer.student.firstName}
                      </div>
                      <div className="text-sm text-gray-500">{transfer.student.studentCode}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transfer.fromClass?.name ?? getClassName(transfer.fromClassId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {transfer.toClass?.name ?? getClassName(transfer.toClassId)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{transfer.reason || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center space-x-1 w-fit ${getStatusColor(transfer.status)}`}>
                        {getStatusIcon(transfer.status)}
                        <span>{getStatusLabel(transfer.status)}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      {transfer.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => { setSelectedTransfer(transfer); setIsApproveModalOpen(true); }}
                            className="text-green-600 hover:text-green-900"
                          >
                            Approuver
                          </button>
                          <button
                            onClick={() => { setSelectedTransfer(transfer); setRejectReason(''); setIsRejectModalOpen(true); }}
                            className="text-red-600 hover:text-red-900"
                          >
                            Rejeter
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        }}
      />

      <FormModal
        title="Nouveau transfert"
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setForm(EMPTY_FORM); }}
        size="lg"
        actions={
          <>
            <button
              onClick={() => { setIsCreateModalOpen(false); setForm(EMPTY_FORM); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={isSaving || !form.studentId || !form.fromClassId || !form.toClassId}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement…' : 'Créer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Élève *</label>
            <select
              value={form.studentId}
              onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Élève"
            >
              <option value="">Sélectionner un élève</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.lastName} {s.firstName}{s.studentCode ? ` (${s.studentCode})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classe actuelle *</label>
              <select
                value={form.fromClassId}
                onChange={(e) => setForm((f) => ({ ...f, fromClassId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Classe actuelle"
              >
                <option value="">Sélectionner</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nouvelle classe *</label>
              <select
                value={form.toClassId}
                onChange={(e) => setForm((f) => ({ ...f, toClassId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Nouvelle classe"
              >
                <option value="">Sélectionner</option>
                {classes.filter((c) => c.id !== form.fromClassId).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raison</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3}
              placeholder="Motif du transfert…"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </FormModal>

      <CriticalModal
        title="Approuver le transfert"
        message={`Vous êtes sur le point d'approuver le transfert de ${selectedTransfer?.student.lastName} ${selectedTransfer?.student.firstName}.`}
        warning="Cette action est irréversible et modifiera l'inscription de l'élève."
        isOpen={isApproveModalOpen}
        onConfirm={handleConfirmApprove}
        onCancel={() => { setIsApproveModalOpen(false); setSelectedTransfer(null); }}
        confirmLabel="Approuver le transfert"
      />

      <FormModal
        title="Rejeter le transfert"
        isOpen={isRejectModalOpen}
        onClose={() => { setIsRejectModalOpen(false); setSelectedTransfer(null); setRejectReason(''); }}
        size="md"
        actions={
          <>
            <button
              onClick={() => { setIsRejectModalOpen(false); setSelectedTransfer(null); setRejectReason(''); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirmReject}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Rejeter
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Transfert de <strong>{selectedTransfer?.student.lastName} {selectedTransfer?.student.firstName}</strong>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motif du rejet</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Expliquez la raison du rejet…"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </FormModal>
    </>
  );
}
