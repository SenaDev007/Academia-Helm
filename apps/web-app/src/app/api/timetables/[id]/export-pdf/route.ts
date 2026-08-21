/**
 * ⭐ BFF route pour /api/timetables/[id]/export-pdf
 *    Proxifie le GET vers le backend NestJS qui génère le PDF via Puppeteer.
 *    Le backend renvoie un blob binaire (application/pdf) — on doit le streamer
 *    sans le parser comme JSON (sinon corruption).
 */
import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Récupérer les query params (ex: ?classIds=abc,def)
    const url = new URL(request.url);
    const queryString = url.search; // inclut le '?'
    const headers = await getProxyAuthHeaders(request);
    // ⭐ fetchWithTimeout — la génération PDF peut prendre ~5-15s (Puppeteer boot + render)
    const response = await fetchWithTimeout(
      nestControllerUrl(`timetables/${id}/export-pdf${queryString}`),
      { headers, cache: 'no-store' },
      60000, // 60s timeout pour PDF
    );

    if (!response.ok) {
      // Si erreur backend, retourner le message en JSON
      const errText = await response.text().catch(() => '');
      let errMessage = 'Erreur génération PDF côté serveur';
      try {
        const errJson = JSON.parse(errText);
        errMessage = errJson.message || errJson.error || errMessage;
      } catch {
        if (errText.trim()) errMessage = errText.substring(0, 300);
      }
      return NextResponse.json(
        { message: errMessage, error: 'PDF_GENERATION_FAILED' },
        { status: response.status }
      );
    }

    // ⭐ Le backend renvoie un PDF binaire — on stream tel quel
    const pdfBuffer = await response.arrayBuffer();
    const filename = `emploi_du_temps_${id.substring(0, 8)}.pdf`;
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.byteLength),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error proxying PDF export:', error);
    return NextResponse.json(
      { message: error?.message || 'Erreur réseau lors de la génération PDF', error: 'PDF_BFF_ERROR' },
      { status: 500 }
    );
  }
}
