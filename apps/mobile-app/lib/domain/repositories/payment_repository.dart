import '../entities/payment.dart';
import '../../../core/network/api_result.dart';

abstract class PaymentRepository {
  /// Retrieves the list of payments for a given student.
  ///
  /// [studentId] - The student's unique identifier.
  /// [status] - Optional status filter (e.g. 'PENDING', 'OVERDUE').
  Future<ApiResult<List<Payment>>> getPayments(
    String studentId, {
    String? status,
  });

  /// Retrieves a single payment detail.
  ///
  /// [studentId] - The student's unique identifier.
  /// [paymentId] - The payment's unique identifier.
  Future<ApiResult<Payment>> getPaymentDetail(
    String studentId,
    String paymentId,
  );

  /// Retrieves the receipt URL for a payment.
  ///
  /// [studentId] - The student's unique identifier.
  /// [paymentId] - The payment's unique identifier.
  Future<ApiResult<String>> getPaymentReceipt(
    String studentId,
    String paymentId,
  );
}
