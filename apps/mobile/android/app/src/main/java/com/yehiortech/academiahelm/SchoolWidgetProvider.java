package com.yehiortech.academiahelm;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.os.Build;
import android.util.Log;
import android.widget.RemoteViews;

import androidx.core.graphics.drawable.RoundedBitmapDrawable;
import androidx.core.graphics.drawable.RoundedBitmapDrawableFactory;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * ============================================================================
 * WIDGET « BRANDING DE L'ÉCOLE » (écran d'accueil Android)
 * ============================================================================
 *
 * Répond au besoin produit : après la première connexion (sélection + login
 * de l'école), l'utilisateur voit SUR SON ÉCRAN D'ACCUEIL le logo et le nom
 * de SON école, au lieu de l'identité générique Academia Helm.
 *
 * Pourquoi un widget et pas l'icône du lanceur ?
 *   Android n'accepte que des icônes compilées dans l'APK pour le lanceur
 *   (activity-alias = simple bascule entre icônes embarquées) — impossible
 *   d'y afficher le logo téléchargé d'une école créée après la publication.
 *   Le widget RemoteViews est LA surface officielle acceptant un bitmap
 *   téléchargé au runtime : réellement dynamique, pour TOUTE école, sans
 *   republier l'APK. L'icône du lanceur reste « Academia Helm » (identité
 *   éditeur stable sur le Play Store).
 *
 * Cycle de vie :
 *   - Login école          → SchoolBrandingPlugin.setSchoolBranding() →
 *                            applyBranding() : télécharge le logo (cache
 *                            disque), pousse les RemoteViews immédiatement.
 *   - Logout / changement  → clearSchoolBranding()/setSchoolBranding() →
 *                            widget réaffiché Academia Helm / nouvelle école.
 *   - Ajout du widget      → onUpdate() : reprend l'état du store.
 *   - Périodique           → updatePeriodMillis (30 min, plafond système) :
 *                            re-synchronise le logo si l'URL a changé.
 *
 * Sécurité : téléchargement https uniquement en production (http toléré pour
 * les environnements de dev), plafond de taille, timeouts courts, cache
 * disque — et le logo EST controlé par l'API (fichier téléversé par l'école),
 * jamais par une entrée utilisateur libre.
 */
public class SchoolWidgetProvider extends AppWidgetProvider {

    private static final String TAG = "SchoolWidget";

    /** Plafond de taille du logo téléchargé (5 Mo — très largement au-dessus des usages). */
    private static final long MAX_LOGO_BYTES = 5L * 1024L * 1024L;
    private static final int CONNECT_TIMEOUT_MS = 8_000;
    private static final int READ_TIMEOUT_MS = 8_000;

    /** Un seul worker : les téléchargements se sérialisent proprement. */
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    // ─────────────────────────────────────────────────────────────────────
    // API appelée par SchoolBrandingPlugin (pont web → natif)
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Applique le branding de l'école sélectionnée : persiste le store puis
     * (thread de fond) télécharge le logo et rafraîchit tous les widgets.
     * Appelé sur le thread principal du plugin — retour immédiat, le travail
     * réseau se fait en arrière-plan.
     */
    public static void applyBranding(Context context, String name, String logoUrl,
                                     String primaryColor, String tagline) {
        SchoolBrandingStore.save(context, name, logoUrl, primaryColor, tagline);
        EXECUTOR.execute(() -> {
            syncLogoFromStore(context);
            pushAll(context);
        });
    }

    /** Revient à l'identité Academia Helm (logout). */
    public static void resetBranding(Context context) {
        SchoolBrandingStore.clear(context);
        pushAll(context);
    }

