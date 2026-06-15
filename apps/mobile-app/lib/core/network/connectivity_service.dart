/// ============================================================================
/// CONNECTIVITY SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service de connectivité réseau utilisant connectivity_plus.
/// Miroir du networkDetectionService du web app.
///
/// Fonctionnalités :
/// - Vérification de la connectivité en temps réel
/// - Stream des changements de statut réseau
/// - Dernier statut connu pour les décisions offline-first
/// ============================================================================

import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// ─── Connectivity Service ────────────────────────────────────────────────────

class ConnectivityService {
  static ConnectivityService? _instance;

  final Connectivity _connectivity = Connectivity();

  /// Dernier statut de connectivité connu.
  bool _isConnected = true;

  /// Stream controller pour diffuser les changements de connectivité.
  final StreamController<bool> _connectivityController =
      StreamController<bool>.broadcast();

  /// Subscription au stream de connectivité.
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  /// Singleton instance.
  static ConnectivityService get instance =>
      _instance ??= ConnectivityService._();

  ConnectivityService._() {
    _init();
  }

  /// Constructeur pour les tests.
  ConnectivityService.forTesting() {
    _isConnected = true;
  }

  // ─── Getters ─────────────────────────────────────────────────────────────

  /// Retourne true si l'appareil est connecté à Internet.
  ///
  /// Utilise un Future pour vérifier la connectivité en temps réel,
  /// mais retourne le dernier statut connu si la vérification échoue.
  Future<bool> get isConnected async {
    try {
      final results = await _connectivity.checkConnectivity();
      _isConnected = results.any((r) => r != ConnectivityResult.none);
      return _isConnected;
    } catch (e) {
      // En cas d'erreur, retourner le dernier statut connu
      return _isConnected;
    }
  }

  /// Retourne le dernier statut de connectivité connu (sans vérification).
  bool get isConnectedSync => _isConnected;

  /// Stream des changements de connectivité.
  Stream<bool> get onConnectivityChanged => _connectivityController.stream;

  // ─── Initialisation ──────────────────────────────────────────────────────

  void _init() {
    // Vérifier la connectivité initiale
    _connectivity.checkConnectivity().then((results) {
      final wasConnected = _isConnected;
      _isConnected = results.any((r) => r != ConnectivityResult.none);
      if (wasConnected != _isConnected) {
        _connectivityController.add(_isConnected);
      }
    });

    // Écouter les changements de connectivité
    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      final wasConnected = _isConnected;
      _isConnected = results.any((r) => r != ConnectivityResult.none);

      if (kDebugMode) {
        debugPrint(
          '[Connectivity] Statut changé : ${wasConnected ? "en ligne" : "hors ligne"} → ${_isConnected ? "en ligne" : "hors ligne"}',
        );
      }

      if (wasConnected != _isConnected) {
        _connectivityController.add(_isConnected);
      }
    });
  }

  // ─── Nettoyage ───────────────────────────────────────────────────────────

  /// Annule les subscriptions et ferme le stream controller.
  void dispose() {
    _subscription?.cancel();
    _connectivityController.close();
  }

  /// Simule un statut de connectivité (pour les tests).
  void setConnectedForTesting(bool connected) {
    final wasConnected = _isConnected;
    _isConnected = connected;
    if (wasConnected != _isConnected) {
      _connectivityController.add(_isConnected);
    }
  }
}

// ─── Riverpod Provider ───────────────────────────────────────────────────────

/// Provider singleton du service de connectivité.
final connectivityServiceProvider = Provider<ConnectivityService>((ref) {
  final service = ConnectivityService.instance;

  // Écouter les changements et maintenir le provider à jour
  ref.onDispose(() {
    // Ne pas disposer le singleton, il est partagé
  });

  return service;
});

/// Provider du statut de connectivité en temps réel.
final isConnectedProvider = StreamProvider<bool>((ref) {
  return ConnectivityService.instance.onConnectivityChanged;
});

/// Provider synchrone du statut de connectivité.
final isConnectedSyncProvider = StateProvider<bool>((ref) {
  // Écouter le stream et mettre à jour
  final asyncValue = ref.watch(isConnectedProvider);
  return asyncValue.value ?? ConnectivityService.instance.isConnectedSync;
});
