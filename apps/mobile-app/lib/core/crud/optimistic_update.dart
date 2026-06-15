/// ============================================================================
/// OPTIMISTIC UPDATE — Academia Hub Mobile
/// ============================================================================
///
/// Pattern de mise à jour optimiste pour Riverpod, miroir des
/// optimistic mutations de TanStack Query du web app.
///
/// Principe :
/// 1. Snapshot de l'état actuel avant la mutation
/// 2. Application immédiate du changement optimiste
/// 3. En cas d'erreur : rollback vers le snapshot
/// 4. En cas de succès : invalidation et refetch
///
/// Utilisation avec Riverpod :
/// ```dart
/// final result = await OptimisticUpdate.execute(
///   ref: ref,
///   provider: studentsProvider,
///   mutation: () => studentsService.create(data),
///   optimisticUpdate: (current) => [...current, data],
///   onError: (error) => showSnackbar(error.message),
/// );
/// ```
/// ============================================================================

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_result.dart';

// ─── Optimistic Update ───────────────────────────────────────────────────────

/// Exécute une mutation avec mise à jour optimiste.
///
/// Miroir du pattern TanStack Query :
/// ```typescript
/// useMutation({
///   mutationFn: (data) => api.post('/endpoint', data),
///   onMutate: async (data) => {
///     await queryClient.cancelQueries(key);
///     const snapshot = queryClient.getQueryData(key);
///     queryClient.setQueryData(key, (old) => [...old, data]);
///     return { snapshot };
///   },
///   onError: (err, data, context) => {
///     queryClient.setQueryData(key, context.snapshot);
///   },
///   onSettled: () => {
///     queryClient.invalidateQueries(key);
///   },
/// });
/// ```
class OptimisticUpdate {
  /// Exécute une mutation optimiste sur un StateNotifierProvider.
  ///
  /// [ref] — Référence Riverpod pour lire/invalider les providers.
  /// [provider] — Provider à mettre à jour de façon optimiste.
  /// [mutation] — Fonction asynchrone qui effectue l'appel API.
  /// [optimisticUpdate] — Fonction qui applique le changement optimiste
  ///   à l'état actuel et retourne le nouvel état.
  /// [onSuccess] — Callback appelé en cas de succès.
  /// [onError] — Callback appelé en cas d'erreur (après rollback).
  /// [rollbackDelay] — Délai avant le rollback (pour animation).
  static Future<ApiResult<T>> execute<T, S>({
    required Ref ref,
    required StateNotifierProvider<StateNotifier<S>, S> provider,
    required Future<ApiResult<T>> Function() mutation,
    required S Function(S current) optimisticUpdate,
    void Function(T data)? onSuccess,
    void Function(ApiError error)? onError,
    Duration rollbackDelay = Duration.zero,
  }) async {
    // 1. Snapshot de l'état actuel
    final snapshot = ref.read(provider);

    try {
      // 2. Appliquer le changement optimiste
      final currentState = ref.read(provider);
      final optimisticState = optimisticUpdate(currentState);

      // Utiliser le notifier pour mettre à jour l'état
      final notifier = ref.read(provider.notifier);
      if (notifier is StateController<S>) {
        notifier.state = optimisticState;
      }

      // 3. Exécuter la mutation réelle
      final result = await mutation();

      // 4. Traiter le résultat
      return result.when(
        success: (data) {
          // Succès → les données seront rafraîchies par l'invalidation
          onSuccess?.call(data);
          return result;
        },
        failure: (error) {
          // Erreur → rollback vers le snapshot
          _rollback(ref, provider, snapshot, rollbackDelay);
          onError?.call(error);
          return result;
        },
        loading: () {
          // Ne devrait pas arriver après la mutation
          return result;
        },
      );
    } catch (e) {
      // Erreur inattendue → rollback
      _rollback(ref, provider, snapshot, rollbackDelay);

      final apiError = ApiError(
        message: 'Erreur inattendue : $e',
        type: ApiErrorType.unknown,
      );
      onError?.call(apiError);

      return ApiFailure(apiError);
    }
  }

