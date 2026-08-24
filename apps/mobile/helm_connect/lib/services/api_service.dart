// ============================================================================
// HELM CONNECT — API Service
// ============================================================================
// HTTP client wrapper for the Academia Helm backend (BFF + WebSocket).
//
// ⭐ Configuration :
//   - Production : https://academiahelm.com (BFF routes under /api/*)
//   - Per-tenant : https://<slug>.academiahelm.com
//   - The tenant is selected at first launch → stored in SharedPreferences
//
// ⭐ Endpoints (same as web) :
//   POST /api/auth/login            — login (email, password, tenantId)
//   GET  /api/auth/me                — current user
//   GET  /api/auth/available-tenants — list of schools (tenant selection)
//   GET  /api/chat/conversations     — list conversations
//   POST /api/chat/conversations/direct
//   GET  /api/chat/conversations/:id/messages
//   POST /api/chat/conversations/:id/messages/text
//   GET  /api/chat/announcements
//   POST /api/chat/v2/notifications/dnd/enable
//   GET  /api/chat/v2/search?q=...
// ============================================================================

import 'dart:convert';
import 'package:http/http.dart as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  // ⭐ Backend API URL — same as web app (api.academiahelm.com)
  // After tenant selection, the tenant-specific subdomain is used for auth.
  // For API calls (chat, etc.), we always use api.academiahelm.com.
  static const String _defaultBase = 'https://api.academiahelm.com';
  static const String _defaultAuthBase = 'https://academiahelm.com';

  static String? _tenantBase;

  static Future<String> get baseUrl async {
    if (_tenantBase != null) return _tenantBase!;
    final prefs = await SharedPreferences.getInstance();
    _tenantBase = prefs.getString('tenant_base_url') ?? _defaultBase;
    return _tenantBase!;
  }

  static Future<void> setTenantBaseUrl(String url) async {
    _tenantBase = url;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('tenant_base_url', url);
  }

  static Future<void> clearTenant() async {
    _tenantBase = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('tenant_base_url');
    await prefs.remove('tenant_id');
    await prefs.remove('tenant_slug');
    await prefs.remove('tenant_name');
  }
}

class AuthService {
  static const String _tokenKey = 'auth_token';
  static const String _userIdKey = 'auth_user_id';
  static const String _userEmailKey = 'auth_user_email';
  static const String _userRoleKey = 'auth_user_role';

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  static Future<void> saveSession({
    required String token,
    required String userId,
    required String email,
    required String role,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_userIdKey, userId);
    await prefs.setString(_userEmailKey, email);
    await prefs.setString(_userRoleKey, role);
  }

  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userIdKey);
    await prefs.remove(_userEmailKey);
    await prefs.remove(_userRoleKey);
  }

  static Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }

  static Future<String?> getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_userIdKey);
  }

  static Future<String?> getUserRole() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_userRoleKey);
  }
}

class ApiService {
  static Future<Map<String, String>> _getHeaders({bool isMultipart = false}) async {
    final token = await AuthService.getToken();
    final prefs = await SharedPreferences.getInstance();
    final tenantId = prefs.getString('tenant_id');
    final headers = <String, String>{
      'Accept': 'application/json',
    };
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    if (tenantId != null) {
      headers['x-tenant-id'] = tenantId;
    }
    return headers;
  }

  /// Handle HTTP response — supports both JSON object ({...}) and JSON array ([...]).
  /// For object responses (login, getCurrentUser, etc.), returns Map<String, dynamic>.
  /// For array responses (listConversations, listMessages, etc.), returns List<dynamic>.
  static Future<dynamic> _handleResponse(http.Response response) async {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return <String, dynamic>{};
      final decoded = jsonDecode(response.body);
      return decoded; // Map or List — caller will cast as needed
    }
    // Error
    try {
      final err = jsonDecode(response.body);
      if (err is Map<String, dynamic>) {
        throw ApiException(
          statusCode: response.statusCode,
          message: (err['message'] as String?) ?? (err['error'] as String?) ?? 'Erreur ${response.statusCode}',
          backendError: err,
        );
      }
      throw ApiException(
        statusCode: response.statusCode,
        message: 'Erreur ${response.statusCode}',
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(
        statusCode: response.statusCode,
        message: 'Erreur ${response.statusCode}',
      );
    }
  }

