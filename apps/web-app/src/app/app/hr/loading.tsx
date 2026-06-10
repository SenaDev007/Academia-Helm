/**
 * HR Module — Loading skeleton
 * Dashboard overview: KPI cards + chart + ORION panel
 */

export default function HRLoading() {
  return (
    <div className="space-y-8 pb-12">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        ))}
      </div>

      {/* Main content grid — chart + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-72 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        <div className="h-72 rounded-xl bg-slate-800 animate-pulse" />
      </div>

      {/* Quick actions */}
      <div>
        <div className="h-5 w-40 rounded bg-slate-200 animate-pulse mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
