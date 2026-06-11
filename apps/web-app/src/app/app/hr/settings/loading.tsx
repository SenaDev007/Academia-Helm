/**
 * Settings — Loading skeleton
 * Form sections with field placeholders
 */

export default function SettingsLoading() {
  return (
    <div className="space-y-6 pb-12">
      {/* Section header */}
      <div className="space-y-2">
        <div className="h-6 w-48 rounded bg-slate-200 animate-pulse" />
        <div className="h-4 w-72 rounded bg-slate-100 animate-pulse" />
      </div>

      {/* Settings form sections */}
      {[1, 2, 3].map((section) => (
        <div key={section} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          {/* Section title */}
          <div className="h-5 w-40 rounded bg-slate-200 animate-pulse" />

          {/* Form rows */}
          <div className="space-y-4">
            {[1, 2, 3].map((field) => (
              <div key={field} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="h-4 w-28 rounded bg-slate-200 animate-pulse self-center" />
                <div className="md:col-span-2 h-10 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Save button */}
      <div className="flex justify-end">
        <div className="h-10 w-32 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}
