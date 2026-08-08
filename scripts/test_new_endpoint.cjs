async function main() {
  const loginRes = await fetch('https://api.academiahelm.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'cspeb-eveildafriqueeducation' },
    body: JSON.stringify({ email: 'salumerhel2036@gmail.com', password: 'CSPEB.fondé2021' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;

  // Test calculate-evaluation-averages with EMPTY body to see error message
  const r = await fetch('https://api.academiahelm.com/api/exams/calculate-evaluation-averages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  console.log('Status:', r.status);
  const text = await r.text();
  console.log('Response:', text.substring(0, 300));
}
main().catch(e => console.error(e.message));
