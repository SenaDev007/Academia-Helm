async function main() {
  const loginRes = await fetch('https://api.academiahelm.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'cspeb-eveildafriqueeducation' },
    body: JSON.stringify({ email: 'salumerhel2036@gmail.com', password: 'CSPEB.fondé2021' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;

  // Decode JWT
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  console.log('JWT tenantId:', payload.tenantId);

  // Test a parent-portal endpoint that uses @CurrentUser + @TenantId
  // GET /parent/children should work if @TenantId works
  const r = await fetch('https://api.academiahelm.com/api/parent/children?academicYearId=a7593470-e4f4-460a-b3b6-4dabe53bec2a', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log('GET /parent/children:', r.status);
  const text = await r.text();
  console.log('Response:', text.substring(0, 300));
}
main().catch(e => console.error(e.message));
