/**
 * Script de test de connexion à la base de données
 * 
 * Usage: node test-db-connection.js
 */

require('dotenv').config();
const { Client } = require('pg');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'academia_helm',
};

console.log('🔍 Test de connexion PostgreSQL...');
console.log('Configuration:');
console.log(`  Host: ${config.host}`);
console.log(`  Port: ${config.port}`);
console.log(`  User: ${config.user}`);
console.log(`  Database: ${config.database}`);
console.log(`  Password: ${config.password ? (config.password.length > 0 ? '*** (' + config.password.length + ' caractères)' : 'VIDE') : 'NON DÉFINI'}`);
console.log('');
console.log('🔍 Détails du mot de passe:');
console.log(`  Longueur: ${config.password ? config.password.length : 0}`);
console.log(`  Contient @: ${config.password && config.password.includes('@') ? 'OUI' : 'NON'}`);
console.log(`  Premiers caractères: ${config.password ? config.password.substring(0, 3) + '...' : 'N/A'}`);
console.log('');

const client = new Client(config);

client
  .connect()
  .then(() => {
    console.log('✅ Connexion réussie !');
    return client.query('SELECT version()');
  })
  .then((result) => {
    console.log('✅ Version PostgreSQL:', result.rows[0].version);
    return client.query('SELECT current_database()');
  })
  .then((result) => {
    console.log('✅ Base de données actuelle:', result.rows[0].current_database);
    client.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erreur de connexion:', err.message);
    console.error('');
    console.error('💡 Solutions possibles:');
    console.error('  1. Vérifiez que PostgreSQL est démarré');
    console.error('  2. Vérifiez le mot de passe dans .env');
    console.error('  3. Vérifiez que la base de données existe');
    console.error('  4. Vérifiez le port (par défaut 5432)');
    client.end();
    process.exit(1);
  });
