/**
 * Collaborators — Loading skeleton
 * Sub-tab bar + staff card grid
 */

export default function CollaboratorsLoading() {
  return (
    <div className="space-y-6 pb-12">
      {/* Sub-tab bar */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-32 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[72px] rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        ))}
      </div>

      {/* Search + filter toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-3">
          <div className="h-10 w-72 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-10 w-40 rounded-xl bg-slate-100 animate-pulse" />
        </div>
        <div className="h-10 w-52 rounded-xl bg-slate-100 animate-pulse" />
      </div>

      {/* Staff card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-56 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
