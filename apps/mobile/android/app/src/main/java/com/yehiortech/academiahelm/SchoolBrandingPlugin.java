package com.yehiortech.academiahelm;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * ============================================================================
 * PLUGIN CAPACITOR « SchoolBranding » — pont web → natif
 * ============================================================================
 *
 * Le web (apps/web-app — TenantContext, après /auth/select-tenant ou
 * /context/bootstrap) appelle ce plugin pour propager l'identité de l'école
 * connectée à la coquille native :
 *
 *   const cap = (globalThis as any).Capacitor?.Plugins?.SchoolBranding;
 *   await cap?.setSchoolBranding({
 *     name: 'Lycée Le Bonheur',
 *     logoUrl: 'https://…/uploads/tenant-logos/….png',   // optionnel
 *     primaryColor: '#1B5E20',                            // optionnel
 *     tagline: 'Portail Academia Helm',                   // optionnel
 *   });
 *
 * Effets natifs :
 *   1. widget « Branding de l'école » mis à jour (logo téléchargé + nom +
 *      couleur) — visible immédiatement sur l'écran d'accueil ;
 *   2. écran de chargement natif rebrandé au prochain démarrage à froid
 *      (MainActivity lit SchoolBrandingStore dans onCreate).
 *
 * La coquille injecte le bridge Capacitor dans les domaines allowNavigation
 * (*.academiahelm.com) : l'appel fonctionne depuis le domaine principal ET
 * depuis les sous-domaines écoles. En navigateur classique, le web détecte
 * l'absence de Capacitor et ne fait rien (feature-detect, zéro erreur).
 *
 * Enregistré dans MainActivity.onCreate via registerPlugin(SchoolBrandingPlugin.class).
 */
@CapacitorPlugin(name = "SchoolBranding")
public class SchoolBrandingPlugin extends Plugin {

    @PluginMethod
    public void setSchoolBranding(PluginCall call) {
        String name = call.getString("name");
        if (name == null || name.trim().isEmpty()) {
            call.reject("« name » est requis (nom de l'école)");
            return;
        }

        // Seuls http(s) sont acceptés — refuse file:, data:, content:, etc.
        String logoUrl = call.getString("logoUrl");
        if (logoUrl != null && !logoUrl.startsWith("https://") && !logoUrl.startsWith("http://")) {
            logoUrl = null;
        }

        String primaryColor = call.getString("primaryColor");
        if (primaryColor != null) {
            primaryColor = primaryColor.trim();
            try {
                android.graphics.Color.parseColor(primaryColor);
            } catch (IllegalArgumentException e) {
                primaryColor = null; // couleur invalide → fallback navy
            }
        }

        Context context = getContext();
        SchoolWidgetProvider.applyBranding(
                context,
                name.trim(),
                (logoUrl == null || logoUrl.trim().isEmpty()) ? null : logoUrl.trim(),
                (primaryColor == null || primaryColor.isEmpty()) ? null : primaryColor,
                call.getString("tagline"));

        call.resolve();
    }

    /** État courant du branding (utile pour le debug et les diagnostics). */
    @PluginMethod
    public void getSchoolBranding(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();
        ret.put("hasSchool", SchoolBrandingStore.hasSchool(context));
        ret.put("name", SchoolBrandingStore.getName(context));
        ret.put("logoUrl", SchoolBrandingStore.getLogoUrl(context));
        ret.put("primaryColor", SchoolBrandingStore.getPrimaryColor(context));
        ret.put("tagline", SchoolBrandingStore.getTagline(context));
        ret.put("logoCached", SchoolBrandingStore.logoFile(context).exists());
        call.resolve(ret);
    }

    /** Logout ou retour au multi-écoles → identité Academia Helm. */
    @PluginMethod
    public void clearSchoolBranding(PluginCall call) {
        SchoolWidgetProvider.resetBranding(getContext());
        call.resolve();
    }
}
