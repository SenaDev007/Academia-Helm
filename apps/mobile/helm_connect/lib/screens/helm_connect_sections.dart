// ============================================================================
// HELM CONNECT — Section screens (V3-11)
// ============================================================================
// 7 sections (placeholders replaced by real backend-connected screens):
//   1. Communautés — auto-groups (CLASS / SUBJECT / ROLE / STAFF) per academic year
//   2. Canaux — broadcast channels (type=GROUP with isChannel=true)
//   3. Fichiers — shared files (messages with attachmentUrl filtered across conversations)
//   4. Vocaux — audio messages (type=AUDIO filtered across conversations)
//   5. Appels — call history (call-related system messages + call events)
//   6. Modération — reported messages (pinned + important messages, member list)
//   7. Analytics — chat statistics (computed from conversations + messages)
//
// All screens use the Helm Connect theme (Royal Blue + gold).
// ============================================================================

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/helm_theme.dart';
import 'conversation_detail_screen.dart';

// ============================================================================
// 1. COMMUNAUTÉS — auto-groups (CLASS / SUBJECT / ROLE / STAFF)
// ============================================================================
class CommunitiesScreen extends StatefulWidget {
  const CommunitiesScreen({super.key});

  @override
  State<CommunitiesScreen> createState() => _CommunitiesScreenState();
}

class _CommunitiesScreenState extends State<CommunitiesScreen> {
  List<Conversation> _groups = [];
  bool _loading = true;
  String? _error;
  String _filter = 'ALL'; // ALL | CLASS | SUBJECT | ROLE | STAFF

  @override
  void initState() {
    super.initState();
    _loadGroups();
  }

