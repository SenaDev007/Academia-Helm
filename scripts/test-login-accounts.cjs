// Try multiple test accounts to find one that works
const accounts = [
  ['salumerhel2036@gmail.com', 'TestEveil2026!'],
  ['salumerhel2036@gmail.com', 'EveilAfrique2025!'],
  ['salumerhel2036@gmail.com', 'EveilAfriqueEducation2026!'],
  ['saliou.akpaki@academiahelm.com', 'Akpaki@2025'],
  ['promoteur@cspeb.bj', 'promoteur123'],
  ['s.akpovitohou@gmail.com', 'C@ptain.Yehioracadhub2021'],
  ['s.akpovitohou@gmail.com', 'promoteur123'],
  ['superadmin@academiahub.com', 'superadmin123'],
  ['patronat@test.com', 'patronat123'],
];

(async () => {
  for (const [email, pwd] of accounts) {
    try {
      const res = await fetch('https://api.academiahelm.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'cspeb-eveildafriqueeducation' },
        body: JSON.stringify({ email, password: pwd }),
      });
      const status = res.status;
      const data = await res.json().catch(() => ({}));
      const ok = status === 200;
      console.log(`${ok ? '✅' : '❌'} ${email} / ${pwd} → ${status} ${ok ? 'SUCCESS' : (data.message || data.error || '')}`);
      if (ok) break;
    } catch (e) {
      console.log(`💥 ${email} / ${pwd} → ${e.message}`);
    }
  }
})();
