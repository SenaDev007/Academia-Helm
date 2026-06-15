import 'dart:convert';
import 'package:hive/hive.dart';

/// A generic Hive-based cache entry with optional TTL (time-to-live).
class _CacheEntry {
  final String data;
  final int? expiresAt; // milliseconds since epoch, null = never expires

  _CacheEntry({required this.data, this.expiresAt});

  Map<String, dynamic> toJson() => {
        'data': data,
        if (expiresAt != null) 'expiresAt': expiresAt,
      };

  factory _CacheEntry.fromJson(Map<String, dynamic> json) => _CacheEntry(
        data: json['data'] as String,
        expiresAt: json['expiresAt'] as int?,
      );

  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.now().millisecondsSinceEpoch > expiresAt!;
  }
}

/// Generic Hive-based cache with TTL support.
///
/// Provides type-safe caching for any JSON-serializable data.
/// Entries can have an optional time-to-live after which they are
/// considered expired and will return null on retrieval.
class CacheStorage {
  static const _boxName = 'app_cache';
  final Box _box;

  CacheStorage({required Box box}) : _box = box;

  /// Saves data to the cache with an optional TTL.
  ///
  /// [key] - Unique cache key.
  /// [data] - The data to cache; must be JSON-serializable.
  /// [ttl] - Optional time-to-live duration. After this duration,
  ///         the cached entry is considered expired.
  Future<void> save<T>(
    String key,
    T data, {
    Duration? ttl,
  }) async {
    final jsonStr = jsonEncode(data);
    final expiresAt = ttl != null
        ? DateTime.now().add(ttl).millisecondsSinceEpoch
        : null;

    final entry = _CacheEntry(
      data: jsonStr,
      expiresAt: expiresAt,
    );

    await _box.put(key, jsonEncode(entry.toJson()));
  }

  /// Retrieves cached data by key.
  ///
  /// Returns null if the key does not exist or the entry has expired.
  /// Expired entries are automatically removed from the cache.
  T? get<T>(String key) {
    final raw = _box.get(key) as String?;
    if (raw == null) return null;

    try {
      final entryJson = jsonDecode(raw) as Map<String, dynamic>;
      final entry = _CacheEntry.fromJson(entryJson);

      if (entry.isExpired) {
        // Clean up expired entry
        _box.delete(key);
        return null;
      }

      final data = jsonDecode(entry.data);
      return data as T;
    } catch (_) {
      // Corrupted entry — remove it
      _box.delete(key);
      return null;
    }
  }

  /// Retrieves a list of cached items by key.
  ///
  /// Works like [get] but handles list deserialization.
  List<T>? getList<T>(String key) {
    final raw = _box.get(key) as String?;
    if (raw == null) return null;

    try {
      final entryJson = jsonDecode(raw) as Map<String, dynamic>;
      final entry = _CacheEntry.fromJson(entryJson);

      if (entry.isExpired) {
        _box.delete(key);
        return null;
      }

      final data = jsonDecode(entry.data) as List;
      return data.cast<T>();
    } catch (_) {
      _box.delete(key);
      return null;
    }
  }

  /// Removes a specific entry from the cache.
  Future<void> clear(String key) async {
    await _box.delete(key);
  }

  /// Removes all entries from the cache box.
  Future<void> clearAll() async {
    await _box.clear();
  }

  /// Checks whether a cached entry is expired.
  ///
  /// Returns true if the entry does not exist or is expired.
  bool isExpired(String key) {
    final raw = _box.get(key) as String?;
    if (raw == null) return true;

    try {
      final entryJson = jsonDecode(raw) as Map<String, dynamic>;
      final entry = _CacheEntry.fromJson(entryJson);
      return entry.isExpired;
    } catch (_) {
      return true;
    }
  }

  /// Checks whether a key exists in the cache and is not expired.
  bool exists(String key) {
    return !isExpired(key);
  }
}