  Future<void> _loadGroups() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json = await ApiService.listConversations();
      final all = json.map((c) => Conversation.fromJson(c)).toList();
      // Filter: only GROUP conversations (auto-groups are GROUP-type with autoGroupType field)
      final groups = all.where((c) => c.type == 'GROUP').toList();
      if (mounted) {
        setState(() {
          _groups = groups;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  /// Classify a group by its name pattern (auto-groups follow naming conventions).
  /// Returns 'CLASS', 'SUBJECT', 'ROLE', 'STAFF', or 'OTHER'.
  String _classifyGroup(Conversation conv) {
    final name = (conv.name ?? '').toLowerCase();
    if (name.startsWith('classe ') || name.contains('classe ')) return 'CLASS';
    if (name.contains('matière') || name.contains('subject')) return 'SUBJECT';
    if (name.contains('rôle') || name.contains('role') || name.contains('admin') ||
        name.contains('directeur') || name.contains('surveillant')) return 'ROLE';
    if (name.contains('staff') || name.contains('personnel')) return 'STAFF';
    return 'OTHER';
  }

  List<Conversation> get _filteredGroups {
    if (_filter == 'ALL') return _groups;
    return _groups.where((g) => _classifyGroup(g) == _filter).toList();
  }

  IconData _categoryIcon(String category) {
    switch (category) {
      case 'CLASS':
        return Icons.school;
      case 'SUBJECT':
        return Icons.menu_book;
      case 'ROLE':
        return Icons.admin_panel_settings;
      case 'STAFF':
        return Icons.badge;
      default:
        return Icons.groups;
    }
  }

  Color _categoryColor(String category) {
    switch (category) {
      case 'CLASS':
        return const Color(0xFF10B981);
      case 'SUBJECT':
        return const Color(0xFF8B5CF6);
      case 'ROLE':
        return const Color(0xFFEF4444);
      case 'STAFF':
        return const Color(0xFFF59E0B);
      default:
        return HelmColors.primaryVivid;
    }
  }

  String _categoryLabel(String category) {
    switch (category) {
      case 'CLASS':
        return 'Classes';
      case 'SUBJECT':
        return 'Matières';
      case 'ROLE':
        return 'Rôles';
      case 'STAFF':
        return 'Personnel';
      default:
        return 'Autres';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: HelmColors.background,
      child: Column(
        children: [
          const HelmSectionHeader(
            title: 'Communautés',
            subtitle: 'GROUPES AUTOMATIQUES PAR CLASSE, MATIÈRE, RÔLE, PERSONNEL',
          ),
          // Filter chips
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            color: Colors.white,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: ['ALL', 'CLASS', 'SUBJECT', 'ROLE', 'STAFF'].map((cat) {
                  final isSelected = _filter == cat;
                  final label = cat == 'ALL' ? 'Tous' : _categoryLabel(cat);
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: GestureDetector(
                      onTap: () => setState(() => _filter = cat),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: isSelected ? HelmColors.primary : Colors.grey[100],
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: isSelected ? HelmColors.goldLight : Colors.grey[300]!,
                            width: isSelected ? 1.5 : 1,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              cat == 'ALL' ? Icons.apps : _categoryIcon(cat),
                              size: 14,
                              color: isSelected ? Colors.white : Colors.grey[700],
                            ),
                            const SizedBox(width: 4),
                            Text(
                              label,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: isSelected ? Colors.white : Colors.grey[700],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          // Group list
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: HelmColors.primary))
                : _error != null
                    ? _buildErrorState(_error!)
                    : _filteredGroups.isEmpty
                        ? const HelmEmptyState(
                            icon: Icons.groups,
                            title: 'Aucune communauté',
                            subtitle: 'Les groupes automatiques (Classes, Matières, Rôles, Personnel) apparaîtront ici une fois créés.',
                          )
                        : RefreshIndicator(
                            onRefresh: _loadGroups,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(8),
                              itemCount: _filteredGroups.length,
                              itemBuilder: (context, index) {
                                final group = _filteredGroups[index];
                                final category = _classifyGroup(group);
                                final color = _categoryColor(category);
                                final icon = _categoryIcon(category);
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 6),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  child: ListTile(
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                    leading: CircleAvatar(
                                      backgroundColor: color,
                                      child: Icon(icon, color: Colors.white, size: 22),
                                    ),
                                    title: Text(
                                      group.name ?? 'Groupe',
                                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                                    ),
                                    subtitle: Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: color.withOpacity(0.15),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: Text(
                                            _categoryLabel(category),
                                            style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600),
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          '${group.participants.length} membres',
                                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                                        ),
                                      ],
                                    ),
                                    trailing: const Icon(Icons.chevron_right, color: Colors.grey, size: 20),
                                    onTap: () {
                                      Navigator.push(context, MaterialPageRoute(builder: (_) => ConversationDetailScreen(conversation: group)));
                                    },
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(String error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: HelmColors.danger),
            const SizedBox(height: 16),
            Text('Échec du chargement', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(error, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadGroups,
              child: const Text('Réessayer'),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// 2. CANAUX — broadcast channels (Telegram-style)
// ⭐ V7 (parité web) — vraie API /chat/channels : avant, heuristique sur les
//    conversations GROUP dont le nom commence par « # » (aucun canal réel
//    n'apparaissait). Maintenant : liste réelle + abonnement + compteur
//    d'abonnés + aperçu du dernier message + création.
// ============================================================================
class ChannelsScreen extends StatefulWidget {
  const ChannelsScreen({super.key});

  @override
  State<ChannelsScreen> createState() => _ChannelsScreenState();
}

class _ChannelsScreenState extends State<ChannelsScreen> {
  List<Map<String, dynamic>> _channels = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadChannels();
  }

  Future<void> _loadChannels() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final channels = await ApiService.listChannels();
      if (mounted) {
        setState(() {
          _channels = channels;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  // ⭐ V7 — abonnement / désabonnement (message système « X a rejoint » si notify)
  Future<void> _toggleSubscription(Map<String, dynamic> channel) async {
    final channelId = channel['id'] as String;
    final subscribed = channel['isSubscribed'] == true;
    try {
      if (subscribed) {
        await ApiService.unsubscribeChannel(channelId);
      } else {
        await ApiService.subscribeChannel(channelId, notify: true);
      }
      await _loadChannels();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec : $e')));
      }
    }
  }

  // ⭐ V7 — ouvrir le canal : conversation miroir CHANNEL (même id, V6.1)
  void _openChannel(Map<String, dynamic> channel) {
    final conv = Conversation.fromJson({
      'id': channel['id'],
      'type': 'CHANNEL',
      'name': channel['name'],
      'description': channel['description'],
      'createdBy': channel['createdBy'] ?? '',
      'createdAt': channel['createdAt'] ?? DateTime.now().toIso8601String(),
      'updatedAt': channel['updatedAt'] ?? DateTime.now().toIso8601String(),
    });
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => ConversationDetailScreen(conversation: conv)),
    ).then((_) => _loadChannels());
  }

  // ⭐ V7 — créer un canal (nom + description)
  Future<void> _createChannel() async {
    final nameController = TextEditingController();
    final descController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Nouveau canal'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Un canal diffuse vos messages à tous les abonnés (unidirectionnel, style Telegram).', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            const SizedBox(height: 12),
            TextField(
              controller: nameController,
              autofocus: true,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Nom du canal',
                prefixText: '# ',
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: descController,
              maxLines: 2,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Description (optionnel)',
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
            onPressed: () async {
              final name = nameController.text.trim();
              if (name.isEmpty) return;
              Navigator.pop(context);
              try {
                final desc = descController.text.trim();
                await ApiService.createChannel(name: name, description: desc.isEmpty ? null : desc);
                await _loadChannels();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Canal « $name » créé')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec : $e')));
                }
              } finally {
                nameController.dispose();
                descController.dispose();
              }
            },
            child: const Text('Créer'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: HelmColors.background,
      child: Column(
        children: [
          HelmSectionHeader(
            title: 'Canaux',
            subtitle: 'CANAUX DE DIFFUSION (BROADCAST UNIDIRECTIONNEL)',
            actionIcon: Icons.add,
            onAction: _createChannel,
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: HelmColors.primary))
                : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline, size: 48, color: HelmColors.danger),
                              const SizedBox(height: 16),
                              Text(_error!, textAlign: TextAlign.center),
                              const SizedBox(height: 16),
                              ElevatedButton(onPressed: _loadChannels, child: const Text('Réessayer')),
                            ],
                          ),
                        ),
                      )
                    : _channels.isEmpty
                        ? const HelmEmptyState(
                            icon: Icons.feed,
                            title: 'Aucun canal',
                            subtitle: 'Les canaux de diffusion apparaîtront ici. Créez un canal pour diffuser des annonces à grande audience.',
                          )
                        : RefreshIndicator(
                            onRefresh: _loadChannels,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(8),
                              itemCount: _channels.length,
                              itemBuilder: (context, index) {
                                final channel = _channels[index];
                                final subscribed = channel['isSubscribed'] == true;
                                final subscriberCount = (channel['subscriberCount'] as num?)?.toInt() ?? 0;
                                final preview = stripHtml(channel['lastMessagePreview'] as String?);
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 6),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  child: ListTile(
                                    leading: CircleAvatar(
                                      backgroundColor: subscribed ? const Color(0xFF8B5CF6) : Colors.grey[300],
                                      child: const Icon(Icons.feed, color: Colors.white, size: 20),
                                    ),
                                    title: Text(
                                      channel['name'] as String? ?? 'Canal',
                                      style: TextStyle(fontWeight: FontWeight.w600, color: subscribed ? null : Colors.grey),
                                    ),
                                    subtitle: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          preview.isEmpty ? 'Aucune diffusion' : preview,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                                        ),
                                        Text(
                                          '$subscriberCount abonné${subscriberCount > 1 ? 's' : ''}',
                                          style: TextStyle(fontSize: 10, color: subscribed ? const Color(0xFF8B5CF6) : Colors.grey),
                                        ),
                                      ],
                                    ),
                                    trailing: TextButton(
                                      onPressed: () => _toggleSubscription(channel),
                                      style: TextButton.styleFrom(
                                        backgroundColor: subscribed ? Colors.grey[200] : const Color(0xFF8B5CF6),
                                        foregroundColor: subscribed ? Colors.grey[700] : Colors.white,
                                        padding: const EdgeInsets.symmetric(horizontal: 12),
                                      ),
                                      child: Text(subscribed ? 'Abonné' : 'S\'abonner', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                                    ),
                                    onTap: () => _openChannel(channel),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// 3. FICHIERS — shared files (across conversations)
// ============================================================================
class FilesScreen extends StatefulWidget {
  const FilesScreen({super.key});

  @override
  State<FilesScreen> createState() => _FilesScreenState();
}

class _FilesScreenState extends State<FilesScreen> {
  // ⭐ V9 (parité web V6 spec §22) — vrai Centre documentaire :
  //    GET /chat/v2/files?type=document (+ stats), /chat/v2/links, /chat/v2/pinned.
  //    AVANT : scan N+1 des messages des 20 premières conversations (heuristique
  //    lente et incomplète). Onglets web : Documents | Liens | Épinglés.
  List<Map<String, dynamic>> _documents = [];
  List<Map<String, dynamic>> _links = [];
  List<Map<String, dynamic>> _pinned = [];
  Map<String, dynamic>? _stats;
  bool _loading = true;
  bool _secondaryLoading = false;
  String? _error;
  String _tab = 'documents'; // documents | liens | epingles

  @override
  void initState() {
    super.initState();
    _loadDocuments();
  }

  Future<void> _loadDocuments() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ApiService.getV2Files(type: 'document', limit: 100);
      if (mounted) setState(() => _documents = data);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ⭐ Miroir web : charger Liens/Épinglés au premier passage sur l'onglet
  Future<void> _loadSecondary() async {
    if (_tab == 'documents') return;
    if (_tab == 'liens' && _links.isNotEmpty) return;
    if (_tab == 'epingles' && _pinned.isNotEmpty) return;
    setState(() => _secondaryLoading = true);
    try {
      if (_tab == 'liens') {
        final l = await ApiService.getV2Links(limit: 100);
        if (mounted) setState(() => _links = l);
      } else {
        final p = await ApiService.getV2Pinned(limit: 100);
        if (mounted) setState(() => _pinned = p);
      }
    } catch (_) {/* silencieux */} finally {
      if (mounted) setState(() => _secondaryLoading = false);
    }
  }

  // Badge type de fichier — miroir fileMeta web (PDF rouge, DOC bleu…)
  (String, Color) _fileMeta(String? mime, String? name) {
    final m = '${mime ?? ''}${name ?? ''}'.toLowerCase();
    if (m.contains('pdf')) return ('PDF', const Color(0xFFDC2626));
    if (m.contains('doc')) return ('DOC', const Color(0xFF2563EB));
    if (m.contains('xls') || m.contains('csv')) return ('XLS', const Color(0xFF059669));
    if (m.contains('ppt')) return ('PPT', const Color(0xFFEA580C));
    if (m.contains('zip') || m.contains('rar') || m.contains('7z')) return ('ZIP', const Color(0xFFD97706));
    return ('FICHIER', const Color(0xFF64748B));
  }

  String _fileSize(dynamic size) {
    final b = size is num ? size.toInt() : null;
    if (b == null || b <= 0) return '';
    if (b < 1024) return '$b o';
    if (b < 1024 * 1024) return '${(b / 1024).toStringAsFixed(1)} Ko';
    return '${(b / (1024 * 1024)).toStringAsFixed(1)} Mo';
  }

  String _formatDate(String isoDate) {
    try {
      final dt = DateTime.parse(isoDate);
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
  }

  Future<void> _open(String? rawUrl, String? name) async {
    final raw = rawUrl ?? '';
    if (raw.isEmpty) return;
    final url = raw.startsWith('http') ? raw : await ApiConfig.resolveFileUrl(raw);
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Impossible d\'ouvrir ce fichier')),
        );
      }
    }
  }

  Future<void> _openConversation(String? conversationId) async {
    final id = conversationId;
    if (id == null || id.isEmpty) return;
    try {
      final convs = await ApiService.listConversations();
      final match = convs.firstWhere(
        (c) => c['id'] == id,
        orElse: () => <String, dynamic>{},
      );
      if (match.isEmpty || !mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ConversationDetailScreen(
            conversation: Conversation.fromJson(match),
          ),
        ),
      );
    } catch (_) {/* silencieux */}
  }

