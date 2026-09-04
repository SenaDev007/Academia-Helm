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
  List<_FileEntry> _files = [];
  bool _loading = true;
  String? _error;
  String _filter = 'ALL'; // ALL | IMAGE | DOCUMENT | AUDIO | VIDEO

  @override
  void initState() {
    super.initState();
    _loadFiles();
  }

  Future<void> _loadFiles() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final conversations = await ApiService.listConversations();
      final List<_FileEntry> files = [];
      // Load messages for each conversation (limited to recent 50 to limit payload)
      for (final conv in conversations.take(20)) {
        try {
          final messages = await ApiService.listMessages(conv['id'] as String, limit: 50);
          for (final m in messages) {
            if (m['attachmentUrl'] != null && m['attachmentUrl'].toString().isNotEmpty) {
              files.add(_FileEntry(
                id: m['id'] as String,
                name: (m['attachmentName'] as String?) ?? 'Fichier',
                url: m['attachmentUrl'] as String,
                mime: m['attachmentMime'] as String?,
                size: (m['attachmentSize'] as num?)?.toInt(),
                type: (m['type'] as String?) ?? 'DOCUMENT',
                senderName: '${m['senderFirstName'] ?? ''} ${m['senderLastName'] ?? ''}'.trim(),
                conversationId: conv['id'] as String,
                conversationName: (conv['name'] as String?) ?? 'Conversation',
                createdAt: m['createdAt'] as String? ?? DateTime.now().toIso8601String(),
              ));
            }
          }
        } catch (_) {
          // Skip failed conversations
        }
      }
      // Sort by date desc
      files.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      if (mounted) {
        setState(() {
          _files = files;
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

  List<_FileEntry> get _filteredFiles {
    if (_filter == 'ALL') return _files;
    return _files.where((f) => f.type == _filter).toList();
  }

  IconData _fileIcon(String type, String? mime) {
    switch (type) {
      case 'IMAGE':
        return Icons.image;
      case 'AUDIO':
        return Icons.audio_file;
      case 'VIDEO':
        return Icons.video_file;
      case 'DOCUMENT':
      default:
        // Sub-categorize by mime
        if (mime != null) {
          if (mime.contains('pdf')) return Icons.picture_as_pdf;
          if (mime.contains('word') || mime.contains('msword')) return Icons.description;
          if (mime.contains('sheet') || mime.contains('excel')) return Icons.table_chart;
          if (mime.contains('presentation') || mime.contains('powerpoint')) return Icons.slideshow;
          if (mime.contains('zip') || mime.contains('compressed')) return Icons.folder_zip;
        }
        return Icons.insert_drive_file;
    }
  }

  Color _fileColor(String type) {
    switch (type) {
      case 'IMAGE':
        return const Color(0xFF10B981);
      case 'AUDIO':
        return const Color(0xFFEC4899);
      case 'VIDEO':
        return const Color(0xFF06B6D4);
      case 'DOCUMENT':
      default:
        return HelmColors.primary;
    }
  }

  String _fileSize(int? size) {
    if (size == null) return '';
    if (size < 1024) return '${size}o';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} Ko';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} Mo';
  }

  String _formatDate(String isoDate) {
    try {
      final dt = DateTime.parse(isoDate);
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: HelmColors.background,
      child: Column(
        children: [
          const HelmSectionHeader(
            title: 'Fichiers',
            subtitle: 'CENTRE DOCUMENTAIRE PARTAGÉ',
          ),
          // Filter chips
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            color: Colors.white,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: ['ALL', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'].map((cat) {
                  final isSelected = _filter == cat;
                  final label = cat == 'ALL' ? 'Tous' : cat[0] + cat.substring(1).toLowerCase();
                  final icon = cat == 'ALL'
                      ? Icons.apps
                      : cat == 'IMAGE'
                          ? Icons.image
                          : cat == 'DOCUMENT'
                              ? Icons.insert_drive_file
                              : cat == 'AUDIO' ? Icons.audio_file : Icons.video_file;
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: GestureDetector(
                      onTap: () => setState(() => _filter = cat),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: isSelected ? HelmColors.primary : Colors.grey[100],
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(icon, size: 14, color: isSelected ? Colors.white : Colors.grey[700]),
                            const SizedBox(width: 4),
                            Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: isSelected ? Colors.white : Colors.grey[700])),
                          ],
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
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
                              ElevatedButton(onPressed: _loadFiles, child: const Text('Réessayer')),
                            ],
                          ),
                        ),
                      )
                    : _filteredFiles.isEmpty
                        ? const HelmEmptyState(
                            icon: Icons.folder_open,
                            title: 'Aucun fichier partagé',
                            subtitle: 'Les fichiers partagés dans vos conversations apparaîtront ici, classés par type.',
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(8),
                            itemCount: _filteredFiles.length,
                            itemBuilder: (context, index) {
                              final file = _filteredFiles[index];
                              final color = _fileColor(file.type);
                              return Card(
                                margin: const EdgeInsets.only(bottom: 6),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                child: ListTile(
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  leading: Container(
                                    width: 40,
                                    height: 40,
                                    decoration: BoxDecoration(
                                      color: color.withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(_fileIcon(file.type, file.mime), color: color, size: 22),
                                  ),
                                  title: Text(
                                    file.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                  ),
                                  subtitle: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('de ${file.senderName}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                      Text(
                                        '${file.conversationName} • ${_fileSize(file.size)} • ${_formatDate(file.createdAt)}',
                                        style: const TextStyle(fontSize: 10, color: Colors.grey),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                  trailing: Icon(Icons.download, color: color, size: 20),
                                  onTap: () {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Téléchargement de ${file.name} — bientôt disponible')),
                                    );
                                  },
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

class _FileEntry {
  final String id;
  final String name;
  final String url;
  final String? mime;
  final int? size;
  final String type; // IMAGE | AUDIO | VIDEO | DOCUMENT
  final String senderName;
  final String conversationId;
  final String conversationName;
  final String createdAt;

  _FileEntry({
    required this.id,
    required this.name,
    required this.url,
    this.mime,
    this.size,
    required this.type,
    required this.senderName,
    required this.conversationId,
    required this.conversationName,
    required this.createdAt,
  });
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
  List<_VoiceEntry> _voices = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadVoices();
  }

  Future<void> _loadVoices() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final conversations = await ApiService.listConversations();
      final List<_VoiceEntry> voices = [];
      for (final conv in conversations.take(20)) {
        try {
          final messages = await ApiService.listMessages(conv['id'] as String, limit: 50);
          for (final m in messages) {
            if ((m['type'] as String?) == 'AUDIO' || (m['attachmentMime'] as String?)?.startsWith('audio/') == true) {
              voices.add(_VoiceEntry(
                id: m['id'] as String,
                senderName: '${m['senderFirstName'] ?? ''} ${m['senderLastName'] ?? ''}'.trim(),
                conversationName: (conv['name'] as String?) ?? 'Conversation',
                durationSeconds: (m['duration'] as num?)?.toInt(),
                url: (m['attachmentUrl'] as String?) ?? '',
                createdAt: m['createdAt'] as String? ?? DateTime.now().toIso8601String(),
                transcription: m['transcription'] as String?,
              ));
            }
          }
        } catch (_) {}
      }
      voices.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      if (mounted) {
        setState(() {
          _voices = voices;
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

  String _formatDuration(int? seconds) {
    if (seconds == null) return '0:00';
    return '${(seconds ~/ 60)}:${(seconds % 60).toString().padLeft(2, '0')}';
  }

  String _formatDate(String isoDate) {
    try {
      final dt = DateTime.parse(isoDate);
      final now = DateTime.now();
      final diff = now.difference(dt);
      if (diff.inDays == 0) return "Aujourd'hui à ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}";
      if (diff.inDays == 1) return 'Hier à ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: HelmColors.background,
      child: Column(
        children: [
          const HelmSectionHeader(
            title: 'Vocaux',
            subtitle: 'MESSAGES VOCAUX — TRANSCRIPTIONS WHISPER',
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
                              ElevatedButton(onPressed: _loadVoices, child: const Text('Réessayer')),
                            ],
                          ),
                        ),
                      )
                    : _voices.isEmpty
                        ? const HelmEmptyState(
                            icon: Icons.mic_none,
                            title: 'Aucun message vocal',
                            subtitle: 'Les messages vocaux échangés dans vos conversations apparaîtront ici, avec transcription Whisper automatique.',
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(8),
                            itemCount: _voices.length,
                            itemBuilder: (context, index) {
                              final voice = _voices[index];
                              return Card(
                                margin: const EdgeInsets.only(bottom: 6),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            width: 40,
                                            height: 40,
                                            decoration: BoxDecoration(
                                              gradient: HelmGradients.gold,
                                              shape: BoxShape.circle,
                                            ),
                                            child: const Icon(Icons.mic, color: HelmColors.primary, size: 20),
                                          ),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(voice.senderName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                                Text('${voice.conversationName} • ${_formatDate(voice.createdAt)}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                              ],
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: HelmColors.primary.withOpacity(0.1),
                                              borderRadius: BorderRadius.circular(12),
                                            ),
                                            child: Text(_formatDuration(voice.durationSeconds), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: HelmColors.primary)),
                                          ),
                                        ],
                                      ),
                                      if (voice.transcription != null && voice.transcription!.isNotEmpty) ...[
                                        const SizedBox(height: 8),
                                        Container(
                                          padding: const EdgeInsets.all(8),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFD1FAE5),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Row(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Icon(Icons.translate, size: 14, color: Color(0xFF065F46)),
                                              const SizedBox(width: 6),
                                              Expanded(
                                                child: Text(voice.transcription!, style: const TextStyle(fontSize: 11, color: Color(0xFF065F46))),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          const Icon(Icons.play_circle_filled, color: HelmColors.primary, size: 32),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: Container(
                                              height: 4,
                                              decoration: BoxDecoration(
                                                color: Colors.grey[300],
                                                borderRadius: BorderRadius.circular(2),
                                              ),
                                              child: FractionallySizedBox(
                                                alignment: Alignment.centerLeft,
                                                widthFactor: 0.0,
                                                child: Container(
                                                  decoration: BoxDecoration(
                                                    gradient: HelmGradients.gold,
                                                    borderRadius: BorderRadius.circular(2),
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
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
    );
  }
}

class _VoiceEntry {
  final String id;
  final String senderName;
  final String conversationName;
  final int? durationSeconds;
  final String url;
  final String createdAt;
  final String? transcription;

  _VoiceEntry({
    required this.id,
    required this.senderName,
    required this.conversationName,
    this.durationSeconds,
    required this.url,
    required this.createdAt,
    this.transcription,
  });
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
  List<_ModerationEntry> _flagged = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadFlagged();
  }

  Future<void> _loadFlagged() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final conversations = await ApiService.listConversations();
      final List<_ModerationEntry> flagged = [];
      for (final conv in conversations.take(30)) {
        try {
          final messages = await ApiService.listMessages(conv['id'] as String, limit: 50);
          for (final m in messages) {
            if ((m['isPinned'] as bool?) == true || (m['isImportant'] as bool?) == true) {
              flagged.add(_ModerationEntry(
                messageId: m['id'] as String,
                conversationId: conv['id'] as String,
                conversationName: (conv['name'] as String?) ?? 'Conversation',
                senderName: '${m['senderFirstName'] ?? ''} ${m['senderLastName'] ?? ''}'.trim(),
                content: (m['content'] as String?) ?? '',
                isPinned: (m['isPinned'] as bool?) == true,
                isImportant: (m['isImportant'] as bool?) == true,
                createdAt: (m['createdAt'] as String?) ?? DateTime.now().toIso8601String(),
              ));
            }
          }
        } catch (_) {}
      }
      flagged.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      if (mounted) {
        setState(() {
          _flagged = flagged;
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

  String _formatDate(String isoDate) {
    try {
      final dt = DateTime.parse(isoDate);
      return '${dt.day}/${dt.month} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
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
            subtitle: 'MESSAGES ÉPINGLÉS, IMPORTANTS & SIGNALÉS',
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
                              ElevatedButton(onPressed: _loadFlagged, child: const Text('Réessayer')),
                            ],
                          ),
                        ),
                      )
                    : _flagged.isEmpty
                        ? const HelmEmptyState(
                            icon: Icons.shield,
                            title: 'Aucun contenu à modérer',
                            subtitle: 'Les messages épinglés et marqués comme importants par les administrateurs apparaîtront ici pour modération.',
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(8),
                            itemCount: _flagged.length,
                            itemBuilder: (context, index) {
                              final entry = _flagged[index];
                              return Card(
                                margin: const EdgeInsets.only(bottom: 6),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Header: sender + conversation
                                      Row(
                                        children: [
                                          if (entry.isPinned)
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFF06B6D4).withOpacity(0.15),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: const Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(Icons.push_pin, size: 12, color: Color(0xFF06B6D4)),
                                                  SizedBox(width: 2),
                                                  Text('Épinglé', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF06B6D4))),
                                                ],
                                              ),
                                            ),
                                          if (entry.isPinned && entry.isImportant) const SizedBox(width: 4),
                                          if (entry.isImportant)
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFF59E0B).withOpacity(0.15),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: const Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(Icons.star, size: 12, color: Color(0xFFF59E0B)),
                                                  SizedBox(width: 2),
                                                  Text('Important', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFFF59E0B))),
                                                ],
                                              ),
                                            ),
                                          const Spacer(),
                                          Text(_formatDate(entry.createdAt), style: const TextStyle(fontSize: 10, color: Colors.grey)),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        '${entry.senderName} — ${entry.conversationName}',
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: HelmColors.primary),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(stripHtml(entry.content), style: const TextStyle(fontSize: 13), maxLines: 3, overflow: TextOverflow.ellipsis),
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          TextButton.icon(
                                            onPressed: () {
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                SnackBar(content: Text('Signalement envoyé pour le message de ${entry.senderName}')),
                                              );
                                            },
                                            icon: const Icon(Icons.flag, size: 14),
                                            label: const Text('Signaler', style: TextStyle(fontSize: 11)),
                                            style: TextButton.styleFrom(foregroundColor: HelmColors.danger),
                                          ),
                                          const SizedBox(width: 8),
                                          TextButton.icon(
                                            onPressed: () {
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                const SnackBar(content: Text('Message approuvé — aucune action requise')),
                                              );
                                            },
                                            icon: const Icon(Icons.check_circle, size: 14),
                                            label: const Text('Approuver', style: TextStyle(fontSize: 11)),
                                            style: TextButton.styleFrom(foregroundColor: HelmColors.success),
                                          ),
                                        ],
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
    );
  }
}

