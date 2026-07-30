/// ============================================================================
/// CHILDREN PROVIDER — Provider pour les enfants du parent connecté
/// ============================================================================
///
/// Utilise ChildApi pour récupérer la liste des enfants liés au parent.
/// Si l'utilisateur n'est pas un parent, retourne une liste vide.
///
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_result.dart';
import '../../../data/datasources/remote/child_api.dart';
import '../../../domain/entities/child.dart';

/// Provider qui retourne la liste des enfants du parent connecté.
///
/// Utilise ChildApi.getChildren() qui appelle GET /api/profile/children.
/// Si l'API échoue, retourne une liste vide (fallback silencieux).
final childrenProvider = FutureProvider<List<Child>>((ref) async {
  final childApi = ref.watch(childApiProvider);
  final result = await childApi.getChildren();

  return result.when(
    success: (children) => children,
    failure: (error) => throw Exception(error.message),
    loading: () => [],
  );
});

/// Provider qui retourne le détail d'un enfant spécifique.
final childDetailProvider =
    FutureProvider.family<Child, String>((ref, childId) async {
  final childApi = ref.watch(childApiProvider);
  final result = await childApi.getChildDetail(childId);

  return result.when(
    success: (child) => child,
    failure: (error) => throw Exception(error.message),
    loading: () => throw Exception('Chargement...'),
  );
});

/// Provider qui détermine si l'utilisateur courant est un parent.
final isParentProvider = Provider<bool>((ref) {
  //sera lu depuis auth_providers
  return false; // placeholder — sera surchargé par le widget
});
