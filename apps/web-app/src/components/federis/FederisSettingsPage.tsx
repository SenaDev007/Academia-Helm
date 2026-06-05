/**
 * FederisSettingsPage Component
 * 
 * Paramètres avec onglets
 */

'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import type { User } from '@/types';
import { CalendarDays, Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import * as settingsService from '@/services/settings.service';

type Tab = 'info' | 'academic-year' | 'users' | 'subscription' | 'audit';

export default function FederisSettingsPage({ tenantId, user }: { tenantId: string; user: User }) {
  const [activeTab, setActiveTab] = useState<Tab>('info');

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'info', label: 'Informations Federis', icon: 'building' },
    { id: 'academic-year', label: 'Années Scolaires', icon: 'calendar' },
    { id: 'users', label: 'Utilisateurs & rôles', icon: 'user' },
    { id: 'subscription', label: 'Abonnement & paiement', icon: 'finance' },
    { id: 'audit', label: 'Audit logs', icon: 'document' },
  ];

  // Academic Year State
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [activeAcademicYear, setActiveAcademicYear] = useState<any>(null);
  const [academicYearBusy, setAcademicYearBusy] = useState(false);
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

  useEffect(() => {
    if (activeTab === 'academic-year') {
      loadAcademicYears();
    }
  }, [activeTab]);

  const loadAcademicYears = async () => {
    try {
      const [years, active] = await Promise.all([
        settingsService.getAcademicYears(tenantId),
        settingsService.getActiveAcademicYear(tenantId),
      ]);
      setAcademicYears(years || []);
      setActiveAcademicYear(active || null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateNextAcademicYear = async () => {
    try {
      setAcademicYearBusy(true);
      await settingsService.generateNextAcademicYear(tenantId);
      setToast({ type: 'success', message: 'Nouvelle année scolaire générée.' });
      await loadAcademicYears();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Erreur' });
    } finally {
      setAcademicYearBusy(false);
    }
  };

  const handleActivateAcademicYear = async (id: string) => {
    if (!confirm("Voulez-vous vraiment activer cette année scolaire ?")) return;
    try {
      setAcademicYearBusy(true);
      await settingsService.activateAcademicYear(id, tenantId);
      setToast({ type: 'success', message: 'Année scolaire activée.' });
      await loadAcademicYears();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Erreur' });
    } finally {
      setAcademicYearBusy(false);
    }
  };

  const handleCloseAcademicYear = async (id: string) => {
    if (!confirm("Voulez-vous vraiment clôturer cette année scolaire ? Elle passera en lecture seule.")) return;
    try {
      setAcademicYearBusy(true);
      await settingsService.closeAcademicYear(id, tenantId);
      setToast({ type: 'success', message: 'Année clôturée.' });
      await loadAcademicYears();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Erreur' });
    } finally {
      setAcademicYearBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-600 mt-1">Gérez les paramètres de votre federis</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === 'info' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Informations Federis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom du federis</label>
                <input
                  type="text"
                  defaultValue="Federis des Écoles Privées"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Région / Département</label>
                <input
                  type="text"
                  defaultValue="Atlantique"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email institutionnel</label>
                <input
                  type="email"
                  defaultValue="contact@federis.bj"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                <input
                  type="tel"
                  defaultValue="+229 XX XX XX XX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button className="px-6 py-2 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800">
                Enregistrer
              </button>
            </div>
          </div>
        )}

        {activeTab === 'academic-year' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Gestion des Années Scolaires</h2>
                <p className="text-sm text-gray-500 mt-1">Configurez le cycle académique de votre réseau Federis.</p>
              </div>
              <button
                onClick={handleGenerateNextAcademicYear}
                disabled={academicYearBusy}
                className="px-4 py-2 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 disabled:opacity-50 flex items-center space-x-2"
              >
                {academicYearBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                <span>Générer la prochaine année</span>
              </button>
            </div>

            {toast && (
              <div className={cn("p-4 rounded-md flex items-center space-x-2", toast.type === 'success' ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>
                {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span>{toast.message}</span>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Année</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Dates</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {academicYears.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        Aucune année scolaire configurée.
                      </td>
                    </tr>
                  ) : (
                    academicYears.map((year) => (
                      <tr key={year.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{year.name}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2.5 py-1 text-xs font-medium rounded-full",
                            year.status === 'ACTIVE' ? "bg-green-100 text-green-800" :
                            year.status === 'ARCHIVED' ? "bg-gray-100 text-gray-800" :
                            "bg-blue-100 text-blue-800"
                          )}>
                            {year.status === 'ACTIVE' ? 'Active' : year.status === 'ARCHIVED' ? 'Archivée' : 'Planifiée'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {year.startDate ? new Date(year.startDate).toLocaleDateString('fr-FR') : '—'} 
                          {' au '} 
                          {year.endDate ? new Date(year.endDate).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td className="px-6 py-4 text-right space-x-3">
                          {year.status !== 'ACTIVE' && year.status !== 'ARCHIVED' && (
                            <button
                              onClick={() => handleActivateAcademicYear(year.id)}
                              disabled={academicYearBusy}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                              Activer
                            </button>
                          )}
                          {year.status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => alert("Synchronisation de l'année " + year.name + " poussée vers toutes les écoles du réseau Helm. Elles hériteront de ce cadre temporel pour leurs rentrées.")}
                                disabled={academicYearBusy}
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                              >
                                Pousser vers Réseau
                              </button>
                              <button
                                onClick={() => handleCloseAcademicYear(year.id)}
                                disabled={academicYearBusy}
                                className="text-sm font-medium text-red-600 hover:text-red-800"
                              >
                                Clôturer
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'subscription' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Abonnement & Paiement</h2>
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Abonnement Mensuel</h3>
                  <p className="text-sm text-gray-600">50 000 FCFA / mois</p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  Actif
                </span>
              </div>
              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="text-sm text-gray-600 mb-2">Prochain paiement :</p>
                <p className="text-lg font-semibold text-gray-900">15 Février 2024</p>
              </div>
              <div className="mt-6">
                <button className="px-6 py-2 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800">
                  Renouveler l'abonnement
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Historique des paiements</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Janvier 2024</p>
                    <p className="text-sm text-gray-600">15 Jan 2024</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">50 000 FCFA</p>
                    <span className="text-xs text-green-600">Payé</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Utilisateurs & Rôles (RBAC Federis)</h2>
                <p className="text-sm text-gray-500 mt-1">Gérez les permissions granulaires pour les acteurs nationaux.</p>
              </div>
              <button className="px-4 py-2 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800">
                Affecter un rôle
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Jean Dupont</p>
                  <p className="text-sm text-gray-600">jean.dupont@federis.bj</p>
                </div>
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                  PATRONAT_ADMIN
                </span>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Marie Kondo</p>
                  <p className="text-sm text-gray-600">m.kondo@education.gouv.bj</p>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                  INSPECTEUR_NATIONAL
                </span>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Albert Camus</p>
                  <p className="text-sm text-gray-600">a.camus@centre-examen.bj</p>
                </div>
                <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                  CHEF_CENTRE_EXAMEN
                </span>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Sarah Connor</p>
                  <p className="text-sm text-gray-600">s.connor@prof.bj</p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                  CORRECTEUR_NATIONAL
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Audit Logs</h2>
            <div className="space-y-2">
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-gray-900">Création d'examen</p>
                  <span className="text-xs text-gray-500">20 Jan 2024, 14:30</span>
                </div>
                <p className="text-sm text-gray-600">Utilisateur: Jean Dupont</p>
                <p className="text-sm text-gray-600">Action: Création de l'examen "CEP 2024"</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

