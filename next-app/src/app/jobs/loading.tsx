/**
 * Loading skeleton for /jobs routes.
 * Next.js shows this instantly while Server Components fetch data.
 */

export default function JobsLoading() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header skeleton */}
      <div className="h-14 md:h-16 bg-[#0b2f73]" />

      <main className="flex-grow pt-28 pb-20 px-4 md:px-8 max-w-6xl mx-auto w-full">
        {/* Banner skeleton */}
        <div className="text-center mb-10">
          <div className="h-5 w-48 mx-auto mb-4 bg-slate-200 rounded-full animate-pulse" />
          <div className="h-10 w-80 mx-auto mb-2 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-64 mx-auto bg-slate-100 rounded animate-pulse" />
        </div>

        {/* School cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-pulse">
              <div className="flex justify-between items-start mb-4">
                <div className="h-12 w-12 bg-slate-100 rounded-xl" />
                <div className="h-5 w-20 bg-slate-100 rounded-full" />
              </div>
              <div className="h-4 w-3/4 bg-slate-100 rounded mb-2" />
              <div className="h-3 w-1/2 bg-slate-50 rounded" />
              <div className="mt-6 pt-4 border-t border-slate-50">
                <div className="h-3 w-32 bg-slate-50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
