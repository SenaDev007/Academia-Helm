/// Repositories — auth (login + pont compte école), canaux, messages,
/// événements. Fine couche au-dessus de l'ApiClient, sans logique d'état.
library;

import '../api/api_client.dart';
import '../models/models.dart';

class AuthRepository {
  final ApiClient _api = ApiClient.instance;

  /// Login standard (compte communauté) AVEC pont applicatif : si l'email
  /// correspond à un compte école Academia Helm (admin/enseignant), le
  /// backend provisionne automatiquement écoles + groupes — même mdp.
  Future<(CommunityMember, String)> login(String email, String password) async {
    final data = await _api.post('community/auth/login', body: {
      'email': email.trim(),
      'password': password,
    }) as Map<String, dynamic>;
    final token = data['token'] as String?;
    if (token == null || token.isEmpty) {
      throw const ApiException('Compte en attente de validation par l\u2019équipe');
    }
    await _api.saveToken(token);
    return (CommunityMember.fromJson(data['member'] as Map<String, dynamic>), token);
  }

  Future<CommunityMember> me() async {
    final data = await _api.get('community/me') as Map<String, dynamic>;
    return CommunityMember.fromJson(data);
  }

  Future<void> logout() async {
    await _api.clearToken();
  }
}

class ChannelsRepository {
  final ApiClient _api = ApiClient.instance;

  /// Canaux visibles : global + écoles rattachées + groupes autorisés
  Future<ChannelsResponse> channels() async {
    final data = await _api.get('community/channels') as Map<String, dynamic>;
    return ChannelsResponse.fromJson(data);
  }

  Future<CommunityChannel> channel(String slug) async {
    final data = await _api.get('community/channels/$slug') as Map<String, dynamic>;
    return CommunityChannel.fromJson(data);
  }

  Future<void> markRead(String slug) async {
    await _api.post('community/channels/$slug/read');
  }
}

class MessagesRepository {
  final ApiClient _api = ApiClient.instance;

  Future<List<CommunityMessage>> messages(
    String slug, {
    String? since,
    int limit = 50,
    required String viewerId,
  }) async {
    final query = <String, dynamic>{'limit': limit};
    if (since != null) query['since'] = since;
    final data = await _api.get('community/channels/$slug/messages', query: query)
        as Map<String, dynamic>;
    return ((data['messages'] ?? []) as List)
        .map((m) => CommunityMessage.fromJson(m as Map<String, dynamic>, viewerId))
        .toList();
  }

  Future<CommunityMessage> send(
    String slug,
    String content, {
    String? replyToId,
    required String viewerId,
  }) async {
    final data = await _api.post('community/channels/$slug/messages', body: {
      'content': content,
      if (replyToId != null) 'replyToId': replyToId,
    }) as Map<String, dynamic>;
    return CommunityMessage.fromJson(data, viewerId);
  }

  /// Toggle réaction emoji sur un message
  Future<bool> react(String messageId, String emoji) async {
    final data = await _api.post('community/messages/$messageId/reactions', body: {'emoji': emoji})
        as Map<String, dynamic>;
    return (data['added'] ?? false) as bool;
  }

  Future<void> delete(String messageId) async {
    await _api.delete('community/messages/$messageId');
  }

  /// Vote de sondage → résultats actualisés
  Future<List<PollOption>> vote(String messageId, List<String> optionIds) async {
    final data = await _api.post('community/messages/$messageId/poll/vote', body: {
      'optionIds': optionIds,
    }) as Map<String, dynamic>;
    return ((data['results'] ?? []) as List)
        .map((r) => PollOption(
              id: r['id'] as String,
              label: r['label'] as String,
              votes: (r['votes'] ?? 0) as int,
              mine: (r['mine'] ?? false) as bool,
            ))
        .toList();
  }
}

class EventsRepository {
  final ApiClient _api = ApiClient.instance;

  /// Lives & événements visibles — dispatch par audience
  Future<List<CommunityEvent>> events() async {
    final data = await _api.get('community/events') as List;
    return data.map((e) => CommunityEvent.fromJson(e as Map<String, dynamic>)).toList();
  }
}
