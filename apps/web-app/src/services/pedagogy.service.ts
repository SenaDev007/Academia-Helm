/**
 * ============================================================================
 * PEDAGOGY SERVICE - API Client pour le module Pédagogie (Offline-First)
 * ============================================================================
 */

import { apiFetch } from '@/lib/api/client';
import { createEntityOffline, updateEntityOffline, deleteEntityOffline } from '@/lib/offline/offline-business.service';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { LocalSearchService } from '@/lib/offline/local-search.service';

function getTenantId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : "";
}

class PedagogyService {
  
  // --- Class Diaries (Cahier de Textes) ---
  async getClassDiaries(classSubjectId: string): Promise<any> {
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("class_diaries", { tenantId: getTenantId(), filters: { classSubjectId } });
    }
    try {
      return await apiFetch(`/class-diaries?classSubjectId=${classSubjectId}`);
    } catch (e) {
      return LocalSearchService.search("class_diaries", { tenantId: getTenantId(), filters: { classSubjectId } });
    }
  }

  async createClassDiary(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'CLASS_DIARY', data);
    }
    return apiFetch('/class-diaries', { method: 'POST', body: data });
  }

  async updateClassDiary(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, 'CLASS_DIARY', id, data);
    }
    return apiFetch(`/class-diaries/${id}`, { method: 'PUT', body: data });
  }

  // --- Lesson Plans (Fiches Pédagogiques) ---
  async getLessonPlans(classSubjectId?: string): Promise<any> {
    const qs = classSubjectId ? `?classSubjectId=${classSubjectId}` : '';
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("lesson_plans", { tenantId: getTenantId() });
    }
    try {
      return await apiFetch(`/lesson-plans${qs}`);
    } catch (e) {
      return LocalSearchService.search("lesson_plans", { tenantId: getTenantId() });
    }
  }

  async createLessonPlan(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'LESSON_PLAN', data);
    }
    return apiFetch('/lesson-plans', { method: 'POST', body: data });
  }

  async updateLessonPlan(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, 'LESSON_PLAN', id, data);
    }
    return apiFetch(`/lesson-plans/${id}`, { method: 'PUT', body: data });
  }

  // --- Lesson Journals (Cahier Journal) ---
  async getLessonJournals(date?: string): Promise<any> {
    const qs = date ? `?date=${date}` : '';
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("lesson_journals", { tenantId: getTenantId() });
    }
    try {
      // Lesson journals route via pedagogy/teacher controller (daily logs)
      return await apiFetch(`/pedagogy/teacher/documents${qs}`);
    } catch (e) {
      return LocalSearchService.search("lesson_journals", { tenantId: getTenantId() });
    }
  }

  async createLessonJournal(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'LESSON_JOURNAL', data);
    }
    return apiFetch('/pedagogy/teacher/documents', { method: 'POST', body: data });
  }

  async updateLessonJournal(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, 'LESSON_JOURNAL', id, data);
    }
    return apiFetch(`/pedagogy/teacher/documents/${id}`, { method: 'PUT', body: data });
  }

  // --- Teacher Class Assignments ---
  // ⚠️ Uses /pedagogy/teacher-class-assignments (OLD model: teacherId + classSubjectId)
  // NOT /pedagogy/assignments (NEW model: profileId + classId + subjectId) which expects a different payload
  async getTeacherAssignments(teacherId: string, academicYearId: string): Promise<any> {
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("teacher_class_assignments", { tenantId: getTenantId(), filters: { teacherId, academicYearId } });
    }
    try {
      return await apiFetch(`/pedagogy/teacher-class-assignments?teacherId=${teacherId}&academicYearId=${academicYearId}`);
    } catch (e) {
      return LocalSearchService.search("teacher_class_assignments", { tenantId: getTenantId(), filters: { teacherId, academicYearId } });
    }
  }

  // --- Subjects (Matières) ---
  async getSubjects(academicYearId: string): Promise<any> {
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("subjects", { tenantId: getTenantId(), filters: { academicYearId } });
    }
    try {
      return await apiFetch(`/subjects?academicYearId=${academicYearId}`);
    } catch (e) {
      return LocalSearchService.search("subjects", { tenantId: getTenantId(), filters: { academicYearId } });
    }
  }

  async createSubject(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'SUBJECT', data);
    }
    return apiFetch('/subjects', { method: 'POST', body: data });
  }

  async updateSubject(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, 'SUBJECT', id, data);
    }
    return apiFetch(`/subjects/${id}`, { method: 'PUT', body: data });
  }

  async deleteSubject(id: string): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return deleteEntityOffline(tenantId, 'SUBJECT', id);
    }
    return apiFetch(`/subjects/${id}`, { method: 'DELETE' });
  }

  // --- Series (Séries du Secondaire) ---
  async getSeries(academicYearId: string): Promise<any> {
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("academic_series", { tenantId: getTenantId(), filters: { academicYearId } });
    }
    try {
      return await apiFetch(`/pedagogy/academic-series?academicYearId=${academicYearId}`);
    } catch (e) {
      return LocalSearchService.search("academic_series", { tenantId: getTenantId(), filters: { academicYearId } });
    }
  }

  async createSeries(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'ACADEMIC_SERIES', data);
    }
    return apiFetch('/pedagogy/academic-series', { method: 'POST', body: data });
  }

  async updateSeries(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, 'ACADEMIC_SERIES', id, data);
    }
    return apiFetch(`/pedagogy/academic-series/${id}`, { method: 'PUT', body: data });
  }

  async addSubjectToSeries(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'SERIES_SUBJECT', data);
    }
    return apiFetch('/pedagogy/academic-series/subjects', { method: 'POST', body: data });
  }

  async removeSubjectFromSeries(id: string): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return deleteEntityOffline(tenantId, 'SERIES_SUBJECT', id);
    }
    return apiFetch(`/pedagogy/academic-series/subjects/${id}`, { method: 'DELETE' });
  }

  // --- Teachers (Corps Enseignant) ---
  async getTeachers(): Promise<any> {
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("teachers", { tenantId: getTenantId() });
    }
    try {
      return await apiFetch('/teachers');
    } catch (e) {
      return LocalSearchService.search("teachers", { tenantId: getTenantId() });
    }
  }

  async createTeacher(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'TEACHER', data);
    }
    return apiFetch('/teachers', { method: 'POST', body: data });
  }

  async updateTeacher(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, 'TEACHER', id, data);
    }
    return apiFetch(`/teachers/${id}`, { method: 'PUT', body: data });
  }

  // --- Teacher Profiles (Profils Académiques Enseignants) ---
  async getTeacherProfiles(academicYearId: string): Promise<any> {
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("teacher_profiles", { tenantId: getTenantId(), filters: { academicYearId } });
    }
    try {
      return await apiFetch(`/pedagogy/teacher-profiles?academicYearId=${academicYearId}`);
    } catch (e) {
      return LocalSearchService.search("teacher_profiles", { tenantId: getTenantId(), filters: { academicYearId } });
    }
  }

  async createTeacherProfile(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'TEACHER_PROFILE', data);
    }
    return apiFetch('/pedagogy/teacher-profiles', { method: 'POST', body: data });
  }

  async updateTeacherProfile(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, 'TEACHER_PROFILE', id, data);
    }
    return apiFetch(`/pedagogy/teacher-profiles/${id}`, { method: 'PUT', body: data });
  }

  // --- Assignments (Affectations & Classes) ---
  async getAcademicClasses(academicYearId: string): Promise<any> {
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("classes", { tenantId: getTenantId(), filters: { academicYearId } });
    }
    try {
      return await apiFetch(`/pedagogy/academic-structure/classes?academicYearId=${academicYearId}`);
    } catch (e) {
      return LocalSearchService.search("classes", { tenantId: getTenantId(), filters: { academicYearId } });
    }
  }

  async getClassSubjects(classId: string, academicYearId: string): Promise<any> {
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("class_subjects", { tenantId: getTenantId(), filters: { classId, academicYearId } });
    }
    try {
      return await apiFetch(`/pedagogy/class-subjects/${classId}?academicYearId=${academicYearId}`);
    } catch (e) {
      return LocalSearchService.search("class_subjects", { tenantId: getTenantId(), filters: { classId, academicYearId } });
    }
  }

  async removeClassSubject(id: string): Promise<any> {
    return apiFetch(`/pedagogy/class-subjects/${id}`, { method: 'DELETE' });
  }

  async createTeacherAssignment(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'TEACHER_CLASS_ASSIGNMENT', data);
    }
    return apiFetch('/pedagogy/teacher-class-assignments', { method: 'POST', body: data });
  }

  async deleteTeacherAssignment(id: string): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return deleteEntityOffline(tenantId, 'TEACHER_CLASS_ASSIGNMENT', id);
    }
    return apiFetch(`/pedagogy/teacher-class-assignments/${id}`, { method: 'DELETE' });
  }

  // --- Control & Analytics ---
  async getKpiDashboard(academicYearId: string): Promise<any> {
    return apiFetch(`/pedagogy/control/dashboard?academicYearId=${academicYearId}`);
  }

  async getOrionDashboard(academicYearId: string): Promise<any> {
    return apiFetch(`/pedagogy/orion-advanced/dashboard?academicYearId=${academicYearId}`);
  }

  // --- Weekly Semainier (Cahier du Semainier) ---
  async getCurrentSemainier(academicYearId: string, schoolLevelId: string): Promise<any> {
    if (!networkDetectionService.isConnected()) {
      const results = await LocalSearchService.search("weekly_semainier_daily_entries", { tenantId: getTenantId() });
      return results[0] || null;
    }
    try {
      return await apiFetch(`/pedagogy/teacher/semainier/current?academicYearId=${academicYearId}&schoolLevelId=${schoolLevelId}`);
    } catch (e) {
      const results = await LocalSearchService.search("weekly_semainier_daily_entries", { tenantId: getTenantId() });
      return results[0] || null;
    }
  }

  async createSemainier(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'WEEKLY_SEMAINIER', data);
    }
    return apiFetch('/pedagogy/teacher/semainier', { method: 'POST', body: data });
  }

  async addSemainierDailyEntry(semainierId: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'WEEKLY_SEMAINIER', { semainierId, action: 'ADD_ENTRY', ...data });
    }
    return apiFetch(`/pedagogy/teacher/semainier/${semainierId}/daily-entries`, { method: 'POST', body: data });
  }

  async reportSemainierIncident(semainierId: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'WEEKLY_SEMAINIER', { semainierId, action: 'REPORT_INCIDENT', ...data });
    }
    return apiFetch(`/pedagogy/teacher/semainier/${semainierId}/incidents`, { method: 'POST', body: data });
  }

  async submitSemainier(semainierId: string): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline<any>(tenantId, 'WEEKLY_SEMAINIER', semainierId, { status: 'SOUMIS' });
    }
    return apiFetch(`/pedagogy/teacher/semainier/${semainierId}/submit`, { method: 'POST' });
  }

  // --- Tests / Evaluations (Cahier de Test) ---
  async getTests(classSubjectId: string): Promise<any> {
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("exams", { tenantId: getTenantId(), filters: { classSubjectId } });
    }
    try {
      // Evaluations/tests route through class-diaries
      return await apiFetch(`/class-diaries?classSubjectId=${classSubjectId}`);
    } catch (e) {
      return LocalSearchService.search("exams", { tenantId: getTenantId(), filters: { classSubjectId } });
    }
  }

  async createTest(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'EXAM', data);
    }
    return apiFetch('/class-diaries', { method: 'POST', body: data });
  }

  async updateTest(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, 'EXAM', id, data);
    }
    return apiFetch(`/class-diaries/${id}`, { method: 'PUT', body: data });
  }

  async deleteTest(id: string): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return deleteEntityOffline(tenantId, 'EXAM', id);
    }
    return apiFetch(`/class-diaries/${id}`, { method: 'DELETE' });
  }

  // --- Pedagogical Materials ---
  async getPedagogicalMaterials(academicYearId: string): Promise<any> {
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("pedagogical_materials", { tenantId: getTenantId() });
    }
    try {
      return await apiFetch(`/pedagogy/pedagogical-materials?academicYearId=${academicYearId}`);
    } catch (e) {
      return LocalSearchService.search("pedagogical_materials", { tenantId: getTenantId() });
    }
  }

  async createPedagogicalMaterial(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'PEDAGOGICAL_MATERIAL', data);
    }
    return apiFetch('/pedagogy/pedagogical-materials', { method: 'POST', body: data });
  }

  async updatePedagogicalMaterial(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, 'PEDAGOGICAL_MATERIAL', id, data);
    }
    return apiFetch(`/pedagogy/pedagogical-materials/${id}`, { method: 'PUT', body: data });
  }

  async deletePedagogicalMaterial(id: string): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return deleteEntityOffline(tenantId, 'PEDAGOGICAL_MATERIAL', id);
    }
    return apiFetch(`/pedagogy/pedagogical-materials/${id}`, { method: 'DELETE' });
  }

  async addMaterialStock(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'MATERIAL_STOCK', data);
    }
    return apiFetch('/pedagogy/material-stocks', { method: 'POST', body: data });
  }

  async createMaterialAssignment(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'TEACHER_MATERIAL_ASSIGNMENT', data);
    }
    return apiFetch('/pedagogy/teacher-material-assignments', { method: 'POST', body: data });
  }

  // --- Homework Entries (Devoirs & Exercices) ---
  async getHomeworkEntries(classId?: string): Promise<any> {
    const qs = classId ? `?classId=${classId}` : '';
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("homework_entries", { tenantId: getTenantId() });
    }
    try {
      // Homework entries route through daily-logs controller
      return await apiFetch(`/daily-logs${qs}`);
    } catch (e) {
      return LocalSearchService.search("homework_entries", { tenantId: getTenantId() });
    }
  }

  async createHomeworkEntry(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'HOMEWORK_ENTRY', data);
    }
    return apiFetch('/daily-logs', { method: 'POST', body: data });
  }

  async updateHomeworkEntry(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, 'HOMEWORK_ENTRY', id, data);
    }
    return apiFetch(`/daily-logs/${id}`, { method: 'PUT', body: data });
  }

  async deleteHomeworkEntry(id: string): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return deleteEntityOffline(tenantId, 'HOMEWORK_ENTRY', id);
    }
    return apiFetch(`/daily-logs/${id}`, { method: 'DELETE' });
  }
}

export const pedagogyService = new PedagogyService();
