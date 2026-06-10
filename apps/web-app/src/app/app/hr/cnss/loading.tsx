/**
 * CNSS — Loading skeleton
 * KPI cards + list rows
 */

export default function CNSSLoading() {
  return (
    <div className="space-y-6 pb-12">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[72px] rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <div className="h-10 w-60 rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-10 w-44 rounded-xl bg-slate-100 animate-pulse" />
      </div>

      {/* Declaration rows */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