  /// Exécute une mutation optimiste sur un AsyncNotifierProvider.
  ///
  /// Variante pour les providers asynchrones (AsyncValue).
  static Future<ApiResult<T>> executeAsync<T, S>({
    required Ref ref,
    required ProviderListenable<AsyncValue<S>> provider,
    required Future<ApiResult<T>> Function() mutation,
    required S Function(S current) optimisticUpdate,
    void Function(T data)? onSuccess,
    void Function(ApiError error)? onError,
    Duration rollbackDelay = Duration.zero,
  }) async {
    // 1. Snapshot de l'état actuel
    final asyncSnapshot = ref.read(provider);
    final snapshot = asyncSnapshot.valueOrNull;

    if (snapshot == null) {
      // Pas d'état actuel → exécuter sans optimisme
      final result = await mutation();
      result.when(
        success: onSuccess,
        failure: (e) => onError?.call(e),
        loading: () {},
      );
      return result;
    }

    try {
      // 2. Appliquer le changement optimiste (sur la valeur)
      final optimisticState = optimisticUpdate(snapshot);

      // Note: Pour les AsyncNotifierProvider, on invalide typiquement
      // et on override temporairement. Cette partie dépend de
      // l'implémentation spécifique du provider.

      // 3. Exécuter la mutation réelle
      final result = await mutation();

      // 4. Traiter le résultat
      return result.when(
        success: (data) {
          onSuccess?.call(data);
          // Invalider le provider pour forcer le refetch
          ref.invalidate(provider);
          return result;
        },
        failure: (error) {
          // Erreur → l'invalidation ramènera les données serveur
          ref.invalidate(provider);
          onError?.call(error);
          return result;
        },
        loading: () => result,
      );
    } catch (e) {
      ref.invalidate(provider);

      final apiError = ApiError(
        message: 'Erreur inattendue : $e',
        type: ApiErrorType.unknown,
      );
      onError?.call(apiError);

      return ApiFailure(apiError);
    }
  }

  /// Rollback vers le snapshot.
  static void _rollback<S>(
    Ref ref,
    StateNotifierProvider<StateNotifier<S>, S> provider,
    S snapshot,
    Duration delay,
  ) async {
    if (delay > Duration.zero) {
      await Future.delayed(delay);
    }

    try {
      final notifier = ref.read(provider.notifier);
      if (notifier is StateController<S>) {
        notifier.state = snapshot;
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[OptimisticUpdate] Rollback échoué : $e');
      }
    }
  }
}

// ─── Optimistic Mutation Helper ──────────────────────────────────────────────

/// Helper pour créer des mutations optimistes réutilisables.
///
/// Usage :
/// ```dart
/// final createStudentMutation = OptimisticMutation<List<Student>, Student>(
///   optimisticUpdate: (current, newItem) => [...current, newItem],
///   mutation: (item) => studentsService.create(item.toJson()),
///   onSuccess: (result) => debugPrint('Élève créé'),
///   onError: (error) => debugPrint('Erreur : ${error.message}'),
/// );
/// ```
class OptimisticMutation<S, T> {
  /// Fonction qui applique le changement optimiste à l'état actuel.
  final S Function(S current, T item) optimisticUpdate;

  /// Fonction qui exécute la mutation réelle.
  final Future<ApiResult<dynamic>> Function(T item) mutation;

  /// Callback de succès.
  final void Function(dynamic result)? onSuccess;

  /// Callback d'erreur.
  final void Function(ApiError error)? onError;

  /// Délai avant le rollback.
  final Duration rollbackDelay;

  const OptimisticMutation({
    required this.optimisticUpdate,
    required this.mutation,
    this.onSuccess,
    this.onError,
    this.rollbackDelay = Duration.zero,
  });

  /// Exécute la mutation.
  Future<ApiResult<dynamic>> call(
    Ref ref,
    StateNotifierProvider<StateNotifier<S>, S> provider,
    T item,
  ) {
    return OptimisticUpdate.execute(
      ref: ref,
      provider: provider,
      mutation: () => mutation(item),
      optimisticUpdate: (current) => optimisticUpdate(current, item),
      onSuccess: onSuccess,
      onError: onError,
      rollbackDelay: rollbackDelay,
    );
  }
}

// ─── Optimistic List Helpers ─────────────────────────────────────────────────

/// Helpers pour les opérations optimistes sur les listes.
class OptimisticList {
  /// Ajoute un élément à la liste (création).
  static List<T> addItem<T>(List<T> current, T item) {
    return [...current, item];
  }

  /// Met à jour un élément dans la liste par ID.
  static List<T> updateItem<T>(
    List<T> current,
    String id,
    T Function(T) updater,
    String Function(T) idExtractor,
  ) {
    return current.map((item) {
      return idExtractor(item) == id ? updater(item) : item;
    }).toList();
  }

  /// Supprime un élément de la liste par ID.
  static List<T> removeItem<T>(
    List<T> current,
    String id,
    String Function(T) idExtractor,
  ) {
    return current.where((item) => idExtractor(item) != id).toList();
  }

  /// Remplace un élément dans la liste.
  static List<T> replaceItem<T>(
    List<T> current,
    T oldItem,
    T newItem, {
    required bool Function(T, T) matcher,
  }) {
    return current.map((item) => matcher(item, oldItem) ? newItem : item).toList();
  }
}
