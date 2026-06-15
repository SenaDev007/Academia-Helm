/**
 * Loading Component
 * 
 * Affiché pendant le chargement des pages
 */

export default function Loading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <img 
          src="/images/logo-Academia Hub.png" 
          alt="Academia Helm" 
          className="h-16 w-16 object-contain animate-pulse mx-auto mb-4"
        />
        <p className="text-slate-600">Chargement...</p>
      </div>
    </div>
  );
}

