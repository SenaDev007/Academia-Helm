# GUIDE DE STANDARDISATION — Modules Complémentaires Academia Helm

## Objectif
Aligner TOUS les modules complémentaires (Boutique, Infirmerie, Labo, Cantine, Transport, EduCast, Library, QHSE) sur le pattern design du module Finance/Students.

## Pattern cible (module Finance = référence)

### 1. Page principale (ModulePage → ModuleContainer)
**AVANT (à remplacer)** :
```tsx
import ModulePageLayout from './ModulePageLayout';
// ...
<ModulePageLayout title="..." subtitle="..." actions={...}>
  <div className="space-y-8">
    {/* onglets pills custom navy-900 uppercase */}
    <div className="flex items-center space-x-1 bg-gray-100/80 p-1.5 rounded-[1.25rem] ...">
      <button className="... text-[10px] font-black uppercase tracking-widest ...">...</button>
    </div>
    {renderTabContent()}
  </div>
</ModulePageLayout>
```

**APRÈS (pattern Finance)** :
```tsx
import { ModuleContainer } from '@/components/modules/blueprint';
// ...
<ModuleContainer
  header={{
    title: 'Titre Module',
    description: 'Description courte',
    icon: 'package', // ou 'heart', 'flask', 'utensils', 'bus', 'video', 'book', 'shield'
    kpis: stats ? [...] : [],
    actions: (
      <div className="flex items-center gap-2">
        <Button onClick={...}><Plus className="w-4 h-4" /> Nouveau</Button>
        <Button variant="outline" onClick={...}><Download className="w-4 h-4" /> Exporter</Button>
      </div>
    ),
  }}
  subModules={{
    activeModuleId: activeSubModuleId,
    onModuleChange: setActiveSubModuleId,
    modules: [
      { id: 'dashboard', label: 'Tableau de Bord', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: '...', label: '...', icon: <Icon className="w-4 h-4" /> },
    ],
  }}
  content={
    activeSubModuleId === 'dashboard' ? { layout: 'default', children: <XxxDashboard /> } :
    activeSubModuleId === '...' ? { layout: 'default', children: <XxxContent /> } :
    { layout: 'default', children: <XxxDashboard /> }
  }
/>
```

### 2. Sous-composants (Content)
- Wrapper : `<ModuleContentArea layout="custom" toolbar={...}>` ou directement `<div className="space-y-6">`
- **Cards** : `<Card className="p-6 shadow-sm">` (rounded-xl automatique)
- **Titres** : `text-lg font-semibold text-navy-900` (PAS `text-xl font-black uppercase tracking-tight`)
- **Sous-titres** : `text-sm text-gray-500`
- **Boutons** : `<Button>` (default = indigo-600) ou `<Button variant="outline">`
- **Tables** : `<Table><TableHeader><TableRow className="bg-gray-50"><TableHead>` / `<TableBody><TableRow className="hover:bg-slate-50"><TableCell>`
- **Inputs** : `<Input>` shadcn, `<Label>` shadcn, `<Select>` shadcn
- **Badges** : `<Badge variant="outline">` ou `<Badge>`
- **Toast** : `const { toast } = useToast(); toast({ title, description, variant })` (PAS `alert()`)
- **Loading** : `<Loader2 className="w-6 h-6 animate-spin text-blue-600" />`

### 3. Imports obligatoires
```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
```

### 4. Modals (remplacer fixed inset-0)
**AVANT** :
```tsx
{modalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-md w-full">
      <h3>Titre</h3>
      {/* form */}
    </div>
  </div>
)}
```

**APRÈS** :
```tsx
<Dialog open={modalOpen} onOpenChange={setModalOpen}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Titre</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-4">
      {/* form */}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
      <Button onClick={handleSave} disabled={submitting}>
        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Enregistrer
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 5. Couleurs (à respecter strictement)
- Primaire : `indigo-600` (boutons principaux), `blue-600` (onglets actifs)
- Succès : `emerald-600`
- Danger : `rose-600` / `red-600`
- Warning : `amber-600`
- Neutre : `gray-50` / `gray-100` / `gray-200` / `gray-500` / `gray-700` / `navy-900`
- **INTERDIT** : `navy-900` pour les boutons (réservé aux titres), `font-black uppercase tracking-widest`, `rounded-3xl`, `rounded-[2.5rem]`

### 6. Règles à suivre
1. **PAS de `alert()`** → utiliser `toast({ title, description, variant: 'destructive' })`
2. **PAS de `confirm()` natif** → utiliser `confirmDialog.danger()` du hook `useConfirmDialog`
3. **PAS de `<input>` HTML** → `<Input>` shadcn
4. **PAS de `<table>` HTML** → `<Table>` shadcn
5. **PAS de `<button>` custom** → `<Button>` shadcn
6. **PAS de `rounded-3xl`** → `rounded-xl`
7. **PAS de `font-black uppercase tracking-widest`** → `font-semibold` ou `font-medium`
8. **PAS de `bg-navy-900 text-white`** pour boutons → `bg-indigo-600 text-white`
9. **PAS de mocks hardcoded** → appeler les vrais endpoints via `useModulesList` / `modulesApi`
