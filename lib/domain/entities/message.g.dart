// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'message.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SchoolMessageImpl _$$SchoolMessageImplFromJson(Map<String, dynamic> json) =>
    _$SchoolMessageImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      content: json['content'] as String,
      senderName: json['senderName'] as String,
      type: $enumDecode(_$MessageTypeEnumMap, json['type']),
      isRead: json['isRead'] as bool? ?? false,
      isImportant: json['isImportant'] as bool? ?? false,
      attachments: (json['attachments'] as List<dynamic>?)
              ?.map(
                  (e) => MessageAttachment.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      sentAt: json['sentAt'] == null
          ? null
          : DateTime.parse(json['sentAt'] as String),
      readAt: json['readAt'] == null
          ? null
          : DateTime.parse(json['readAt'] as String),
      tenantId: json['tenantId'] as String?,
    );

Map<String, dynamic> _$$SchoolMessageImplToJson(_$SchoolMessageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'content': instance.content,
      'senderName': instance.senderName,
      'type': _$MessageTypeEnumMap[instance.type]!,
      'isRead': instance.isRead,
      'isImportant': instance.isImportant,
      'attachments': instance.attachments,
      'sentAt': instance.sentAt?.toIso8601String(),
      'readAt': instance.readAt?.toIso8601String(),
      'tenantId': instance.tenantId,
    };

const _$MessageTypeEnumMap = {
  MessageType.information: 'INFORMATION',
  MessageType.urgent: 'URGENT',
  MessageType.reminder: 'REMINDER',
  MessageType.announcement: 'ANNOUNCEMENT',
  MessageType.academic: 'ACADEMIC',
};

_$MessageAttachmentImpl _$$MessageAttachmentImplFromJson(
        Map<String, dynamic> json) =>
    _$MessageAttachmentImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      url: json['url'] as String,
      fileType: json['fileType'] as String,
      fileSize: (json['fileSize'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$MessageAttachmentImplToJson(
        _$MessageAttachmentImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'url': instance.url,
      'fileType': instance.fileType,
      'fileSize': instance.fileSize,
    };
