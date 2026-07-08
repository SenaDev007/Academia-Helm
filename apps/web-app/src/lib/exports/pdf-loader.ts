/**
 * Charge jsPDF et jspdf-autotable depuis le CDN (pattern identique à finance-exports.ts)
 * Évite d'avoir à installer les packages npm (qui cassent le build Vercel).
 */

let jsPdfPromise: Promise<any> | null = null;
let autoTablePromise: Promise<void> | null = null;

export async function loadJsPdf(): Promise<any> {
  if (jsPdfPromise) return jsPdfPromise;
  jsPdfPromise = new Promise((resolve, reject) => {
    if ((window as any).jspdf && (window as any).jspdf.jsPDF) {
      resolve((window as any).jspdf.jsPDF);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.async = true;
    script.onload = () => {
      const jsPDF = (window as any).jspdf?.jsPDF;
      if (!jsPDF) {
        reject(new Error('jsPDF indisponible après chargement'));
        return;
      }
      resolve(jsPDF);
    };
    script.onerror = () => reject(new Error('Impossible de charger jsPDF depuis le CDN'));
    document.head.appendChild(script);
  });
  return jsPdfPromise;
}

export async function loadAutoTable(jsPDF: any): Promise<void> {
  if (autoTablePromise) return autoTablePromise;
  autoTablePromise = new Promise((resolve, reject) => {
    if (jsPDF.API?.autoTable) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
    script.async = true;
    script.onload = () => {
      if (jsPDF.API?.autoTable) {
        resolve();
      } else {
        reject(new Error('autoTable indisponible après chargement'));
      }
    };
    script.onerror = () => reject(new Error('Impossible de charger autoTable depuis le CDN'));
    document.head.appendChild(script);
  });
  return autoTablePromise;
}

/**
 * Charge jsPDF + autoTable et retourne { jsPDF, autoTable }.
 * Utilisation :
 *   const { jsPDF, autoTable } = await loadPdfLibs();
 *   const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
 *   autoTable(doc, { head: [...], body: [...] });
 */
export async function loadPdfLibs(): Promise<{ jsPDF: any; autoTable: any }> {
  const jsPDF = await loadJsPdf();
  await loadAutoTable(jsPDF);
  return { jsPDF, autoTable: (doc: any, options: any) => doc.autoTable(options) };
}
