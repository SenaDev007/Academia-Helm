import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../providers/parent_provider.dart';

/// Messages screen — mirrors the web's /app/parent/messages.
///
/// 3 sub-tabs:
/// 1. Notifications (list + mark as read + mark all)
/// 2. Annonces (school announcements)
/// 3. Contacter l'école (school contact info)
class ParentMessagesScreen extends ConsumerStatefulWidget {
  const ParentMessagesScreen({super.key, this.schoolName = '', this.schoolPhone = '', this.schoolEmail = '', this.schoolAddress = ''});

  final String schoolName;
  final String schoolPhone;
  final String schoolEmail;
  final String schoolAddress;

  @override
  ConsumerState<ParentMessagesScreen> createState() => _ParentMessagesScreenState();
}

class _ParentMessagesScreenState extends ConsumerState<ParentMessagesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AHColors.navy,
        elevation: 0,
        title: const Text('Messages', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.of(context).pop()),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AHColors.navy,
          unselectedLabelColor: AHColors.grey400,
          indicatorColor: AHColors.gold,
          tabs: const [Tab(text: 'Notifications'), Tab(text: 'Annonces'), Tab(text: 'Contact')],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _NotificationsTab(),
          _AnnouncementsTab(),
          _ContactTab(
            schoolName: widget.schoolName,
            schoolPhone: widget.schoolPhone,
            schoolEmail: widget.schoolEmail,
            schoolAddress: widget.schoolAddress,
          ),
        ],
      ),
    );
  }
}

// ── Tab 1: Notifications ─────────────────────────────────────────────────

class _NotificationsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifAsync = ref.watch(parentNotificationsProvider(50));

    return notifAsync.when(
      data: (notifications) {
        if (notifications.isEmpty) return _buildEmpty('Aucune notification');
        final unread = notifications.where((n) => !n.isRead).length;
        return Column(
          children: [
            if (unread > 0)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                color: const Color(0xFFEFF6FF),
                child: Row(children: [
                  Text('$unread non lue${unread > 1 ? 's' : ''}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AHColors.blue)),
                  const Spacer(),
                  TextButton(
                    onPressed: () async {
                      final service = ref.read(parentServiceProvider);
                      await service.markAllNotificationsRead();
                      ref.invalidate(parentNotificationsProvider(50));
                    },
                    child: const Text('Tout marquer lu', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                  ),
                ]),
              ),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(AHSpacing.sm),
                itemCount: notifications.length,
                itemBuilder: (context, index) => _NotificationTile(notification: notifications[index], onTap: () async {
                  if (!notifications[index].isRead) {
                    final service = ref.read(parentServiceProvider);
                    await service.markNotificationRead(notificationId: notifications[index].id);
                    ref.invalidate(parentNotificationsProvider(50));
                  }
                }),
              ),
            ),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
      error: (_, __) => _buildEmpty('Erreur de chargement'),
    );
  }

  Widget _buildEmpty(String msg) {
    return Center(child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.notifications_none, size: 48, color: AHColors.grey300),
        const SizedBox(height: 8),
        Text(msg, style: TextStyle(fontSize: 13, color: AHColors.grey500)),
      ],
    ));
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onTap});
  final ParentNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: notification.isRead ? Colors.white : const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: notification.isRead ? const Color(0xFFE2E8F0) : const Color(0xFFBFDBFE)),
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (!notification.isRead)
            Container(width: 6, height: 6, margin: const EdgeInsets.only(top: 4), decoration: const BoxDecoration(color: AHColors.blue, shape: BoxShape.circle)),
          if (!notification.isRead) const SizedBox(width: 8),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(notification.title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
            if (notification.body.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(notification.body, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)), maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
            if (notification.createdAt != null) ...[
              const SizedBox(height: 2),
              Text(_formatDate(notification.createdAt!), style: const TextStyle(fontSize: 9, color: AHColors.grey400)),
            ],
          ])),
        ]),
      ),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inMinutes < 1) return 'À l\'instant';
    if (diff.inHours < 1) return 'Il y a ${diff.inMinutes}min';
    if (diff.inDays < 1) return 'Il y a ${diff.inHours}h';
    if (diff.inDays < 7) return 'Il y a ${diff.inDays}j';
    return '${date.day}/${date.month}/${date.year}';
  }
}

