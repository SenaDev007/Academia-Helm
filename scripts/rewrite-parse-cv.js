#!/usr/bin/env node
/**
 * Patch IaPrismaService.parseCv to use multimodal vision API.
 * Replaces the parseCv method body (lines 60-165 of the original file)
 * with a new implementation that actually sends the document to the AI.
 */
const fs = require('fs');
const path = require('path');

const FILE = '/home/z/my-project/apps/api-server/src/hr/ia-prisma.service.ts';

const src = fs.readFileSync(FILE, 'utf8');

// The new parseCv method (from the comment marker to the closing brace)
const NEW_PARSE_CV = `  // ─── CV PARSING ────────────────────────────────────────────────────────────

  /**
   * Analyse sémantique d'un CV ou d'une lettre de motivation.
   *
   * Si un fichier est fourni (base64Data + mimeType), le document est envoyé
   * au modèle IA multimodal (GLM-5.1 vision) qui extrait les informations clés.
   * Si l'IA n'est pas configurée ou si l'analyse échoue, on retombe sur un
   * résultat structuré de secours basé sur les données candidat existantes.
   */
  async parseCv(tenantId: string, data: {
    fileUrl?: string;
    base64Data?: string;
    fileName?: string;
    mimeType?: string;
    candidateId?: string;
  }) {
    this.logger.log(\`parseCv called for tenant \${tenantId}, file=\${data.fileName || 'none'}, mime=\${data.mimeType || 'none'}\`);

    // Si un candidateId est fourni, on récupère les données existantes du candidat
    // pour enrichir le résultat du parsing et/ou servir de fallback
    let existingCandidate = null;
    if (data.candidateId) {
      existingCandidate = await this.prisma.hrCandidate.findFirst({
        where: { id: data.candidateId, tenantId },
        include: {
          applications: { include: { job: true } },
          academicProfile: true,
        },
      });
    }

    // ─── Appel IA avec le document réel ───────────────────────────────────
    if (this.isAiConfigured() && data.base64Data && data.mimeType) {
      const supportedMimeTypes = [
        'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
        'application/pdf',
      ];

      if (supportedMimeTypes.includes(data.mimeType.toLowerCase())) {
        const systemPrompt = \`Tu es le moteur HDIE (Helm Document Intelligence Engine) d'Academia Helm, spécialisé en analyse de CV et lettres de motivation pour le secteur de l'éducation.

Ta mission : analyser le document fourni (CV ou lettre de motivation) et en extraire les informations clés de manière structurée, factuelle et professionnelle.

RÈGLES D'ANALYSE :
- Identifie le nom complet du candidat (prénom + nom)
- Liste toutes les compétences techniques, pédagogiques et comportementales mentionnées (tableau de chaînes)
- Résume l'expérience professionnelle pertinente (postes, durées, établissements)
- Indique le niveau de formation le plus élevé et les diplômes clés
- Identifie 2-3 forces majeures du candidat (points forts)
- Identifie 1-2 axes d'amélioration ou points de vigilance (faiblesses)

FORMAT DE RÉPONSE : Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans commentaires, sans texte avant ou après. Le JSON doit avoir exactement cette structure :
{
  "name": "Prénom Nom",
  "skills": ["compétence1", "compétence2", ...],
  "experience": "Résumé de l'expérience (2-3 phrases)",
  "education": "Niveau de formation et diplômes",
  "strengths": "Forces principales du candidat",
  "weaknesses": "Axes d'amélioration"
}

Si une information n'est pas présente dans le document, mets une chaîne vide ou un tableau vide.\`;

        const userPrompt = \`Analyse ce document (\${data.fileName || 'CV/Lettre'}) et extrais les informations structurées demandées.\`;

        try {
          const aiResponse = await this.openRouter.chatWithDocument(
            userPrompt,
            data.base64Data,
            data.mimeType,
            systemPrompt,
            'HDIE',
            { temperature: 0.2, maxTokens: 1200 },
          );

          if (!aiResponse.isPlaceholder && aiResponse.content) {
            // Extraire le JSON de la réponse (peut être enveloppé dans du markdown)
            const jsonMatch = aiResponse.content.match(/\\{[\\s\\S]*\\}/);
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                  name: parsed.name || (existingCandidate ? \`\${existingCandidate.firstName} \${existingCandidate.lastName}\` : 'Candidat'),
                  skills: Array.isArray(parsed.skills) && parsed.skills.length > 0
                    ? parsed.skills.filter((s: any) => typeof s === 'string' && s.trim())
                    : (existingCandidate ? this.extractSkillsFromCandidate(existingCandidate) : ['Non spécifié']),
                  experience: parsed.experience || 'Non spécifié dans le document',
                  education: parsed.education || 'Non spécifié dans le document',
                  strengths: parsed.strengths || 'Non identifié',
                  weaknesses: parsed.weaknesses || 'Non identifié',
                  isPlaceholder: false,
                  confidence: 92,
                  candidateId: existingCandidate?.id,
                  fileName: data.fileName,
                  modelUsed: aiResponse.model,
                };
              } catch (parseErr) {
                this.logger.warn('[HDIE] JSON parse failed, using raw content as experience');
                // Si le JSON échoue, on utilise le texte brut comme experience
                return {
                  name: existingCandidate
                    ? \`\${existingCandidate.firstName} \${existingCandidate.lastName}\`
                    : 'Candidat',
                  skills: existingCandidate
                    ? this.extractSkillsFromCandidate(existingCandidate)
                    : ['Voir analyse complète ci-dessous'],
                  experience: aiResponse.content.substring(0, 800),
                  education: 'Voir analyse',
                  strengths: 'Analyse IA fournie (format non structuré)',
                  weaknesses: 'Voir analyse complète',
                  isPlaceholder: false,
                  confidence: 65,
                  candidateId: existingCandidate?.id,
                  fileName: data.fileName,
                  modelUsed: aiResponse.model,
                };
              }
            }
          }
        } catch (err) {
          this.logger.error(\`[HDIE] Document analysis failed: \${err?.message}\`, err?.stack);
          // On continue vers le fallback ci-dessous
        }
      } else {
        this.logger.warn(\`[HDIE] Unsupported MIME type for vision analysis: \${data.mimeType}\`);
      }
    }

    // ─── Fallback : IA non configurée OU analyse échouée ──────────────────
    if (existingCandidate) {
      const aiConfigured = this.isAiConfigured();
      return {
        name: \`\${existingCandidate.firstName} \${existingCandidate.lastName}\`,
        skills: this.extractSkillsFromCandidate(existingCandidate),
        experience: existingCandidate.academicProfile?.pedagogicalExperience
          || (aiConfigured
            ? 'L\\'analyse du document a échoué. Vérifiez le format du fichier (PDF, PNG, JPG).'
            : 'IA non configurée — données candidat depuis la base'),
        education: existingCandidate.academicProfile?.teachingLevel || 'Non spécifié',
        strengths: aiConfigured
          ? 'Le document n\\'a pas pu être analysé. Réessayez avec un autre fichier.'
          : 'L\\'analyse IA sera disponible une fois le service activé',
        weaknesses: aiConfigured
          ? 'Vérifiez la qualité et le format du fichier téléversé'
          : 'L\\'analyse sémantique avancée sera activée ultérieurement',
        isPlaceholder: !aiConfigured,
        confidence: 0,
        candidateId: existingCandidate.id,
        fileName: data.fileName,
      };
    }

    // Aucun candidat, aucune IA — placeholder générique
    const aiConfigured = this.isAiConfigured();
    return {
      name: aiConfigured ? 'Analyse en cours…' : '— (IA non configurée)',
      skills: aiConfigured
        ? ['L\\'analyse n\\'a pas pu aboutir']
        : ['Analyse sémantique non disponible'],
      experience: aiConfigured
        ? 'L\\'analyse du document a échoué. Vérifiez le format (PDF, PNG, JPG acceptés) et réessayez.'
        : 'L\\'analyse IA n\\'est pas encore activée. Contactez votre administrateur.',
      education: aiConfigured
        ? 'Vérifiez que le fichier est lisible et non corrompu.'
        : 'L\\'analyse automatique de CV sera disponible prochainement.',
      strengths: aiConfigured
        ? 'Réessayez avec un document plus clair ou mieux numérisé'
        : 'Le module d\\'analyse IA est en cours de configuration',
      weaknesses: aiConfigured
        ? 'Si le problème persiste, contactez l\\'administrateur'
        : 'L\\'analyse sémantique avancée sera disponible une fois le service activé',
      isPlaceholder: true,
      confidence: 0,
      fileName: data.fileName,
    };
  }`;

// Build the new source by replacing the old parseCv method
// The old method starts at "  // ─── CV PARSING" and ends just before "  // ─── MATCHING & CLASSEMENT"
const startMarker = '  // ─── CV PARSING ────────────────────────────────────────────────────────────';
const endMarker = '  // ─── MATCHING & CLASSEMENT (XAI) ───────────────────────────────────────────';

const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('ERROR: Could not find parseCv method markers');
  process.exit(1);
}

const newSrc = src.slice(0, startIdx) + NEW_PARSE_CV + '\n\n' + src.slice(endIdx);

fs.writeFileSync(FILE, newSrc, 'utf8');
console.log('SUCCESS: parseCv method replaced');
console.log(`Original size: ${src.length} bytes`);
console.log(`New size: ${newSrc.length} bytes`);
