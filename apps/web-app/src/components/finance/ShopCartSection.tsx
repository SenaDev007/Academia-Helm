/**
 * ============================================================================
 * SHOP CART SECTION - Section panier boutique pour NewPaymentModal
 * ============================================================================
 *
 * Refonte sept 2026 :
 *  - Sélection multiple dans le picker (checkboxes + bouton "Valider la sélection")
 *  - Prix et quantité non tronqués (largeurs augmentées + whitespace-nowrap)
 *  - Layout responsive (colonnes empilées sur petit écran)
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Trash2, Package, ShoppingCart, Loader2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

export interface ShopCartItem {
  productId: string;
  name: string;
  code?: string;
  unitPrice: number;
  quantity: number;
  stock: number;
}

export interface ShopCartSectionProps {
  academicYearId: string;
  items: ShopCartItem[];
  onItemsChange: (items: ShopCartItem[]) => void;
}

export default function ShopCartSection({
  academicYearId,
  items,
  onItemsChange,
}: ShopCartSectionProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  // ⭐ Sélection multiple : liste des IDs sélectionnés dans le picker
  const [selectedPickerIds, setSelectedPickerIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!academicYearId) return;
    setLoading(true);
    fetch(`/api/modules-complementaires/shop/products?academicYearId=${academicYearId}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setProducts(list);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [academicYearId]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const q = searchTerm.toLowerCase().trim();
    return products.filter((p: any) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q)
    );
  }, [products, searchTerm]);

  const cartTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  }, [items]);

  const handleAddProduct = (product: any) => {
    const existing = items.find((it) => it.productId === product.id);
    const stock = Number(product.stock?.quantity ?? 0);
    if (existing) {
      if (existing.quantity >= stock) return;
      handleQuantityChange(product.id, existing.quantity + 1);
    } else {
      onItemsChange([
        ...items,
        { productId: product.id, name: product.name, code: product.code, unitPrice: Number(product.unitPrice), quantity: 1, stock },
      ]);
    }
  };

  const handleQuantityChange = (productId: string, newQty: number) => {
    const item = items.find((it) => it.productId === productId);
    if (!item) return;
    const clamped = Math.max(1, Math.min(newQty, item.stock));
    onItemsChange(items.map((it) => (it.productId === productId ? { ...it, quantity: clamped } : it)));
  };

  const handlePriceChange = (productId: string, newPrice: number) => {
    onItemsChange(items.map((it) => (it.productId === productId ? { ...it, unitPrice: Math.max(0, newPrice) } : it)));
  };

  const handleRemoveItem = (productId: string) => {
    onItemsChange(items.filter((it) => it.productId !== productId));
  };

  const handleClearCart = () => onItemsChange([]);

  // ⭐ Toggle sélection dans le picker (sélection multiple)
  const togglePickerSelection = (productId: string) => {
    setSelectedPickerIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  // ⭐ Valider la sélection multiple : ajouter tous les produits cochés au panier
  //    On construit le nouveau tableau d'items en une seule fois (pas de boucle
  //    qui appelle handleAddProduct — car items n'est pas mis à jour entre
  //    les appels à cause du batching de React).
  const handleValidateMultiSelection = () => {
    const selectedProducts = products.filter((p: any) => selectedPickerIds.has(p.id));
    if (selectedProducts.length === 0) return;

    // Construire les nouveaux items à ajouter (ceux qui ne sont pas déjà dans le panier)
    const newItems = selectedProducts
      .filter((p) => !items.find((it) => it.productId === p.id))
      .map((p) => ({
        productId: p.id,
        name: p.name,
        code: p.code,
        unitPrice: Number(p.unitPrice),
        quantity: 1,
        stock: Number(p.stock?.quantity ?? 0),
      }));

    // Pour les produits déjà dans le panier, on incrémente la quantité
    const updatedItems = items.map((it) => {
      const selected = selectedProducts.find((p) => p.id === it.productId);
      if (selected) {
        const stock = Number(selected.stock?.quantity ?? 0);
        return { ...it, quantity: Math.min(it.quantity + 1, stock) };
      }
      return it;
    });

    // Fusionner en une seule mise à jour
    onItemsChange([...updatedItems, ...newItems]);
    setSelectedPickerIds(new Set());
    setShowProductPicker(false);
  };

  return (
    <div className="rounded-lg border-2 border-violet-200 bg-violet-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-violet-700" />
          <h4 className="text-sm font-bold text-violet-900">Articles Boutique</h4>
          <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-300 bg-violet-50">Multi-action</Badge>
        </div>
        <div className="flex gap-2">
          {items.length > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={handleClearCart} className="text-xs h-7 text-violet-600 hover:text-violet-900">
              <Trash2 className="w-3 h-3 mr-1" /> Vider
            </Button>
          )}
          <Button type="button" size="sm" onClick={() => { setSelectedPickerIds(new Set()); setShowProductPicker(true); }} className="bg-violet-700 hover:bg-violet-800 text-white h-7 text-xs">
            <Plus className="w-3 h-3 mr-1" /> Ajouter article(s)
          </Button>
        </div>
      </div>

      {/* Liste des articles du panier */}
      {items.length === 0 ? (
        <div className="text-xs text-slate-500 italic py-2 text-center bg-white/50 rounded border border-dashed border-violet-200">
          Aucun article boutique. Cliquez sur « Ajouter article(s) » pour inclure un uniforme, une tenue de sport, des fournitures… dans cet encaissement.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <motion.div
              key={item.productId}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg border border-violet-200 p-3 flex flex-wrap items-center gap-2"
            >
              {/* Nom + code + stock */}
              <div className="flex-1 min-w-[140px]">
                <div className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                  <span className="text-xs font-semibold text-slate-800 truncate">{item.name}</span>
                  {item.code && <span className="text-[10px] text-slate-400 whitespace-nowrap">({item.code})</span>}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Stock : {item.stock}</div>
              </div>

              {/* Quantité — largeurs augmentées pour éviter la troncature */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Label className="text-[10px] text-slate-400 whitespace-nowrap">Qté</Label>
                <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0 text-sm" onClick={() => handleQuantityChange(item.productId, item.quantity - 1)} disabled={item.quantity <= 1}>−</Button>
                <Input type="number" min={1} max={item.stock} value={item.quantity} onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value) || 1)} className="h-7 w-16 text-sm text-center p-1" />
                <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0 text-sm" onClick={() => handleQuantityChange(item.productId, item.quantity + 1)} disabled={item.quantity >= item.stock}>+</Button>
              </div>

              {/* Prix unitaire — largeur augmentée */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Label className="text-[10px] text-slate-400 whitespace-nowrap">P.U.</Label>
                <Input type="number" min={0} value={item.unitPrice} onChange={(e) => handlePriceChange(item.productId, parseFloat(e.target.value) || 0)} className="h-7 w-24 text-sm text-right p-1" />
                <span className="text-[10px] text-slate-400 whitespace-nowrap">FCFA</span>
              </div>

              {/* Total ligne */}
              <div className="text-sm font-bold text-violet-700 min-w-[90px] text-right whitespace-nowrap">
                {formatCurrency(item.unitPrice * item.quantity)}
              </div>

              {/* Supprimer */}
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700" onClick={() => handleRemoveItem(item.productId)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          ))}
          <div className="flex justify-between items-center bg-violet-100 rounded-lg px-3 py-2 border-t-2 border-violet-300">
            <span className="text-xs font-semibold text-violet-900">Total articles boutique</span>
            <span className="text-sm font-bold text-violet-900">{formatCurrency(cartTotal)}</span>
          </div>
        </div>
      )}

      {/* ⭐ Modal : Sélecteur de produits — SÉLECTION MULTIPLE */}
      <AnimatePresence>
        {showProductPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
            onClick={() => setShowProductPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            >
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800">Sélectionner des articles boutique</h3>
                  {selectedPickerIds.size > 0 && (
                    <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-300">
                      {selectedPickerIds.size} sélectionné{selectedPickerIds.size > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowProductPicker(false)} className="h-7 w-7 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-3 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input type="text" placeholder="Rechercher par nom ou code..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" autoFocus />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-12 text-sm text-slate-500">
                    {products.length === 0 ? 'Aucun produit boutique configuré.' : 'Aucun produit ne correspond à votre recherche.'}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredProducts.map((product: any) => {
                      const stock = Number(product.stock?.quantity ?? 0);
                      const alreadyInCart = items.find((it) => it.productId === product.id);
                      const isOutOfStock = stock <= 0;
                      const isSelected = selectedPickerIds.has(product.id);
                      const isDisabled = isOutOfStock || (alreadyInCart && alreadyInCart.quantity >= stock);
                      return (
                        <div
                          key={product.id}
                          onClick={() => !isDisabled && togglePickerSelection(product.id)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center gap-3 cursor-pointer ${
                            isSelected ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'
                          } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {/* ⭐ Checkbox visuelle pour la sélection multiple */}
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800 truncate">{product.name}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                              {product.code && <span className="whitespace-nowrap">Code: {product.code}</span>}
                              <span className={`whitespace-nowrap ${isOutOfStock ? 'text-rose-600 font-medium' : ''}`}>Stock: {stock}</span>
                              {alreadyInCart && <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-300">Dans panier ({alreadyInCart.quantity})</Badge>}
                            </div>
                          </div>
                          <div className="text-sm font-bold text-violet-700 whitespace-nowrap">{formatCurrency(product.unitPrice)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* ⭐ Footer avec bouton "Valider la sélection" (sélection multiple) */}
              <div className="p-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {selectedPickerIds.size > 0
                    ? `${selectedPickerIds.size} article${selectedPickerIds.size > 1 ? 's' : ''} sélectionné${selectedPickerIds.size > 1 ? 's' : ''}`
                    : 'Cochez les articles à ajouter au panier'}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowProductPicker(false)}>Annuler</Button>
                  <Button
                    size="sm"
                    onClick={handleValidateMultiSelection}
                    disabled={selectedPickerIds.size === 0}
                    className="bg-violet-700 hover:bg-violet-800 text-white"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Valider la sélection ({selectedPickerIds.size})
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
