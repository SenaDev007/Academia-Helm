/// Contrôleurs Riverpod — session, canaux (polling 20 s), chat (polling
/// 10 s sur le canal ouvert), événements (polling 30 s).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/api_client.dart';
import '../data/models/models.dart';
import '../data/repositories/repositories.dart';

// ═══════════════════════ SESSION ═══════════════════════

enum AuthState { loading, signedOut, signedIn }

class AuthSession {
  final AuthState state;
  final CommunityMember? member;
  final String? error;

  const AuthSession({required this.state, this.member, this.error});
}

class AuthController extends StateNotifier<AuthSession> {
  final AuthRepository _repo = AuthRepository();

  AuthController() : super(const AuthSession(state: AuthState.loading)) {
    _restore();
  }

  Future<void> _restore() async {
    try {
      await ApiClient.instance.ensureInitialized();
      final token = await ApiClient.instance.storedToken();
      if (token == null || token.isEmpty) {
        state = const AuthSession(state: AuthState.signedOut);
        return;
      }
      final member = await _repo.me();
      state = AuthSession(state: AuthState.signedIn, member: member);
    } on ApiException {
      state = const AuthSession(state: AuthState.signedOut);
    }
  }

  Future<bool> login(String email, String password) async {
    try {
      final (member, _) = await _repo.login(email, password);
      state = AuthSession(state: AuthState.signedIn, member: member);
      return true;
    } on ApiException catch (e) {
      state = AuthSession(state: AuthState.signedOut, error: e.message);
      return false;
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    state = const AuthSession(state: AuthState.signedOut);
  }
}

final authProvider = StateNotifierProvider<AuthController, AuthSession>((ref) => AuthController());

// ═══════════════════════ CANAUX ═══════════════════════

class ChannelsState {
  final bool loading;
  final ChannelsResponse? data;
  final String? error;

  const ChannelsState({this.loading = false, this.data, this.error});

  int get totalUnread =>
      data?.channels.fold(0, (acc, c) => acc + c.unread) ?? 0;
}

class ChannelsController extends StateNotifier<ChannelsState> {
  final ChannelsRepository _repo = ChannelsRepository();
  Timer? _timer;

  ChannelsController() : super(const ChannelsState(loading: true)) {
    _load();
    _timer = Timer.periodic(const Duration(seconds: 20), (_) => _load());
  }

  Future<void> _load() async {
    try {
      final data = await _repo.channels();
      state = ChannelsState(data: data);
    } on ApiException catch (e) {
      state = ChannelsState(error: e.message, data: state.data);
    }
  }

  Future<void> refresh() => _load();

  Future<void> markRead(String slug) async {
    try {
      await _repo.markRead(slug);
      // Mise à jour locale immédiate (badge non-lus)
      final data = state.data;
      if (data != null) {
        state = ChannelsState(
          data: ChannelsResponse(
            channels: data.channels
                .map((c) => c.slug == slug ? _copyWith(c, unread: 0) : c)
                .toList(),
            globalChannels: data.globalChannels
                .map((c) => c.slug == slug ? _copyWith(c, unread: 0) : c)
                .toList(),
            schoolSections: data.schoolSections
                .map((s) => SchoolSection(
                      tenantId: s.tenantId,
                      tenantName: s.tenantName,
                      channels: s.channels
                          .map((c) => c.slug == slug ? _copyWith(c, unread: 0) : c)
                          .toList(),
                    ))
                .toList(),
            schools: data.schools,
          ),
        );
      }
    } catch (_) {
      /* silencieux */
    }
  }

  CommunityChannel _copyWith(CommunityChannel c, {int? unread}) => CommunityChannel(
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        icon: c.icon,
        type: c.type,
        scope: c.scope,
        tenantId: c.tenantId,
        tenantName: c.tenantName,
        groupKind: c.groupKind,
        unread: unread ?? c.unread,
        preview: c.preview,
        lastMessageAt: c.lastMessageAt,
        canPost: c.canPost,
      );

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

final channelsProvider = StateNotifierProvider<ChannelsController, ChannelsState>((ref) => ChannelsController());

// ═══════════════════════ CHAT (canal ouvert) ═══════════════════════

class ChatState {
  final CommunityChannel? channel;
  final List<CommunityMessage> messages;
  final bool loading;
  final bool sending;
  final String? error;

  const ChatState({this.channel, this.messages = const [], this.loading = false, this.sending = false, this.error});
}

class ChatController extends StateNotifier<ChatState> {
  final MessagesRepository _repo = MessagesRepository();
  final Ref ref;
  Timer? _timer;
  String? _slug;
  String? _lastAt;

  ChatController(this.ref) : super(const ChatState());

  String get _viewerId => ref.read(authProvider).member?.id ?? '';