  // ─── Auth ─────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> searchTenants(String query) async {
    final base = await ApiConfig.baseUrl;
    final response = await http.get(
      Uri.parse('$base/api/auth/available-tenants?q=${Uri.encodeQueryComponent(query)}'),
    );
    final data = await _handleResponse(response);
    // The endpoint returns { tenants: [...] } OR a raw array — handle both
    if (data is Map<String, dynamic>) {
      final tenants = data['tenants'] as List<dynamic>? ?? [];
      return tenants.cast<Map<String, dynamic>>().toList();
    }
    if (data is List) {
      return data.cast<Map<String, dynamic>>().toList();
    }
    return [];
  }

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
    required String tenantSlug,
  }) async {
    final base = await ApiConfig.baseUrl;
    final response = await http.post(
      Uri.parse('$base/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
        'tenantSlug': tenantSlug,
      }),
    );
    final data = await _handleResponse(response) as Map<String, dynamic>;
    // Persist token + user info
    final token = data['token'] as String;
    final user = data['user'] as Map<String, dynamic>;
    await AuthService.saveSession(
      token: token,
      userId: user['id'] as String,
      email: user['email'] as String,
      role: user['role'] as String? ?? '',
    );
    // Persist tenant info
    final prefs = await SharedPreferences.getInstance();
    final tenant = data['tenant'] as Map<String, dynamic>?;
    if (tenant != null) {
      await prefs.setString('tenant_id', tenant['id'] as String);
      await prefs.setString('tenant_slug', tenant['slug'] as String? ?? tenantSlug);
      await prefs.setString('tenant_name', tenant['name'] as String? ?? '');
      // Update base URL with tenant subdomain for subsequent requests
      final subdomain = tenant['subdomain'] as String? ?? tenant['slug'] as String? ?? tenantSlug;
      await ApiConfig.setTenantBaseUrl('https://$subdomain.academiahelm.com');
    }
    return data;
  }

  static Future<Map<String, dynamic>> getCurrentUser() async {
    final base = await ApiConfig.baseUrl;
    final headers = await _getHeaders();
    final response = await http.get(Uri.parse('$base/api/auth/me'), headers: headers);
    final data = await _handleResponse(response);
    if (data is Map<String, dynamic>) return data;
    throw ApiException(statusCode: response.statusCode, message: 'Invalid response format');
  }

  static Future<void> logout() async {
    await AuthService.clearSession();
    await ApiConfig.clearTenant();
  }

  // ─── Chat ──────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> listConversations() async {
    final base = await ApiConfig.baseUrl;
    final userId = await AuthService.getUserId();
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$base/api/chat/conversations?userId=$userId'),
      headers: headers,
    );
    final data = await _handleResponse(response);
    if (data is List) {
      return data.cast<Map<String, dynamic>>().toList();
    }
    return [];
  }

  static Future<Map<String, dynamic>> createDirectConversation(String otherUserId) async {
    final base = await ApiConfig.baseUrl;
    final userId = await AuthService.getUserId();
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$base/api/chat/conversations/direct'),
      headers: headers,
      body: jsonEncode({'currentUserId': userId, 'otherUserId': otherUserId}),
    );
    return _handleResponse(response) as Map<String, dynamic>;
  }

  static Future<List<Map<String, dynamic>>> listMessages(String conversationId, {int limit = 50}) async {
    final base = await ApiConfig.baseUrl;
    final userId = await AuthService.getUserId();
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$base/api/chat/conversations/$conversationId/messages?userId=$userId&limit=$limit'),
      headers: headers,
    );
    final data = await _handleResponse(response);
    if (data is List) {
      return data.cast<Map<String, dynamic>>().toList();
    }
    return [];
  }

  static Future<Map<String, dynamic>> sendTextMessage({
    required String conversationId,
    required String content,
    String? replyToId,
  }) async {
    final base = await ApiConfig.baseUrl;
    final userId = await AuthService.getUserId();
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$base/api/chat/conversations/$conversationId/messages/text'),
      headers: headers,
      body: jsonEncode({
        'senderId': userId,
        'content': content,
        if (replyToId != null) 'replyToId': replyToId,
      }),
    );
    return _handleResponse(response) as Map<String, dynamic>;
  }

  static Future<void> markConversationRead(String conversationId) async {
    final base = await ApiConfig.baseUrl;
    final userId = await AuthService.getUserId();
    final headers = await _getHeaders();
    await http.post(
      Uri.parse('$base/api/chat/conversations/$conversationId/mark-read'),
      headers: headers,
      body: jsonEncode({'userId': userId}),
    );
  }

  // ─── Announcements ─────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> listAnnouncements() async {
    final base = await ApiConfig.baseUrl;
    final userId = await AuthService.getUserId();
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$base/api/chat/announcements?userId=$userId&limit=50'),
      headers: headers,
    );
    final data = await _handleResponse(response);
    if (data is Map<String, dynamic>) {
      final items = data['items'] as List<dynamic>? ?? [];
      return items.cast<Map<String, dynamic>>().toList();
    }
    if (data is List) {
      return data.cast<Map<String, dynamic>>().toList();
    }
    return [];
  }

  // ─── Search ────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> globalSearch(String query) async {
    final base = await ApiConfig.baseUrl;
    final userId = await AuthService.getUserId();
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$base/api/chat/v2/search?userId=$userId&q=${Uri.encodeQueryComponent(query)}'),
      headers: headers,
    );
    return _handleResponse(response) as Map<String, dynamic>;
  }

  // ─── Generic helpers ───────────────────────────────────────────

  static Future<Map<String, dynamic>> get(String path) async {
    final base = await ApiConfig.baseUrl;
    final headers = await _getHeaders();
    final response = await http.get(Uri.parse('$base$path'), headers: headers);
    return _handleResponse(response) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final base = await ApiConfig.baseUrl;
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$base$path'),
      headers: headers,
      body: jsonEncode(body),
    );
    return _handleResponse(response) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) async {
    final base = await ApiConfig.baseUrl;
    final headers = await _getHeaders();
    final response = await http.put(
      Uri.parse('$base$path'),
      headers: headers,
      body: jsonEncode(body),
    );
    return _handleResponse(response) as Map<String, dynamic>;
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final Map<String, dynamic>? backendError;

  ApiException({required this.statusCode, required this.message, this.backendError});

  @override
  String toString() => 'ApiException($statusCode): $message';

  // ⭐ V2: Send attachment (image/document/audio) to a conversation
  Future<void> sendAttachment({
    required String conversationId,
    required File file,
    required String type,
    required String fileName,
  }) async {
    final url = await ApiConfig.baseUrl;
    final userId = await ApiConfig.getUserId() ?? '';
    final headers = await ApiConfig._getHeaders(isMultipart: true);

    final request = http.MultipartRequest('POST', Uri.parse('$url/api/chat/conversations/$conversationId/messages/attachment'));
    request.files.add(await http.MultipartFile.fromPath('file', file.path));
    request.fields['senderId'] = userId;
    request.fields['type'] = type;
    request.headers.addAll(headers);

    final response = await request.send();
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw ApiException(statusCode: response.statusCode, message: 'Failed to send attachment');
    }
  }

  // ⭐ V2: Get auth token
  Future<String?> getAuthToken() async {
    return await ApiConfig.getToken();
  }
}