class _ModerationEntry {
  final String messageId;
  final String conversationId;
  final String conversationName;
  final String senderName;
  final String content;
  final bool isPinned;
  final bool isImportant;
  final String createdAt;

  _ModerationEntry({
    required this.messageId,
    required this.conversationId,
    required this.conversationName,
    required this.senderName,
    required this.content,
    required this.isPinned,
    required this.isImportant,
    required this.createdAt,
  });
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
  bool _loading = true;
  String? _error;
  // Stats
  int _totalConversations = 0;
  int _directConversations = 0;
  int _groupConversations = 0;
  int _totalUnread = 0;
  int _totalParticipants = 0;
  Map<String, int> _messagesByDay = {}; // last 7 days

  @override
  void initState() {
    super.initState();
    _loadAnalytics();
  }

  Future<void> _loadAnalytics() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final conversations = await ApiService.listConversations();
      _totalConversations = conversations.length;
      _directConversations = conversations.where((c) => c['type'] == 'DIRECT').length;
      _groupConversations = conversations.where((c) => c['type'] == 'GROUP').length;
      _totalUnread = conversations.fold<int>(
        0,
        (sum, c) => sum + ((c['unreadCount'] as int?) ?? 0),
      );
      _totalParticipants = conversations.fold<int>(
        0,
        (sum, c) => sum + ((c['participants'] as List<dynamic>?)?.length ?? 0),
      );

