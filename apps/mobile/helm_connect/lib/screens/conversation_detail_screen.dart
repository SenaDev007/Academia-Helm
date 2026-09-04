// ============================================================================
// HELM CONNECT — Conversation Detail Screen (chat view)
// ============================================================================
// Vue conversation avec bulles de messages (style WhatsApp).
// Identité Azure : bulles envoyées sur fond #E6F4FF, reçues sur #FFFFFF.
// ⭐ V7 (alignement mobile) : couleurs par expéditeur, bandeau épinglés,
//    pills CALL_LOG, séparateurs de date, pagination, temps réel étendu.
// ============================================================================

import 'dart:async';
import 'dart:convert'; // ⭐ V3-12: JSON parsing for poll messages
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart'; // ⭐ V3-4: Clipboard.setData for copy action
import 'package:shared_preferences/shared_preferences.dart'; // ⭐ V3-5: for myName lookup
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:audioplayers/audioplayers.dart'; // ⭐ V3-11: voice message playback
import 'package:url_launcher/url_launcher.dart'; // ⭐ V3-11: open attachments with system app
import 'package:open_filex/open_filex.dart'; // ⭐ V3-12: open downloaded files
import 'package:http/http.dart' as http; // ⭐ V3-12: download attachments
import 'package:path_provider/path_provider.dart'; // ⭐ V3-12: temp dir for downloads
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
// ⭐ V3-1: Offline-first chat — local cache + send queue
import '../services/chat_local_storage.dart';
// ⭐ V3-11: Voice message recording + playback
import '../services/voice_message_service.dart';
// ⭐ V3-11: Helm Connect theme helpers (Royal Blue + gold)
import '../theme/helm_theme.dart';
// ⭐ E2E encryption — DISABLED for now (pointycastle 3.x API incompatibility)
// Will be re-enabled in V4 with proper Signal Protocol.
// import '../services/crypto_service.dart';
// ⭐ V3-5: WebRTC calls + branded call screen
import '../services/call_service.dart';
import 'call_screen.dart';

// Stub for CryptoService (all methods are no-ops, encryption falls back to plaintext)
// ⭐ V5 — appels de groupe + écran membres (import du service câblé)
import '../services/group_call_service.dart';
import 'group_call_screen.dart';
import 'group_members_screen.dart';

class CryptoService {
  static bool isEncrypted(String content) => false;
  static Future<String> decryptMessage(String content) async => content;
  static Future<String> encryptMessage(String content, String recipientKey) async => content;
  static Future<bool> hasPrivateKey() async => false;
  static Future<String> generateKeyPair() async => '';
}

// ═════════════════════════════════════════════════════════════════
// ⭐ V7 (parité web/Yeshua) — COULEURS DE BULLE PAR UTILISATEUR
//    Hash djb2 (identique au web) → index stable dans 2 palettes de 8 :
//    fond légèrement teinté pour les bulles des AUTRES en groupe +
//    teinte franche pour le nom/l'avatar. Mes bulles restent bleu Azure.
// ═════════════════════════════════════════════════════════════════
const List<(Color, Color)> kUserBubbleColors = [
  (Color(0xFFEFF6FF), Color(0xFFDBEAFE)), // bleu clair
  (Color(0xFFF0FDF4), Color(0xFFDCFCE7)), // vert clair
  (Color(0xFFFFF7ED), Color(0xFFFFEDD5)), // orange clair
  (Color(0xFFFDF4FF), Color(0xFFFAE8FF)), // violet clair
  (Color(0xFFECFEFF), Color(0xFFCFFAFE)), // cyan clair
  (Color(0xFFFEF9C3), Color(0xFFFEF08A)), // jaune clair
  (Color(0xFFFDF2F8), Color(0xFFFBCFE8)), // rose clair
  (Color(0xFFF5F5F4), Color(0xFFE7E5E4)), // pierre clair
];

const List<Color> kUserTextColors = [
  Color(0xFF0958D9), // bleu Helm
  Color(0xFF059669), // vert
  Color(0xFFD97706), // ambre
  Color(0xFF7C3AED), // violet
  Color(0xFF0891B2), // cyan
  Color(0xFFCA8A04), // jaune doré
  Color(0xFFDB2777), // rose
  Color(0xFF57534E), // pierre
];

/// Hash djb2 → index stable dans la palette (même logique que le web).
int hashUserId(String userId) {
  var h = 5381;
  for (var i = 0; i < userId.length; i++) {
    h = (((h << 5) + h + userId.codeUnitAt(i)) & 0x7FFFFFFF);
    // masque 32 bits non signé ≈ web >>> 0
  }
  return h % kUserBubbleColors.length;
}

/// ⭐ V7 — durée d'appel lisible façon WhatsApp : 45 s / 3 min 12 s / 2 h 0 min.
String formatCallDuration(int seconds) {
  if (seconds < 60) return '$seconds s';
  if (seconds < 3600) return '${seconds ~/ 60} min ${seconds % 60} s';
  return '${seconds ~/ 3600} h ${(seconds % 3600) ~/ 60} min';
}

class ConversationDetailScreen extends StatefulWidget {
  final Conversation conversation;

  const ConversationDetailScreen({super.key, required this.conversation});

  @override
  State<ConversationDetailScreen> createState() => _ConversationDetailScreenState();
}

