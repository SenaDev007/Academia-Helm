package com.yehiortech.academiahelm;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Coquille native Academia Helm.
 *
 * Anti « page blanche » (correctif du 2026-10-19) :
 *
 *  1. Fond du WebView NAVY (#0B2F73) — le WebView Android est BLANC par
 *     défaut ; plus aucun blanc pendant les chargements et redirections
 *     (login BFF, reprise de session, retours de paiement…).
 *
 *  2. Écran de chargement NATIF « logo + spinner »
 *     (res/layout/loading_overlay.xml) posé au-dessus du WebView dès le
 *     premier frame : il couvre le démarrage à froid ET chaque navigation
 *     complète, et se retire dès que la page distante (Vercel) est peinte.
 *     Les icônes système (réseau/batterie/heure) restent visibles : elles
 *     sont dessinées par SystemUI AU-DESSUS des fenêtres de l'application.
 *
 *     Couplé à capacitor.config.ts : launchShowDuration = 0 → plus de
 *     plancher artificiel de 4 s ; la splash système cède la place à cet
 *     overlay dès le premier frame dessiné, l'attente visible correspond
 *     exactement au temps de chargement réel.
 */
public class MainActivity extends BridgeActivity {

    /** Durée max d'affichage de l'overlay pour UNE navigation (garde-fou réseau mort). */
    private static final long LOADING_TIMEOUT_MS = 25_000L;

    /** Intervalle de surveillance de la progression du WebView. */
    private static final long POLL_INTERVAL_MS = 150L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private View loadingOverlay;
    private long overlayShownSince = 0L;

    /**
     * Surveille le WebView : cache l'overlay quand la page est peinte
     * (progression 100 % + contenu rendu), le ré-affiche à chaque nouvelle
     * navigation complète, et déclenche le garde-fou de temporisation.
     */
    private final Runnable watchLoading = new Runnable() {
        @Override
        public void run() {
            if (loadingOverlay == null) {
                // Activité détruite : ne rien planter, ne rien replanifier.
                return;
            }
            WebView webView = (getBridge() != null) ? getBridge().getWebView() : null;
            if (webView != null) {
                if (loadingOverlay.getVisibility() == View.VISIBLE) {
                    boolean painted =
                        webView.getProgress() >= 100
                        && webView.getContentHeight() > 0
                        && webView.getUrl() != null;
                    boolean timedOut =
                        System.currentTimeMillis() - overlayShownSince > LOADING_TIMEOUT_MS;
                    if (painted || timedOut) {
                        loadingOverlay.setVisibility(View.GONE);
                    }
                } else if (webView.getProgress() < 100) {
                    // Nouvelle navigation complète (redirection de login,
                    // reprise de session, retour de paiement…) → écran de
                    // chargement.
                    overlayShownSince = System.currentTimeMillis();
                    loadingOverlay.setVisibility(View.VISIBLE);
                }
            }
            handler.postDelayed(this, POLL_INTERVAL_MS);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1) Fond navy du WebView — élimine tout fond blanc résiduel.
        WebView webView = (getBridge() != null) ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.setBackgroundColor(0xFF0B2F73); // navy officiel Academia Helm
        }

        // 2) Écran de chargement natif au-dessus du contenu — visible dès le
        //    premier frame, AVANT tout dessin du contenu web distant.
        ViewGroup content = (ViewGroup) findViewById(android.R.id.content);
        loadingOverlay = getLayoutInflater().inflate(R.layout.loading_overlay, content, false);
        content.addView(loadingOverlay);
        overlayShownSince = System.currentTimeMillis();

        handler.postDelayed(watchLoading, POLL_INTERVAL_MS);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(watchLoading);
        super.onDestroy();
    }
}
