// ============================================================================
// SCHOOL SERVICE — Recherche et sélection d'école
// ============================================================================
// API endpoints:
//   GET /api/portal/schools → liste publique des écoles
//   GET /api/portal/schools/:slug → détails d'une école
// ============================================================================

import 'package:dio/dio.dart';
import '../core/config/api_config.dart';
import '../core/utils/storage_utils.dart';

class SchoolService {
  final Dio _dio;

  SchoolService() : _dio = Dio(BaseOptions(
    baseUrl: ApiConfig.baseUrl,
    connectTimeout: ApiConfig.requestTimeout,
    receiveTimeout: ApiConfig.requestTimeout,
    headers: ApiConfig.defaultHeaders,
  ));

  /// Récupère la liste publique des écoles (pour le portail public)
  Future<List<SchoolInfo>> searchSchools({String? query}) async {
    try {
      final response = await _dio.get('/portal/schools', queryParameters: {
        if (query != null && query.isNotEmpty) 'q': query,
      });

      final schools = (response.data as List)
          .map((json) => SchoolInfo.fromJson(json))
          .toList();

      return schools;
    } catch (e) {
      // En cas d'erreur réseau, retourner une liste vide
      return [];
    }
  }

  /// Récupère les détails d'une école par son slug
  Future<SchoolInfo?> getSchoolBySlug(String slug) async {
    try {
      final response = await _dio.get('/portal/schools/$slug');
      return SchoolInfo.fromJson(response.data);
    } catch (e) {
      return null;
    }
  }

  /// Sauvegarde l'école sélectionnée localement
  Future<void> saveSelectedSchool(SchoolInfo school) async {
    await StorageUtils.saveObject('selected_school', school.toJson());
  }

  /// Récupère l'école sauvegardée (pour auto-login au prochain lancement)
  Future<SchoolInfo?> getSavedSchool() async {
    final json = await StorageUtils.getObject('selected_school');
    if (json == null) return null;
    return SchoolInfo.fromJson(json);
  }

  /// Efface l'école sauvegardée (déconnexion / changement d'école)
  Future<void> clearSavedSchool() async {
    await StorageUtils.remove('selected_school');
  }
}

// ── Modèle SchoolInfo ──

class SchoolInfo {
  final String id;
  final String name;
  final String slug;
  final String? subdomain;
  final String? logoUrl;
  final String? city;
  final String? country;
  final String? schoolType;
  final String? phone;
  final String? email;
  final String? address;

  SchoolInfo({
    required this.id,
    required this.name,
    required this.slug,
    this.subdomain,
    this.logoUrl,
    this.city,
    this.country,
    this.schoolType,
    this.phone,
    this.email,
    this.address,
  });

  factory SchoolInfo.fromJson(Map<String, dynamic> json) {
    return SchoolInfo(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      slug: json['slug'] ?? '',
      subdomain: json['subdomain'],
      logoUrl: json['logoUrl'],
      city: json['city'],
      country: json['country'],
      schoolType: json['schoolType'],
      phone: json['phone'],
      email: json['email'],
      address: json['address'],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'slug': slug,
        'subdomain': subdomain,
        'logoUrl': logoUrl,
        'city': city,
        'country': country,
        'schoolType': schoolType,
        'phone': phone,
        'email': email,
        'address': address,
      };
}