  @override
  Widget build(BuildContext context) {
    final docsCount = _stats != null ? ((_stats!['documents'] as num?)?.toInt() ?? _documents.length) : _documents.length;
    return Container(
      color: HelmColors.background,
      child: Column(
        children: [
          const HelmSectionHeader(
            title: 'Fichiers',
            subtitle: 'CENTRE DOCUMENTAIRE PARTAGÉ',
          ),
          // ⭐ Onglets web : Documents | Liens | Épinglés
          Container(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
            color: Colors.white,
            child: Row(
              children: [
                _docTab('documents', 'Documents', Icons.insert_drive_file, docsCount),
                const SizedBox(width: 6),
                _docTab('liens', 'Liens', Icons.link, _links.length),
                const SizedBox(width: 6),
                _docTab('epingles', 'Épinglés', Icons.push_pin, _pinned.length),
              ],
            ),
          ),
          Expanded(
            child: _tab == 'documents'
                ? _buildDocuments()
                : _tab == 'liens'
                    ? _buildLinks()
                    : _buildPinned(),
          ),
        ],
      ),
    );
  }

  Widget _docTab(String id, String label, IconData icon, int count) {
    final selected = _tab == id;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() => _tab = id);
          _loadSecondary();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 7),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFFE6F4FF) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 13, color: selected ? const Color(0xFF0958D9) : const Color(0xFF64748B)),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  '$label${count > 0 ? ' ($count)' : ''}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: selected ? const Color(0xFF0958D9) : const Color(0xFF64748B),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDocuments() {
    if (_loading) return const Center(child: CircularProgressIndicator(color: HelmColors.primary));
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: HelmColors.danger),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _loadDocuments, child: const Text('Réessayer')),
          ],
        ),
      );
    }
    if (_documents.isEmpty) {
      return const HelmEmptyState(
        icon: Icons.folder_open,
        title: 'Aucun document partagé',
        subtitle: 'Les documents partagés dans vos conversations apparaîtront ici.',
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: _documents.length,
      itemBuilder: (context, index) {
        final f = _documents[index];
        final name = (f['name'] ?? 'Fichier') as String;
        final (label, color) = _fileMeta(f['mime'] as String?, name);
        final sender = (f['senderName'] ?? '') as String;
        final convName = (f['convName'] ?? 'Conversation') as String;
        final size = _fileSize(f['size']);
        final date = _formatDate((f['createdAt'] ?? '') as String);
        return Card(
          margin: const EdgeInsets.only(bottom: 6),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Text(
                  label,
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color),
                ),
              ),
            ),
            title: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (sender.isNotEmpty) Text('de $sender', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                Text(
                  [convName, size, date].where((x) => x.isNotEmpty).join(' • '),
                  style: const TextStyle(fontSize: 10, color: Colors.grey),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
            trailing: Icon(Icons.open_in_new, color: color, size: 20),
            onTap: () => _open(f['url'] as String?, name),
          ),
        );
      },
    );
  }

  // ⭐ V6 web — LIENS partagés (URLs extraites des messages)
  Widget _buildLinks() {
    if (_secondaryLoading) return const Center(child: CircularProgressIndicator(color: HelmColors.primary));
    if (_links.isEmpty) {
      return const HelmEmptyState(
        icon: Icons.link,
        title: 'Aucun lien partagé',
        subtitle: 'Les liens envoyés dans les conversations apparaîtront ici.',
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: _links.length,
      itemBuilder: (context, index) {
        final l = _links[index];
        final url = (l['url'] ?? l['link'] ?? '') as String;
        final host = Uri.tryParse(url)?.host ?? url;
        final title = (l['title'] ?? l['content'] ?? host) as String;
        final convName = (l['convName'] ?? l['conversationName'] ?? '') as String;
        return Card(
          margin: const EdgeInsets.only(bottom: 6),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFE6F4FF),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.link, color: Color(0xFF0958D9), size: 20),
            ),
            title: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            subtitle: Text(
              [host, convName].where((x) => x.isNotEmpty).join(' • '),
              style: const TextStyle(fontSize: 10, color: Colors.grey),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: const Icon(Icons.chevron_right, color: Color(0xFF94A3B8)),
            onTap: () {
              if (url.isNotEmpty) {
                launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication).catchError((_) => false);
              }
            },
            onLongPress: () => _openConversation(l['conversationId'] as String?),
          ),
        );
      },
    );
  }

  // ⭐ V6 web — ÉPINGLÉS transverses (toutes conversations)
  Widget _buildPinned() {
    if (_secondaryLoading) return const Center(child: CircularProgressIndicator(color: HelmColors.primary));
    if (_pinned.isEmpty) {
      return const HelmEmptyState(
        icon: Icons.push_pin_outlined,
        title: 'Aucun message épinglé',
        subtitle: 'Les messages épinglés de vos conversations apparaîtront ici.',
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: _pinned.length,
      itemBuilder: (context, index) {
        final m = _pinned[index];
        final content = ((m['content'] ?? '') as String).replaceAll(RegExp(r'<[^>]*>'), '');
        final sender = (m['senderName'] ?? '') as String;
        final convName = (m['convName'] ?? m['conversationName'] ?? 'Conversation') as String;
        final date = _formatDate((m['createdAt'] ?? '') as String);
        return Card(
          margin: const EdgeInsets.only(bottom: 6),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            leading: const Icon(Icons.push_pin, color: Color(0xFFF59E0B), size: 22),
            title: Text(
              content.isEmpty ? '(pièce jointe)' : content,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
            ),
            subtitle: Text(
              [if (sender.isNotEmpty) sender, convName, date].where((x) => x.isNotEmpty).join(' • '),
              style: const TextStyle(fontSize: 10, color: Colors.grey),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            onTap: () => _openConversation(m['conversationId'] as String?),
          ),
        );
      },
    );
  }
}

