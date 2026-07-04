'use client';

/**
 * ============================================================================
 * VisualBlocksEditor — Éditeur de contenu par blocs (façon WordPress Gutenberg)
 * ============================================================================
 *
 * Remplace intégralement l'ancien "Contenu (JSON)" textarea.
 *
 * L'utilisateur ajoute des blocs parmi :
 *   - Titre
 *   - Paragraphe
 *   - Image
 *   - Bouton (texte + page cible)
 *   - Citation
 *   - Liste à puces
 *
 * Chaque bloc est édité inline (textarea/input) — pas de modal.
 * Réordonnancement par glisser-déposer (HTML5 natif via ReorderableList).
 *
 * Stockage : un tableau JSON [{ type, ...payload }] — mais l'utilisateur
 * ne voit JAMAIS le JSON. Le sérializeur/désérializeur est interne.
 *
 * Props :
 *   - value: Block[]              → blocs actuels
 *   - onChange: (next) => void    → callback avec nouveaux blocs
 * ============================================================================
 */

import { ReactNode } from 'react';
import { Plus, Trash2, Type, Pilcrow, Image as ImageIcon, MousePointerClick, Quote, List, MoveUp, MoveDown } from 'lucide-react';
import { ReorderableList } from './ReorderableList';
import { ImagePicker } from './ImagePicker';

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'button'
  | 'quote'
  | 'list';

export interface Block {
  id: string;
  type: BlockType;
  text?: string;     // heading, paragraph, quote, button
  items?: string[];  // list
  imageUrl?: string; // image
  buttonUrl?: string;// button
}

interface Props {
  value: Block[];
  onChange: (next: Block[]) => void;
}

const BLOCK_LABELS: Record<BlockType, { label: string; icon: any }> = {
  heading:  { label: 'Titre',          icon: Type },
  paragraph:{ label: 'Paragraphe',     icon: Pilcrow },
  image:    { label: 'Image',          icon: ImageIcon },
  button:   { label: 'Bouton',         icon: MousePointerClick },
  quote:    { label: 'Citation',       icon: Quote },
  list:     { label: 'Liste à puces',  icon: List },
};

