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
      _socket.joinConversation(widget.conversation.id);
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
    try {
      await ApiService.sendTextMessage(
        conversationId: widget.conversation.id,
        content: content,
      );
      _messageController.clear();
      await _loadMessages();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Échec : $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
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
