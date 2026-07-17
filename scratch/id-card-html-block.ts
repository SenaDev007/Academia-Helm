    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Carte Scolaire - ${student.firstName} ${student.lastName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .card-container {
      display: flex;
      gap: 6mm;
      page-break-inside: avoid;
      margin: 4mm;
    }
    .card {
      width: 85.6mm;
      height: 53.98mm;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
      position: relative;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 4px rgba(0,0,0,0.08);
    }
    /* En-tête bleu marine — logo à gauche, nom école centré, titre à droite */
    .card-header {
      background: ${NAVY};
      color: #fff;
      padding: 3px 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 12mm;
      gap: 4px;
      position: relative;
    }
    /* Ligne diagonale décorative séparant header du body */
    .card-header::after {
      content: '';
      position: absolute;
      left: 0; right: 0; bottom: -1px;
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, ${NAVY_LIGHT} 50%, transparent 100%);
      opacity: 0.6;
    }
    .header-logo {
      width: 10mm;
      height: 10mm;
      background: #fff;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
      padding: 1px;
    }
    .header-school {
      flex: 1;
      text-align: center;
      padding: 0 2px;
      min-width: 0;
    }
    .header-school-name {
      font-size: 8.5pt;
      font-weight: 800;
      line-height: 1.1;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      word-break: break-word;
      hyphens: auto;
    }
    .header-school-slogan {
      font-size: 5.5pt;
      opacity: 0.85;
      margin-top: 1px;
      font-style: italic;
      line-height: 1.1;
    }
    .header-card-title {
      font-size: 6pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.95;
      padding: 2px 4px;
      background: rgba(255,255,255,0.18);
      border-radius: 3px;
      flex-shrink: 0;
    }

    /* Corps de la carte — photo à gauche, infos à droite */
    .card-body {
      flex: 1;
      display: flex;
      padding: 4px 6px;
      gap: 5px;
      background: #fff;
      align-items: stretch;
    }
    .photo-box {
      width: 24mm;
      height: 30mm;
      border: 2px solid ${NAVY};
      border-radius: 4px;
      overflow: hidden;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      align-self: center;
    }
    .info-list {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1.8px;
      min-width: 0;
    }
    .info-row {
      display: flex;
      align-items: baseline;
      line-height: 1.25;
    }
    .info-label {
      font-weight: 700;
      color: ${NAVY};
      min-width: 22mm;
      font-size: 6.5pt;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .info-value {
      color: #1f2937;
      flex: 1;
      font-size: 7.5pt;
      font-weight: 500;
      word-break: break-word;
    }
    .info-value.bold {
      font-weight: 700;
      font-size: 8pt;
    }
    .matricule-box {
      margin-top: 3px;
      padding: 2.5px 4px;
      background: ${NAVY};
      color: #fff;
      font-size: 7pt;
      font-weight: 800;
      text-align: center;
      border-radius: 3px;
      letter-spacing: 0.5px;
    }

    /* Pied de carte bleu marine — adresse + téléphone */
    .card-footer {
      background: ${NAVY};
      color: #fff;
      padding: 3px 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6pt;
      min-height: 5.5mm;
      gap: 4px;
    }
    .footer-address {
      opacity: 0.9;
      flex: 1;
      min-width: 0;
      line-height: 1.2;
    }
    .footer-phone {
      opacity: 0.95;
      font-weight: 700;
      flex-shrink: 0;
    }

    /* === VERSO === */
    .verso-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 4px 6px;
      background: #fff;
      font-size: 6pt;
      color: #424242;
    }
    .verso-section {
      display: flex;
      flex: 1;
      gap: 6px;
    }
    .verso-left {
      flex: 1.4;
      display: flex;
      flex-direction: column;
    }
    .verso-terms-title {
      font-size: 7pt;
      font-weight: 800;
      color: ${NAVY};
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
      padding-bottom: 1px;
      border-bottom: 1px solid ${NAVY_LIGHT};
    }
    .verso-terms {
      font-size: 5pt;
      line-height: 1.3;
      color: #6b7280;
      margin-bottom: 3px;
    }
    .verso-terms p {
      font-size: 5pt;
      line-height: 1.3;
      color: #6b7280;
    }
    .verso-contact {
      font-size: 6pt;
      margin-top: auto;
      padding-top: 2px;
      border-top: 1px dashed #e5e7eb;
    }
    .verso-contact div {
      line-height: 1.4;
    }
    .verso-contact-label {
      color: ${NAVY};
      font-weight: 700;
      display: inline-block;
      min-width: 12mm;
    }
    .verso-right {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 3px;
    }
    .verso-dates {
      font-size: 5.5pt;
      color: #424242;
      text-align: center;
      line-height: 1.4;
      width: 100%;
    }
    .verso-dates strong {
      color: ${NAVY};
      font-size: 5.5pt;
    }
    /* QR code avec logo intégré au centre — plus grand qu'avant pour bien
       voir le logo (20mm au lieu de 18mm) */
    .verso-qr {
      width: 20mm;
      height: 20mm;
      border: 1px solid ${NAVY_LIGHT};
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      padding: 1px;
    }
    .verso-qr img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .verso-signature {
      text-align: center;
      font-size: 5.5pt;
      color: #6b7280;
      width: 100%;
    }
    .verso-signature-line {
      font-family: 'Brush Script MT', cursive;
      font-size: 10pt;
      color: ${NAVY};
      font-style: italic;
      border-bottom: 1px solid #9ca3af;
      padding-bottom: 1px;
      margin-bottom: 1px;
    }
    .verso-barcode {
      display: flex;
      align-items: center;
      height: 5mm;
      width: 100%;
      gap: 0;
      padding: 0 2px;
    }

    @media print {
      .card-container { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="card-container">
    <!-- ============ RECTO ============ -->
    <div class="card card-front">
      <div class="card-header">
        <div class="header-logo">${headerLogoHtml}</div>
        <div class="header-school">
          <div class="header-school-name">${schoolName}</div>
          <div class="header-school-slogan">${schoolSlogan}</div>
        </div>
        <div class="header-card-title">Carte Scolaire</div>
      </div>

      <div class="card-body">
        ${photoBoxHtml}
        <div class="info-list">
          <div class="info-row">
            <span class="info-label">Matricule</span>
            <span class="info-value bold">${matricule}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Nom</span>
            <span class="info-value bold">${student.lastName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Prénom(s)</span>
            <span class="info-value bold">${student.firstName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Né(e) le</span>
            <span class="info-value">${formatDate(student.dateOfBirth)}${student.placeOfBirth ? ' à ' + student.placeOfBirth : ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Sexe</span>
            <span class="info-value">${student.gender === 'M' ? 'Masculin' : student.gender === 'F' ? 'Féminin' : 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Classe</span>
            <span class="info-value">${currentClass?.name || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Niveau</span>
            <span class="info-value">${schoolLevel?.label || schoolLevel?.name || schoolLevel?.code || 'N/A'}</span>
          </div>
          ${showGuardian ? `<div class="info-row">
            <span class="info-label">Parent/Tuteur</span>
            <span class="info-value">${guardianName}</span>
          </div>` : ''}
          ${showEmergencyCall ? `<div class="info-row">
            <span class="info-label">Urgence</span>
            <span class="info-value">${guardianPhone}</span>
          </div>` : ''}
        </div>
      </div>

      <div class="card-footer">
        ${showSchoolAddress ? `<div class="footer-address">${schoolAddress}</div>` : '<div></div>'}
        <div class="footer-phone">Tél. ${schoolPhone}</div>
      </div>
    </div>

    <!-- ============ VERSO ============ -->
    <div class="card card-back">
      <div class="card-header">
        <div class="header-card-title" style="background:transparent;">${footerText}</div>
        <div class="header-school">
          <div class="header-school-name" style="font-size:8pt;">${schoolName}</div>
          <div class="header-school-slogan">Année ${academicYear?.name || ''}</div>
        </div>
        <div class="header-logo" style="width:9mm;height:9mm;">${headerLogoHtml}</div>
      </div>

      <div class="verso-body">
        <div class="verso-section">
          <div class="verso-left">
            <div class="verso-terms-title">Conditions d'utilisation</div>
            <div class="verso-terms">
              <p>${conditionsText}</p>
            </div>
            <div class="verso-contact">
              <div><span class="verso-contact-label">Téléphone</span> ${schoolPhone}</div>
              <div><span class="verso-contact-label">Email</span> ${schoolEmail}</div>
              <div><span class="verso-contact-label">Adresse</span> ${schoolAddress}</div>
            </div>
          </div>
          <div class="verso-right">
            <div class="verso-dates">
              <div><strong>Émise le</strong></div>
              <div>${joinedDate}</div>
              <div style="margin-top:2px;"><strong>Expire le</strong></div>
              <div>${expireDate}</div>
            </div>
            ${showQRCode && qrCodeDataUrl ? `<div class="verso-qr"><img src="${qrCodeDataUrl}" alt="QR" /></div>` : ''}
            <div class="verso-signature">
              <div class="verso-signature-line">Le Directeur</div>
              <div>Signature & Cachet</div>
            </div>
            ${showBarcode ? `<div class="verso-barcode">${barcodeBars}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="card-footer">
        <div class="footer-address">${footerText}</div>
        <div class="footer-phone">Vérifiable via QR code</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;