// ============================================================================
// 4. VOCAUX — audio messages
// ============================================================================
class VoiceMessagesScreen extends StatefulWidget {
  const VoiceMessagesScreen({super.key});

  @override
  State<VoiceMessagesScreen> createState() => _VoiceMessagesScreenState();
}

class _VoiceMessagesScreenState extends State<VoiceMessagesScreen> {
  // ⭐ V9 (parité web VocauxSection) — vrais messages vocaux via
  //    GET /chat/v2/files?type=audio (FilesCenterService) + CANAUX VOCAUX
  //    (listVoiceChannels). AVANT : scan N+1 des conversations (20×50 msgs).
  List<Map<String, dynamic>> _voices = [];
  List<Map<String, dynamic>> _voiceChannels = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadVoices();
  }

  Future<void> _loadVoices() async {
    setState(() { _loading = true; _error = null; });
    try {
      final files = await ApiService.getV2Files(type: 'audio', limit: 50);
      var channels = <Map<String, dynamic>>[];
      try {
        channels = await ApiService.listVoiceChannels();
      } catch (_) {/* canaux vocaux optionnels */}
      if (mounted) {
        setState(() {
          _voices = files;
          _voiceChannels = channels;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _formatDuration(dynamic seconds) {
    final d = seconds is num ? seconds.toInt() : null;
    if (d == null || d <= 0) return '0:00';
    final m = d ~/ 60;
    final sec = d % 60;
    return '$m:${sec.toString().padLeft(2, '0')}';
  }

  String _formatDate(String isoDate) {
    try {
      final dt = DateTime.parse(isoDate);
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
  }

  Future<void> _openConversation(String? conversationId) async {
    if (conversationId == null || conversationId.isEmpty) return;
    try {
      final convs = await ApiService.listConversations();
      final match = convs.firstWhere(
        (c) => c['id'] == conversationId,
        orElse: () => <String, dynamic>{},
      );
      if (match.isEmpty || !mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ConversationDetailScreen(
            conversation: Conversation.fromJson(match),
          ),
        ),
      );
    } catch (_) {/* silencieux */}
  }

  Future<void> _play(String? rawUrl) async {
    final raw = rawUrl ?? '';
    if (raw.isEmpty) return;
    final url = raw.startsWith('http') ? raw : await ApiConfig.resolveFileUrl(raw);
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: HelmColors.background,
      child: Column(
        children: [
          const HelmSectionHeader(
            title: 'Vocaux',
            subtitle: 'MESSAGES VOCAUX + CANAUX EN DIRECT',
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: HelmColors.primary))
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.error_outline, size: 48, color: HelmColors.danger),
                            const SizedBox(height: 16),
                            Text(_error!, textAlign: TextAlign.center),
                            const SizedBox(height: 16),
                            ElevatedButton(onPressed: _loadVoices, child: const Text('Réessayer')),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadVoices,
                        child: ListView(
                          padding: const EdgeInsets.all(8),
                          children: [
                            // ⭐ Canaux vocaux (miroir web VocauxSection)
                            if (_voiceChannels.isNotEmpty) ...[
                              Padding(
                                padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
                                child: Row(
                                  children: const [
                                    Icon(Icons.volume_up, size: 13, color: Color(0xFF64748B)),
                                    SizedBox(width: 6),
                                    Text(
                                      'CANAUX VOCAUX',
                                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.5),
                                    ),
                                  ],
                                ),
                              ),
                              ..._voiceChannels.map((vc) {
                                final joined = (vc['isJoined'] ?? vc['joined']) == true;
                                final active = ((vc['activeUsers'] ?? 0) as num).toInt();
                                final isStage = vc['type'] == 'STAGE';
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 6),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  color: joined ? const Color(0xFFE6F4FF) : null,
                                  child: ListTile(
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                    leading: Container(
                                      width: 40,
                                      height: 40,
                                      decoration: BoxDecoration(
                                        color: joined
                                            ? const Color(0xFFFFE08A)
                                            : isStage
                                                ? const Color(0xFFEDE9FE)
                                                : const Color(0xFFCFA63A),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Icon(
                                        isStage ? Icons.theater_comedy : Icons.radio,
                                        color: joined ? const Color(0xFF0A2A5E) : Colors.white,
                                        size: 20,
                                      ),
                                    ),
                                    title: Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            (vc['name'] ?? 'Canal') as String,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                          ),
                                        ),
                                        if (isStage)
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 4),
                                            decoration: BoxDecoration(color: const Color(0xFFEDE9FE), borderRadius: BorderRadius.circular(4)),
                                            child: const Text('SCÈNE', style: TextStyle(fontSize: 7, fontWeight: FontWeight.w700, color: Color(0xFF6B21A8))),
                                          ),
                                      ],
                                    ),
                                    subtitle: Text(
                                      '$active connecté${active > 1 ? 's' : ''}${vc['videoMode'] == true ? ' · vidéo' : ''}',
                                      style: const TextStyle(fontSize: 10, color: Colors.grey),
                                    ),
                                    trailing: ElevatedButton.icon(
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: joined ? Colors.white : HelmColors.primary,
                                        foregroundColor: joined ? HelmColors.primary : Colors.white,
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        minimumSize: Size.zero,
                                      ),
                                      icon: Icon(joined ? Icons.logout : Icons.login, size: 13),
                                      label: Text(joined ? 'Quitter' : 'Rejoindre', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
                                      onPressed: () async {
                                        final id = vc['id'] as String;
                                        try {
                                          if (joined) {
                                            await ApiService.leaveVoiceChannel(id);
                                          } else {
                                            await ApiService.joinVoiceChannel(id);
                                          }
                                          _loadVoices();
                                        } catch (e) {
                                          if (mounted) {
                                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
                                          }
                                        }
                                      },
                                    ),
                                  ),
                                );
                              }),
                              const SizedBox(height: 8),
                            ],
                            // ⭐ Messages vocaux (V2 API)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
                              child: Row(
                                children: const [
                                  Icon(Icons.mic, size: 13, color: Color(0xFF64748B)),
                                  SizedBox(width: 6),
                                  Text(
                                    'MESSAGES VOCAUX',
                                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.5),
                                  ),
                                ],
                              ),
                            ),
                            if (_voices.isEmpty)
                              const Padding(
                                padding: EdgeInsets.all(24),
                                child: HelmEmptyState(
                                  icon: Icons.mic_none,
                                  title: 'Aucun message vocal',
                                  subtitle: 'Les messages vocaux de vos conversations apparaîtront ici.',
                                ),
                              )
                            else
                              ..._voices.map((v) {
                                final sender = (v['senderName'] ?? '') as String;
                                final convName = (v['convName'] ?? 'Conversation') as String;
                                final dur = _formatDuration(v['duration']);
                                final date = _formatDate((v['createdAt'] ?? '') as String);
                                final name = (v['name'] ?? 'Vocal') as String;
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 6),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  child: ListTile(
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                    leading: Container(
                                      width: 40,
                                      height: 40,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFEC4899).withOpacity(0.12),
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: const Icon(Icons.play_arrow, color: Color(0xFFEC4899), size: 24),
                                    ),
                                    title: Text(
                                      sender.isNotEmpty ? sender : name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                    ),
                                    subtitle: Text(
                                      [convName, dur, date].where((x) => x.isNotEmpty).join(' • '),
                                      style: const TextStyle(fontSize: 10, color: Colors.grey),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    onTap: () => _play(v['url'] as String?),
                                    onLongPress: () => _openConversation(v['conversationId'] as String?),
                                  ),
                                );
                              }),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// 5. APPELS — call history
