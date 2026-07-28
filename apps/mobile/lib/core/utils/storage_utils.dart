// ============================================================================
// STORAGE UTILS — Helper pour SharedPreferences
// ============================================================================

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class StorageUtils {
  static SharedPreferences? _prefs;

  static Future<SharedPreferences> get _instance async {
    if (_prefs != null) return _prefs!;
    _prefs = await SharedPreferences.getInstance();
    return _prefs!;
  }

  // ── String ──
  static Future<void> saveString(String key, String value) async {
    final prefs = await _instance;
    await prefs.setString(key, value);
  }

  static Future<String?> getString(String key) async {
    final prefs = await _instance;
    return prefs.getString(key);
  }

  // ── Bool ──
  static Future<void> saveBool(String key, bool value) async {
    final prefs = await _instance;
    await prefs.setBool(key, value);
  }

  static Future<bool?> getBool(String key) async {
    final prefs = await _instance;
    return prefs.getBool(key);
  }

  // ── Object (JSON) ──
  static Future<void> saveObject(String key, Map<String, dynamic> value) async {
    final prefs = await _instance;
    await prefs.setString(key, jsonEncode(value));
  }

  static Future<Map<String, dynamic>?> getObject(String key) async {
    final prefs = await _instance;
    final str = prefs.getString(key);
    if (str == null) return null;
    try {
      return jsonDecode(str) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  // ── Remove ──
  static Future<void> remove(String key) async {
    final prefs = await _instance;
    await prefs.remove(key);
  }

  // ── Clear all ──
  static Future<void> clearAll() async {
    final prefs = await _instance;
    await prefs.clear();
  }
}
