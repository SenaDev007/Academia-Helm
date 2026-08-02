// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'child.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ChildImpl _$$ChildImplFromJson(Map<String, dynamic> json) => _$ChildImpl(
      id: json['id'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      className: json['className'] as String,
      tenantId: json['tenantId'] as String,
      tenantName: json['tenantName'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      matricule: json['matricule'] as String?,
      unreadMessages: (json['unreadMessages'] as num?)?.toInt() ?? 0,
      pendingPayments: (json['pendingPayments'] as num?)?.toInt() ?? 0,
      totalPendingAmount: (json['totalPendingAmount'] as num?)?.toDouble() ?? 0,
      recentGrades: (json['recentGrades'] as num?)?.toInt() ?? 0,
      birthDate: json['birthDate'] == null
          ? null
          : DateTime.parse(json['birthDate'] as String),
    );

Map<String, dynamic> _$$ChildImplToJson(_$ChildImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'firstName': instance.firstName,
      'lastName': instance.lastName,
      'className': instance.className,
      'tenantId': instance.tenantId,
      'tenantName': instance.tenantName,
      'avatarUrl': instance.avatarUrl,
      'matricule': instance.matricule,
      'unreadMessages': instance.unreadMessages,
      'pendingPayments': instance.pendingPayments,
      'totalPendingAmount': instance.totalPendingAmount,
      'recentGrades': instance.recentGrades,
      'birthDate': instance.birthDate?.toIso8601String(),
    };
