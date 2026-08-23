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
  final String type; // DIRECT | GROUP
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
    );
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

class Message {
  final String id;
  final String conversationId;
  final String senderId;
  final String type; // TEXT | AUDIO | DOCUMENT | IMAGE
  final String? content;
  final String? attachmentUrl;
  final String? attachmentName;
  final int? attachmentSize;
  final String? attachmentMime;
  final int? duration;
  final String? replyToId;
  final DateTime createdAt;
  final DateTime? editedAt;
  final DateTime? deletedAt;
  final bool isPinned;
  final String? senderFirstName;
  final String? senderLastName;
  final String? senderRole;
  final bool isOwn;

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
    required this.createdAt,
    this.editedAt,
    this.deletedAt,
    this.isPinned = false,
    this.senderFirstName,
    this.senderLastName,
    this.senderRole,
    this.isOwn = false,
  });

  factory Message.fromJson(Map<String, dynamic> json, String currentUserId) {
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
      createdAt: DateTime.parse(json['createdAt'] as String),
      editedAt: json['editedAt'] != null ? DateTime.parse(json['editedAt'] as String) : null,
      deletedAt: json['deletedAt'] != null ? DateTime.parse(json['deletedAt'] as String) : null,
      isPinned: json['isPinned'] as bool? ?? false,
      senderFirstName: json['senderFirstName'] as String?,
      senderLastName: json['senderLastName'] as String?,
      senderRole: json['senderRole'] as String?,
      isOwn: (json['senderId'] as String?) == currentUserId,
    );
  }

  String get senderName => '${senderFirstName ?? ''} ${senderLastName ?? ''}'.trim();
  bool get isDeleted => deletedAt != null;
  bool get isAttachment => attachmentUrl != null;
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
