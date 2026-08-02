// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payment.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$PaymentImpl _$$PaymentImplFromJson(Map<String, dynamic> json) =>
    _$PaymentImpl(
      id: json['id'] as String,
      studentId: json['studentId'] as String,
      label: json['label'] as String,
      amount: (json['amount'] as num).toDouble(),
      paidAmount: (json['paidAmount'] as num).toDouble(),
      status: $enumDecode(_$PaymentStatusEnumMap, json['status']),
      dueDate: json['dueDate'] == null
          ? null
          : DateTime.parse(json['dueDate'] as String),
      paidAt: json['paidAt'] == null
          ? null
          : DateTime.parse(json['paidAt'] as String),
      paymentMethod: json['paymentMethod'] as String?,
      transactionRef: json['transactionRef'] as String?,
      receiptUrl: json['receiptUrl'] as String?,
      invoiceUrl: json['invoiceUrl'] as String?,
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$$PaymentImplToJson(_$PaymentImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'studentId': instance.studentId,
      'label': instance.label,
      'amount': instance.amount,
      'paidAmount': instance.paidAmount,
      'status': _$PaymentStatusEnumMap[instance.status]!,
      'dueDate': instance.dueDate?.toIso8601String(),
      'paidAt': instance.paidAt?.toIso8601String(),
      'paymentMethod': instance.paymentMethod,
      'transactionRef': instance.transactionRef,
      'receiptUrl': instance.receiptUrl,
      'invoiceUrl': instance.invoiceUrl,
      'createdAt': instance.createdAt?.toIso8601String(),
    };

const _$PaymentStatusEnumMap = {
  PaymentStatus.pending: 'PENDING',
  PaymentStatus.partial: 'PARTIAL',
  PaymentStatus.paid: 'PAID',
  PaymentStatus.overdue: 'OVERDUE',
  PaymentStatus.cancelled: 'CANCELLED',
};