// ⭐ V7 (parité web) — vraie API /chat/calls/history : avant, liste
//    FANTÔME des conversations DIRECT (statut/direction/sens codés en dur).
//    Maintenant : CALL_LOG réels (callMeta : statut, durée, type, initiateur)
//    + bouton Rappeler qui ouvre la conversation.
// ============================================================================
class CallsScreen extends StatefulWidget {
  const CallsScreen({super.key});

  @override
  State<CallsScreen> createState() => _CallsScreenState();
}

class _CallsScreenState extends State<CallsScreen> {
  List<Map<String, dynamic>> _calls = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCalls();
  }

  Future<void> _loadCalls() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final calls = await ApiService.getCallHistory(limit: 60);
      if (mounted) {
        setState(() {
          _calls = calls;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  // ⭐ V7 — callMeta (CALL_LOG) ou colonnes (chat_call_history) → rendu unifié
  (IconData, Color, String, String, DateTime) _callInfo(Map<String, dynamic> call) {
    final meta = call['callMeta'] as Map<String, dynamic>?;
    final callType = (meta?['callType'] ?? call['callType'] ?? 'audio').toString();
    final status = (meta?['status'] ?? call['status'] ?? 'ended').toString();
    final durationSec = (meta?['durationSec'] as num? ?? call['duration'] as num?)?.toInt() ?? 0;
    final createdAt = DateTime.tryParse((call['createdAt'] ?? call['startedAt'] ?? '').toString()) ?? DateTime.now();
    final initiator = (meta?['byName'] ?? call['initiatorName'] ?? '').toString().trim();
    final video = callType == 'video';
    String label;
    IconData icon;
    Color color;
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
        label = 'Appel annulé';
        break;
      default:
        icon = video ? Icons.videocam_outlined : Icons.phone_in_talk;
        color = const Color(0xFF10B981);
        label = durationSec > 0 ? 'Appel ${video ? 'vidéo' : 'audio'} · ${formatCallDuration(durationSec)}' : 'Appel ${video ? 'vidéo' : 'audio'} terminé';
    }
    return (icon, color, label, initiator, createdAt);
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return "À l'instant";
    if (diff.inHours < 1) return 'Il y a ${diff.inMinutes}min';
    if (diff.inDays == 0) return "Aujourd'hui à ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}";
    if (diff.inDays == 1) return 'Hier à ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    if (diff.inDays < 7) return 'Il y a ${diff.inDays}j';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  // ⭐ V7 — Rappeler : ouvre la conversation (boutons d'appel audio/vidéo)
  Future<void> _openConversation(String conversationId) async {
    try {
      final convs = await ApiService.listConversations();
      final match = convs.cast<Map<String, dynamic>?>().firstWhere(
        (c) => c!['id'] == conversationId,
        orElse: () => null,
      );
      if (match == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Conversation introuvable')),
          );
        }
        return;
      }
      if (!mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => ConversationDetailScreen(conversation: Conversation.fromJson(match))),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec : $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: HelmColors.background,
      child: Column(
        children: [
          const HelmSectionHeader(
            title: 'Appels',
            subtitle: 'HISTORIQUE DES APPELS AUDIO & VIDÉO',
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: HelmColors.primary))
                : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline, size: 48, color: HelmColors.danger),
                              const SizedBox(height: 16),
                              Text(_error!, textAlign: TextAlign.center),
                              const SizedBox(height: 16),
                              ElevatedButton(onPressed: _loadCalls, child: const Text('Réessayer')),
                            ],
                          ),
                        ),
                      )
                    : _calls.isEmpty
                        ? const HelmEmptyState(
                            icon: Icons.phone_callback,
                            title: 'Aucun appel',
                            subtitle: 'Votre historique d\'appels audio et vidéo apparaîtra ici, avec les appels manqués, émis et reçus.',
                          )
                        : RefreshIndicator(
                            onRefresh: _loadCalls,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(8),
                              itemCount: _calls.length,
                              itemBuilder: (context, index) {
                                final call = _calls[index];
                                final (icon, color, label, initiator, createdAt) = _callInfo(call);
                                final conversationId = call['conversationId'] as String? ?? '';
                                final displayName = (call['convName'] as String?) ??
                                    (initiator.isNotEmpty ? initiator : 'Utilisateur');
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 4),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  child: ListTile(
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                    leading: CircleAvatar(
                                      backgroundColor: color.withOpacity(0.15),
                                      child: Icon(icon, color: color, size: 20),
                                    ),
                                    title: Text(
                                      displayName,
                                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                                    ),
                                    subtitle: Row(
                                      children: [
                                        Icon(icon, size: 13, color: color),
                                        const SizedBox(width: 4),
                                        Expanded(
                                          child: Text(
                                            '$label • ${_formatDate(createdAt)}',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(fontSize: 11, color: color),
                                          ),
                                        ),
                                      ],
                                    ),
                                    trailing: IconButton(
                                      icon: const Icon(Icons.phone, color: HelmColors.primaryVivid),
                                      tooltip: 'Rappeler',
                                      onPressed: conversationId.isEmpty ? null : () => _openConversation(conversationId),
                                    ),
                                    onTap: conversationId.isEmpty ? null : () => _openConversation(conversationId),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// 6. MODÉRATION — pinned + important messages, reported content
// ============================================================================
class ModerationScreen extends StatefulWidget {
  const ModerationScreen({super.key});

  @override
  State<ModerationScreen> createState() => _ModerationScreenState();
}

class _ModerationScreenState extends State<ModerationScreen> {
  // ⭐ V9 (parité web ModerationSection V4 Phase 2) — vrais SIGNALEMENTS via
  //    GET /chat/reports (motif + statut) + bouton « Résoudre ».
  //    AVANT : affichait les messages épinglés/importants (ce n'est PAS de la
  //    modération) via scan N+1 des conversations.
  List<Map<String, dynamic>> _reports = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadReports();
  }

  Future<void> _loadReports() async {
    setState(() { _loading = true; _error = null; });
    try {
      final reports = await ApiService.getReports();
      if (mounted) setState(() => _reports = reports);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resolve(Map<String, dynamic> r) async {
    try {
      await ApiService.resolveReport(r['id'] as String);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Signalement résolu'), duration: Duration(seconds: 1)),
        );
      }
      _loadReports();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Échec: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: HelmColors.background,
      child: Column(
        children: [
          const HelmSectionHeader(
            title: 'Modération',
            subtitle: 'CONTENUS SIGNALÉS',
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: HelmColors.primary))
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.error_outline, size: 48, color: HelmColors.danger),
                            const SizedBox(height: 16),
                            Text(_error!, textAlign: TextAlign.center),
                            const SizedBox(height: 16),
                            ElevatedButton(onPressed: _loadReports, child: const Text('Réessayer')),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadReports,
                        child: _reports.isEmpty
                            ? ListView(
                                children: const [
                                  SizedBox(height: 80),
                                  HelmEmptyState(
                                    icon: Icons.flag_outlined,
                                    title: 'Aucun contenu signalé',
                                    subtitle: 'Les messages signalés par les utilisateurs apparaîtront ici.',
                                  ),
                                ],
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.all(8),
                                itemCount: _reports.length,
                                itemBuilder: (context, index) {
                                  final r = _reports[index];
                                  final reporter = '${r['reporterFirstName'] ?? ''} ${r['reporterLastName'] ?? ''}'.trim();
                                  final reason = (r['reason'] ?? '') as String;
                                  final preview = (r['messagePreview'] ?? '') as String;
                                  final resolved = r['resolvedAt'] != null;
                                  return Card(
                                    margin: const EdgeInsets.only(bottom: 6),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    child: ListTile(
                                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                      leading: Container(
                                        width: 40,
                                        height: 40,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFEF3C7),
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                        child: const Icon(Icons.flag, color: Color(0xFFD97706), size: 20),
                                      ),
                                      title: Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              'Signalé par ${reporter.isEmpty ? 'un membre' : reporter}',
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                            ),
                                          ),
                                          if (resolved)
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(color: const Color(0xFFD1FAE5), borderRadius: BorderRadius.circular(10)),
                                              child: const Text('RÉSOLU', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: Color(0xFF047857))),
                                            ),
                                        ],
                                      ),
                                      subtitle: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          if (reason.isNotEmpty)
                                            Text('« $reason »', style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Color(0xFF475569))),
                                          if (preview.isNotEmpty)
                                            Text(
                                              preview,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(fontSize: 11, color: Colors.grey),
                                            ),
                                        ],
                                      ),
                                      trailing: !resolved
                                          ? ElevatedButton(
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor: const Color(0xFFECFDF5),
                                                foregroundColor: const Color(0xFF047857),
                                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                                minimumSize: Size.zero,
                                              ),
                                              onPressed: () => _resolve(r),
                                              child: const Text('Résoudre', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
                                            )
                                          : null,
                                    ),
                                  );
                                },
                              ),
                      ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// 7. ANALYTICS — chat statistics dashboard
