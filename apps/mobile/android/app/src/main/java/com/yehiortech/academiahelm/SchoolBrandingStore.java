package com.yehiortech.academiahelm;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;

import java.io.File;

/**
 * ============================================================================
 * PERSISTANCE DU BRANDING ÉCOLE (SharedPreferences)
 * ============================================================================
 *
 * Stocke l'identité de l'école actuellement sélectionnée par l'utilisateur
 * (nom, URL du logo, couleur principale, sous-titre). Alimente :
 *
 *   1. le widget « Branding de l'école » (SchoolWidgetProvider) ;
 *   2. l'écran de chargement natif de MainActivity (logo de l'école dès le
 *      démarrage à froid, avant même que le WebView ne peigne la page) ;
 *   3. la barre de statut (couleur école, pilotée par le web via le plugin
 *      StatusBar — le store sert uniquement au natif).
 *
 * Écrit par SchoolBrandingPlugin (pont web → natif, appelé par le web après
 * /auth/select-tenant ou /context/bootstrap) ; vidé au logout via
 * clearSchoolBranding(). La persistance survive au redémarrage du téléphone :
 * le widget affiche la bonne école même quand l'app n'a jamais été ouverte
 * sur la session courante.
 *
 * ⚠️ Icône du lanceur : conservée volontairement à « Academia Helm » (les
 * launchers Android/iOS n'acceptent que des icônes compilées dans l'APK ;
 * le widget est la seule surface Android réellement dynamique).
 */
public final class SchoolBrandingStore {

    private static final String PREFS = "school_branding";
    private static final String KEY_NAME = "name";
    private static final String KEY_LOGO_URL = "logoUrl";
    private static final String KEY_LOGO_DOWNLOADED_URL = "logoDownloadedUrl";
    private static final String KEY_PRIMARY_COLOR = "primaryColor";
    private static final String KEY_TAGLINE = "tagline";

    /** Navy officiel Academia Helm — fallback quand aucune couleur valide. */
    public static final int DEFAULT_PRIMARY = 0xFF0B2F73;

    private SchoolBrandingStore() { /* utilitaire statique */ }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Enregistre (ou écrase) le branding de l'école courante. */
    public static void save(Context context, String name, String logoUrl,
                            String primaryColor, String tagline) {
        prefs(context).edit()
                .putString(KEY_NAME, name)
                .putString(KEY_LOGO_URL, logoUrl)
                .putString(KEY_PRIMARY_COLOR, primaryColor)
                .putString(KEY_TAGLINE, tagline)
                // Invalide le cache disque du logo si l'URL change.
                .putString(KEY_LOGO_DOWNLOADED_URL, "")
                .apply();
    }

    /** Efface le branding — le widget revient à l'identité Academia Helm. */
    public static void clear(Context context) {
        prefs(context).edit().clear().apply();
        File logo = logoFile(context);
        if (logo.exists()) {
            //noinspection ResultOfMethodCallIgnored
            logo.delete();
        }
    }

    /** true si une école est sélectionnée (branding actif). */
    public static boolean hasSchool(Context context) {
        String name = prefs(context).getString(KEY_NAME, null);
        return name != null && !name.trim().isEmpty();
    }

    public static String getName(Context context) {
        return prefs(context).getString(KEY_NAME, null);
    }

    public static String getLogoUrl(Context context) {
        return prefs(context).getString(KEY_LOGO_URL, null);
    }

    public static String getPrimaryColor(Context context) {
        return prefs(context).getString(KEY_PRIMARY_COLOR, null);
    }

    public static String getTagline(Context context) {
        return prefs(context).getString(KEY_TAGLINE, null);
    }

    /** URL du logo actuellement en cache disque (évite les re-téléchargements). */
    public static String getLogoDownloadedUrl(Context context) {
        return prefs(context).getString(KEY_LOGO_DOWNLOADED_URL, null);
    }

    public static void setLogoDownloadedUrl(Context context, String url) {
        prefs(context).edit().putString(KEY_LOGO_DOWNLOADED_URL, url).apply();
    }

    /** Emplacement du logo téléchargé (cache disque de l'app). */
    public static File logoFile(Context context) {
        return new File(context.getApplicationContext().getFilesDir(), "school_logo.png");
    }

    /** Couleur principale parsée (#RRGGBB / #AARRGGBB) ; fallback navy sinon. */
    public static int parsePrimaryColor(Context context, int fallback) {
        String raw = getPrimaryColor(context);
        if (raw == null || raw.trim().isEmpty()) {
            return fallback;
        }
        try {
            return Color.parseColor(raw.trim());
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }
}
