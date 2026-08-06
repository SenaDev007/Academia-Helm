async function main() {
  const loginRes = await fetch('https://api.academiahelm.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'cspeb-eveildafriqueeducation' },
    body: JSON.stringify({ email: 'salumerhel2036@gmail.com', password: 'CSPEB.fondé2021' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;

  // Test GET /exams/averages
  const r = await fetch('https://api.academiahelm.com/api/exams/averages?classId=f33e8383-627d-4ecb-8a91-4e084eb13075&periodId=0e65f84b-2fa3-4c88-a4aa-8a52b278200c&academicYearId=a7593470-e4f4-460a-b3b6-4dabe53bec2a', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': 'cspeb-eveildafriqueeducation',
    },
  });
  console.log('GET /exams/averages Status:', r.status);
  const text = await r.text();
  console.log('Response:', text.substring(0, 500));
}
main().catch(e => console.error(e.message));
