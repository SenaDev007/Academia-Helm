/**
 * ============================================================================
 * COMMUNICATION MODULE - TEMPLATES PAGE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function TemplatesPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch templates from API
    setLoading(false);
  }, [academicYear, schoolLevel]);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Templates de messages"
        description="Créer et gérer des templates de messages réutilisables."
        icon="reports"
      />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un template..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Nouveau template
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-8 text-gray-500">Chargement...</div>
          ) : templates.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              <p>Aucun template pour le moment.</p>
              <button className="mt-4 text-blue-600 hover:underline">
                Créer votre premier template
              </button>
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-800">{template.name}</h4>
                  <div className="flex gap-2">
                    <button className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{template.content}</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Type: {template.type}</span>
                  <button className="text-gray-600 hover:text-gray-800">
                    {template.isActive ? (
                      <ToggleRight className="w-5 h-5 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

