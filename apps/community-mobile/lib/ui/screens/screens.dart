/// Écrans de l'app — splash, login, home shell (3 onglets),
/// conversations groupées, chat, lives & événements, profil.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../data/models/models.dart';
import '../../state/controllers.dart';
import '../widgets/widgets.dart';

// ═══════════════════════ SPLASH ═══════════════════════

class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // La restauration de session (AuthController) déclenche le redirect
    // via refreshListenable dès qu'elle aboutit — aucun push manuel ici.
    return Scaffold(
      backgroundColor: const Color(0xFF0B2F73),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: const Color(0xFFD4A73C),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Center(
                child: Text('A', style: TextStyle(color: Color(0xFF0B2F73), fontSize: 36, fontWeight: FontWeight.w900)),
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Academia Community',
              style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            const Text(
              'L\u2019espace communautaire des écoles',
              style: TextStyle(color: Color(0x99FFFFFF), fontSize: 13),
            ),
            const SizedBox(height: 28),
            const SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(color: Color(0xFFD4A73C), strokeWidth: 2.5),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════ LOGIN ═══════════════════════

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_email.text.trim().isEmpty || _password.text.isEmpty) return;
    setState(() => _busy = true);
    final ok = await ref.read(authProvider.notifier).login(_email.text, _password.text);
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      context.go('/home');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.read(authProvider).error ?? 'Connexion impossible')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  alignment: Alignment.center,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0B2F73),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Text('A', style: TextStyle(color: Color(0xFFD4A73C), fontSize: 32, fontWeight: FontWeight.w900)),
                ),
                const Text(
                  'Academia Community',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF0B2F73)),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Conseils, formations et lives — votre école et vos groupes, automatiquement.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 32),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.alternate_email_rounded),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _password,
                  obscureText: true,
                  onSubmitted: (_) => _submit(),
                  decoration: const InputDecoration(
                    labelText: 'Mot de passe',
                    prefixIcon: Icon(Icons.lock_outline_rounded),
                  ),
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: _busy ? null : _submit,
                  icon: _busy
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.login_rounded),
                  label: Text(_busy ? 'Connexion…' : 'Entrer dans la communauté'),
                ),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0F4FB),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Column(
                    children: [
                      Text('💡 Comptes écoles', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: Color(0xFF0B2F73))),
                      SizedBox(height: 6),
                      Text(
                        'Administrateurs et enseignants : connectez-vous avec les identifiants de votre compte Academia Helm — votre école, le groupe administrateurs et le groupe enseignants sont ajoutés automatiquement.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 11.5, color: Color(0xFF475569), height: 1.4),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════ HOME SHELL ═══════════════════════

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [const ConversationsScreen(), const EventsScreen(), const ProfileScreen()];
    final unread = context.watch(channelsProvider).totalUnread;
    final liveCount = context.watch(eventsProvider).lives.length;

    return Scaffold(
      body: screens[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          NavigationDestination(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.forum_outlined),
            ),
            selectedIcon: const Icon(Icons.forum_rounded),
            label: 'Discussions',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: liveCount > 0,
              label: const Text('●'),
              backgroundColor: Colors.red,
              child: const Icon(Icons.podcasts_outlined),
            ),
            selectedIcon: const Icon(Icons.podcasts_rounded),
            label: 'Lives',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════ CONVERSATIONS ═══════════════════════

class ConversationsScreen extends ConsumerWidget {
  const ConversationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(channelsProvider);
    final member = ref.watch(authProvider).member;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Academia Community'),
            if (member != null)
              Text(
                member.displayName,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w400, color: Color(0xCCFFFFFF)),
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(channelsProvider.notifier).refresh(),
          ),
        ],
      ),
      body: state.loading
          ? const Center(child: CircularProgressIndicator())
          : state.error != null && state.data == null
              ? _ErrorView(message: state.error!, onRetry: () => ref.read(channelsProvider.notifier).refresh())
              : RefreshIndicator(
                  onRefresh: () => ref.read(channelsProvider.notifier).refresh(),
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    children: [
                      if (state.data != null) ...[
                        _SectionHeader(
                          icon: Icons.public_rounded,
                          title: 'Toutes les écoles',
                          subtitle: 'Annonces générales, conseils et formations',
                        ),
                        ...state.data!.globalChannels.map(
                          (c) => ChannelTile(channel: c, onTap: () => context.go('/home/chat/${c.slug}')),
                        ),
                        ...state.data!.schoolSections.map((section) => Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _SectionHeader(
                                  icon: Icons.school_rounded,
                                  title: section.tenantName,
                                  subtitle: 'Salon de l\u2019école et ses groupes',
                                ),
                                ...section.channels.map(
                                  (c) => ChannelTile(channel: c, onTap: () => context.go('/home/chat/${c.slug}')),
                                ),
                              ],
                            )),
                        if (state.data!.schoolSections.isEmpty)
                          const Padding(
                            padding: EdgeInsets.all(24),
                            child: _HintCard(
                              icon: Icons.school_outlined,
                              text:
                                  'Votre école n\u2019est pas encore rattachée. Administrateurs et enseignants la rejoignent automatiquement avec leur compte Academia Helm.',
                            ),
                          ),
                      ],
                    ],
                  ),
                ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _SectionHeader({required this.icon, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          Icon(icon, size: 15, color: const Color(0xFF64748B)),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title.toUpperCase(),
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: Color(0xFF64748B))),
                Text(subtitle, style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HintCard extends StatelessWidget {
  final IconData icon;
  final String text;

  const _HintCard({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFF94A3B8)),
            const SizedBox(width: 12),
            Expanded(child: Text(text, style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B), height: 1.4))),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 44, color: Color(0xFFCBD5E1)),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
            const SizedBox(height: 16),
            FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh_rounded), label: const Text('Réessayer')),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════ CHAT ═══════════════════════

