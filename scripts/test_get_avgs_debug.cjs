async function main() {
  const loginRes = await fetch('https://api.academiahelm.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'cspeb-eveildafriqueeducation' },
    body: JSON.stringify({ email: 'salumerhel2036@gmail.com', password: 'CSPEB.fondé2021' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;

  // Test GET /exams/evaluations (should work — it uses @TenantId too)
  const r1 = await fetch('https://api.academiahelm.com/api/exams/evaluations?academicYearId=a7593470-e4f4-460a-b3b6-4dabe53bec2a', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log('GET /exams/evaluations:', r1.status);
  const t1 = await r1.text();
  console.log('Response:', t1.substring(0, 300));

  // Test GET /exams/dashboard
  const r2 = await fetch('https://api.academiahelm.com/api/exams/dashboard?academicYearId=a7593470-e4f4-460a-b3b6-4dabe53bec2a', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log('\nGET /exams/dashboard:', r2.status);
  const t2 = await r2.text();
  console.log('Response:', t2.substring(0, 300));
}
main().catch(e => console.error(e.message));
