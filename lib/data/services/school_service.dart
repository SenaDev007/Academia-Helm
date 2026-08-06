import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_config.dart';
import '../../domain/entities/tenant_school.dart';

/// Service that fetches the public list of schools from the backend.
///
/// Mirrors the web app's `GET /api/public/schools/list` endpoint.
/// The response is a JSON array of school objects, normalized to
/// `TenantSchool` entities.
class SchoolService {
  SchoolService(this._dio);

  final Dio _dio;

  /// Fetches all public schools (one-shot, no auth required).
  ///
  /// The backend endpoint is `GET /public/schools/list` (relative to
  /// ApiConfig.baseUrl which already includes `/api`).
  /// Returns an empty list on timeout/error so the UI can still render.
  Future<List<TenantSchool>> fetchSchools() async {
    try {
      final response = await _dio.get<dynamic>(
        '/public/schools/list',
        options: Options(
          // Public endpoint — no auth token needed
          extra: <String, dynamic>{'skipAuth': true},
          receiveTimeout: const Duration(seconds: 15),
          sendTimeout: const Duration(seconds: 15),
        ),
      );

      final data = response.data;
      List<dynamic> rawList;

      // The backend may return: array | { schools: [...] } | { tenants: [...] }
      if (data is List) {
        rawList = data;
      } else if (data is Map<String, dynamic>) {
        if (data['schools'] is List) {
          rawList = data['schools'] as List;
        } else if (data['tenants'] is List) {
          rawList = data['tenants'] as List;
        } else if (data['data'] is List) {
          rawList = data['data'] as List;
        } else {
          rawList = <dynamic>[];
        }
      } else {
        rawList = <dynamic>[];
      }

      return rawList
          .whereType<Map<String, dynamic>>()
          .map(_parseSchool)
          .where((s) => s.name.isNotEmpty)
          .toList();
    } catch (e) {
      // Graceful fallback: return empty list (matches web behavior on timeout)
      return <TenantSchool>[];
    }
  }

  /// Parses a raw JSON object into a [TenantSchool].
  ///
  /// Handles multiple field name variants from the backend:
  /// - logoUrl | logo | logoBase64
  /// - websiteUrl | website
  /// - schoolType | type
  static TenantSchool _parseSchool(Map<String, dynamic> json) {
    return TenantSchool(
      id: (json['id'] ?? json['tenantId'] ?? '').toString(),
      name: (json['name'] ?? json['schoolName'] ?? '').toString(),
      slug: (json['slug'] ?? json['subdomain'] ?? '').toString(),
      logoUrl: (json['logoUrl'] ?? json['logo'] ?? json['logoBase64']) as String?,
      primaryColor: json['primaryColor'] as String?,
      secondaryColor: json['secondaryColor'] as String?,
      schoolAcronym: (json['schoolAcronym'] ?? json['acronym']) as String?,
      schoolType: (json['schoolType'] ?? json['type']) as String?,
      city: json['city'] as String?,
      country: json['country'] as String?,
      slogan: (json['slogan'] ?? json['motto']) as String?,
      phone: (json['phone'] ?? json['phonePrimary']) as String?,
      email: (json['email'] ?? json['primaryEmail']) as String?,
      websiteUrl: (json['websiteUrl'] ?? json['website']) as String?,
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}

/// Riverpod provider for a Dio instance configured for public endpoints
/// (no /v1 suffix, no auth interceptor).
final _publicDioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: ApiConfig.baseUrl, // https://api.academiahelm.com/api (no /v1)
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 15),
      headers: <String, dynamic>{
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      responseType: ResponseType.json,
    ),
  );
});

/// Riverpod provider for [SchoolService].
final schoolServiceProvider = Provider<SchoolService>((ref) {
  return SchoolService(ref.watch(_publicDioProvider));
});
