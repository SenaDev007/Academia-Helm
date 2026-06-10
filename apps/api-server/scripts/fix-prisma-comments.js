// Script pour remplacer tous les commentaires multi-lignes /** */ par //
// dans le fichier schema.prisma

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '../prisma/schema.prisma');

function fixComments() {
  try {
    let content = fs.readFileSync(SCHEMA_PATH, 'utf8');
    
    // Pattern pour trouver les commentaires multi-lignes
    // /** ... */ sur plusieurs lignes
    const multiLineCommentRegex = /\/\*\*[\s\S]*?\*\//g;
    
    // Remplacer chaque commentaire multi-ligne
    content = content.replace(multiLineCommentRegex, (match) => {
      // Extraire le contenu du commentaire (sans /** et */)
      const commentContent = match
        .replace(/^\/\*\*/, '')
        .replace(/\*\/$/, '')
        .trim();
      
      // Diviser en lignes et ajouter // au début de chaque ligne
      const lines = commentContent.split('\n');
      const fixedLines = lines.map(line => {
        const trimmed = line.trim();
        // Si la ligne commence déjà par *, l'enlever
        const cleaned = trimmed.replace(/^\*\s*/, '');
        return cleaned ? `// ${cleaned}` : '//';
      });
      
      return fixedLines.join('\n');
    });
    
    fs.writeFileSync(SCHEMA_PATH, content, 'utf8');
    console.log('✅ Commentaires multi-lignes remplacés par //');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixComments();
