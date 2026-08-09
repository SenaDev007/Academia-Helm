import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/parent_service.dart';

// ── Extended Child Model (matches web /parent/children response) ────────

class ParentChild {
  const ParentChild({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.className,
    this.classId = '',
    this.matricule = '',
    this.levelName = '',
    this.gender = '',
    this.avatarUrl,
    this.photoUrl,
    this.tenantName = '',
    this.account,
    this.teacher,
  });

  final String id;
  final String firstName;
  final String lastName;
  final String className;
  final String classId;
  final String matricule;
  final String levelName;
  final String gender;
  final String? avatarUrl;
  final String? photoUrl;
  final String tenantName;
  final ChildAccount? account;
  final ChildTeacher? teacher;

  String get displayName => '$firstName $lastName';
  String get initials {
    final f = firstName.isNotEmpty ? firstName[0].toUpperCase() : '';
    final l = lastName.isNotEmpty ? lastName[0].toUpperCase() : '';
    return '$f$l';
  }

  factory ParentChild.fromJson(Map<String, dynamic> json) {
    return ParentChild(
      id: _str(json, ['id', 'studentId', 'childId']),
      firstName: _str(json, ['firstName', 'firstname', 'givenName']),
      lastName: _str(json, ['lastName', 'lastname', 'familyName']),
      className: _str(json, ['className', 'class', 'class_name']),
      classId: _str(json, ['classId', 'class_id']),
      matricule: _str(json, ['matricule', 'matriculeNumber']),
      levelName: _str(json, ['levelName', 'schoolLevelName', 'level']),
      gender: _str(json, ['gender', 'sexe']).toUpperCase(),
      avatarUrl: _strOpt(json, ['avatarUrl', 'avatar', 'photoUrl', 'photo']),
      photoUrl: _strOpt(json, ['photoUrl', 'photo']),
      tenantName: _str(json, ['tenantName', 'schoolName']),
      account: json['account'] is Map ? ChildAccount.fromJson(json['account'] as Map<String, dynamic>) : null,
      teacher: json['teacher'] is Map ? ChildTeacher.fromJson(json['teacher'] as Map<String, dynamic>) : null,
    );
  }
}

class ChildAccount {
  const ChildAccount({
    this.id = '',
    this.balance = 0,
    this.totalDue = 0,
    this.totalPaid = 0,
    this.arrearsAmount = 0,
  });

  final String id;
  final double balance;
  final double totalDue;
  final double totalPaid;
  final double arrearsAmount;

  bool get hasDebt => balance > 0;

  factory ChildAccount.fromJson(Map<String, dynamic> json) {
    return ChildAccount(
      id: _str(json, ['id', 'accountId']),
      balance: _dbl(json, ['balance', 'balanceDue']) ?? 0,
      totalDue: _dbl(json, ['totalDue', 'total_due']) ?? 0,
      totalPaid: _dbl(json, ['totalPaid', 'total_paid']) ?? 0,
      arrearsAmount: _dbl(json, ['arrearsAmount', 'arrears']) ?? 0,
    );
  }
}

class ChildTeacher {
  const ChildTeacher({
    this.name = '',
    this.email = '',
    this.phone = '',
  });

  final String name;
  final String email;
  final String phone;

  factory ChildTeacher.fromJson(Map<String, dynamic> json) {
    return ChildTeacher(
      name: _str(json, ['name', 'teacherName', 'firstName']) +
          (json['lastName'] != null ? ' ${json['lastName']}' : ''),
      email: _str(json, ['email']),
      phone: _str(json, ['phone', 'phoneNumber']),
    );
  }
}

// ── Today Summary Model ─────────────────────────────────────────────────

class TodaySummary {
  const TodaySummary({
    this.attendanceStatus = '',
    this.scheduledSubjects = const [],
    this.pendingHomeworks = const [],
  });

  final String attendanceStatus; // PRESENT, ABSENT, ABSENT_HALF, LATE
  final List<TodaySubject> scheduledSubjects;
  final List<TodayHomework> pendingHomeworks;

