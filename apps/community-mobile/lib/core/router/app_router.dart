/// Navigation : splash → login ⇄ home (coque à onglets) → chat d'un canal.
///
/// Le routeur est exposé via un [Provider] : il peut ÉCOUTER l'état
/// d'authentification (Riverpod) et déclencher ses `redirect` via un
/// `refreshListenable` — même architecture que yeshua-connect-mobile.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/controllers.dart';
import '../screens/screens.dart';

/// Cache du statut d'auth — pont Riverpod → Listenable GoRouter.
class _AuthStatusCache extends ChangeNotifier {
  AuthState value = AuthState.loading;

  void update(AuthState status) {
    if (value == status) return;
    value = status;
    notifyListeners();
  }
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final cache = _AuthStatusCache();
  ref.listen<AuthSession>(authProvider, (previous, next) {
    cache.update(next.state);
  });
  ref.onDispose(cache.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: cache,
    redirect: (context, state) {
      final auth = cache.value;
      final loggingIn = state.matchedLocation == '/splash' || state.matchedLocation == '/login';
      if (auth == AuthState.loading) {
        return loggingIn ? null : '/splash';
      }
      if (auth == AuthState.signedOut) {
        return loggingIn ? null : '/login';
      }
      // signedIn
      return loggingIn ? '/home' : null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeShell(),
        routes: [
          GoRoute(
            path: 'chat/:slug',
            builder: (context, state) => ChatScreen(slug: state.pathParameters['slug']!),
          ),
        ],
      ),
    ],
  );
});
