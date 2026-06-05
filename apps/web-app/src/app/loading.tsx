/**
 * Loading Component - Root Level
 * 
 * Affiché pendant le chargement initial des pages racine.
 * Design subtil pour éviter les flashs blancs plein écran.
 */

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-slate-500">Chargement…</p>
      </div>
    </div>
  );
}

