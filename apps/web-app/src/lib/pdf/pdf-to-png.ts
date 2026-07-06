/**
 * ============================================================================
 * PDF → PNG — Conversion côté client pour presse-papier WhatsApp
 * ============================================================================
 *
 * Utilise pdfjs-dist (Mozilla) chargé via CDN pour éviter une dépendance npm.
 * Rend la 1ère page du PDF sur un canvas haute résolution (scale 2x) puis
 * exporte en PNG blob utilisable avec navigator.clipboard.write().
 *
 * Compatibilité clipboard binaire :
 *   - Chrome, Edge, Safari : ✅ image/png supporté
 *   - Firefox : ❌ non supporté (fallback : téléchargement automatique du PNG)
 *
 * Documentation pdfjs :
 *   https://mozilla.github.io/pdf.js/getting_started/
 * ============================================================================
 */

const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

let pdfjsPromise: Promise<any> | null = null;

/**
 * Charge pdfjs-dist dynamiquement (une seule fois par session).
 */
function loadPdfjs(): Promise<any> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.async = true;
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        reject(new Error('pdfjsLib indisponible après chargement'));
        return;
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      resolve(pdfjsLib);
    };
    script.onerror = () => reject(new Error('Impossible de charger pdfjs depuis le CDN'));
    document.head.appendChild(script);
  });
  return pdfjsPromise;
}

/**
 * Convertit un PDF (ArrayBuffer) en PNG Blob (page 1, scale 2x).
 *
 * @param pdfData ArrayBuffer du PDF
 * @returns { blob: Blob, width: number, height: number, dataUrl: string }
 */
export async function pdfToPng(
  pdfData: ArrayBuffer,
  options: { scale?: number; maxWidth?: number } = {},
): Promise<{ blob: Blob; width: number; height: number; dataUrl: string }> {
  const scale = options.scale ?? 2; // 2x pour haute résolution (lisible sur mobile)
  const maxWidth = options.maxWidth ?? 1240;

  const pdfjsLib = await loadPdfjs();

  const loadingTask = pdfjsLib.getDocument({
    data: pdfData,
    disableWorker: false,
  });

  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  // Viewport à l'échelle demandée
  let viewport = page.getViewport({ scale });

  // Si trop large, réduire pour tenir dans maxWidth
  if (viewport.width > maxWidth) {
    const ratio = maxWidth / viewport.width;
    viewport = page.getViewport({ scale: scale * ratio });
  }

  // Canvas avec fond blanc (les PDFs ont souvent un fond transparent)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context indisponible');

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  // Fond blanc
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render
  await page.render({
    canvasContext: ctx,
    viewport,
    background: '#ffffff',
  }).promise;

  // Convertir en blob PNG
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob a échoué'))),
      'image/png',
      0.95,
    );
  });

  // Data URL pour preview/fallback
  const dataUrl = canvas.toDataURL('image/png');

  // Cleanup
  pdf.cleanup();
  pdf.destroy();

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    dataUrl,
  };
}

/**
 * Copie un PNG blob dans le presse-papier.
 *
 * @returns true si la copie a réussi, false sinon (fallback : download)
 */
export async function copyPngToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard || !navigator.clipboard.write) {
      return false;
    }
    const ClipboardItemClass = (window as any).ClipboardItem;
    if (!ClipboardItemClass) {
      return false;
    }
    const item = new ClipboardItemClass({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    console.warn('copyPngToClipboard failed:', err);
    return false;
  }
}

/**
 * Télécharge un blob (fallback quand le presse-papier binaire n'est pas supporté).
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Vérifie si le navigateur supporte la copie binaire dans le presse-papier.
 * Utilisé pour adapter l'UI (afficher ou non le bouton "Copier l'image").
 */
export function isClipboardImageSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    !!navigator.clipboard.write &&
    typeof (window as any).ClipboardItem !== 'undefined'
  );
}

/**
 * Génère un nom de fichier propre pour un reçu.
 */
export function receiptFilename(receiptNumber: string, ext: 'png' | 'pdf' = 'png'): string {
  const safe = receiptNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `recu-${safe}.${ext}`;
}
