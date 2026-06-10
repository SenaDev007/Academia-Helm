/**
 * Planning — Loading skeleton
 * Calendar-style grid layout
 */

export default function PlanningLoading() {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-slate-200 animate-pulse" />
          <div className="h-4 w-32 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-28 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-10 w-28 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-12 flex items-center justify-center">
              <div className="h-3 w-12 rounded bg-slate-200 animate-pulse" />
            </div>
          ))}
        </div>
        {/* Calendar rows */}
        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="grid grid-cols-7 divide-x divide-slate-100">
              {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                <div key={col} className="h-24 p-2">
                  <div className="h-3 w-6 rounded bg-slate-200 animate-pulse mb-2" />
                  {col <= 3 && <div className="h-5 w-full rounded bg-slate-100 animate-pulse" />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
