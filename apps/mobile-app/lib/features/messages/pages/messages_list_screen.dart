import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/empty_state_widget.dart';
import '../../../core/widgets/error_widget.dart' as ah_error;
import '../providers/messages_provider.dart';
import '../widgets/message_card.dart';

/// Screen displaying messages from the school.
///
/// Features:
/// - Filter chips: Tous, Non lus, Urgents
/// - List of message cards
/// - Pull-to-refresh
/// - Unread count badge
/// - Loading/empty/error states
class MessagesListScreen extends ConsumerWidget {
  const MessagesListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedFilter = ref.watch(selectedMessageFilterProvider);
    final messagesAsync = ref.watch(messagesListProvider(selectedFilter));
    final unreadCountAsync = ref.watch(unreadMessagesCountProvider);

    return Scaffold(
      backgroundColor: AHColors.lightBackground,
      body: Column(
        children: [
          // ── Header ──────────────────────────────────────────────────
          _MessagesHeader(unreadCount: unreadCountAsync.valueOrNull ?? 0),

          // ── Filter Chips ────────────────────────────────────────────
          _MessageFilterChips(
            selectedFilter: selectedFilter,
            onFilterChanged: (filter) {
              ref.read(selectedMessageFilterProvider.notifier).state = filter;
            },
          ),

          // ── Messages List ──────────────────────────────────────────
          Expanded(
            child: messagesAsync.when(
              loading: () => const _MessagesListShimmer(),
              error: (error, _) => ah_error.AHErrorWidget(
                message: 'Impossible de charger les messages.',
                onRetry: () => ref.invalidate(messagesListProvider(selectedFilter)),
              ),
              data: (messages) {
                if (messages.isEmpty) {
                  return const AHEmptyState(
                    icon: Icons.mail_outlined,
                    title: 'Aucun message',
                    subtitle: 'Les communications de l\'école apparaîtront ici.',
                  );
                }
                return _MessagesListContent(messages: messages);
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────

class _MessagesHeader extends StatelessWidget {
  const _MessagesHeader({required this.unreadCount});

  final int unreadCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        AHSpacing.xl,
        AHSpacing.xl + 12,
        AHSpacing.xl,
        AHSpacing.lg,
      ),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AHColors.navy, AHColors.blue],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(AHSpacing.r20),
          bottomRight: Radius.circular(AHSpacing.r20),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back, color: AHColors.white),
              onPressed: () => context.pop(),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: AHSpacing.md),
            const Expanded(
              child: Text(
                'Messages',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AHColors.white,
                ),
              ),
            ),
            if (unreadCount > 0)
              Badge(
                label: Text('$unreadCount'),
                backgroundColor: AHColors.gold,
                textColor: AHColors.grey900,
                child: const Icon(
                  Icons.mail_outline,
                  color: AHColors.white,
                  size: 24,
                ),
              )
            else
              Container(
                padding: const EdgeInsets.all(AHSpacing.sm),
                decoration: BoxDecoration(
                  color: AHColors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(AHSpacing.r8),
                ),
                child: const Icon(
                  Icons.mail_outline,
                  color: AHColors.gold,
                  size: 24,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Filter Chips ──────────────────────────────────────────────────────

class _MessageFilterChips extends StatelessWidget {
  const _MessageFilterChips({
    required this.selectedFilter,
    required this.onFilterChanged,
  });

  final MessageFilter selectedFilter;
  final ValueChanged<MessageFilter> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.lg,
        vertical: AHSpacing.md,
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: MessageFilter.values.map((filter) {
            final isSelected = filter == selectedFilter;
            return Padding(
              padding: const EdgeInsets.only(right: AHSpacing.sm),
              child: FilterChip(
                selected: isSelected,
                label: Text(filter.label),
                onSelected: (_) => onFilterChanged(filter),
                backgroundColor: AHColors.lightSurface,
                selectedColor: AHColors.navy.withOpacity(0.12),
                checkmarkColor: AHColors.navy,
                labelStyle: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  color: isSelected ? AHColors.navy : AHColors.grey600,
                ),
                side: BorderSide(
                  color: isSelected
                      ? AHColors.navy.withOpacity(0.3)
                      : AHColors.lightOutline,
                  width: 1,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AHSpacing.r8),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: AHSpacing.md,
                  vertical: AHSpacing.xs,
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

// ── Messages List Content ─────────────────────────────────────────────

class _MessagesListContent extends ConsumerWidget {
  const _MessagesListContent({required this.messages});

  final List<Message> messages;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedFilter = ref.watch(selectedMessageFilterProvider);

    return RefreshIndicator(
      color: AHColors.navy,
      onRefresh: () async {
        ref.invalidate(messagesListProvider(selectedFilter));
        ref.invalidate(unreadMessagesCountProvider);
      },
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(
          top: AHSpacing.sm,
          bottom: AHSpacing.xxl,
        ),
        itemCount: messages.length,
        separatorBuilder: (_, __) => const SizedBox(height: AHSpacing.xs),
        itemBuilder: (context, index) {
          final message = messages[index];
          return MessageCard(
            message: message,
            onTap: () {
              // Mark as read and navigate to detail
              ref.read(messagesListProvider(selectedFilter).notifier).markAsRead(message.id);
              context.push('/messages/${message.id}');
            },
          );
        },
      ),
    );
  }
}

// ── Loading Shimmer ───────────────────────────────────────────────────

class _MessagesListShimmer extends StatelessWidget {
  const _MessagesListShimmer();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? AHColors.grey700 : AHColors.grey200,
      highlightColor: isDark ? AHColors.grey600 : AHColors.grey100,
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AHSpacing.lg),
        itemCount: 5,
        separatorBuilder: (_, __) => const SizedBox(height: AHSpacing.md),
        itemBuilder: (context, index) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AHSpacing.md),
            decoration: BoxDecoration(
              color: AHColors.white,
              borderRadius: BorderRadius.circular(AHSpacing.r12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 60,
                      height: 16,
                      decoration: BoxDecoration(
                        color: AHColors.white,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const Spacer(),
                    Container(
                      width: 40,
                      height: 10,
                      decoration: BoxDecoration(
                        color: AHColors.white,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AHSpacing.sm),
                Container(
                  width: double.infinity,
                  height: 14,
                  decoration: BoxDecoration(
                    color: AHColors.white,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: AHSpacing.sm),
                Container(
                  width: 120,
                  height: 10,
                  decoration: BoxDecoration(
                    color: AHColors.white,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: AHSpacing.sm),
                Container(
                  width: double.infinity,
                  height: 10,
                  decoration: BoxDecoration(
                    color: AHColors.white,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
