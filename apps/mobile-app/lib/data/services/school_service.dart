import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_config.dart';
import '../../domain/entities/tenant_school.dart';

/// Service that fetches the public list of schools from the backend.
///
/// PERFORMANCE STRATEGY (matches web's < 1s load time):
/// 1. Use the DIRECT NestJS API (0.37s measured) — NOT the BFF (1.45s)
/// 2. Run BFF as fallback in PARALLEL (not sequential) — first to respond wins
/// 3. Short timeout (8s) — fail fast, don't make user wait 30s
/// 4. Cache result in memory for 5 minutes (matches web's React Query staleTime)
class SchoolService {
  SchoolService(this._apiDio, this._bffDio);

  final Dio _apiDio;
  final Dio _bffDio;

  // In-memory cache (matches web's React Query 5-min staleTime)
  static List<TenantSchool>? _cache;
  static DateTime? _cacheTime;
  static const _cacheTTL = Duration(minutes: 5);

  /// Last error message (for debugging — displayed in the UI error state).
  String? lastError;

  /// Fetches all public schools with sequential fallback.
  ///
  /// Strategy: try API direct first (fastest — 0.37s measured).
  /// If it fails or times out (8s), try BFF.
  /// Throws on error so the FutureProvider enters error state.
  Future<List<TenantSchool>> fetchSchools() async {
    // Check cache first
    if (_cache != null && _cacheTime != null &&
        DateTime.now().difference(_cacheTime!) < _cacheTTL) {
      debugPrint('[SchoolService] Returning cached ${_cache!.length} schools');
      return _cache!;
    }

    // Attempt 1: Direct API (fastest — 0.37s)
    final apiResult = await _tryFetch(_apiDio, 'API');
    if (apiResult != null) {
      _cache = apiResult;
      _cacheTime = DateTime.now();
      return apiResult;
    }

    // Attempt 2: BFF (fallback — slower but bypasses Cloudflare)
    final bffResult = await _tryFetch(_bffDio, 'BFF');
    if (bffResult != null) {
      _cache = bffResult;
      _cacheTime = DateTime.now();
      return bffResult;
    }

    // Both failed — throw with last error
    throw Exception('Impossible de charger les écoles. Dernière erreur: $lastError');
  }

  Future<List<TenantSchool>?> _tryFetch(Dio dio, String label) async {
    try {
      debugPrint('[$label] Fetching schools from /public/schools/list ...');
      final response = await dio.get<dynamic>(
        '/public/schools/list',
        options: Options(
          // Short timeout — fail fast so the other attempt can win
          receiveTimeout: const Duration(seconds: 8),
          sendTimeout: const Duration(seconds: 8),
          headers: <String, dynamic>{
            'Accept': 'application/json',
            'User-Agent': 'AcademiaHelm-Mobile/1.0 (Flutter)',
          },
        ),
      );

      debugPrint('[$label] Response status: ${response.statusCode}');

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

      final schools = rawList
          .whereType<Map<String, dynamic>>()
          .map(_parseSchool)
          .where((s) => s.name.isNotEmpty)
          .toList();

      debugPrint('[$label] Parsed ${schools.length} schools');
      lastError = null;
      return schools;
    } catch (e) {
      debugPrint('[$label] ERROR: $e');
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

  /// Clears the in-memory cache (used when user explicitly refreshes).
  void clearCache() {
    _cache = null;
    _cacheTime = null;
  }
}

/// Dio instance for direct NestJS API (preferred — 4x faster than BFF).
final _apiDioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: ApiConfig.baseUrl, // https://api.academiahelm.com/api
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 8),
      sendTimeout: const Duration(seconds: 8),
      headers: <String, dynamic>{
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'AcademiaHelm-Mobile/1.0 (Flutter)',
      },
      responseType: ResponseType.json,
    ),
  );
});

/// Dio instance for the web app's BFF (fallback — slower but bypasses Cloudflare).
final _bffDioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: 'https://academiahelm.com/api',
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 8),
      sendTimeout: const Duration(seconds: 8),
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
    ref.watch(_apiDioProvider),
    ref.watch(_bffDioProvider),
  );
});
