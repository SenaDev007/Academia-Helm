/**
 * IA — Loading skeleton
 * Centered layout with document analysis placeholder
 */

export default function IALoading() {
  return (
    <div className="space-y-6 pb-12">
      {/* Header area */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-6 w-56 rounded bg-slate-200 animate-pulse" />
          <div className="h-4 w-80 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="h-10 w-44 rounded-xl bg-slate-100 animate-pulse" />
      </div>

      {/* Main IA workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload / document panel */}
        <div className="h-64 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 animate-pulse" />

        {/* Analysis result panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-12 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
          <div className="h-48 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