class _ConversationDetailScreenState extends State<ConversationDetailScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final SocketService _socket = SocketService();
  List<Message> _messages = [];
  bool _loading = true;
  bool _sending = false;
  Timer? _refreshTimer;
  // ⭐ V3-4: Current user ID — used for reaction "is mine" detection
  String _currentUserId = '';
  // ⭐ V3-4: Reply-to state — when set, shows a "replying to" bar above the composer
  Message? _replyToMessage;
  // ⭐ V3-4: Inline edit state
  String? _editingMessageId;
  final _editController = TextEditingController();
  // ⭐ V3-4: Typing indicator state
  bool _isOtherTyping = false;
  Timer? _typingDebounce;
  bool _isTypingSent = false;
  // ⭐ V3-4: Cached reply-quotes (msgId → {senderName, content}) for parent messages
  final Map<String, _ReplyQuote> _replyQuoteCache = {};
  // ⭐ V3-5: WebRTC call service (audio + video)
  late final CallService _callService;
  // ⭐ E2E: cache of userId → base64 SPKI public key (fetched once per conversation)
  final Map<String, String> _recipientPublicKeys = {};
  // ⭐ V3-11: Voice message recording state
  final VoiceMessageService _voiceService = VoiceMessageService();
  bool _isRecording = false;
  bool _isRecordingPaused = false;
  int _recordingDuration = 0;
  bool _isUploadingVoice = false;
  // ⭐ V3-11: Voice message playback state (for audio bubbles)
  final AudioPlayer _audioPlayer = AudioPlayer();
  String? _currentlyPlayingId;
  bool _isAudioPlaying = false;
  Duration _audioPosition = Duration.zero;
  Duration _audioDuration = Duration.zero;
  // ⭐ V3-12: Voice preview state (before sending)
  VoiceRecording? _pendingVoiceRecording;
  bool _isPreviewingVoice = false;
  // ⭐ V3-11: Image preview before send (matches web's preview)
  File? _pendingImage;
  String? _pendingImageName;
  // ⭐ V6 (parité web) — PRÉSENCE RÉELLE du correspondant (avant : « en ligne »
  //    codé en dur pour TOUS les directs). getPresence + socket user:online/offline.
  String? _otherUserId;
  bool _otherOnline = false;
  String? _otherLastSeen;

  String get _presenceLabel {
    if (widget.conversation.type == 'GROUP') {
      return '${widget.conversation.participants.length} membres';
    }
    if (_otherOnline) return 'en ligne';
    if (_otherLastSeen != null) {
      final dt = _otherLastSeen!;
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 60) return 'vu il y a ${diff.inMinutes} min';
      if (diff.inHours < 24) return 'vu il y a ${diff.inHours} h';
      return 'vu le ${dt.day}/${dt.month}';
    }
    return 'hors ligne';
  }

  // ⭐ V6 — charge la présence du correspondant via l'API puis suit le socket
  Future<void> _loadOtherPresence() async {
    if (widget.conversation.type != 'DIRECT') return;
    try {
      final other = widget.conversation.participants
          .where((p) => p.userId != _currentUserId)
          .toList();
      if (other.isEmpty) return;
      _otherUserId = other.first.userId;
      final presence = await ApiService.getPresence([_otherUserId!]);
      final info = presence[_otherUserId!] as Map<String, dynamic>?;
      if (info != null && mounted) {
        setState(() {
          _otherOnline = info['isOnline'] == true;
          final last = info['lastActiveAt'];
          _otherLastSeen = (last is String) ? DateTime.tryParse(last) : (last is DateTime ? last : null);
        });
      }
    } catch (_) {
      // Silencieux : la présence ne doit jamais bloquer l'écran
    }
  }

  @override
  void initState() {
    super.initState();
    // ⭐ V3-4: Load current user ID for reaction "is mine" detection
    _loadCurrentUserId();
    _loadMessages();
    // ⭐ V6 — présence réelle du correspondant (API + socket)
    _loadCurrentUserIdThenPresence();
    // ⭐ Socket.io: connect for realtime (replaces 10s polling)
    _initSocket();
    // ⭐ V3-5: Initialize WebRTC call service + bind socket callbacks
    _callService = CallService(_socket); // ⭐ V5 — singleton (factory)
    // ⭐ V5 — le routeur d'événements du GroupCallService (singleton)
    //    dispatche call:* vers le 1-1 OU le groupe selon le callId : les
    //    appels (1-1 et groupe) sonnent depuis N'IMPORTE QUEL écran de l'app.
    //    Le 1-1 par défaut du routeur est déjà CallService.instance.
    _callService.addListener(_onCallStateChanged);
    GroupCallService.instance.addListener(_onGroupCallStateChanged);
    // Polling fallback (reduced to 30s — Socket.io should deliver instantly)
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _loadMessages();
      _loadOtherPresence(); // ⭐ V6 — rafraîchit la présence aussi
    });
    // ⭐ V3-1: Flush any pending messages from previous session (silent retry on app start)
    _flushPendingQueue();
    // ⭐ V3-11: Track scroll position so we know whether to auto-scroll when
    //    new messages arrive (socket event, polling). Only auto-scrolls if the
    //    user is already at the bottom — never yanks the user back to the
    //    bottom when they're reading history.
    _scrollController.addListener(_onScrollChanged);
  }

  // ⭐ V6 — charge l'userId PUIS la présence (besoin de _currentUserId pour
  //    identifier « l'autre » participant)
  Future<void> _loadCurrentUserIdThenPresence() async {
    await _loadCurrentUserId();
    await _loadOtherPresence();
  }

  // ⭐ V3-12: Scroll listener — tracks whether the user is at the bottom of the
  //    conversation AND whether maxScrollExtent grew (new content / images loaded).
  //    When maxScrollExtent grows AND the user is at the bottom, we re-scroll.
  void _onScrollChanged() {
    if (!_scrollController.hasClients) return;
    final offset = _scrollController.position.pixels;
    final maxExtent = _scrollController.position.maxScrollExtent;
    _userAtBottom = (maxExtent - offset).abs() < 100;
    // ⭐ V3-12: If maxExtent grew AND user is at bottom → re-scroll to bottom
    if (_userAtBottom && maxExtent > _lastMaxScrollExtent + 5) {
      _lastMaxScrollExtent = maxExtent;
      _scrollToBottom();
    } else {
      _lastMaxScrollExtent = maxExtent;
    }
  }

  // ⭐ E2E: ensure this user has a key pair + fetch recipient public keys.
  //    Called on first message send. Best-effort — falls back to plaintext
  //    if the recipient has no key, mirroring the web client.
  Future<void> _ensureE2EKeys() async {
    // ⭐ E2E: DISABLED — will be re-enabled in V4 with Signal Protocol
    return;
  }
  //    or the first available key (GROUP conv — V2 limitation, V3 will use
  //    a per-conversation symmetric key wrapped for each member).
  String? _primaryRecipientPublicKey() {
    if (_recipientPublicKeys.isEmpty) return null;
    if (widget.conversation.type == 'DIRECT') {
      final other = widget.conversation.participants.firstWhere(
        (p) => p.userId != _currentUserId,
        orElse: () => widget.conversation.participants.first,
      );
      return _recipientPublicKeys[other.userId];
    }
    // GROUP: use the first available key
    return _recipientPublicKeys.values.first;
  }

  Future<void> _loadCurrentUserId() async {
    final userId = await AuthService.getUserId();
    if (mounted) {
      setState(() => _currentUserId = userId ?? '');
    }
  }

  // ⭐ V3-5: Start an outgoing call (audio or video)
  // ⭐ V5 : DIRECT → 1-1 avec signalisation REST (conversationId) ;
  //    GROUP → appel de groupe via GroupCallService (mesh + REST).
  void _startCall(String callType) async {
    if (widget.conversation.type == 'GROUP') {
      await _startGroupCall(callType);
      return;
    }
    final other = widget.conversation.participants.firstWhere(
      (p) => p.userId != _currentUserId,
      orElse: () => widget.conversation.participants.first,
    );
    if (other.userId.isEmpty) return;
    final otherName = other.fullName.isNotEmpty ? other.fullName : 'Utilisateur';
    // Get my own name (for callerName payload parity with web)
    final myName = await AuthService.getDisplayName();
    await _callService.startCall(
      otherUserId: other.userId,
      otherUserName: otherName,
      callType: callType,
      myName: myName,
      conversationId: widget.conversation.id, // ⭐ V5 — signalisation REST
    );
    // The _onCallStateChanged listener will push CallScreen when state changes
  }

  // ⭐ V5 — Appel de GROUPE : sélection des participants si le groupe est
  //    grand (mesh WebRTC ≤ 4-5 pairs), sinon invitation de tous les membres.
  Future<void> _startGroupCall(String callType) async {
    final others = widget.conversation.participants
        .where((p) => p.userId != _currentUserId)
        .toList();
    if (others.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Aucun autre membre dans ce groupe'),
        duration: Duration(seconds: 2),
      ));
      return;
    }
    final myName = await AuthService.getDisplayName();
    final convName = widget.conversation.displayName;

    if (others.length <= 4) {
      await GroupCallService.instance.startGroupCall(
        conversationId: widget.conversation.id,
        myUserId: _currentUserId,
        myName: myName,
        callType: callType,
        convName: convName,
        invitees: others
            .map((p) => (
                  userId: p.userId,
                  name: p.fullName.isNotEmpty ? p.fullName : 'Utilisateur',
                  avatarUrl: null,
                ))
            .toList(),
      );
      return;
    }

    // Groupe grand → sélection (max 4 invités pour le mesh)
    final selected = await showModalBottomSheet<Set<Participant>>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _ParticipantPickerSheet(
        participants: others,
        maxSelection: 4,
        callType: callType,
      ),
    );
    if (selected == null || selected.isEmpty) return;
    await GroupCallService.instance.startGroupCall(
      conversationId: widget.conversation.id,
      myUserId: _currentUserId,
      myName: myName,
      callType: callType,
      convName: convName,
      invitees: selected
          .map((p) => (
                userId: p.userId,
                name: p.fullName.isNotEmpty ? p.fullName : 'Utilisateur',
                avatarUrl: null,
              ))
          .toList(),
    );
  }

  // ⭐ V3-5: Listen to CallService state changes — push the CallScreen overlay
  bool _isCallScreenPushed = false;
  void _onCallStateChanged() {
    if (!mounted) return;
    final state = _callService.state;
    if ((state == CallState.incoming || state == CallState.outgoing || state == CallState.active) && !_isCallScreenPushed) {
      _isCallScreenPushed = true;
      Navigator.of(context).push(
        MaterialPageRoute(
          settings: const RouteSettings(name: '/call'),
          builder: (_) => CallScreen(callService: _callService),
          fullscreenDialog: true,
        ),
      ).then((_) {
        // Reset the flag when CallScreen pops
        _isCallScreenPushed = false;
      });
    }
  }

  // ⭐ V5 — GroupCallScreen push (miroir du 1-1)
  bool _isGroupCallScreenPushed = false;
  void _onGroupCallStateChanged() {
    if (!mounted) return;
    final state = GroupCallService.instance.state;
    final inGroupCall = state != GroupCallState.idle;
    if (inGroupCall && !_isGroupCallScreenPushed) {
      _isGroupCallScreenPushed = true;
      Navigator.of(context).push(
        MaterialPageRoute(
          settings: const RouteSettings(name: '/group-call'),
          builder: (_) => const GroupCallScreen(),
          fullscreenDialog: true,
        ),
      ).then((_) {
        _isGroupCallScreenPushed = false;
      });
    }
  }

  void _initSocket() async {
    final token = await ApiService.getAuthToken();
    final userId = await AuthService.getUserId();
    if (token != null && userId != null) {
      await _socket.connect(token: token, userId: userId);
      _socket.onNewMessage = (data) {
        if (data['conversationId'] == widget.conversation.id) {
          _loadMessages(); // Refresh to get the new message
          // ⭐ V3-4: When a new message arrives, the other person is no longer typing
          if (mounted) setState(() => _isOtherTyping = false);
          // ⭐ V7 (parité web) — accusé de distribution ✓✓ gris : je préviens
          //    l'expéditeur que son message m'est parvenu (best effort).
          final msg = data['message'];
          if (msg is Map<String, dynamic> &&
              msg['senderId'] != _currentUserId &&
              msg['id'] != null) {
            ApiService.deliverMessage(msg['id'].toString());
          }
        }
      };
      // ⭐ V7 — messages lus par l'autre (✓✓ bleu temps réel)
      _socket.onMessageRead = (conversationId, readerId, messageIds) {
        if (conversationId == widget.conversation.id && mounted) {
          setState(() {
            _messages = _messages.map((m) {
              if (!m.isOwn || !messageIds.contains(m.id)) return m;
              final already = m.readBy.any((r) => r['userId'] == readerId);
              if (already) return m;
              return Message(
                id: m.id,
                conversationId: m.conversationId,
                senderId: m.senderId,
                type: m.type,
                content: m.content,
                attachmentUrl: m.attachmentUrl,
                attachmentName: m.attachmentName,
                attachmentSize: m.attachmentSize,
                attachmentMime: m.attachmentMime,
                duration: m.duration,
                replyToId: m.replyToId,
                replyToContent: m.replyToContent,
                replyToSenderName: m.replyToSenderName,
                createdAt: m.createdAt,
                editedAt: m.editedAt,
                deletedAt: m.deletedAt,
                deliveredAt: m.deliveredAt,
                reactions: m.reactions,
                readBy: [...m.readBy, {'userId': readerId, 'readAt': DateTime.now().toIso8601String()}],
                isPinned: m.isPinned,
                isImportant: m.isImportant,
                senderFirstName: m.senderFirstName,
                senderLastName: m.senderLastName,
                senderRole: m.senderRole,
                isOwn: m.isOwn,
                callMeta: m.callMeta,
                status: m.status,
                localId: m.localId,
              );
            }).toList();
          });
        }
      };
      // ⭐ V7 — message modifié temps réel
      _socket.onMessageEdited = (messageId, content, editedAt) {
        if (mounted) {
          setState(() {
            _messages = _messages.map((m) {
              if (m.id != messageId) return m;
              return Message(
                id: m.id,
                conversationId: m.conversationId,
                senderId: m.senderId,
                type: m.type,
                content: content,
                attachmentUrl: m.attachmentUrl,
                attachmentName: m.attachmentName,
                attachmentSize: m.attachmentSize,
                attachmentMime: m.attachmentMime,
                duration: m.duration,
                replyToId: m.replyToId,
                replyToContent: m.replyToContent,
                replyToSenderName: m.replyToSenderName,
                createdAt: m.createdAt,
                editedAt: editedAt != null ? DateTime.tryParse(editedAt) ?? m.editedAt : m.editedAt,
                deletedAt: m.deletedAt,
                deliveredAt: m.deliveredAt,
                reactions: m.reactions,
                readBy: m.readBy,
                isPinned: m.isPinned,
                isImportant: m.isImportant,
                senderFirstName: m.senderFirstName,
                senderLastName: m.senderLastName,
                senderRole: m.senderRole,
                isOwn: m.isOwn,
                callMeta: m.callMeta,
                status: m.status,
                localId: m.localId,
              );
            }).toList();
          });
        }
      };
      // ⭐ V7 — message supprimé pour tous temps réel
      _socket.onMessageDeleted = (messageId) {
        if (mounted) {
          setState(() {
            _messages = _messages.where((m) => m.id != messageId).toList();
          });
        }
      };
      // ⭐ V7 — réaction ajoutée/retirée temps réel (sans rechargement complet)
      _socket.onReactionToggle = (messageId, emoji, reactorId, action, count) {
        if (mounted) {
          setState(() {
            _messages = _messages.map((m) {
              if (m.id != messageId) return m;
              var reactions = [...m.reactions];
              if (action == 'added') {
                reactions = [...reactions.where((r) => !(r.userId == reactorId && r.emoji == emoji)), Reaction(emoji: emoji, userId: reactorId)];
              } else {
                reactions = reactions.where((r) => !(r.userId == reactorId && r.emoji == emoji)).toList();
              }
              return Message(
                id: m.id,
                conversationId: m.conversationId,
                senderId: m.senderId,
                type: m.type,
                content: m.content,
                attachmentUrl: m.attachmentUrl,
                attachmentName: m.attachmentName,
                attachmentSize: m.attachmentSize,
                attachmentMime: m.attachmentMime,
                duration: m.duration,
                replyToId: m.replyToId,
                replyToContent: m.replyToContent,
                replyToSenderName: m.replyToSenderName,
                createdAt: m.createdAt,
                editedAt: m.editedAt,
                deletedAt: m.deletedAt,
                deliveredAt: m.deliveredAt,
                reactions: reactions,
                readBy: m.readBy,
                isPinned: m.isPinned,
                isImportant: m.isImportant,
                senderFirstName: m.senderFirstName,
                senderLastName: m.senderLastName,
                senderRole: m.senderRole,
                isOwn: m.isOwn,
                callMeta: m.callMeta,
                status: m.status,
                localId: m.localId,
              );
            }).toList();
          });
        }
      };
      // ⭐ V7 — épinglage/désépinglage temps réel → recharge (bandeau + bulles)
      _socket.onMessagePinned = (conversationId, messageId, by) {
        if (conversationId == widget.conversation.id && mounted) _loadMessages();
      };
      _socket.onMessageUnpinned = (conversationId, messageId, by) {
        if (conversationId == widget.conversation.id && mounted) _loadMessages();
      };
      // ⭐ V3-4: Typing indicator — bind onTypingStart / onTypingStop
      _socket.onTypingStart = (String conversationId, String typingUserId) {
        if (conversationId == widget.conversation.id && typingUserId != _currentUserId && mounted) {
          setState(() => _isOtherTyping = true);
        }
      };
      _socket.onTypingStop = (String conversationId, String typingUserId) {
        if (conversationId == widget.conversation.id && typingUserId != _currentUserId && mounted) {
          setState(() => _isOtherTyping = false);
        }
      };
      // ⭐ V6 (parité web) — présence temps réel du correspondant
      _socket.onUserOnline = (String userId) {
        if (userId == _otherUserId && mounted) {
          setState(() => _otherOnline = true);
        }
      };
      _socket.onUserOffline = (String userId) {
        if (userId == _otherUserId && mounted) {
          setState(() {
            _otherOnline = false;
            _otherLastSeen = DateTime.now();
          });
        }
      };
      // ⭐ V3-1: on every (re)connect, flush the offline pending queue
      _socket.onConnectCallback = () {
        _flushPendingQueue();
      };
      _socket.joinConversation(widget.conversation.id);
    }
  }

  // ⭐ V3-1: Flush the offline pending queue — try to send all messages that
  //    were queued while the network was down.
  Future<void> _flushPendingQueue() async {
    try {
      final pending = await ChatLocalStorage.getPendingMessages();
      if (pending.isEmpty) return;

      // Send in chunks of 5 to avoid flooding the server
      for (var i = 0; i < pending.length; i += 5) {
        final chunk = pending.skip(i).take(5).toList();
        await Future.wait(chunk.map((p) async {
          try {
            await ApiService.sendTextMessage(
              conversationId: p.conversationId,
              content: p.content,
            );
            // Success — remove from queue + mark as sent in local cache
            await ChatLocalStorage.removePendingMessage(p.localId);
            await ChatLocalStorage.markMessageSent(
              p.conversationId,
              p.localId,
              p.localId, // server id approximated by localId; the next _loadMessages will replace it
              DateTime.now().toIso8601String(),
            );
          } catch (e) {
            await ChatLocalStorage.incrementPendingAttempts(p.localId, e.toString());
          }
        }));
      }

      // Refresh the messages display for the active conversation
      if (mounted) _loadMessages();
    } catch (e) {
      // silent — flush failures will be retried on next reconnect
    }
  }

  // ⭐ Send image attachment (from gallery or camera)
  Future<void> _sendImage(ImageSource source) async {
    try {
      final picker = ImagePicker();
      final xfile = await picker.pickImage(source: source, maxWidth: 1920, imageQuality: 85);
      if (xfile == null) return;
      final file = File(xfile.path);
      await ApiService.sendAttachment(
        conversationId: widget.conversation.id,
        file: file,
        type: 'IMAGE',
        fileName: xfile.name,
      );
      _loadMessages();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Image envoyée'), duration: Duration(seconds: 1)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
      }
    }
  }

  // ⭐ Send document attachment
  Future<void> _sendDocument() async {
    try {
      final result = await FilePicker.platform.pickFiles();
      if (result == null || result.files.isEmpty) return;
      final file = File(result.files.first.path!);
      await ApiService.sendAttachment(
        conversationId: widget.conversation.id,
        file: file,
        type: 'DOCUMENT',
        fileName: result.files.first.name,
      );
      _loadMessages();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Document envoyé'), duration: Duration(seconds: 1)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
      }
    }
  }

  // ⭐ V3-11: Voice message recording — start
  Future<void> _startVoiceRecording() async {
    final started = await _voiceService.startRecording();
    if (!started) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Impossible d\'accéder au microphone. Vérifiez les autorisations.')),
        );
      }
      return;
    }
    setState(() {
      _isRecording = true;
      _isRecordingPaused = false;
      _recordingDuration = 0;
    });
    // Set the tick callback to update the UI each second
    _voiceService.onTick = (seconds) {
      if (mounted) setState(() => _recordingDuration = seconds);
    };
  }

  // ⭐ V3-11: Pause/resume the active recording
  Future<void> _togglePauseRecording() async {
    if (_isRecordingPaused) {
      await _voiceService.resumeRecording();
      if (mounted) setState(() => _isRecordingPaused = false);
    } else {
      await _voiceService.pauseRecording();
      if (mounted) setState(() => _isRecordingPaused = true);
    }
  }

  // ⭐ V3-12: Stop recording → show preview (don't send immediately)
  Future<void> _stopAndSendVoiceRecording() async {
    final recording = await _voiceService.stopRecording();
    if (mounted) {
      setState(() {
        _isRecording = false;
        _isRecordingPaused = false;
        _recordingDuration = 0;
      });
    }
    if (recording == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enregistrement vide — annulé')),
        );
      }
      return;
    }
    // ⭐ V3-12: Show a preview bar with playback + send/cancel buttons
    if (mounted) {
      setState(() {
        _pendingVoiceRecording = recording;
        _isPreviewingVoice = true;
      });
    }
  }

  // ⭐ V3-12: Send the previewed voice recording
  Future<void> _sendPreviewedVoiceRecording() async {
    if (_pendingVoiceRecording == null) return;
    final recording = _pendingVoiceRecording!;
    if (mounted) {
      setState(() {
        _isPreviewingVoice = false;
        _isUploadingVoice = true;
        _pendingVoiceRecording = null;
      });
    }
    // Stop preview playback if running
    await _audioPlayer.stop();
    try {
      await _voiceService.uploadVoice(
        conversationId: widget.conversation.id,
        recording: recording,
      );
      _loadMessages();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Message vocal envoyé'), duration: Duration(seconds: 1)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
      }
    } finally {
      if (mounted) setState(() => _isUploadingVoice = false);
    }
  }

  // ⭐ V3-12: Cancel the previewed voice recording
  Future<void> _cancelPreviewedVoiceRecording() async {
    await _audioPlayer.stop();
    if (_pendingVoiceRecording != null) {
      try {
        final file = _pendingVoiceRecording!.file;
        if (await file.exists()) await file.delete();
      } catch (_) {}
    }
    if (mounted) {
      setState(() {
        _isPreviewingVoice = false;
        _pendingVoiceRecording = null;
        _currentlyPlayingId = null;
        _isAudioPlaying = false;
      });
    }
  }

  // ⭐ V3-12: Play the preview voice recording
  Future<void> _playPreviewVoice() async {
    if (_pendingVoiceRecording == null) return;
    if (_isAudioPlaying && _currentlyPlayingId == 'preview') {
      await _audioPlayer.pause();
      if (mounted) setState(() => _isAudioPlaying = false);
      return;
    }
    try {
      await _audioPlayer.play(DeviceFileSource(_pendingVoiceRecording!.path));
      if (mounted) {
        setState(() {
          _currentlyPlayingId = 'preview';
          _isAudioPlaying = true;
          _audioPosition = Duration.zero;
          _audioDuration = Duration(seconds: _pendingVoiceRecording!.durationSeconds);
        });
      }
      _audioPlayer.onPositionChanged.listen((pos) {
        if (mounted) setState(() => _audioPosition = pos);
      });
      _audioPlayer.onPlayerStateChanged.listen((state) {
        if (mounted && state == PlayerState.completed) {
          setState(() {
            _isAudioPlaying = false;
            _currentlyPlayingId = null;
            _audioPosition = Duration.zero;
          });
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lecture échouée: $e')));
      }
    }
  }

  // ⭐ V3-11: Cancel the active recording (deletes the temp file)
  Future<void> _cancelVoiceRecording() async {
    await _voiceService.cancelRecording();
    if (mounted) {
      setState(() {
        _isRecording = false;
        _isRecordingPaused = false;
        _recordingDuration = 0;
      });
    }
  }

  // ⭐ V3-11: Play a voice message audio bubble
  // ⭐ V3-12: Audio playback with position tracking + seek + replay
  Future<void> _playAudioMessage(Message msg) async {
    final url = msg.attachmentUrl;
    if (url == null) return;

    // If same message is playing → toggle pause/resume
    if (_currentlyPlayingId == msg.id) {
      if (_isAudioPlaying) {
        await _audioPlayer.pause();
        if (mounted) setState(() => _isAudioPlaying = false);
      } else {
        await _audioPlayer.resume();
        if (mounted) setState(() => _isAudioPlaying = true);
      }
      return;
    }

    // Different message → stop current + play new
    await _audioPlayer.stop();
    try {
      await _audioPlayer.play(UrlSource(url));
      if (mounted) {
        setState(() {
          _currentlyPlayingId = msg.id;
          _isAudioPlaying = true;
          _audioPosition = Duration.zero;
          _audioDuration = Duration(seconds: msg.duration ?? 0);
        });
      }
      // Listen to position updates
      _audioPlayer.onPositionChanged.listen((pos) {
        if (mounted) setState(() => _audioPosition = pos);
      });
      _audioPlayer.onDurationChanged.listen((dur) {
        if (mounted) setState(() => _audioDuration = dur);
      });
      _audioPlayer.onPlayerStateChanged.listen((state) {
        if (mounted) {
          if (state == PlayerState.completed) {
            setState(() {
              _isAudioPlaying = false;
              _currentlyPlayingId = null;
              _audioPosition = Duration.zero;
            });
          }
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lecture audio échouée: $e')));
      }
    }
  }

  // ⭐ V3-12: Seek to a position in the audio
  Future<void> _seekAudio(Duration position) async {
    await _audioPlayer.seek(position);
    if (mounted) setState(() => _audioPosition = position);
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    // ⭐ V5 — le SocketService est désormais un SINGLETON partagé : on quitte
    //    la room de conversation mais on NE DÉCONNECTE PAS le socket
    //    (les appels entrants + les messages des autres écrans en dépendent).
    _socket.leaveConversation(widget.conversation.id);
    _messageController.dispose();
    // ⭐ V3-11: Remove the scroll listener before disposing the controller
    _scrollController.removeListener(_onScrollChanged);
    _scrollController.dispose();
    _editController.dispose();
    _typingDebounce?.cancel();
    // ⭐ V3-5: Cleanup the call service listeners
    _callService.removeListener(_onCallStateChanged);
    // ⭐ V5 — NE PAS détacher/disposer les singletons (CallService et
    //    GroupCallService vivent pour toute l'app : les appels entrants
    //    continuent d'être routés depuis n'importe quel écran).
    GroupCallService.instance.removeListener(_onGroupCallStateChanged);
    // ⭐ V3-11: Cleanup voice recording + audio player
    _voiceService.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  // ⭐ V7 — pagination des messages (charge plus d'historique au demande)
  bool _hasMoreMessages = false;
  bool _loadingMore = false;

  // ⭐ V7 — charge 50 messages plus anciens (curseur `before`) et PRÉSERVE la
  //    position de lecture (pas de saut vers le bas).
  Future<void> _loadOlderMessages() async {
    if (_loadingMore || _messages.isEmpty) return;
    setState(() => _loadingMore = true);
    try {
      final oldestId = _messages.first.id;
      final older = await ApiService.listMessages(widget.conversation.id, limit: 50, before: oldestId);
      if (mounted) {
        setState(() {
          _messages = [...older.map((m) => Message.fromJson(m, _currentUserId)), ..._messages];
          _hasMoreMessages = older.length >= 50;
          _loadingMore = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  // ⭐ V7 — séparateur de date centré (parité web)
  Widget _buildDateSeparator(DateTime dt) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          const Expanded(child: Divider(color: Color(0xFFE2E8F0))),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              _dateSeparatorLabel(dt),
              style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
            ),
          ),
          const Expanded(child: Divider(color: Color(0xFFE2E8F0))),
        ],
      ),
    );
  }

  // ⭐ V7 — pill CALL_LOG (parité web) : icône + couleur selon statut + durée
  Widget _buildCallLogPill(Message msg, bool isOwn) {
    final meta = msg.callMeta ?? const <String, dynamic>{};
    final video = (meta['callType'] ?? 'audio') == 'video';
    final status = (meta['status'] ?? 'ended').toString();
    final durationSec = (meta['durationSec'] as num?)?.toInt() ?? 0;
    final byName = (meta['byName'] ?? msg.senderName).toString();
    IconData icon;
    Color color;
    String label;
    switch (status) {
      case 'missed':
        icon = video ? Icons.videocam_off_outlined : Icons.phone_missed;
        color = const Color(0xFFEF4444);
        label = 'Appel ${video ? 'vidéo' : 'audio'} manqué';
        break;
      case 'declined':
      case 'rejected':
        icon = video ? Icons.videocam_off_outlined : Icons.phone_disabled;
        color = const Color(0xFFF59E0B);
        label = 'Appel ${video ? 'vidéo' : 'audio'} refusé';
        break;
      case 'cancelled':
        icon = video ? Icons.videocam_outlined : Icons.phone_callback;
        color = const Color(0xFF94A3B8);
        label = isOwn ? 'Appel sans réponse' : 'Appel annulé';
        break;
      default:
        icon = video ? Icons.videocam_outlined : Icons.phone_in_talk;
        color = const Color(0xFF10B981);
        label = 'Appel ${video ? 'vidéo' : 'audio'} terminé${durationSec > 0 ? ' · ${formatCallDuration(durationSec)}' : ''}';
    }
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 2),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.25), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              '$label${byName.isNotEmpty && !isOwn ? ' · $byName' : ''}',
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _loadMessages() async {
    // ⭐ V3-1: Read local cache first (instant display)
    try {
      final cached = await ChatLocalStorage.getMessages(widget.conversation.id);
      if (cached.isNotEmpty && mounted) {
        final userId = await AuthService.getUserId();
        setState(() {
          _messages = cached
              .map((m) => Message.fromJson({
                    'id': m.id,
                    'conversationId': m.conversationId,
                    'senderId': m.senderId,
                    'type': m.type,
                    'content': m.content,
                    'replyToId': m.replyToId,
                    'createdAt': m.createdAt,
                    // Local-only fields are ignored by Message.fromJson
                    if (m.status == 'pending') 'status': 'pending',
                  }, userId ?? ''))
              .toList();
          _loading = false;
        });
        _scrollToBottom();
      }
    } catch (_) {
      // silent — cache read may fail if SharedPreferences unavailable
    }

    try {
      final json = await ApiService.listMessages(widget.conversation.id);
      final userId = await AuthService.getUserId();
      // ⭐ E2E: DISABLED — messages sent as plaintext for now
      for (final m in json) {
        // No decryption needed — all messages are plaintext
      }
      if (mounted) {
        setState(() {
          _messages = json.map((m) => Message.fromJson(m, userId ?? '')).toList();
          _loading = false;
          // ⭐ V7 — pagination : s'il y a 50 messages chargés, il y en a
          //    probablement plus anciens (bouton « Charger… » en tête de liste).
          _hasMoreMessages = json.length >= 50;
        });
        // ⭐ V3-4: Hydrate the reply-quote cache for messages with replyToId.
        //    For each message with a replyToId, find the parent in the loaded
        //    messages and cache its senderName + content (stripped of HTML).
        final msgById = <String, Map<String, dynamic>>{};
        for (final m in json) {
          msgById[m['id'] as String] = m;
        }
        for (final m in json) {
          final replyToId = m['replyToId'] as String?;
          if (replyToId != null && !_replyQuoteCache.containsKey(replyToId)) {
            final parent = msgById[replyToId];
            if (parent != null) {
              final parentSenderName = '${parent['senderFirstName'] ?? parent['sender']?['firstName'] ?? ''} '
                      '${parent['senderLastName'] ?? parent['sender']?['lastName'] ?? ''}'
                  .trim();
              _replyQuoteCache[replyToId] = _ReplyQuote(
                senderName: parentSenderName.isNotEmpty ? parentSenderName : 'Utilisateur',
                content: stripHtml(parent['content'] as String?),
              );
            }
          }
        }
        // Mark as read
        ApiService.markConversationRead(widget.conversation.id);
        _scrollToBottom();
      }
      // ⭐ V3-1: Save the fresh messages to local cache
      try {
        final offlineMsgs = json.map<OfflineMessage>((m) => OfflineMessage(
          id: m['id'] as String,
          conversationId: widget.conversation.id,
          senderId: m['senderId'] as String? ?? '',
          type: m['type'] as String? ?? 'TEXT',
          content: m['content'] as String? ?? '',
          replyToId: m['replyToId'] as String?,
          createdAt: m['createdAt'] as String? ?? DateTime.now().toIso8601String(),
          status: 'sent',
        )).toList();
        await ChatLocalStorage.saveMessages(widget.conversation.id, offlineMsgs);
      } catch (_) {
        // silent — cache write may fail
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur : $e')),
        );
      }
    }
  }

  // ⭐ V3-12: Smart scroll-to-bottom — uses the same logic as the web ResizeObserver
  //    approach. We add a listener that re-scrolls to the bottom whenever the
  //    maxScrollExtent increases (caused by images loading, new messages, polls)
  //    AND the user hasn't scrolled away. This prevents the "stuck at top" bug.
  bool _isInitialLoad = true;
  bool _userAtBottom = true; // updated by _onScrollChanged
  double _lastMaxScrollExtent = 0;

  void _scrollToBottom({bool force = false}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      final maxExtent = _scrollController.position.maxScrollExtent;

      // If maxExtent is 0, layout isn't done yet — retry on next frame
      if (maxExtent == 0 && _messages.isNotEmpty) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom(force: force));
        return;
      }

      if (_isInitialLoad || force) {
        // First load OR user sent a message → instant jump to bottom
        _scrollController.jumpTo(maxExtent);
        _isInitialLoad = false;
        _lastMaxScrollExtent = maxExtent;
      } else if (_userAtBottom && maxExtent > _lastMaxScrollExtent) {
        // ⭐ V3-12: maxExtent grew (images loaded / new messages) and user is
        //   near the bottom → re-scroll to catch the new content
        _scrollController.animateTo(
          maxExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
        _lastMaxScrollExtent = maxExtent;
      }
      // Otherwise: user is reading history — do nothing (Flutter's ScrollController
      // preserves the position across rebuilds automatically).
    });
  }

  Future<void> _sendMessage() async {
    final rawContent = _messageController.text.trim();
    if (rawContent.isEmpty) return;
    setState(() => _sending = true);

    // ⭐ E2E: DISABLED — sending as plaintext for now
    await _ensureE2EKeys();
    final recipientKey = _primaryRecipientPublicKey();
    final content = rawContent; // E2E disabled — always plaintext

    // ⭐ V3-4: Capture the replyToId if user is replying to a message
    final replyToId = _replyToMessage?.id;
    // ⭐ V3-4: Stop typing indicator on send
    _stopTyping();

    // ⭐ V3-1: Create a local pending message — display immediately + queue for retry
    final localId = ChatLocalStorage.generateLocalId();
    final now = DateTime.now().toIso8601String();
    final userId = await AuthService.getUserId() ?? '';
    final localMsg = OfflineMessage(
      id: localId,
      conversationId: widget.conversation.id,
      senderId: userId,
      type: 'TEXT',
      content: content,
      createdAt: now,
      status: 'pending',
      localId: localId,
    );

    // Append to local cache + pending queue (with replyToId if replying)
    await ChatLocalStorage.appendMessage(localMsg);
    await ChatLocalStorage.addPendingMessage(PendingMessage(
      localId: localId,
      conversationId: widget.conversation.id,
      senderId: userId,
      content: content,
      replyToId: replyToId,
      queuedAt: now,
      attempts: 0,
    ));

    // Display immediately in UI (with reply quote if applicable)
    final replySenderName = _replyToMessage?.senderName;
    final replyContent = stripHtml(_replyToMessage?.content);
    if (mounted) {
      setState(() {
        _messages = [..._messages, Message.fromJson({
          'id': localId,
          'conversationId': widget.conversation.id,
          'senderId': userId,
          'type': 'TEXT',
          'content': content,
          'createdAt': now,
          'status': 'pending',
          if (replyToId != null) 'replyToId': replyToId,
          if (replyToId != null) 'replyToSenderName': replySenderName,
          if (replyToId != null) 'replyToContent': replyContent,
        }, userId)];
      });
      // ⭐ V3-11: Force scroll to bottom when the user sends a new message.
      _scrollToBottom(force: true);
    }

    // Clear the input + reply-to state
    _messageController.clear();
    if (_replyToMessage != null) {
      setState(() => _replyToMessage = null);
    }

    try {
      // ⭐ V7 (parité web) — CANAUX : diffusion via POST /chat/channels/:id/broadcast
      //    (l'envoi texte classique est refusé sur les conversations CHANNEL).
      if (widget.conversation.type == 'CHANNEL') {
        await ApiService.broadcastChannelMessage(widget.conversation.id, content);
      } else {
        await ApiService.sendTextMessage(
          conversationId: widget.conversation.id,
          content: content,
          replyToId: replyToId,
        );
      }
      // Success — remove from pending queue + reload from server (replaces localId with server id)
      await ChatLocalStorage.removePendingMessage(localId);
      await _loadMessages();
    } catch (e) {
      // Failure — keep in pending queue for retry on next reconnect
      await ChatLocalStorage.incrementPendingAttempts(localId, e.toString());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Message en attente — sera renvoyé à la reconnexion'),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  // ⭐ V3-3: ORION conversation summary — call POST /chat/conversations/:id/summarize
  Future<void> _summarizeConversation() async {
    final userId = await AuthService.getUserId() ?? '';
    if (userId.isEmpty) return;

    // Loading dialog
    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const AlertDialog(
        content: Row(
          children: [
            CircularProgressIndicator(),
            SizedBox(width: 16),
            Expanded(child: Text('Analyse ORION en cours...')),
          ],
        ),
      ),
    );

    try {
      final data = await ApiService.summarizeConversation(
        conversationId: widget.conversation.id,
        maxMessages: 50,
      );
      if (mounted) Navigator.of(context).pop(); // close loading
      _showSummaryDialog(data);
    } catch (e) {
      if (mounted) Navigator.of(context).pop(); // close loading
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Échec du résumé: $e')),
        );
      }
    }
  }

  void _showSummaryDialog(Map<String, dynamic> data) {
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)]),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.auto_awesome, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 8),
            const Text('Résumé ORION'),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (data['summary'] != null) ...[
                const Text('Synthèse', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF6366F1))),
                const SizedBox(height: 4),
                Text(data['summary'], style: const TextStyle(fontSize: 13)),
                const SizedBox(height: 12),
              ],
              if ((data['keyPoints'] as List?)?.isNotEmpty == true) ...[
                const Text('Points clés', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF10B981))),
                const SizedBox(height: 4),
                ...((data['keyPoints'] as List).map((p) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('• ', style: TextStyle(color: Color(0xFF10B981))),
                      Expanded(child: Text(p.toString(), style: const TextStyle(fontSize: 13))),
                    ],
                  ),
                ))),
                const SizedBox(height: 12),
              ],
              if ((data['actionItems'] as List?)?.isNotEmpty == true) ...[
                const Text('Actions & décisions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFFF59E0B))),
                const SizedBox(height: 4),
                ...((data['actionItems'] as List).map((i) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('→ ', style: TextStyle(color: Color(0xFFF59E0B))),
                      Expanded(child: Text(i.toString(), style: const TextStyle(fontSize: 13))),
                    ],
                  ),
                ))),
                const SizedBox(height: 12),
              ],
              if (data['suggestedTitle'] != null) ...[
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(8)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Titre suggéré', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10, color: Color(0xFF64748B))),
                      const SizedBox(height: 2),
                      Text(data['suggestedTitle'], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Fermer'),
          ),
        ],
      ),
    );
  }

  // ⭐ V3-2: Whisper transcription — call POST /chat/messages/:id/transcribe
  Future<void> _transcribeMessage(Message msg) async {
    // Loading dialog
    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const AlertDialog(
        content: Row(
          children: [
            CircularProgressIndicator(),
            SizedBox(width: 16),
            Expanded(child: Text('Transcription Whisper en cours...')),
          ],
        ),
      ),
    );

    try {
      final data = await ApiService.transcribeMessage(msg.id);
      if (mounted) Navigator.of(context).pop(); // close loading

      final transcription = data['transcription'] as String? ?? '';
      final usingWhisper = data['usingWhisper'] as bool? ?? false;

      if (!mounted) return;
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Row(
            children: [
              const Icon(Icons.audio_file, color: Color(0xFF6366F1), size: 22),
              const SizedBox(width: 8),
              const Text('Transcription'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(transcription, style: const TextStyle(fontSize: 14)),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: usingWhisper ? const Color(0xFFD1FAE5) : const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  usingWhisper ? 'Propulsé par Whisper IA' : 'Transcription basique (fallback)',
                  style: TextStyle(fontSize: 10, color: usingWhisper ? const Color(0xFF065F46) : const Color(0xFF92400E)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Fermer'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (mounted) Navigator.of(context).pop(); // close loading
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Échec de la transcription: $e')),
        );
      }
    }
  }

  String _formatTime(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  // ⭐ V7 — libellé de séparateur de date (Aujourd'hui / Hier / date)
  String _dateSeparatorLabel(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final d = DateTime(dt.year, dt.month, dt.day);
    if (d == today) return "Aujourd'hui";
    if (d == yesterday) return 'Hier';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  // ⭐ V7 — messages épinglés de la conversation (bandeau sous l'app bar)
  List<Message> get _pinnedMessages => _messages.where((m) => m.isPinned && !m.isDeleted).toList();

  // ⭐ V7 — bandeau épinglés (parité web) : « N messages épinglés » + aperçu du
  //    dernier + tap → liste (aperçu + désépingler).
  Widget _buildPinnedBanner() {
    final pinned = _pinnedMessages;
    if (pinned.isEmpty) return const SizedBox.shrink();
    final last = pinned.last;
    return InkWell(
      onTap: () => _showPinnedModal(pinned),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: const BoxDecoration(
          color: Color(0xFFEFF6FF),
          border: Border(bottom: BorderSide(color: Color(0xFFDBEAFE))),
        ),
        child: Row(
          children: [
            const Icon(Icons.push_pin, size: 16, color: Color(0xFF0958D9)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '${pinned.length} message${pinned.length > 1 ? 's' : ''} épinglé${pinned.length > 1 ? 's' : ''} • ${stripHtml(last.content).isEmpty ? (last.isAttachment ? 'Pièce jointe' : 'Message') : stripHtml(last.content)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: Color(0xFF0958D9)),
              ),
            ),
            const Icon(Icons.expand_more, size: 16, color: Color(0xFF0958D9)),
          ],
        ),
      ),
    );
  }

  void _showPinnedModal(List<Message> pinned) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.6,
          maxChildSize: 0.9,
          builder: (context, scrollController) => Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Icon(Icons.push_pin, color: Color(0xFF0958D9)),
                    const SizedBox(width: 8),
                    Text('Messages épinglés (${pinned.length})', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView.builder(
                  controller: scrollController,
                  itemCount: pinned.length,
                  itemBuilder: (context, i) {
                    final m = pinned[i];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: kUserTextColors[hashUserId(m.senderId) % kUserTextColors.length],
                        child: Text(m.senderName.isNotEmpty ? m.senderName[0].toUpperCase() : '?', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      ),
                      title: Text(
                        stripHtml(m.content).isEmpty ? (m.isAttachment ? (m.attachmentName ?? 'Pièce jointe') : 'Message') : stripHtml(m.content),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13),
                      ),
                      subtitle: Text('${m.senderName} • ${_formatTime(m.createdAt)}', style: const TextStyle(fontSize: 11)),
                      trailing: IconButton(
                        icon: const Icon(Icons.close, size: 18, color: Colors.red),
                        tooltip: 'Désépingler',
                        onPressed: () async {
                          try {
                            await ApiService.pinMessage(m.id);
                            Navigator.pop(context);
                            _loadMessages();
                          } catch (e) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
                            }
                          }
                        },
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isChannel = widget.conversation.type == 'CHANNEL';
    final displayName = isChannel || widget.conversation.type == 'GROUP'
        ? (widget.conversation.name ?? (isChannel ? 'Canal' : 'Groupe'))
        : (widget.conversation.participants.isNotEmpty
            ? widget.conversation.participants.firstWhere(
                (p) => p.userId != (widget.conversation.createdBy),
                orElse: () => widget.conversation.participants.first,
              ).fullName
            : 'Conversation');

    return Scaffold(
      appBar: AppBar(
        // ⭐ V3-11: Royal Blue 3-stop gradient (matching splash + chat screen)
        flexibleSpace: Container(
          decoration: const BoxDecoration(gradient: HelmGradients.royalBlue),
        ),
        title: Row(
          children: [
            CircleAvatar(
              backgroundColor: Colors.white.withOpacity(0.2),
              child: isChannel
                  ? const Icon(Icons.feed, color: Colors.white, size: 20)
                  : widget.conversation.type == 'GROUP'
                      ? const Icon(Icons.group, color: Colors.white, size: 20)
                      : Text(
                          _getInitials(displayName),
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(displayName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  // ⭐ V6 — présence RÉELLE (avant : « en ligne » en dur)
                  Text(
                    isChannel
                        ? 'Canal de diffusion'
                        : _isOtherTyping
                            ? 'tape…'
                            : _presenceLabel,
                    style: TextStyle(
                      fontSize: 11,
                      color: _isOtherTyping || _otherOnline ? HelmColors.goldLight : HelmColors.goldLight.withOpacity(0.65),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        // ⭐ V3-3: Sparkles button to trigger ORION conversation summary
        // ⭐ V5: Phone + Video call buttons (DIRECT 1-1 + GROUP mesh)
        // ⭐ V3-11: Action icons use gold accent (Helm Connect palette)
        actions: [
          // ⭐ V7 — pas d'appel sur les CANAUX (diffusion unidirectionnelle)
          if (!isChannel) ...[
            IconButton(
              icon: const Icon(Icons.phone, color: HelmColors.goldLight),
              tooltip: widget.conversation.type == 'GROUP'
                  ? 'Appel audio de groupe'
                  : 'Appel audio',
              onPressed: () => _startCall('AUDIO'),
            ),
            IconButton(
              icon: const Icon(Icons.videocam, color: HelmColors.goldLight),
              tooltip: widget.conversation.type == 'GROUP'
                  ? 'Appel vidéo de groupe'
                  : 'Appel vidéo',
              onPressed: () => _startCall('VIDEO'),
            ),
          ],
          // ⭐ V5 — écran membres / gestion des groupes
          if (widget.conversation.type == 'GROUP')
            IconButton(
              icon: const Icon(Icons.groups, color: HelmColors.goldLight),
              tooltip: 'Membres du groupe',
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(
                  settings: const RouteSettings(name: '/group-members'),
                  builder: (_) => GroupMembersScreen(
                    conversation: widget.conversation,
                    onChanged: () => _loadMessages(),
                  ),
                ),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.auto_awesome, color: HelmColors.goldLight),
            tooltip: 'Résumer la conversation (ORION IA)',
            onPressed: _summarizeConversation,
          ),
        ],
      ),
      body: Column(
        children: [
          // ⭐ V7 (parité web) — bandeau des messages épinglés
          _buildPinnedBanner(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: HelmColors.primary))
                : _messages.isEmpty
                    ? _buildEmptyConversationState()
                    : Container(
                        color: const Color(0xFFF5F7FA),
                        child: ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.all(16),
                          itemCount: _messages.length + 2, // ⭐ V7 — + séparateurs + bouton pagination
                          itemBuilder: (context, index) {
                            // ⭐ V7 — bouton « Charger les messages précédents » en tête
                            if (index == 0) {
                              if (_hasMoreMessages) {
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Center(
                                    child: TextButton.icon(
                                      onPressed: _loadingMore ? null : _loadOlderMessages,
                                      icon: _loadingMore
                                          ? const SizedBox(
                                              width: 14,
                                              height: 14,
                                              child: CircularProgressIndicator(strokeWidth: 2, color: HelmColors.primary),
                                            )
                                          : const Icon(Icons.history, size: 16),
                                      label: Text(
                                        _loadingMore ? 'Chargement…' : 'Charger les messages précédents',
                                        style: const TextStyle(fontSize: 12, color: HelmColors.primary),
                                      ),
                                    ),
                                  ),
                                );
                              }
                              return const SizedBox.shrink();
                            }
                            final msgIndex = index - 1;
                            if (msgIndex >= _messages.length) return const SizedBox.shrink();
                            final msg = _messages[msgIndex];
                            // ⭐ V7 — séparateur de date entre jours différents
                            final showDateSeparator = msgIndex == 0 ||
                                DateTime(_messages[msgIndex - 1].createdAt.year, _messages[msgIndex - 1].createdAt.month, _messages[msgIndex - 1].createdAt.day) !=
                                    DateTime(msg.createdAt.year, msg.createdAt.month, msg.createdAt.day);
                            if (msgIndex > 0 && index == _messages.length + 1) return const SizedBox.shrink();
                            return Column(
                              children: [
                                if (showDateSeparator) _buildDateSeparator(msg.createdAt),
                                _buildMessageBubble(msg),
                              ],
                            );
                          },
                        ),
                      ),
          ),
          // ⭐ V3-4: Typing indicator (whatsapp-style)
          if (_isOtherTyping)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              alignment: Alignment.centerLeft,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('en train d\'écrire... ', style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontStyle: FontStyle.italic)),
                  TweenAnimationBuilder<double>(
                    tween: Tween<double>(begin: 0, end: 1),
                    duration: const Duration(milliseconds: 600),
                    builder: (context, value, child) => Opacity(opacity: 0.5 + 0.5 * (value.abs()), child: child),
                    child: const Text('•', style: TextStyle(fontSize: 18, color: Color(0xFF64748B))),
                  ),
                ],
              ),
            ),
          // ⭐ V3-4: Reply-to bar (whatsapp-style) — shown when _replyToMessage is set
          if (_replyToMessage != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: const BoxDecoration(
                color: Color(0xFFF1F5F9),
                border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
              ),
              child: Row(
                children: [
                  const Icon(Icons.reply, color: Color(0xFF1677FF), size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _replyToMessage!.senderName,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0958D9)),
                        ),
                        Text(
                          stripHtml(_replyToMessage!.content),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 16),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: () => setState(() => _replyToMessage = null),
                  ),
                ],
              ),
            ),
          // Input bar — switches between normal composer and recording UI
          Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: _buildInputBarContent(),
          ),
        ],
      ),
    );
  }

  // ⭐ V3-11: Smart input bar — handles 4 states:
  //   1. _isRecording (active) — recording timer + pause/stop/cancel
  //   2. _isUploadingVoice — spinner overlay
  //   3. Default (idle) — attach + text field + mic (when empty) + send button
  Widget _buildInputBarContent() {
    // Voice recording active
    if (_isRecording) {
      return Row(
        children: [
          // Cancel button
          GestureDetector(
            onTap: _cancelVoiceRecording,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.delete_outline, color: Colors.red, size: 22),
            ),
          ),
          const SizedBox(width: 12),
          // Recording indicator (pulsing red dot) + duration
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: _isRecordingPaused ? const Color(0xFFFEF3C7) : const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: _isRecordingPaused ? const Color(0xFFF59E0B) : const Color(0xFFEF4444), width: 1),
              ),
              child: Row(
                children: [
                  // Pulsing red dot
                  if (!_isRecordingPaused)
                    TweenAnimationBuilder<double>(
                      tween: Tween<double>(begin: 0.4, end: 1.0),
                      duration: const Duration(milliseconds: 800),
                      builder: (context, value, child) => Opacity(opacity: value, child: child),
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(color: Color(0xFFEF4444), shape: BoxShape.circle),
                      ),
                    )
                  else
                    const Icon(Icons.pause_circle, size: 14, color: Color(0xFFF59E0B)),
                  const SizedBox(width: 8),
                  Text(
                    VoiceMessageService.formatDuration(_recordingDuration),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF7F1D1D),
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _isRecordingPaused ? 'en pause' : 'enregistrement…',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF7F1D1D)),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Pause/resume
          GestureDetector(
            onTap: _togglePauseRecording,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: _isRecordingPaused ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _isRecordingPaused ? Icons.play_arrow : Icons.pause,
                color: Colors.white,
                size: 22,
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Stop + send
          GestureDetector(
            onTap: _stopAndSendVoiceRecording,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: HelmGradients.royalBlue,
                shape: BoxShape.circle,
                border: Border.all(color: HelmColors.goldLight, width: 1.5),
              ),
              child: const Icon(Icons.check, color: Colors.white, size: 22),
            ),
          ),
        ],
      );
    }
    // Voice uploading
    if (_isUploadingVoice) {
      return Row(
        children: [
          const SizedBox(width: 16),
          const SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2, color: HelmColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: const Text(
              'Envoi du message vocal…',
              style: TextStyle(color: Colors.grey, fontSize: 13, fontStyle: FontStyle.italic),
            ),
          ),
        ],
      );
    }
    // ⭐ V3-12: Voice preview state — play/seek + send/cancel buttons
    if (_isPreviewingVoice && _pendingVoiceRecording != null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFE6F4FF),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: HelmColors.goldLight.withOpacity(0.4), width: 1),
        ),
        child: Row(
          children: [
            // Play/pause preview
            GestureDetector(
              onTap: _playPreviewVoice,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: HelmGradients.royalBlue,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _isAudioPlaying && _currentlyPlayingId == 'preview' ? Icons.pause : Icons.play_arrow,
                  color: Colors.white,
                  size: 20,
                ),
              ),
            ),
            const SizedBox(width: 8),
            // Duration / progress
            Expanded(
              child: Text(
                _isAudioPlaying && _currentlyPlayingId == 'preview'
                    ? '${_audioPosition.inMinutes}:${(_audioPosition.inSeconds % 60).toString().padLeft(2, '0')} / ${_audioDuration.inMinutes}:${(_audioDuration.inSeconds % 60).toString().padLeft(2, '0')}'
                    : 'Message vocal (${VoiceMessageService.formatDuration(_pendingVoiceRecording!.durationSeconds)})',
                style: const TextStyle(fontSize: 12, color: HelmColors.primary, fontWeight: FontWeight.w600),
              ),
            ),
            // Cancel
            GestureDetector(
              onTap: _cancelPreviewedVoiceRecording,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close, color: Colors.red, size: 20),
              ),
            ),
            const SizedBox(width: 8),
            // Send
            GestureDetector(
              onTap: _sendPreviewedVoiceRecording,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: HelmGradients.royalBlue,
                  shape: BoxShape.circle,
                  border: Border.all(color: HelmColors.goldLight, width: 1),
                ),
                child: const Icon(Icons.send, color: Colors.white, size: 18),
              ),
            ),
          ],
        ),
      );
    }
    // Default: attach + text field + mic (if empty) + send
    return Row(
      children: [
        IconButton(
          icon: const Icon(Icons.add_circle_outline, color: HelmColors.primary),
          onPressed: () => _showAttachmentMenu(),
        ),
        Expanded(
          child: TextField(
            controller: _messageController,
            decoration: InputDecoration(
              hintText: 'Tapez un message...',
              filled: true,
              fillColor: const Color(0xFFF5F7FA),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: const BorderSide(color: HelmColors.primaryVivid, width: 1.5),
              ),
            ),
            onChanged: _onTextChanged,
            onSubmitted: (_) => _sendMessage(),
          ),
        ),
        const SizedBox(width: 8),
        // Mic button — visible only when text field is empty (otherwise send button shows)
        if (_messageController.text.trim().isEmpty)
          GestureDetector(
            onLongPress: _startVoiceRecording,
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Maintenez le bouton pour enregistrer un message vocal'),
                  duration: Duration(seconds: 2),
                ),
              );
            },
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: HelmColors.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.mic, color: HelmColors.primary, size: 22),
            ),
          )
        else
          HelmSendButton(
            onPressed: _sendMessage,
            disabled: _sending,
            isLoading: _sending,
          ),
      ],
    );
  }

  // ⭐ V3-11: Branded empty conversation state — Helm Connect logo + tagline
  Widget _buildEmptyConversationState() {
    return Container(
      decoration: const BoxDecoration(gradient: HelmGradients.royalBlueVertical),
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Helm Connect logo in gold ring
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withOpacity(0.1),
                    border: Border.all(color: HelmColors.goldLight, width: 2),
                  ),
                  child: ClipOval(
                    child: Image.asset(
                      'assets/icons/helm_connect.png',
                      width: 56,
                      height: 56,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Démarrez la conversation',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Aucun message dans cette discussion.\nEnvoyez le premier message pour débuter l\'échange.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: HelmColors.goldLight, fontSize: 12, height: 1.4),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMessageBubble(Message msg) {
    // ⭐ V7 — messages SYSTÈME : pastille centrée discrète (« X a rejoint »…)
    if (msg.type == 'SYSTEM' && (msg.content ?? '').isNotEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              stripHtml(msg.content),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontStyle: FontStyle.italic),
            ),
          ),
        ),
      );
    }
    // ⭐ V7 — messages CALL_LOG : pill colorée (aucune bulle texte brute)
    if (msg.type == 'CALL_LOG') {
      return Align(
        alignment: Alignment.center,
        child: _buildCallLogPill(msg, msg.isOwn),
      );
    }
    if (msg.isDeleted) {
      return Align(
        alignment: msg.isOwn ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Text('Message supprimé', style: TextStyle(color: Color(0xFF94A3B8), fontStyle: FontStyle.italic)),
        ),
      );
    }
    final isOwn = msg.isOwn;
    // ⭐ V7 (parité web/Yeshua) — couleur de bulle STABLE par expéditeur :
    //    hash djb2 du senderId → palette 8 teintes (groupes uniquement ;
    //    mes bulles restent bleu Azure, les DIRECT des autres restent blancs).
    final (bubbleBg, bubbleBorder) = !isOwn && widget.conversation.type == 'GROUP'
        ? kUserBubbleColors[hashUserId(msg.senderId)]
        : isOwn
            ? (const Color(0xFFE6F4FF), const Color(0xFFBAE0FF))
            : (Colors.white, const Color(0xFFE2E8F0));
    final senderTextColor = !isOwn && widget.conversation.type == 'GROUP'
        ? kUserTextColors[hashUserId(msg.senderId)]
        : const Color(0xFF0958D9);

    // ⭐ V3-4: Group reactions by emoji with count — whatsapp style
    final Map<String, int> reactionCounts = {};
    final Map<String, bool> myReactions = {};
    for (final r in msg.reactions) {
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
      if (r.userId == _currentUserId) myReactions[r.emoji] = true;
    }

    return Align(
      alignment: isOwn ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: () => _showMessageActions(msg),
        child: Container(
        margin: const EdgeInsets.symmetric(vertical: 2),
        padding: const EdgeInsets.all(12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: bubbleBg,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: isOwn ? const Radius.circular(16) : const Radius.circular(4),
            bottomRight: isOwn ? const Radius.circular(4) : const Radius.circular(16),
          ),
          border: Border.all(color: bubbleBorder, width: isOwn ? 0.5 : 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ⭐ V7 — icône épinglé en tête de bulle (parité web)
            if (msg.isPinned)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.push_pin, size: 12, color: senderTextColor),
                    const SizedBox(width: 4),
                    Text('Épinglé', style: TextStyle(fontSize: 10, color: senderTextColor, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            // ⭐ V3-4: Reply quote preview (whatsapp-style)
            if (msg.replyToId != null)
              Builder(builder: (context) {
                // Prefer backend-provided replyToSenderName/Content, otherwise use cache
                final quote = _replyQuoteCache[msg.replyToId];
                final quoteSender = msg.replyToSenderName?.isNotEmpty == true
                    ? msg.replyToSenderName!
                    : quote?.senderName ?? '';
                final quoteContent = msg.replyToContent?.isNotEmpty == true
                    ? msg.replyToContent!
                    : quote?.content ?? '';
                if (quoteSender.isEmpty && quoteContent.isEmpty) {
                  return const SizedBox.shrink();
                }
                return Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isOwn ? const Color(0xFFBAE0FF).withOpacity(0.3) : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(6),
                    border: const Border(left: BorderSide(color: Color(0xFF1677FF), width: 2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        quoteSender,
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0958D9)),
                      ),
                      Text(
                        stripHtml(quoteContent),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                );
              }),
            // Sender name (for groups) — ⭐ V7 couleur SIGNATURE stable par utilisateur
            if (!isOwn && widget.conversation.type == 'GROUP')
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  msg.senderName,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: senderTextColor),
                ),
              ),
            // Content (V3-4: strip HTML before display)
            // ⭐ V3-12: Poll messages (type=POLL) have JSON content — parse + render
            //   as a poll card instead of raw JSON text.
            if (msg.type == 'POLL' && msg.content != null && msg.content!.isNotEmpty) ...[
              const SizedBox(height: 4),
              _buildPollBubble(msg, isOwn),
            ]
            else if (msg.content != null && msg.content!.isNotEmpty && msg.type != 'AUDIO')
              Text(stripHtml(msg.content), style: const TextStyle(fontSize: 14, color: Color(0xFF172033))),
            // ⭐ V3-11: Audio message bubble — play button + waveform + duration
            if (msg.isAttachment && msg.type == 'AUDIO') ...[
              const SizedBox(height: 4),
              _buildAudioMessageBubble(msg, isOwn),
            ]
            // ⭐ V3-11: Image attachment — preview thumbnail
            else if (msg.isAttachment && msg.type == 'IMAGE') ...[
              const SizedBox(height: 4),
              _buildImageAttachmentBubble(msg, isOwn),
            ]
            // ⭐ V3-11: Other attachments — document card
            else if (msg.isAttachment) ...[
              const SizedBox(height: 4),
              _buildDocumentAttachmentBubble(msg, isOwn),
            ],
            // ⭐ V3-4: Reactions display (grouped by reaction type with count)
            if (reactionCounts.isNotEmpty) ...[
              const SizedBox(height: 4),
              Wrap(
                spacing: 4,
                runSpacing: 2,
                children: reactionCounts.entries.map((entry) {
                  final isMine = myReactions[entry.key] == true;
                  // ⭐ V3-11: Render reaction as real emoji (essential for chat UX)
                  return GestureDetector(
                    onTap: () => _sendReaction(msg, entry.key),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isMine ? const Color(0xFFBAE0FF) : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: isMine ? const Color(0xFF1677FF) : const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(entry.key, style: const TextStyle(fontSize: 12)),
                          if (entry.value > 1) ...[
                            const SizedBox(width: 2),
                            Text('${entry.value}', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                          ],
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
            // Timestamp + read receipt (3 states)
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (msg.editedAt != null)
                  const Padding(
                    padding: EdgeInsets.only(right: 4),
                    child: Text('modifié', style: TextStyle(fontSize: 9, color: Color(0xFF94A3B8), fontStyle: FontStyle.italic)),
                  ),
                Text(
                  _formatTime(msg.createdAt),
                  style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                ),
                if (isOwn) ...[
                  const SizedBox(width: 4),
                  _buildReadReceiptIcon(msg),
                ],
                if (msg.status == 'pending') ...[
                  const SizedBox(width: 4),
                  const Icon(Icons.access_time, size: 12, color: Color(0xFF94A3B8)),
                ],
              ],
            ),
          ],
        ),
        ),
      ),
    );
  }

  // ⭐ V3-11: Audio message bubble — branded play button + waveform + duration
  Widget _buildAudioMessageBubble(Message msg, bool isOwn) {
    final isCurrentlyPlaying = _currentlyPlayingId == msg.id && _isAudioPlaying;
    final duration = msg.duration ?? 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: isOwn ? const Color(0xFFBAE0FF).withOpacity(0.4) : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          // Branded play/pause button — Royal Blue circle with gold accent
          GestureDetector(
            onTap: () => _playAudioMessage(msg),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                gradient: HelmGradients.royalBlue,
                shape: BoxShape.circle,
                border: Border.all(color: HelmColors.goldLight.withOpacity(0.4), width: 1),
              ),
              child: Icon(
                isCurrentlyPlaying ? Icons.pause : Icons.play_arrow,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 8),
          // ⭐ V3-12: Progress bar with seek (slider) + time display
          Expanded(
            child: isCurrentlyPlaying
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SliderTheme(
                        data: SliderTheme.of(context).copyWith(
                          trackHeight: 3,
                          thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 5),
                          overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
                          activeTrackColor: HelmColors.primary,
                          inactiveTrackColor: Colors.grey[300],
                          thumbColor: HelmColors.primary,
                        ),
                        child: Slider(
                          value: _audioDuration.inMilliseconds > 0
                              ? _audioPosition.inMilliseconds.toDouble().clamp(0, _audioDuration.inMilliseconds.toDouble())
                              : 0,
                          min: 0,
                          max: _audioDuration.inMilliseconds.toDouble() > 0
                              ? _audioDuration.inMilliseconds.toDouble()
                              : 1,
                          onChanged: (value) {
                            _seekAudio(Duration(milliseconds: value.toInt()));
                          },
                        ),
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${_audioPosition.inMinutes}:${(_audioPosition.inSeconds % 60).toString().padLeft(2, '0')}',
                            style: const TextStyle(fontSize: 9, color: Color(0xFF667085)),
                          ),
                          Text(
                            '${_audioDuration.inMinutes}:${(_audioDuration.inSeconds % 60).toString().padLeft(2, '0')}',
                            style: const TextStyle(fontSize: 9, color: Color(0xFF667085)),
                          ),
                        ],
                      ),
                    ],
                  )
                : SizedBox(
                    height: 28,
                    child: CustomPaint(
                      size: const Size.fromHeight(28),
                      painter: _WaveformPainter(
                        barsCount: 24,
                        isOwn: isOwn,
                        progress: 0.0,
                      ),
                    ),
                  ),
          ),
          const SizedBox(width: 8),
          // Duration (shown when not playing)
          if (!isCurrentlyPlaying)
            Text(
              VoiceMessageService.formatDuration(duration),
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: Color(0xFF667085),
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
        ],
      ),
    );
  }

  // ⭐ V3-11: Image attachment — preview thumbnail (Royal Blue border) + tap-to-open
  // ⭐ V6 (parité web) : résolution d'URL via ApiConfig.resolveFileUrl — les
  //    chemins relatifs (chat/image/x.jpg) donnaient des images cassées.
  Widget _buildImageAttachmentBubble(Message msg, bool isOwn) {
    final rawUrl = msg.attachmentUrl ?? '';
    if (rawUrl.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Row(
          children: [
            Icon(Icons.broken_image, color: Color(0xFF94A3B8)),
            SizedBox(width: 8),
            Text('Image indisponible', style: TextStyle(fontSize: 11, color: Color(0xFF667085))),
          ],
        ),
      );
    }
    return FutureBuilder<String>(
      future: ApiConfig.resolveFileUrl(rawUrl),
      builder: (context, snap) {
        final url = snap.data ?? '';
        if (url.isEmpty) {
          return const SizedBox.shrink();
        }
        return GestureDetector(
          onTap: () => _openAttachment(url),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Hero(
              tag: 'image_${msg.id}',
              child: Container(
                constraints: const BoxConstraints(maxWidth: 220, maxHeight: 180),
                decoration: BoxDecoration(
                  border: Border.all(color: HelmColors.goldLight.withOpacity(0.4), width: 1.5),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Image.network(
                  url,
              fit: BoxFit.cover,
              loadingBuilder: (context, child, loadingProgress) {
                if (loadingProgress == null) return child;
                return Container(
                  color: const Color(0xFFF1F5F9),
                  child: const Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2, color: HelmColors.primary),
                    ),
                  ),
                );
              },
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  color: const Color(0xFFF1F5F9),
                  padding: const EdgeInsets.all(16),
                  child: const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.broken_image, size: 32, color: Color(0xFF94A3B8)),
                      SizedBox(height: 4),
                      Text('Image indisponible', style: TextStyle(fontSize: 11, color: Color(0xFF667085))),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
      ),
    ),
      },
    );
  }

  // ⭐ V3-11: Open any attachment URL with the system's default app.
  //   - Images → gallery / image viewer
  //   - Audio  → music player
  //   - PDF / Office docs → PDF viewer / Quickoffice
  // ⭐ V6 (parité web) : les URLs RELATIVES passent maintenant par
  //    ApiConfig.resolveFileUrl ({base}/api/chat/files{path}) — l'ancien
  //    préfixe {base}/ provoquait des 404 sur les fichiers locaux.
  Future<void> _openAttachment(String url) async {
    if (url.isEmpty) return;
    String fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = await ApiConfig.resolveFileUrl(url);
    }
    try {
      final uri = Uri.parse(fullUrl);
      // ⭐ V3-12: Add Authorization header via url_launcher won't work directly.
      //   Use open_filex to download the file first, then open it. For now,
      //   try launching the URL — if it fails, download + open via open_filex.
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        // Fallback: download the file locally + open with open_filex
        await _downloadAndOpenAttachment(fullUrl, uri.pathSegments.last);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur d\'ouverture: $e')),
        );
      }
    }
  }

  // ⭐ V3-12: Download an attachment locally + open with the system app
  //   (used when the URL requires authentication that url_launcher can't provide)
  Future<void> _downloadAndOpenAttachment(String url, String filename) async {
    try {
      // Show loading
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Téléchargement de $filename…'), duration: const Duration(seconds: 1)),
        );
      }
      // Get auth token
      final token = await AuthService.getToken();
      // Download the file
      final response = await http.get(Uri.parse(url), headers: {
        if (token != null) 'Authorization': 'Bearer $token',
      });
      if (response.statusCode != 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Téléchargement échoué (${response.statusCode})')),
          );
        }
        return;
      }
      // Save to temp directory
      final tempDir = await getTemporaryDirectory();
      final filePath = '${tempDir.path}/$filename';
      final file = File(filePath);
      await file.writeAsBytes(response.bodyBytes);
      // Open with open_filex
      final result = await OpenFilex.open(filePath);
      if (result.type != ResultType.done) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Ouverture échouée: ${result.message}')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Téléchargement échoué: $e')),
        );
      }
    }
  }

  // ⭐ V3-12: Poll bubble — parses JSON content + renders as a poll card
  //   (prevents raw JSON characters from showing in the chat)
  // ⭐ V6 (parité web) — voter sur une option de sondage : tap → POST
  //    /chat/v2/polls/{msg.id}/vote {userId, optionIds:[opt.id]} puis
  //    optimiste local + recharge silencieuse.
  Future<void> _votePollOption(Message msg, String optionId) async {
    try {
      // Optimiste : voteCount+1 localement avant la réponse réseau
      setState(() {
        _messages = _messages.map((m) {
          if (m.id != msg.id) return m;
          try {
            final p = jsonDecode(m.content!) as Map<String, dynamic>;
            final opts = (p['options'] as List<dynamic>? ?? []).map((o) {
              final opt = o as Map<String, dynamic>;
              return opt['id'] == optionId
                  ? {...opt, 'voteCount': ((opt['voteCount'] as num?)?.toInt() ?? 0) + 1}
                  : opt;
            }).toList();
            return Message(
              id: m.id,
              conversationId: m.conversationId,
              senderId: m.senderId,
              type: m.type,
              content: jsonEncode({...p, 'options': opts}),
              createdAt: m.createdAt,
            );
          } catch (_) {
            return m;
          }
        }).toList();
      });
      await ApiService.votePoll(msg.id, optionId);
      await _loadMessages(); // réconciliation (comptes réels serveur)
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Vote impossible : $e')),
        );
      }
      await _loadMessages();
    }
  }

  Widget _buildPollBubble(Message msg, bool isOwn) {
    try {
      final poll = jsonDecode(msg.content!) as Map<String, dynamic>;
      final question = poll['question'] as String? ?? 'Sondage';
      final options = (poll['options'] as List<dynamic>?) ?? [];
      final closed = poll['closed'] as bool? ?? false;
      final totalVotes = options.fold<int>(0, (sum, o) {
        final opt = o as Map<String, dynamic>;
        return sum + ((opt['voteCount'] as num?)?.toInt() ?? 0);
      });

      return Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isOwn ? Colors.white.withOpacity(0.15) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: HelmColors.goldLight.withOpacity(0.3), width: 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Question header with poll icon
            Row(
              children: [
                Icon(Icons.bar_chart, size: 14, color: HelmColors.primary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    question,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF172033)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Options with progress bars
            ...options.map((optObj) {
              final opt = optObj as Map<String, dynamic>;
              final label = opt['label'] as String? ?? '';
              final optId = opt['id'] as String?;
              final voteCount = (opt['voteCount'] as num?)?.toInt() ?? 0;
              final percentage = totalVotes > 0 ? (voteCount / totalVotes * 100).round() : 0;
              // ⭐ V6 — option CLIQUABLE pour voter (parité web)
              final canVote = optId != null && closed != true;
              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: InkWell(
                  onTap: canVote ? () => _votePollOption(msg, optId) : null,
                  borderRadius: BorderRadius.circular(6),
                  child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF334155))),
                        ),
                        Text(
                          '$voteCount (${percentage}%)',
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(3),
                      child: LinearProgressIndicator(
                        value: percentage / 100.0,
                        minHeight: 4,
                        backgroundColor: const Color(0xFFE2E8F0),
                        valueColor: AlwaysStoppedAnimation<Color>(HelmColors.primary),
                      ),
                    ),
                  ],
                  ),
                ),
              );
            }).toList(),
            const SizedBox(height: 4),
            Text(
              '$totalVotes vote(s)',
              style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
            ),
          ],
        ),
      );
    } catch (e) {
      // If JSON parsing fails, show the content as text (stripped)
      return Text(stripHtml(msg.content), style: const TextStyle(fontSize: 12, color: Color(0xFF667085)));
    }
  }

  // ⭐ V3-11: Document attachment — file card with icon
  // ⭐ V3-12: Use MIME type as fallback if the file extension doesn't match.
  //   Also use more specific icons: Word → Icons.article, Excel → Icons.table_view.
  Widget _buildDocumentAttachmentBubble(Message msg, bool isOwn) {
    final name = msg.attachmentName ?? 'Fichier';
    final size = msg.attachmentSize;
    final mime = msg.attachmentMime ?? '';
    String sizeLabel = '';
    if (size != null) {
      if (size < 1024) {
        sizeLabel = '${size}o';
      } else if (size < 1024 * 1024) {
        sizeLabel = '${(size / 1024).toStringAsFixed(1)} Ko';
      } else {
        sizeLabel = '${(size / (1024 * 1024)).toStringAsFixed(1)} Mo';
      }
    }
    IconData icon = Icons.insert_drive_file;
    Color iconColor = HelmColors.primary;
    final nameLower = name.toLowerCase();
    // ⭐ V3-12: Check file extension FIRST, then MIME type as fallback
    if (nameLower.endsWith('.pdf') || mime.contains('pdf')) {
      icon = Icons.picture_as_pdf;
      iconColor = const Color(0xFFEF4444);
    } else if (nameLower.endsWith('.doc') || nameLower.endsWith('.docx') || mime.contains('word') || mime.contains('msword')) {
      icon = Icons.article;
      iconColor = const Color(0xFF2563EB);
    } else if (nameLower.endsWith('.xls') || nameLower.endsWith('.xlsx') || mime.contains('sheet') || mime.contains('excel') || mime.contains('spreadsheet')) {
      icon = Icons.table_view;
      iconColor = const Color(0xFF16A34A);
    } else if (nameLower.endsWith('.ppt') || nameLower.endsWith('.pptx') || mime.contains('presentation') || mime.contains('powerpoint')) {
      icon = Icons.slideshow;
      iconColor = const Color(0xFFEA580C);
    } else if (nameLower.endsWith('.zip') || nameLower.endsWith('.rar') || nameLower.endsWith('.7z')) {
      icon = Icons.folder_zip;
      iconColor = const Color(0xFF8B5CF6);
    }
    return GestureDetector(
      onTap: () => _openAttachment(msg.attachmentUrl ?? ''),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isOwn ? const Color(0xFFBAE0FF).withOpacity(0.4) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: HelmColors.goldLight.withOpacity(0.2), width: 1),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF172033)),
                  ),
                  if (sizeLabel.isNotEmpty)
                    Text(
                      sizeLabel,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF667085)),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.open_in_new, color: HelmColors.primary, size: 18),
          ],
        ),
      ),
    );
  }

  // ⭐ V3-4: 3-state read receipt (✓ sent, ✓✓ gray delivered, ✓✓ blue read)
  // (Reaction emojis are rendered directly as Text — emojis are essential for chat UX.)

  Widget _buildReadReceiptIcon(Message msg) {
    if (msg.readBy.isNotEmpty) {
      return const Icon(Icons.done_all, size: 12, color: Color(0xFF13C2C2)); // blue = read
    }
    if (msg.deliveredAt != null) {
      return const Icon(Icons.done_all, size: 12, color: Color(0xFF94A3B8)); // gray = delivered
    }
    return const Icon(Icons.check, size: 12, color: Color(0xFF94A3B8)); // single check = sent
  }

  // ⭐ V1.5: Long-press message actions (reply, copy, delete, pin, react)
  void _showMessageActions(Message msg) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ⭐ V3-4: Reply — sets _replyToMessage state + focuses the composer
            ListTile(
              leading: const Icon(Icons.reply, color: Color(0xFF0958D9)),
              title: const Text('Répondre'),
              onTap: () {
                Navigator.pop(context);
                _handleReply(msg);
              },
            ),
            ListTile(
              leading: const Text('😊', style: TextStyle(fontSize: 20)),
              title: const Text('Réagir'),
              onTap: () {
                Navigator.pop(context);
                _showReactionPicker(msg);
              },
            ),
            // ⭐ V3-2: Transcrire (audio messages only)
            if (msg.isAttachment && (msg.attachmentName?.toLowerCase().endsWith('.mp3') == true ||
                msg.attachmentName?.toLowerCase().endsWith('.m4a') == true ||
                msg.attachmentName?.toLowerCase().endsWith('.wav') == true ||
                msg.attachmentName?.toLowerCase().endsWith('.ogg') == true))
              ListTile(
                leading: const Icon(Icons.audio_file, color: Color(0xFF6366F1)),
                title: const Text('Transcrire (Whisper)'),
                onTap: () {
                  Navigator.pop(context);
                  _transcribeMessage(msg);
                },
              ),
            // ⭐ V3-4: Copy — really copies to clipboard now
            ListTile(
              leading: const Icon(Icons.copy, color: Color(0xFF64748B)),
              title: const Text('Copier'),
              onTap: () {
                Navigator.pop(context);
                final textContent = stripHtml(msg.content);
                if (textContent.isNotEmpty) {
                  Clipboard.setData(ClipboardData(text: textContent)).then((_) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Message copié'), duration: Duration(seconds: 1)),
                      );
                    }
                  });
                }
              },
            ),
            // ⭐ V3-4: Forward — opens a conversation picker modal
            ListTile(
              leading: const Icon(Icons.forward, color: Color(0xFF0958D9)),
              title: const Text('Transférer'),
              onTap: () {
                Navigator.pop(context);
                _showForwardModal(msg);
              },
            ),
            // ⭐ V3-4: Pin message (calls backend)
            ListTile(
              leading: const Icon(Icons.push_pin, color: Color(0xFF64748B)),
              title: Text(msg.isPinned ? 'Désépingler' : 'Épingler'),
              onTap: () async {
                Navigator.pop(context);
                try {
                  await ApiService.pinMessage(msg.id);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(msg.isPinned ? 'Message désépinglé' : 'Message épinglé')),
                    );
                    _loadMessages();
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Échec: $e')),
                    );
                  }
                }
              },
            ),
            // ⭐ V3-4: Mark important (calls backend)
            ListTile(
              leading: Icon(msg.isImportant ? Icons.star : Icons.star_border, color: const Color(0xFFF59E0B)),
              title: Text(msg.isImportant ? 'Retirer marquage' : 'Marquer important'),
              onTap: () async {
                Navigator.pop(context);
                try {
                  await ApiService.markImportant(msg.id);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(msg.isImportant ? 'Marquage retiré' : 'Message marqué important')),
                    );
                    _loadMessages();
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Échec: $e')),
                    );
                  }
                }
              },
            ),
            // ⭐ V3-4: Edit (sender only, text messages only)
            if (msg.isOwn && msg.type == 'TEXT')
              ListTile(
                leading: const Icon(Icons.edit, color: Color(0xFF64748B)),
                title: const Text('Modifier'),
                onTap: () {
                  Navigator.pop(context);
                  _startEditMessage(msg);
                },
              ),
            if (msg.isOwn)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text('Supprimer pour tous'),
                onTap: () {
                  Navigator.pop(context);
                  _deleteMessage(msg, forEveryone: true);
                },
              ),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: Color(0xFF64748B)),
              title: const Text('Supprimer pour moi'),
              onTap: () {
                Navigator.pop(context);
                _deleteMessage(msg, forEveryone: false);
              },
            ),
            // ⭐ V7 (parité web) — Signaler un message (modération)
            ListTile(
              leading: const Icon(Icons.flag_outlined, color: Color(0xFFDC2626)),
              title: const Text('Signaler'),
              onTap: () {
                Navigator.pop(context);
                _reportMessage(msg);
              },
            ),
          ],
        ),
      ),
    );
  }

  // ⭐ V7 — Signaler un message : POST /chat/messages/:id/report
  void _reportMessage(Message msg) async {
    final reasonController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Signaler ce message'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Décrivez le problème (contenu inapproprié, harcèlement…). Le message sera transmis à la modération.', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              maxLines: 3,
              autofocus: true,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Raison (optionnel)',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            onPressed: () async {
              Navigator.pop(context);
              try {
                final reason = reasonController.text.trim();
                await ApiService.reportMessage(msg.id, reason: reason.isEmpty ? 'Signalement' : reason);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Message signalé — la modération a été notifiée')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
                }
              } finally {
                reasonController.dispose();
              }
            },
            child: const Text('Signaler'),
          ),
        ],
      ),
    );
  }

  void _showReactionPicker(Message msg) {
    // ⭐ V3-11: Use real emojis for chat reactions (essential for chat UX).
    //   The emoji string is the reaction ID stored in the backend.
    final reactions = [
      {'emoji': '👍', 'label': 'J\'aime'},
      {'emoji': '❤️', 'label': 'J\'adore'},
      {'emoji': '😂', 'label': 'Rigolo'},
      {'emoji': '😮', 'label': 'Surpris'},
      {'emoji': '😢', 'label': 'Triste'},
      {'emoji': '🙏', 'label': 'Merci'},
    ];
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => SafeArea(
        child: Container(
          margin: const EdgeInsets.all(8),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.15),
                blurRadius: 20,
                spreadRadius: 2,
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: reactions.map((r) {
              return GestureDetector(
                onTap: () {
                  Navigator.pop(context);
                  _sendReaction(msg, r['emoji'] as String);
                },
                child: Tooltip(
                  message: r['label'] as String,
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFF1F5F9),
                    ),
                    child: Center(
                      child: Text(
                        r['emoji'] as String,
                        style: const TextStyle(fontSize: 28),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }

  void _sendReaction(Message msg, String emoji) async {
    try {
      await ApiService.addReaction(messageId: msg.id, emoji: emoji);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Réaction $emoji envoyée'), duration: const Duration(seconds: 1)),
        );
        // Refresh to show the new reaction
        _loadMessages();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Échec: $e')),
        );
      }
    }
  }

  void _deleteMessage(Message msg, {required bool forEveryone}) async {
    try {
      if (forEveryone) {
        await ApiService.deleteMessageForEveryone(
          conversationId: widget.conversation.id,
          messageId: msg.id,
        );
      } else {
        await ApiService.deleteMessageForMe(
          conversationId: widget.conversation.id,
          messageId: msg.id,
        );
      }
      if (mounted) {
        _loadMessages();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(forEveryone ? 'Message supprimé pour tous' : 'Message supprimé pour vous')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Échec: $e')),
        );
      }
    }
  }

  // ⭐ V3-11: Branded categorized attachment menu — matches web's style (Royal Blue + gold)
  void _showAttachmentMenu() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => SafeArea(
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              // Title with Helm Connect branding
              Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1)),
                ),
                child: Row(
                  children: [
                    Image.asset('assets/icons/helm_connect.png', width: 20, height: 20, fit: BoxFit.contain),
                    const SizedBox(width: 8),
                    const Text(
                      'Joindre un fichier',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: HelmColors.primary),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              // Attachment options — branded cards (image gallery, camera, document, audio)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    _buildAttachmentOption(
                      icon: Icons.photo_library,
                      label: 'Galerie',
                      color: const Color(0xFF10B981),
                      onTap: () { Navigator.pop(context); _sendImage(ImageSource.gallery); },
                    ),
                    const SizedBox(width: 10),
                    _buildAttachmentOption(
                      icon: Icons.camera_alt,
                      label: 'Photo',
                      color: const Color(0xFF06B6D4),
                      onTap: () { Navigator.pop(context); _sendImage(ImageSource.camera); },
                    ),
                    const SizedBox(width: 10),
                    _buildAttachmentOption(
                      icon: Icons.insert_drive_file,
                      label: 'Document',
                      color: HelmColors.primary,
                      onTap: () { Navigator.pop(context); _sendDocument(); },
                    ),
                  ],
                ),
              ),
              // Second row — voice recording hint
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: HelmColors.goldLight.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: HelmColors.gold.withOpacity(0.3), width: 1),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: const BoxDecoration(
                          color: HelmColors.gold,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.mic, color: Colors.white, size: 18),
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Message vocal',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: HelmColors.primary),
                            ),
                            Text(
                              'Maintenez le bouton micro dans la barre de saisie pour enregistrer.',
                              style: TextStyle(fontSize: 10, color: Color(0xFF667085)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  // ⭐ V3-11: Helper — single attachment option card with branded styling
  Widget _buildAttachmentOption({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: color.withOpacity(0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withOpacity(0.2), width: 1),
          ),
          child: Column(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: Colors.white, size: 22),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _getInitials(String name) {
    final parts = name.split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    if (parts.isNotEmpty) return parts[0][0].toUpperCase();
    return '?';
  }

  // ⭐ V3-4: Reply — set the _replyToMessage state and focus the composer
  void _handleReply(Message msg) {
    setState(() => _replyToMessage = msg);
    // Focus the text input
    FocusScope.of(context).requestFocus(FocusNode());
  }

  // ⭐ V3-4: Edit message — open an inline edit dialog
  void _startEditMessage(Message msg) {
    _editController.text = stripHtml(msg.content);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Modifier le message'),
        content: TextField(
          controller: _editController,
          maxLines: 5,
          autofocus: true,
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            labelText: 'Message',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () async {
              final newContent = _editController.text.trim();
              if (newContent.isEmpty) return;
              Navigator.pop(context);
              try {
                await ApiService.editMessage(
                  messageId: msg.id,
                  newContent: newContent,
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Message modifié')),
                  );
                  _loadMessages();
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Échec: $e')),
                  );
                }
              }
            },
            child: const Text('Enregistrer'),
          ),
        ],
      ),
    );
  }

  // ⭐ V3-4: Forward — open a conversation picker modal
  void _showForwardModal(Message msg) async {
    try {
      final conversations = await ApiService.listConversations();
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Transférer vers...'),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Preview of the message being forwarded
                Container(
                  padding: const EdgeInsets.all(8),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Message à transférer', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                      const SizedBox(height: 2),
                      Text(
                        stripHtml(msg.content),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12),
                      ),
                    ],
                  ),
                ),
                // Conversation list
                SizedBox(
                  height: 280,
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: conversations.length,
                    itemBuilder: (context, index) {
                      final conv = conversations[index];
                      // Filter out the current conversation
                      if (conv['id'] == widget.conversation.id) return const SizedBox.shrink();
                      final name = (conv['name'] as String?) ??
                          ((conv['participants'] as List<dynamic>?) ?? [])
                              .map((p) => '${p['firstName'] ?? ''} ${p['lastName'] ?? ''}'.trim())
                              .where((n) => n.isNotEmpty)
                              .join(', ');
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: const Color(0xFF1677FF),
                          child: Text(
                            _getInitials(name),
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                        ),
                        title: Text(name, style: const TextStyle(fontSize: 14)),
                        onTap: () async {
                          Navigator.pop(context);
                          try {
                            await ApiService.forwardMessage(
                              messageId: msg.id,
                              targetConversationId: conv['id'] as String,
                            );
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Message transféré vers $name')),
                              );
                            }
                          } catch (e) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Échec: $e')),
                              );
                            }
                          }
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Annuler'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Échec: $e')),
        );
      }
    }
  }

  // ⭐ V3-4: Typing indicator — called when the user types in the composer
  void _onTextChanged(String value) {
    // ⭐ V3-11: Rebuild input bar to toggle mic/send button based on text content
    setState(() {});
    if (value.isEmpty) {
      _stopTyping();
      return;
    }
    _startTyping();
    // Auto-stop typing after 3s of no input
    _typingDebounce?.cancel();
    _typingDebounce = Timer(const Duration(seconds: 3), () => _stopTyping());
  }

  void _startTyping() {
    if (_isTypingSent) return;
    _socket.startTyping(widget.conversation.id);
    _isTypingSent = true;
  }

  void _stopTyping() {
    if (!_isTypingSent) return;
    _socket.stopTyping(widget.conversation.id);
    _isTypingSent = false;
    _typingDebounce?.cancel();
  }
}

