/**
 * ============================================================================
 * ACADEMIA HELM — Configuration Capacitor (coquille native Android)
 * ============================================================================
 *
 * PRINCIPE « UNE SEULE BASE DE CODE » :
 *   L'app native charge l'application web LIVE (server.url → production
 *   Vercel). Le web étant multi-tenant (middleware de sous-domaines), les
 *   cookies de session, le Service Worker offline-first et les CORS
 *   fonctionnent DANS le WebView exactement comme dans un navigateur.
 *
 *   → Une correction poussée sur le web se propage INSTANTANÉMENT au mobile,
 *     SANS republier sur le Play Store. Seuls les plugins natifs exigent une
 *     nouvelle APK.
 *
 * PORTÉE V1 (décision du 2026-10-18) :
 *   - Tous les portails via le flux /portal : École, Enseignant,
 *     Parent/Élève, Public (le patronat n'est pas listé sur /portal →
 *     automatiquement absent du mobile).
 *
 * DÉMARRAGE : server.url pointe sur la page de sélection de portails du
 *   domaine principal. L'utilisateur choisit son école / portail, la session
 *   persiste dans le WebView (cookies persistants).
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ⭐ Package définitif Play Store (renommé le 2026-10-25, avant première
  //    publication — le nom de package est FIGÉ à vie une fois l'app publiée).
  //    ⚠️ Après ce renommage : enregistrer CE package dans la console Firebase
  //    (même projet academia-helm-35536) et remplacer
  //    android/app/google-services.json — voir PLAY-STORE.md §4.3.
  appId: 'com.yehiortech.academiahelm',
  appName: 'Academia Helm',
  webDir: 'www',

  server: {
    // Application web LIVE (Vercel). Page d'atterrissage : sélection de portails.
    url: 'https://academiahelm.com/portal',

    // Domaines autorisés à naviguer DANS le WebView (tout le reste s'ouvre
    // dans le navigateur externe). Couvre : écoles ({ecole}.academiahelm.com),
    // enseignant.academiahelm.com, satellites (academiafederis…), etc.
    allowNavigation: [
      '*.academiahelm.com',
      // Passerelles de paiement — restent dans l'app pour que le retour
      // callback (/checkout/success) atterrisse dans le WebView.
      '*.fedapay.com',
      '*.feexpay.com',
      '*.stripe.com',
    ],
  },

  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    // ⭐ Android 15+ (targetSdk 35) FORCE l'affichage edge-to-edge : sans
    //    cet ajustement, le WebView dessine SOUS la barre de statut et le
    //    header de l'app web se retrouve confondu avec l'en-tête système
    //    (batterie/réseau/notifications). 'force' ajoute les marges → le
    //    contenu web commence sous la barre de statut, sur tous les Android
    //    (défaut Capacitor 7 = 'disable', corrigé en 'auto' en Capacitor 8).
    adjustMarginsForEdgeToEdge: 'force',
  },

  plugins: {
    SplashScreen: {
      // ⚠️ 0 (et non 4000) : la splash PLUGIN imposait un plancher artificiel
      // de 4 s avant de céder la place… à un WebView BLANC pendant le reste
      // du chargement réseau (d'où les « pages blanches » longues). Désormais
      // la splash système cède immédiatement la place à l'écran de chargement
      // NATIF (logo + spinner) géré par MainActivity (loading_overlay.xml),
      // qui couvre TOUT le chargement réel et se retire dès que la page est
      // peinte. ⚠️ Modifier cette valeur exige `npx cap sync android`.
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#0B2F73',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0B2F73',
    },
  },
};

export default config;
