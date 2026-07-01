/**
 * Contenu du sous-module Admission & cycle de vie (sans ModuleContainer).
 * Utilisé dans StudentsModulePage pour affichage par onglet (même page que Paramètres).
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, CheckCircle, XCircle, Clock, Users, Loader2, Filter, MoreHorizontal } from 'lucide-react';
import { FormModal } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatGradeLabel } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import StudentEnrollmentForm from '@/components/students/StudentEnrollmentForm';
import { studentsService } from '@/services/students.service';
import { financeService } from '@/services/finance.service';
import { toast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api/client';
import EntitySyncIndicator from '@/components/offline/EntitySyncIndicator';
import { useEntitySyncStatusBatch } from '@/hooks/useEntitySyncStatus';

interface Enrollment {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode?: string;
    matricule?: string | null;
  };
  class?: { id: string; name: string };
  enrollmentType: string;
  enrollmentDate: string;
  status: string;
}

export default function EnrollmentsContent() {
  const { academicYear, schoolLevel, tenantId } = useModuleContext();
  const syncStatuses = useEntitySyncStatusBatch('STUDENT', tenantId ?? undefined);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (academicYear && schoolLevel) loadEnrollments();
  }, [academicYear, schoolLevel]);

  const loadEnrollments = async () => {
    if (!academicYear || !schoolLevel) return;
    setIsLoading(true);
    try {
      const params = {
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
      };
      const response = await studentsService.getEnrollments(params);
      setEnrollments(response);
    } catch (e: any) {
      console.error('Failed to load enrollments:', e);
      toast({ title: 'Erreur', description: e.message || 'Impossible de charger les inscriptions', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VALIDATED':
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VALIDATED':
      case 'ACTIVE':
        return <CheckCircle className="w-4 h-4" />;
      case 'PENDING':
        return <Clock className="w-4 h-4" />;
      case 'REJECTED':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
        {/* Header Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Inscrits', value: enrollments.length, icon: <Users className="text-blue-600" />, color: 'bg-blue-50' },
            { label: 'Nouveaux', value: enrollments.filter(e => e.enrollmentType === 'NEW').length, icon: <Plus className="text-emerald-600" />, color: 'bg-emerald-50' },
            { label: 'Réinscrits', value: enrollments.filter(e => e.enrollmentType === 'REPEAT' || e.enrollmentType === 'PROMOTION').length, icon: <CheckCircle className="text-indigo-600" />, color: 'bg-indigo-50' },
            { label: 'En attente', value: enrollments.filter(e => e.status === 'PENDING').length, icon: <Clock className="text-amber-600" />, color: 'bg-amber-50' },
          ].map((stat, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={i} 
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4"
            >
              <div className={`p-3 rounded-lg ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-bold text-slate-900">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un élève ou matricule..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
              />
            </div>
            <button className="p-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-slate-600">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-md shadow-blue-200 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Nouvelle Inscription
            </button>
          </div>
        </div>

        {/* Main Table Content */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-slate-500 font-medium">Récupération des inscriptions...</p>
            </div>
          ) : enrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                <Users className="w-8 h-8" />
              </div>
              <p className="text-slate-500 font-medium">Aucune inscription pour ce niveau</p>
            </div>
          ) : (
            <div className="overflow-x-auto h-full">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Élève</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Classe</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Sync</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <AnimatePresence mode="popLayout">
                    {enrollments.map((enrollment, idx) => (
                      <motion.tr 
                        key={enrollment.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                              {enrollment.student.lastName[0]}{enrollment.student.firstName[0]}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                                {enrollment.student.lastName.toUpperCase()} {enrollment.student.firstName}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400">
                                {enrollment.student.matricule || enrollment.student.studentCode || '—'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                          {formatGradeLabel(enrollment.class?.name) || <span className="text-amber-500">Non affecté</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                             enrollment.enrollmentType === 'NEW' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-slate-50 text-slate-700 border border-slate-100'
                           }`}>
                             {enrollment.enrollmentType}
                           </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {new Date(enrollment.enrollmentDate).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(
                              enrollment.status
                            )}`}
                          >
                            {getStatusIcon(enrollment.status)}
                            {enrollment.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <EntitySyncIndicator variant="dot" status={syncStatuses[enrollment.id] ?? 'UNKNOWN'} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-blue-600 transition-all">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <FormModal
        title="Nouvelle inscription"
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        size="xl"
        actions={null}
      >
        {academicYear && schoolLevel ? (
          <StudentEnrollmentForm
            academicYearId={academicYear.id}
            schoolLevelId={schoolLevel.id}
            onSubmit={async (data) => {
              try {
                let student: any;
                if (data.operation === 'PRE_REGISTER') {
                  student = await studentsService.preRegister({
                    academicYearId: academicYear.id,
                    schoolLevelId: schoolLevel.id,
                    firstName: data.student.firstName,
                    lastName: data.student.lastName,
                    dateOfBirth: data.student.dateOfBirth,
                    gender: data.student.gender,
                    nationality: data.student.nationality,
                    placeOfBirth: data.student.placeOfBirth,
                    photoUrl: data.student.photoUrl,
                    regimeType: undefined,
                    classId: data.classId,
                  });
                } else {
                  student = await studentsService.create({
                    ...data.student,
                    academicYearId: academicYear.id,
                    schoolLevelId: schoolLevel.id,
                  });
                }
                
                await financeService.createStudentFeeProfile({
                  studentId: student.id,
                  academicYearId: academicYear.id,
                  feeRegimeId: data.feeProfile.feeRegimeId,
                  justification: data.feeProfile.justification,
                }).catch(() => undefined);
                if (data.guardians?.length) {
                  for (const g of data.guardians) {
                    if (!g.firstName?.trim() && !g.lastName?.trim()) continue;
                    await studentsService.addGuardians(student.id, {
                      guardians: [{
                        firstName: g.firstName,
                        lastName: g.lastName,
                        relationship: g.relationship || 'GUARDIAN',
                        phone: g.phone,
                        email: g.email,
                        isPrimary: g.isPrimary ?? false,
                      }]
                    }).catch(() => undefined);
                  }
                }
                if (data.classId && data.operation === 'ADMIT') {
                  await studentsService.enrollStudent(student.id, {
                    academicYearId: academicYear.id,
                    schoolLevelId: schoolLevel.id,
                    classId: data.classId,
                    enrollmentType: 'NEW',
                    enrollmentDate: new Date().toISOString(),
                  }).catch(() => undefined);
                }
                toast({ title: 'Succès', description: 'Inscription effectuée avec succès', variant: 'success' });
                setIsCreateModalOpen(false);
                loadEnrollments();
              } catch (e: any) {
                toast({ title: 'Erreur', description: e.message || 'Erreur lors de l\'inscription', variant: 'error' });
              }
            }}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        ) : (
          <div className="text-center py-8 text-sm text-gray-600">
            Veuillez sélectionner une année scolaire et un niveau
          </div>
        )}
      </FormModal>
    </>
  );
}
