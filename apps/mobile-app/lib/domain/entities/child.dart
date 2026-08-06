import 'package:freezed_annotation/freezed_annotation.dart';

part 'child.freezed.dart';
part 'child.g.dart';

/// Represents a child/student linked to a parent account.
@freezed
class Child with _$Child {
  const factory Child({
    required String id,
    required String firstName,
    required String lastName,
    required String className,
    required String tenantId,
    String? tenantName,
    String? avatarUrl,
    String? matricule,
    @Default(0) int unreadMessages,
    @Default(0) int pendingPayments,
    @Default(0) double totalPendingAmount,
    @Default(0) int recentGrades,
    DateTime? birthDate,
  }) = _Child;

  const Child._();

  /// Full display name.
  String get displayName => '$firstName $lastName';

  /// Initials for avatar fallback.
  String get initials {
    final first = firstName.isNotEmpty ? firstName[0].toUpperCase() : '';
    final last = lastName.isNotEmpty ? lastName[0].toUpperCase() : '';
    return '$first$last';
  }

  /// Whether this child has alerts (unread messages, pending payments).
  bool get hasAlerts => unreadMessages > 0 || pendingPayments > 0;

  factory Child.fromJson(Map<String, dynamic> json) => _$ChildFromJson(json);
}
