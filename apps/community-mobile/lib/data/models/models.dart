/// Modèles de données — membres, canaux (global + écoles + groupes),
/// messages (réactions, sondages) et événements (lives/formations).
library;

class CommunityMember {
  final String id;
  final String email;
  final String displayName;
  final String? organization;
  final String role; // SUPER_ADMIN | ADMIN | MODERATOR | MEMBER
  final String memberType; // PROSPECT | CLIENT | PARTNER | TEAM
  final String? avatarUrl;

  bool get isTeam => role == 'SUPER_ADMIN' || role == 'ADMIN' || role == 'MODERATOR';

  CommunityMember({
    required this.id,
    required this.email,
    required this.displayName,
    this.organization,
    required this.role,
    required this.memberType,
    this.avatarUrl,
  });

  factory CommunityMember.fromJson(Map<String, dynamic> j) => CommunityMember(
        id: j['id'] as String,
        email: j['email'] as String,
        displayName: (j['displayName'] ?? '') as String,
        organization: j['organization'] as String?,
        role: (j['role'] ?? 'MEMBER') as String,
        memberType: (j['memberType'] ?? 'PROSPECT') as String,
        avatarUrl: j['avatarUrl'] as String?,
      );
}

/// École rattachée au membre (source du dispatch écoles/groupes)
class CommunitySchool {
  final String tenantId;
  final String tenantName;
  final String? tenantSlug;
  final String schoolRole; // ADMIN | TEACHER

  CommunitySchool({
    required this.tenantId,
    required this.tenantName,
    this.tenantSlug,
    required this.schoolRole,
  });

  factory CommunitySchool.fromJson(Map<String, dynamic> j) => CommunitySchool(
        tenantId: j['tenantId'] as String,
        tenantName: (j['tenantName'] ?? '') as String,
        tenantSlug: j['tenantSlug'] as String?,
        schoolRole: (j['schoolRole'] ?? 'TEACHER') as String,
      );
}

/// Canal : GLOBAL (toutes les écoles) ou SCHOOL (salon/groupe d'une école)
class CommunityChannel {
  final String id;
  final String slug;
  final String name;
  final String? description;
  final String? icon;
  final String type; // TEXT | ANNOUNCEMENT | RESTRICTED
  final String scope; // GLOBAL | SCHOOL
  final String? tenantId;
  final String? tenantName;
  final String? groupKind; // SALON | ADMINS | TEACHERS | CUSTOM
  final int unread;
  final String? preview;
  final String? lastMessageAt;
  final bool canPost;

  bool get isSchool => scope == 'SCHOOL';
  bool get isGroup => groupKind == 'ADMINS' || groupKind == 'TEACHERS' || groupKind == 'CUSTOM';

  CommunityChannel({
    required this.id,
    required this.slug,
    required this.name,
    this.description,
    this.icon,
    required this.type,
    this.scope = 'GLOBAL',
    this.tenantId,
    this.tenantName,
    this.groupKind,
    this.unread = 0,
    this.preview,
    this.lastMessageAt,
    this.canPost = true,
  });

  factory CommunityChannel.fromJson(Map<String, dynamic> j) => CommunityChannel(
        id: j['id'] as String,
        slug: j['slug'] as String,
        name: j['name'] as String,
        description: j['description'] as String?,
        icon: j['icon'] as String?,
        type: (j['type'] ?? 'TEXT') as String,
        scope: (j['scope'] ?? 'GLOBAL') as String,
        tenantId: j['tenantId'] as String?,
        tenantName: j['tenantName'] as String?,
        groupKind: j['groupKind'] as String?,
        unread: (j['unread'] ?? 0) as int,
        preview: j['preview'] as String?,
        lastMessageAt: j['lastMessageAt'] as String?,
        canPost: (j['canPost'] ?? true) as bool,
      );
}

/// Réponse GET /community/channels — regroupement structuré v2
class ChannelsResponse {
  final List<CommunityChannel> channels;
  final List<CommunityChannel> globalChannels;
  final List<SchoolSection> schoolSections;
  final List<CommunitySchool> schools;

  ChannelsResponse({
    required this.channels,
    required this.globalChannels,
    required this.schoolSections,
    required this.schools,
  });

  factory ChannelsResponse.fromJson(Map<String, dynamic> j) => ChannelsResponse(
        channels: ((j['channels'] ?? []) as List).map((c) => CommunityChannel.fromJson(c)).toList(),
        globalChannels: ((j['globalChannels'] ?? []) as List).map((c) => CommunityChannel.fromJson(c)).toList(),
        schoolSections: ((j['schoolSections'] ?? []) as List).map((s) => SchoolSection.fromJson(s)).toList(),
        schools: ((j['schools'] ?? []) as List).map((s) => CommunitySchool.fromJson(s)).toList(),
      );
}

class SchoolSection {
  final String tenantId;
  final String tenantName;
  final List<CommunityChannel> channels;

  SchoolSection({required this.tenantId, required this.tenantName, required this.channels});

  factory SchoolSection.fromJson(Map<String, dynamic> j) => SchoolSection(
        tenantId: j['tenantId'] as String,
        tenantName: (j['tenantName'] ?? '') as String,
        channels: ((j['channels'] ?? []) as List).map((c) => CommunityChannel.fromJson(c)).toList(),
      );
}

class MessageReactionGroup {
  final String emoji;
  int count;
  bool mine;

