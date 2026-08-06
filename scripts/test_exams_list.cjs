async function main() {
  const loginRes = await fetch('https://api.academiahelm.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'cspeb-eveildafriqueeducation' },
    body: JSON.stringify({ email: 'salumerhel2036@gmail.com', password: 'CSPEB.fondé2021' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;

  // Test GET /exams (should work if tenantId is resolved)
  const r = await fetch('https://api.academiahelm.com/api/exams', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  console.log('GET /exams Status:', r.status);
  const text = await r.text();
  console.log('Response:', text.substring(0, 300));
}
main().catch(e => console.error(e.message));
