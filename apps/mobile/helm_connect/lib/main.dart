// ============================================================================
// HELM CONNECT — Flutter Mobile App Entry Point
// ============================================================================
// Identité visuelle : Azure + Cyan (cf. theme/helm_theme.dart)
//
// ⭐ Flux au lancement :
//   1. Si session valide (token + tenant stockés) → ChatScreen
//   2. Sinon → TenantSelectionScreen (sélection école) → LoginScreen
//   3. Après login → ChatScreen (chat principale)
//
// ⭐ Architecture :
//   - Theme : HelmThemes.lightTheme() / darkTheme()
//   - State : Provider (V2: ChangeNotifier for chat state)
//   - Real-time : socket_io_client (Socket.io backend)
//   - Offline : Hive (V2: offline-first sync)
//   - Push : firebase_messaging + flutter_local_notifications
// ============================================================================

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'theme/helm_theme.dart';
import 'services/api_service.dart';
import 'screens/tenant_selection_screen.dart';
import 'screens/chat_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const HelmConnectApp());
}

class HelmConnectApp extends StatelessWidget {
  const HelmConnectApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Helm Connect',
      debugShowCheckedModeBanner: false,
      theme: HelmThemes.lightTheme(),
      darkTheme: HelmThemes.darkTheme(),
      themeMode: ThemeMode.system, // ⭐ Light/Dark selon préférence système
      home: const StartupGate(),
      routes: {
        '/': (context) => const StartupGate(),
        '/tenant-selection': (context) => const TenantSelectionScreen(),
        '/chat': (context) => const ChatScreen(),
      },
    );
  }
}

/// Détermine l'écran d'entrée en fonction de l'état de session.
class StartupGate extends StatefulWidget {
  const StartupGate({super.key});

  @override
  State<StartupGate> createState() => _StartupGateState();
}

class _StartupGateState extends State<StartupGate> {
  bool? _isLoggedIn;
  String? _tenantSlug;

  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    final loggedIn = await AuthService.isLoggedIn();
    final prefs = await SharedPreferences.getInstance();
    final slug = prefs.getString('tenant_slug');
    if (mounted) {
      setState(() {
        _isLoggedIn = loggedIn;
        _tenantSlug = slug;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoggedIn == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_isLoggedIn == true) {
      return const ChatScreen();
    }
    // Not logged in — go to tenant selection
    return const TenantSelectionScreen();
  }
}
