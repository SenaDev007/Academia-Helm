const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf-8');

// 1. Replace /** ... */ with // ...
content = content.replace(/\/\*\*([\s\S]*?)\*\//g, (match, p1) => {
    return p1.split('\n').map(line => {
        let trimmed = line.trim();
        if (trimmed.startsWith('*')) {
            trimmed = trimmed.substring(1).trim();
        }
        if (trimmed === '') return '//';
        return '// ' + trimmed;
    }).join('\n');
});

fs.writeFileSync(schemaPath, content, 'utf-8');
console.log('Fixed multiline comments.');
