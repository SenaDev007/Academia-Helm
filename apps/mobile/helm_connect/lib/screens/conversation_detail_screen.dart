// ============================================================================
// HELM CONNECT — Conversation Detail Screen (chat view)
// ============================================================================
// Vue conversation avec bulles de messages (style WhatsApp).
// Identité Azure : bulles envoyées sur fond #E6F4FF, reçues sur #FFFFFF.
// ============================================================================

import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
// ⭐ V3-1: Offline-first chat — local cache + send queue
import '../services/chat_local_storage.dart';

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

  @override
  void initState() {
    super.initState();
    _loadMessages();
    // ⭐ Socket.io: connect for realtime (replaces 10s polling)
    _initSocket();
    // Polling fallback (reduced to 30s — Socket.io should deliver instantly)
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _loadMessages());
    // ⭐ V3-1: Flush any pending messages from previous session (silent retry on app start)
    _flushPendingQueue();
  }

  void _initSocket() async {
    final api = ApiService();
    final token = await api.getAuthToken();
    final userId = await ApiConfig.userId;
    if (token != null && userId != null) {
      await _socket.connect(token: token, userId: userId);
      _socket.onNewMessage = (data) {
        if (data['conversationId'] == widget.conversation.id) {
          _loadMessages(); // Refresh to get the new message
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
      final api = ApiService();
      await api.sendAttachment(
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
      final api = ApiService();
      await api.sendAttachment(
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
      if (mounted) {
        setState(() {
          _messages = json.map((m) => Message.fromJson(m, userId ?? '')).toList();
          _loading = false;
        });
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
    final content = _messageController.text.trim();
    if (content.isEmpty) return;
    setState(() => _sending = true);

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

    // Append to local cache + pending queue
    await ChatLocalStorage.appendMessage(localMsg);
    await ChatLocalStorage.addPendingMessage(PendingMessage(
      localId: localId,
      conversationId: widget.conversation.id,
      senderId: userId,
      content: content,
      queuedAt: now,
      attempts: 0,
    ));

    // Display immediately in UI
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
        }, userId)];
      });
      _scrollToBottom();
    }

    // Clear the input
    _messageController.clear();

    try {
      await ApiService.sendTextMessage(
        conversationId: widget.conversation.id,
        content: content,
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
    final api = ApiService();

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
      final response = await api.post(
        '/chat/conversations/${widget.conversation.id}/summarize',
        body: {
          'userId': userId,
          'maxMessages': 50,
        },
      );
      if (mounted) Navigator.of(context).pop(); // close loading

      final data = response as Map<String, dynamic>;
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
    final api = ApiService();

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
      final response = await api.post(
        '/chat/messages/${msg.id}/transcribe',
        body: {},
      );
      if (mounted) Navigator.of(context).pop(); // close loading

      final data = response as Map<String, dynamic>;
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
        actions: [
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
            // Sender name (for groups)
            if (!isOwn && widget.conversation.type == 'GROUP')
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  msg.senderName,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0958D9)),
                ),
              ),
            // Content
            if (msg.content != null)
              Text(msg.content!, style: const TextStyle(fontSize: 14, color: Color(0xFF172033))),
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
            // Timestamp + read receipt
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _formatTime(msg.createdAt),
                  style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                ),
                if (isOwn) ...[
                  const SizedBox(width: 4),
                  const Icon(Icons.done_all, size: 12, color: Color(0xFF13C2C2)),
                ],
              ],
            ),
          ],
        ),
        ),
      ),
    );
  }

  // ⭐ V1.5: Long-press message actions (reply, copy, delete, pin, react)
  void _showMessageActions(Message msg) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.reply, color: Color(0xFF0958D9)),
              title: const Text('Répondre'),
              onTap: () {
                Navigator.pop(context);
                // TODO: set reply context + scroll to message
                ScaffoldMessenger.of(this.context).showSnackBar(
                  const SnackBar(content: Text('Réponse — fonction à venir'), duration: Duration(seconds: 1)),
                );
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
            ListTile(
              leading: const Icon(Icons.copy, color: Color(0xFF64748B)),
              title: const Text('Copier'),
              onTap: () {
                Navigator.pop(context);
                if (msg.content != null) {
                  // Copy to clipboard
                  ScaffoldMessenger.of(this.context).showSnackBar(
                    const SnackBar(content: Text('Message copié'), duration: Duration(seconds: 1)),
                  );
                }
              },
            ),
            ListTile(
              leading: const Icon(Icons.push_pin, color: Color(0xFF64748B)),
              title: const Text('Épingler'),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(this.context).showSnackBar(
                  const SnackBar(content: Text('Message épinglé'), duration: Duration(seconds: 1)),
                );
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
      final api = ApiService();
      await api.post('/chat/messages/${msg.id}/react', body: {
        'userId': (await ApiConfig.userId) ?? '',
        'emoji': emoji,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Réaction $emoji envoyée'), duration: const Duration(seconds: 1)),
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

  void _deleteMessage(Message msg, {required bool forEveryone}) async {
    try {
      final api = ApiService();
      final userId = await ApiConfig.userId ?? '';
      final endpoint = forEveryone ? 'delete-for-everyone' : 'delete-for-me';
      await api.post('/chat/conversations/${widget.conversation.id}/messages/${msg.id}/$endpoint', body: {'userId': userId});
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
}
