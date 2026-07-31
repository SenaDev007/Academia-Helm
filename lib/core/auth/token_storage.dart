import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Secure token storage using [FlutterSecureStorage].
///
/// Provides methods to persist, retrieve, and clear access and refresh
/// tokens. On iOS this uses Keychain; on Android it uses EncryptedSharedPreferences.
///
/// Also manages session data, activity tracking, and user/tenant persistence.
class TokenStorage {
  TokenStorage._();

  // ── Storage Keys ──────────────────────────────────────────────────────

  static const String _accessTokenKey = 'ah_access_token';
  static const String _refreshTokenKey = 'ah_refresh_token';
  static const String _tokenExpiryKey = 'ah_token_expiry';
  static const String _sessionIdKey = 'ah_session_id';
  static const String _lastActivityKey = 'ah_last_activity';
  static const String _userDataKey = 'ah_user_data';
  static const String _tenantDataKey = 'ah_tenant_data';

  // ── Secure Storage Instance ───────────────────────────────────────────

  static const FlutterSecureStorage _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  // In-memory cache for synchronous reads (populated after first async read).
  static Map<String, dynamic>? _cachedUserData;
  static Map<String, dynamic>? _cachedTenantData;

  // ── Save Tokens ───────────────────────────────────────────────────────

  /// Persists the [accessToken], [refreshToken], and optional [expiresIn]
  /// duration to secure storage.
  static Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    Duration? expiresIn,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);

    if (expiresIn != null) {
      final DateTime expiry = DateTime.now().add(expiresIn);
      await _storage.write(
        key: _tokenExpiryKey,
        value: expiry.toIso8601String(),
      );
    }
  }

  // ── Get Access Token ──────────────────────────────────────────────────

  /// Retrieves the stored access token, or `null` if not available.
  static Future<String?> getAccessToken() async {
    return _storage.read(key: _accessTokenKey);
  }

  // ── Get Refresh Token ─────────────────────────────────────────────────

  /// Retrieves the stored refresh token, or `null` if not available.
  static Future<String?> getRefreshToken() async {
    return _storage.read(key: _refreshTokenKey);
  }

  // ── Check Token Expiry ────────────────────────────────────────────────

  /// Returns `true` if the stored access token has expired or will expire
  /// within the given [buffer] (defaults to 30 seconds).
  static Future<bool> isTokenExpired({
    Duration buffer = const Duration(seconds: 30),
  }) async {
    final String? expiryStr = await _storage.read(key: _tokenExpiryKey);
    if (expiryStr == null) return true;

    try {
      final DateTime expiry = DateTime.parse(expiryStr);
      return DateTime.now().isAfter(expiry.subtract(buffer));
    } catch (_) {
      return true;
    }
  }

  // ── Clear Tokens ──────────────────────────────────────────────────────

  /// Removes all stored tokens and session data from secure storage.
  static Future<void> clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _tokenExpiryKey);
    await _storage.delete(key: _sessionIdKey);
    await _storage.delete(key: _lastActivityKey);
    await _storage.delete(key: _userDataKey);
    await _storage.delete(key: _tenantDataKey);
    _cachedUserData = null;
    _cachedTenantData = null;
  }

  // ── Has Tokens ────────────────────────────────────────────────────────

  /// Returns `true` if both access and refresh tokens are present.
  static Future<bool> hasTokens() async {
    final String? accessToken = await getAccessToken();
    final String? refreshToken = await getRefreshToken();
    return accessToken != null &&
        accessToken.isNotEmpty &&
        refreshToken != null &&
        refreshToken.isNotEmpty;
  }

  // ── Update Access Token Only ──────────────────────────────────────────

  /// Updates the access token without changing the refresh token.
  /// Useful after a successful token refresh.
  static Future<void> updateAccessToken({
    required String accessToken,
    Duration? expiresIn,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);

    if (expiresIn != null) {
      final DateTime expiry = DateTime.now().add(expiresIn);
      await _storage.write(
        key: _tokenExpiryKey,
        value: expiry.toIso8601String(),
      );
    }
  }

  // ── Session ID ────────────────────────────────────────────────────────

  /// Persists the session ID to secure storage.
  static Future<void> setSessionId(String id) async {
    await _storage.write(key: _sessionIdKey, value: id);
  }

  /// Retrieves the stored session ID, or `null` if not available.
  static Future<String?> getSessionId() async {
    return _storage.read(key: _sessionIdKey);
  }

  // ── Persist Session ───────────────────────────────────────────────────

  /// Persists user and tenant data to secure storage as JSON.
  ///
  /// [user] is a map of user data (required).
  /// [tenant] is an optional map of tenant data.
  static Future<void> persistSession({
    required Map<String, dynamic> user,
    Map<String, dynamic>? tenant,
  }) async {
    if (user.isNotEmpty) {
      // Merge with existing user data if present
      final existing = await getSessionUser();
      final merged = <String, dynamic>{...?existing, ...user};
      await _storage.write(key: _userDataKey, value: jsonEncode(merged));
      _cachedUserData = merged;
    }

    if (tenant != null) {
      await _storage.write(key: _tenantDataKey, value: jsonEncode(tenant));
      _cachedTenantData = tenant;
    }
  }

  /// Retrieves the stored user data from secure storage.
  /// Returns `null` if not available.
  static Future<Map<String, dynamic>?> getSessionUser() async {
    if (_cachedUserData != null) return _cachedUserData;
    final String? data = await _storage.read(key: _userDataKey);
    if (data == null || data.isEmpty) return null;
    try {
      _cachedUserData = jsonDecode(data) as Map<String, dynamic>;
      return _cachedUserData;
    } catch (_) {
      return null;
    }
  }

  /// Synchronous version of [getSessionUser] using in-memory cache.
  /// Returns `null` if cache is not populated.
  static Map<String, dynamic>? getSessionUserSync() => _cachedUserData;

  /// Retrieves the stored tenant data from secure storage.
  /// Returns `null` if not available.
  static Future<Map<String, dynamic>?> getSessionTenant() async {
    if (_cachedTenantData != null) return _cachedTenantData;
    final String? data = await _storage.read(key: _tenantDataKey);
    if (data == null || data.isEmpty) return null;
    try {
      _cachedTenantData = jsonDecode(data) as Map<String, dynamic>;
      return _cachedTenantData;
    } catch (_) {
      return null;
    }
  }

  /// Synchronous version of [getSessionTenant] using in-memory cache.
  /// Returns `null` if cache is not populated.
  static Map<String, dynamic>? getSessionTenantSync() => _cachedTenantData;

  // ── Last Activity ─────────────────────────────────────────────────────

  /// Updates the last activity timestamp to the current time.
  static Future<void> updateLastActivity() async {
    await _storage.write(
      key: _lastActivityKey,
      value: DateTime.now().toIso8601String(),
    );
  }

  /// Retrieves the last activity timestamp.
  /// Returns `null` if not available.
  static Future<DateTime?> getLastActivity() async {
    final String? data = await _storage.read(key: _lastActivityKey);
    if (data == null || data.isEmpty) return null;
    try {
      return DateTime.parse(data);
    } catch (_) {
      return null;
    }
  }
}
