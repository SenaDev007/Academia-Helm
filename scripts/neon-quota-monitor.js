/**
 * ============================================================================
 * NEON QUOTA MONITOR — Script cron pour surveiller le quota Neon
 * ============================================================================
 *
 * À exécuter toutes les 6 heures via Fly.io cron.
 * Vérifie l'utilisation de la BDD et envoie une alerte si le quota
 * de stockage approche de la limite.
 *
 * Configuration dans fly.toml :
 * [http_service]
 *   ...
 * [[http_service.checks]]
 *   ...
 *
 * Ou via un cron job externe (GitHub Actions, cron-job.org, etc.)
 * ============================================================================
 */

const NEON_API_KEY = process.env.NEON_API_KEY || '';
const NEON_PROJECT_ID = process.env.NEON_PROJECT_ID || '';
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || ''; // Slack/Discord/Email webhook
const ALERT_EMAIL = process.env.ALERT_EMAIL || '';

// Seuils d'alerte (en pourcentage du quota)
const WARNING_THRESHOLD = 0.80; // 80%
const CRITICAL_THRESHOLD = 0.90; // 90%

async function checkNeonQuota() {
  console.log('🔍 Vérification du quota Neon...');

  if (!NEON_API_KEY || !NEON_PROJECT_ID) {
    console.log('⚠️ NEON_API_KEY ou NEON_PROJECT_ID non configurés — skip');
    return;
  }

  try {
    // Appel à l'API Neon pour récupérer l'utilisation du projet
    // https://api-docs.neon.tech/reference/getproject
    const response = await fetch(
      `https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${NEON_API_KEY}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`❌ Erreur API Neon: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();

    // Extraire les métriques d'utilisation
    const storageBytes = data?.data_storage_bytes || 0;
    const storageLimitBytes = 10 * 1024 * 1024 * 1024; // 10 Go sur Launch
    const storageUsagePercent = storageBytes / storageLimitBytes;

    console.log(`📊 Stockage: ${Math.round(storageBytes / (1024 * 1024))} Mo / ${Math.round(storageLimitBytes / (1024 * 1024))} Mo (${Math.round(storageUsagePercent * 100)}%)`);

    // Vérifier les seuils
    if (storageUsagePercent >= CRITICAL_THRESHOLD) {
      await sendAlert('CRITIQUE', `Stockage BDD à ${Math.round(storageUsagePercent * 100)}% — action requise immédiatement`);
    } else if (storageUsagePercent >= WARNING_THRESHOLD) {
      await sendAlert('ATTENTION', `Stockage BDD à ${Math.round(storageUsagePercent * 100)}% — planifier un nettoyage`);
    } else {
      console.log('✅ Quota OK');
    }

    // Vérifier aussi le quota de transfert réseau (si disponible)
    const networkTransferBytes = data?.data_transfer_bytes || 0;
    const networkLimitBytes = 200 * 1024 * 1024 * 1024; // 200 Go sur Launch
    const networkUsagePercent = networkTransferBytes / networkLimitBytes;

    console.log(`📊 Transfert réseau: ${Math.round(networkTransferBytes / (1024 * 1024))} Mo / ${Math.round(networkLimitBytes / (1024 * 1024))} Mo (${Math.round(networkUsagePercent * 100)}%)`);

    if (networkUsagePercent >= CRITICAL_THRESHOLD) {
      await sendAlert('CRITIQUE', `Transfert réseau BDD à ${Math.round(networkUsagePercent * 100)}% — risque de coupure imminent`);
    } else if (networkUsagePercent >= WARNING_THRESHOLD) {
      await sendAlert('ATTENTION', `Transfert réseau BDD à ${Math.round(networkUsagePercent * 100)}% — surveiller de près`);
    }

  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification:', error.message);
  }
}

async function sendAlert(level: string, message: string) {
  console.log(`🚨 ALERTE ${level}: ${message}`);

  // 1. Webhook (Slack/Discord/Teams)
  if (ALERT_WEBHOOK_URL) {
    try {
      await fetch(ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 [${level}] Academia Helm — ${message}`,
          level,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error('Erreur envoi webhook:', e);
    }
  }

  // 2. Email (via service interne)
  if (ALERT_EMAIL) {
    // Hook vers le service email de Academia Helm
    try {
      await fetch('https://academia-helm-api.fly.dev/api/communication/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: ALERT_EMAIL,
          subject: `🚨 ALERTE ${level} — Academia Helm`,
          message,
          level,
        }),
      });
    } catch (e) {
      console.error('Erreur envoi email:', e);
    }
  }
}

// Exécuter
checkNeonQuota().then(() => {
  console.log('✅ Vérification terminée');
  process.exit(0);
}).catch(e => {
  console.error('❌ Erreur fatale:', e);
  process.exit(1);
});
