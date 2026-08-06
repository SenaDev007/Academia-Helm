// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payment_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PaymentDto _$PaymentDtoFromJson(Map<String, dynamic> json) => PaymentDto(
      id: json['id'] as String,
      studentId: json['student_id'] as String,
      label: json['label'] as String,
      amount: (json['amount'] as num).toDouble(),
      paidAmount: (json['paid_amount'] as num).toDouble(),
      status: json['status'] as String,
      dueDate: json['due_date'] as String?,
      paidAt: json['paid_at'] as String?,
      paymentMethod: json['payment_method'] as String?,
      transactionRef: json['transaction_ref'] as String?,
      receiptUrl: json['receipt_url'] as String?,
      invoiceUrl: json['invoice_url'] as String?,
      createdAt: json['created_at'] as String?,
    );

Map<String, dynamic> _$PaymentDtoToJson(PaymentDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'student_id': instance.studentId,
      'label': instance.label,
      'amount': instance.amount,
      'paid_amount': instance.paidAmount,
      'status': instance.status,
      'due_date': instance.dueDate,
      'paid_at': instance.paidAt,
      'payment_method': instance.paymentMethod,
      'transaction_ref': instance.transactionRef,
      'receipt_url': instance.receiptUrl,
      'invoice_url': instance.invoiceUrl,
      'created_at': instance.createdAt,
    };
