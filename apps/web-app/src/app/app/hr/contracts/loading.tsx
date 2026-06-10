/**
 * Contracts — Loading skeleton
 * KPI cards + toolbar + contract list
 */

export default function ContractsLoading() {
  return (
    <div className="space-y-6 pb-12">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[72px] rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-3">
          <div className="h-10 w-72 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-10 w-40 rounded-xl bg-slate-100 animate-pulse" />
        </div>
        <div className="h-10 w-48 rounded-xl bg-slate-100 animate-pulse" />
      </div>

      {/* Contract cards */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