  MessageReactionGroup({required this.emoji, required this.count, required this.mine});
}

class PollOption {
  final String id;
  final String label;
  int votes;
  bool mine;

  PollOption({required this.id, required this.label, this.votes = 0, this.mine = false});
}

class Poll {
  final String id;
  final String question;
  final bool isMulti;
  final List<PollOption> options;

  Poll({required this.id, required this.question, required this.isMulti, required this.options});
}

class CommunityMessage {
  final String id;
  final String channelId;
  final String type; // TEXT | ANNOUNCEMENT | POLL | SYSTEM
  final String? content;
  final String? replyToId;
  final String? replyToContent;
  final String? replyToAuthor;
  final bool isPinned;
  final bool isEdited;
  final String createdAt;
  final String authorId;
  final String authorName;
  final String authorRole;
  final String authorType;
  final Map<String, MessageReactionGroup> reactions;
  final Poll? poll;
  final bool mine;

  CommunityMessage({
    required this.id,
    required this.channelId,
    required this.type,
    this.content,
    this.replyToId,
    this.replyToContent,
    this.replyToAuthor,
    this.isPinned = false,
    this.isEdited = false,
    required this.createdAt,
    required this.authorId,
    required this.authorName,
    this.authorRole = 'MEMBER',
    this.authorType = 'PROSPECT',
    required this.reactions,
    this.poll,
    required this.mine,
  });

  factory CommunityMessage.fromJson(Map<String, dynamic> j, String viewerId) {
    final reactions = <String, MessageReactionGroup>{};
    ((j['reactions'] ?? {}) as Map).forEach((emoji, info) {
      final raw = info as Map;
      reactions[emoji as String] = MessageReactionGroup(
        emoji: emoji,
        count: (raw['count'] ?? 0) as int,
        mine: (raw['mine'] ?? false) as bool,
      );
    });
    Poll? poll;
    if (j['poll'] != null && (j['poll'] as Map).isNotEmpty) {
      final p = j['poll'] as Map;
      poll = Poll(
        id: p['id'] as String,
        question: p['question'] as String,
        isMulti: (p['isMulti'] ?? false) as bool,
        options: ((p['options'] ?? []) as List)
            .map((o) => PollOption(id: o['id'] as String, label: o['label'] as String))
            .toList(),
      );
    }
    final author = (j['author'] ?? {}) as Map;
    final reply = j['replyTo'] as Map?;
    return CommunityMessage(
      id: j['id'] as String,
      channelId: (j['channelId'] ?? '') as String,
      type: (j['type'] ?? 'TEXT') as String,
      content: j['content'] as String?,
      replyToId: j['replyToId'] as String?,
      replyToContent: reply?['content'] as String?,
      replyToAuthor: null,
      isPinned: (j['isPinned'] ?? false) as bool,
      isEdited: (j['isEdited'] ?? false) as bool,
      createdAt: j['createdAt'] as String,
      authorId: (author['id'] ?? '') as String,
      authorName: (author['displayName'] ?? 'Membre') as String,
      authorRole: (author['role'] ?? 'MEMBER') as String,
      authorType: (author['memberType'] ?? 'PROSPECT') as String,
      reactions: reactions,
      poll: poll,
      mine: (author['id'] == viewerId),
    );
  }
}

/// Live / formation / atelier (dispatch par audience)
class CommunityEvent {
  final String id;
  final String kind; // LIVE | FORMATION | ATELIER
  final String title;
  final String? description;
  final String audience; // GLOBAL | SCHOOL | GROUP
  final String? tenantName;
  final String? groupKind; // ADMINS | TEACHERS
  final String? channelSlug;
  final String? channelName;
  final String? hostName;
  final String? externalUrl;
  final String? replayUrl;
  final String scheduledAt;
  final String status; // SCHEDULED | LIVE | ENDED | CANCELLED
  final bool isLive;

  CommunityEvent({
    required this.id,
    required this.kind,
    required this.title,
    this.description,
    required this.audience,
    this.tenantName,
    this.groupKind,
    this.channelSlug,
    this.channelName,
    this.hostName,
    this.externalUrl,
    this.replayUrl,
    required this.scheduledAt,
    required this.status,
    this.isLive = false,
  });

  factory CommunityEvent.fromJson(Map<String, dynamic> j) => CommunityEvent(
        id: j['id'] as String,
        kind: (j['kind'] ?? 'LIVE') as String,
        title: j['title'] as String,
        description: j['description'] as String?,
        audience: (j['audience'] ?? 'GLOBAL') as String,
        tenantName: j['tenantName'] as String?,
        groupKind: j['groupKind'] as String?,
        channelSlug: j['channelSlug'] as String?,
        channelName: j['channelName'] as String?,
        hostName: j['hostName'] as String?,
        externalUrl: j['externalUrl'] as String?,
        replayUrl: j['replayUrl'] as String?,
        scheduledAt: j['scheduledAt'] as String,
        status: (j['status'] ?? 'SCHEDULED') as String,
        isLive: (j['isLive'] ?? false) as bool,
      );

  String get audienceLabel {
    if (audience == 'GLOBAL') return 'Toutes les écoles';
    if (audience == 'SCHOOL') return tenantName ?? 'École';
    final group = groupKind == 'ADMINS' ? 'Administrateurs' : 'Enseignants';
    return '$group · ${tenantName ?? ''}';
  }
}
