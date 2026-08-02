// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'message.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SchoolMessage _$SchoolMessageFromJson(Map<String, dynamic> json) {
  return _SchoolMessage.fromJson(json);
}

/// @nodoc
mixin _$SchoolMessage {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String get content => throw _privateConstructorUsedError;
  String get senderName => throw _privateConstructorUsedError;
  MessageType get type => throw _privateConstructorUsedError;
  bool get isRead => throw _privateConstructorUsedError;
  bool get isImportant => throw _privateConstructorUsedError;
  List<MessageAttachment> get attachments => throw _privateConstructorUsedError;
  DateTime? get sentAt => throw _privateConstructorUsedError;
  DateTime? get readAt => throw _privateConstructorUsedError;
  String? get tenantId => throw _privateConstructorUsedError;

  /// Serializes this SchoolMessage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SchoolMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SchoolMessageCopyWith<SchoolMessage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SchoolMessageCopyWith<$Res> {
  factory $SchoolMessageCopyWith(
          SchoolMessage value, $Res Function(SchoolMessage) then) =
      _$SchoolMessageCopyWithImpl<$Res, SchoolMessage>;
  @useResult
  $Res call(
      {String id,
      String title,
      String content,
      String senderName,
      MessageType type,
      bool isRead,
      bool isImportant,
      List<MessageAttachment> attachments,
      DateTime? sentAt,
      DateTime? readAt,
      String? tenantId});
}

/// @nodoc
class _$SchoolMessageCopyWithImpl<$Res, $Val extends SchoolMessage>
    implements $SchoolMessageCopyWith<$Res> {
  _$SchoolMessageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SchoolMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? content = null,
    Object? senderName = null,
    Object? type = null,
    Object? isRead = null,
    Object? isImportant = null,
    Object? attachments = null,
    Object? sentAt = freezed,
    Object? readAt = freezed,
    Object? tenantId = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      content: null == content
          ? _value.content
          : content // ignore: cast_nullable_to_non_nullable
              as String,
      senderName: null == senderName
          ? _value.senderName
          : senderName // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as MessageType,
      isRead: null == isRead
          ? _value.isRead
          : isRead // ignore: cast_nullable_to_non_nullable
              as bool,
      isImportant: null == isImportant
          ? _value.isImportant
          : isImportant // ignore: cast_nullable_to_non_nullable
              as bool,
      attachments: null == attachments
          ? _value.attachments
          : attachments // ignore: cast_nullable_to_non_nullable
              as List<MessageAttachment>,
      sentAt: freezed == sentAt
          ? _value.sentAt
          : sentAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      readAt: freezed == readAt
          ? _value.readAt
          : readAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      tenantId: freezed == tenantId
          ? _value.tenantId
          : tenantId // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SchoolMessageImplCopyWith<$Res>
    implements $SchoolMessageCopyWith<$Res> {
  factory _$$SchoolMessageImplCopyWith(
          _$SchoolMessageImpl value, $Res Function(_$SchoolMessageImpl) then) =
      __$$SchoolMessageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String content,
      String senderName,
      MessageType type,
      bool isRead,
      bool isImportant,
      List<MessageAttachment> attachments,
      DateTime? sentAt,
      DateTime? readAt,
      String? tenantId});
}

