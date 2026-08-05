async function main() {
  // Test the health endpoint to see version
  const r = await fetch('https://api.academiahelm.com/health');
  const data = await r.json();
  console.log('Health:', JSON.stringify(data));
  
  // Login
  const loginRes = await fetch('https://api.academiahelm.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'cspeb-eveildafriqueeducation' },
    body: JSON.stringify({ email: 'salumerhel2036@gmail.com', password: 'CSPEB.fondé2021' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;

  // Test calculate-evaluation-averages with evaluationTypeId that exists
  // Let's first get the evaluation types
  const typesRes = await fetch('https://api.academiahelm.com/api/institutional-exams/config/evaluation-types?schoolLevelId=bc434610-8cf6-4415-a51a-cc5300cd99da', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log('\nEval types status:', typesRes.status);
  const typesText = await typesRes.text();
  console.log('Eval types:', typesText.substring(0, 500));
}
main().catch(e => console.error(e.message));
