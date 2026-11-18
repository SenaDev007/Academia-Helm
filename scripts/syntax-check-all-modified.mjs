// Syntax check ALL working-tree modified .tsx/.ts files (web-app sweep +
// structural edits) — catches anything the global dvh replacement may have hit.
import { execSync } from 'child_process';

const out = execSync('git status --short', { cwd: '/home/z/my-project/academia-helm' }).toString();
const files = out
  .split('\n')
  .map((l) => l.slice(3).trim())
  .filter((f) => f && /\.(tsx|ts)$/.test(f) && !f.includes('node_modules'));

console.log(`Checking ${files.length} modified TS/TSX files…`);
let bad = 0;
for (const f of files) {
  const path = '/home/z/my-project/academia-helm/' + f;
  // esbuild transpile = fast, low-memory syntax + JSX validation
  try {
    execSync(
      `apps/web-app/node_modules/.bin/esbuild "${path}" --loader:.tsx=tsx --loader:.ts=ts --outfile=/dev/null --log-level=error`,
      { cwd: '/home/z/my-project/academia-helm', stdio: 'pipe' }
    );
    console.log(`OK: ${f}`);
  } catch (e) {
    bad++;
    const msg = e.stderr ? e.stderr.toString().slice(0, 400) : e.message;
    console.log(`FAIL: ${f}\n${msg}`);
  }
}
console.log(bad === 0 ? `\nAll ${files.length} files transpile OK` : `\n${bad} FAIL`);
process.exit(bad === 0 ? 0 : 1);
