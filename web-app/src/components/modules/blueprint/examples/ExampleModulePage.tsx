/**
 * ============================================================================
 * EXAMPLE MODULE PAGE - EXEMPLE D'IMPLÉMENTATION
 * ============================================================================
 * 
 * Exemple complet d'implémentation d'un module utilisant le Module Blueprint
 * 
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Plus, Search, Download, Edit, Trash2, Eye } from 'lucide-react';
import {
  ModuleContainer,
  ModuleHeader,
  SubModuleNavigation,
  ModuleContentArea,
  FormModal,
  ConfirmModal,
  ReadOnlyModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

// ============================================================================
// TYPES
// ============================================================================

interface ExampleItem {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function ExampleModulePage() {
  const { academicYear, schoolLevel, isBilingualEnabled } = useModuleContext();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ExampleItem | null>(null);
  const [items, setItems] = useState<ExampleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCreate = () => {
    setSelectedItem(null);
    setIsCreateModalOpen(true);
  };

  const handleEdit = (item: ExampleItem) => {
    setSelectedItem(item);
    setIsEditModalOpen(true);
  };

  const handleView = (item: ExampleItem) => {
    setSelectedItem(item);
    setIsViewModalOpen(true);
  };

  const handleDelete = (item: ExampleItem) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = (data: any) => {
    console.log('Submit:', data);
    // TODO: Appel API
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (selectedItem) {
      // TODO: Appel API
      setItems(items.filter(item => item.id !== selectedItem.id));
      setIsDeleteModalOpen(false);
      setSelectedItem(null);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Module Exemple',
          description: `Exemple d'implémentation du Module Blueprint | Année: ${academicYear?.label || 'N/A'} | Niveau: ${schoolLevel?.label || 'N/A'}`,
          icon: 'module',
          kpis: [
            {
              label: 'Total',
              value: items.length,
              icon: 'list',
              trend: 'neutral',
            },
            {
              label: 'Actifs',
              value: items.filter(i => i.status === 'active').length,
              icon: 'checkCircle',
              trend: 'up',
            },
          ],
          actions: (
            <button
              onClick={handleCreate}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau</span>
            </button>
          ),
        }}
        subModules={{
          modules: [
            {
              id: 'list',
              label: 'Liste',
              href: '/app/example',
            },
            {
              id: 'reports',
              label: 'Rapports',
              href: '/app/example/reports',
            },
            {
              id: 'settings',
              label: 'Paramètres',
              href: '/app/example/settings',
            },
          ],
        }}
        content={{
          layout: 'table',
          filters: (
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Tous les statuts</option>
                <option>Actif</option>
                <option>Inactif</option>
              </select>
            </div>
          ),
          toolbar: (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button className="flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  <Search className="w-4 h-4" />
                  <span>Rechercher</span>
                </button>
                <button className="flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  <Download className="w-4 h-4" />
                  <span>Exporter</span>
                </button>
              </div>
            </div>
          ),
          isLoading,
          emptyMessage: items.length === 0 ? 'Aucun élément trouvé' : undefined,
          children: (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date de création
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          item.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {item.status === 'active' ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleView(item)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Voir"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="text-red-600 hover:text-red-900"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
          pagination: items.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Affichage de 1 à {items.length} sur {items.length}
              </div>
              <div className="flex items-center space-x-2">
                <button className="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  Précédent
                </button>
                <button className="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  Suivant
                </button>
              </div>
            </div>
          ),
        }}
      />

      {/* Modals */}
      <FormModal
        title={selectedItem ? 'Modifier l\'élément' : 'Créer un élément'}
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedItem(null);
        }}
        size="lg"
        actions={
          <>
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
                setSelectedItem(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              {selectedItem ? 'Modifier' : 'Créer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom
            </label>
            <input
              type="text"
              defaultValue={selectedItem?.name || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Statut
            </label>
            <select
              defaultValue={selectedItem?.status || 'active'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>
        </div>
      </FormModal>

      <ReadOnlyModal
        title="Détails de l'élément"
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedItem(null);
        }}
        actions={
          <button
            onClick={() => {
              setIsViewModalOpen(false);
              setSelectedItem(null);
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Fermer
          </button>
        }
      >
        {selectedItem && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom
              </label>
              <p className="text-sm text-gray-900">{selectedItem.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <p className="text-sm text-gray-900">
                {selectedItem.status === 'active' ? 'Actif' : 'Inactif'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de création
              </label>
              <p className="text-sm text-gray-900">
                {new Date(selectedItem.createdAt).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
        )}
      </ReadOnlyModal>

      <ConfirmModal
        title="Supprimer l'élément"
        message={`Êtes-vous sûr de vouloir supprimer "${selectedItem?.name}" ? Cette action est irréversible.`}
        type="danger"
        isOpen={isDeleteModalOpen}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setSelectedItem(null);
        }}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
      />
    </>
  );
}

