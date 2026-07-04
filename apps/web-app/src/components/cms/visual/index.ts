/**
 * ============================================================================
 * Index — Composants CMS visuels réutilisables
 * ============================================================================
 *
 * Composants 100% non-techniques pour le CMS Academia Helm.
 * Aucun de ces composants n'expose de slug, URL, JSON, hex code, enum
 * technique, ou concept de programmation à l'utilisateur final.
 */

export { ImagePicker } from './ImagePicker';
export { SlugField } from './SlugField';
export { StatusToggle } from './StatusToggle';
export { StarRating } from './StarRating';
export { ColorPalette } from './ColorPalette';
export { ReorderableList } from './ReorderableList';
export { DateField } from './DateField';
export {
  VisualBlocksEditor,
  serializeBlocks,
  deserializeBlocks,
  type Block,
  type BlockType,
} from './VisualBlocksEditor';
