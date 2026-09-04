// ============================================================================
// HELM CONNECT — New Chat Screen (V7 — parité web/Yeshua)
// ============================================================================
// « Nouvelle discussion » : recherche des membres de l'école par NOM, EMAIL
// ou TÉLÉPHONE (search-users fusionne users + guardians, normalisation serveur
// V6.1), démarrage de conversation directe, conversation parent sans compte
// (guardian-direct, compte auto-provisionné) et invitations inter-écoles
// (envoi + liste des invitations reçues avec Accepter/Refuser → débloque la
// discussion privée à l'acceptation).
// ============================================================================

import 'dart:async';
import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/helm_theme.dart';
import 'conversation_detail_screen.dart';

class NewChatScreen extends StatefulWidget {
  const NewChatScreen({super.key});

  @override
  State<NewChatScreen> createState() => _NewChatScreenState();
}

class _NewChatScreenState extends State<NewChatScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  List<Map<String, dynamic>> _results = [];
  bool _searching = false;
  bool _searched = false;
  // Invitations reçues en attente
  List<Map<String, dynamic>> _invitations = [];
  bool _loadingInvitations = true;

  @override
  void initState() {
    super.initState();
    _loadInvitations();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadInvitations() async {
    try {
      final invitations = await ApiService.getPendingInvitations();
      if (mounted) {
        setState(() {
          _invitations = invitations;
          _loadingInvitations = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingInvitations = false);
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    if (value.trim().length < 2) {
      setState(() {
        _results = [];
        _searched = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () => _search(value.trim()));
  }

  Future<void> _search(String query) async {
    setState(() => _searching = true);
    try {
      final results = await ApiService.searchUsers(query);
      if (mounted) {
        setState(() {
          _results = results;
          _searching = false;
          _searched = true;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _searching = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    }
  }

  // ⭐ V7 — démarrer la discussion selon le profil trouvé :
  //    - user du même tenant → conversation directe
  //    - parent SANS compte (source=guardians, userId null) → guardian-direct
  //    - membre d'une AUTRE école → invitation (déblocage à l'acceptation)
  Future<void> _openConversationWith(Map<String, dynamic> person) async {
    final userId = person['userId'] as String?;
    final guardianId = person['guardianId'] as String?;
    final isSameTenant = person['isSameTenant'] == true;
    final canDirect = person['canStartDirectConversation'] == true;
    final name = '${person['firstName'] ?? ''} ${person['lastName'] ?? ''}'.trim();

    try {
      if (userId != null && userId.isNotEmpty && isSameTenant && canDirect) {
        final data = await ApiService.createDirectConversation(userId);
        _pushConversation((data['conversation'] ?? data) as Map<String, dynamic>);
        return;
      }
      if ((userId == null || userId.isEmpty) && guardianId != null && guardianId.isNotEmpty) {
        // Parent sans compte → auto-provisionné côté serveur
        final data = await ApiService.createGuardianDirectConversation(guardianId);
        _pushConversation((data['conversation'] ?? data) as Map<String, dynamic>);
        return;
      }
      // Autre école (ou contact restreint) → invitation
      await ApiService.sendInvitation(
        recipientId: userId,
        recipientEmail: person['email'] as String?,
        recipientName: name,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Invitation envoyée à $name — la discussion s\'ouvrira à son acceptation')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Impossible de démarrer : $e')));
      }
    }
  }

  void _pushConversation(Map<String, dynamic> convJson) {
    if (!mounted) return;
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ConversationDetailScreen(conversation: Conversation.fromJson(convJson))),
    );
  }

  // ⭐ V7 — accepter une invitation : crée la conversation DIRECT (débloque le tchat)
  Future<void> _acceptInvitation(Map<String, dynamic> invitation) async {
    try {
      final data = await ApiService.acceptInvitation(invitation['id'] as String);
      await _loadInvitations();
      final conv = (data['conversation'] ?? data) as Map<String, dynamic>?;
      if (conv != null && conv.containsKey('id')) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Invitation acceptée — discussion débloquée')),
          );
        }
        _pushConversation(conv);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec : $e')));
      }
    }
  }

  Future<void> _declineInvitation(Map<String, dynamic> invitation) async {
    try {
      await ApiService.declineInvitation(invitation['id'] as String);
      await _loadInvitations();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec : $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: const BoxDecoration(gradient: HelmGradients.royalBlue),
        ),
        title: const Text('Nouvelle discussion', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          // ─── Barre de recherche ───
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: TextField(
              controller: _searchController,
              autofocus: true,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Nom, email ou téléphone…',
                prefixIcon: const Icon(Icons.search, color: HelmColors.primary),
                suffixIcon: _searching
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: HelmColors.primary)),
                      )
                    : (_searchController.text.isNotEmpty
                        ? IconButton(icon: const Icon(Icons.clear), onPressed: () {
                            _searchController.clear();
                            setState(() {
                              _results = [];
                              _searched = false;
                            });
                          })
                        : null),
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
            ),
          ),
          // ─── Invitations reçues ───
          if (!_loadingInvitations && _invitations.isNotEmpty)
            Container(
              color: const Color(0xFFFFFBEB),
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        const Icon(Icons.mail_outline, size: 14, color: Color(0xFFD97706)),
                        const SizedBox(width: 6),
                        Text(
                          'Invitations reçues (${_invitations.length})',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFD97706)),
                        ),
                      ],
                    ),
                  ),
                  ..._invitations.take(5).map((inv) {
                    final sender = '${inv['senderFirstName'] ?? ''} ${inv['senderLastName'] ?? ''}'.trim();
                    final tenant = inv['senderTenantName'] as String? ?? '';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(sender.isEmpty ? 'Invitation' : sender, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                if (tenant.isNotEmpty)
                                  Text('École : $tenant', style: const TextStyle(fontSize: 10, color: Color(0xFF92400E))),
                              ],
                            ),
                          ),
                          TextButton(
                            onPressed: () => _acceptInvitation(inv),
                            style: TextButton.styleFrom(
                              backgroundColor: const Color(0xFF10B981),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                            ),
                            child: const Text('Accepter', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                          ),
                          const SizedBox(width: 6),
                          TextButton(
                            onPressed: () => _declineInvitation(inv),
                            style: TextButton.styleFrom(
                              backgroundColor: Colors.grey[200],
                              foregroundColor: Colors.grey[700],
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                            ),
                            child: const Text('Refuser', style: TextStyle(fontSize: 11)),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          // ─── Résultats ───
          Expanded(
            child: _results.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(_searched && !_searching ? Icons.person_search : Icons.search, size: 48, color: Colors.grey[300]),
                        const SizedBox(height: 12),
                        Text(
                          _searched && !_searching ? 'Aucun membre trouvé' : 'Recherchez un membre de l\'école\n(nom, email ou téléphone)',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 13, color: Colors.grey[500]),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(8),
                    itemCount: _results.length,
                    itemBuilder: (context, index) {
                      final person = _results[index];
                      final name = '${person['firstName'] ?? ''} ${person['lastName'] ?? ''}'.trim();
                      final roleLabel = person['roleLabel'] as String? ?? '';
                      final phone = person['phone'] as String?;
                      final isSameTenant = person['isSameTenant'] == true;
                      final isGuardian = person['source'] == 'guardians';
                      final children = (person['childrenNames'] as List<dynamic>?) ?? [];
                      final hasAccount = (person['userId'] as String?)?.isNotEmpty == true;
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: isSameTenant ? kUserTextColors[hashUserId((person['userId'] ?? person['guardianId'] ?? '?').toString()) % kUserTextColors.length] : const Color(0xFF94A3B8),
                          child: Text(
                            name.isNotEmpty ? name[0].toUpperCase() : '?',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                        ),
                        title: Text(name.isEmpty ? 'Membre' : name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (roleLabel.isNotEmpty)
                              Text(roleLabel, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                            if (children.isNotEmpty)
                              Text(
                                'Parent de ${children.join(', ')}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 11, color: Color(0xFF059669)),
                              ),
                            if (phone != null && phone.isNotEmpty)
                              Text(phone, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                          ],
                        ),
                        trailing: _trailingFor(person, isSameTenant, isGuardian, hasAccount),
                        onTap: () => _openConversationWith(person),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget? _trailingFor(Map<String, dynamic> person, bool isSameTenant, bool isGuardian, bool hasAccount) {
    if (!isSameTenant) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF3C7),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Text('Inviter', style: TextStyle(fontSize: 10, color: Color(0xFFD97706), fontWeight: FontWeight.w600)),
      );
    }
    if (isGuardian && !hasAccount) {
      return const Icon(Icons.chat_bubble_outline, color: Color(0xFF10B981), size: 20);
    }
    return const Icon(Icons.chat_bubble_outline, color: HelmColors.primary, size: 20);
  }
}
