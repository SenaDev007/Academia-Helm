'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Upload, 
  Save, 
  X, 
  Globe, 
  Lock, 
  Type, 
  Layers,
  Languages
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { globalLibraryClient } from '@/lib/pedagogy/global-library-client';

export function GlobalLibraryAdmin({ onResourceCreated }: { onResourceCreated: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    level: 'PRIMAIRE',
    classLevel: '',
    subject: '',
    resourceType: 'PDF',
    fileUrl: '',
    externalUrl: '',
    language: 'FR',
    isPublished: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await globalLibraryClient.create(formData);
      toast({ title: 'Succès', description: 'Ressource ajoutée à la bibliothèque globale.' });
      setIsAdding(false);
      onResourceCreated();
      setFormData({
        title: '',
        description: '',
        level: 'PRIMAIRE',
        classLevel: '',
        subject: '',
        resourceType: 'PDF',
        fileUrl: '',
        externalUrl: '',
        language: 'FR',
        isPublished: true,
      });
    } catch (error) {
      console.error('Error creating resource:', error);
      toast({ title: 'Erreur', description: 'Impossible de créer la ressource.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!isAdding) {
    return (
      <Button 
        onClick={() => setIsAdding(true)}
        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 rounded-xl h-11 px-6 shadow-lg shadow-indigo-200"
      >
        <Plus className="w-5 h-5" /> Ajouter une ressource globale
      </Button>
    );
  }

  return (
    <Card className="p-8 border-none shadow-2xl bg-white space-y-6 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50" />
      
      <div className="flex justify-between items-center relative">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-indigo-600" /> Nouvelle ressource institutionnelle
          </h2>
          <p className="text-slate-500 text-sm">Configurez une ressource accessible à tous les établissements.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)} className="rounded-full w-10 h-10 p-0">
          <X className="w-5 h-5 text-slate-400" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 md:col-span-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Type className="w-4 h-4" /> Titre de la ressource *
            </label>
            <Input 
              required
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="Ex: Manuel de didactique des mathématiques - CP"
              className="h-12 bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>

          <div className="space-y-4 md:col-span-2">
            <label className="text-sm font-bold text-slate-700">Description détaillée</label>
            <textarea 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Objectifs pédagogiques, contenu sommaire..."
              className="w-full h-24 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
            />
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Niveau scolaire
            </label>
            <select 
              className="w-full h-12 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.level}
              onChange={(e) => setFormData({...formData, level: e.target.value})}
            >
              <option value="MATERNELLE">Maternelle</option>
              <option value="PRIMAIRE">Primaire</option>
              <option value="SECONDAIRE">Secondaire</option>
            </select>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Languages className="w-4 h-4" /> Langue
            </label>
            <select 
              className="w-full h-12 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.language}
              onChange={(e) => setFormData({...formData, language: e.target.value})}
            >
              <option value="FR">Français (FR)</option>
              <option value="EN">Anglais (EN)</option>
            </select>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700">Type de ressource</label>
            <select 
              className="w-full h-12 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.resourceType}
              onChange={(e) => setFormData({...formData, resourceType: e.target.value})}
            >
              <option value="PDF">Document PDF</option>
              <option value="VIDEO">Vidéo pédagogique</option>
              <option value="AUDIO">Podcast / Audio</option>
              <option value="LINK">Lien externe validé</option>
            </select>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Upload className="w-4 h-4" /> URL du fichier / Lien
            </label>
            <Input 
              required
              value={formData.fileUrl || formData.externalUrl}
              onChange={(e) => {
                if (formData.resourceType === 'LINK') {
                  setFormData({...formData, externalUrl: e.target.value, fileUrl: ''});
                } else {
                  setFormData({...formData, fileUrl: e.target.value, externalUrl: ''});
                }
              }}
              placeholder="https://..."
              className="h-12 bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Lock className="w-4 h-4" />
            <span>Contrôle d'accès Platform-Level</span>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={() => setIsAdding(false)}>Annuler</Button>
            <Button 
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-xl font-bold shadow-lg shadow-indigo-100"
            >
              {loading ? 'Création en cours...' : 'Publier la ressource'}
              {!loading && <Save className="ml-2 w-5 h-5" />}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
