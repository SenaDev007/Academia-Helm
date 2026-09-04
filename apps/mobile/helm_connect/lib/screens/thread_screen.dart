// ============================================================================
// HELM CONNECT — Thread Screen (fil de discussion) ⭐ V8
// ============================================================================
// Vue plein écran d'un fil de discussion (parité web V5 « Threads ») :
//   - Message parent en tête (bulle mise en évidence)
//   - Toutes les réponses (messages avec replyToId = parent) en dessous
//   - Composer dédié → envoi avec replyToId = parent (optimiste + file
//     offline + E2EE, mêmes règles que l'écran de conversation)
//   - Tem réel : socket message:new chaîné (le handler de l'écran parent
//     continue de fonctionner pendant que le fil est ouvert)
//   - Compteur de réponses à jour, badge « N réponses » côté écran parent
//
// Le backend stocke replyToId depuis la V5 — aucune modification serveur.
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/models.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../services/chat_local_storage.dart';
import '../services/e2ee_service.dart';
import '../theme/helm_theme.dart';
import 'conversation_detail_screen.dart' show kUserBubbleColors, kUserTextColors, hashUserId;

class ThreadScreen extends StatefulWidget {
  final Conversation conversation;
  final Message parentMessage;
  final String currentUserId;

  const ThreadScreen({
    super.key,
    required this.conversation,
    required this.parentMessage,
    required this.currentUserId,
  });

  @override
  State<ThreadScreen> createState() => _ThreadScreenState();
}

class _ThreadScreenState extends State<ThreadScreen> {
  final _threadController = TextEditingController();
  final _scrollController = ScrollController();
  final SocketService _socket = SocketService();

  List<Message> _replies = [];
  bool _loading = true;
  bool _sending = false;

  // ⭐ E2EE (DIRECT uniquement, parité web)
  bool _e2eAvailable = false;
  String? _otherUserId;
  // Contenus déchiffrés (id → texte clair) — pass async après chargement
  final Map<String, String> _decryptedContents = {};
  // Copies en clair de MES messages chiffrés (repli d'affichage, miroir web)
  final Map<String, String> _ownPlaintextCopies = {};

  // Sauvegarde du handler socket de l'écran parent (chaînage, pas écrasement)
  void Function(Map<String, dynamic> message)? _prevOnNewMessage;

  @override
  void initState() {
    super.initState();
    _initSocket();
    _loadThread();
    _initE2ee();
  }

