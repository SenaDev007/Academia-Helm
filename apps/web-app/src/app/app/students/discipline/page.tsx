/**
 * ============================================================================
 * SOUS-MODULE : DISCIPLINE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import {
  ModuleContainer,
  FormModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

interface DisciplinaryAction {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode?: string;
  };
  actionType: string;
  description: string;
  actionDate: string;
  duration?: number;
  status: string;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  studentCode?: string;
}

interface DisciplineForm {
  studentId: string;
  actionType: string;
  description: string;
  actionDate: string;
  duration: string;
}

const EMPTY_FORM: DisciplineForm = {
  studentId: '',
  actionType: '',
  description: '',
  actionDate: new Date().toISOString().split('T')[0],
  duration: '',
};

export default function DisciplinePage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [actions, setActions] = useState<DisciplinaryAction[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [form, setForm] = useState<DisciplineForm>(EMPTY_FORM);

  useEffect(() => {
    if (academicYear && schoolLevel) {
      loadDisciplinaryActions();
      loadStudents();
    }
  }, [academicYear, schoolLevel]);

  const loadDisciplinaryActions = async () => {
    if (!academicYear || !schoolLevel) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
      });
      const response = await fetch(`/api/discipline?${params}`);
      if (response.ok) {
        const data = await response.json();
        setActions(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to load disciplinary actions:', error);
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

  const handleCreate = async () => {
    if (!form.studentId || !form.actionType || !form.description || !form.actionDate) return;
    setIsSaving(true);
    try {
      await fetch('/api/discipline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: form.studentId,
          actionType: form.actionType,
          description: form.description,
          actionDate: new Date(form.actionDate).toISOString(),
          duration: form.duration ? parseInt(form.duration, 10) : undefined,
          academicYearId: academicYear?.id,
          schoolLevelId: schoolLevel?.id,
        }),
      });
      setIsCreateModalOpen(false);
      setForm(EMPTY_FORM);
      loadDisciplinaryActions();
    } catch (error) {
      console.error('Failed to create disciplinary action:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getActionTypeColor = (type: string) => {
    switch (type) {
      case 'WARNING': return 'bg-yellow-100 text-yellow-800';
      case 'SUSPENSION': return 'bg-orange-100 text-orange-800';
      case 'EXPULSION': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      WARNING: 'Avertissement',
      SUSPENSION: 'Suspension',
      EXPULSION: 'Expulsion',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ACTIVE: 'Actif',
      RESOLVED: 'Résolu',
      APPEALED: 'En appel',
    };
    return labels[status] || status;
  };

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Discipline',
          description: 'Gestion des incidents disciplinaires et actions',
          icon: 'alertTriangle',
          actions: (
            <button
              onClick={() => {
                setForm(EMPTY_FORM);
                setIsCreateModalOpen(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvel incident</span>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durée (j)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {actions.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      Aucun incident disciplinaire enregistré
                    </td>
                  </tr>
                )}
                {actions.map((action) => (
                  <tr key={action.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {action.student.lastName} {action.student.firstName}
                      </div>
                      <div className="text-sm text-gray-500">{action.student.studentCode}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionTypeColor(action.actionType)}`}>
                        {getActionTypeLabel(action.actionType)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{action.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(action.actionDate).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {action.duration ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        action.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {getStatusLabel(action.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        }}
      />

      <FormModal
        title="Nouvel incident disciplinaire"
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setForm(EMPTY_FORM);
        }}
        size="lg"
        actions={
          <>
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setForm(EMPTY_FORM);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={isSaving || !form.studentId || !form.actionType || !form.description}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement…' : 'Enregistrer'}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type d'action *</label>
            <select
              value={form.actionType}
              onChange={(e) => setForm((f) => ({ ...f, actionType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Type d'action"
            >
              <option value="">Sélectionner</option>
              <option value="WARNING">Avertissement</option>
              <option value="SUSPENSION">Suspension</option>
              <option value="EXPULSION">Expulsion</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Décrivez l'incident disciplinaire…"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={form.actionDate}
                onChange={(e) => setForm((f) => ({ ...f, actionDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durée (jours) — suspension
              </label>
              <input
                type="number"
                min="1"
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                placeholder="Ex: 3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </FormModal>
    </>
  );
}
