// ============================================================================
// AUTH SERVICE — Authentification (JWT)
// ============================================================================
// API endpoints:
//   POST /api/portal/auth/parent → connexion parent (phone/email, sans OTP)
//   POST /api/portal/auth/teacher → connexion enseignant (matricule + password)
//   POST /api/auth/login → connexion école (email + password)
// ============================================================================

import 'package:dio/dio.dart';
import '../core/config/api_config.dart';
import '../core/utils/storage_utils.dart';
import 'school_service.dart';

class AuthService {
  final Dio _dio;

  AuthService() : _dio = Dio(BaseOptions(
    baseUrl: ApiConfig.baseUrl,
    connectTimeout: ApiConfig.requestTimeout,
    receiveTimeout: ApiConfig.requestTimeout,
    headers: ApiConfig.defaultHeaders,
  ));

  /// Connexion parent (sans OTP par défaut)
  /// [identifier] : numéro de téléphone ou email
  Future<AuthResult> loginParent({
    required String tenantId,
    required String identifier,
    String? password,
  }) async {
    final isEmail = identifier.contains('@');

    try {
      final response = await _dio.post('/portal/auth/parent', data: {
        'tenantId': tenantId,
        'identifierType': isEmail ? 'EMAIL' : 'PHONE',
        if (isEmail) 'email': identifier,
        if (!isEmail) 'phone': identifier,
        if (password != null && password.isNotEmpty) 'password': password,
        'portal_type': 'PARENT',
      });

      final data = response.data;
      if (data is Map<String, dynamic>) {
        // Si le backend exige un OTP (PARENT_OTP_ENABLED=true)
        if (data['requiresOtp'] == true) {
          return AuthResult.requiresOtp(
            message: data['message'] ?? 'Code OTP requis',
          );
        }

        // Connexion réussie
        if (data['success'] == true && data['accessToken'] != null) {
          await _saveSession(data);
          return AuthResult.success(
            token: data['accessToken'],
            user: AuthUser.fromJson(data['user']),
            portalType: 'PARENT',
          );
        }
      }

      return AuthResult.failure(
        error: data['message'] ?? data['error'] ?? 'Erreur de connexion',
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      return AuthResult.failure(
        error: data?['message'] ?? data?['error'] ?? 'Erreur réseau',
      );
    } catch (e) {
      return AuthResult.failure(error: 'Erreur inattendue: $e');
    }
  }

  /// Connexion enseignant
  Future<AuthResult> loginTeacher({
    required String tenantId,
    required String teacherIdentifier,
    required String password,
  }) async {
    try {
      final response = await _dio.post('/portal/auth/teacher', data: {
        'tenantId': tenantId,
        'teacherIdentifier': teacherIdentifier,
        'password': password,
        'portal_type': 'TEACHER',
      });

      final data = response.data;
      if (data is Map<String, dynamic> && data['success'] == true) {
        await _saveSession(data);
        return AuthResult.success(
          token: data['accessToken'],
          user: AuthUser.fromJson(data['user']),
          portalType: 'TEACHER',
        );
      }

      return AuthResult.failure(
        error: data['message'] ?? data['error'] ?? 'Erreur de connexion',
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      return AuthResult.failure(
        error: data?['message'] ?? data?['error'] ?? 'Erreur réseau',
      );
    } catch (e) {
      return AuthResult.failure(error: 'Erreur inattendue: $e');
    }
  }

  /// Connexion école (direction/administration)
  Future<AuthResult> loginSchool({
    required String tenantId,
    required String email,
    required String password,
  }) async {
    try {
      final response = await _dio.post('/auth/login', data: {
        'tenantId': tenantId,
        'email': email,
        'password': password,
        'portal_type': 'SCHOOL',
      });

      final data = response.data;
      if (data is Map<String, dynamic> && data['success'] == true) {
        await _saveSession(data);
        return AuthResult.success(
          token: data['accessToken'],
          user: AuthUser.fromJson(data['user']),
          portalType: 'SCHOOL',
        );
      }

      return AuthResult.failure(
        error: data['message'] ?? data['error'] ?? 'Erreur de connexion',
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      return AuthResult.failure(
        error: data?['message'] ?? data?['error'] ?? 'Erreur réseau',
      );
    } catch (e) {
      return AuthResult.failure(error: 'Erreur inattendue: $e');
    }
  }

  /// Déconnexion
  Future<void> logout() async {
    await StorageUtils.remove('auth_token');
    await StorageUtils.remove('auth_user');
    await StorageUtils.remove('auth_portal_type');
  }

  /// Vérifie si l'utilisateur est connecté
  Future<bool> isAuthenticated() async {
    final token = await StorageUtils.getString('auth_token');
    return token != null && token.isNotEmpty;
  }

  /// Récupère le token JWT stocké
  Future<String?> getToken() async {
    return await StorageUtils.getString('auth_token');
  }

  /// Sauvegarde la session après connexion réussie
  Future<void> _saveSession(Map<String, dynamic> data) async {
    await StorageUtils.saveString('auth_token', data['accessToken'] ?? '');
    if (data['user'] != null) {
      await StorageUtils.saveObject('auth_user', data['user']);
    }
    if (data['portalType'] != null) {
      await StorageUtils.saveString('auth_portal_type', data['portalType']);
    }
    if (data['expiresAt'] != null) {
      await StorageUtils.saveString('auth_expires_at', data['expiresAt']);
    }
  }
}

// ── Modèles ──

class AuthResult {
  final bool success;
  final bool requiresOtp;
  final String? token;
  final AuthUser? user;
  final String? portalType;
  final String? error;
  final String? message;

  AuthResult._({
    required this.success,
    this.requiresOtp = false,
    this.token,
    this.user,
    this.portalType,
    this.error,
    this.message,
  });

  factory AuthResult.success({
    required String token,
    required AuthUser user,
    required String portalType,
  }) =>
      AuthResult._(
        success: true,
        token: token,
        user: user,
        portalType: portalType,
      );

  factory AuthResult.requiresOtp({required String message}) =>
      AuthResult._(
        success: false,
        requiresOtp: true,
        message: message,
      );

  factory AuthResult.failure({required String error}) =>
      AuthResult._(
        success: false,
        error: error,
      );
}

class AuthUser {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final String tenantId;

  AuthUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.tenantId,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      firstName: json['firstName'] ?? '',
      lastName: json['lastName'] ?? '',
      role: json['role'] ?? 'USER',
      tenantId: json['tenantId'] ?? '',
    );
  }

  String get fullName => '$firstName $lastName'.trim();
}
