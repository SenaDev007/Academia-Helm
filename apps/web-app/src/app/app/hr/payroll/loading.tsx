/**
 * Payroll — Loading skeleton
 * KPI strip + toolbar + payroll period cards
 */

export default function PayrollLoading() {
  return (
    <div className="space-y-6 pb-12">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[72px] rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-48 rounded bg-slate-200 animate-pulse" />
        <div className="h-10 w-48 rounded-xl bg-slate-100 animate-pulse" />
      </div>

      {/* Payroll period rows */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
