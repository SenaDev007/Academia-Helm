import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../../../domain/entities/payment.dart';
import '../../dto/payment_dto.dart';

final paymentApiProvider = Provider<PaymentApi>((ref) {
  return PaymentApi(ref.read(apiClientProvider));
});

/// Remote API data source for payment-related endpoints.
class PaymentApi {
  final ApiClient _apiClient;

  PaymentApi(this._apiClient);

  /// GET /api/students/{studentId}/payments
  Future<ApiResult<List<Payment>>> getPayments(
    String studentId, {
    String? status,
  }) async {
    final queryParams = <String, dynamic>{};
    if (status != null) queryParams['status'] = status;

    final result = await _apiClient.getRaw(
      '/api/students/$studentId/payments',
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
    );

    return result.when(
      success: (data) {
        final List<dynamic> items =
            data['data'] ?? data['payments'] ?? <dynamic>[];
        return ApiResult.success(
          items
              .map((e) =>
                  PaymentDto.fromJson(e as Map<String, dynamic>).toDomain())
              .toList(),
        );
      },
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// GET /api/students/{studentId}/payments/{paymentId}
  Future<ApiResult<Payment>> getPaymentDetail(
    String studentId,
    String paymentId,
  ) async {
    final result = await _apiClient.getRaw(
      '/api/students/$studentId/payments/$paymentId',
    );

    return result.when(
      success: (data) => ApiResult.success(
        PaymentDto.fromJson(data).toDomain(),
      ),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// GET /api/students/{studentId}/payments/{paymentId}/receipt
  Future<ApiResult<String>> getPaymentReceipt(
    String studentId,
    String paymentId,
  ) async {
    final result = await _apiClient.getRaw(
      '/api/students/$studentId/payments/$paymentId/receipt',
    );

    return result.when(
      success: (data) {
        final receiptUrl =
            data['receiptUrl'] as String? ?? data['url'] as String? ?? '';
        return ApiResult.success(receiptUrl);
      },
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }
}
