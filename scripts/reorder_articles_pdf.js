/**
 * Patch le fichier contract-generation.service.ts pour réorganiser les articles
 * du contrat en ordre séquentiel (1-7 dans colonne gauche, 8-14 + signatures dans colonne droite).
 */
const fs = require('fs');
const path = require('path');

const filePath = '/home/z/my-project/apps/api-server/src/onboarding/contract-generation.service.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// Identifier le bloc <div class="body">...</div> à remplacer
const bodyStart = content.indexOf('<div class="body">');
const bodyEnd = content.indexOf('</div>\n\n<div class="footer">');

if (bodyStart === -1 || bodyEnd === -1) {
  console.error('❌ Could not find body block markers');
  process.exit(1);
}

// Inclure </div> fermant
const blockEnd = content.indexOf('</div>', bodyEnd) + '</div>'.length;
const oldBlock = content.substring(bodyStart, blockEnd);

const newBlock = `<div class="body">
  <!-- ═══════════════ COLONNE GAUCHE — Articles 1 à 7 ═══════════════ -->
  <div class="col-left">
    <h2 class="article">Entre les soussignés</h2>
    <p><strong>YEHI OR Tech</strong>, éditrice de la plateforme SaaS Academia Helm, sise à Parakou, République du Bénin, représentée par son Directeur Technique et Co-fondateur, ci-après « <strong>le Prestataire</strong> ».</p>
    <p><strong>\${data.schoolName}</strong>, représentée par son promoteur <strong>\${data.promoterName}</strong>, ci-après « <strong>le Client</strong> ».</p>

    <h2 class="article">Article 1 — Fiche de souscription</h2>
    <div class="meta-grid">
      <div><span class="label">École :</span> <strong>\${data.schoolName}</strong></div>
      <div><span class="label">Promoteur :</span> <strong>\${data.promoterName}</strong></div>
      <div><span class="label">Ville :</span> \${data.schoolCity}</div>
      <div><span class="label">Tél :</span> \${data.schoolPhone}</div>
      <div><span class="label">Email :</span> \${data.schoolEmail}</div>
      <div><span class="label">Élèves :</span> <strong>\${data.studentCount}</strong></div>
      <div><span class="label">Plan :</span> <strong>\${data.planName}</strong></div>
      <div><span class="label">Bilingue :</span> \${data.bilingual ? 'Oui' : 'Non'}</div>
      <div style="grid-column: 1 / -1;"><span class="label">Sous-domaine :</span> \${data.subdomain}.academiahelm.com</div>
      <div style="grid-column: 1 / -1;"><span class="label">Date d'effet :</span> \${data.effectiveDate}</div>
    </div>

    <h2 class="article">Article 2 — Objet du contrat</h2>
    <p>Concession d'un droit d'usage non exclusif, non cessible et à titre onéreux de la plateforme Academia Helm (Web, Desktop, Mobile), hébergement, maintenance corrective et évolutive, support technique, onboarding, formation, et accès aux agents d'intelligence artificielle (ORION, SARA, ATLAS) dans le cadre d'un usage raisonnable et professionnel.</p>

    <h2 class="article">Article 3 — Plan souscrit et grille tarifaire</h2>
    <table>
      <thead>
        <tr>
          <th>Plan</th>
          <th>Élèves</th>
          <th style="text-align: right;">Activation (FCFA)</th>
          <th style="text-align: right;">Annuel (FCFA)</th>
          <th style="text-align: right;">Total An 1 (FCFA)</th>
        </tr>
      </thead>
      <tbody>
        \${planTable}
      </tbody>
    </table>
    \${data.bilingual ? '<p class="bilingual-note">Option bilingue FR/EN : <strong>50 000 FCFA/an</strong> (en supplément du plan)</p>' : ''}
    <div class="highlight-box">Coût total Année 1 : \${data.totalYearOne.toLocaleString('fr-FR')} FCFA</div>

    <h2 class="article">Article 4 — Prix et modalités de paiement</h2>
    <p>Frais d'activation de <strong>300 000 FCFA</strong> dus à la signature. Frais annuels de <strong>\${data.annualFee.toLocaleString('fr-FR')} FCFA</strong> dus chaque année à la <strong>date d'échéance annuelle</strong>. Réglement par virement bancaire, Mobile Money (FedaPay) ou espèces contre reçu. WhatsApp inclus gratuitement et illimité. SMS, Email et Voice facturés au prix coûtant selon la consommation réelle.</p>

    <h2 class="article">Article 5 — Durée et reconduction</h2>
    <p>Durée initiale d'un (1) an à compter de la date d'effet. Renouvelable par tacite reconduction pour des périodes successives d'un (1) an, sauf dénonciation par écrit au moins 60 jours avant la <strong>date d'échéance annuelle</strong>. Le Prestataire se réserve le droit de réviser la grille tarifaire pour les périodes de reconduction futures, sous réserve d'en informer le Client au moins 60 jours avant l'échéance.</p>

    <h2 class="article">Article 6 — Obligations du Prestataire</h2>
    <p>Disponibilité et maintenance de la plateforme, support technique, onboarding et formation initiale, confidentialité et sécurité des données, information en cas d'évolution substantielle. Usage des agents IA dans le cadre d'un usage raisonnable et professionnel.</p>

    <h2 class="article">Article 7 — Obligations du Client</h2>
    <p>Paiement des sommes dues aux échéances, informations exactes et à jour, usage conforme à la destination, confidentialité des identifiants de connexion, respect de la législation béninoise applicable à la protection des données personnelles.</p>
  </div>

  <!-- ═══════════════ COLONNE DROITE — Articles 8 à 14 + Signatures ═══════════════ -->
  <div class="col-right">
    <div>
      <h2 class="article">Article 8 — Propriété intellectuelle</h2>
      <p>La plateforme Academia Helm demeure la propriété exclusive du Prestataire. Le présent Contrat confère au Client un droit d'usage personnel, non exclusif et non transférable. Les données saisies par le Client demeurent sa propriété exclusive ; le Prestataire s'engage à en permettre l'export à tout moment.</p>
    </div>

    <div>
      <h2 class="article">Article 9 — Protection des données et confidentialité</h2>
      <p>Mesures techniques et organisationnelles raisonnables pour assurer la sécurité et la confidentialité des données. Confidentialité réciproque pendant 2 ans post-contractuelles.</p>
    </div>

    <div>
      <h2 class="article">Article 10 — Résiliation</h2>
      <p>Résiliation pour manquement grave après mise en demeure infructueuse (30 jours). Non-paiement persistant au-delà de 45 jours → résiliation de plein droit. Export des données sous 30 jours après résiliation.</p>
    </div>

    <div>
      <h2 class="article">Article 11 — Responsabilité et garanties</h2>
      <p>Responsabilité du Prestataire limitée aux sommes perçues sur les 12 derniers mois. L'architecture offline-first vise à limiter les pertes de données sans garantie absolue.</p>
    </div>

    <div>
      <h2 class="article">Article 12 — Force majeure</h2>
      <p>Aucune des Parties n'est responsable d'une non-exécution due à un cas de force majeure tel que défini par la jurisprudence béninoise.</p>
    </div>

    <div>
      <h2 class="article">Article 13 — Droit applicable et juridiction</h2>
      <p>Droit de la République du Bénin. Résolution amiable préalable (30 jours). À défaut, compétence des juridictions de Parakou.</p>
    </div>

    <div>
      <h2 class="article">Article 14 — Dispositions diverses</h2>
      <p>Le présent Contrat constitue l'intégralité de l'accord entre les Parties. Toute modification doit faire l'objet d'un avenant écrit signé des deux Parties.</p>
    </div>

    <!-- ── Section signatures ── -->
    <div class="signature-section">
      <h3>✍️ Signatures électroniques</h3>
      <div class="signature-grid">
        <div class="signature-box">
          <div class="label">Pour le Client — \${data.promoterName} (Promoteur)</div>
          \${data.promoterSignatureDataUrl
            ? \`<img src="\${data.promoterSignatureDataUrl}" alt="Signature promoteur" />\`
            : '<div class="sign-placeholder">Signature du promoteur</div>'
          }
          <div class="date">Date : \${data.promoterSignedAt ? new Date(data.promoterSignedAt).toLocaleDateString('fr-FR') : dateStr}</div>
        </div>
        <div class="signature-box">
          <div class="label">Pour le Prestataire — YEHI OR Tech</div>
          \${data.providerSignatureDataUrl
            ? \`<img src="\${data.providerSignatureDataUrl}" alt="Signature prestataire" />\`
            : '<div class="sign-placeholder">Signature du représentant YEHI OR Tech</div>'
          }
          <div class="date">Date : \${data.providerSignedAt ? new Date(data.providerSignedAt).toLocaleDateString('fr-FR') : '____ / ____ / ________'}</div>
        </div>
      </div>
      <p style="text-align: center; font-size: 9px; color: #6b7280; margin-top: 6px;">
        Fait à Parakou, le \${dateStr}, en deux (2) exemplaires originaux.
      </p>
    </div>
  </div>
</div>`;

const newContent = content.replace(oldBlock, newBlock);
if (newContent === content) {
  console.error('❌ Replacement failed — oldBlock not found');
  process.exit(1);
}

fs.writeFileSync(filePath, newContent, 'utf-8');
console.log('✅ Articles réorganisés dans contract-generation.service.ts');
console.log('   - Colonne gauche : Entre les soussignés + Articles 1 à 7');
console.log('   - Colonne droite : Articles 8 à 14 + Signatures');