  factory TodaySummary.fromJson(Map<String, dynamic> json) {
    final subjects = json['scheduledSubjects'] ?? json['subjects'] ?? [];
    final homeworks = json['pendingHomeworks'] ?? json['homeworks'] ?? [];
    return TodaySummary(
      attendanceStatus: _str(json, ['attendanceStatus', 'attendance', 'status']),
      scheduledSubjects: subjects is List
          ? subjects.whereType<Map<String, dynamic>>().map(TodaySubject.fromJson).toList()
          : [],
      pendingHomeworks: homeworks is List
          ? homeworks.whereType<Map<String, dynamic>>().map(TodayHomework.fromJson).toList()
          : [],
    );
  }
}

class TodaySubject {
  const TodaySubject({required this.subjectName, this.duration = '', this.topic = '', this.content = ''});
  final String subjectName;
  final String duration;
  final String topic;
  final String content;

  factory TodaySubject.fromJson(Map<String, dynamic> json) {
    return TodaySubject(
      subjectName: _str(json, ['subjectName', 'name']),
      duration: _str(json, ['duration', 'durationHours']),
      topic: _str(json, ['topic', 'title']),
      content: _str(json, ['content', 'description']),
    );
  }
}

class TodayHomework {
  const TodayHomework({required this.title, this.subject = '', this.description = '', this.status = '', this.dueDate});
  final String title;
  final String subject;
  final String description;
  final String status;
  final DateTime? dueDate;

  factory TodayHomework.fromJson(Map<String, dynamic> json) {
    return TodayHomework(
      title: _str(json, ['title', 'name']),
      subject: _str(json, ['subject', 'subjectName']),
      description: _str(json, ['description']),
      status: _str(json, ['status', 'taskStatus']),
      dueDate: json['dueDate'] != null ? DateTime.tryParse(json['dueDate'].toString()) : null,
    );
  }
}

// ── Attendance History Model ────────────────────────────────────────────

class AttendanceHistory {
  const AttendanceHistory({
    this.totalDays = 0,
    this.presentDays = 0,
    this.absentDays = 0,
    this.halfDays = 0,
    this.lateDays = 0,
    this.records = const [],
  });

  final int totalDays;
  final int presentDays;
  final int absentDays;
  final int halfDays;
  final int lateDays;
  final List<AttendanceRecord> records;

  factory AttendanceHistory.fromJson(Map<String, dynamic> json) {
    final list = json['records'] ?? json['history'] ?? json['data'] ?? [];
    return AttendanceHistory(
      totalDays: _int(json, ['totalDays', 'total']) ?? 0,
      presentDays: _int(json, ['presentDays', 'present']) ?? 0,
      absentDays: _int(json, ['absentDays', 'absent']) ?? 0,
      halfDays: _int(json, ['halfDays', 'halfDay']) ?? 0,
      lateDays: _int(json, ['lateDays', 'late']) ?? 0,
      records: list is List
          ? list.whereType<Map<String, dynamic>>().map(AttendanceRecord.fromJson).toList()
          : [],
    );
  }
}

class AttendanceRecord {
  const AttendanceRecord({
    required this.date,
    required this.status,
    this.morningStatus = '',
    this.afternoonStatus = '',
    this.detail = '',
  });

  final DateTime date;
  final String status; // PRESENT, ABSENT, ABSENT_HALF, LATE
  final String morningStatus;
  final String afternoonStatus;
  final String detail;

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      date: json['date'] != null ? DateTime.tryParse(json['date'].toString()) ?? DateTime.now() : DateTime.now(),
      status: _str(json, ['status', 'attendanceStatus']),
      morningStatus: _str(json, ['morningStatus', 'morning']),
      afternoonStatus: _str(json, ['afternoonStatus', 'afternoon']),
      detail: _str(json, ['detail', 'note']),
    );
  }
}

// ── Finance Breakdown Model ─────────────────────────────────────────────

class FinanceBreakdown {
  const FinanceBreakdown({
    this.fees = const [],
    this.arrears = const [],
    this.totalDue = 0,
    this.totalPaid = 0,
    this.remaining = 0,
    this.accountBlocked = false,
  });

  final List<FeeItem> fees;
  final List<ArrearItem> arrears;
  final double totalDue;
  final double totalPaid;
  final double remaining;
  final bool accountBlocked;

