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
// ⭐ V8 — E2EE réel (RSA-OAEP 2048/SHA-256, interopérable web)
//    Remplace le stub CryptoService (désactivé depuis la V3-8).
import '../services/e2ee_service.dart';
// ⭐ V8 — fils de discussion (panneau dédié, parité web V5 Threads)
import 'thread_screen.dart';
// ⭐ V3-5: WebRTC calls + branded call screen
import '../services/call_service.dart';
import 'call_screen.dart';
// ⭐ V9 (parité web) — galerie de médias (grille 3 col + lightbox, miroir
//    MediaGalleryModal V4 Phase 2 / Yeshua Connect)
import 'media_gallery_screen.dart';
// ⭐ V9 (conformité web) — kit de conformité : palette messaging, avatars
//    photos, rendu riche Discord, LinkEmbed /api/og, watermark, emojis,
//    bulle « tape… », slash commands.
import '../widgets/helm_chat_kit.dart';

// ⭐ V5 — appels de groupe + écran membres (import du service câblé)
import '../services/group_call_service.dart';
import 'group_call_screen.dart';
import 'group_members_screen.dart';

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
  // ⭐ V8 — E2EE : contenus déchiffrés (id → texte clair, pass async après
  //    chargement — miroir de decryptedContents du web) + copies en clair
  //    de MES messages chiffrés (repli d'affichage côté expéditeur).
  final Map<String, String> _decryptedContents = {};
  final Map<String, String> _ownPlaintextCopies = {};
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
  // ⭐ V8 — type corrigé : DateTime (avant String — 3 erreurs d'analyse
  //    V7 : .day/.month sur String + affectations DateTime → String?)
  DateTime? _otherLastSeen;
  // ⭐ V9 (conformité web) — recherche dans la conversation (jump + halo)
  bool _searchOpen = false;
  final _searchController = TextEditingController();
  String _searchQuery = '';
  List<Map<String, dynamic>> _searchResults = const [];
  bool _searchingInConv = false;
  String? _haloMessageId;
  Timer? _haloTimer;
  // ⭐ V9 — messages programmés (bannière ⏰ ambre + annulation, comme le web)
  List<Map<String, dynamic>> _scheduled = const [];
  // ⭐ V9 (parité web) — autocomplete @mentions
  String? _mentionQuery;
  // ⭐ V9 — vitesse de lecture vocale 0,5×/1×/1,5×/2× (web : cycle au tap)
  final List<double> _speeds = [0.5, 1.0, 1.5, 2.0];
  int _speedIndex = 1;

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
    // ⭐ V9 — messages programmés en attente (bannière ambre)
    _loadScheduledMessages();
    // ⭐ V6 — présence réelle du correspondant (API + socket)
    _loadCurrentUserIdThenPresence();
    // ⭐ V8 — E2EE : génère/publie les clés (une fois par appareil) puis
    //    évalue la disponibilité E2E de cette conversation (async, silencieux)
    _ensureE2EKeys();
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

  // ⭐ V8 — E2EE : clés locales générées une fois par appareil (isolate
  //    séparé, zéro jank) + publication de la clé publique. Best-effort :
  //    en cas d'échec réseau, E2E reste simplement désactivé (messages en
  //    clair) — exactement le repli du client web.
  Future<void> _ensureE2EKeys() async {
    final userId = await AuthService.getUserId();
    if (userId == null || userId.isEmpty) return;
    await E2eeService.ensureKeyPair(userId: userId);
    await _refreshE2eAvailability();
  }

  // ⭐ V8 — disponibilité E2EE de la conversation COURANTE :
  //    DIRECT + clé privée locale + clé publique du correspondant.
  bool _e2eAvailable = false;
  Future<void> _refreshE2eAvailability() async {
    if (widget.conversation.type != 'DIRECT') {
      if (_e2eAvailable) setState(() => _e2eAvailable = false);
      return;
    }
    final other = widget.conversation.participants
        .where((p) => p.userId != _currentUserId)
        .toList();
    if (other.isEmpty) return;
    final ok = await E2eeService.isDirectE2eeAvailable(other.first.userId);
    if (mounted && ok != _e2eAvailable) setState(() => _e2eAvailable = ok);
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
                senderAvatarUrl: m.senderAvatarUrl,
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
                senderAvatarUrl: m.senderAvatarUrl,
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
                senderAvatarUrl: m.senderAvatarUrl,
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

      // ⭐ V8 — clé publique du destinataire de la conversation courante
      //    (re-chiffrement au re-flush, miroir du web).
      String? flushOtherKey;
      if (widget.conversation.type == 'DIRECT') {
        final other = widget.conversation.participants
            .where((p) => p.userId != _currentUserId)
            .toList();
        if (other.isNotEmpty) {
          flushOtherKey = await E2eeService.getPublicKey(other.first.userId);
        }
      }

      // Send in chunks of 5 to avoid flooding the server
      for (var i = 0; i < pending.length; i += 5) {
        final chunk = pending.skip(i).take(5).toList();
        await Future.wait(chunk.map((p) async {
          try {
            // ⭐ V8 — E2EE au re-flush : chiffrer comme l'envoi principal quand
            //    le message concerne la conversation courante (clé connue,
            //    contenu court, pas déjà chiffré).
            var contentOut = p.content;
            if (flushOtherKey != null &&
                p.conversationId == widget.conversation.id &&
                p.content.length < 400 &&
                !E2eeService.isEncrypted(p.content)) {
              final encrypted = await E2eeService.encryptFor(
                widget.conversation.participants
                    .firstWhere((pp) => pp.userId != _currentUserId,
                        orElse: () => widget.conversation.participants.first)
                    .userId,
                p.content,
              );
              if (encrypted != null) contentOut = encrypted;
            }
            await ApiService.sendTextMessage(
              conversationId: p.conversationId,
              content: contentOut,
              // ⭐ V8 — BUGFIX : replyToId était omis au re-flush → les réponses
              //    de fil mises en file hors ligne perdaient leur rattachement.
              replyToId: p.replyToId,
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

  // ⭐ V9 (parité web CategorizedAttachmentMenu) — envoi VIDÉO via
  //    sélecteur de fichiers (le web propose Vidéos dans son menu 9 options).
  Future<void> _sendVideoFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(type: FileType.video);
      if (result == null || result.files.isEmpty) return;
      final file = File(result.files.first.path!);
      await ApiService.sendAttachment(
        conversationId: widget.conversation.id,
        file: file,
        type: 'VIDEO',
        fileName: result.files.first.name,
      );
      _loadMessages();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Vidéo envoyée'), duration: Duration(seconds: 1)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
      }
    }
  }

  // ⭐ V9 — envoi d'un fichier AUDIO existant (pas un vocal enregistré).
  Future<void> _sendAudioFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(type: FileType.audio);
      if (result == null || result.files.isEmpty) return;
      final file = File(result.files.first.path!);
      await ApiService.sendAttachment(
        conversationId: widget.conversation.id,
        file: file,
        type: 'AUDIO',
        fileName: result.files.first.name,
      );
      _loadMessages();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Audio envoyé'), duration: Duration(seconds: 1)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
      }
    }
  }

  // ⭐ V9 (parité web PollModal) — création de SONDAGE : question (≥ 5 car.),
  //    2-10 options, choix multiple, anonyme, expiration (1H/8H/24H/7D/Jamais).
  void _showPollDialog() {
    final questionCtrl = TextEditingController();
    final optionCtrls = [TextEditingController(), TextEditingController()];
    var multiple = false;
    var anonymous = false;
    var expiry = '24H';
    final expiries = ['1H', '8H', '24H', '7D', 'NEVER'];
    final expiryLabels = {
      '1H': '1 heure', '8H': '8 heures', '24H': '24 heures', '7D': '7 jours', 'NEVER': 'Jamais',
    };
    showDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialog) => AlertDialog(
          title: Row(
            children: const [
              Icon(Icons.bar_chart, color: Color(0xFF1677FF), size: 20),
              SizedBox(width: 8),
              Text('Créer un sondage', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
            ],
          ),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: questionCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Question (min. 5 caractères)',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ...List.generate(optionCtrls.length, (i) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: optionCtrls[i],
                            decoration: InputDecoration(
                              labelText: 'Option ${i + 1}',
                              border: const OutlineInputBorder(),
                              isDense: true,
                            ),
                          ),
                        ),
                        if (optionCtrls.length > 2)
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline, size: 18, color: Color(0xFFEF4444)),
                            onPressed: () => setDialog(() => optionCtrls.removeAt(i)),
                          ),
                      ],
                    ),
                  )),
                  if (optionCtrls.length < 10)
                    TextButton.icon(
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('Ajouter une option', style: TextStyle(fontSize: 12)),
                      onPressed: () => setDialog(() => optionCtrls.add(TextEditingController())),
                    ),
                  CheckboxListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Choix multiple', style: TextStyle(fontSize: 13)),
                    value: multiple,
                    onChanged: (v) => setDialog(() => multiple = v ?? false),
                  ),
                  CheckboxListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Sondage anonyme', style: TextStyle(fontSize: 13)),
                    value: anonymous,
                    onChanged: (v) => setDialog(() => anonymous = v ?? false),
                  ),
                  const Text('Expire dans', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  Wrap(
                    spacing: 6,
                    children: expiries.map((e) {
                      final sel = expiry == e;
                      return ChoiceChip(
                        label: Text(expiryLabels[e]!, style: const TextStyle(fontSize: 11)),
                        selected: sel,
                        onSelected: (_) => setDialog(() => expiry = e),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Annuler'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1677FF)),
              onPressed: () async {
                final q = questionCtrl.text.trim();
                final opts = optionCtrls.map((c) => c.text.trim()).where((t) => t.isNotEmpty).toList();
                if (q.length < 5) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('La question doit contenir au moins 5 caractères')),
                  );
                  return;
                }
                if (opts.length < 2) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Minimum 2 options')),
                  );
                  return;
                }
                Navigator.pop(dialogContext);
                try {
                  await ApiService.createPoll(
                    conversationId: widget.conversation.id,
                    question: q,
                    options: opts,
                    multipleChoice: multiple,
                    anonymous: anonymous,
                    expiry: expiry == 'NEVER' ? null : expiry,
                  );
                  _loadMessages();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Sondage créé'), duration: Duration(seconds: 1)),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
                  }
                }
              },
              child: const Text('Créer'),
            ),
          ],
        ),
      ),
    );
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
    _haloTimer?.cancel();
    _searchController.dispose();
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
    // ⭐ V5 — quitte la room de conversation (le socket singleton reste
    //    connecté : appels entrants + messages des autres écrans en dépendent).
    _socket.leaveConversation(widget.conversation.id);
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
      // ⭐ V8 — avant d'écraser le cache : récolte les copies EN CLAIR de mes
      //    messages (phase optimiste) pour le repli d'affichage E2E.
      try {
        final cachedNow = await ChatLocalStorage.getMessages(widget.conversation.id);
        for (final c in cachedNow) {
          if (userId != null &&
              c.senderId == userId &&
              c.content.isNotEmpty &&
              !E2eeService.isEncrypted(c.content)) {
            _ownPlaintextCopies[c.id] = c.content;
          }
        }
      } catch (_) {/* cache optionnel */}
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
        // ⭐ V8 — pass de déchiffrement asynchrone des contenus « E2E: »
        //    (miroir de l'effet decryptedContents du web)
        _decryptPendingMessages();
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

  // ⭐ V8 — E2EE : déchiffre en tâche de fond les messages « E2E: » reçus
  //    (les MIENS restent indéchiffrables par moi — repli sur la copie
  //    locale en clair). Met à jour l'affichage uniquement si nécessaire.
  Future<void> _decryptPendingMessages() async {
    final encrypted = _messages.where((m) => E2eeService.isEncrypted(m.content)).toList();
    if (encrypted.isEmpty) return;
    var changed = false;
    for (final m in encrypted) {
      if (_decryptedContents.containsKey(m.id)) continue;
      if (m.isOwn) {
        final own = _ownPlaintextCopies[m.id];
        if (own != null && !E2eeService.isEncrypted(own)) {
          _decryptedContents[m.id] = own;
          changed = true;
        }
        continue;
      }
      final plain = await E2eeService.decryptContent(m.content);
      if (plain != null) {
        _decryptedContents[m.id] = plain;
        changed = true;
      }
    }
    if (changed && mounted) setState(() {});
  }

  /// ⭐ V8 — contenu à AFFICHER : clair → stripHtml ; chiffré → déchiffré /
  ///    repli expéditeur / placeholder 🔒 (jamais de base64 brut à l'écran).
  String _displayContent(Message msg) {
    final content = msg.content ?? '';
    if (!E2eeService.isEncrypted(content)) return stripHtml(content);
    final decrypted = _decryptedContents[msg.id];
    if (decrypted != null) return decrypted;
    if (msg.isOwn) {
      final own = _ownPlaintextCopies[msg.id];
      if (own != null && !E2eeService.isEncrypted(own)) return own;
    }
    return '🔒 Message chiffré';
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

    // ⭐ V8 — E2EE : chiffre POUR le destinataire si les conditions web sont
    //    réunies (DIRECT + clés publiées des deux côtés + < 400 caractères).
    //    La copie locale (optimiste + file offline) reste en CLAIR : je ne
    //    peux pas déchiffrer mon propre message — repli d'affichage dédié.
    await _ensureE2EKeys();
    String contentToSend = rawContent;
    if (_e2eAvailable && widget.conversation.type == 'DIRECT' && rawContent.length < 400) {
      final other = widget.conversation.participants
          .where((p) => p.userId != _currentUserId)
          .toList();
      if (other.isNotEmpty) {
        final encrypted = await E2eeService.encryptFor(other.first.userId, rawContent);
        if (encrypted != null) contentToSend = encrypted;
      }
    }
    final content = rawContent; // copie locale/affichage — toujours en clair

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
    // ⭐ V8 — copie en clair pour le repli d'affichage de mes messages chiffrés
    _ownPlaintextCopies[localId] = content;

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
    // ⭐ V8 — l'aperçu de citation passe par _displayContent (parent chiffré →
    //    repli copie clair / déchiffré, jamais de base64 brut)
    final replyContent = _replyToMessage == null ? '' : _displayContent(_replyToMessage!);
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
        final sent = await ApiService.sendTextMessage(
          conversationId: widget.conversation.id,
          content: contentToSend,
          replyToId: replyToId,
        );
        // ⭐ V8 — associe la copie en clair à l'ID SERVEUR : après rechargement,
        //    mon message arrive chiffré (« E2E: ») et ce repli permet de
        //    l'afficher en clair chez l'expéditeur (miroir du web).
        final serverId = sent['id'];
        if (serverId is String && contentToSend != rawContent) {
          _ownPlaintextCopies[serverId] = rawContent;
        }
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
                Text(data['summary'].toString(), style: const TextStyle(fontSize: 13)),
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
                      Text(data['suggestedTitle'].toString(), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
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

  // ⭐ V8 — fils de discussion : compteur de réponses par message parent
  //    (réponses = messages avec replyToId = parent, mêmes règles que le web).
  Map<String, int> get _replyCountByParent {
    final counts = <String, int>{};
    for (final m in _messages) {
      final parentId = m.replyToId;
      if (parentId != null && !m.isDeleted && m.type != 'SYSTEM') {
        counts[parentId] = (counts[parentId] ?? 0) + 1;
      }
    }
    return counts;
  }

  /// ⭐ V8 — ouvre le fil de discussion d'un message (écran dédié).
  void _openThread(Message msg) {
    Navigator.of(context).push(
      MaterialPageRoute(
        settings: const RouteSettings(name: '/thread'),
        builder: (_) => ThreadScreen(
          conversation: widget.conversation,
          parentMessage: msg,
          currentUserId: _currentUserId,
        ),
      ),
    );
  }

  // ⭐ V9 (parité web) — messages programmés : bannière ⏰ ambre au-dessus du
  //    composer (liste des PENDING + annulation) — miroir exact du web.
  Future<void> _loadScheduledMessages() async {
    try {
      final items = await ApiService.listScheduledMessages(widget.conversation.id);
      if (mounted) {
        setState(() => _scheduled = items);
      }
    } catch (_) {/* silencieux */}
  }

  // ⭐ V9 — programme un message (textarea + date + heure, comme le web)
  void _showScheduleDialog() {
    final contentController = TextEditingController();
    DateTime scheduled = DateTime.now().add(const Duration(hours: 1));
    showDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('Programmer un message'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: contentController,
                maxLines: 4,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Message à programmer',
                  hintText: 'Contenu du message…',
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.calendar_today, size: 16),
                      label: Text(
                        '${scheduled.day}/${scheduled.month}/${scheduled.year}',
                        style: const TextStyle(fontSize: 13),
                      ),
                      onPressed: () async {
                        final d = await showDatePicker(
                          context: dialogContext,
                          initialDate: scheduled,
                          firstDate: DateTime.now(),
                          lastDate: DateTime.now().add(const Duration(days: 365)),
                        );
                        if (d != null) {
                          setDialogState(() {
                            scheduled = DateTime(d.year, d.month, d.day, scheduled.hour, scheduled.minute);
                          });
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.access_time, size: 16),
                      label: Text(
                        '${scheduled.hour.toString().padLeft(2, '0')}:${scheduled.minute.toString().padLeft(2, '0')}',
                        style: const TextStyle(fontSize: 13),
                      ),
                      onPressed: () async {
                        final t = await showTimePicker(
                          context: dialogContext,
                          initialTime: TimeOfDay.fromDateTime(scheduled),
                        );
                        if (t != null) {
                          setDialogState(() {
                            scheduled = DateTime(
                              scheduled.year, scheduled.month, scheduled.day, t.hour, t.minute,
                            );
                          });
                        }
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Annuler'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFCFA63A)),
              onPressed: () async {
                final content = contentController.text.trim();
                if (content.isEmpty) return;
                if (!scheduled.isAfter(DateTime.now())) {
                  ScaffoldMessenger.of(dialogContext).showSnackBar(
                    const SnackBar(content: Text('Choisissez une date future')),
                  );
                  return;
                }
                Navigator.pop(dialogContext);
                try {
                  await ApiService.scheduleMessage(
                    conversationId: widget.conversation.id,
                    content: content,
                    scheduledFor: scheduled,
                  );
                  await _loadScheduledMessages();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Message programmé pour le ${scheduled.day}/${scheduled.month} à ${scheduled.hour}:${scheduled.minute.toString().padLeft(2, '0')}')),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
                  }
                }
              },
              child: const Text('Programmer'),
            ),
          ],
        ),
      ),
    );
  }

  // ⭐ V9 — annule un message programmé (DELETE /chat/scheduled/:id)
  Future<void> _cancelScheduled(String schedId) async {
    try {
      await ApiService.cancelScheduledMessage(schedId);
      await _loadScheduledMessages();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
      }
    }
  }

  // ⭐ V9 (parité web) — MUTE de la conversation : cloche du header → menu
  //    1h / 8h / 24h / jusqu'à réactivation.
  void _showMuteMenu() {
    final isMuted = widget.conversation.isMuted;
    showModalBottomSheet(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                isMuted ? 'Notifications coupées' : 'Couper les notifications',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
            if (isMuted)
              ListTile(
                leading: const Icon(Icons.notifications_active, color: Color(0xFF1677FF)),
                title: const Text('Réactiver les notifications'),
                onTap: () async {
                  Navigator.pop(sheetContext);
                  try {
                    await ApiService.unmuteConversation(widget.conversation.id);
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Notifications réactivées')),
                      );
                    }
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
                    }
                  }
                },
              )
            else ...[
              ListTile(
                leading: const Icon(Icons.schedule),
                title: const Text('Pendant 1 heure'),
                onTap: () { Navigator.pop(sheetContext); ApiService.muteConversation(widget.conversation.id, duration: '1h').then((_) => _muteOk('1 heure')); },
              ),
              ListTile(
                leading: const Icon(Icons.schedule),
                title: const Text('Pendant 8 heures'),
                onTap: () { Navigator.pop(sheetContext); ApiService.muteConversation(widget.conversation.id, duration: '8h').then((_) => _muteOk('8 heures')); },
              ),
              ListTile(
                leading: const Icon(Icons.schedule),
                title: const Text('Pendant 24 heures'),
                onTap: () { Navigator.pop(sheetContext); ApiService.muteConversation(widget.conversation.id, duration: '24h').then((_) => _muteOk('24 heures')); },
              ),
              ListTile(
                leading: const Icon(Icons.notifications_off, color: Color(0xFFF59E0B)),
                title: const Text("Jusqu'à réactivation"),
                onTap: () { Navigator.pop(sheetContext); ApiService.muteConversation(widget.conversation.id, duration: 'forever').then((_) => _muteOk('réactivation')); },
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _muteOk(String duree) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Notifications coupées ($duree)')),
      );
    }
  }

  // ⭐ V9 (parité web) — lien d'invitation du groupe → presse-papiers
  Future<void> _shareInviteLink() async {
    try {
      final res = await ApiService.createInviteLink(widget.conversation.id);
      final link = (res['link'] ?? res['inviteLink'] ?? res['url']) as String?;
      if (link == null || link.isEmpty) throw Exception('Lien indisponible');
      await Clipboard.setData(ClipboardData(text: link));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lien d’invitation copié dans le presse-papiers')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
      }
    }
  }

  // ⭐ V9 (parité web) — recherche DANS la conversation : GET /:id/search?q=
  //    puis saut vers le message (scroll + halo bleu 1,5 s, comme le web).
  Future<void> _runInConversationSearch(String q) async {
    if (q.trim().length < 2) {
      setState(() { _searchResults = const []; _searchQuery = q; });
      return;
    }
    setState(() { _searchingInConv = true; _searchQuery = q; });
    try {
      final results = await ApiService.searchInConversation(
        conversationId: widget.conversation.id,
        query: q.trim(),
      );
      if (mounted) setState(() => _searchResults = results);
    } catch (_) {
      if (mounted) setState(() => _searchResults = const []);
    } finally {
      if (mounted) setState(() => _searchingInConv = false);
    }
  }

  // ⭐ V9 — saut vers un message : si hors fenêtre → charge les pages plus
  //    anciennes jusqu'à le trouver (miroir jumpToMessage du web).
  Future<void> _jumpToMessage(String messageId) async {
    var guard = 0;
    while (!_messages.any((m) => m.id == messageId) && _hasMoreMessages && guard < 10) {
      await _loadOlderMessages();
      guard++;
    }
    final index = _messages.indexWhere((m) => m.id == messageId);
    if (index == -1) return;
    // Approximation : chaque message ≈ 70 px + séparateurs → scroll index*70
    await _scrollController.animateTo(
      (index * 70.0).clamp(0.0, _scrollController.position.maxScrollExtent),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
    if (mounted) {
      setState(() => _haloMessageId = messageId);
      _haloTimer?.cancel();
      _haloTimer = Timer(const Duration(milliseconds: 1500), () {
        if (mounted) setState(() => _haloMessageId = null);
      });
    }
  }

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
                '${pinned.length} message${pinned.length > 1 ? 's' : ''} épinglé${pinned.length > 1 ? 's' : ''} • ${_displayContent(last).isEmpty ? (last.isAttachment ? 'Pièce jointe' : 'Message') : _displayContent(last)}',
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
                        _displayContent(m).isEmpty ? (m.isAttachment ? (m.attachmentName ?? 'Pièce jointe') : 'Message') : _displayContent(m),
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
        // ⭐ V9 (conformité web FORME) — header de conversation bleu Helm
        //    SOLIDE #0958D9 + texte blanc + sous-titre #BAE0FF (miroir exact
        //    du web ; avant : gradient Royal Blue).
        backgroundColor: WebChatColors.header,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Row(
          children: [
            // ⭐ V9 — avatar PHOTO ou initiales (palette 8, comme le web)
            HelmAvatar(
              name: displayName,
              avatarUrl: widget.conversation.type == 'DIRECT'
                  ? _otherAvatarUrl
                  : widget.conversation.avatarUrl,
              userId: widget.conversation.type == 'DIRECT' ? _otherUserId : null,
              size: 36,
              isGroup: widget.conversation.type == 'GROUP',
              isChannel: isChannel,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(displayName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  // ⭐ V6 — présence RÉELLE + cadenas E2E V8
                  // ⭐ V9 — sous-titre #BAE0FF (couleur exacte du web)
                  Row(
                    children: [
                      if (widget.conversation.isMuted) ...[
                        const Icon(Icons.notifications_off, size: 11, color: Color(0xFFFFE08A)),
                        const SizedBox(width: 3),
                      ],
                      if (_e2eAvailable) ...[
                        const Icon(Icons.lock, size: 10, color: Color(0xFFBAE0FF)),
                        const SizedBox(width: 3),
                      ],
                      Expanded(
                        child: Text(
                          isChannel
                              ? 'Canal de diffusion'
                              : _isOtherTyping
                                  ? 'tape…'
                                  : _presenceLabel,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            color: _isOtherTyping || _otherOnline
                                ? const Color(0xFFBAE0FF)
                                : const Color(0xFFBAE0FF).withOpacity(0.75),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        // ⭐ V9 (parité web) — actions du header : cloche (mute), recherche
        //    dans la conv, galerie média, lien d'invitation (groupes),
        //    appels, membres, résumé ORION.
        actions: [
          // Cloche — mute par conversation (menu 1h/8h/24h/∞)
          IconButton(
            icon: Icon(
              widget.conversation.isMuted ? Icons.notifications_off : Icons.notifications_none,
              color: widget.conversation.isMuted ? const Color(0xFFFFE08A) : Colors.white,
              size: 20,
            ),
            tooltip: 'Notifications',
            onPressed: _showMuteMenu,
          ),
          // Recherche dans la conversation
          IconButton(
            icon: const Icon(Icons.search, color: Colors.white, size: 20),
            tooltip: 'Rechercher dans la conversation',
            onPressed: () => setState(() => _searchOpen = !_searchOpen),
          ),
          // ⭐ V7 — pas d'appel sur les CANAUX (diffusion unidirectionnelle)
          if (!isChannel) ...[
            IconButton(
              icon: const Icon(Icons.phone, color: Colors.white),
              tooltip: widget.conversation.type == 'GROUP'
                  ? 'Appel audio de groupe'
                  : 'Appel audio',
              onPressed: () => _startCall('AUDIO'),
            ),
            IconButton(
              icon: const Icon(Icons.videocam, color: Colors.white),
              tooltip: widget.conversation.type == 'GROUP'
                  ? 'Appel vidéo de groupe'
                  : 'Appel vidéo',
              onPressed: () => _startCall('VIDEO'),
            ),
          ],
          // ⭐ V9 — lien d'invitation (groupes, comme le web : UserPlus)
          if (widget.conversation.type == 'GROUP')
            IconButton(
              icon: const Icon(Icons.person_add_alt, color: Colors.white, size: 20),
              tooltip: 'Lien d’invitation',
              onPressed: _shareInviteLink,
            ),
          // ⭐ V5 — écran membres / gestion des groupes
          if (widget.conversation.type == 'GROUP')
            IconButton(
              icon: const Icon(Icons.groups, color: Colors.white),
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
          // ⭐ V9 — galerie média de la conversation (web : icône image)
          IconButton(
            icon: const Icon(Icons.image_outlined, color: Colors.white, size: 20),
            tooltip: 'Galerie média',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                settings: const RouteSettings(name: '/media-gallery'),
                builder: (_) => MediaGalleryScreen(conversation: widget.conversation),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.auto_awesome, color: Color(0xFFFFE08A)),
            tooltip: 'Résumer la conversation (ORION IA)',
            onPressed: _summarizeConversation,
          ),
        ],
      ),
      body: Column(
        children: [
          // ⭐ V7 (parité web) — bandeau des messages épinglés
          _buildPinnedBanner(),
          // ⭐ V9 (parité web) — barre de recherche DANS la conversation
          if (_searchOpen) _buildInConversationSearchBar(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: HelmColors.primary))
                : _messages.isEmpty
                    ? _buildEmptyConversationState()
                    // ⭐ V9 (parité web FORME) — watermark Helm en fond des
                    //    messages (opacité 0.05, miroir getHelmWatermarkStyle)
                    : HelmWatermark(
                        opacity: 0.05,
                        child: Container(
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
                                // ⭐ V9 (parité web) — halo bleu 1,5 s sur le message
                                //    ciblé par un saut de recherche
                                if (_haloMessageId == msg.id)
                                  Container(height: 2, color: WebChatColors.primary),
                              ],
                            );
                          },
                        ),
                      ),
                      ),
          ),
          // ⭐ V9 (parité web) — bulle « tape… » en bas de la liste : avatar
          //    + 3 points rebondissants (miroir exact du web, AVANT : simple
          //    texte italique sous la liste).
          if (_isOtherTyping)
            Align(
              alignment: Alignment.centerLeft,
              child: TypingBubble(
                name: _otherParticipantName,
                avatarUrl: _otherAvatarUrl,
                userId: _otherUserId,
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
                          stripHtml(_displayContent(_replyToMessage!)),
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
          // ⭐ V9 (parité web) — bannière des messages programmés ⏰ ambre
          //    (aperçu + date/heure + bouton annuler, au-dessus du composer)
          if (_scheduled.isNotEmpty) _buildScheduledBanner(),
          // ⭐ V9 (parité web) — popover @mentions au-dessus du composer
          //    (déclenché par la saisie de « @ » + lettres, miroir du web)
          _buildMentionOverlay(),
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
    // Default: emoji + attach + text field + schedule + mic (if empty) + send
    // ⭐ V9 — CORRECTIF CRITIQUE du composer « carré restreint » :
    //    AVANT : TextField SANS maxLines/minLines (mono-ligne à hauteur
    //    figée) + Entrée = envoi (onSubmitted) → champ « carré » et envois
    //    involontaires. MAINTENANT (miroir du composer du fil + du web) :
    //    minLines 1 / maxLines 6, clavier multiline, Entrée = saut de ligne,
    //    envoi UNIQUEMENT par le bouton, padding vertical équilibré.
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // Emoji picker (web : popover 3 catégories)
        SizedBox(
          width: 44,
          height: 44,
          child: IconButton(
            padding: EdgeInsets.zero,
            icon: const Icon(Icons.emoji_emotions_outlined, color: Color(0xFF64748B)),
            tooltip: 'Emojis',
            onPressed: _showEmojiSheet,
          ),
        ),
        IconButton(
          icon: const Icon(Icons.add_circle_outline, color: HelmColors.primary),
          onPressed: () => _showAttachmentMenu(),
        ),
        Expanded(
          child: TextField(
            controller: _messageController,
            // ⭐ V9 — le champ GRANDIT avec le contenu (1 → 6 lignes)
            minLines: 1,
            maxLines: 6,
            keyboardType: TextInputType.multiline,
            textInputAction: TextInputAction.newline,
            decoration: InputDecoration(
              hintText: 'Tapez un message...',
              filled: true,
              fillColor: const Color(0xFFF5F7FA),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
            // ⭐ V9 — PLUS de onSubmitted : Entrée insère un saut de ligne
            //    (l'envoi se fait uniquement via le bouton, comme le fil).
          ),
        ),
        // Programmer un message (web : bouton horloge + modal)
        SizedBox(
          width: 40,
          height: 44,
          child: IconButton(
            padding: EdgeInsets.zero,
            icon: const Icon(Icons.schedule, color: Color(0xFFCFA63A), size: 22),
            tooltip: 'Programmer l’envoi',
            onPressed: _showScheduleDialog,
          ),
        ),
        const SizedBox(width: 4),
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

  // ⭐ V9 (parité web) — picker d'emojis (3 catégories identiques au web)
  void _showEmojiSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (sheetContext) => ChatEmojiPicker(
        onEmojiSelected: (emoji) {
          final text = _messageController.text;
          final selection = _messageController.selection;
          final newText = selection.isValid
              ? text.replaceRange(selection.start, selection.end, emoji)
              : '$text$emoji';
          _messageController.value = TextEditingValue(
            text: newText,
            selection: TextSelection.collapsed(offset: (selection.isValid ? selection.start : text.length) + emoji.length),
          );
          _onTextChanged(_messageController.text);
        },
      ),
    );
  }

  // ⭐ V9 (parité web) — recherche dans la conversation : barre + résultats
  Widget _buildInConversationSearchBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  autofocus: true,
                  decoration: InputDecoration(
                    hintText: 'Rechercher dans la conversation…',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    isDense: true,
                    filled: true,
                    fillColor: const Color(0xFFF5F7FA),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  onChanged: (v) => _runInConversationSearch(v),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 20),
                onPressed: () {
                  _searchController.clear();
                  setState(() {
                    _searchOpen = false;
                    _searchResults = const [];
                    _searchQuery = '';
                  });
                },
              ),
            ],
          ),
          if (_searchingInConv)
            const Padding(
              padding: EdgeInsets.all(6),
              child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
            ),
          if (_searchResults.isNotEmpty)
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 180),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _searchResults.length,
                itemBuilder: (context, i) {
                  final r = _searchResults[i];
                  final snippet = stripHtml((r['content'] ?? r['snippet'] ?? '') as String?);
                  final sender = '${r['senderFirstName'] ?? r['sender']?['firstName'] ?? ''} ${r['senderLastName'] ?? r['sender']?['lastName'] ?? ''}'.trim();
                  return ListTile(
                    dense: true,
                    visualDensity: VisualDensity.compact,
                    title: Text(
                      snippet.isEmpty ? '(pièce jointe)' : snippet,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13),
                    ),
                    subtitle: Text(
                      sender.isNotEmpty ? sender : '—',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                    ),
                    trailing: const Icon(Icons.subdirectory_arrow_right, size: 18, color: Color(0xFF0958D9)),
                    onTap: () {
                      final id = (r['id'] ?? r['messageId']) as String?;
                      if (id != null) _jumpToMessage(id);
                    },
                  );
                },
              ),
            ),
          if (!_searchingInConv && _searchQuery.trim().length >= 2 && _searchResults.isEmpty)
            const Padding(
              padding: EdgeInsets.all(6),
              child: Text('Aucun résultat', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
            ),
        ],
      ),
    );
  }

  // ⭐ V9 (parité web) — bannière des messages programmés (ambre ⏰ + annuler)
  Widget _buildScheduledBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: const BoxDecoration(
        color: Color(0xFFFFFBEB),
        border: Border(bottom: BorderSide(color: Color(0xFFFDE68A))),
      ),
      child: Column(
        children: _scheduled.take(3).map((s) {
          final content = stripHtml((s['content'] ?? '') as String?);
          final when = DateTime.tryParse((s['scheduledFor'] ?? s['scheduledAt'] ?? '') as String? ?? '');
          final whenLabel = when != null
              ? '${when.day}/${when.month} à ${when.hour.toString().padLeft(2, '0')}:${when.minute.toString().padLeft(2, '0')}'
              : 'programmé';
          return Row(
            children: [
              const Icon(Icons.schedule, size: 14, color: Color(0xFFD97706)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  '⏰ $whenLabel • ${content.isEmpty ? 'Message programmé' : content}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11, color: Color(0xFFB45309)),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 14, color: Color(0xFFB45309)),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                tooltip: 'Annuler',
                onPressed: () => _cancelScheduled((s['id'] ?? s['scheduledId'] ?? '') as String),
              ),
            ],
          );
        }).toList(),
      ),
    );
  }

  // ⭐ V9 — infos de l'autre participant (nom + avatar pour typing/header)
  String get _otherParticipantName {
    if (widget.conversation.type != 'DIRECT') return '';
    final other = widget.conversation.participants
        .where((p) => p.userId != _currentUserId)
        .toList();
    return other.isEmpty ? '' : (other.first.fullName.isNotEmpty ? other.first.fullName : 'Utilisateur');
  }

  String? get _otherAvatarUrl {
    if (widget.conversation.type != 'DIRECT') return null;
    final other = widget.conversation.participants
        .where((p) => p.userId != _currentUserId)
        .toList();
    return other.isEmpty ? null : other.first.avatarUrl;
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
    // ⭐ V9 (conformité web FORME) — couleurs de bulles EXACTES du web :
    //    MOI → #3B9EFF + texte blanc (bg-[#3B9EFF] text-white) ;
    //    AUTRE en DIRECT → blanc + bord slate-200 (bg-white border-slate-200) ;
    //    AUTRE en GROUPE → palette 8 teintes par expéditeur (hash djb2).
    //    (AVANT : mes bulles étaient bleu clair #E6F4FF — non conforme.)
    final (bubbleBg, bubbleBorder) = !isOwn && widget.conversation.type == 'GROUP'
        ? kUserBubbleColors[hashUserId(msg.senderId)]
        : isOwn
            ? (WebChatColors.bubbleOwn, WebChatColors.bubbleOwn)
            : (Colors.white, WebChatColors.bubbleOtherBorder);
    final senderTextColor = !isOwn && widget.conversation.type == 'GROUP'
        ? kUserTextColors[hashUserId(msg.senderId)]
        : const Color(0xFF0958D9);
    // ⭐ V9 — couleur du texte principal de la bulle (blanc sur #3B9EFF)
    final bodyTextColor = isOwn ? Colors.white : const Color(0xFF1E293B);
    final metaTextColor = isOwn ? Colors.white70 : const Color(0xFF94A3B8);

    // ⭐ V3-4: Group reactions by emoji with count — whatsapp style
    final Map<String, int> reactionCounts = {};
    final Map<String, bool> myReactions = {};
    for (final r in msg.reactions) {
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
      if (r.userId == _currentUserId) myReactions[r.emoji] = true;
    }
    // ⭐ V8 — nombre de réponses dans le fil de ce message (badge)
    final threadReplyCount = _replyCountByParent[msg.id] ?? 0;

    // ⭐ V9 (parité web) — halo de recherche : bordure bleue 2px pendant 1,5 s
    final hasHalo = _haloMessageId == msg.id;

    return Align(
      alignment: isOwn ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: () => _showMessageActions(msg),
        child: Container(
        margin: const EdgeInsets.symmetric(vertical: 2),
        // ⭐ V9 — padding web px-3 py-2 (12×8) + largeur min(82%, 640)
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.82,
        ),
        decoration: BoxDecoration(
          color: bubbleBg,
          // ⭐ V9 (parité web) — queue WhatsApp : rounded-2xl + coin
          //    resserré côté émetteur (rounded-br-sm pour moi / bl-sm autres)
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: isOwn ? const Radius.circular(16) : const Radius.circular(4),
            bottomRight: isOwn ? const Radius.circular(4) : const Radius.circular(16),
          ),
          border: hasHalo
              ? Border.all(color: WebChatColors.primary, width: 2)
              : isOwn
                  ? null
                  : Border.all(color: bubbleBorder, width: 1),
          boxShadow: isOwn
              ? [BoxShadow(color: WebChatColors.bubbleOwn.withOpacity(0.25), blurRadius: 4, offset: const Offset(0, 1))]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ⭐ V9 (parité web) — avatar 32px + nom pour les messages
            //    d'autrui en groupe (photo réelle ou initiales palette).
            if (!isOwn && widget.conversation.type == 'GROUP')
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    HelmAvatar(
                      name: msg.senderName.isNotEmpty ? msg.senderName : '?',
                      avatarUrl: msg.senderAvatarUrl,
                      userId: msg.senderId,
                      size: 32,
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        msg.senderName,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: senderTextColor),
                      ),
                    ),
                  ],
                ),
              ),
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
                // ⭐ V8 — parent chiffré ? priorité au contenu déchiffré
                final decryptedParent = msg.replyToId != null ? _decryptedContents[msg.replyToId] : null;
                final quoteSender = msg.replyToSenderName?.isNotEmpty == true
                    ? msg.replyToSenderName!
                    : quote?.senderName ?? '';
                final quoteContent = decryptedParent ??
                    (msg.replyToContent?.isNotEmpty == true
                        ? msg.replyToContent!
                        : quote?.content ?? '');
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
            // ⭐ V9 (parité web) — rendu RICHE Discord : @mentions, @here,
            //    ||spoilers||, `code`, blocs ``` avec Copier, ~~barré~~,
            //    citations >, gras/italique HTML + LINK EMBED de la 1re URL.
            if (msg.type == 'POLL' && msg.content != null && msg.content!.isNotEmpty) ...[
              const SizedBox(height: 4),
              _buildPollBubble(msg, isOwn),
            ]
            else if (msg.type == 'STICKER' && (msg.attachmentUrl ?? '').isNotEmpty) ...[
              const SizedBox(height: 4),
              _buildImageAttachmentBubble(msg, isOwn),
            ]
            else if (msg.content != null && msg.content!.isNotEmpty && msg.type != 'AUDIO') ...[
              // Contenu clair (E2EE déchiffré ou texte) → rendu riche
              RichMessageContent(
                content: _displayContent(msg),
                isOwn: isOwn,
                baseStyle: TextStyle(fontSize: 14, height: 1.35, color: bodyTextColor),
              ),
              // ⭐ V9 — LinkEmbed : première URL du message (sauf chiffré)
              if (!E2eeService.isEncrypted(msg.content ?? '') &&
                  msg.type == 'TEXT' &&
                  extractFirstUrl(_displayContent(msg)) != null)
                LinkEmbedCard(url: extractFirstUrl(_displayContent(msg))!),
            ],
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
            // ⭐ V9 (parité web) — vidéos : lecteur/lanceur intégré (avant : aucune
            //    bulle vidéo — le type VIDEO n'était jamais rendu)
            else if (msg.isAttachment && msg.type == 'VIDEO') ...[
              const SizedBox(height: 4),
              _buildVideoAttachmentBubble(msg, isOwn),
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
            // ⭐ V8 (parité web V5 Threads) — badge « N réponse(s) » sous la
            //    bulle : ouvre le fil de discussion dédié.
            if (threadReplyCount > 0) ...[
              const SizedBox(height: 4),
              GestureDetector(
                onTap: () => _openThread(msg),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE6F4FF),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFBAE0FF)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.forum, size: 12, color: Color(0xFF0958D9)),
                      const SizedBox(width: 4),
                      Text(
                        '$threadReplyCount réponse${threadReplyCount > 1 ? 's' : ''}',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF0958D9)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
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
        ); // ⭐ V8 — BUGFIX : `),` au lieu de `);` — le return GestureDetector(…)
           //    n'était JAMAIS terminé (erreur de syntaxe, l'app ne compilait pas)
      },
    );
  }

  // ⭐ V9 (parité web FORME) — bulle VIDÉO : le web rend un <video controls>
  //    inline (max 280×300, rounded-lg, preload=metadata) ; en mobile natif
  //    le miroir est une carte poster avec bouton ▶ qui lance la lecture
  //    dans le lecteur système (convention WhatsApp mobile). Rendu AVANT :
  //    aucune bulle vidéo — le type VIDEO tombait sur la carte document.
  Widget _buildVideoAttachmentBubble(Message msg, bool isOwn) {
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
            Icon(Icons.videocam_off_outlined, color: Color(0xFF94A3B8)),
            SizedBox(width: 8),
            Text('Vidéo indisponible', style: TextStyle(fontSize: 11, color: Color(0xFF667085))),
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
            child: Container(
              constraints: const BoxConstraints(maxWidth: 240, maxHeight: 200),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Poster : try to extract a frame via metadata is impossible
                  // sans video_player → fond dégradé + nom du fichier.
                  Positioned.fill(
                    child: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                        ),
                      ),
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: const BoxDecoration(
                          color: Colors.white24,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.play_arrow, color: Colors.white, size: 30),
                      ),
                      const SizedBox(height: 8),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          msg.attachmentName?.isNotEmpty == true
                              ? msg.attachmentName!
                              : 'Vidéo',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11, color: Colors.white70),
                        ),
                      ),
                    ],
                  ),
                  // Coin : badge durée/format (miroir overlay web)
                  Positioned(
                    top: 6,
                    right: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black45,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.play_circle_outline, size: 10, color: Colors.white),
                          SizedBox(width: 2),
                          Text('MP4', style: TextStyle(fontSize: 8, color: Colors.white)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
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
  //    ⭐ V9 (parité web) — couleurs EXACTES du web sur bulle #3B9EFF :
  //    ✓✓ lu = text-blue-300 #93C5FD (AVANT : cyan #13C2C2), ✓✓ distribué
  //    = text-slate-400 #94A3B8, ✓ envoyé = blanc70 sur bulle bleue.
  Widget _buildReadReceiptIcon(Message msg) {
    if (msg.readBy.isNotEmpty) {
      return const Icon(Icons.done_all, size: 12, color: WebChatColors.tickRead); // blue-300 = read
    }
    if (msg.deliveredAt != null) {
      return const Icon(Icons.done_all, size: 12, color: WebChatColors.tickDelivered); // gray = delivered
    }
    return const Icon(Icons.check, size: 12, color: WebChatColors.tickOnBlue); // single check = sent
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
            // ⭐ V8 (parité web V5 Threads) — Fil de discussion : ouvre le panneau
            //    dédié (message parent + réponses + composer du fil)
            Builder(builder: (sheetContext) {
              final replies = _replyCountByParent[msg.id] ?? 0;
              return ListTile(
                leading: const Icon(Icons.forum, color: Color(0xFF0958D9)),
                title: const Text('Fil de discussion'),
                subtitle: replies > 0
                    ? Text('$replies réponse${replies > 1 ? 's' : ''}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)))
                    : null,
                onTap: () {
                  Navigator.pop(sheetContext);
                  _openThread(msg);
                },
              );
            }),
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
                final textContent = _displayContent(msg);
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
                      label: 'Caméra',
                      color: const Color(0xFF06B6D4),
                      onTap: () { Navigator.pop(context); _sendImage(ImageSource.camera); },
                    ),
                    const SizedBox(width: 10),
                    _buildAttachmentOption(
                      icon: Icons.videocam,
                      label: 'Vidéos',
                      color: const Color(0xFF8B5CF6),
                      onTap: () { Navigator.pop(context); _sendVideoFile(); },
                    ),
                  ],
                ),
              ),
              // ⭐ V9 — 2e rangée web : Documents / Audio / Sondage
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Row(
                  children: [
                    _buildAttachmentOption(
                      icon: Icons.insert_drive_file,
                      label: 'Document',
                      color: HelmColors.primary,
                      onTap: () { Navigator.pop(context); _sendDocument(); },
                    ),
                    const SizedBox(width: 10),
                    _buildAttachmentOption(
                      icon: Icons.library_music,
                      label: 'Audio',
                      color: const Color(0xFFEC4899),
                      onTap: () { Navigator.pop(context); _sendAudioFile(); },
                    ),
                    const SizedBox(width: 10),
                    _buildAttachmentOption(
                      icon: Icons.bar_chart,
                      label: 'Sondage',
                      color: const Color(0xFF10B981),
                      onTap: () { Navigator.pop(context); _showPollDialog(); },
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
    _editController.text = _displayContent(msg);
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
                        _displayContent(msg),
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
    // ⭐ V9 (parité web) — détection @mentions : « @ » + lettres → popover
    _detectMention(value);
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

  // ⭐ V9 (parité web) — MENTIONS : miroir de la détection onChange du web.
  //    Dernier « @ » du texte : suivi de 0 lettre (popover complet) ou de
  //    lettres/chiffres uniquement (filtrage) ; espace/ponctuation → fermé.
  void _detectMention(String value) {
    final idx = value.lastIndexOf('@');
    if (idx == -1) {
      if (_mentionQuery != null) setState(() => _mentionQuery = null);
      return;
    }
    final afterAt = value.substring(idx + 1);
    if (afterAt.isEmpty) {
      setState(() => _mentionQuery = '');
    } else if (RegExp(r"^[A-Za-zÀ-ÿ0-9_\-']+$").hasMatch(afterAt)) {
      setState(() => _mentionQuery = afterAt);
    } else {
      if (_mentionQuery != null) setState(() => _mentionQuery = null);
    }
  }

  /// Correspondances de mentions (miroir mentionMatches web : max 5).
  List<Participant> get _mentionMatches {
    if (_mentionQuery == null) return [];
    final q = _mentionQuery!.toLowerCase();
    return widget.conversation.participants
        .where((p) => p.userId != _currentUserId)
        .where((p) => p.fullName.toLowerCase().contains(q))
        .take(5)
        .toList();
  }

  /// Insère la mention à la place du jeton « @requête » (miroir selectMention).
  void _selectMention(Participant p) {
    final firstName = p.fullName.split(' ').isNotEmpty
        ? p.fullName.split(' ').first
        : p.fullName;
    final mentionText = '@$firstName ';
    final value = _messageController.text;
    final q = _mentionQuery ?? '';
    final token = q.isEmpty ? '@' : '@$q';
    final idx = value.lastIndexOf(token);
    setState(() => _mentionQuery = null);
    if (idx != -1) {
      _messageController.text =
          value.replaceRange(idx, idx + token.length, mentionText);
      _messageController.selection = TextSelection.fromPosition(
        TextPosition(offset: idx + mentionText.length),
      );
    } else {
      _messageController.text = '$value$mentionText';
    }
  }

  /// Popover mentions au-dessus du composer (miroir web : bulle blanche,
  /// avatar palette hash nom + initiales, « Mentionner un participant »).
  Widget _buildMentionOverlay() {
    final matches = _mentionMatches;
    if (_mentionQuery == null || matches.isEmpty) return const SizedBox.shrink();
    return Align(
      alignment: Alignment.bottomLeft,
      child: Container(
        margin: const EdgeInsets.only(left: 8, right: 8, bottom: 4),
        constraints: const BoxConstraints(maxHeight: 240),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.12),
              blurRadius: 12,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              child: Text(
                'MENTIONNER UN PARTICIPANT',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                  color: const Color(0xFF64748B),
                ),
              ),
            ),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: matches.length,
                itemBuilder: (context, i) {
                  final p = matches[i];
                  return InkWell(
                    onTap: () => _selectMention(p),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 13,
                            backgroundColor: webAvatarColorByName(p.fullName),
                            child: Text(
                              p.fullName.isNotEmpty
                                  ? (p.fullName.trim().split(RegExp(r'\s+')).length > 1
                                      ? '${p.fullName.trim().split(RegExp(r'\s+')).first[0]}${p.fullName.trim().split(RegExp(r'\s+')).last[0]}'
                                      : p.fullName[0])
                                      .toUpperCase()
                                  : '?',
                              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              p.fullName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                            ),
                          ),
                          if ((p.roleLabel ?? '').isNotEmpty)
                            Text(
                              p.roleLabel!,
                              style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
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
