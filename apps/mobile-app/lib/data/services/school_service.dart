import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_config.dart';
import '../../domain/entities/tenant_school.dart';

/// Service that fetches the public list of schools from the backend.
///
/// Uses a FALLBACK strategy:
/// 1. Try the web app's BFF (https://academiahelm.com/api/public/schools/list)
/// 2. If that fails, try the NestJS API directly (https://api.academiahelm.com/api/public/schools/list)
/// 3. If both fail, return empty list + log the error
///
/// Both endpoints are public (no auth required) and return the same data.
/// The BFF is preferred because it handles Cloudflare challenges, but
/// the direct API works too (verified via curl from the mobile UA).
class SchoolService {
  SchoolService(this._bffDio, this._apiDio);

  final Dio _bffDio;
  final Dio _apiDio;

  /// Last error message (for debugging — displayed in the UI error state).
  String? lastError;

  /// Fetches all public schools with fallback strategy.
  ///
  /// Throws on error so the FutureProvider enters error state and the UI
  /// can show the error message + retry button.
  Future<List<TenantSchool>> fetchSchools() async {
    // Attempt 1: BFF
    final bffResult = await _tryFetch(_bffDio, 'BFF');
    if (bffResult != null) return bffResult;

    // Attempt 2: Direct API
    final apiResult = await _tryFetch(_apiDio, 'API');
    if (apiResult != null) return apiResult;

    // Both failed — throw so the UI shows the error state
    throw Exception('Impossible de charger les écoles. '
        'BFF et API directe ont échoué. '
        'Dernière erreur: $lastError');
  }

  Future<List<TenantSchool>?> _tryFetch(Dio dio, String label) async {
    try {
      debugPrint('[$label] Fetching schools from /public/schools/list ...');
      final response = await dio.get<dynamic>(
        '/public/schools/list',
        options: Options(
          receiveTimeout: const Duration(seconds: 20),
          sendTimeout: const Duration(seconds: 20),
          headers: <String, dynamic>{
            'Accept': 'application/json',
            'User-Agent': 'AcademiaHelm-Mobile/1.0 (Flutter)',
          },
        ),
      );

      debugPrint('[$label] Response status: ${response.statusCode}');
      debugPrint('[$label] Response type: ${response.data.runtimeType}');

      final data = response.data;
      List<dynamic> rawList;

      if (data is List) {
        rawList = data;
      } else if (data is String) {
        // Dio might not have parsed it — try manual JSON decode
        try {
          final decoded = jsonDecode(data);
          if (decoded is List) {
            rawList = decoded;
          } else if (decoded is Map<String, dynamic>) {
            rawList = (decoded['schools'] ?? decoded['tenants'] ?? decoded['data']) as List? ?? [];
          } else {
            rawList = [];
          }
        } catch (_) {
          rawList = [];
        }
      } else if (data is Map<String, dynamic>) {
        if (data['schools'] is List) {
          rawList = data['schools'] as List;
        } else if (data['tenants'] is List) {
          rawList = data['tenants'] as List;
        } else if (data['data'] is List) {
          rawList = data['data'] as List;
        } else {
          rawList = [];
        }
      } else {
        rawList = [];
      }

      debugPrint('[$label] Parsed ${rawList.length} raw items');

      final schools = rawList
          .whereType<Map<String, dynamic>>()
          .map(_parseSchool)
          .where((s) => s.name.isNotEmpty)
          .toList();

      debugPrint('[$label] Successfully parsed ${schools.length} schools');
      lastError = null;
      return schools;
    } catch (e, st) {
      debugPrint('[$label] ERROR: $e');
      debugPrint('[$label] Stack: $st');
      lastError = '[$label] $e';
      return null;
    }
  }

  /// Parses a raw JSON object into a [TenantSchool].
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
      phone: (json['phone'] ?? json['phonePrimary'] ?? json['primaryPhone']) as String?,
      email: (json['email'] ?? json['primaryEmail'] ?? json['primaryEmail']) as String?,
      websiteUrl: (json['websiteUrl'] ?? json['website']) as String?,
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}

/// Need dart:convert for jsonDecode (imported at top of file)

/// Dio instance for the web app's BFF (Next.js API routes).
final _bffDioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: 'https://academiahelm.com/api',
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
      headers: <String, dynamic>{
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'AcademiaHelm-Mobile/1.0 (Flutter)',
      },
      responseType: ResponseType.json,
    ),
  );
});

/// Dio instance for direct NestJS API calls (fallback).
final _apiDioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: ApiConfig.baseUrl, // https://api.academiahelm.com/api
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
      headers: <String, dynamic>{
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'AcademiaHelm-Mobile/1.0 (Flutter)',
      },
      responseType: ResponseType.json,
    ),
  );
});

/// Riverpod provider for [SchoolService].
final schoolServiceProvider = Provider<SchoolService>((ref) {
  return SchoolService(
    ref.watch(_bffDioProvider),
    ref.watch(_apiDioProvider),
  );
});