// ============================================================================
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  // ⭐ V9 (parité web AnalyticsSection V4 Phase 2) — KPIs RÉELS via
  //    GET /chat/v2/analytics (8 cartes, tons helm/light/warn).
  //    AVANT : compteurs calculés côté client sur 20 conversations (faux).
  Map<String, dynamic>? _stats;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAnalytics();
  }

  Future<void> _loadAnalytics() async {
    setState(() { _loading = true; _error = null; });
    try {
      final stats = await ApiService.getV2Analytics();
      if (mounted) setState(() => _stats = stats);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _v(String key) {
    final v = _stats?[key];
    if (v == null) return '—';
    return '$v';
  }

  @override
  Widget build(BuildContext context) {
    final kpis = <(IconData, String, String, bool)>[
      (Icons.chat, 'Conversations', _v('totalConversations'), true),
      (Icons.forum, 'Messages échangés', _v('totalMessages'), false),
      (Icons.groups, 'Groupes actifs', _v('totalGroups').replaceAll('—', _v('groupConversations')), false),
      (Icons.notifications, 'Messages non lus', _v('totalUnread'), true),
      (Icons.campaign, 'Annonces publiées', _v('totalAnnouncements'), true),
      (Icons.folder, 'Fichiers partagés', _v('totalFiles').replaceAll('—', _v('totalAttachments')), false),
      (Icons.person, 'Utilisateurs actifs', _v('activeUsers'), false),
      (Icons.phone, 'Appels', _v('totalCalls'), true),
    ];
    return Container(
      color: HelmColors.background,
      child: Column(
        children: [
          const HelmSectionHeader(
            title: 'Analytics',
            subtitle: 'TABLEAU DE BORD DE LA COMMUNICATION',
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: HelmColors.primary))
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.error_outline, size: 48, color: HelmColors.danger),
                            const SizedBox(height: 16),
                            Text(_error!, textAlign: TextAlign.center),
                            const SizedBox(height: 16),
                            ElevatedButton(onPressed: _loadAnalytics, child: const Text('Réessayer')),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadAnalytics,
                        child: ListView(
                          padding: const EdgeInsets.all(12),
                          children: [
                            // ⭐ 8 KPIs — miroir web grid-cols-2 (ton helm =
                            // dégradé marine, sinon carte blanche)
                            ...List.generate((kpis.length / 2).ceil(), (row) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Row(
                                  children: [
                                    for (var i = row * 2; i < (row + 1) * 2 && i < kpis.length; i++) ...[
                                      Expanded(child: _buildKpiCard(kpis[i])),
                                      if (i == row * 2) const SizedBox(width: 8),
                                    ],
                                  ],
                                ),
                              );
                            }),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  // Carte KPI — miroir web : ton « helm » = dégradé #0A2A5E→#1C6FE8, texte
  // blanc, icône or ; sinon carte blanche bordure slate-200.
  Widget _buildKpiCard((IconData, String, String, bool) kpi) {
    final (icon, label, value, helm) = kpi;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: helm
            ? const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF0A2A5E), Color(0xFF1C6FE8)],
              )
            : null,
        color: helm ? null : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: helm ? null : Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: helm ? const Color(0xFFFFE08A) : const Color(0xFF94A3B8)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                    color: helm ? const Color(0xFFFFE08A) : const Color(0xFF64748B),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: helm ? Colors.white : const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }
}
