import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_config.dart';
import '../../domain/entities/tenant_school.dart';

/// Service that fetches the public list of schools from the backend.
///
/// IMPORTANT: The mobile app routes public schools requests through the
/// WEB APP's BFF (https://academiahelm.com/api/public/schools/list) instead
/// of calling NestJS directly. This is because Cloudflare Managed Challenge
/// blocks requests from mobile User-Agents (returns 403 HTML 'Just a
/// moment...'). The web app's BFF route already adds the correct
/// User-Agent header + Accept: application/json to bypass Cloudflare.
///
/// Mirrors the web app's `usePublicSchools()` hook behavior.
class SchoolService {
  SchoolService(this._dio);

  final Dio _dio;

  /// Fetches all public schools (one-shot, no auth required).
  ///
  /// Calls the web app's BFF route: `GET https://academiahelm.com/api/public/schools/list`
  /// which proxies to NestJS with the correct headers to bypass Cloudflare.
  ///
  /// Returns an empty list on timeout/error so the UI can still render.
  Future<List<TenantSchool>> fetchSchools() async {
    try {
      final response = await _dio.get<dynamic>(
        '/public/schools/list',
        options: Options(
          // Public endpoint — no auth token needed
          extra: <String, dynamic>{'skipAuth': true},
          receiveTimeout: const Duration(seconds: 20),
          sendTimeout: const Duration(seconds: 20),
          headers: <String, dynamic>{
            'Accept': 'application/json',
            'User-Agent': 'AcademiaHelm-Mobile/1.0 (Flutter)',
          },
        ),
      );

      final data = response.data;
      List<dynamic> rawList;

      // The BFF may return: array | { schools: [...] } | { tenants: [...] } | { error: 'timeout' }
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
          // BFF returns { schools: [], tenants: [], error: 'timeout' } on timeout
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
    } catch (e, st) {
      debugPrint('SchoolService.fetchSchools() error: $e');
      debugPrint('Stack trace: $st');
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

/// Riverpod provider for a Dio instance configured for the web app's BFF.
///
/// The BFF (Backend For Frontend) is the Next.js web app at
/// https://academiahelm.com — it proxies public API requests to NestJS
/// with the correct headers to bypass Cloudflare Managed Challenge.
///
/// We use the BFF instead of calling NestJS directly because Cloudflare
/// blocks mobile User-Agents with a 403 HTML challenge page.
final _publicDioProvider = Provider<Dio>((ref) {
  // BFF base URL — the web app's Next.js API routes
  // Production: https://academiahelm.com
  // The BFF route /api/public/schools/list proxies to NestJS
  const bffBaseUrl = 'https://academiahelm.com/api';

  return Dio(
    BaseOptions(
      baseUrl: bffBaseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
      headers: <String, dynamic>{
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'AcademiaHelm-Mobile/1.0 (Flutter)',
      },
      responseType: ResponseType.json,
      // Don't validate status — the BFF may return 200 with empty array on timeout
      validateStatus: (status) => status != null && status >= 200 && status < 400,
    ),
  );
});

/// Riverpod provider for [SchoolService].
final schoolServiceProvider = Provider<SchoolService>((ref) {
  return SchoolService(ref.watch(_publicDioProvider));
});