  /// Ouvre un canal : charge l'en-tête + les derniers messages, démarre
  /// le polling incrémental (since=) toutes les 10 s.
  Future<void> open(String slug) async {
    if (_slug == slug) return;
    _slug = slug;
    _lastAt = null;
    _timer?.cancel();
    state = const ChatState(loading: true);
    try {
      final channel = await ChannelsRepository().channel(slug);
      final messages = await _repo.messages(slug, limit: 50, viewerId: _viewerId);
      _lastAt = messages.isNotEmpty ? messages.last.createdAt : null;
      state = ChatState(channel: channel, messages: messages);
      ref.read(channelsProvider.notifier).markRead(slug);
    } on ApiException catch (e) {
      state = ChatState(error: e.message);
    }
    _timer = Timer.periodic(const Duration(seconds: 10), (_) => _poll());
  }

  Future<void> _poll() async {
    final slug = _slug;
    if (slug == null) return;
    try {
      final fresh = await _repo.messages(slug, since: _lastAt, limit: 50, viewerId: _viewerId);
      if (fresh.isNotEmpty) {
        _lastAt = fresh.last.createdAt;
        final seen = state.messages.map((m) => m.id).toSet();
        state = ChatState(
          channel: state.channel,
          messages: [...state.messages, ...fresh.where((m) => !seen.contains(m.id))],
        );
      }
    } catch (_) {
      /* silencieux */
    }
  }

  Future<bool> send(String content, {String? replyToId}) async {
    final slug = _slug;
    if (slug == null || content.trim().isEmpty) return false;
    state = ChatState(channel: state.channel, messages: state.messages, sending: true);
    try {
      final message = await _repo.send(slug, content.trim(), replyToId: replyToId, viewerId: _viewerId);
      _lastAt = message.createdAt;
      state = ChatState(channel: state.channel, messages: [...state.messages, message]);
      return true;
    } on ApiException catch (e) {
      state = ChatState(channel: state.channel, messages: state.messages, error: e.message);
      return false;
    }
  }

  Future<void> react(String messageId, String emoji) async {
    try {
      final added = await _repo.react(messageId, emoji);
      state = ChatState(
        channel: state.channel,
        messages: state.messages.map((m) {
          if (m.id != messageId) return m;
          final reactions = Map.of(m.reactions);
          final group = reactions[emoji];
          if (group == null) {
            reactions[emoji] = MessageReactionGroup(emoji: emoji, count: 1, mine: added);
          } else if (added) {
            reactions[emoji] = MessageReactionGroup(emoji: emoji, count: group.count + 1, mine: true);
          } else {
            final count = group.count - 1;
            if (count <= 0) {
              reactions.remove(emoji);
            } else {
              reactions[emoji] = MessageReactionGroup(emoji: emoji, count: count, mine: false);
            }
          }
          return _copyMessage(m, reactions: reactions);
        }).toList(),
      );
    } catch (_) {
      /* silencieux */
    }
  }

  Future<void> vote(String messageId, String optionId) async {
    try {
      final results = await _repo.vote(messageId, [optionId]);
      state = ChatState(
        channel: state.channel,
        messages: state.messages.map((m) {
          if (m.id != messageId || m.poll == null) return m;
          final poll = Poll(
            id: m.poll!.id,
            question: m.poll!.question,
            isMulti: m.poll!.isMulti,
            options: m.poll!.options.map((o) {
              final r = results.where((x) => x.id == o.id).firstOrNull;
              return PollOption(id: o.id, label: o.label, votes: r?.votes ?? 0, mine: r?.mine ?? false);
            }).toList(),
          );
          return _copyMessage(m, poll: poll);
        }).toList(),
      );
    } catch (_) {
      /* silencieux */
    }
  }

  CommunityMessage _copyMessage(CommunityMessage m, {Map<String, MessageReactionGroup>? reactions, Poll? poll}) =>
      CommunityMessage(
        id: m.id,
        channelId: m.channelId,
        type: m.type,
        content: m.content,
        replyToId: m.replyToId,
        replyToContent: m.replyToContent,
        replyToAuthor: m.replyToAuthor,
        isPinned: m.isPinned,
        isEdited: m.isEdited,
        createdAt: m.createdAt,
        authorId: m.authorId,
        authorName: m.authorName,
        authorRole: m.authorRole,
        authorType: m.authorType,
        reactions: reactions ?? m.reactions,
        poll: poll ?? m.poll,
        mine: m.mine,
      );

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

final chatProvider = StateNotifierProvider<ChatController, ChatState>((ref) => ChatController(ref));

// ═══════════════════════ ÉVÉNEMENTS / LIVES ═══════════════════════

class EventsState {
  final bool loading;
  final List<CommunityEvent> events;
  final String? error;

  const EventsState({this.loading = false, this.events = const [], this.error});

  List<CommunityEvent> get lives => events.where((e) => e.isLive).toList();
  List<CommunityEvent> get upcoming => events.where((e) => !e.isLive && e.status == 'SCHEDULED').toList();
}

class EventsController extends StateNotifier<EventsState> {
  final EventsRepository _repo = EventsRepository();
  Timer? _timer;

  EventsController() : super(const EventsState(loading: true)) {
    _load();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _load());
  }

  Future<void> _load() async {
    try {
      final events = await _repo.events();
      state = EventsState(events: events);
    } on ApiException catch (e) {
      state = EventsState(error: e.message);
    }
  }

  Future<void> refresh() => _load();

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

final eventsProvider = StateNotifierProvider<EventsController, EventsState>((ref) => EventsController());
