import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive/hive.dart';
import 'package:academia_helm_mobile/domain/entities/user.dart';
import 'package:academia_helm_mobile/domain/entities/tenant_school.dart';

/// Local storage for authentication-related data using Flutter Secure Storage
/// for sensitive tokens and Hive for non-sensitive cached data.
class AuthLocalStorage {
  static const _accessTokenKey = 'auth_access_token';
  static const _refreshTokenKey = 'auth_refresh_token';
  static const _userBoxName = 'auth_user_box';
  static const _userKey = 'current_user';
  static const _selectedTenantKey = 'selected_tenant';

  final FlutterSecureStorage _secureStorage;
  final Box _userBox;

  AuthLocalStorage({
    required FlutterSecureStorage secureStorage,
    required Box userBox,
  })  : _secureStorage = secureStorage,
        _userBox = userBox;

  // ─── Access Token ──────────────────────────────────────────────────────────

  Future<void> saveAccessToken(String token) async {
    await _secureStorage.write(key: _accessTokenKey, value: token);
  }

  Future<String?> getAccessToken() async {
    return _secureStorage.read(key: _accessTokenKey);
  }

  Future<void> deleteAccessToken() async {
    await _secureStorage.delete(key: _accessTokenKey);
  }

  // ─── Refresh Token ─────────────────────────────────────────────────────────

  Future<void> saveRefreshToken(String token) async {
    await _secureStorage.write(key: _refreshTokenKey, value: token);
  }

  Future<String?> getRefreshToken() async {
    return _secureStorage.read(key: _refreshTokenKey);
  }

  Future<void> deleteRefreshToken() async {
    await _secureStorage.delete(key: _refreshTokenKey);
  }

  // ─── User ──────────────────────────────────────────────────────────────────

  Future<void> saveUser(User user) async {
    final json = user.toJson();
    await _userBox.put(_userKey, jsonEncode(json));
  }

  User? getUser() {
    final raw = _userBox.get(_userKey) as String?;
    if (raw == null) return null;
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      return User.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearUser() async {
    await _userBox.delete(_userKey);
  }

  // ─── Selected Tenant ───────────────────────────────────────────────────────

  Future<void> saveSelectedTenant(TenantSchool tenant) async {
    final json = tenant.toJson();
    await _userBox.put(_selectedTenantKey, jsonEncode(json));
  }

  TenantSchool? getSelectedTenant() {
    final raw = _userBox.get(_selectedTenantKey) as String?;
    if (raw == null) return null;
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      return TenantSchool.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearSelectedTenant() async {
    await _userBox.delete(_selectedTenantKey);
  }

  // ─── Clear All ─────────────────────────────────────────────────────────────

  /// Clears all authentication data from both secure storage and Hive.
  Future<void> clearAll() async {
    await deleteAccessToken();
    await deleteRefreshToken();
    await clearUser();
    await clearSelectedTenant();
  }
}