    // ─────────────────────────────────────────────────────────────────────
    // AppWidgetProvider — mises à jour système
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        // Widget (re)posé sur l'écran d'accueil ou rafraîchissement périodique.
        // goAsync() : on garde le processus vivant le temps du (re)téléchargement
        // éventuel — finish() est garanti dans le finally.
        final android.content.BroadcastReceiver.PendingResult result = goAsync();
        EXECUTOR.execute(() -> {
            try {
                syncLogoFromStore(context);
                pushAll(context, appWidgetManager, appWidgetIds);
            } catch (Exception e) {
                Log.w(TAG, "onUpdate: rafraîchissement incomplet", e);
                pushAll(context, appWidgetManager, appWidgetIds);
            } finally {
                result.finish();
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Téléchargement du logo (cache disque)
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Télécharge le logo si son URL a changé depuis le dernier cache.
     * Ne touche JAMAIS au cache existant en cas d'échec réseau (le widget
     * garde le dernier logo valide plutôt qu'un état vide).
     */
    private static void syncLogoFromStore(Context context) {
        String url = SchoolBrandingStore.getLogoUrl(context);
        File cache = SchoolBrandingStore.logoFile(context);

        if (url == null || url.trim().isEmpty()
                || !(url.startsWith("https://") || url.startsWith("http://"))) {
            // Aucune URL exploitable : vide le cache pour repartir proprement.
            if (cache.exists() && SchoolBrandingStore.getLogoUrl(context) == null) {
                //noinspection ResultOfMethodCallIgnored
                cache.delete();
            }
            return;
        }

        String downloadedUrl = SchoolBrandingStore.getLogoDownloadedUrl(context);
        if (url.equals(downloadedUrl) && cache.exists() && cache.length() > 0) {
            return; // cache frais — rien à faire
        }

        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setInstanceFollowRedirects(true);
            conn.connect();

            int code = conn.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) {
                Log.w(TAG, "Logo école : HTTP " + code + " — cache conservé");
                return;
            }

            InputStream in = conn.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            long total = 0;
            int n;
            while ((n = in.read(buf)) != -1) {
                total += n;
                if (total > MAX_LOGO_BYTES) {
                    Log.w(TAG, "Logo école : dépasse la limite de " + MAX_LOGO_BYTES + " octets");
                    return;
                }
                out.write(buf, 0, n);
            }
            in.close();

            byte[] bytes = out.toByteArray();

            // Garde-fou « bombe à la décompression » : bornes lues AVANT le
            // décodage complet, puis sous-échantillonnage — les widgets n'ont
            // pas besoin de plus de 2048 px de côté.
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
                Log.w(TAG, "Logo école : format non bitmap (PNG/JPEG attendu)");
                return;
            }
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight, 2048);
            Bitmap decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
            if (decoded == null) {
                // Décodage impossible : on garde le cache existant.
                Log.w(TAG, "Logo école : décodage impossible");
                return;
            }

            // Écriture atomique : tmp → rename.
            File tmp = new File(cache.getAbsolutePath() + ".tmp");
            try (FileOutputStream fos = new FileOutputStream(tmp)) {
                decoded.compress(Bitmap.CompressFormat.PNG, 100, fos);
            }
            if (!tmp.renameTo(cache)) {
                Log.w(TAG, "Logo école : rename tmp → cache impossible");
                //noinspection ResultOfMethodCallIgnored
                tmp.delete();
                return;
            }
            SchoolBrandingStore.setLogoDownloadedUrl(context, url);
            Log.i(TAG, "Logo école mis en cache (" + total + " octets)");
        } catch (IOException | RuntimeException e) {
            Log.w(TAG, "Logo école : téléchargement échoué — cache conservé", e);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Construction + poussée des RemoteViews
    // ─────────────────────────────────────────────────────────────────────

    private static void pushAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) {
            return;
        }
        int[] ids = manager.getAppWidgetIds(
                new ComponentName(context, SchoolWidgetProvider.class));
        pushAll(context, manager, ids);
    }

    private static void pushAll(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) {
            return;
        }
        RemoteViews views = buildRemoteViews(context);
        for (int id : ids) {
            manager.updateAppWidget(id, views);
        }
    }

    /**
     * Construit les RemoteViews selon l'état courant :
     *   - école connectée : logo téléchargé + nom + couleur de l'école ;
     *   - aucun branding  : icône + nom + navy Academia Helm.
     */
    private static RemoteViews buildRemoteViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.school_widget);

        boolean hasSchool = SchoolBrandingStore.hasSchool(context);
        String name = hasSchool ? SchoolBrandingStore.getName(context) : "Academia Helm";
        String tagline = hasSchool
                ? orDefault(SchoolBrandingStore.getTagline(context), "Portail Academia Helm")
                : "Portails scolaires";
        int bgColor = hasSchool
                ? SchoolBrandingStore.parsePrimaryColor(context, SchoolBrandingStore.DEFAULT_PRIMARY)
                : SchoolBrandingStore.DEFAULT_PRIMARY;

        views.setTextViewText(R.id.widget_school_name, name);
        views.setTextViewText(R.id.widget_school_tagline, tagline);

        // Fond arrondi teinté de la couleur de l'école. setBackgroundTintList
        // (via RemoteViews.setColorStateList) existe à partir de l'API 26 ;
        // en dessous, fallback couleur pleine (coins droits, cas marginal).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            views.setColorStateList(R.id.widget_root, "setBackgroundTintList",
                    ColorStateList.valueOf(bgColor));
        } else {
            views.setInt(R.id.widget_root, "setBackgroundColor", bgColor);
        }

        Bitmap logo = hasSchool ? loadRoundedSchoolLogo(context) : null;
        if (logo != null) {
            views.setImageViewBitmap(R.id.widget_school_logo, logo);
        } else {
            // Icône Academia Helm (état par défaut ou logo pas encore en cache).
            views.setImageViewResource(R.id.widget_school_logo, R.mipmap.ic_launcher);
        }

        views.setOnClickPendingIntent(R.id.widget_root, openAppPendingIntent(context));
        return views;
    }

    /**
     * Charge le logo en cache, recadré au carré (center-crop) et aux coins
     * arrondis, à la résolution utile du widget (~96 px × densité).
     */
    private static Bitmap loadRoundedSchoolLogo(Context context) {
        File cache = SchoolBrandingStore.logoFile(context);
        if (!cache.exists() || cache.length() == 0) {
            return null;
        }
        Bitmap src = BitmapFactory.decodeFile(cache.getAbsolutePath());
        if (src == null || src.getWidth() <= 0 || src.getHeight() <= 0) {
            return null;
        }

        int density = (int) (96f * context.getResources().getDisplayMetrics().density);
        Bitmap square = centerCropSquare(src, Math.max(density, 96));
        if (square != src) {
            src.recycle();
        }

        RoundedBitmapDrawable rounded =
                RoundedBitmapDrawableFactory.create(context.getResources(), square);
        rounded.setCornerRadius(square.getWidth() * 0.18f);
        rounded.setAntiAlias(true);

        Bitmap out = Bitmap.createBitmap(square.getWidth(), square.getHeight(),
                Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        rounded.setBounds(0, 0, square.getWidth(), square.getHeight());
        rounded.draw(canvas);
        return out;
    }

    /** inSampleSize pour plafonner une bitmap à maxDim pixels de côté. */
    private static int sampleSize(int width, int height, int maxDim) {
        int sample = 1;
        int max = Math.max(width, height);
        while (max / (sample * 2) >= maxDim) {
            sample *= 2;
        }
        return sample;
    }

    /** Recadre au carré centré (center-crop) puis met à l'échelle demandée. */
    private static Bitmap centerCropSquare(Bitmap src, int target) {
        int w = src.getWidth();
        int h = src.getHeight();
        int side = Math.min(w, h);
        int x = (w - side) / 2;
        int y = (h - side) / 2;
        Bitmap crop = Bitmap.createBitmap(src, x, y, side, side);
        if (side == target) {
            return crop;
        }
        return Bitmap.createScaledBitmap(crop, target, target, true);
    }

    /** Clic sur le widget → ouverture de l'app (reprise de session par cookie). */
    private static PendingIntent openAppPendingIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String orDefault(String value, String fallback) {
        return (value == null || value.trim().isEmpty()) ? fallback : value;
    }
}