  factory FinanceBreakdown.fromJson(Map<String, dynamic> json) {
    final fees = json['fees'] ?? json['feeBreakdown'] ?? [];
    final arrears = json['arrears'] ?? [];
    final totalDue = _dbl(json, ['totalDue', 'total_due']) ?? 0;
    final totalPaid = _dbl(json, ['totalPaid', 'total_paid']) ?? 0;
    return FinanceBreakdown(
      fees: fees is List ? fees.whereType<Map<String, dynamic>>().map(FeeItem.fromJson).toList() : [],
      arrears: arrears is List ? arrears.whereType<Map<String, dynamic>>().map(ArrearItem.fromJson).toList() : [],
      totalDue: totalDue,
      totalPaid: totalPaid,
      remaining: totalDue - totalPaid,
      accountBlocked: json['accountBlocked'] == true || json['isBlocked'] == true,
    );
  }
}

class FeeItem {
  const FeeItem({
    required this.label,
    required this.amount,
    this.paid = 0,
    this.reduction = 0,
    this.overridden = false,
  });

  final String label;
  final double amount;
  final double paid;
  final double reduction;
  final bool overridden;

  double get remaining => amount - paid;
  bool get isFullyPaid => remaining <= 0;

  factory FeeItem.fromJson(Map<String, dynamic> json) {
    return FeeItem(
      label: _str(json, ['label', 'name', 'feeName']),
      amount: _dbl(json, ['amount', 'standardAmount', 'montant']) ?? 0,
      paid: _dbl(json, ['paid', 'paidAmount']) ?? 0,
      reduction: _dbl(json, ['reduction', 'reductionPercent']) ?? 0,
      overridden: json['overridden'] == true || json['isOverridden'] == true,
    );
  }
}

class ArrearItem {
  const ArrearItem({
    required this.academicYear,
    required this.totalDue,
    required this.paid,
  });

  final String academicYear;
  final double totalDue;
  final double paid;

  double get balance => totalDue - paid;

  factory ArrearItem.fromJson(Map<String, dynamic> json) {
    return ArrearItem(
      academicYear: _str(json, ['academicYear', 'year', 'label']),
      totalDue: _dbl(json, ['totalDue', 'due']) ?? 0,
      paid: _dbl(json, ['paid', 'paidAmount']) ?? 0,
    );
  }
}

// ── Notification Model ──────────────────────────────────────────────────

class ParentNotification {
  const ParentNotification({
    required this.id,
    required this.title,
    this.body = '',
    this.isRead = false,
    this.createdAt,
    this.priority = 'normal',
  });

  final String id;
  final String title;
  final String body;
  final bool isRead;
  final DateTime? createdAt;
  final String priority;

  factory ParentNotification.fromJson(Map<String, dynamic> json) {
    return ParentNotification(
      id: _str(json, ['id', 'notificationId']),
      title: _str(json, ['title', 'subject']),
      body: _str(json, ['body', 'message', 'content']),
      isRead: json['isRead'] == true || json['read'] == true,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      priority: _str(json, ['priority', 'type']).toLowerCase(),
    );
  }
}

// ── Announcement Model ──────────────────────────────────────────────────

class ParentAnnouncement {
  const ParentAnnouncement({
    required this.id,
    required this.title,
    this.body = '',
    this.publishedAt,
    this.priority = 'normal',
  });

  final String id;
  final String title;
  final String body;
  final DateTime? publishedAt;
  final String priority;

  factory ParentAnnouncement.fromJson(Map<String, dynamic> json) {
    return ParentAnnouncement(
      id: _str(json, ['id', 'announcementId']),
      title: _str(json, ['title', 'subject']),
      body: _str(json, ['body', 'content', 'message']),
      publishedAt: json['publishedAt'] != null ? DateTime.tryParse(json['publishedAt'].toString()) : null,
      priority: _str(json, ['priority', 'type']).toLowerCase(),
    );
  }
}

// ── Providers ───────────────────────────────────────────────────────────

/// Fetches parent's children list.
final parentChildrenProvider = FutureProvider.autoDispose
    .family<List<ParentChild>, String?>((ref, academicYearId) async {
  final service = ref.watch(parentServiceProvider);
  final result = await service.getChildren(academicYearId: academicYearId);

  return result.when(
    success: (data) {
      final list = data['data'] ?? data['children'] ?? data;
      if (list is! List) return <ParentChild>[];
      return list
          .whereType<Map<String, dynamic>>()
          .map(ParentChild.fromJson)
          .where((c) => c.id.isNotEmpty)
          .toList();
    },
    failure: (_) => <ParentChild>[],
    loading: () => <ParentChild>[],
  );
});

