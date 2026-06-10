/**
 * Reporting — Loading skeleton
 * Chart placeholders + stats cards
 */

export default function ReportingLoading() {
  return (
    <div className="space-y-6 pb-12">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[72px] rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <div className="h-6 w-40 rounded bg-slate-200 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-9 w-24 rounded-lg bg-slate-100 animate-pulse" />
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        <div className="h-72 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
      </div>

      {/* Data table placeholder */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="h-12 bg-slate-50 border-b border-slate-200 animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 border-b border-slate-100 bg-slate-50/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
