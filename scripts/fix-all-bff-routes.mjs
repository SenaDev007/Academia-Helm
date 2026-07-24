import fs from 'fs';
import path from 'path';

const API_DIR = '/home/z/my-project/apps/web-app/src/app/api';

function findRouteFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findRouteFiles(fullPath));
    } else if (item === 'route.ts') {
      results.push(fullPath);
    }
  }
  return results;
}

const routeFiles = findRouteFiles(API_DIR);
let fixed = 0;

for (const file of routeFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Pattern cassé : ",\n    , cache: 'no-store' }," → ",\n      cache: 'no-store',\n    },"
  content = content.replace(
    /(\w+),\s*\n\s*,\s*cache:\s*'no-store'\s*\}/g,
    '$1,\n      cache: \'no-store\',\n    }'
  );

  // Pattern alternatif
  content = content.replace(
    /,\s*\n(\s*),\s*cache:\s*'no-store'\s*\}/g,
    ',\n$1  cache: \'no-store\',\n$1}'
  );

  // Pattern simple sur une ligne seule
  content = content.replace(
    /^\s*,\s*cache:\s*'no-store'\s*\},\s*(\d+)\);/gm,
    '    cache: \'no-store\',\n  }, $1);'
  );

  if (content !== original) {
    fs.writeFileSync(file, content);
    fixed++;
    console.log(`  ✓ Fixed: ${file.replace(API_DIR, '')}`);
  }
}

console.log(`\nFixed ${fixed} files`);