class ChatScreen extends ConsumerStatefulWidget {
  final String slug;

  const ChatScreen({super.key, required this.slug});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  CommunityMessage? _replyTo;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(chatProvider.notifier).open(widget.slug));
  }

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _jumpToBottom() {
    if (_scroll.hasClients) {
      _scroll.animateTo(
        _scroll.position.maxScrollExtent + 80,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    _controller.clear();
    final reply = _replyTo;
    setState(() => _replyTo = null);
    await ref.read(chatProvider.notifier).send(text, replyToId: reply?.id);
    _jumpToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatProvider);
    final channel = state.channel;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Text(
              channel == null
                  ? '…'
                  : channel.groupKind == 'ADMINS'
                      ? '🛡️'
                      : channel.groupKind == 'TEACHERS'
                          ? '👨‍🏫'
                          : (channel.icon ?? '💬'),
              style: const TextStyle(fontSize: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    channel?.name ?? 'Chargement…',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 16),
                  ),
                  if (channel?.scope == 'SCHOOL')
                    Text(
                      '🏫 ${channel?.tenantName ?? ''}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 10.5, color: Color(0xB3FFFFFF)),
                    )
                  else
                    const Text(
                      'Toutes les écoles',
                      style: TextStyle(fontSize: 10.5, color: Color(0xB3FFFFFF)),
                    ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.poll_rounded),
            tooltip: 'Lives & événements',
            onPressed: () => context.go('/home'),
          ),
        ],
      ),
      body: Column(
        children: [
          // Messages
          Expanded(
            child: state.loading
                ? const Center(child: CircularProgressIndicator())
                : state.messages.isEmpty
                    ? _EmptyChat(canPost: channel?.canPost ?? false)
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                        itemCount: state.messages.length,
                        itemBuilder: (context, i) {
                          final m = state.messages[i];
                          return MessageBubble(
                            message: m,
                            onReact: (emoji) => ref.read(chatProvider.notifier).react(m.id, emoji),
                            onReply: () => setState(() {
                              _replyTo = m;
                              FocusScope.of(context).requestFocus();
                            }),
                            onVote: (optionId) => ref.read(chatProvider.notifier).vote(m.id, optionId),
                          );
                        },
                      ),
          ),
          // Bandeau réponse
          if (_replyTo != null)
            Container(
              color: const Color(0xFFF0F4FB),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  const Icon(Icons.reply_rounded, size: 16, color: Color(0xFF0B2F73)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Réponse à : ${_replyTo!.content?.take(80) ?? '(sondage)'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 16),
                    onPressed: () => setState(() => _replyTo = null),
                  ),
                ],
              ),
            ),
          // Composer
          if (channel?.canPost ?? false)
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        minLines: 1,
                        maxLines: 4,
                        textInputAction: TextInputAction.newline,
                        onSubmitted: (_) => _send(),
                        decoration: InputDecoration(
                          hintText: 'Message dans ${channel?.name ?? ''}…',
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    CircleAvatar(
                      radius: 25,
                      backgroundColor: const Color(0xFF0B2F73),
                      child: IconButton(
                        icon: state.sending
                            ? const SizedBox(
                                width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                        onPressed: state.sending ? null : _send,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            const SafeArea(
              top: false,
              child: Padding(
                padding: EdgeInsets.all(14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.campaign_rounded, size: 15, color: Color(0xFFD97706)),
                    SizedBox(width: 8),
                    Text('Canal d\u2019annonces — réagissez aux publications', style: TextStyle(fontSize: 12, color: Color(0xFFB45309))),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _EmptyChat extends StatelessWidget {
  final bool canPost;

  const _EmptyChat({required this.canPost});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.chat_bubble_outline_rounded, size: 44, color: const Color(0xFFCBD5E1)),
            const SizedBox(height: 12),
            const Text('Canal silencieux pour l\u2019instant', style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
            const SizedBox(height: 4),
            Text(
              canPost ? 'Lancez la discussion !' : 'Les publications de l\u2019équipe arriveront ici.',
              style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════ LIVES & ÉVÉNEMENTS ═══════════════════════

class EventsScreen extends ConsumerWidget {
  const EventsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(eventsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lives & événements'),
      ),
      body: state.loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () => ref.read(eventsProvider.notifier).refresh(),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(14),
                children: [
                  if (state.lives.isNotEmpty) ...[
                    const _EventsHeader(title: 'En direct maintenant', color: Color(0xFFDC2626)),
                    ...state.lives.map((e) => EventCard(event: e)),
                    const SizedBox(height: 18),
                  ],
                  const _EventsHeader(title: 'À venir', color: Color(0xFF0B2F73)),
                  if (state.upcoming.isEmpty && state.lives.isEmpty)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          children: [
                            const Icon(Icons.event_busy_rounded, size: 40, color: Color(0xFFCBD5E1)),
                            const SizedBox(height: 10),
                            const Text('Aucun événement programmé', style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                            const SizedBox(height: 4),
                            const Text(
                              'Les lives et formations de l\u2019équipe apparaîtront ici.',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    ...state.upcoming.map((e) => EventCard(event: e)),
                ],
              ),
            ),
    );
  }
}

class _EventsHeader extends StatelessWidget {
  final String title;
  final Color color;

  const _EventsHeader({required this.title, required this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 6, bottom: 10, top: 6),
      child: Text(title.toUpperCase(),
          style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: color)),
    );
  }
}

// ═══════════════════════ PROFIL ═══════════════════════

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final member = ref.watch(authProvider).member;
    final schools = ref.watch(channelsProvider).data?.schools ?? [];

    return Scaffold(
      appBar: AppBar(title: const Text('Mon profil')),
      body: member == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(18),
              children: [
                Center(
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 38,
                        backgroundColor: const Color(0xFF0B2F73),
                        child: Text(
                          member.displayName.isNotEmpty ? member.displayName.substring(0, 1).toUpperCase() : '?',
                          style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFFD4A73C)),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(member.displayName, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                      Text(member.email, style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B))),
                      const SizedBox(height: 8),
                      _TypeBadge(type: member.memberType, team: member.isTeam),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                if (schools.isNotEmpty) ...[
                  const Text('MES ÉCOLES',
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: Color(0xFF64748B))),
                  const SizedBox(height: 8),
                  ...schools.map((s) => Card(
                        child: ListTile(
                          leading: Text(s.schoolRole == 'ADMIN' ? '🛡️' : '👨‍🏫', style: const TextStyle(fontSize: 22)),
                          title: Text(s.tenantName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          subtitle: Text(
                            s.schoolRole == 'ADMIN' ? 'Administrateur de l\u2019école' : 'Enseignant de l\u2019école',
                            style: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                          ),
                        ),
                      )),
                  const SizedBox(height: 14),
                ],
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Vos canaux', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        Text(
                          'Chaque école dispose de son salon (annonces générales), de son groupe administrateurs et de son groupe enseignants — vous voyez ceux qui vous concernent.',
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), height: 1.4),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFDC2626),
                    minimumSize: const Size.fromHeight(50),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: const Icon(Icons.logout_rounded),
                  label: const Text('Se déconnecter'),
                  onPressed: () async {
                    await ref.read(authProvider.notifier).logout();
                    if (context.mounted) context.go('/login');
                  },
                ),
              ],
            ),
    );
  }
}

class _TypeBadge extends StatelessWidget {
  final String type;
  final bool team;

  const _TypeBadge({required this.type, required this.team});

  @override
  Widget build(BuildContext context) {
    final labels = {
      'PROSPECT': ('Prospect', Color(0xFFD97706)),
      'CLIENT': ('Client', Color(0xFF059669)),
      'PARTNER': ('Partenaire', Color(0xFF2563EB)),
      'TEAM': ('Équipe Academia Helm', Color(0xFF0B2F73)),
    };
    final (label, color) = labels[type] ?? (type, const Color(0xFF64748B));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

// Utilitaire partagé (formatage dates)
String formatEventDate(String iso) {
  try {
    final dt = DateTime.parse(iso).toLocal();
    return DateFormat('EEE d MMM · HH:mm', 'fr_FR').format(dt);
  } catch (_) {
    return iso;
  }
}
