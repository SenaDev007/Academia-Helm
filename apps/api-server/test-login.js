/**
 * Script de test - Login API
 * Usage: node test-login.js [email] [password]
 */

const http = require('http');

const API_PORT = process.env.API_PORT || 3000;
const API_URL = `http://localhost:${API_PORT}/api/auth/login`;

const DEFAULT_EMAIL = 's.akpovitohou@gmail.com';
const DEFAULT_PASSWORD = 'C@ptain.Yehioracadhub2021';

const email = process.argv[2] || DEFAULT_EMAIL;
const password = process.argv[3] || DEFAULT_PASSWORD;

console.log('🧪 Test de Login - Academia Hub API\n');
console.log(`📧 Email: ${email}`);
console.log(`🔒 Password: ${password.substring(0, 3)}***`);
console.log(`🌐 API URL: ${API_URL}\n`);

const postData = JSON.stringify({ email, password });

const options = {
  hostname: 'localhost',
  port: API_PORT,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
  timeout: 10000,
};

console.log('⏳ Envoi de la requête de login...\n');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`📊 Status: ${res.statusCode}`);
    console.log(`📋 Headers:`, res.headers);
    console.log('\n📦 Réponse:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
      if (res.statusCode === 200) {
        console.log('\n✅ Login réussi !');
        if (json.accessToken) {
          console.log(`🔑 Access Token: ${json.accessToken.substring(0, 20)}...`);
        }
        if (json.user) {
          console.log(`👤 User: ${json.user.email} (${json.user.tenantId})`);
        }
      } else {
        console.log('\n❌ Login échoué');
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erreur:', error.message);
  if (error.code === 'ECONNREFUSED') {
    console.error('💡 L\'API server n\'est pas démarré. Démarrez-le avec: npm run start:dev');
  }
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ Timeout: Le serveur ne répond pas');
  req.destroy();
  process.exit(1);
});

req.write(postData);
req.end();
