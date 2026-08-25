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
//   POST /api/chat/conversations/:id/messages/attachment  (multipart)
//   GET  /api/chat/conversations/:id/search?q=...
//   POST /api/chat/messages/:id/react           — add/toggle reaction
//   PUT   /api/chat/messages/:id                — edit message
//   POST  /api/chat/messages/:id/forward         — forward to target conversation
//   POST  /api/chat/messages/:id/important       — mark important
//   POST  /api/chat/messages/:id/pin             — pin message
//   POST  /api/chat/conversations/:id/messages/:id/delete-for-me
//   POST  /api/chat/conversations/:id/messages/:id/delete-for-everyone
//   GET  /api/chat/presence?userIds=...
//   POST /api/chat/presence                      — update own presence status
//   POST /api/chat/avatar                        — upload own avatar (multipart)
//   GET  /api/chat/profile/:userId               — get user profile
//   PUT  /api/chat/profile                       — update profile (bio, status, etc.)
//   POST /api/chat/announcements/:id/confirm     — confirm read announcement
//   POST /api/chat/conversations/:id/summarize  — ORION conversation summary (V3-3)
//   POST /api/chat/messages/:id/transcribe      — Whisper transcription (V3-2)
//   GET  /api/chat/announcements
//   POST /api/chat/v2/notifications/dnd/enable
//   GET  /api/chat/v2/search?q=...
//   POST /api/chat/push/subscribe                — register FCM token
// ============================================================================

