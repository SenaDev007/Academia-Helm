// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'payment.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

Payment _$PaymentFromJson(Map<String, dynamic> json) {
  return _Payment.fromJson(json);
}

/// @nodoc
mixin _$Payment {
  String get id => throw _privateConstructorUsedError;
  String get studentId => throw _privateConstructorUsedError;
  String get label => throw _privateConstructorUsedError;
  double get amount => throw _privateConstructorUsedError;
  double get paidAmount => throw _privateConstructorUsedError;
  PaymentStatus get status => throw _privateConstructorUsedError;
  DateTime? get dueDate => throw _privateConstructorUsedError;
  DateTime? get paidAt => throw _privateConstructorUsedError;
  String? get paymentMethod =>
      throw _privateConstructorUsedError; // 'CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD'
  String? get transactionRef => throw _privateConstructorUsedError;
  String? get receiptUrl => throw _privateConstructorUsedError;
  String? get invoiceUrl => throw _privateConstructorUsedError;
  DateTime? get createdAt => throw _privateConstructorUsedError;

  /// Serializes this Payment to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Payment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PaymentCopyWith<Payment> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PaymentCopyWith<$Res> {
  factory $PaymentCopyWith(Payment value, $Res Function(Payment) then) =
      _$PaymentCopyWithImpl<$Res, Payment>;
  @useResult
  $Res call(
      {String id,
      String studentId,
      String label,
      double amount,
      double paidAmount,
      PaymentStatus status,
      DateTime? dueDate,
      DateTime? paidAt,
      String? paymentMethod,
      String? transactionRef,
      String? receiptUrl,
      String? invoiceUrl,
      DateTime? createdAt});
}

/// @nodoc
class _$PaymentCopyWithImpl<$Res, $Val extends Payment>
    implements $PaymentCopyWith<$Res> {
  _$PaymentCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Payment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? studentId = null,
    Object? label = null,
    Object? amount = null,
    Object? paidAmount = null,
    Object? status = null,
    Object? dueDate = freezed,
    Object? paidAt = freezed,
    Object? paymentMethod = freezed,
    Object? transactionRef = freezed,
    Object? receiptUrl = freezed,
    Object? invoiceUrl = freezed,
    Object? createdAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      studentId: null == studentId
          ? _value.studentId
          : studentId // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as double,
      paidAmount: null == paidAmount
          ? _value.paidAmount
          : paidAmount // ignore: cast_nullable_to_non_nullable
              as double,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as PaymentStatus,
      dueDate: freezed == dueDate
          ? _value.dueDate
          : dueDate // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      paidAt: freezed == paidAt
          ? _value.paidAt
          : paidAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      paymentMethod: freezed == paymentMethod
          ? _value.paymentMethod
          : paymentMethod // ignore: cast_nullable_to_non_nullable
              as String?,
      transactionRef: freezed == transactionRef
          ? _value.transactionRef
          : transactionRef // ignore: cast_nullable_to_non_nullable
              as String?,
      receiptUrl: freezed == receiptUrl
          ? _value.receiptUrl
          : receiptUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      invoiceUrl: freezed == invoiceUrl
          ? _value.invoiceUrl
          : invoiceUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PaymentImplCopyWith<$Res> implements $PaymentCopyWith<$Res> {
  factory _$$PaymentImplCopyWith(
          _$PaymentImpl value, $Res Function(_$PaymentImpl) then) =
      __$$PaymentImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String studentId,
      String label,
      double amount,
      double paidAmount,
      PaymentStatus status,
      DateTime? dueDate,
      DateTime? paidAt,
      String? paymentMethod,
      String? transactionRef,
      String? receiptUrl,
      String? invoiceUrl,
      DateTime? createdAt});
}