// ── Tab 2: Annonces ──────────────────────────────────────────────────────

class _AnnouncementsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final announcementsAsync = ref.watch(parentAnnouncementsProvider(20));

    return announcementsAsync.when(
      data: (announcements) {
        if (announcements.isEmpty) return _buildEmpty();
        return ListView.builder(
          padding: const EdgeInsets.all(AHSpacing.sm),
          itemCount: announcements.length,
          itemBuilder: (context, index) => _AnnouncementTile(announcement: announcements[index]),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
      error: (_, __) => _buildEmpty(),
    );
  }

  Widget _buildEmpty() {
    return Center(child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.campaign, size: 48, color: AHColors.grey300),
        const SizedBox(height: 8),
        const Text('Aucune annonce', style: TextStyle(fontSize: 13, color: AHColors.grey500)),
      ],
    ));
  }
}

class _AnnouncementTile extends StatelessWidget {
  const _AnnouncementTile({required this.announcement});
  final ParentAnnouncement announcement;

  @override
  Widget build(BuildContext context) {
    final isHigh = announcement.priority.contains('high') || announcement.priority.contains('critical');
    final color = isHigh ? const Color(0xFFDC2626) : AHColors.navy;

    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(isHigh ? Icons.priority_high : Icons.campaign, size: 16, color: color),
          const SizedBox(width: 4),
          Expanded(child: Text(announcement.title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color))),
        ]),
        if (announcement.body.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(announcement.body, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)), maxLines: 3, overflow: TextOverflow.ellipsis),
        ],
        if (announcement.publishedAt != null) ...[
          const SizedBox(height: 2),
          Text('${announcement.publishedAt!.day}/${announcement.publishedAt!.month}/${announcement.publishedAt!.year}', style: const TextStyle(fontSize: 9, color: AHColors.grey400)),
        ],
      ]),
    );
  }
}

// ── Tab 3: Contacter l'école ───────────────────────────────────────────

class _ContactTab extends StatelessWidget {
  const _ContactTab({this.schoolName = '', this.schoolPhone = '', this.schoolEmail = '', this.schoolAddress = ''});

  final String schoolName;
  final String schoolPhone;
  final String schoolEmail;
  final String schoolAddress;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AHSpacing.md),
      child: Column(children: [
        // School banner
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AHSpacing.lg),
          decoration: BoxDecoration(gradient: LinearGradient(colors: [const Color(0xFF2563EB), const Color(0xFF7C3AED)]), borderRadius: BorderRadius.circular(12)),
          child: Column(children: [
            const Icon(Icons.school, size: 32, color: Colors.white),
            const SizedBox(height: 4),
            Text(schoolName.isEmpty ? 'Votre école' : schoolName, textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
          ]),
        ),
        const SizedBox(height: AHSpacing.md),
        // Info box
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFFDE68A))),
          child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.info_outline, size: 16, color: Color(0xFF92400E)),
              SizedBox(width: 4),
              Text('Informations', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF92400E))),
            ]),
            SizedBox(height: 4),
            Text('Pour toute question pédagogique, contactez l\'enseignant de votre enfant.\nPour toute question administrative, contactez l\'administration.',
              style: TextStyle(fontSize: 10, color: Color(0xFF92400E))),
          ]),
        ),
        const SizedBox(height: AHSpacing.md),
        // Contact cards
        if (schoolPhone.isNotEmpty)
          _ContactCard(icon: Icons.phone, label: 'Téléphone', value: schoolPhone, color: const Color(0xFF16A34A)),
        if (schoolEmail.isNotEmpty)
          _ContactCard(icon: Icons.email, label: 'Email', value: schoolEmail, color: const Color(0xFF2563EB)),
        if (schoolAddress.isNotEmpty)
          _ContactCard(icon: Icons.location_on, label: 'Adresse', value: schoolAddress, color: const Color(0xFFDC2626)),
      ]),
    );
  }
}

class _ContactCard extends StatelessWidget {
  const _ContactCard({required this.icon, required this.label, required this.value, required this.color});
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(children: [
        Container(width: 36, height: 36, decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
          child: Icon(icon, size: 18, color: color)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
        ])),
      ]),
    );
  }
}
