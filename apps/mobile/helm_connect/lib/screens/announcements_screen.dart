// ============================================================================
// HELM CONNECT — Announcements Screen (mobile)
// ============================================================================
// Liste des annonces officielles avec badges priorité + accusé de lecture.
// ============================================================================

import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/api_service.dart';

class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  List<Announcement> _announcements = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await ApiService.listAnnouncements();
      setState(() {
        _announcements = json.map((a) => Announcement.fromJson(a)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Annonces officielles')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _announcements.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 200),
                        Center(child: Icon(Icons.campaign_outlined, size: 64, color: Color(0xFF94A3B8))),
                        SizedBox(height: 16),
                        Center(child: Text('Aucune annonce pour le moment', style: TextStyle(color: Color(0xFF667085)))),
                      ],
                    )
                  : ListView.builder(
                      itemCount: _announcements.length,
                      itemBuilder: (context, index) {
                        final a = _announcements[index];
                        return _buildAnnouncementCard(a);
                      },
                    ),
            ),
    );
  }

  Widget _buildAnnouncementCard(Announcement a) {
    Color badgeColor;
    String badgeText;
    IconData badgeIcon;
    switch (a.priority) {
      case 'URGENT':
        badgeColor = const Color(0xFFDC2626);
        badgeText = 'URGENT';
        badgeIcon = Icons.priority_high;
        break;
      case 'HIGH':
        badgeColor = const Color(0xFFF59E0B);
        badgeText = 'IMPORTANT';
        badgeIcon = Icons.warning_amber;
        break;
      case 'NORMAL':
      default:
        badgeColor = const Color(0xFF1677FF);
        badgeText = 'ANNONCE';
        badgeIcon = Icons.campaign;
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: badgeColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(badgeIcon, size: 12, color: badgeColor),
                      const SizedBox(width: 4),
                      Text(
                        badgeText,
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: badgeColor),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                if (a.publishedAt != null)
                  Text(
                    _formatDate(a.publishedAt!),
                    style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(a.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF172033))),
            const SizedBox(height: 4),
            Text(a.body, style: const TextStyle(fontSize: 14, color: Color(0xFF475569))),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.person_outline, size: 14, color: Color(0xFF94A3B8)),
                const SizedBox(width: 4),
                Text(a.authorName, style: const TextStyle(fontSize: 11, color: Color(0xFF667085))),
                const Spacer(),
                if (a.totalRecipients > 0) ...[
                  const Icon(Icons.visibility_outlined, size: 14, color: Color(0xFF94A3B8)),
                  const SizedBox(width: 4),
                  Text(
                    '${a.readCount}/${a.totalRecipients} lus',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF667085)),
                  ),
                ],
              ],
            ),
            if (a.requiresConfirmation && !a.confirmedByCurrentUser)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _confirmRead(a),
                    icon: const Icon(Icons.check, size: 16),
                    label: const Text('Confirmer avoir lu'),
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF59E0B)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmRead(Announcement a) async {
    // V2: call /api/chat/announcements/:id/confirm
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Annonce marquée comme lue ✓')),
    );
    _load();
  }

  String _formatDate(DateTime dt) {
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year} à ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}
