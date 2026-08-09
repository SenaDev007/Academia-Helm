import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/api_result.dart';

/// StudentsService — mirrors the web app's students.service.ts
/// All endpoints are under /students/*
class StudentsServiceV2 {
  StudentsServiceV2(this._apiClient);
  final ApiClient _apiClient;

  /// GET /students/statistics?academicYearId=&schoolLevelId=
  Future<ApiResult<Map<String, dynamic>>> getStatistics({
    String? academicYearId,
    String? schoolLevelId,
  }) async {
    return _apiClient.getRaw(
      '/students/statistics',
      queryParameters: {
        if (academicYearId != null) 'academicYearId': academicYearId,
        if (schoolLevelId != null) 'schoolLevelId': schoolLevelId,
      },
    );
  }

  /// GET /students?academicYearId=&schoolLevelId=&classId=&page=&limit=
  Future<ApiResult<Map<String, dynamic>>> getStudents({
    String? academicYearId,
    String? schoolLevelId,
    String? classId,
    int page = 1,
    int limit = 50,
    String? search,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.students,
      queryParameters: {
        if (academicYearId != null) 'academicYearId': academicYearId,
        if (schoolLevelId != null) 'schoolLevelId': schoolLevelId,
        if (classId != null) 'classId': classId,
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
  }

  /// GET /students/enrollments?academicYearId=
  Future<ApiResult<Map<String, dynamic>>> getEnrollments({
    String? academicYearId,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.studentEnrollments,
      queryParameters: {
        if (academicYearId != null) 'academicYearId': academicYearId,
      },
    );
  }

  /// GET /students/admissions?academicYearId=&schoolLevelId=
  Future<ApiResult<Map<String, dynamic>>> getAdmissions({
    String? academicYearId,
    String? schoolLevelId,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.studentAdmissions,
      queryParameters: {
        if (academicYearId != null) 'academicYearId': academicYearId,
        if (schoolLevelId != null) 'schoolLevelId': schoolLevelId,
      },
    );
  }

  /// POST /students/admissions/:id/submit
  Future<ApiResult<Map<String, dynamic>>> submitAdmission(String id) async {
    return _apiClient.postRaw(ApiConfig.studentAdmissionSubmit(id), data: {});
  }

  /// POST /students/admissions/:id/decide
  Future<ApiResult<Map<String, dynamic>>> decideAdmission(
    String id, {
    required String decision,
    String? comment,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.studentAdmissionDecide(id),
      data: {'decision': decision, if (comment != null) 'comment': comment},
    );
  }

  /// POST /students/admissions/:id/convert
  Future<ApiResult<Map<String, dynamic>>> convertAdmission(String id) async {
    return _apiClient.postRaw(ApiConfig.studentAdmissionConvert(id), data: {});
  }

  /// GET /students/:id/dossier
  Future<ApiResult<Map<String, dynamic>>> getStudentDossier(String id) async {
    return _apiClient.getRaw(ApiConfig.studentDossier(id));
  }

  /// GET /students/:id/history
  Future<ApiResult<Map<String, dynamic>>> getStudentHistory(String id) async {
    return _apiClient.getRaw(ApiConfig.studentHistory(id));
  }

  /// GET /students/identifiers/stats
  Future<ApiResult<Map<String, dynamic>>> getIdentifierStats() async {
    return _apiClient.getRaw(ApiConfig.studentIdentifiersStats);
  }

  /// POST /students/:id/generate-matricule
  Future<ApiResult<Map<String, dynamic>>> generateMatricule(String id) async {
    return _apiClient.postRaw(ApiConfig.studentGenerateMatricule(id), data: {});
  }

  /// GET /students/id-cards/stats
  Future<ApiResult<Map<String, dynamic>>> getIdCardStats() async {
    return _apiClient.getRaw(ApiConfig.studentIdCardStats);
  }

  /// GET /students/search-by-matricule/:matricule
  Future<ApiResult<Map<String, dynamic>>> searchByMatricule(String matricule) async {
    return _apiClient.getRaw(ApiConfig.studentSearchByMatricule(matricule));
  }

  // ── Admissions CRUD ────────────────────────────────────────────────────

  /// POST /students/admissions — create new admission
  Future<ApiResult<Map<String, dynamic>>> createAdmission(
      Map<String, dynamic> data) async {
    return _apiClient.postRaw(ApiConfig.studentAdmissions, data: data);
  }

  /// PATCH /students/admissions/:id — update admission
  Future<ApiResult<Map<String, dynamic>>> updateAdmission(
      String id, Map<String, dynamic> data) async {
    return _apiClient.patchRaw(
        ApiConfig.studentAdmissionById(id), data: data);
  }

  /// POST /students/admissions/:id/accept — accept admission
  Future<ApiResult<Map<String, dynamic>>> acceptAdmission(String id,
      {String? comment}) async {
    return _apiClient.postRaw('/students/admissions/$id/accept',
        data: {if (comment != null) 'comment': comment});
  }

  /// POST /students/admissions/:id/accept-and-enroll
  Future<ApiResult<Map<String, dynamic>>> acceptAndEnrollAdmission(
      String id) async {
    return _apiClient.postRaw('/students/admissions/$id/accept-and-enroll',
        data: {});
  }

  /// POST /students/admissions/:id/reject — reject admission
  Future<ApiResult<Map<String, dynamic>>> rejectAdmission(String id,
      {String? reason}) async {
    return _apiClient.postRaw('/students/admissions/$id/reject',
        data: {if (reason != null) 'reason': reason});
  }

  /// DELETE /students/admissions/:id — delete admission
  Future<ApiResult<Map<String, dynamic>>> deleteAdmission(String id) async {
    return _apiClient.deleteRaw(ApiConfig.studentAdmissionById(id));
  }

  // ── Student CRUD ───────────────────────────────────────────────────────

  /// POST /students — create new student
  Future<ApiResult<Map<String, dynamic>>> createStudent(
      Map<String, dynamic> data) async {
    return _apiClient.postRaw(ApiConfig.students, data: data);
  }

  /// PUT /students/:id — update student
  Future<ApiResult<Map<String, dynamic>>> updateStudent(
      String id, Map<String, dynamic> data) async {
    return _apiClient.putRaw('/students/$id', data: data);
  }

  /// DELETE /students/:id — delete student
  Future<ApiResult<Map<String, dynamic>>> deleteStudent(String id) async {
    return _apiClient.deleteRaw('/students/$id');
  }

  /// POST /students/:id/enroll — enroll student
  Future<ApiResult<Map<String, dynamic>>> enrollStudent(String id,
      Map<String, dynamic> data) async {
    return _apiClient.postRaw(ApiConfig.studentEnroll(id), data: data);
  }

  // ── Movements (Withdraw / Archive / Reintegrate) ───────────────────────

  /// POST /students/withdraw
  Future<ApiResult<Map<String, dynamic>>> withdrawStudent(
      String id, String reason) async {
    return _apiClient.postRaw('/students/withdraw',
        data: {'studentId': id, 'reason': reason});
  }

  /// POST /students/:id/archive
  Future<ApiResult<Map<String, dynamic>>> archiveStudent(String id,
      {String? reason}) async {
    return _apiClient.postRaw('/students/$id/archive',
        data: {if (reason != null) 'reason': reason});
  }

  /// POST /students/reintegrate
  Future<ApiResult<Map<String, dynamic>>> reintegrateStudent(String id) async {
    return _apiClient.postRaw('/students/reintegrate',
        data: {'studentId': id});
  }

  // ── Transfers ──────────────────────────────────────────────────────────

  /// GET /students/transfers/outgoing
  Future<ApiResult<Map<String, dynamic>>> getOutgoingTransfers({
    String? academicYearId,
  }) async {
    return _apiClient.getRaw('/students/transfers/outgoing',
        queryParameters: {
          if (academicYearId != null) 'academicYearId': academicYearId,
        });
  }

  /// GET /students/transfers/incoming
  Future<ApiResult<Map<String, dynamic>>> getIncomingTransfers({
    String? academicYearId,
  }) async {
    return _apiClient.getRaw('/students/transfers/incoming',
        queryParameters: {
          if (academicYearId != null) 'academicYearId': academicYearId,
        });
  }

  /// POST /students/transfers — create transfer request
  Future<ApiResult<Map<String, dynamic>>> createTransfer(
      Map<String, dynamic> data) async {
    return _apiClient.postRaw('/students/transfers', data: data);
  }

  /// POST /students/transfers/:id/approve
  Future<ApiResult<Map<String, dynamic>>> approveTransfer(String id,
      {String? comment}) async {
    return _apiClient.postRaw('/students/transfers/$id/approve',
        data: {if (comment != null) 'comment': comment});
  }

  /// POST /students/transfers/:id/reject
  Future<ApiResult<Map<String, dynamic>>> rejectTransfer(String id,
      {String? reason}) async {
    return _apiClient.postRaw('/students/transfers/$id/reject',
        data: {if (reason != null) 'reason': reason});
  }

  // ── Guardians ───────────────────────────────────────────────────────────

  /// POST /students/:id/guardians — add guardian
  Future<ApiResult<Map<String, dynamic>>> addGuardian(
      String studentId, Map<String, dynamic> data) async {
    return _apiClient.postRaw(
        ApiConfig.studentGuardians(studentId), data: data);
  }

  /// PUT /students/:id/guardians/:guardianId — update guardian
  Future<ApiResult<Map<String, dynamic>>> updateGuardian(String studentId,
      String guardianId, Map<String, dynamic> data) async {
    return _apiClient.putRaw(
        '/students/$studentId/guardians/$guardianId', data: data);
  }

  /// DELETE /students/:id/guardians/:guardianId
  Future<ApiResult<Map<String, dynamic>>> deleteGuardian(
      String studentId, String guardianId) async {
    return _apiClient.deleteRaw(
        '/students/$studentId/guardians/$guardianId');
  }

  // ── ID Cards ───────────────────────────────────────────────────────────

  /// POST /students/id-cards/generate-bulk
  Future<ApiResult<Map<String, dynamic>>> generateIdCardsBulk(
      Map<String, dynamic> data) async {
    return _apiClient.postRaw('/students/id-cards/generate-bulk', data: data);
  }

  /// PUT /students/id-cards/:cardId/revoke
  Future<ApiResult<Map<String, dynamic>>> revokeIdCard(
      String cardId, String reason) async {
    return _apiClient.putRaw('/students/id-cards/$cardId/revoke',
        data: {'reason': reason});
  }

  /// DELETE /students/id-cards/:cardId
  Future<ApiResult<Map<String, dynamic>>> deleteIdCard(String cardId) async {
    return _apiClient.deleteRaw('/students/id-cards/$cardId');
  }

  // ── Class assignments ─────────────────────────────────────────────────

  /// POST /students/assign-physical-class
  Future<ApiResult<Map<String, dynamic>>> assignPhysicalClass(
      String studentId, String classId) async {
    return _apiClient.postRaw('/students/assign-physical-class',
        data: {'studentId': studentId, 'classId': classId});
  }

  /// POST /students/change-class
  Future<ApiResult<Map<String, dynamic>>> changeClass(
      String studentId, String newClassId, {String? reason}) async {
    return _apiClient.postRaw('/students/change-class',
        data: {
          'studentId': studentId,
          'newClassId': newClassId,
          if (reason != null) 'reason': reason,
        });
  }

  // ── ORION ──────────────────────────────────────────────────────────────

  /// GET /students/:id/orion-kpis
  Future<ApiResult<Map<String, dynamic>>> getStudentOrionKpis(
      String id) async {
    return _apiClient.getRaw(ApiConfig.studentOrionKpis(id));
  }

  /// GET /students/:id/orion-alerts
  Future<ApiResult<Map<String, dynamic>>> getStudentOrionAlerts(
      String id) async {
    return _apiClient.getRaw(ApiConfig.studentOrionAlerts(id));
  }
}

final studentsServiceV2Provider = Provider<StudentsServiceV2>((ref) {
  return StudentsServiceV2(ref.watch(apiClientProvider));
});

// ── Models ──────────────────────────────────────────────────────────────

class StudentStatistics {
  final int total;
  final int active;
  final int preRegistered;
  final int admitted;
  final int pending;
  final int archived;
  final int withdrawn;
  final int admissionsPending;
  final int admissionsAccepted;
  final int admissionsRejected;

  const StudentStatistics({
    this.total = 0,
    this.active = 0,
    this.preRegistered = 0,
    this.admitted = 0,
    this.pending = 0,
    this.archived = 0,
    this.withdrawn = 0,
    this.admissionsPending = 0,
    this.admissionsAccepted = 0,
    this.admissionsRejected = 0,
  });

  factory StudentStatistics.fromJson(Map<String, dynamic> json) {
    return StudentStatistics(
      total: _i(json, 'total'),
      active: _i(json, 'active'),
      preRegistered: _i(json, 'preRegistered'),
      admitted: _i(json, 'admitted'),
      pending: _i(json, 'pending'),
      archived: _i(json, 'archived'),
      withdrawn: _i(json, 'withdrawn'),
      admissionsPending: _i(json, 'admissionsPending'),
      admissionsAccepted: _i(json, 'admissionsAccepted'),
      admissionsRejected: _i(json, 'admissionsRejected'),
    );
  }
}

class AdmissionItem {
  final String id;
  final String admissionNumber;
  final String status;
  final String firstName;
  final String lastName;
  final String? gender;
  final DateTime? createdAt;
  final String? requestedClassName;
  final String? previousSchool;
  final bool isNewStudent;
  final String? convertedStudentId;

  const AdmissionItem({
    required this.id,
    this.admissionNumber = '',
    this.status = 'PENDING',
    this.firstName = '',
    this.lastName = '',
    this.gender,
    this.createdAt,
    this.requestedClassName,
    this.previousSchool,
    this.isNewStudent = true,
    this.convertedStudentId,
  });

  String get displayName => '$firstName $lastName'.trim();
  String get initials => '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}'.toUpperCase();

  factory AdmissionItem.fromJson(Map<String, dynamic> json) {
    return AdmissionItem(
      id: (json['id'] ?? '').toString(),
      admissionNumber: (json['admissionNumber'] ?? '').toString(),
      status: (json['status'] ?? 'PENDING').toString().toUpperCase(),
      firstName: (json['firstName'] ?? '').toString(),
      lastName: (json['lastName'] ?? '').toString(),
      gender: json['gender']?.toString(),
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      requestedClassName: (json['requestedAcademicClass']?['name'] ?? json['requestedClassName'] ?? '').toString(),
      previousSchool: (json['previousSchool'] ?? '').toString(),
      isNewStudent: json['isNewStudent'] != false,
      convertedStudentId: json['convertedStudentId']?.toString(),
    );
  }
}

class EnrollmentItem {
  final String id;
  final String studentId;
  final String firstName;
  final String lastName;
  final String? matricule;
  final String? studentCode;
  final String? photoUrl;
  final String? gender;
  final String className;
  final String academicClassName;
  final String enrollmentType;
  final String status;
  final DateTime? enrollmentDate;

  const EnrollmentItem({
    required this.id,
    this.studentId = '',
    this.firstName = '',
    this.lastName = '',
    this.matricule,
    this.studentCode,
    this.photoUrl,
    this.gender,
    this.className = '',
    this.academicClassName = '',
    this.enrollmentType = 'NEW',
    this.status = 'ACTIVE',
    this.enrollmentDate,
  });

  String get displayName => '$firstName $lastName'.trim();
  String get initials => '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}'.toUpperCase();

  factory EnrollmentItem.fromJson(Map<String, dynamic> json) {
    final student = json['student'] ?? {};
    final classInfo = json['class'] ?? {};
    final academicClass = json['academicClass'] ?? {};
    return EnrollmentItem(
      id: (json['id'] ?? '').toString(),
      studentId: (student['id'] ?? '').toString(),
      firstName: (student['firstName'] ?? '').toString(),
      lastName: (student['lastName'] ?? '').toString(),
      matricule: student['matricule']?.toString(),
      studentCode: student['studentCode']?.toString(),
      photoUrl: student['photoUrl']?.toString(),
      gender: student['gender']?.toString(),
      className: (classInfo['name'] ?? '').toString(),
      academicClassName: (academicClass['name'] ?? '').toString(),
      enrollmentType: (json['enrollmentType'] ?? 'NEW').toString(),
      status: (json['status'] ?? 'ACTIVE').toString().toUpperCase(),
      enrollmentDate: json['enrollmentDate'] != null ? DateTime.tryParse(json['enrollmentDate'].toString()) : null,
    );
  }
}

// ── Providers ───────────────────────────────────────────────────────────

final studentStatisticsProvider =
    FutureProvider.autoDispose<StudentStatistics>((ref) async {
  final service = ref.watch(studentsServiceV2Provider);
  final result = await service.getStatistics();
  return result.when(
    success: (data) => StudentStatistics.fromJson(data),
    failure: (_) => const StudentStatistics(),
    loading: () => const StudentStatistics(),
  );
});

final admissionsProvider =
    FutureProvider.autoDispose<List<AdmissionItem>>((ref) async {
  final service = ref.watch(studentsServiceV2Provider);
  final result = await service.getAdmissions();
  return result.when(
    success: (data) {
      final list = data['data'] ?? data['admissions'] ?? data;
      if (list is! List) return <AdmissionItem>[];
      return list.whereType<Map<String, dynamic>>().map(AdmissionItem.fromJson).where((a) => a.id.isNotEmpty).toList();
    },
    failure: (_) => <AdmissionItem>[],
    loading: () => <AdmissionItem>[],
  );
});

final enrollmentsProvider =
    FutureProvider.autoDispose<List<EnrollmentItem>>((ref) async {
  final service = ref.watch(studentsServiceV2Provider);
  final result = await service.getEnrollments();
  return result.when(
    success: (data) {
      final list = data['data'] ?? data['enrollments'] ?? data;
      if (list is! List) return <EnrollmentItem>[];
      return list.whereType<Map<String, dynamic>>().map(EnrollmentItem.fromJson).where((e) => e.id.isNotEmpty).toList();
    },
    failure: (_) => <EnrollmentItem>[],
    loading: () => <EnrollmentItem>[],
  );
});

// ── Helpers ────────────────────────────────────────────────────────────

int _i(Map<String, dynamic> json, String key) {
  final v = json[key];
  if (v is int) return v;
  if (v is String) return int.tryParse(v) ?? 0;
  if (v is double) return v.toInt();
  return 0;
}
