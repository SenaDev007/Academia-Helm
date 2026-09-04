// ============================================================================
// HELM CONNECT — Data models
// ============================================================================

class User {
  final String id;
  final String email;
  final String? firstName;
  final String? lastName;
  final String role;
  final String? tenantId;
  final String? tenantName;
  final String? avatarUrl;
  final bool isPlatformOwner;

  User({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
    required this.role,
    this.tenantId,
    this.tenantName,
    this.avatarUrl,
    this.isPlatformOwner = false,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      role: json['role'] as String? ?? '',
      tenantId: json['tenantId'] as String?,
      tenantName: json['tenantName'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      isPlatformOwner: json['isPlatformOwner'] as bool? ?? false,
    );
  }

  String get fullName => '${firstName ?? ''} ${lastName ?? ''}'.trim();
  String get initials {
    final fn = (firstName?.isNotEmpty ?? false) ? firstName![0] : '';
    final ln = (lastName?.isNotEmpty ?? false) ? lastName![0] : '';
    return '$fn$ln'.toUpperCase();
  }
}

class Tenant {
  final String id;
  final String slug;
  final String name;
  final String? subdomain;
  final String? logoUrl;

  Tenant({
    required this.id,
    required this.slug,
    required this.name,
    this.subdomain,
    this.logoUrl,
  });

  factory Tenant.fromJson(Map<String, dynamic> json) {
    return Tenant(
      id: json['id'] as String,
      slug: json['slug'] as String? ?? '',
      name: json['name'] as String? ?? '',
      subdomain: json['subdomain'] as String?,
      logoUrl: json['logoUrl'] as String?,
    );
  }
}

class Conversation {
  final String id;
  final String type; // DIRECT | GROUP | CHANNEL
  final String? name;
  final String? description;
  final String? avatarUrl;
  final String createdBy;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? lastMessageAt;
  final String? lastMessagePreview;
  final String? lastMessageSenderId;
  final int unreadCount;
  final List<Participant> participants;
  final bool isMuted;
  // ⭐ V6.1/V7 (parité web — badges d'appels dans la liste) :
  //   type du dernier message (CALL_LOG, AUDIO, TEXT…), statut et sens
  //   de l'appel pour les pastilles rouges/ambre/gris/vert.
  final String? lastMessageType;
  final String? lastMessageCallType;
  final String? lastMessageCallStatus;
  final bool? lastMessageSentByMe;

  Conversation({
    required this.id,
    required this.type,
    this.name,
    this.description,
    this.avatarUrl,
    required this.createdBy,
    required this.createdAt,
    required this.updatedAt,
    this.lastMessageAt,
    this.lastMessagePreview,
    this.lastMessageSenderId,
    this.unreadCount = 0,
    this.participants = const [],
    this.isMuted = false,
    this.lastMessageType,
    this.lastMessageCallType,
    this.lastMessageCallStatus,
    this.lastMessageSentByMe,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] as String,
      type: json['type'] as String? ?? 'DIRECT',
      name: json['name'] as String?,
      description: json['description'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      createdBy: json['createdBy'] as String? ?? '',
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      lastMessageAt: json['lastMessageAt'] != null ? DateTime.parse(json['lastMessageAt'] as String) : null,
      lastMessagePreview: json['lastMessagePreview'] as String?,
      lastMessageSenderId: json['lastMessageSenderId'] as String?,
      unreadCount: json['unreadCount'] as int? ?? 0,
      participants: (json['participants'] as List<dynamic>?)
              ?.map((p) => Participant.fromJson(p as Map<String, dynamic>))
              .toList() ??
          [],
      isMuted: json['isMuted'] as bool? ?? false,
      lastMessageType: json['lastMessageType'] as String?,
      lastMessageCallType: json['lastMessageCallType'] as String?,
      lastMessageCallStatus: json['lastMessageCallStatus'] as String?,
      lastMessageSentByMe: json['lastMessageSentByMe'] as bool?,
    );
  }

  bool get isChannel => type == 'CHANNEL';