/// @nodoc
class __$$SchoolMessageImplCopyWithImpl<$Res>
    extends _$SchoolMessageCopyWithImpl<$Res, _$SchoolMessageImpl>
    implements _$$SchoolMessageImplCopyWith<$Res> {
  __$$SchoolMessageImplCopyWithImpl(
      _$SchoolMessageImpl _value, $Res Function(_$SchoolMessageImpl) _then)
      : super(_value, _then);

  /// Create a copy of SchoolMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? content = null,
    Object? senderName = null,
    Object? type = null,
    Object? isRead = null,
    Object? isImportant = null,
    Object? attachments = null,
    Object? sentAt = freezed,
    Object? readAt = freezed,
    Object? tenantId = freezed,
  }) {
    return _then(_$SchoolMessageImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      content: null == content
          ? _value.content
          : content // ignore: cast_nullable_to_non_nullable
              as String,
      senderName: null == senderName
          ? _value.senderName
          : senderName // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as MessageType,
      isRead: null == isRead
          ? _value.isRead
          : isRead // ignore: cast_nullable_to_non_nullable
              as bool,
      isImportant: null == isImportant
          ? _value.isImportant
          : isImportant // ignore: cast_nullable_to_non_nullable
              as bool,
      attachments: null == attachments
          ? _value._attachments
          : attachments // ignore: cast_nullable_to_non_nullable
              as List<MessageAttachment>,
      sentAt: freezed == sentAt
          ? _value.sentAt
          : sentAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      readAt: freezed == readAt
          ? _value.readAt
          : readAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      tenantId: freezed == tenantId
          ? _value.tenantId
          : tenantId // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SchoolMessageImpl extends _SchoolMessage {
  const _$SchoolMessageImpl(
      {required this.id,
      required this.title,
      required this.content,
      required this.senderName,
      required this.type,
      this.isRead = false,
      this.isImportant = false,
      final List<MessageAttachment> attachments = const [],
      this.sentAt,
      this.readAt,
      this.tenantId})
      : _attachments = attachments,
        super._();

  factory _$SchoolMessageImpl.fromJson(Map<String, dynamic> json) =>
      _$$SchoolMessageImplFromJson(json);

  @override
  final String id;
  @override
  final String title;
  @override
  final String content;
  @override
  final String senderName;
  @override
  final MessageType type;
  @override
  @JsonKey()
  final bool isRead;
  @override
  @JsonKey()
  final bool isImportant;
  final List<MessageAttachment> _attachments;
  @override
  @JsonKey()
  List<MessageAttachment> get attachments {
    if (_attachments is EqualUnmodifiableListView) return _attachments;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_attachments);
  }

  @override
  final DateTime? sentAt;
  @override
  final DateTime? readAt;
  @override
  final String? tenantId;

  @override
  String toString() {
    return 'SchoolMessage(id: $id, title: $title, content: $content, senderName: $senderName, type: $type, isRead: $isRead, isImportant: $isImportant, attachments: $attachments, sentAt: $sentAt, readAt: $readAt, tenantId: $tenantId)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SchoolMessageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.content, content) || other.content == content) &&
            (identical(other.senderName, senderName) ||
                other.senderName == senderName) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.isRead, isRead) || other.isRead == isRead) &&
            (identical(other.isImportant, isImportant) ||
                other.isImportant == isImportant) &&
            const DeepCollectionEquality()
                .equals(other._attachments, _attachments) &&
            (identical(other.sentAt, sentAt) || other.sentAt == sentAt) &&
            (identical(other.readAt, readAt) || other.readAt == readAt) &&
            (identical(other.tenantId, tenantId) ||
                other.tenantId == tenantId));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      title,
      content,
      senderName,
      type,
      isRead,
      isImportant,
      const DeepCollectionEquality().hash(_attachments),
      sentAt,
      readAt,
      tenantId);

  /// Create a copy of SchoolMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SchoolMessageImplCopyWith<_$SchoolMessageImpl> get copyWith =>
      __$$SchoolMessageImplCopyWithImpl<_$SchoolMessageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SchoolMessageImplToJson(
      this,
    );
  }
}

abstract class _SchoolMessage extends SchoolMessage {
  const factory _SchoolMessage(
      {required final String id,
      required final String title,
      required final String content,
      required final String senderName,
      required final MessageType type,
      final bool isRead,
      final bool isImportant,
      final List<MessageAttachment> attachments,
      final DateTime? sentAt,
      final DateTime? readAt,
      final String? tenantId}) = _$SchoolMessageImpl;
  const _SchoolMessage._() : super._();

  factory _SchoolMessage.fromJson(Map<String, dynamic> json) =
      _$SchoolMessageImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  String get content;
  @override
  String get senderName;
  @override
  MessageType get type;
  @override
  bool get isRead;
  @override
  bool get isImportant;
  @override
  List<MessageAttachment> get attachments;
  @override
  DateTime? get sentAt;
  @override
  DateTime? get readAt;
  @override
  String? get tenantId;