/// ⭐ V3-4: Cached reply quote — { senderName, content } for parent messages.
class _ReplyQuote {
  final String senderName;
  final String content;
  _ReplyQuote({required this.senderName, required this.content});
}

/// ⭐ V3-11: Decorative waveform painter for audio message bubbles.
/// Draws vertical bars with varying heights (no actual audio analysis — purely decorative).
/// Bars before [progress * barsCount] use the active color; bars after use the inactive color.
class _WaveformPainter extends CustomPainter {
  final int barsCount;
  final bool isOwn;
  final double progress; // 0.0 to 1.0

  _WaveformPainter({
    this.barsCount = 24,
    required this.isOwn,
    required this.progress,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paintActive = Paint()
      ..color = isOwn ? const Color(0xFF0958D9) : HelmColors.primary
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    final paintInactive = Paint()
      ..color = (isOwn ? const Color(0xFF0958D9) : HelmColors.primary).withOpacity(0.3)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;

    final barWidth = 2.0;
    final gap = (size.width - barsCount * barWidth) / (barsCount - 1);
    final centerY = size.height / 2;
    // Pseudo-random heights (deterministic, no audio analysis)
    final heights = <double>[];
    for (var i = 0; i < barsCount; i++) {
      final seed = (i * 1.7).abs();
      final h = 4 + (seed % 1) * (size.height - 6);
      heights.add(h.clamp(2.0, size.height));
    }

    for (var i = 0; i < barsCount; i++) {
      final x = i * (barWidth + gap);
      final h = heights[i];
      final isActive = (i / barsCount) < progress;
      canvas.drawLine(
        Offset(x, centerY - h / 2),
        Offset(x, centerY + h / 2),
        isActive ? paintActive : paintInactive,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _WaveformPainter old) =>
      old.progress != progress || old.isOwn != isOwn || old.barsCount != barsCount;
}

// ============================================================================
// ⭐ V5 — _ParticipantPickerSheet : sélection des invités d'un appel de
//    groupe quand le groupe dépasse la limite mesh (4 pairs). Bottom sheet
//    avec recherche + cases à cocher + bouton « Lancer l'appel ».
// ============================================================================
class _ParticipantPickerSheet extends StatefulWidget {
  final List<Participant> participants;
  final int maxSelection;
  final String callType; // 'AUDIO' | 'VIDEO'

  const _ParticipantPickerSheet({
    required this.participants,
    required this.maxSelection,
    required this.callType,
  });

  @override
  State<_ParticipantPickerSheet> createState() => _ParticipantPickerSheetState();
}

class _ParticipantPickerSheetState extends State<_ParticipantPickerSheet> {
  final Set<String> _selected = {};
  String _query = '';

  List<Participant> get _filtered {
    if (_query.isEmpty) return widget.participants;
    final q = _query.toLowerCase();
    return widget.participants
        .where((p) =>
            p.fullName.toLowerCase().contains(q) ||
            (p.email ?? '').toLowerCase().contains(q))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final isVideo = widget.callType == 'VIDEO';
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      minChildSize: 0.4,
      builder: (context, scrollController) => Column(
        children: [
          // ─── En-tête ───
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      isVideo ? Icons.videocam : Icons.phone,
                      color: HelmColors.primary,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Appel ${isVideo ? 'vidéo' : 'audio'} de groupe',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: HelmColors.text,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Sélectionnez jusqu\'à ${widget.maxSelection} participants '
                  '(réseau direct mobile, au-delà le web utilise Jitsi).',
                  style: const TextStyle(
                    fontSize: 12,
                    color: HelmColors.textMuted,
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  onChanged: (v) => setState(() => _query = v),
                  decoration: InputDecoration(
                    hintText: 'Rechercher…',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    isDense: true,
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          // ─── Liste ───
          Expanded(
            child: ListView.builder(
              controller: scrollController,
              itemCount: _filtered.length,
              itemBuilder: (context, i) {
                final p = _filtered[i];
                final selected = _selected.contains(p.userId);
                final disabled = !selected && _selected.length >= widget.maxSelection;
                return CheckboxListTile(
                  value: selected,
                  onChanged: disabled
                      ? null
                      : (v) => setState(() {
                            if (v == true) {
                              _selected.add(p.userId);
                            } else {
                              _selected.remove(p.userId);
                            }
                          }),
                  secondary: CircleAvatar(
                    backgroundColor: HelmColors.primaryVivid,
                    child: Text(
                      p.initialsForPicker,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  title: Text(
                    p.fullName.isNotEmpty ? p.fullName : 'Utilisateur',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: HelmColors.text,
                    ),
                  ),
                  subtitle: p.role == 'ADMIN'
                      ? const Text('Administrateur',
                          style: TextStyle(fontSize: 11, color: HelmColors.gold))
                      : null,
                  activeColor: HelmColors.primary,
                  dense: true,
                );
              },
            ),
          ),
          // ─── Bouton lancer ───
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: Icon(isVideo ? Icons.videocam : Icons.phone, size: 20),
                  label: Text(
                    _selected.isEmpty
                        ? 'Sélectionnez des participants'
                        : 'Appeler (${_selected.length})',
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: HelmColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: _selected.isEmpty
                      ? null
                      : () {
                          final selected = widget.participants
                              .where((p) => _selected.contains(p.userId))
                              .toSet();
                          Navigator.of(context).pop(selected);
                        },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Extension utilitaire locale pour les initiales du sélecteur.
extension ParticipantPickerX on Participant {
  String get initialsForPicker {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }
}
