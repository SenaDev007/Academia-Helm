// app/api/classes/[classId]/distinctions/route.ts  (Next.js App Router)
// POST /api/classes/:classId/distinctions?periodId=...  à appeler à la clôture d'une période.

import { buildClassPack, resolveSpecialAwards, type PackStudent } from '@yehi-or/helm-distinctions';
import { NextResponse } from 'next/server';
// Remplace ces imports par ta couche d'accès aux données (Prisma, Drizzle, Supabase...)
import { db, storage, requireRole } from '@/lib/server';

export const runtime = 'nodejs';   // Puppeteer ne tourne pas en edge
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: { classId: string } }) {
  await requireRole(req, ['DIRECTOR', 'ADMIN']);
  const periodId = new URL(req.url).searchParams.get('periodId');
  if (!periodId) return NextResponse.json({ error: 'periodId requis' }, { status: 400 });

  const [school, klass, period, rules, rows] = await Promise.all([
    db.school.current(), db.class.get(params.classId), db.period.get(periodId),
    db.distinctionRules.list({ level: undefined }), db.results.byClass(params.classId, periodId),
  ]);

  const students: PackStudent[] = rows.map((r) => ({
    id: r.studentId,
    fullName: r.fullName,
    average: r.average,
    photoUrl: r.photoUrl,
    graduating: klass.isLastOfCycle && period.isLastOfYear,
    annualAverage: r.annualAverage,
    awards: klass.level === 'secondaire'
      ? resolveSpecialAwards({
          average: r.average, previousAverage: r.previousAverage, base: klass.base,
          unjustifiedAbsences: r.unjustifiedAbsences, lateCount: r.lateCount, conductPct: r.conductPct,
        })
      : [],
    previousAverage: r.previousAverage,
  }));

  const pack = await buildClassPack({
    level: klass.level,
    school: { id: school.id, name: school.name, city: school.city, logoUrl: school.logoUrl,
      directorName: school.directorName, directorSignatureUrl: school.directorSignatureUrl },
    classId: klass.id, className: klass.name, periodId, base: klass.base,
    period: { label: period.label, schoolYear: period.schoolYear, issuedOn: new Date().toISOString().slice(0, 10) },
    students,
    rules: rules.length ? rules.map((x) => ({ code: x.code, minPct: Number(x.minPct) })) : undefined,
    secret: process.env.DISTINCTION_SECRET!,
    verifyBaseUrl: process.env.NEXT_PUBLIC_APP_URL!,
  });

  // Stockage des fichiers individuels et enregistrement des émissions (idempotent)
  const urls = new Map<string, string>();
  for (const f of pack.files) urls.set(f.input.verification.code, await storage.put(`distinctions/${params.classId}/${periodId}/${f.fileName}`, f.pdf));
  await db.distinction.upsertMany(
    pack.records.map((r) => ({ ...r, schoolId: school.id, classId: klass.id, periodId, fileUrl: urls.get(r.verificationCode) })),
  );
  const printUrl = pack.mergedPdf && await storage.put(`distinctions/${params.classId}/${periodId}/impression.pdf`, pack.mergedPdf);
  const boardUrl = pack.boardPdf && await storage.put(`distinctions/${params.classId}/${periodId}/tableau.pdf`, pack.boardPdf);

  return NextResponse.json({ issued: pack.records.length, skipped: pack.skipped, printUrl, boardUrl });
}
