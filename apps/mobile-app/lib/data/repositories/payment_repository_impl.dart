import '../../../core/network/api_result.dart';
import '../../../domain/entities/payment.dart';
import '../../../domain/repositories/payment_repository.dart';
import '../datasources/remote/payment_api.dart';

/// Concrete implementation of [PaymentRepository] that delegates to [PaymentApi].
class PaymentRepositoryImpl implements PaymentRepository {
  final PaymentApi _paymentApi;

  PaymentRepositoryImpl(this._paymentApi);

  @override
  Future<ApiResult<List<Payment>>> getPayments(
    String studentId, {
    String? status,
  }) {
    return _paymentApi.getPayments(studentId, status: status);
  }

  @override
  Future<ApiResult<Payment>> getPaymentDetail(
    String studentId,
    String paymentId,
  ) {
    return _paymentApi.getPaymentDetail(studentId, paymentId);
  }

  @override
  Future<ApiResult<String>> getPaymentReceipt(
    String studentId,
    String paymentId,
  ) {
    return _paymentApi.getPaymentReceipt(studentId, paymentId);
  }
}