import 'dart:convert';
import 'dart:io' show File;
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  // ⭐ Backend API URL — same as mobile-app (BFF proxy via academiahelm.com)
  // After tenant selection, the tenant-specific subdomain is used for auth.
  // For API calls (chat, etc.), we always use the BFF.
  static const String _defaultBase = 'https://academiahelm.com/api';

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

  /// ⭐ V3-9: Fetch public schools list (same as mobile-app SchoolService).
  /// Uses the public endpoint /public/schools/list (no auth required).
  /// The old /api/auth/available-tenants requires JWT → 401 for unauthenticated users.
  static Future<List<Map<String, dynamic>>> searchTenants(String query) async {
    final base = await ApiConfig.baseUrl;
    // ⭐ Use the public schools endpoint (no auth header needed)
    final response = await http.get(
      Uri.parse('$base/public/schools/list'),
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AcademiaHelm-Mobile/1.0 (Flutter)',
      },
    );
    final data = await _handleResponse(response);
    // The endpoint returns a list of schools
    List<Map<String, dynamic>> schools;
    if (data is List) {
      schools = data.cast<Map<String, dynamic>>().toList();
    } else if (data is Map<String, dynamic>) {
      final list = data['data'] ?? data['schools'] ?? data['tenants'] ?? [];
      schools = (list as List).cast<Map<String, dynamic>>().toList();
    } else {
      schools = [];
    }
    // ⭐ Client-side filtering (matches mobile-app pattern)
    if (query.trim().isEmpty) return schools;
    final q = query.toLowerCase();
    return schools.where((s) {
      final name = (s['name'] as String? ?? '').toLowerCase();
      final city = (s['city'] as String? ?? '').toLowerCase();
      final slug = (s['slug'] as String? ?? '').toLowerCase();
      final acronym = (s['acronym'] as String? ?? '').toLowerCase();
      return name.contains(q) || city.contains(q) || slug.contains(q) || acronym.contains(q);
    }).toList();
  }

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
    required String tenantSlug,
  }) async {
    return loginByPortal(
      portal: 'school',
      identifier: email,
      password: password,
      tenantSlug: tenantSlug,
    );
  }

  /// ⭐ V3-9: Portal-aware login — adapts endpoint + payload per portal:
  ///   - school:   POST /auth/login           {email, password, tenant_id, portal_type}
  ///   - teacher:  POST /portal/auth/teacher    {teacherIdentifier, password, tenantId, portal_type}
  ///   - parent:   POST /portal/auth/parent     {identifierType, email|phone, password?, tenantId, portal_type}
  static Future<Map<String, dynamic>> loginByPortal({
    required String portal, // 'school', 'teacher', 'parent'
    required String identifier,
    String? password,
    required String tenantSlug,
  }) async {
    final base = await ApiConfig.baseUrl;

    // ⭐ Determine endpoint URL based on portal (NO /api prefix — base URL already includes it)
    String endpoint;
    Map<String, dynamic> body;

    if (portal == 'teacher') {
      endpoint = '/portal/auth/teacher';
      body = {
        'teacherIdentifier': identifier,
        'password': password ?? '',
        'portal_type': 'TEACHER',
        'tenantId': tenantSlug,
      };
    } else if (portal == 'parent') {
      endpoint = '/portal/auth/parent';
      final isPhone = !identifier.contains('@');
      body = {
        'identifierType': isPhone ? 'PHONE' : 'EMAIL',
        'portal_type': 'PARENT',
        'tenantId': tenantSlug,
      };
      if (isPhone) {
        body['phone'] = identifier;
      } else {
        body['email'] = identifier;
      }
      if (password != null && password.isNotEmpty) {
        body['password'] = password;
      }
    } else {
      // school (default)
      endpoint = '/auth/login';
      body = {
        'email': identifier,
        'password': password ?? '',
        'tenant_id': tenantSlug,
        'portal_type': 'SCHOOL',
      };
    }

    final response = await http.post(
      Uri.parse('$base$endpoint'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );

    final data = await _handleResponse(response) as Map<String, dynamic>;

    // ⭐ Persist token + user info (defensive parsing — keys may vary)
    final token = (data['token'] ?? data['accessToken'] ?? data['access_token']) as String?;
    if (token == null) throw ApiException(statusCode: 401, message: 'Token non reçu');
    final user = (data['user'] ?? data['data']) as Map<String, dynamic>? ?? {};
    await AuthService.saveSession(
      token: token,
      userId: (user['id'] ?? data['userId'] ?? '') as String,
      email: (user['email'] ?? data['email'] ?? identifier) as String,
      role: (user['role'] ?? data['role'] ?? '') as String? ?? '',
    );

    // ⭐ Persist tenant info
    final prefs = await SharedPreferences.getInstance();
    final tenant = data['tenant'] as Map<String, dynamic>?;
    if (tenant != null) {
      await prefs.setString('tenant_id', (tenant['id'] ?? '') as String);
      await prefs.setString('tenant_slug', (tenant['slug'] ?? tenantSlug) as String? ?? tenantSlug);
      await prefs.setString('tenant_name', (tenant['name'] ?? '') as String? ?? '');
      final subdomain = (tenant['subdomain'] ?? tenant['slug'] ?? tenantSlug) as String? ?? tenantSlug;
      await ApiConfig.setTenantBaseUrl('https://$subdomain.academiahelm.com');
    } else {
      // If no tenant object, use the slug we have
      await prefs.setString('tenant_slug', tenantSlug);
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

  // ─── Attachments (V2 — image/document/audio/video) ────────────────

  /// Send a file attachment (image/document/audio/video) to a conversation.
  /// Uses multipart/form-data. The file is read from disk and uploaded.
  ///
  /// [type] should be one of: 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO'
  static Future<Map<String, dynamic>> sendAttachment({
    required String conversationId,
    required File file,
    required String type,
    required String fileName,
    String? mimeType,
  }) async {
    final base = await ApiConfig.baseUrl;
    final userId = await AuthService.getUserId() ?? '';
    final headers = await _getHeaders(isMultipart: true);

    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$base/api/chat/conversations/$conversationId/messages/attachment'),
    );
    request.files.add(await http.MultipartFile.fromPath(
      'file',
      file.path,
      filename: fileName,
      contentType: mimeType != null ? MediaType.parse(mimeType) : null,
    ));
    request.fields['senderId'] = userId;
    request.fields['type'] = type;
    request.headers.addAll(headers);

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        statusCode: response.statusCode,
        message: 'Failed to send attachment: ${response.body}',
      );
    }
    final data = jsonDecode(response.body);
    return data as Map<String, dynamic>;
  }

  // ─── Message actions (V3 — parity with web) ───────────────────────

  /// Add or toggle a reaction on a message (emoji).
  /// Backend: POST /chat/messages/:id/react with { userId, emoji }
  static Future<Map<String, dynamic>> addReaction({
    required String messageId,
    required String emoji,
  }) async {
    return post('/api/chat/messages/$messageId/react', {
      'emoji': emoji,
      // userId is auto-injected by backend from JWT — but the web app sends it
      // explicitly so we keep it for backward compat.
    });
  }

  /// Edit a message (sender only). Backend: PUT /chat/messages/:id
  static Future<Map<String, dynamic>> editMessage({
    required String messageId,
    required String newContent,
  }) async {
    final userId = await AuthService.getUserId() ?? '';
    return put('/api/chat/messages/$messageId', {
      'userId': userId,
      'content': newContent,
    });
  }

  /// Forward a message to another conversation.
  /// Backend: POST /chat/messages/:id/forward with { userId, targetConversationId }
  static Future<Map<String, dynamic>> forwardMessage({
    required String messageId,
    required String targetConversationId,
  }) async {
    final userId = await AuthService.getUserId() ?? '';
    return post('/api/chat/messages/$messageId/forward', {
      'userId': userId,
      'targetConversationId': targetConversationId,
    });
  }

  /// Mark a message as important (toggle).
  /// Backend: POST /chat/messages/:id/important with { userId }
  static Future<Map<String, dynamic>> markImportant(String messageId) async {
    final userId = await AuthService.getUserId() ?? '';
    return post('/api/chat/messages/$messageId/important', {
      'userId': userId,
    });
  }

  /// Pin a message (toggle).
  /// Backend: POST /chat/v2/messages/:id/pin with { userId }
  static Future<Map<String, dynamic>> pinMessage(String messageId) async {
    final userId = await AuthService.getUserId() ?? '';
    return post('/api/chat/v2/messages/$messageId/pin', {
      'userId': userId,
    });
  }

  /// Delete a message for me only.
  /// Backend: POST /chat/conversations/:convId/messages/:id/delete-for-me
  static Future<void> deleteMessageForMe({
    required String conversationId,
    required String messageId,
  }) async {
    final userId = await AuthService.getUserId() ?? '';
    await post(
      '/api/chat/conversations/$conversationId/messages/$messageId/delete-for-me',
      {'userId': userId},
    );
  }

  /// Delete a message for everyone (sender only).
  /// Backend: POST /chat/conversations/:convId/messages/:id/delete-for-everyone
  static Future<void> deleteMessageForEveryone({
    required String conversationId,
    required String messageId,
  }) async {
    final userId = await AuthService.getUserId() ?? '';
    await post(
      '/api/chat/conversations/$conversationId/messages/$messageId/delete-for-everyone',
      {'userId': userId},
    );
  }

  // ─── In-conversation search (V3) ──────────────────────────────────

  /// Search messages inside a conversation.
  /// Backend: GET /chat/conversations/:id/search?userId=&q=
  static Future<List<Map<String, dynamic>>> searchInConversation({
    required String conversationId,
    required String query,
  }) async {
    if (query.length < 2) return [];
    final base = await ApiConfig.baseUrl;
    final userId = await AuthService.getUserId() ?? '';
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$base/api/chat/conversations/$conversationId/search?userId=$userId&q=${Uri.encodeQueryComponent(query)}'),
      headers: headers,
    );
    final data = await _handleResponse(response);
    if (data is List) return data.cast<Map<String, dynamic>>().toList();
    if (data is Map<String, dynamic>) {
      final results = data['results'] as List<dynamic>? ?? [];
      return results.cast<Map<String, dynamic>>().toList();
    }
    return [];
  }

  // ─── Presence (V3) ────────────────────────────────────────────────

  /// Get presence status for a list of users.
  /// Backend: GET /chat/presence?userIds=u1,u2,u3
  static Future<Map<String, dynamic>> getPresence(List<String> userIds) async {
    if (userIds.isEmpty) return {};
    final base = await ApiConfig.baseUrl;
    final headers = await _getHeaders();
    final ids = userIds.join(',');
    final response = await http.get(
      Uri.parse('$base/api/chat/presence?userIds=$ids'),
      headers: headers,
    );
    return _handleResponse(response) as Map<String, dynamic>;
  }

  /// Update own presence status.
  /// Backend: POST /chat/presence with { userId, status }
  /// [status] should be one of: 'online' | 'away' | 'dnd' | 'offline'
  static Future<Map<String, dynamic>> updatePresence(String status) async {
    final userId = await AuthService.getUserId() ?? '';
    return post('/api/chat/presence', {
      'userId': userId,
      'status': status,
    });
  }

  // ─── Profile + avatar (V3) ─────────────────────────────────────────

  /// Get the profile of a user (avatar, bio, role, email, status).
  /// Backend: GET /chat/profile/:userId
  static Future<Map<String, dynamic>> getProfile(String userId) async {
    return get('/api/chat/profile/$userId');
  }

  /// Update own profile (bio, availabilityStatus, etc.).
  /// Backend: PUT /chat/profile with { userId, bio?, availabilityStatus?, ... }
  static Future<Map<String, dynamic>> updateProfile({
    String? bio,
    String? availabilityStatus,
    String? availableFrom,
    String? availableUntil,
  }) async {
    final userId = await AuthService.getUserId() ?? '';
    return put('/api/chat/profile', {
      'userId': userId,
      if (bio != null) 'bio': bio,
      if (availabilityStatus != null) 'availabilityStatus': availabilityStatus,
      if (availableFrom != null) 'availableFrom': availableFrom,
      if (availableUntil != null) 'availableUntil': availableUntil,
    });
  }

  /// Upload own avatar (multipart).
  /// Backend: POST /chat/avatar (multipart form-data with 'file' + 'userId')
  static Future<Map<String, dynamic>> uploadAvatar(File file) async {
    final base = await ApiConfig.baseUrl;
    final userId = await AuthService.getUserId() ?? '';
    final headers = await _getHeaders(isMultipart: true);

    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$base/api/chat/avatar'),
    );
    request.files.add(await http.MultipartFile.fromPath('file', file.path));
    request.fields['userId'] = userId;
    request.headers.addAll(headers);

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(statusCode: response.statusCode, message: 'Failed to upload avatar');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
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

  /// Confirm having read an announcement.
  /// Backend: POST /chat/announcements/:id/confirm with { userId }
  static Future<void> confirmAnnouncementRead(String announcementId) async {
    final userId = await AuthService.getUserId() ?? '';
    await post('/api/chat/announcements/$announcementId/confirm', {
      'userId': userId,
    });
  }

  // ─── ORION + Whisper (V3) ──────────────────────────────────────────

  /// Generate an ORION summary of a conversation (last N messages).
  /// Backend: POST /chat/conversations/:id/summarize with { userId, maxMessages? }
  static Future<Map<String, dynamic>> summarizeConversation({
    required String conversationId,
    int maxMessages = 50,
  }) async {
    final userId = await AuthService.getUserId() ?? '';
    return post('/api/chat/conversations/$conversationId/summarize', {
      'userId': userId,
      'maxMessages': maxMessages,
    });
  }

  /// Transcribe an audio message to text using Whisper.
  /// Backend: POST /chat/messages/:id/transcribe
  static Future<Map<String, dynamic>> transcribeMessage(String messageId) async {
    return post('/api/chat/messages/$messageId/transcribe', {});
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

  // ─── FCM (V3-4) ───────────────────────────────────────────────────

  /// Register an FCM device token for the current user (mobile push).
  /// Backend: POST /notifications/device-tokens with { fcmToken, platform?, deviceInfo? }
  static Future<Map<String, dynamic>> registerFcmToken({
    required String fcmToken,
    String platform = 'ANDROID',
    String? deviceInfo,
  }) async {
    return post('/api/notifications/device-tokens', {
      'fcmToken': fcmToken,
      'platform': platform,
      if (deviceInfo != null) 'deviceInfo': deviceInfo,
    });
  }

  /// Unregister the FCM device token on logout.
  /// Backend: DELETE /notifications/device-tokens with { fcmToken }
  static Future<void> unregisterFcmToken(String fcmToken) async {
    final base = await ApiConfig.baseUrl;
    final headers = await _getHeaders();
    await http.delete(
      Uri.parse('$base/api/notifications/device-tokens'),
      headers: headers,
      body: jsonEncode({'fcmToken': fcmToken}),
    );
  }

  // ─── Notifications (V3-4 — in-app bell) ─────────────────────────────

  /// List notifications for the current user.
  /// Backend: GET /notifications?unread=true&limit=&offset=
  static Future<List<Map<String, dynamic>>> listNotifications({
    bool onlyUnread = false,
    int limit = 30,
    int offset = 0,
  }) async {
    final base = await ApiConfig.baseUrl;
    final headers = await _getHeaders();
    final params = 'limit=$limit&offset=$offset${onlyUnread ? '&unread=true' : ''}';
    final response = await http.get(
      Uri.parse('$base/api/notifications?$params'),
      headers: headers,
    );
    final data = await _handleResponse(response);
    if (data is List) return data.cast<Map<String, dynamic>>().toList();
    if (data is Map<String, dynamic>) {
      // Some backends wrap lists in { data: [...] }
      final list = data['data'] as List<dynamic>?;
      if (list != null) return list.cast<Map<String, dynamic>>().toList();
    }
    return [];
  }

  /// Get the unread notification count for the current user.
  /// Backend: GET /notifications/unread-count → { count: number }
  static Future<int> getUnreadNotificationCount() async {
    final base = await ApiConfig.baseUrl;
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$base/api/notifications/unread-count'),
      headers: headers,
    );
    final data = await _handleResponse(response) as Map<String, dynamic>;
    return (data['count'] as num?)?.toInt() ?? 0;
  }

  /// Mark a single notification as read.
  /// Backend: PATCH /notifications/:id/read
  static Future<void> markNotificationRead(String notificationId) async {
    final base = await ApiConfig.baseUrl;
    final headers = await _getHeaders();
    await http.patch(
      Uri.parse('$base/api/notifications/$notificationId/read'),
      headers: headers,
    );
  }

  /// Mark all notifications as read.
  /// Backend: PATCH /notifications/read-all
  static Future<void> markAllNotificationsRead() async {
    final base = await ApiConfig.baseUrl;
    final headers = await _getHeaders();
    await http.patch(
      Uri.parse('$base/api/notifications/read-all'),
      headers: headers,
    );
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

  /// ⭐ FIX: Get auth token — used by SocketService for the socket handshake.
  /// Returns null if the user is not logged in.
  static Future<String?> getAuthToken() async {
    return AuthService.getToken();
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final Map<String, dynamic>? backendError;

  ApiException({required this.statusCode, required this.message, this.backendError});

  @override
  String toString() => 'ApiException($statusCode): $message';
}