/// Fetches today's summary for a child.
final parentTodayProvider = FutureProvider.autoDispose
    .family<TodaySummary?, ({String childId, String? academicYearId})>(
        (ref, params) async {
  final service = ref.watch(parentServiceProvider);
  final result = await service.getTodaySummary(
    childId: params.childId,
    academicYearId: params.academicYearId,
  );

  return result.when(
    success: (data) {
      final todayData = data['data'] ?? data['today'] ?? data;
      if (todayData is! Map<String, dynamic>) return null;
      return TodaySummary.fromJson(todayData);
    },
    failure: (_) => null,
    loading: () => null,
  );
});

/// Fetches attendance history for a child.
final parentAttendanceProvider = FutureProvider.autoDispose
    .family<AttendanceHistory?, String>((ref, childId) async {
  final service = ref.watch(parentServiceProvider);
  final result = await service.getAttendance(childId: childId);

  return result.when(
    success: (data) {
      final attData = data['data'] ?? data['attendance'] ?? data;
      if (attData is! Map<String, dynamic>) return null;
      return AttendanceHistory.fromJson(attData);
    },
    failure: (_) => null,
    loading: () => null,
  );
});

/// Fetches finance breakdown for a child.
final parentFinanceProvider = FutureProvider.autoDispose
    .family<FinanceBreakdown?, ({String childId, String? academicYearId})>(
        (ref, params) async {
  final service = ref.watch(parentServiceProvider);
  final result = await service.getFinanceBreakdown(
    studentId: params.childId,
    academicYearId: params.academicYearId,
  );

  return result.when(
    success: (data) {
      final finData = data['data'] ?? data['breakdown'] ?? data;
      if (finData is! Map<String, dynamic>) return null;
      return FinanceBreakdown.fromJson(finData);
    },
    failure: (_) => null,
    loading: () => null,
  );
});

/// Fetches parent notifications.
final parentNotificationsProvider = FutureProvider.autoDispose
    .family<List<ParentNotification>, int>((ref, limit) async {
  final service = ref.watch(parentServiceProvider);
  final result = await service.getNotifications(limit: limit);

  return result.when(
    success: (data) {
      final list = data['data'] ?? data['notifications'] ?? data;
      if (list is! List) return <ParentNotification>[];
      return list
          .whereType<Map<String, dynamic>>()
          .map(ParentNotification.fromJson)
          .where((n) => n.id.isNotEmpty)
          .toList();
    },
    failure: (_) => <ParentNotification>[],
    loading: () => <ParentNotification>[],
  );
});

/// Fetches school announcements for parents.
final parentAnnouncementsProvider = FutureProvider.autoDispose
    .family<List<ParentAnnouncement>, int>((ref, limit) async {
  final service = ref.watch(parentServiceProvider);
  final result = await service.getAnnouncements(limit: limit);

  return result.when(
    success: (data) {
      final list = data['data'] ?? data['announcements'] ?? data;
      if (list is! List) return <ParentAnnouncement>[];
      return list
          .whereType<Map<String, dynamic>>()
          .map(ParentAnnouncement.fromJson)
          .where((a) => a.id.isNotEmpty)
          .toList();
    },
    failure: (_) => <ParentAnnouncement>[],
    loading: () => <ParentAnnouncement>[],
  );
});

// ── Helpers ─────────────────────────────────────────────────────────────

String _str(Map<String, dynamic> json, List<String> keys) {
  for (final key in keys) {
    final value = json[key];
    if (value is String && value.isNotEmpty) return value;
    if (value != null) return value.toString();
  }
  return '';
}

String? _strOpt(Map<String, dynamic> json, List<String> keys) {
  final result = _str(json, keys);
  return result.isEmpty ? null : result;
}

int? _int(Map<String, dynamic> json, List<String> keys) {
  for (final key in keys) {
    final value = json[key];
    if (value is int) return value;
    if (value is String) return int.tryParse(value);
    if (value is double) return value.toInt();
  }
  return null;
}

double? _dbl(Map<String, dynamic> json, List<String> keys) {
  for (final key in keys) {
    final value = json[key];
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value);
  }
  return null;
}
