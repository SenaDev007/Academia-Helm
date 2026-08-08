// Test the calculate-evaluation-averages endpoint directly
const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const CLASS_ID = 'f33e8383-627d-4ecb-8a91-4e084eb13075'; // CI A
const PERIOD_ID = '0e65f84b-2fa3-4c88-a4aa-8a52b278200c'; // T1
const YEAR_ID = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';
const EVAL_TYPE_ID = 'b05bf89d-6bed-499b-aaab-7b9bfeab0f34'; // EM1

async function main() {
  // Login first
  const loginRes = await fetch('https://api.academiahelm.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'cspeb-eveildafriqueeducation' },
    body: JSON.stringify({ email: 'salumerhel2036@gmail.com', password: 'CSPEB.fondé2021' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  console.log('Token:', token?.substring(0, 30) + '...');

  // Test calculate-evaluation-averages
  const r = await fetch('https://api.academiahelm.com/api/exams/calculate-evaluation-averages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': 'cspeb-eveildafriqueeducation',
    },
    body: JSON.stringify({
      classId: CLASS_ID,
      periodId: PERIOD_ID,
      academicYearId: YEAR_ID,
      evaluationTypeId: EVAL_TYPE_ID,
    }),
  });
  console.log('Status:', r.status);
  const text = await r.text();
  console.log('Response:', text.substring(0, 800));
}
main().catch(e => console.error(e.message));
