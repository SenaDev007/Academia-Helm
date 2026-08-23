// ============================================================================
// HELM CONNECT — Conversation Detail Screen (chat view)
// ============================================================================
// Vue conversation avec bulles de messages (style WhatsApp).
// Identité Azure : bulles envoyées sur fond #E6F4FF, reçues sur #FFFFFF.
// ============================================================================

import 'dart:async';
import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/api_service.dart';

class ConversationDetailScreen extends StatefulWidget {
  final Conversation conversation;

  const ConversationDetailScreen({super.key, required this.conversation});

  @override
  State<ConversationDetailScreen> createState() => _ConversationDetailScreenState();
}

class _ConversationDetailScreenState extends State<ConversationDetailScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  List<Message> _messages = [];
  bool _loading = true;
  bool _sending = false;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _loadMessages();
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) => _loadMessages());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
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
                  onPressed: () {
                    // V2: open attachment menu (image, document, audio)
                  },
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
    );
  }

  String _getInitials(String name) {
    final parts = name.split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    if (parts.isNotEmpty) return parts[0][0].toUpperCase();
    return '?';
  }
}