/// @nodoc
class __$$PaymentImplCopyWithImpl<$Res>
    extends _$PaymentCopyWithImpl<$Res, _$PaymentImpl>
    implements _$$PaymentImplCopyWith<$Res> {
  __$$PaymentImplCopyWithImpl(
      _$PaymentImpl _value, $Res Function(_$PaymentImpl) _then)
      : super(_value, _then);

  /// Create a copy of Payment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? studentId = null,
    Object? label = null,
    Object? amount = null,
    Object? paidAmount = null,
    Object? status = null,
    Object? dueDate = freezed,
    Object? paidAt = freezed,
    Object? paymentMethod = freezed,
    Object? transactionRef = freezed,
    Object? receiptUrl = freezed,
    Object? invoiceUrl = freezed,
    Object? createdAt = freezed,
  }) {
    return _then(_$PaymentImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      studentId: null == studentId
          ? _value.studentId
          : studentId // ignore: cast_nullable_to_non_nullable
              as String,
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as double,
      paidAmount: null == paidAmount
          ? _value.paidAmount
          : paidAmount // ignore: cast_nullable_to_non_nullable
              as double,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as PaymentStatus,
      dueDate: freezed == dueDate
          ? _value.dueDate
          : dueDate // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      paidAt: freezed == paidAt
          ? _value.paidAt
          : paidAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      paymentMethod: freezed == paymentMethod
          ? _value.paymentMethod
          : paymentMethod // ignore: cast_nullable_to_non_nullable
              as String?,
      transactionRef: freezed == transactionRef
          ? _value.transactionRef
          : transactionRef // ignore: cast_nullable_to_non_nullable
              as String?,
      receiptUrl: freezed == receiptUrl
          ? _value.receiptUrl
          : receiptUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      invoiceUrl: freezed == invoiceUrl
          ? _value.invoiceUrl
          : invoiceUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PaymentImpl extends _Payment {
  const _$PaymentImpl(
      {required this.id,
      required this.studentId,
      required this.label,
      required this.amount,
      required this.paidAmount,
      required this.status,
      this.dueDate,
      this.paidAt,
      this.paymentMethod,
      this.transactionRef,
      this.receiptUrl,
      this.invoiceUrl,
      this.createdAt})
      : super._();

  factory _$PaymentImpl.fromJson(Map<String, dynamic> json) =>
      _$$PaymentImplFromJson(json);

  @override
  final String id;
  @override
  final String studentId;
  @override
  final String label;
  @override
  final double amount;
  @override
  final double paidAmount;
  @override
  final PaymentStatus status;
  @override
  final DateTime? dueDate;
  @override
  final DateTime? paidAt;
  @override
  final String? paymentMethod;
// 'CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD'
  @override
  final String? transactionRef;
  @override
  final String? receiptUrl;
  @override
  final String? invoiceUrl;
  @override
  final DateTime? createdAt;

  @override
  String toString() {
    return 'Payment(id: $id, studentId: $studentId, label: $label, amount: $amount, paidAmount: $paidAmount, status: $status, dueDate: $dueDate, paidAt: $paidAt, paymentMethod: $paymentMethod, transactionRef: $transactionRef, receiptUrl: $receiptUrl, invoiceUrl: $invoiceUrl, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PaymentImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.studentId, studentId) ||
                other.studentId == studentId) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.paidAmount, paidAmount) ||
                other.paidAmount == paidAmount) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.dueDate, dueDate) || other.dueDate == dueDate) &&
            (identical(other.paidAt, paidAt) || other.paidAt == paidAt) &&
            (identical(other.paymentMethod, paymentMethod) ||
                other.paymentMethod == paymentMethod) &&
            (identical(other.transactionRef, transactionRef) ||
                other.transactionRef == transactionRef) &&
            (identical(other.receiptUrl, receiptUrl) ||
                other.receiptUrl == receiptUrl) &&
            (identical(other.invoiceUrl, invoiceUrl) ||
                other.invoiceUrl == invoiceUrl) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      studentId,
      label,
      amount,
      paidAmount,
      status,
      dueDate,
      paidAt,
      paymentMethod,
      transactionRef,
      receiptUrl,
      invoiceUrl,
      createdAt);

  /// Create a copy of Payment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PaymentImplCopyWith<_$PaymentImpl> get copyWith =>
      __$$PaymentImplCopyWithImpl<_$PaymentImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PaymentImplToJson(
      this,
    );
  }
}

abstract class _Payment extends Payment {
  const factory _Payment(
      {required final String id,
      required final String studentId,
      required final String label,
      required final double amount,
      required final double paidAmount,
      required final PaymentStatus status,
      final DateTime? dueDate,
      final DateTime? paidAt,
      final String? paymentMethod,
      final String? transactionRef,
      final String? receiptUrl,
      final String? invoiceUrl,
      final DateTime? createdAt}) = _$PaymentImpl;
  const _Payment._() : super._();

  factory _Payment.fromJson(Map<String, dynamic> json) = _$PaymentImpl.fromJson;

  @override
  String get id;
  @override
  String get studentId;
  @override
  String get label;
  @override
  double get amount;
  @override
  double get paidAmount;
  @override
  PaymentStatus get status;
  @override
  DateTime? get dueDate;
  @override
  DateTime? get paidAt;
  @override
  String? get paymentMethod; // 'CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD'
  @override
  String? get transactionRef;
  @override
  String? get receiptUrl;
  @override
  String? get invoiceUrl;
  @override
  DateTime? get createdAt;

  /// Create a copy of Payment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PaymentImplCopyWith<_$PaymentImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
