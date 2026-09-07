/// Client HTTP Academia Community — dio + JWT Bearer.
///
/// Le token communauté (7 jours) est renvoyé par /community/auth/login
/// et persisté dans `shared_preferences` (aucune exposition hors de l'app).
/// Toutes les requêtes partent avec `Authorization: Bearer <token>`.
library;

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config/app_config.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  const ApiException(this.message, [this.statusCode]);

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const _tokenKey = 'community_token';

  Dio? _dio;
  String? _token;

  Future<void> ensureInitialized() async {
    if (_dio != null) return;
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'AcademiaCommunity-Mobile/1.0 (Flutter)',
      },
      validateStatus: (status) => status != null && status >= 200 && status < 300,
    ))
      ..interceptors.add(InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _token;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ));
  }

  /// Récupère le token persisté (null si jamais connecté)
  Future<String?> storedToken() async {
    await ensureInitialized();
    return _token;
  }

  Future<void> saveToken(String token) async {
    await ensureInitialized();
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  Future<void> clearToken() async {
    await ensureInitialized();
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  /// GET JSON décodé (401 → ApiException, message du serveur préservé)
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    await ensureInitialized();
    try {
      final res = await _dio!.get<dynamic>(path, queryParameters: query);
      return res.data;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<dynamic> post(String path, {Object? body}) async {
    await ensureInitialized();
    try {
      final res = await _dio!.post<dynamic>(path, data: body ?? {});
      return res.data;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<dynamic> patch(String path, {Object? body}) async {
    await ensureInitialized();
    try {
      final res = await _dio!.patch<dynamic>(path, data: body ?? {});
      return res.data;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<dynamic> delete(String path) async {
    await ensureInitialized();
    try {
      final res = await _dio!.delete<dynamic>(path);
      return res.data;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  ApiException _toApiException(DioException e) {
    final status = e.response?.statusCode;
    if (status == 401) {
      // Token expiré → purge locale (l'utilisateur repasse par le login)
      clearToken();
    }
    final data = e.response?.data;
    String message = 'Service momentanément indisponible — vérifiez votre connexion';
    if (data is Map && data['message'] != null) {
      message = data['message'].toString();
    } else if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError) {
      message = 'Connexion impossible — vérifiez votre réseau';
    }
    return ApiException(message, status);
  }
}
