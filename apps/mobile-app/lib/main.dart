import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:provider/provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialiser Hive pour le cache local
  await Hive.initFlutter();
  
  // Configuration système
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  
  runApp(const AcademiaHubApp());
}

class AcademiaHubApp extends StatelessWidget {
  const AcademiaHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Academia Hub',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        primaryColor: const Color(0xFF0A2A5E),
        useMaterial3: true,
        fontFamily: 'Inter',
      ),
      home: const SplashScreen(),
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    // TODO: Vérifier l'authentification
    // TODO: Charger les données en cache
    // TODO: Naviguer vers l'écran approprié
    
    await Future.delayed(const Duration(seconds: 2));
    
    if (mounted) {
      // TODO: Remplacer par la navigation réelle
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => const PlaceholderScreen(),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // TODO: Ajouter le logo
            const CircularProgressIndicator(),
            const SizedBox(height: 24),
            Text(
              'Academia Hub',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Academia Hub Mobile'),
      ),
      body: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.phone_android, size: 64),
            SizedBox(height: 16),
            Text('Application Mobile'),
            SizedBox(height: 8),
            Text('En développement'),
          ],
        ),
      ),
    );
  }
}
