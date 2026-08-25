// ============================================================================
// HELM CONNECT — Conversation Detail Screen (chat view)
// ============================================================================
// Vue conversation avec bulles de messages (style WhatsApp).
// Identité Azure : bulles envoyées sur fond #E6F4FF, reçues sur #FFFFFF.
// ============================================================================

import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart'; // ⭐ V3-4: Clipboard.setData for copy action
import 'package:shared_preferences/shared_preferences.dart'; // ⭐ V3-5: for myName lookup
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
// ⭐ V3-1: Offline-first chat — local cache + send queue
import '../services/chat_local_storage.dart';
// ⭐ E2E encryption — DISABLED for now (pointycastle API incompatibility)
// Will be re-enabled in V4 with proper Signal Protocol implementation.
// ⭐ E2E encryption — DISABLED for now (pointycastle 3.x API incompatibility)
// Will be re-enabled in V4 with proper Signal Protocol.
// import '../services/crypto_service.dart';
import 'dart:convert' as _dart_convert;

// Stub for CryptoService (all methods are no-ops, encryption falls back to plaintext)
class CryptoService {
  static bool isEncrypted(String content) => false;
  static Future<String> decryptMessage(String content) async => content;
  static Future<String> encryptMessage(String content, String recipientKey) async => content;
  static Future<bool> hasPrivateKey() async => false;
  static Future<String> generateKeyPair() async => '';
}
// ⭐ V3-5: WebRTC calls + branded call screen
import '../services/call_service.dart';
import 'call_screen.dart';

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

  @override
  void initState() {
    super.initState();
    // ⭐ V3-4: Load current user ID for reaction "is mine" detection
    _loadCurrentUserId();
    _loadMessages();
    // ⭐ Socket.io: connect for realtime (replaces 10s polling)
    _initSocket();
    // ⭐ V3-5: Initialize WebRTC call service + bind socket callbacks
    _callService = CallService(_socket);
    _callService.addListener(_onCallStateChanged);
    // ⭐ Wrap async callbacks in sync closures (socket callbacks expect void Function)
    _socket.onCallOffer = (data) => _callService.onIncomingCallOffer(data);
    _socket.onCallAnswer = (data) { _callService.onCallAnswer(data); };
    _socket.onCallIceCandidate = (data) { _callService.onIceCandidate(data); };
    _socket.onCallReject = (data) => _callService.onCallReject();
    _socket.onCallHangup = (data) => _callService.onCallHangup();
    // Polling fallback (reduced to 30s — Socket.io should deliver instantly)
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _loadMessages());
    // ⭐ V3-1: Flush any pending messages from previous session (silent retry on app start)
    _flushPendingQueue();
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
  void _startCall(String callType) async {
    if (widget.conversation.type == 'GROUP') return; // Group calls not supported yet
    final other = widget.conversation.participants.firstWhere(
      (p) => p.userId != _currentUserId,
      orElse: () => widget.conversation.participants.first,
    );
    if (other.userId.isEmpty) return;
    final otherName = other.fullName.isNotEmpty ? other.fullName : 'Utilisateur';
    // Get my own name (for callerName payload parity with web)
    final prefs = await SharedPreferences.getInstance();
    final myName = prefs.getString('auth_user_email')?.split('@').first ?? 'Utilisateur';
    await _callService.startCall(
      otherUserId: other.userId,
      otherUserName: otherName,
      callType: callType,
      myName: myName,
    );
    // The _onCallStateChanged listener will push CallScreen when state changes
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
        }
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

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _socket.leaveConversation(widget.conversation.id);
    _socket.disconnect();
    _messageController.dispose();
    _scrollController.dispose();
    _editController.dispose();
    _typingDebounce?.cancel();
    // ⭐ V3-5: Cleanup the call service
    _callService.removeListener(_onCallStateChanged);
    _callService.dispose();
    super.dispose();
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

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
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
      _scrollToBottom();
    }

    // Clear the input + reply-to state
    _messageController.clear();
    if (_replyToMessage != null) {
      setState(() => _replyToMessage = null);
    }

    try {
      await ApiService.sendTextMessage(
        conversationId: widget.conversation.id,
        content: content,
        replyToId: replyToId,
      );
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

  @override
  Widget build(BuildContext context) {
    final displayName = widget.conversation.type == 'GROUP'
        ? (widget.conversation.name ?? 'Groupe')
        : (widget.conversation.participants.isNotEmpty
            ? widget.conversation.participants.firstWhere(
                (p) => p.userId != (widget.conversation.createdBy),
                orElse: () => widget.conversation.participants.first,
              ).fullName
            : 'Conversation');

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            CircleAvatar(
              backgroundColor: Colors.white.withOpacity(0.2),
              child: widget.conversation.type == 'GROUP'
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
                  Text(
                    widget.conversation.type == 'GROUP'
                        ? '${widget.conversation.participants.length} membres'
                        : 'en ligne',
                    style: const TextStyle(fontSize: 11, color: Color(0xFFBAE0FF)),
                  ),
                ],
              ),
            ),
          ],
        ),
        // ⭐ V3-3: Sparkles button to trigger ORION conversation summary
        // ⭐ V3-5: Phone + Video call buttons (DIRECT conversations only)
        actions: [
          if (widget.conversation.type != 'GROUP')
            IconButton(
              icon: const Icon(Icons.phone, color: Colors.white),
              tooltip: 'Appel audio',
              onPressed: () => _startCall('AUDIO'),
            ),
          if (widget.conversation.type != 'GROUP')
            IconButton(
              icon: const Icon(Icons.videocam, color: Colors.white),
              tooltip: 'Appel vidéo',
              onPressed: () => _startCall('VIDEO'),
            ),
          IconButton(
            icon: const Icon(Icons.auto_awesome, color: Colors.white),
            tooltip: 'Résumer la conversation (ORION IA)',
            onPressed: _summarizeConversation,
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : Container(
                    color: const Color(0xFFF5F7FA),
                    child: ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(16),
                      itemCount: _messages.length,
                      itemBuilder: (context, index) {
                        final msg = _messages[index];
                        return _buildMessageBubble(msg);
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
          // Input bar
          Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.add_circle_outline, color: Color(0xFF667085)),
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
                    ),
                    onChanged: _onTextChanged,
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  decoration: const BoxDecoration(
                    color: Color(0xFF1677FF),
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: _sending
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.send, color: Colors.white),
                    onPressed: _sending ? null : _sendMessage,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(Message msg) {
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
          color: isOwn ? const Color(0xFFE6F4FF) : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: isOwn ? const Radius.circular(16) : const Radius.circular(4),
            bottomRight: isOwn ? const Radius.circular(4) : const Radius.circular(16),
          ),
          border: isOwn ? Border.all(color: const Color(0xFFBAE0FF), width: 0.5) : Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
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
            // Sender name (for groups)
            if (!isOwn && widget.conversation.type == 'GROUP')
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  msg.senderName,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0958D9)),
                ),
              ),
            // Content (V3-4: strip HTML before display)
            if (msg.content != null && msg.content!.isNotEmpty)
              Text(stripHtml(msg.content), style: const TextStyle(fontSize: 14, color: Color(0xFF172033))),
            // Attachment
            if (msg.isAttachment) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFE6F4FF).withOpacity(0.5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.attach_file, size: 16, color: Color(0xFF0958D9)),
                    const SizedBox(width: 8),
                    Expanded(child: Text(msg.attachmentName ?? 'Fichier', style: const TextStyle(fontSize: 12, color: Color(0xFF0958D9)))),
                  ],
                ),
              ),
            ],
            // ⭐ V3-4: Reactions display (grouped by emoji with count)
            if (reactionCounts.isNotEmpty) ...[
              const SizedBox(height: 4),
              Wrap(
                spacing: 4,
                runSpacing: 2,
                children: reactionCounts.entries.map((entry) {
                  final isMine = myReactions[entry.key] == true;
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

  // ⭐ V3-4: 3-state read receipt (✓ sent, ✓✓ gray delivered, ✓✓ blue read)
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
          ],
        ),
      ),
    );
  }

  void _showReactionPicker(Message msg) {
    final emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: emojis.map((emoji) {
              return GestureDetector(
                onTap: () {
                  Navigator.pop(context);
                  _sendReaction(msg, emoji);
                },
                child: Text(emoji, style: const TextStyle(fontSize: 32)),
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

  // ⭐ V2: Attachment menu (image gallery, camera, document)
  void _showAttachmentMenu() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library, color: Color(0xFF0958D9)),
              title: const Text('Galerie photo'),
              onTap: () { Navigator.pop(context); _sendImage(ImageSource.gallery); },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt, color: Color(0xFF0958D9)),
              title: const Text('Appareil photo'),
              onTap: () { Navigator.pop(context); _sendImage(ImageSource.camera); },
            ),
            ListTile(
              leading: const Icon(Icons.attach_file, color: Color(0xFF0958D9)),
              title: const Text('Document'),
              onTap: () { Navigator.pop(context); _sendDocument(); },
            ),
          ],
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
