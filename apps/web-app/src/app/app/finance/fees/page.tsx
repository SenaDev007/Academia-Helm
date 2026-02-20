/**
 * ============================================================================
 * MODULE 4 - CONFIGURATION DES FRAIS
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Settings } from 'lucide-react';
import {
  ModuleHeader,
  SubModuleNavigation,
  ModuleContentArea,
  FormModal,
  ConfirmModal,
  ReadOnlyModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModal } from '@/hooks/useModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function FeesPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { openFormModal, openConfirmModal, openReadOnlyModal, closeModal } = useModal();
  const [categories, setCategories] = useState<any[]>([]);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'categories' | 'definitions'>('categories');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    // TODO: Charger les données depuis l'API
    setCategories([
      { id: '1', name: 'Scolarité', code: 'TUITION', description: 'Frais de scolarité', isActive: true },
      { id: '2', name: 'Inscription', code: 'REGISTRATION', description: 'Frais d\'inscription', isActive: true },
      { id: '3', name: 'Fournitures', code: 'SUPPLIES', description: 'Frais de fournitures', isActive: true },
    ]);
    setDefinitions([
      { id: '1', label: 'Scolarité Primaire', category: 'Scolarité', amount: 150000, isMandatory: true, dueDate: '2024-09-15' },
      { id: '2', label: 'Scolarité Secondaire', category: 'Scolarité', amount: 200000, isMandatory: true, dueDate: '2024-09-15' },
      { id: '3', label: 'Inscription Annuelle', category: 'Inscription', amount: 50000, isMandatory: true, dueDate: '2024-08-01' },
    ]);
  }, []);

  const handleCreateCategory = (data: any) => {
    console.log('Creating category:', data);
    setCategories([...categories, { id: String(categories.length + 1), isActive: true, ...data }]);
    closeModal();
  };

  const handleCreateDefinition = (data: any) => {
    console.log('Creating definition:', data);
    setDefinitions([...definitions, { id: String(definitions.length + 1), isMandatory: true, ...data }]);
    closeModal();
  };

  const subModuleTabs = [
    { id: 'fees', label: 'Configuration des frais', path: '/app/finance/fees' },
    { id: 'payments', label: 'Paiements', path: '/app/finance/payments' },
    { id: 'expenses', label: 'Dépenses', path: '/app/finance/expenses' },
    { id: 'treasury', label: 'Trésorerie', path: '/app/finance/treasury' },
    { id: 'collection', label: 'Recouvrement', path: '/app/finance/collection' },
  ];

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Configuration des Frais"
        description="Définissez les catégories et les montants de frais par niveau scolaire et classe."
        icon="finance"
        actions={[
          {
            label: 'Nouvelle catégorie',
            onClick: () => openFormModal({
              title: 'Créer une catégorie de frais',
              children: (
                <form onSubmit={(e) => { e.preventDefault(); handleCreateCategory({ name: (e.target as any).name.value, code: (e.target as any).code.value, description: (e.target as any).description.value }); }}>
                  <Input name="name" placeholder="Nom de la catégorie" required className="mb-2" />
                  <Input name="code" placeholder="Code (ex: TUITION)" className="mb-2" />
                  <Input name="description" placeholder="Description" className="mb-4" />
                  <Button type="submit">Créer</Button>
                </form>
              ),
            }),
          },
          {
            label: 'Nouvelle définition',
            onClick: () => openFormModal({
              title: 'Créer une définition de frais',
              size: 'lg',
              children: (
                <form onSubmit={(e) => { e.preventDefault(); handleCreateDefinition({ label: (e.target as any).label.value, category: (e.target as any).category.value, amount: parseFloat((e.target as any).amount.value), dueDate: (e.target as any).dueDate.value }); }}>
                  <Input name="label" placeholder="Libellé" required className="mb-2" />
                  <Select name="category" defaultValue={categories[0]?.id}>
                    <SelectTrigger className="mb-2">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input name="amount" type="number" placeholder="Montant (XOF)" required className="mb-2" />
                  <Input name="dueDate" type="date" className="mb-4" />
                  <Button type="submit">Créer</Button>
                </form>
              ),
            }),
            primary: true,
          },
        ]}
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/fees" />

      <ModuleContentArea layout="custom">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="categories">Catégories</TabsTrigger>
            <TabsTrigger value="definitions">Définitions de frais</TabsTrigger>
          </TabsList>

          <TabsContent value="categories">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>{category.code}</TableCell>
                    <TableCell>{category.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={category.isActive ? 'default' : 'outline'}>
                        {category.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openReadOnlyModal({
                        title: `Catégorie: ${category.name}`,
                        children: (
                          <div className="grid grid-cols-2 gap-4">
                            <div><strong>Code:</strong> {category.code}</div>
                            <div><strong>Statut:</strong> {category.isActive ? 'Actif' : 'Inactif'}</div>
                            <div className="col-span-2"><strong>Description:</strong> {category.description || 'Aucune'}</div>
                          </div>
                        ),
                      })}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        setSelectedItem(category);
                        openFormModal({
                          title: `Modifier: ${category.name}`,
                          children: (
                            <form onSubmit={(e) => { e.preventDefault(); setCategories(categories.map(c => c.id === category.id ? { ...c, name: (e.target as any).name.value, code: (e.target as any).code.value, description: (e.target as any).description.value } : c)); closeModal(); }}>
                              <Input name="name" defaultValue={category.name} required className="mb-2" />
                              <Input name="code" defaultValue={category.code} className="mb-2" />
                              <Input name="description" defaultValue={category.description} className="mb-4" />
                              <Button type="submit">Enregistrer</Button>
                            </form>
                          ),
                        });
                      }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openConfirmModal({
                        title: `Supprimer: ${category.name}`,
                        message: `Êtes-vous sûr de vouloir supprimer la catégorie "${category.name}" ?`,
                        onConfirm: () => { setCategories(categories.filter(c => c.id !== category.id)); closeModal(); },
                        type: 'danger',
                      })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="definitions">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Date d'échéance</TableHead>
                  <TableHead>Obligatoire</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {definitions.map((def) => (
                  <TableRow key={def.id}>
                    <TableCell className="font-medium">{def.label}</TableCell>
                    <TableCell>{def.category}</TableCell>
                    <TableCell>{def.amount.toLocaleString('fr-FR')} XOF</TableCell>
                    <TableCell>{def.dueDate ? new Date(def.dueDate).toLocaleDateString('fr-FR') : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={def.isMandatory ? 'default' : 'outline'}>
                        {def.isMandatory ? 'Oui' : 'Non'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openReadOnlyModal({
                        title: `Définition: ${def.label}`,
                        children: (
                          <div className="grid grid-cols-2 gap-4">
                            <div><strong>Catégorie:</strong> {def.category}</div>
                            <div><strong>Montant:</strong> {def.amount.toLocaleString('fr-FR')} XOF</div>
                            <div><strong>Date d'échéance:</strong> {def.dueDate ? new Date(def.dueDate).toLocaleDateString('fr-FR') : 'Non définie'}</div>
                            <div><strong>Obligatoire:</strong> {def.isMandatory ? 'Oui' : 'Non'}</div>
                          </div>
                        ),
                      })}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        setSelectedItem(def);
                        openFormModal({
                          title: `Modifier: ${def.label}`,
                          size: 'lg',
                          children: (
                            <form onSubmit={(e) => { e.preventDefault(); setDefinitions(definitions.map(d => d.id === def.id ? { ...d, label: (e.target as any).label.value, amount: parseFloat((e.target as any).amount.value), dueDate: (e.target as any).dueDate.value } : d)); closeModal(); }}>
                              <Input name="label" defaultValue={def.label} required className="mb-2" />
                              <Input name="amount" type="number" defaultValue={def.amount} required className="mb-2" />
                              <Input name="dueDate" type="date" defaultValue={def.dueDate} className="mb-4" />
                              <Button type="submit">Enregistrer</Button>
                            </form>
                          ),
                        });
                      }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openConfirmModal({
                        title: `Supprimer: ${def.label}`,
                        message: `Êtes-vous sûr de vouloir supprimer la définition "${def.label}" ?`,
                        onConfirm: () => { setDefinitions(definitions.filter(d => d.id !== def.id)); closeModal(); },
                        type: 'danger',
                      })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </ModuleContentArea>
    </div>
  );
}

