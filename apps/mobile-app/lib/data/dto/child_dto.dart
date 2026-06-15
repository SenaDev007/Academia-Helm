import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/child.dart';

part 'child_dto.g.dart';

/// DTO for [Child] with snake_case field names matching the API response.
@JsonSerializable(fieldRename: FieldRename.snake)
class ChildDto {
  final String id;
  final String firstName;
  final String lastName;
  final String className;
  final String tenantId;
  final String? tenantName;
  final String? avatarUrl;
  final String? matricule;
  final int? unreadMessages;
  final int? pendingPayments;
  final double? totalPendingAmount;
  final int? recentGrades;
  final String? birthDate;

  ChildDto({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.className,
    required this.tenantId,
    this.tenantName,
    this.avatarUrl,
    this.matricule,
    this.unreadMessages,
    this.pendingPayments,
    this.totalPendingAmount,
    this.recentGrades,
    this.birthDate,
  });

  factory ChildDto.fromJson(Map<String, dynamic> json) =>
      _$ChildDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ChildDtoToJson(this);

  Child toDomain() => Child(
        id: id,
        firstName: firstName,
        lastName: lastName,
        className: className,
        tenantId: tenantId,
        tenantName: tenantName,
        avatarUrl: avatarUrl,
        matricule: matricule,
        unreadMessages: unreadMessages ?? 0,
        pendingPayments: pendingPayments ?? 0,
        totalPendingAmount: totalPendingAmount ?? 0,
        recentGrades: recentGrades ?? 0,
        birthDate:
            birthDate != null ? DateTime.tryParse(birthDate!) : null,
      );
}
