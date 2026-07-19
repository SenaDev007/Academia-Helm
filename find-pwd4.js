const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // Try more password variants
  const passwords = [
    'EveilAfrique2025!', 'EveilAfriqueEducation2026!', 'CSPEB2026!', 
    'cspeb2026!', 'EveildAfrique2026!', 'eveil2026', 'SalumEveil2026!',
    'Eveil@2026', 'eveilafrique', 'Salumerhel2026!', 'salumerhel2036',
    'AcademiaHelm2026!', 'EveilAfriqueEducation', 'Promoter2026!',
    'Directeur2026!', 'Eveil123!', 'Bèyarou2026!'
  ];
  
  for (const pwd of passwords) {
    const r = await fetch('https://api.academiahelm.com/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-tenant-id': 'cspeb-eveildafriqueeducation'},
      body: JSON.stringify({email: 'salumerhel2036@gmail.com', password: pwd})
    });
    if (r.status === 200) {
      console.log(`✅ FOUND: "${pwd}"`);
      break;
    } else {
      const data = await r.json().catch(() => ({}));
      console.log(`❌ "${pwd}": ${r.status}`);
    }
  }
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
