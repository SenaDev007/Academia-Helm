/**
 * Neon DB Keep-Alive — envoie un SELECT 1 toutes les 5 minutes
 * pour empêcher la mise en veille (auto-suspend) de Neon.
 *
 * Usage: node scripts/neon-keepalive.cjs
 * Mode watch: node scripts/neon-keepalive.cjs --watch
 */
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function ping() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000, // 10s timeout — si Neon est en veille, ça le réveille
  });

  try {
    const start = Date.now();
    await client.connect();
    await client.query('SELECT 1');
    const elapsed = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ✓ Neon DB awake (${elapsed}ms)`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ✗ Ping failed:`, err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

// Ping immédiat
ping();

// Puis toutes les 5 minutes si --watch
if (process.argv.includes('--watch')) {
  console.log('Keep-alive actif — ping toutes les 5 minutes (Ctrl+C pour arrêter)');
  setInterval(ping, 5 * 60 * 1000);
}
