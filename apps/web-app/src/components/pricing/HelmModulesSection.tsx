import { CheckCircle } from 'lucide-react';
import { ALL_MODULES } from '@/lib/services/HelmPricingService';

export default function HelmModulesSection() {
  return (
    <section className="mt-16 max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-navy-900 mb-3">
          Les 9 modules. Dans chaque plan. Sans exception.
        </h2>
        <p className="text-sm md:text-base text-slate-600 max-w-3xl mx-auto">
          Nos concurrents vendent chaque brique séparément. Avec Academia Helm, vous
          pilotez l&apos;école entière dès le premier jour : élèves, finances, examens,
          RH, QHSE, communication, IA ORION et modules complémentaires.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {ALL_MODULES.map((module) => (
          <div
            key={module.name}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-start gap-3"
          >
            <div className="mt-1">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-navy-900 mb-1">
                {module.name}
              </h3>
              <p className="text-xs text-slate-600">{module.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