  /// ⭐ V7 (parité web) : rendu de l'aperçu selon le type du dernier message.
  ///   CALL_LOG → « Appel audio terminé · Xs » style web ; AUDIO → 🎤 vocal.
  String get lastMessagePreviewLabel {
    final t = lastMessageType;
    if (t == 'CALL_LOG') {
      final video = (lastMessageCallType ?? 'audio') == 'video';
      final status = lastMessageCallStatus ?? 'ended';
      final out = lastMessageSentByMe == true;
      switch (status) {
        case 'missed':
          return out ? 'Appel ${video ? 'vidéo' : 'audio'} manqué (sortant)' : 'Appel ${video ? 'vidéo' : 'audio'} manqué';
        case 'declined':
        case 'rejected':
          return 'Appel ${video ? 'vidéo' : 'audio'} refusé';
        case 'cancelled':
          return out ? 'Appel sans réponse' : 'Appel annulé';
        default:
          return 'Appel ${video ? 'vidéo' : 'audio'} terminé';
      }
    }
    if (t == 'AUDIO') return '🎤 Message vocal';
    if (t == 'IMAGE') return '📷 Photo';
    if (t == 'VIDEO') return '🎬 Vidéo';
    if (t == 'DOCUMENT') return '📎 Document';
    if (t == 'POLL') return '📊 Sondage';
    if (t == 'ANNOUNCEMENT') return '📢 Annonce';
    // ⭐ V8 — E2EE : aperçu chiffré → placeholder cadenas (jamais de base64
    //    brut dans la liste des conversations, parité web)
    final raw = lastMessagePreview ?? '';
    if (raw.startsWith('E2E:')) return '🔒 Message chiffré';
    final preview = stripHtml(raw);
    return preview.isEmpty ? 'Aucun message' : preview;
  }

  String get displayName => name ?? participants
      .where((p) => p.userId != createdBy)
      .map((p) => p.fullName)
      .join(', ');
}

class Participant {
  final String userId;
  final String role; // ADMIN | MEMBER
  final DateTime joinedAt;
  final DateTime? lastReadAt;
  final bool muted;
  final String? firstName;
  final String? lastName;
  final String? email;
  final String? roleLabel;
  final List<String>? childrenNames;

  Participant({
    required this.userId,
    required this.role,
    required this.joinedAt,
    this.lastReadAt,
    this.muted = false,
    this.firstName,
    this.lastName,
    this.email,
    this.roleLabel,
    this.childrenNames,
  });

  factory Participant.fromJson(Map<String, dynamic> json) {
    return Participant(
      userId: json['userId'] as String,
      role: json['role'] as String? ?? 'MEMBER',
      joinedAt: DateTime.parse(json['joinedAt'] as String),
      lastReadAt: json['lastReadAt'] != null ? DateTime.parse(json['lastReadAt'] as String) : null,
      muted: json['muted'] as bool? ?? false,
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      email: json['email'] as String?,
      roleLabel: json['roleLabel'] as String?,
      childrenNames: (json['childrenNames'] as List<dynamic>?)?.cast<String>(),
    );
  }

  String get fullName => '${firstName ?? ''} ${lastName ?? ''}'.trim();
}

class Reaction {
  final String emoji;
  final String userId;
  final String? firstName;
  final String? lastName;

  Reaction({
    required this.emoji,
    required this.userId,
    this.firstName,
    this.lastName,
  });

  factory Reaction.fromJson(Map<String, dynamic> json) {
    return Reaction(
      emoji: json['emoji'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
    );
  }

  String get fullName => '${firstName ?? ''} ${lastName ?? ''}'.trim();
}

class Message {
  final String id;
  final String conversationId;
  final String senderId;
  final String type; // TEXT | AUDIO | DOCUMENT | IMAGE | VIDEO | POLL | SYSTEM | CALL_LOG
  final String? content;
  final String? attachmentUrl;
  final String? attachmentName;
  final int? attachmentSize;
  final String? attachmentMime;
  final int? duration;
  final String? replyToId;
  final String? replyToContent;     // ⭐ V3-4: for reply quote preview (whatsapp-style)
  final String? replyToSenderName;  // ⭐ V3-4: parent message sender name
  final DateTime createdAt;
  final DateTime? editedAt;
  final DateTime? deletedAt;
  final DateTime? deliveredAt;  // ⭐ V3-4: for 3-state read receipts
  final List<Reaction> reactions;  // ⭐ V3-4: emoji reactions
  final List<Map<String, dynamic>> readBy;  // ⭐ V3-4: who has read it
  final bool isPinned;
  final bool isImportant;
  final String? senderFirstName;
  final String? senderLastName;
  final String? senderRole;
  final bool isOwn;
  // ⭐ V7 (parité web) : métadonnées d'appel pour les messages CALL_LOG
  //    { callType, status, durationSec, byName, kind? } — rendues en pill.
  final Map<String, dynamic>? callMeta;
  // ⭐ V3-1: local-only fields (for offline pending messages)
  final String? status; // 'pending' | 'sent' | 'failed' — used only locally
  final String? localId;

  Message({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.type,
    this.content,
    this.attachmentUrl,
    this.attachmentName,
    this.attachmentSize,
    this.attachmentMime,
    this.duration,
    this.replyToId,
    this.replyToContent,
    this.replyToSenderName,
    required this.createdAt,
    this.editedAt,
    this.deletedAt,
    this.deliveredAt,
    this.reactions = const [],
    this.readBy = const [],
    this.isPinned = false,
    this.isImportant = false,
    this.senderFirstName,
    this.senderLastName,
    this.senderRole,
    this.isOwn = false,
    this.callMeta,
    this.status,
    this.localId,
  });

