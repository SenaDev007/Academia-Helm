async function main() {
  const loginRes = await fetch('https://api.academiahelm.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'cspeb-eveildafriqueeducation' },
    body: JSON.stringify({ email: 'salumerhel2036@gmail.com', password: 'CSPEB.fondé2021' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;

  // Test GET /exams (works)
  const r1 = await fetch('https://api.academiahelm.com/api/exams', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log('GET /exams:', r1.status);

  // Test POST /exams (create) — should fail with validation error if tenantId works
  const r2 = await fetch('https://api.academiahelm.com/api/exams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  console.log('POST /exams (empty):', r2.status, (await r2.text()).substring(0, 200));

  // Test GET /exams/averages
  const r3 = await fetch('https://api.academiahelm.com/api/exams/averages?classId=f33e8383-627d-4ecb-8a91-4e084eb13075&periodId=0e65f84b-2fa3-4c88-a4aa-8a52b278200c&academicYearId=a7593470-e4f4-460a-b3b6-4dabe53bec2a', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log('GET /exams/averages:', r3.status, (await r3.text()).substring(0, 200));
}
main().catch(e => console.error(e.message));