// Page cible — sélecteur fermé (pas de saisie d'URL libre)
const INTERNAL_PAGES = [
  { value: '/public/pre-enrollment', label: 'Page de pré-inscription' },
  { value: '/login?portal=PARENT',   label: 'Page de connexion parents' },
  { value: '/login?portal=TEACHER',  label: 'Page de connexion enseignants' },
  { value: '/school-portal',         label: "Page d'accueil du site" },
  { value: '/school-portal/jobs',    label: 'Page de recrutement' },
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function addBlock(value: Block[], type: BlockType): Block[] {
  const next: Block = { id: uid(), type };
  if (type === 'heading' || type === 'paragraph' || type === 'quote') next.text = '';
  if (type === 'button') { next.text = 'En savoir plus'; next.buttonUrl = INTERNAL_PAGES[0].value; }
  if (type === 'list') next.items = [''];
  if (type === 'image') next.imageUrl = undefined;
  return [...value, next];
}

function updateBlock(value: Block[], id: string, patch: Partial<Block>): Block[] {
  return value.map((b) => (b.id === id ? { ...b, ...patch } : b));
}

function removeBlock(value: Block[], id: string): Block[] {
  return value.filter((b) => b.id !== id);
}

function moveBlock(value: Block[], id: string, dir: -1 | 1): Block[] {
  const idx = value.findIndex((b) => b.id === id);
  if (idx === -1) return value;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= value.length) return value;
  const next = [...value];
  [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
  return next;
}

export function VisualBlocksEditor({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      {/* Barre d'outils — ajouter des blocs */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
          Ajouter un bloc
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => {
            const { label, icon: Icon } = BLOCK_LABELS[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => onChange(addBlock(value, t))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-xs font-semibold text-slate-700 transition"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste des blocs */}
      <ReorderableList
        items={value}
        getKey={(b) => b.id}
        onReorder={(next) => onChange(next)}
        emptyMessage="Ajoutez votre premier bloc en utilisant les boutons ci-dessus."
        renderItem={(block, idx) => (
          <BlockEditor
            block={block}
            onChange={(patch) => onChange(updateBlock(value, block.id, patch))}
            onRemove={() => onChange(removeBlock(value, block.id))}
            onMoveUp={() => onChange(moveBlock(value, block.id, -1))}
            onMoveDown={() => onChange(moveBlock(value, block.id, 1))}
            canMoveUp={idx > 0}
            canMoveDown={idx < value.length - 1}
          />
        )}
      />
    </div>
  );
}

// === Éditeur de bloc individuel ===

function BlockEditor({
  block,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const { label, icon: Icon } = BLOCK_LABELS[block.type];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded transition disabled:opacity-30"
            title="Monter"
          >
            <MoveUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded transition disabled:opacity-30"
            title="Descendre"
          >
            <MoveDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-red-500 hover:bg-red-50 rounded transition"
            title="Supprimer ce bloc"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {block.type === 'heading' && (
        <input
          type="text"
          value={block.text || ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Saisissez votre titre"
          className="w-full px-3 py-2 text-lg font-bold border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
        />
      )}

      {block.type === 'paragraph' && (
        <textarea
          value={block.text || ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Saisissez votre paragraphe…"
          rows={4}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-y"
        />
      )}

      {block.type === 'quote' && (
        <textarea
          value={block.text || ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Saisissez la citation…"
          rows={3}
          className="w-full px-4 py-3 text-sm italic border-l-4 border-amber-400 bg-amber-50/30 border-y border-r border-slate-200 rounded-r-lg focus:border-amber-500 outline-none resize-y"
        />
      )}

      {block.type === 'button' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Texte du bouton</label>
            <input
              type="text"
              value={block.text || ''}
              onChange={(e) => onChange({ text: e.target.value })}
              placeholder="Ex: S'inscrire maintenant"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Page vers laquelle le bouton pointe</label>
            <select
              value={block.buttonUrl || INTERNAL_PAGES[0].value}
              onChange={(e) => onChange({ buttonUrl: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 outline-none bg-white"
            >
              {INTERNAL_PAGES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {block.type === 'list' && (
        <div className="space-y-2">
          {(block.items || ['']).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const next = [...(block.items || [])];
                  next[i] = e.target.value;
                  onChange({ items: next });
                }}
                placeholder={`Élément ${i + 1}`}
                className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-blue-500 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const next = (block.items || []).filter((_, idx) => idx !== i);
                  onChange({ items: next.length ? next : [''] });
                }}
                className="p-1 text-red-500 hover:bg-red-50 rounded"
                title="Retirer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ items: [...(block.items || []), ''] })}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
          >
            <Plus className="w-3 h-3" /> Ajouter un élément
          </button>
        </div>
      )}

      {block.type === 'image' && (
        <ImagePicker
          value={block.imageUrl}
          onChange={(url) => onChange({ imageUrl: url || undefined })}
          aspect="wide"
          hint="Choisissez une image depuis votre ordinateur."
        />
      )}
    </div>
  );
}

// === Sérialiseurs (internes — jamais exposés à l'utilisateur) ===

/**
 * Convertit un tableau de blocs en structure JSON stockable en base.
 * Utilisé par le service frontend avant l'envoi API.
 */
export function serializeBlocks(blocks: Block[]): unknown {
  return { sections: blocks.map(({ id, ...rest }) => ({ id, ...rest })) };
}

/**
 * Reconstruit un tableau de blocs depuis la structure JSON stockée en base.
 * Tolérant aux anciens formats (texte brut, JSON mal formé, etc.).
 */
export function deserializeBlocks(raw: unknown): Block[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    // Ancien format : texte brut → un seul paragraphe
    return raw.trim() ? [{ id: uid(), type: 'paragraph', text: raw }] : [];
  }
  if (Array.isArray(raw)) {
    // Format actuel : tableau direct de blocs
    return raw.map((b: any) => ({
      id: b.id || uid(),
      type: (b.type as BlockType) || 'paragraph',
      text: b.text,
      items: b.items,
      imageUrl: b.imageUrl,
      buttonUrl: b.buttonUrl,
    }));
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as any;
    if (Array.isArray(obj.sections)) {
      return deserializeBlocks(obj.sections);
    }
  }
  return [];
}
