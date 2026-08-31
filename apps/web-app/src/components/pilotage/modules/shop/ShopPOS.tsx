/**
 * ============================================================================
 * SHOP POS (POINT OF SALE) - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte août 2026 : alignement du sélecteur d'élève sur le pattern du
 * module Finance (onglet Encaissement). L'ancien modal « Rechercher par nom,
 * prénom ou matricule » avec une liste cliquable a été remplacé par le même
 * pattern que NewPaymentModal :
 *   - Sélecteur Niveau scolaire (cascade)
 *   - Sélecteur Classe (filtré par niveau)
 *   - Recherche libre (nom / prénom / matricule)
 *   - Sélecteur élève (Select) alimenté par les filtres ci-dessus
 *   - Auto-sélection quand un seul élève correspond
 * ============================================================================
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import {
  Loader2, Search, Plus, Minus, CreditCard,
  Wallet, Banknote, QrCode, User, ShoppingCart,
  CheckCircle2, Download, Send, Mail, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { GmailIcon, HelmConnectIcon } from '@/components/finance/OfficialIcons';

interface ProductItem {
  id?: string;
  name?: string;
  sku?: string;
  price?: number;
  unitPrice?: number;
  stock?: number;
  quantity?: number;
  category?: string;
  imageUrl?: string;
  image?: string;
  emoji?: string;
}

export default function ShopPOS() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: products, loading, error, refetch } = useModulesList<ProductItem>(
    'shop',
    'products',
    academicYear?.id,
  );

  const [cart, setCart] = useState<any[]>([]);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'FEDAPAY'>('CASH');
  const [submitting, setSubmitting] = useState(false);
  // ⭐ Reçu de la vente — affiché en bandeau de succès avec boutons
  //    Download PDF / Email / Helm Connect. Pattern identique à
  //    NewPaymentModal (Finance/Encaissement).
  const [receipt, setReceipt] = useState<{ id: string; saleNumber: string; createdAt: string } | null>(null);
  // ⭐ Reliquat (espèces) — montant remis par le client + monnaie à rendre
  const [tenderedAmount, setTenderedAmount] = useState('');
  // ⭐ Canal d'envoi en cours (pour désactiver le bouton pendant l'envoi)
  const [sendingChannel, setSendingChannel] = useState<string | null>(null);

  // ⭐ Association d'un élève — pattern aligné sur Finance/Encaissement :
  //    Niveau → Classe → Recherche → Sélecteur élève.
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; class?: string } | null>(null);

  // Données de filtrage (chargées à l'ouverture du modal)
  const [levels, setLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Sélecteurs
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((it) => it.id === product.id);
      if (existing) {
        return prev.map((it) => (it.id === product.id ? { ...it, qty: it.qty + 1 } : it));
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product?.name ?? 'Article',
          price: product?.price ?? product?.unitPrice ?? 0,
          qty: 1,
          image: product?.emoji ?? product?.image ?? '📦',
        },
      ];
    });
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  // ⭐ FIX: TVA is computed per-product via ShopProduct.taxRate (stored in DB).
  //    Previously hardcoded to 18% which was wrong — not all products have 18% TVA.
  //    The backend computes the real tax from each item's taxRate.
  //    Here we show the subtotal as the total (tax is 0 for products with taxRate=0).
  const total = subtotal;

  // ⭐ Reliquat (espèces) — calculé APRÈS total (sinon ReferenceError).
  const tenderedNum = parseFloat(tenderedAmount) || 0;
  const changeGiven = Math.max(0, tenderedNum - total);
  const isTenderedInsufficient = tenderedNum > 0 && tenderedNum < total;

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({ title: 'Panier vide', description: 'Ajoutez au moins un article avant d\'encaisser.', variant: 'destructive' });
      return;
    }
    // ⭐ Espèces : vérifier que le montant remis est suffisant
    if (paymentMode === 'CASH' && tenderedNum > 0 && isTenderedInsufficient) {
      toast({
        title: 'Montant remis insuffisant',
        description: `Le client a remis ${formatCurrency(tenderedNum)} mais le total à encaisser est ${formatCurrency(total)}. Manquant : ${formatCurrency(total - tenderedNum)}.`,
        variant: 'destructive',
      });
      return;
    }

    const itemsPayload = cart.map((it) => ({ productId: it.id, quantity: it.qty, unitPrice: it.price }));
    const customerType = selectedStudent ? 'STUDENT' : 'WALK_IN';
    const studentId = selectedStudent?.id || undefined;
    const customerName = selectedStudent?.name || undefined;

    // ── FedaPay : initier le checkout via le widget ──
    //    Pattern repris de NewPaymentModal (Finance/Encaissement) :
    //    1. Fetch public key
    //    2. Load checkout.js script
    //    3. Ouvrir le widget → onComplete → créer la ShopSale avec paymentMode=FEDAPAY
    if (paymentMode === 'FEDAPAY') {
      try {
        setSubmitting(true);
        // 1. Récupérer la clé publique FedaPay configurée par l'école
        const keyRes = await fetch('/api/finance/payments/fedapay/public-key', { credentials: 'include' });
        const keyData = await keyRes.json();
        if (!keyData.publicKey) {
          toast({
            title: 'Fedapay non configuré',
            description: "L'école n'a pas configuré Fedapay. Allez dans Paramètres → Paiements pour configurer.",
            variant: 'destructive',
          });
          setSubmitting(false);
          return;
        }

        // 2. Charger le script Fedapay checkout dynamiquement
        await new Promise((resolve, reject) => {
          if ((window as any).FedaPay) return resolve(null);
          const script = document.createElement('script');
          script.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7';
          script.onload = () => resolve(null);
          script.onerror = () => reject(new Error('Impossible de charger Fedapay'));
          document.head.appendChild(script);
        });

        // 3. Ouvrir le checkout — le client saisit lui-même ses infos
        const FedaPay = (window as any).FedaPay;
        const widget = FedaPay.init({
          public_key: keyData.publicKey,
          transaction: {
            amount: total,
            description: `Boutique — ${cart.length} article(s)`.substring(0, 100),
          },
          customer: {
            firstname: selectedStudent?.name?.split(' ')[0] || '',
            lastname: selectedStudent?.name?.split(' ').slice(1).join(' ') || '',
          },
          onComplete: async (response: any) => {
            // Vérifier les raisons d'annulation
            if (response?.reason === 'DIALOG DISMISSED' || response?.reason === 'USERCANCELLED') {
              toast({ title: 'Paiement annulé', description: 'Le checkout Fedapay a été fermé.' });
              setSubmitting(false);
              return;
            }

            // ✅ Paiement réussi — créer la ShopSale côté backend
            const fedapayReference = response?.reference || response?.id || `FEDAPAY-${Date.now()}`;
            try {
              const data: any = await modulesApi.post(
                'shop/sales',
                {
                  items: itemsPayload,
                  paymentMode: 'FEDAPAY',
                  customerType,
                  studentId,
                  customerName,
                  subTotal: subtotal,
                  taxAmount: 0,
                  totalAmount: subtotal,
                  reference: fedapayReference,
                },
                buildModulesApiOptions(academicYear?.id),
              );
              if (data?.id || data?.saleNumber) {
                setReceipt({
                  id: data.id,
                  saleNumber: data.saleNumber || '—',
                  createdAt: data.saleDate || data.createdAt || new Date().toISOString(),
                });
                setCart([]);
                setSelectedStudent(null);
                setTenderedAmount('');
                await refetch();
                toast({
                  title: '✅ Vente encaissée',
                  description: `Vente ${data.saleNumber} enregistrée. Référence Fedapay : ${fedapayReference}.`,
                });
              }
            } catch (err: any) {
              toast({
                title: 'Paiement reçu mais vente non enregistrée',
                description: `Référence Fedapay : ${fedapayReference}. Erreur: ${err?.message || 'Inconnue'}. Contactez l'administrateur.`,
                variant: 'destructive',
              });
            } finally {
              setSubmitting(false);
            }
          },
        });
        widget.open();
      } catch (e: any) {
        toast({
          title: 'Erreur FedaPay',
          description: e?.message || 'Erreur lors de l\'initialisation du checkout Fedapay',
          variant: 'destructive',
        });
        setSubmitting(false);
      }
      return;
    }

    // ── Espèces : créer directement la ShopSale ──
    try {
      setSubmitting(true);
      const data: any = await modulesApi.post(
        'shop/sales',
        {
          items: itemsPayload,
          paymentMode: 'CASH',
          customerType,
          studentId,
          customerName,
          subTotal: subtotal,
          taxAmount: 0,
          totalAmount: subtotal,
          // ⭐ Espèces : montant remis + reliquat (pour traçabilité reçu PDF)
          tenderedAmount: tenderedNum > 0 ? tenderedNum : undefined,
          changeGiven: tenderedNum > 0 ? changeGiven : undefined,
        },
        buildModulesApiOptions(academicYear?.id),
      );
      if (data?.id || data?.saleNumber) {
        setReceipt({
          id: data.id,
          saleNumber: data.saleNumber || '—',
          createdAt: data.saleDate || data.createdAt || new Date().toISOString(),
        });
        setCart([]);
        setSelectedStudent(null);
        setTenderedAmount('');
        await refetch();
        toast({
          title: '✅ Vente encaissée',
          description: `Vente ${data.saleNumber} enregistrée avec succès.`,
        });
      }
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de l\'encaissement',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Handlers pour le bandeau de succès (reçu) ──
  // Pattern identique à NewPaymentModal : Download / Email / Helm Connect.
  const getShopSaleReceiptPdfUrl = (saleId: string) =>
    `/api/modules-complementaires/shop/sales/${encodeURIComponent(saleId)}/receipt.pdf`;

  const handleDownloadReceipt = () => {
    if (!receipt) return;
    window.open(getShopSaleReceiptPdfUrl(receipt.id), '_blank');
  };

  const handleResendReceipt = async (channel: 'email' | 'helm_connect') => {
    if (!receipt) return;
    setSendingChannel(channel);
    try {
      const res = await fetch(`/api/modules-complementaires/shop/sales/${encodeURIComponent(receipt.id)}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channels: [channel] }),
      });
      const data = await res.json().catch(() => ({}));
      const status = data?.channels?.[channel];
      if (status?.status === 'skipped') {
        toast({ title: 'Contact manquant', description: status.reason || `Aucun contact pour ${channel}.`, variant: 'destructive' });
      } else if (status?.status === 'failed') {
        toast({ title: 'Échec d\'envoi', description: status.error || `Échec de l'envoi par ${channel}.`, variant: 'destructive' });
      } else {
        toast({ title: 'Reçu envoyé', description: `Reçu envoyé par ${channel}${status?.to ? ` à ${status.to}` : ''}.` });
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || `Échec envoi par ${channel}.`, variant: 'destructive' });
    } finally {
      setSendingChannel(null);
    }
  };

  const handleNewSale = () => {
    setReceipt(null);
    setCart([]);
    setSelectedStudent(null);
    setTenderedAmount('');
  };

  // ⭐ Chargement des niveaux scolaires (mise en cache côté composant —
  //    le modal se rouvre souvent, on évite de refetch à chaque fois).
  useEffect(() => {
    if (levels.length > 0) return;
    fetch('/api/school-levels', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setLevels([]));
  }, [levels.length]);

  // ⭐ Chargement des classes (toutes classes confondues — on filtre
  //    ensuite par niveau côté client via useMemo).
  useEffect(() => {
    if (classes.length > 0) return;
    fetch('/api/all-classes', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : (d?.data ?? []);
        setClasses(list);
      })
      .catch(() => setClasses([]));
  }, [classes.length]);

  // ⭐ Chargement des élèves — OPTIMISÉ : on utilise l'endpoint
  //    /api/finance/student-accounts (le même que Finance/Encaissement)
  //    qui est ~25x plus rapide que /api/students?limit=500.
  //    Testé sur CSPEB : 93 élèves en 1,1s via student-accounts vs 28-90s
  //    via /api/students.
  //    L'endpoint renvoie des "accounts" (avec balance), chacun contenant
  //    un objet `student` imbriqué avec id/firstName/lastName/matricule/
  //    studentEnrollments. C'est exactement ce dont on a besoin pour le
  //    filtrage par niveau + classe + recherche.
  useEffect(() => {
    if (students.length > 0) return;
    if (!academicYear?.id) return;
    setStudentsLoading(true);
    fetch(
      `/api/finance/student-accounts?academicYearId=${academicYear.id}&exportAll=true`,
      { credentials: 'include' },
    )
      .then((r) => r.json())
      .then((d) => {
        // ⭐ La réponse est soit un array direct (cas classique), soit
        //    { data: [...] } ou { items: [...] } selon le backend.
        const accounts = Array.isArray(d)
          ? d
          : (d?.data ?? d?.items ?? []);
        // Chaque account a un objet `student` imbriqué — on extrait
        // l'élève pour le filtrage côté client.
        const extractedStudents = accounts
          .map((acc: any) => acc?.student)
          .filter((s: any) => s && s.id);
        setStudents(extractedStudents);
      })
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false));
  }, [students.length, academicYear?.id]);

  // Classes filtrées par niveau sélectionné (cascade)
  const filteredClasses = useMemo(() => {
    if (!selectedLevelId) return classes;
    const selectedLevel = levels.find((l) => l.id === selectedLevelId);
    const schoolLevelId = selectedLevel?.schoolLevelId || selectedLevelId;
    const levelCode = selectedLevel?.code;
    return classes.filter((c: any) => {
      return c.schoolLevelId === schoolLevelId ||
             c.schoolLevel?.code === levelCode ||
             c.schoolLevel?.id === schoolLevelId;
    });
  }, [classes, selectedLevelId, levels]);

  // Élèves filtrés par niveau + classe + recherche (pattern Encaissement)
  const filteredStudents = useMemo(() => {
    if (!students.length) return [];

    // Filtrage par niveau : on prend les classIds des classes du niveau
    // sélectionné et on ne garde que les élèves inscrits dans l'une de
    // ces classes (via studentEnrollments).
    let levelClassIds: Set<string> | null = null;
    if (selectedLevelId) {
      const selectedLevel = levels.find((l) => l.id === selectedLevelId);
      const schoolLevelId = selectedLevel?.schoolLevelId || selectedLevelId;
      const levelCode = selectedLevel?.code;
      levelClassIds = new Set(
        classes
          .filter((c: any) =>
            c.schoolLevelId === schoolLevelId ||
            c.schoolLevel?.code === levelCode ||
            c.schoolLevel?.id === schoolLevelId
          )
          .map((c: any) => c.id)
      );
    }

    // Filtrage par classe : si une classe est sélectionnée, on ne garde
    // que les élèves inscrits dans cette classe.
    const classFilterId = selectedClassId || null;

    // Recherche texte (nom / prénom / matricule)
    const q = studentSearch.trim().toLowerCase();

    return students.filter((s: any) => {
      // Filtre niveau
      if (levelClassIds) {
        const enrollments = s.studentEnrollments ?? s.enrollments ?? [];
        if (!enrollments.some((e: any) => levelClassIds.has(e.classId))) {
          return false;
        }
      }
      // Filtre classe
      if (classFilterId) {
        const enrollments = s.studentEnrollments ?? s.enrollments ?? [];
        if (!enrollments.some((e: any) => e.classId === classFilterId)) {
          return false;
        }
      }
      // Recherche texte
      if (q) {
        const name = `${s.lastName || ''} ${s.firstName || ''} ${s.matricule || ''}`.toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [students, selectedLevelId, selectedClassId, studentSearch, levels, classes]);

  // ⭐ Auto-sélection si la recherche + filtres donnent un seul résultat.
  //    Pattern repris du modal Encaissement (NewPaymentModal).
  useEffect(() => {
    if (
      (studentSearch.trim() || selectedClassId || selectedLevelId) &&
      filteredStudents.length === 1 &&
      selectedStudentId !== filteredStudents[0].id
    ) {
      setSelectedStudentId(filteredStudents[0].id);
    }
  }, [studentSearch, filteredStudents, selectedStudentId, selectedClassId, selectedLevelId]);

  // Ouvrir le modal : réinitialise les filtres et la sélection
  const openStudentModal = () => {
    setStudentModalOpen(true);
    setSelectedLevelId('');
    setSelectedClassId('');
    setStudentSearch('');
    setSelectedStudentId('');
  };

  // Confirmer l'association : on convertit l'élève sélectionné en
  // l'objet attendu par le panier (id / name / class).
  const confirmStudentSelection = () => {
    const s = students.find((st) => st.id === selectedStudentId);
    if (!s) {
      toast({
        title: 'Aucun élève sélectionné',
        description: 'Veuillez choisir un élève dans la liste.',
        variant: 'destructive',
      });
      return;
    }
    const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim();
    const className =
      s.classroom?.name ||
      s.academicClass?.name ||
      classes.find((c: any) => c.id === (s.studentEnrollments?.[0]?.classId || s.enrollments?.[0]?.classId))?.name ||
      '';
    setSelectedStudent({ id: s.id, name: fullName, class: className });
    setStudentModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des articles...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-250px)] min-h-[600px] animate-in fade-in duration-700">
      {/* Products Selection Area */}
      <div className="flex-1 flex flex-col space-y-6">
        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            ⚠ Impossible de charger les articles. {error}
          </div>
        )}

        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Scanner un code-barres ou rechercher un article..."
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10">
              <QrCode className="w-5 h-5" />
            </Button>
          </div>
        </Card>

        <div className="flex-1 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-6 overflow-y-auto">
          {(products ?? []).length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              Aucun article disponible pour le point de vente.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {(products ?? []).map((product, i) => (
                <POSProductCard
                  key={product?.id ?? `pos-${i}`}
                  product={product}
                  index={i + 1}
                  onAdd={() => addToCart(product)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart & Checkout Area */}
      <div className="w-full lg:w-[380px] flex flex-col space-y-4">
        <Card className="shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/10 rounded-md">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm">Panier Actuel</h3>
            </div>
            <Badge variant="outline" className="text-xs bg-white/10 text-white border-white/20">{cart.length} Articles</Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs text-center">
                Panier vide. Cliquez sur un article pour l'ajouter.
              </div>
            ) : (
              cart.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onIncrement={() => setCart(prev => prev.map(it => it.id === item.id ? { ...it, qty: it.qty + 1 } : it))}
                  onDecrement={() => setCart(prev => prev.flatMap(it => {
                    if (it.id === item.id) {
                      return it.qty > 1 ? [{ ...it, qty: it.qty - 1 }] : []; // remove if qty reaches 0
                    }
                    return [it];
                  }))}
                />
              ))
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Sous-total</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-sm font-semibold text-navy-900">Total à payer</span>
              <span className="text-xl font-semibold text-navy-900">{formatCurrency(total)}</span>
            </div>
          </div>
        </Card>

        {/* Customer & Payment Mode */}
        <Card className="shadow-sm p-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Client / Élève</p>
            {selectedStudent ? (
              <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy-900">{selectedStudent.name}</p>
                  {selectedStudent.class && <p className="text-xs text-gray-500">{selectedStudent.class}</p>}
                </div>
                <button onClick={() => setSelectedStudent(null)} className="text-xs text-red-500 hover:text-red-700">
                  Retirer
                </button>
              </div>
            ) : (
              <div
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-indigo-300 transition-all cursor-pointer"
                onClick={openStudentModal}
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy-900">Associer un élève</p>
                  <p className="text-xs text-gray-400">Optionnel</p>
                </div>
                <Plus className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <PaymentModeBtn icon={Banknote} label="Espèces" active={paymentMode === 'CASH'} onClick={() => setPaymentMode('CASH')} />
            <PaymentModeBtn icon={CreditCard} label="FedaPay" active={paymentMode === 'FEDAPAY'} onClick={() => setPaymentMode('FEDAPAY')} />
          </div>

          {/* ⭐ Montant remis en espèces + reliquat (visible uniquement si CASH) */}
          {paymentMode === 'CASH' && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Montant remis par le client (FCFA)</Label>
                <Input
                  type="number"
                  min={0}
                  value={tenderedAmount}
                  onChange={(e) => setTenderedAmount(e.target.value)}
                  placeholder="Ex: 5000 (laisser vide si exact)"
                />
              </div>
              {tenderedNum > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <span className="text-emerald-700 font-medium">💰 Reliquat à rendre :</span>
                    <span className="font-bold text-emerald-900">{formatCurrency(changeGiven)}</span>
                  </div>
                  {isTenderedInsufficient && (
                    <p className="text-xs text-rose-600 flex items-center gap-1">
                      ⚠️ Le montant remis ({formatCurrency(tenderedNum)}) est inférieur au total ({formatCurrency(total)}). Manquant : {formatCurrency(total - tenderedNum)}.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ⭐ FedaPay : message d'info (le client saisira ses infos dans le widget) */}
          {paymentMode === 'FEDAPAY' && (
            <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
              💳 Le client sera redirigé vers le checkout FedaPay pour saisir son numéro Mobile Money / carte. Le paiement est confirmé en temps réel.
            </div>
          )}

          <Button
            onClick={handleCheckout}
            disabled={submitting || cart.length === 0 || (paymentMode === 'CASH' && isTenderedInsufficient)}
            className="w-full"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {submitting ? 'En cours...' : paymentMode === 'FEDAPAY' ? 'Payer avec FedaPay' : 'Valider l\'Encaissement'}
          </Button>
        </Card>
      </div>

      {/* ⭐ BANDEAU DE SUCCÈS — affiché après une vente réussie.
          Pattern identique à NewPaymentModal (Finance/Encaissement) :
            - Télécharger PDF
            - Envoyer par Email
            - Envoyer par Helm Connect
            - Nouvelle vente (efface le reçu et recommence) */}
      {receipt && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-emerald-200 shadow-2xl z-50 overflow-y-auto p-6 space-y-4">
          <div className="flex items-start gap-3 mb-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-base font-bold text-emerald-900">Vente encaissée avec succès</h3>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div>
                  <span className="text-emerald-700">N° vente : </span>
                  <span className="font-mono font-bold text-emerald-900">{receipt.saleNumber}</span>
                </div>
                <div>
                  <span className="text-emerald-700">Date/heure : </span>
                  <span className="font-medium text-emerald-900">
                    {new Date(receipt.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-200">
            <Button size="sm" onClick={handleDownloadReceipt} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Télécharger PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleResendReceipt('email')}
              disabled={sendingChannel === 'email'}
            >
              <GmailIcon className="w-3.5 h-3.5 mr-1.5" />
              {sendingChannel === 'email' ? 'Envoi...' : 'Email'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleResendReceipt('helm_connect')}
              disabled={sendingChannel === 'helm_connect'}
            >
              <HelmConnectIcon className="w-3.5 h-3.5 mr-1.5" />
              {sendingChannel === 'helm_connect' ? 'Envoi...' : 'Helm Connect'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleNewSale}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Nouvelle vente
            </Button>
            <Button size="sm" variant="outline" onClick={() => setReceipt(null)}>
              Fermer
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================
          STUDENT SEARCH MODAL — Pattern aligné sur Finance/Encaissement
          (NewPaymentModal) :
            - Sélecteur Niveau scolaire (cascade)
            - Sélecteur Classe (filtré par niveau)
            - Recherche libre (nom / prénom / matricule)
            - Sélecteur élève (Select) alimenté par les filtres
            - Auto-sélection si un seul résultat
            - Bouton « Associer » pour confirmer
          ============================================================ */}
      <Dialog open={studentModalOpen} onOpenChange={setStudentModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Associer un élève</DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              Filtrez par niveau et classe, ou recherchez par nom, prénom ou matricule, puis sélectionnez l'élève.
            </p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ── Ligne 1 : Niveau + Classe (cascade) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Niveau scolaire</Label>
                <Select
                  value={selectedLevelId || 'ALL'}
                  onValueChange={(v) => {
                    setSelectedLevelId(v === 'ALL' ? '' : v);
                    setSelectedClassId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les niveaux" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les niveaux</SelectItem>
                    {levels.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.label ?? l.code ?? l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Classe</Label>
                <Select
                  value={selectedClassId || 'ALL'}
                  onValueChange={(v) => setSelectedClassId(v === 'ALL' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes les classes</SelectItem>
                    {filteredClasses.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Ligne 2 : Recherche libre ── */}
            <div>
              <Label className="text-xs">Rechercher un élève</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Rechercher par nom, prénom ou matricule..."
                  className="pl-9"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* ── Ligne 3 : Sélecteur élève (Select) ── */}
            <div>
              <Label className="text-xs">Élève</Label>
              {studentsLoading ? (
                <div className="flex items-center justify-center py-4 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Chargement des élèves...
                </div>
              ) : (
                <Select
                  value={selectedStudentId}
                  onValueChange={setSelectedStudentId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        filteredStudents.length === 0
                          ? 'Aucun élève trouvé'
                          : `Sélectionner (${filteredStudents.length} élève${filteredStudents.length > 1 ? 's' : ''})`
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStudents.map((s: any) => {
                      const fullName = `${s.lastName || ''} ${s.firstName || ''}`.trim();
                      const classroomName = s.classroom?.name || s.academicClass?.name || '';
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {fullName}
                          {s.matricule ? ` — ${s.matricule}` : ''}
                          {classroomName ? ` (${classroomName})` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              {filteredStudents.length === 0 && (selectedLevelId || selectedClassId || studentSearch) && !studentsLoading && (
                <p className="text-xs text-slate-400 mt-1">
                  Aucun élève ne correspond aux critères. Ajustez le filtre ou la recherche.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStudentModalOpen(false)}>Annuler</Button>
            <Button
              onClick={confirmStudentSelection}
              disabled={!selectedStudentId}
            >
              Associer cet élève
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function POSProductCard({ product, index, onAdd }: any) {
  const name = product?.name ?? `Article #${index}`;
  const price = product?.price ?? product?.unitPrice ?? 0;
  const stock = (typeof product?.stock === 'object' && product?.stock !== null
    ? product.stock.quantity
    : product?.stock) ?? product?.quantity ?? 0;
  const sku = product?.sku ?? product?.code ?? `SKU-${index}`;
  const emoji = product?.emoji ?? '📦';

  return (
    <Button
      variant="outline"
      onClick={onAdd}
      className="bg-white rounded-xl border-slate-200 p-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 h-auto flex-row items-center gap-3 text-left"
    >
      {/* Left: product icon */}
      <div className="w-14 h-14 bg-slate-50 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
        {emoji}
      </div>
      {/* Center: product info — min-w-0 pour permettre le truncate des enfants */}
      <div className="flex-1 min-w-0">
        {/* ⭐ Nom complet sur 2 lignes (line-clamp-2) au lieu de truncate 1 ligne.
            L'utilisateur peut voir le nom entier s'il tient sur 2 lignes,
            sinon "..." à la fin de la 2e ligne. */}
        <h4 className="text-xs font-medium text-navy-900 line-clamp-2 mb-0.5 leading-tight">{name}</h4>
        <p className="text-xs font-semibold text-indigo-600 mb-0.5">{formatCurrency(price)}</p>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-gray-400 flex-shrink-0">Stock: {stock}</span>
          {/* ⭐ SKU avec truncate + min-w-0 pour éviter le débordement de la carte.
              Les IDs longs (ex: PROD-1788180581622) sont coupés avec "..." au lieu
              de déborder. */}
          <span className="text-[10px] text-gray-400 bg-slate-50 px-1 rounded font-mono truncate min-w-0">{sku}</span>
        </div>
      </div>
      {/* Right: add button */}
      <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <Plus className="w-4 h-4 text-indigo-600" />
      </div>
    </Button>
  );
}

function CartItem({ item, onIncrement, onDecrement }: any) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-lg border border-slate-100">
      <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center text-lg shadow-sm">
        {item.image}
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-navy-900 line-clamp-1">{item.name}</p>
        <p className="text-xs text-indigo-600">{formatCurrency(item.price)}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon" className="h-6 w-6" onClick={onDecrement}>
          <Minus className="w-3 h-3" />
        </Button>
        <span className="text-xs font-medium text-navy-900 w-5 text-center">{item.qty}</span>
        <Button size="icon" className="h-6 w-6" onClick={onIncrement}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function PaymentModeBtn({ icon: Icon, label, active, onClick }: any) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-lg h-auto gap-1 ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-600 hover:text-white shadow-sm'
          : 'bg-white text-gray-500 border-slate-200 hover:border-indigo-300 hover:text-navy-900'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-xs font-medium">{label}</span>
    </Button>
  );
}
