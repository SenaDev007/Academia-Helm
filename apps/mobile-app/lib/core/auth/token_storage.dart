import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Secure token storage using [FlutterSecureStorage].
///
/// Provides methods to persist, retrieve, and clear access and refresh
/// tokens. On iOS this uses Keychain; on Android it uses EncryptedSharedPreferences.
class TokenStorage {
  TokenStorage._();

  // ── Storage Keys ──────────────────────────────────────────────────────

  static const String _accessTokenKey = 'ah_access_token';
  static const String _refreshTokenKey = 'ah_refresh_token';
  static const String _tokenExpiryKey = 'ah_token_expiry';

  // ── Secure Storage Instance ───────────────────────────────────────────

  static const FlutterSecureStorage _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

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
  static Future<bool> isTokenExpired({Duration buffer = const Duration(seconds: 30)}) async {
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

  /// Removes all stored tokens from secure storage.
  static Future<void> clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _tokenExpiryKey);
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
}
