/**
 * ============================================================================
 * ZIP Writer — minimaliste, zéro dépendance (T27 — 2026-10-01)
 * ============================================================================
 *
 * But : téléchargement EN BLOC des relevés de notes (admissibles / ajournés)
 * côté école — une archive ZIP contenant un PDF par candidat, SANS ajouter de
 * dépendance (archiver/jszip absents du package.json ; npm install indisponible
 * de manière fiable dans l'environnement de build).
 *
 * Méthode utilisée : STORE (pas de compression). Les PDF produits par Puppeteer
 * sont déjà des flux compressés en interne — les recompresser n'apporte rien et
 * la méthode STORE est la plus rapide et la plus sûre à écrire à la main.
 *
 * Format implémenté (spécification PKWARE APPNOTE, subset universel) :
 *   - Local File Header (signature 0x04034b50) + données brutes, par fichier ;
 *   - Central Directory (signature 0x02014b50) ; flags bit 11 = noms UTF-8 ;
 *   - End Of Central Directory (signature 0x06054b50).
 *
 * Conformité : Excel/Windows Explorer/macOS Archive Utility/7-Zip/unzip
 * lisent tous ce format depuis des décennies. CRC32 standard (polynôme
 * réflexi 0xEDB88320, table générée à l'initialisation du module).
 */

/** Table CRC32 (polynôme réfléchi 0xEDB88320) — identique à zlib. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC32 d'un buffer (valeur non complémentée à l'entrée, complémentée à la sortie). */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntryInput {
  /** Nom de fichier DANS l'archive (ex. « Releve_CEP-2026-00001_KORA_Mariam.pdf »). */
  name: string;
  /** Contenu brut du fichier. */
  data: Buffer;
  /** Date « dernière modification » (défaut : maintenant). */
  mtime?: Date;
}

/** DOS date/time (2 mots de 16 bits) depuis une Date. */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, Math.min(2107, d.getFullYear()));
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    ((Math.floor(d.getSeconds() / 2) & 0x1f) >>> 0);
  const date = ((year - 1980) & 0x7f) << 9 | ((d.getMonth() + 1) & 0x0f) << 5 | (d.getDate() & 0x1f);
  return { time: time >>> 0, date: date >>> 0 };
}

/**
 * Construit une archive ZIP (méthode STORE) à partir d'entrées.
 * Retourne le Buffer complet de l'archive.
 */
export function createZipArchive(entries: ZipEntryInput[]): Buffer {
  const now = new Date();
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const { time, date } = dosDateTime(entry.mtime ?? now);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // ── Local File Header (30 octets + nom) ──
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // signature
    lfh.writeUInt16LE(20, 4); // version needed to extract (2.0 = STORE)
    lfh.writeUInt16LE(0x0800, 6); // flags : bit 11 = UTF-8 filenames
    lfh.writeUInt16LE(0, 8); // méthode : 0 = STORE
    lfh.writeUInt16LE(time, 10);
    lfh.writeUInt16LE(date, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(size, 18); // taille compressée = taille (STORE)
    lfh.writeUInt32LE(size, 22); // taille non compressée
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28); // longueur du champ extra (local)
    locals.push(lfh, nameBuf, entry.data);

    // ── Central Directory Header (46 octets + nom) ──
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0); // signature
    cdh.writeUInt16LE(0x031e, 4); // version made by (UNIX, 3.0) — large fichier OK
    cdh.writeUInt16LE(20, 6); // version needed to extract
    cdh.writeUInt16LE(0x0800, 8); // flags UTF-8
    cdh.writeUInt16LE(0, 10); // STORE
    cdh.writeUInt16LE(time, 12);
    cdh.writeUInt16LE(date, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(size, 20);
    cdh.writeUInt32LE(size, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30); // extra
    cdh.writeUInt16LE(0, 32); // commentaire
    cdh.writeUInt16LE(0, 34); // disque de départ
    cdh.writeUInt16LE(0, 36); // attributs internes (2 octets)
    // attributs externes : fichier rw-r--r-- (644 octal) — ⚠️ `<<` produit un
    // signé 32 bits en JS (négatif au-delà de 2^31) : `>>> 0` le rend non signé.
    cdh.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    cdh.writeUInt32LE(offset, 42); // position de l'en-tête local
    centrals.push(cdh, nameBuf);

    offset += 30 + nameBuf.length + size;
  }

  const centralBuf = Buffer.concat(centrals);

  // ── End Of Central Directory (22 octets) ──
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disque courant
  eocd.writeUInt16LE(0, 6); // disque du répertoire
  eocd.writeUInt16LE(entries.length, 8); // entrées sur ce disque
  eocd.writeUInt16LE(entries.length, 10); // entrées au total
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16); // taille de l'archive avant le central
  eocd.writeUInt16LE(0, 20); // longueur du commentaire

  return Buffer.concat([...locals, centralBuf, eocd]);
}

/**
 * Nom de fichier PDF sûr pour une archive (et pour Content-Disposition) :
 * « Releve_<matricule>_<NOM_Prenom>.pdf » — accents/majuscules/espaces
 * normalisés, caractères filesystem-dangereux éliminés.
 */
export function safeReleveFileName(matricule: string, fullName: string): string {
  const norm = (s: string) =>
    (s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // accents
      .replace(/[''`]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
  const mat = norm(matricule) || 'candidat';
  const name = norm(fullName) || 'eleve';
  return `Releve_${mat}_${name}.pdf`;
}
