// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'child_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ChildDto _$ChildDtoFromJson(Map<String, dynamic> json) => ChildDto(
      id: json['id'] as String,
      firstName: json['first_name'] as String,
      lastName: json['last_name'] as String,
      className: json['class_name'] as String,
      tenantId: json['tenant_id'] as String,
      tenantName: json['tenant_name'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      matricule: json['matricule'] as String?,
      unreadMessages: (json['unread_messages'] as num?)?.toInt(),
      pendingPayments: (json['pending_payments'] as num?)?.toInt(),
      totalPendingAmount: (json['total_pending_amount'] as num?)?.toDouble(),
      recentGrades: (json['recent_grades'] as num?)?.toInt(),
      birthDate: json['birth_date'] as String?,
    );

Map<String, dynamic> _$ChildDtoToJson(ChildDto instance) => <String, dynamic>{
      'id': instance.id,
      'first_name': instance.firstName,
      'last_name': instance.lastName,
      'class_name': instance.className,
      'tenant_id': instance.tenantId,
      'tenant_name': instance.tenantName,
      'avatar_url': instance.avatarUrl,
      'matricule': instance.matricule,
      'unread_messages': instance.unreadMessages,
      'pending_payments': instance.pendingPayments,
      'total_pending_amount': instance.totalPendingAmount,
      'recent_grades': instance.recentGrades,
      'birth_date': instance.birthDate,
    };