  /// Create a copy of SchoolMessage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SchoolMessageImplCopyWith<_$SchoolMessageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

MessageAttachment _$MessageAttachmentFromJson(Map<String, dynamic> json) {
  return _MessageAttachment.fromJson(json);
}

/// @nodoc
mixin _$MessageAttachment {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get url => throw _privateConstructorUsedError;
  String get fileType =>
      throw _privateConstructorUsedError; // 'PDF', 'IMAGE', 'DOC'
  int get fileSize => throw _privateConstructorUsedError;

  /// Serializes this MessageAttachment to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MessageAttachment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MessageAttachmentCopyWith<MessageAttachment> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MessageAttachmentCopyWith<$Res> {
  factory $MessageAttachmentCopyWith(
          MessageAttachment value, $Res Function(MessageAttachment) then) =
      _$MessageAttachmentCopyWithImpl<$Res, MessageAttachment>;
  @useResult
  $Res call(
      {String id, String name, String url, String fileType, int fileSize});
}

/// @nodoc
class _$MessageAttachmentCopyWithImpl<$Res, $Val extends MessageAttachment>
    implements $MessageAttachmentCopyWith<$Res> {
  _$MessageAttachmentCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MessageAttachment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? url = null,
    Object? fileType = null,
    Object? fileSize = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      url: null == url
          ? _value.url
          : url // ignore: cast_nullable_to_non_nullable
              as String,
      fileType: null == fileType
          ? _value.fileType
          : fileType // ignore: cast_nullable_to_non_nullable
              as String,
      fileSize: null == fileSize
          ? _value.fileSize
          : fileSize // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$MessageAttachmentImplCopyWith<$Res>
    implements $MessageAttachmentCopyWith<$Res> {
  factory _$$MessageAttachmentImplCopyWith(_$MessageAttachmentImpl value,
          $Res Function(_$MessageAttachmentImpl) then) =
      __$$MessageAttachmentImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id, String name, String url, String fileType, int fileSize});
}

/// @nodoc
class __$$MessageAttachmentImplCopyWithImpl<$Res>
    extends _$MessageAttachmentCopyWithImpl<$Res, _$MessageAttachmentImpl>
    implements _$$MessageAttachmentImplCopyWith<$Res> {
  __$$MessageAttachmentImplCopyWithImpl(_$MessageAttachmentImpl _value,
      $Res Function(_$MessageAttachmentImpl) _then)
      : super(_value, _then);

  /// Create a copy of MessageAttachment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? url = null,
    Object? fileType = null,
    Object? fileSize = null,
  }) {
    return _then(_$MessageAttachmentImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      url: null == url
          ? _value.url
          : url // ignore: cast_nullable_to_non_nullable
              as String,
      fileType: null == fileType
          ? _value.fileType
          : fileType // ignore: cast_nullable_to_non_nullable
              as String,
      fileSize: null == fileSize
          ? _value.fileSize
          : fileSize // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$MessageAttachmentImpl extends _MessageAttachment {
  const _$MessageAttachmentImpl(
      {required this.id,
      required this.name,
      required this.url,
      required this.fileType,
      this.fileSize = 0})
      : super._();

  factory _$MessageAttachmentImpl.fromJson(Map<String, dynamic> json) =>
      _$$MessageAttachmentImplFromJson(json);

  @override
  final String id;
  @override
  final String name;
  @override
  final String url;
  @override
  final String fileType;
// 'PDF', 'IMAGE', 'DOC'
  @override
  @JsonKey()
  final int fileSize;

  @override
  String toString() {
    return 'MessageAttachment(id: $id, name: $name, url: $url, fileType: $fileType, fileSize: $fileSize)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MessageAttachmentImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.url, url) || other.url == url) &&
            (identical(other.fileType, fileType) ||
                other.fileType == fileType) &&
            (identical(other.fileSize, fileSize) ||
                other.fileSize == fileSize));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, name, url, fileType, fileSize);

  /// Create a copy of MessageAttachment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MessageAttachmentImplCopyWith<_$MessageAttachmentImpl> get copyWith =>
      __$$MessageAttachmentImplCopyWithImpl<_$MessageAttachmentImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$MessageAttachmentImplToJson(
      this,
    );
  }
}

abstract class _MessageAttachment extends MessageAttachment {
  const factory _MessageAttachment(
      {required final String id,
      required final String name,
      required final String url,
      required final String fileType,
      final int fileSize}) = _$MessageAttachmentImpl;
  const _MessageAttachment._() : super._();

  factory _MessageAttachment.fromJson(Map<String, dynamic> json) =
      _$MessageAttachmentImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  String get url;
  @override
  String get fileType; // 'PDF', 'IMAGE', 'DOC'
  @override
  int get fileSize;

  /// Create a copy of MessageAttachment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MessageAttachmentImplCopyWith<_$MessageAttachmentImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