  factory Message.fromJson(Map<String, dynamic> json, String currentUserId) {
    // Sender info can be at top-level OR nested in `sender` object
    final sender = json['sender'] as Map<String, dynamic>?;
    final senderFirstName = json['senderFirstName'] as String? ?? sender?['firstName'] as String?;
    final senderLastName = json['senderLastName'] as String? ?? sender?['lastName'] as String?;
    final senderRole = json['senderRole'] as String? ?? sender?['role'] as String?;

    // Parse reactions (V3-4)
    final reactionsJson = json['reactions'] as List<dynamic>? ?? [];
    final reactions = reactionsJson
        .map((r) => Reaction.fromJson(r as Map<String, dynamic>))
        .where((r) => r.emoji.isNotEmpty)
        .toList();

    // Parse readBy (V3-4)
    final readByJson = json['readBy'] as List<dynamic>? ?? [];
    final readBy = readByJson.cast<Map<String, dynamic>>().toList();

    return Message(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String,
      senderId: json['senderId'] as String? ?? '',
      type: json['type'] as String? ?? 'TEXT',
      content: json['content'] as String?,
      attachmentUrl: json['attachmentUrl'] as String?,
      attachmentName: json['attachmentName'] as String?,
      attachmentSize: json['attachmentSize'] as int?,
      attachmentMime: json['attachmentMime'] as String?,
      duration: json['duration'] as int?,
      replyToId: json['replyToId'] as String?,
      replyToContent: json['replyToContent'] as String?,
      replyToSenderName: json['replyToSenderName'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      editedAt: json['editedAt'] != null ? DateTime.parse(json['editedAt'] as String) : null,
      deletedAt: json['deletedAt'] != null ? DateTime.parse(json['deletedAt'] as String) : null,
      deliveredAt: json['deliveredAt'] != null ? DateTime.parse(json['deliveredAt'] as String) : null,
      reactions: reactions,
      readBy: readBy,
      isPinned: json['isPinned'] as bool? ?? false,
      isImportant: json['isImportant'] as bool? ?? false,
      senderFirstName: senderFirstName,
      senderLastName: senderLastName,
      senderRole: senderRole,
      isOwn: (json['senderId'] as String?) == currentUserId,
      callMeta: json['callMeta'] as Map<String, dynamic>?,
      status: json['status'] as String?,
      localId: json['localId'] as String?,
    );
  }

  String get senderName => '${senderFirstName ?? ''} ${senderLastName ?? ''}'.trim();
  bool get isDeleted => deletedAt != null;
  bool get isAttachment => attachmentUrl != null;
}

/// Strip HTML tags from a string (used for reply quote previews).
String stripHtml(String? html) {
  if (html == null || html.isEmpty) return '';
  return html
      .replaceAll(RegExp(r'<div[^>]*>'), '\n')
      .replaceAll('</div>', '')
      .replaceAll(RegExp(r'<br\s*/?>'), '\n')
      .replaceAll(RegExp(r'<[^>]*>'), '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&#39;', "'")
      .replaceAll('&quot;', '"')
      .trim();
}

class Announcement {
  final String id;
  final String authorName;
  final String title;
  final String body;
  final String priority; // LOW | NORMAL | HIGH | URGENT
  final String targetType;
  final DateTime? publishedAt;
  final DateTime? scheduledAt;
  final bool requiresConfirmation;
  final int readCount;
  final int totalRecipients;
  final bool readByCurrentUser;
  final bool confirmedByCurrentUser;

  Announcement({
    required this.id,
    required this.authorName,
    required this.title,
    required this.body,
    required this.priority,
    required this.targetType,
    this.publishedAt,
    this.scheduledAt,
    this.requiresConfirmation = false,
    this.readCount = 0,
    this.totalRecipients = 0,
    this.readByCurrentUser = false,
    this.confirmedByCurrentUser = false,
  });

  factory Announcement.fromJson(Map<String, dynamic> json) {
    return Announcement(
      id: json['id'] as String,
      authorName: json['authorName'] as String? ?? 'Administration',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      priority: json['priority'] as String? ?? 'NORMAL',
      targetType: json['targetType'] as String? ?? 'ALL_SCHOOL',
      publishedAt: json['publishedAt'] != null ? DateTime.parse(json['publishedAt'] as String) : null,
      scheduledAt: json['scheduledAt'] != null ? DateTime.parse(json['scheduledAt'] as String) : null,
      requiresConfirmation: json['requiresConfirmation'] as bool? ?? false,
      readCount: json['readCount'] as int? ?? 0,
      totalRecipients: json['totalRecipients'] as int? ?? 0,
      readByCurrentUser: json['readByCurrentUser'] as bool? ?? false,
      confirmedByCurrentUser: json['confirmedByCurrentUser'] as bool? ?? false,
    );
  }

  bool get isUrgent => priority == 'URGENT';
  bool get isHigh => priority == 'HIGH';
}
