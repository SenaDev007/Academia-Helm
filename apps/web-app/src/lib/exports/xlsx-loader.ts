/**
 * Charge SheetJS (xlsx) depuis le CDN.
 * Évite d'avoir à installer le package npm (qui casse le build Vercel).
 */

let xlsxPromise: Promise<any> | null = null;

export async function loadXlsx(): Promise<any> {
  if (xlsxPromise) return xlsxPromise;
  xlsxPromise = new Promise((resolve, reject) => {
    if ((window as any).XLSX) {
      resolve((window as any).XLSX);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.async = true;
    script.onload = () => {
      const XLSX = (window as any).XLSX;
      if (!XLSX) {
        reject(new Error('XLSX indisponible après chargement'));
        return;
      }
      resolve(XLSX);
    };
    script.onerror = () => reject(new Error('Impossible de charger XLSX depuis le CDN'));
    document.head.appendChild(script);
  });
  return xlsxPromise;
}