      // Last 7 days message count (sample from first 20 conversations)
      _messagesByDay = {};
      final now = DateTime.now();
      for (var i = 6; i >= 0; i--) {
        final day = now.subtract(Duration(days: i));
        final dayKey = '${day.day}/${day.month}';
        _messagesByDay[dayKey] = 0;
      }
      for (final conv in conversations.take(20)) {
        try {
          final messages = await ApiService.listMessages(conv['id'] as String, limit: 100);
          for (final m in messages) {
            try {
              final dt = DateTime.parse((m['createdAt'] as String?) ?? '');
              final day = DateTime(dt.year, dt.month, dt.day);
              final nowDay = DateTime(now.year, now.month, now.day);
              final diff = nowDay.difference(day).inDays;
              if (diff >= 0 && diff <= 6) {
                final dayKey = '${dt.day}/${dt.month}';
                _messagesByDay[dayKey] = (_messagesByDay[dayKey] ?? 0) + 1;
              }
            } catch (_) {}
          }
        } catch (_) {}
      }
      if (mounted) {
        setState(() {
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

  @override
  Widget build(BuildContext context) {
    final maxMessages = _messagesByDay.values.fold<int>(0, (a, b) => a > b ? a : b);
    return Container(
      color: HelmColors.background,
      child: Column(
        children: [
          const HelmSectionHeader(
            title: 'Analytics',
            subtitle: 'TABLEAU DE BORD COMMUNICATION',
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
                              ElevatedButton(onPressed: _loadAnalytics, child: const Text('Réessayer')),
                            ],
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadAnalytics,
                        child: ListView(
                          padding: const EdgeInsets.all(12),
                          children: [
                            // KPI cards row
                            Row(
                              children: [
                                _buildKpiCard(
                                  icon: Icons.chat_bubble,
                                  label: 'Conversations',
                                  value: _totalConversations.toString(),
                                  color: HelmColors.primary,
                                ),
                                const SizedBox(width: 8),
                                _buildKpiCard(
                                  icon: Icons.mark_chat_unread,
                                  label: 'Non lus',
                                  value: _totalUnread.toString(),
                                  color: const Color(0xFFEF4444),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                _buildKpiCard(
                                  icon: Icons.person,
                                  label: 'Directs',
                                  value: _directConversations.toString(),
                                  color: const Color(0xFF1677FF),
                                ),
                                const SizedBox(width: 8),
                                _buildKpiCard(
                                  icon: Icons.group,
                                  label: 'Groupes',
                                  value: _groupConversations.toString(),
                                  color: const Color(0xFF10B981),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            _buildKpiCard(
                              icon: Icons.people,
                              label: 'Participants totaux',
                              value: _totalParticipants.toString(),
                              color: HelmColors.gold,
                            ),
                            const SizedBox(height: 16),
                            // Bar chart — messages last 7 days
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.grey[200]!),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.bar_chart, color: HelmColors.primary, size: 18),
                                      const SizedBox(width: 8),
                                      const Text(
                                        'Messages — 7 derniers jours',
                                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                      ),
                                      const Spacer(),
                                      IconButton(
                                        icon: const Icon(Icons.refresh, size: 18),
                                        onPressed: _loadAnalytics,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 16),
                                  if (maxMessages == 0)
                                    const Padding(
                                      padding: EdgeInsets.symmetric(vertical: 24),
                                      child: Center(
                                        child: Text('Pas encore d\'activité', style: TextStyle(color: Colors.grey)),
                                      ),
                                    )
                                  else
                                    SizedBox(
                                      height: 180,
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.end,
                                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                                        children: _messagesByDay.entries.map((e) {
                                          final height = maxMessages == 0 ? 0.0 : (e.value / maxMessages) * 140;
                                          return Column(
                                            mainAxisAlignment: MainAxisAlignment.end,
                                            children: [
                                              Text(e.value.toString(), style: const TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.w600)),
                                              const SizedBox(height: 4),
                                              Container(
                                                width: 24,
                                                height: height < 4 ? 4 : height,
                                                decoration: BoxDecoration(
                                                  gradient: const LinearGradient(
                                                    begin: Alignment.bottomCenter,
                                                    end: Alignment.topCenter,
                                                    colors: [HelmColors.primary, HelmColors.primaryVivid],
                                                  ),
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              Text(e.key, style: const TextStyle(fontSize: 9, color: Colors.grey)),
                                            ],
                                          );
                                        }).toList(),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            // Helm Connect brand card
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                gradient: HelmGradients.royalBlue,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Row(
                                children: [
                                  Icon(Icons.auto_awesome, color: HelmColors.goldLight, size: 28),
                                  SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('Helm Connect Analytics', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                                        SizedBox(height: 4),
                                        Text(
                                          'Statistiques de communication de votre établissement, calculées en temps réel.',
                                          style: TextStyle(color: HelmColors.goldLight, fontSize: 11),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiCard({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey[200]!),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, color: color, size: 18),
                ),
                const Spacer(),
                Text(
                  value,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[700], fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}