  @override
  void dispose() {
    _socket.onNewMessage = _prevOnNewMessage; // restaure le handler parent
    _threadController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  // ─── Socket : chaînage du handler parent ───────────────────────────

  void _initSocket() async {
    final token = await ApiService.getAuthToken();
    final userId = await AuthService.getUserId();
    if (token == null || userId == null) return;
    await _socket.connect(token: token, userId: userId);

    _prevOnNewMessage = _socket.onNewMessage;
    _socket.onNewMessage = (data) {
      // L'écran parent continue de vivre (rafraîchit sa liste sous le fil)
      _prevOnNewMessage?.call(data);
      // Le fil se met à jour si le message concerne SA conversation
      if (data['conversationId'] == widget.conversation.id) {
        _refreshFromSocket(data);
      }
    };
  }

  void _refreshFromSocket(Map<String, dynamic> data) {
    if (!mounted) return;
    final msg = data['message'];
    if (msg is Map<String, dynamic>) {
      final replyToId = msg['replyToId'] as String?;
      if (replyToId == widget.parentMessage.id) {
        // Nouvelle réponse dans CE fil → rafraîchissement ciblé
        _loadThread(keepPosition: true);
        return;
      }
    }
    // Autre message de la conversation → compteur du parent inchangé,
    // mais on recharge quand même (une réponse peut être éditée/supprimée)
    _loadThread(keepPosition: true);
  }

  // ─── E2EE ──────────────────────────────────────────────────────────

  Future<void> _initE2ee() async {
    try {
      final userId = await AuthService.getUserId();
      if (userId != null && userId.isNotEmpty) {
        await E2eeService.ensureKeyPair(userId: userId);
      }
      if (widget.conversation.type == 'DIRECT') {
        final others = widget.conversation.participants
            .where((p) => p.userId != widget.currentUserId)
            .toList();
        if (others.isNotEmpty) {
          _otherUserId = others.first.userId;
          final ok = await E2eeService.isDirectE2eeAvailable(others.first.userId);
          if (mounted) setState(() => _e2eAvailable = ok);
        }
      }
    } catch (_) {
      // silencieux — E2E optionnel
    }
  }

  // ─── Chargement des réponses ───────────────────────────────────────

  /// Toutes les réponses du fil = messages de la conversation avec
  /// replyToId == parent.id (même logique que le web : threadReplies).
  Future<void> _loadThread({bool keepPosition = false}) async {
    try {
      final json = await ApiService.listMessages(widget.conversation.id);
      if (!mounted) return;
      final userId = widget.currentUserId;
      final all = json.map((m) => Message.fromJson(m, userId)).toList();
      final replies = all
          .where((m) =>
              m.replyToId == widget.parentMessage.id &&
              !m.isDeleted &&
              m.type != 'SYSTEM')
          .toList();

      // Préserve les copies en clair de mes messages chiffrés (cache local)
      try {
        final cached = await ChatLocalStorage.getMessages(widget.conversation.id);
        for (final c in cached) {
          if (c.senderId == userId &&
              c.content.isNotEmpty &&
              !E2eeService.isEncrypted(c.content)) {
            _ownPlaintextCopies[c.id] = c.content;
          }
        }
      } catch (_) {/* cache optionnel */}

      setState(() {
        _replies = replies;
        _loading = false;
      });
      if (!keepPosition) _scrollToBottom();
      // ⭐ Pass de déchiffrement asynchrone (miroir de l'effet web)
      _decryptPendingMessages(replies);
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur : $e'), duration: const Duration(seconds: 2)),
        );
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // ─── Envoi d'une réponse dans le fil ───────────────────────────────

  Future<void> _sendThreadReply() async {
    final raw = _threadController.text.trim();
    if (raw.isEmpty || _sending) return;
    setState(() => _sending = true);
    _threadController.clear();

    final userId = widget.currentUserId;
    final now = DateTime.now().toIso8601String();
    final localId = ChatLocalStorage.generateLocalId();

    // Copie locale optimiste en CLAIR (miroir web) + file offline
    final localMsg = OfflineMessage(
      id: localId,
      conversationId: widget.conversation.id,
      senderId: userId,
      type: 'TEXT',
      content: raw,
      replyToId: widget.parentMessage.id,
      createdAt: now,
      status: 'pending',
    );
    await ChatLocalStorage.appendMessage(localMsg);
    await ChatLocalStorage.addPendingMessage(PendingMessage(
      localId: localId,
      conversationId: widget.conversation.id,
      senderId: userId,
      content: raw,
      replyToId: widget.parentMessage.id,
      queuedAt: now,
      attempts: 0,
    ));
    _ownPlaintextCopies[localId] = raw;

    if (mounted) {
      setState(() {
        _replies = [
          ..._replies,
          Message.fromJson({
            'id': localId,
            'conversationId': widget.conversation.id,
            'senderId': userId,
            'type': 'TEXT',
            'content': raw,
            'replyToId': widget.parentMessage.id,
            'replyToSenderName': widget.parentMessage.senderName,
            'replyToContent': stripHtml(widget.parentMessage.content),
            'createdAt': now,
            'status': 'pending',
          }, userId),
        ];
      });
      _scrollToBottom();
    }

    try {
      // ⭐ E2EE (DIRECT, < 400 car.) — même politique que l'écran parent
      String contentToSend = raw;
      if (_e2eAvailable && _otherUserId != null && raw.length < 400) {
        final encrypted = await E2eeService.encryptFor(_otherUserId!, raw);
        if (encrypted != null) contentToSend = encrypted;
      }
      await ApiService.sendTextMessage(
        conversationId: widget.conversation.id,
        content: contentToSend,
        replyToId: widget.parentMessage.id,
      );
      await ChatLocalStorage.removePendingMessage(localId);
      await _loadThread(keepPosition: false);
    } catch (e) {
      await ChatLocalStorage.incrementPendingAttempts(localId, e.toString());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Réponse en attente — sera renvoyée à la reconnexion'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  // ─── Contenu affiché (E2EE + replis) ───────────────────────────────

  /// Déchiffre en tâche de fond les contenus « E2E: » non encore déchiffrés
  /// (y compris le message parent) puis met à jour l'affichage.
  Future<void> _decryptPendingMessages(List<Message> messages) async {
    final targets = [
      widget.parentMessage,
      ...messages,
    ].where((m) => E2eeService.isEncrypted(m.content) && !_decryptedContents.containsKey(m.id));
    if (targets.isEmpty) return;
    var changed = false;
    for (final m in targets) {
      final content = m.content!;
      if (m.senderId == widget.currentUserId) {
        // Mes propres messages : repli sur la copie locale en clair
        final own = _ownPlaintextCopies[m.id];
        if (own != null && !E2eeService.isEncrypted(own)) {
          _decryptedContents[m.id] = own;
          changed = true;
        }
        continue; // sinon : indéchiffrable par moi (chiffré POUR le destinataire)
      }
      final plain = await E2eeService.decryptContent(content);
      if (plain != null) {
        _decryptedContents[m.id] = plain;
        changed = true;
      }
    }
    if (changed && mounted) setState(() {});
  }

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

  String _formatTime(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  // ═════════════════════════════════════════════════════════════════
  // UI
  // ═════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: const BoxDecoration(gradient: HelmGradients.royalBlue),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.forum, color: Colors.white, size: 14),
                SizedBox(width: 6),
                Text('Fil de discussion', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            Text(
              '${_replies.length} réponse${_replies.length > 1 ? 's' : ''}',
              style: TextStyle(
                fontSize: 11,
                color: _e2eAvailable ? HelmColors.goldLight : HelmColors.goldLight.withOpacity(0.65),
              ),
            ),
          ],
        ),
        actions: [
          // ⭐ Cadenas E2E (DIRECT + clés publiées des deux côtés)
          if (_e2eAvailable)
            const Padding(
              padding: EdgeInsets.only(right: 12),
              child: Icon(Icons.lock, color: HelmColors.goldLight, size: 16),
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: HelmColors.primary))
                : Container(
                    color: const Color(0xFFF5F7FA),
                    child: ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(16),
                      itemCount: _replies.length + 2, // parent + séparateur + réponses
                      itemBuilder: (context, index) {
                        if (index == 0) return _buildParentBubble();
                        if (index == 1) return _buildRepliesSeparator();
                        final reply = _replies[index - 2];
                        return _buildReplyBubble(reply);
                      },
                    ),
                  ),
          ),
          _buildThreadComposer(),
        ],
      ),
    );
  }

  /// Message parent — bulle mise en évidence (fond bleu pâle + bord doré).
  Widget _buildParentBubble() {
    final parent = widget.parentMessage;
    final isOwn = parent.senderId == widget.currentUserId;
    final (bg, border) = _bubbleColorsFor(parent, isOwn);
    return Align(
      alignment: isOwn ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: border, width: 1.2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.attach_file, size: 11, color: HelmColors.primary.withOpacity(0.6)),
                const SizedBox(width: 4),
                Text(
                  'Message d\'origine',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: HelmColors.primary.withOpacity(0.8)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            if (!isOwn && widget.conversation.type == 'GROUP')
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  parent.senderName,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: widget.conversation.type == 'GROUP' ? kUserTextColors[hashUserId(parent.senderId)] : const Color(0xFF0958D9),
                  ),
                ),
              ),
            if (parent.isAttachment && (parent.attachmentName ?? '').isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(_attachmentIcon(parent.type), size: 16, color: const Color(0xFF0958D9)),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        parent.attachmentName ?? 'Pièce jointe',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: Color(0xFF0958D9), fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
            Text(
              _displayContent(parent),
              style: const TextStyle(fontSize: 14, color: Color(0xFF172033)),
            ),
            const SizedBox(height: 4),
            Text(
              _formatTime(parent.createdAt),
              style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRepliesSeparator() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          const Expanded(child: Divider(color: Color(0xFFE2E8F0), thickness: 1)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Text(
              _replies.isEmpty ? 'Aucune réponse pour l\'instant' : 'Réponses',
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontStyle: FontStyle.italic),
            ),
          ),
          const Expanded(child: Divider(color: Color(0xFFE2E8F0), thickness: 1)),
        ],
      ),
    );
  }

  /// Bulle d'une réponse du fil (couleur par expéditeur comme la conversation).
  Widget _buildReplyBubble(Message msg) {
    final isOwn = msg.senderId == widget.currentUserId;
    final (bg, border) = _bubbleColorsFor(msg, isOwn);
    final senderColor = !isOwn && widget.conversation.type == 'GROUP'
        ? kUserTextColors[hashUserId(msg.senderId)]
        : const Color(0xFF0958D9);

    // Réactions groupées
    final Map<String, int> reactionCounts = {};
    for (final r in msg.reactions) {
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
    }

    return Align(
      alignment: isOwn ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: () => _showReplyActions(msg),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 3),
          padding: const EdgeInsets.all(12),
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: isOwn ? const Radius.circular(16) : const Radius.circular(4),
              bottomRight: isOwn ? const Radius.circular(4) : const Radius.circular(16),
            ),
            border: Border.all(color: border, width: isOwn ? 0.5 : 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!isOwn && widget.conversation.type == 'GROUP')
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    msg.senderName,
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: senderColor),
                  ),
                ),
              if (msg.isAttachment && (msg.attachmentName ?? '').isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(_attachmentIcon(msg.type), size: 16, color: const Color(0xFF0958D9)),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          msg.attachmentName ?? 'Pièce jointe',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, color: Color(0xFF0958D9), fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ),
                ),
              if (_displayContent(msg).isNotEmpty)
                Text(_displayContent(msg), style: const TextStyle(fontSize: 14, color: Color(0xFF172033))),
              if (reactionCounts.isNotEmpty) ...[
                const SizedBox(height: 4),
                Wrap(
                  spacing: 4,
                  children: reactionCounts.entries
                      .map((e) => Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text('${e.key} ${e.value}', style: const TextStyle(fontSize: 12)),
                          ))
                      .toList(),
                ),
              ],
              const SizedBox(height: 4),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (msg.status == 'pending') ...[
                    const Icon(Icons.access_time, size: 11, color: Color(0xFF94A3B8)),
                    const SizedBox(width: 3),
                  ],
                  Text(_formatTime(msg.createdAt), style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  (Color, Color) _bubbleColorsFor(Message msg, bool isOwn) {
    if (isOwn) return (const Color(0xFFE6F4FF), const Color(0xFFBAE0FF));
    if (widget.conversation.type == 'GROUP') {
      return kUserBubbleColors[hashUserId(msg.senderId)];
    }
    return (Colors.white, const Color(0xFFE2E8F0));
  }

  IconData _attachmentIcon(String type) {
    switch (type) {
      case 'IMAGE':
        return Icons.image;
      case 'AUDIO':
        return Icons.mic;
      case 'VIDEO':
        return Icons.videocam;
      default:
        return Icons.insert_drive_file;
    }
  }

  // ─── Actions sur une réponse ───────────────────────────────────────

  void _showReplyActions(Message msg) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.copy, color: Color(0xFF64748B)),
              title: const Text('Copier'),
              onTap: () {
                Navigator.pop(context);
                final text = _displayContent(msg);
                if (text.isNotEmpty) {
                  Clipboard.setData(ClipboardData(text: text)).then((_) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Message copié'), duration: Duration(seconds: 1)),
                      );
                    }
                  });
                }
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
            if (msg.isOwn)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text('Supprimer pour tous'),
                onTap: () {
                  Navigator.pop(context);
                  _deleteReply(msg);
                },
              ),
          ],
        ),
      ),
    );
  }

  void _showReactionPicker(Message msg) {
    final reactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
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
            boxShadow: const [
              BoxShadow(color: Color(0x26000000), blurRadius: 20, spreadRadius: 2),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: reactions
                .map((emoji) => GestureDetector(
                      onTap: () {
                        Navigator.pop(context);
                        _sendReaction(msg, emoji);
                      },
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFF1F5F9)),
                        child: Center(child: Text(emoji, style: const TextStyle(fontSize: 28))),
                      ),
                    ))
                .toList(),
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
        _loadThread(keepPosition: true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec : $e')));
      }
    }
  }

  void _deleteReply(Message msg) async {
    try {
      await ApiService.deleteMessageForEveryone(
        conversationId: widget.conversation.id,
        messageId: msg.id,
      );
      if (mounted) _loadThread(keepPosition: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec : $e')));
      }
    }
  }

  // ─── Composer du fil ───────────────────────────────────────────────

  Widget _buildThreadComposer() {
    return Container(
      padding: EdgeInsets.only(
        left: 12,
        right: 8,
        top: 8,
        bottom: MediaQuery.of(context).padding.bottom + 8,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _threadController,
              textInputAction: TextInputAction.newline,
              minLines: 1,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: _e2eAvailable ? 'Répondre dans le fil (chiffré)...' : 'Répondre dans le fil...',
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
              onSubmitted: (_) => _sendThreadReply(),
            ),
          ),
          const SizedBox(width: 8),
          HelmSendButton(
            onPressed: _sendThreadReply,
            disabled: _sending,
            isLoading: _sending,
          ),
        ],
      ),
    );
  }
}
