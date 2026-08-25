// ============================================================================
// HELM CONNECT — Main Chat Screen
// ============================================================================
// Écran principal après connexion. Affiche :
//   - Header avec "Helm Connect" + slogan + indicateur de connexion Socket.io
//   - Liste des conversations (DIRECT + GROUP)
//   - FAB "+" pour nouvelle conversation
//
// ⭐ L'utilisateur peut être :
//   - Enseignant → voit les collègues + parents d'élèves de son école
//   - Parent → voit les enseignants de ses enfants + annonces
//   - Promoteur/Directeur → voit tous les utilisateurs de son tenant
// ============================================================================

import 'dart:async';
import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import 'conversation_detail_screen.dart';
import 'announcements_screen.dart';
import 'notification_prefs_screen.dart';
import 'global_search_screen.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  List<Conversation> _conversations = [];
  bool _loading = true;
  String? _error;
  Timer? _refreshTimer;
  User? _currentUser;

  @override
  void initState() {
    super.initState();
    _loadCurrentUser();
    _loadConversations();
    // Polling fallback (Socket.io real-time will be added in V2)
    _refreshTimer = Timer.periodic(const Duration(seconds: 15), (_) => _loadConversations());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadCurrentUser() async {
    try {
      final userJson = await ApiService.getCurrentUser();
      setState(() {
        _currentUser = User.fromJson(userJson['user'] as Map<String, dynamic>);
      });
    } catch (e) {
      // ignore — user might not be loaded yet
    }
  }

  Future<void> _loadConversations() async {
    try {
      final json = await ApiService.listConversations();
      setState(() {
        _conversations = json.map((c) => Conversation.fromJson(c)).toList();
        _loading = false;
        _error = null;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  String _formatTimestamp(DateTime? dt) {
    if (dt == null) return '';
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'maintenant';
    if (diff.inHours < 1) return 'il y a ${diff.inMinutes}min';
    if (diff.inDays < 1) return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    if (diff.inDays < 7) return 'il y a ${diff.inDays}j';
    return '${dt.day}/${dt.month}';
  }

  Future<void> _logout() async {
    await ApiService.logout();
    if (mounted) {
      // Navigate back to tenant selection (clear entire stack)
      Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF0958D9), Color(0xFF1677FF)],
            ),
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Helm Connect',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            Text(
              _currentUser?.tenantName ?? 'Academia Helm',
              style: const TextStyle(fontSize: 11, color: Color(0xFFBAE0FF)),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, color: Colors.white),
            tooltip: 'Recherche globale',
            onPressed: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const GlobalSearchScreen()));
            },
          ),
          IconButton(
            icon: const Icon(Icons.campaign_outlined, color: Colors.white),
            tooltip: 'Annonces',
            onPressed: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AnnouncementsScreen()));
            },
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: Colors.white),
            onSelected: (value) {
              switch (value) {
                case 'notifications':
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationPrefsScreen()));
                  break;
                case 'logout':
                  _logout();
                  break;
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'notifications', child: ListTile(leading: Icon(Icons.notifications), title: Text('Notifications'))),
              const PopupMenuItem(value: 'logout', child: ListTile(leading: Icon(Icons.logout), title: Text('Déconnexion'))),
            ],
          ),
        ],
      ),
      // Slogan subtitle
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
            color: const Color(0xFFE6F4FF),
            child: const Text(
              'Communiquez. Collaborez. Restez connectés.',
              style: TextStyle(
                fontSize: 11,
                fontStyle: FontStyle.italic,
                color: Color(0xFF0958D9),
              ),
              textAlign: TextAlign.center,
            ),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // V2: open new conversation modal
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Nouvelle conversation — à implémenter (V2)')),
          );
        },
        child: const Icon(Icons.chat),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off, size: 48, color: Color(0xFFDC2626)),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _loadConversations, child: const Text('Réessayer')),
          ],
        ),
      );
    }
    if (_conversations.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.chat_bubble_outline, size: 64, color: Color(0xFF94A3B8)),
            const SizedBox(height: 16),
            const Text('Aucune conversation', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text(
              'Touchez le bouton + pour démarrer une nouvelle conversation.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF667085)),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadConversations,
      child: ListView.builder(
        itemCount: _conversations.length,
        itemBuilder: (context, index) {
          final conv = _conversations[index];
          return _buildConversationTile(conv);
        },
      ),
    );
  }

  Widget _buildConversationTile(Conversation conv) {
    final otherParticipant = conv.participants.where((p) => p.userId != _currentUser?.id).toList();
    final displayName = conv.type == 'GROUP'
        ? (conv.name ?? 'Groupe')
        : (otherParticipant.isNotEmpty
            ? otherParticipant.first.fullName
            : 'Conversation');
    final initials = conv.type == 'GROUP'
        ? '👥'
        : (otherParticipant.isNotEmpty ? _getInitials(otherParticipant.first.fullName) : '?');

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: const Color(0xFFE6F4FF),
        child: conv.type == 'GROUP'
            ? const Icon(Icons.group, color: Color(0xFF0958D9))
            : Text(
                initials,
                style: const TextStyle(color: Color(0xFF0958D9), fontWeight: FontWeight.bold),
              ),
      ),
      title: Row(
        children: [
          Expanded(
            child: Text(
              displayName,
              style: const TextStyle(fontWeight: FontWeight.w600),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (conv.unreadCount > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFF1677FF),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '${conv.unreadCount}',
                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ),
        ],
      ),
      subtitle: Row(
        children: [
          if (conv.isMuted) ...[
            const Icon(Icons.volume_off, size: 14, color: Color(0xFF94A3B8)),
            const SizedBox(width: 4),
          ],
          Expanded(
            child: Text(
              conv.lastMessagePreview ?? 'Aucun message',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: conv.unreadCount > 0 ? const Color(0xFF172033) : const Color(0xFF667085),
                fontWeight: conv.unreadCount > 0 ? FontWeight.w500 : FontWeight.normal,
              ),
            ),
          ),
          if (conv.lastMessageAt != null)
            Text(_formatTimestamp(conv.lastMessageAt), style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
        ],
      ),
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ConversationDetailScreen(conversation: conv),
          ),
        ).then((_) => _loadConversations());
      },
    );
  }

  String _getInitials(String name) {
    final parts = name.split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    if (parts.isNotEmpty) return parts[0][0].toUpperCase();
    return '?';
  }
}
