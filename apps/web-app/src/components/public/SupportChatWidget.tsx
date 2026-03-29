/**
 * Support Chat Widget - Academia Helm
 * 
 * Chatbot de support intelligent pour le landing page (pré-ATLAS)
 * Répond à toutes les questions des prospects
 * Ton professionnel, rassurant et orienté conversion
 * 
 * RÈGLE CLAIRE : Dès que l'utilisateur se connecte, le chatbot landing disparaît
 * et ATLAS prend le relais dans l'app.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { faqData, type FAQData } from '@/data/chatbot/faq';
import { intents, type Intent } from '@/data/sara/intents';
import { closingResponses } from '@/data/sara/closing_responses';
import { objections, type Objection } from '@/data/sara/objections';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

interface QuickReply {
  id: string;
  label: string;
  emoji: string;
  category: string;
}


interface EnterpriseQuoteForm {
  schoolCount: string;
  promoterName: string;
  phone: string;
  email: string;
}

const QUICK_REPLIES: QuickReply[] = [
  { id: 'pricing', label: 'Voir les plans & tarifs', emoji: '📌', category: 'billing' },
  { id: 'modules', label: 'Les 9 modules inclus', emoji: '📊', category: 'features' },
  { id: 'payment', label: 'Paiement & Fedapay', emoji: '💳', category: 'payment' },
  { id: 'trial', label: 'Demander une démo', emoji: '🧪', category: 'trial' },
  { id: 'groups', label: 'Groupes scolaires', emoji: '🏫', category: 'groups' },
  { id: 'ai', label: 'ORION & ATLAS (IA)', emoji: '🤖', category: 'ai' },
  { id: 'security', label: 'Sécurité & données', emoji: '🔒', category: 'security' },
  { id: 'contact', label: 'Parler à un conseiller', emoji: '📞', category: 'contact' },
];

const WELCOME_MESSAGE = `👋 Bonjour ! Je suis **SARA**, l'assistante IA d'Academia Helm.

Je peux vous renseigner sur nos plans (de 14 900 à 39 900 FCFA/mois, tous modules inclus), les 9 modules, le free trial guidé, ou organiser une démonstration pour votre école.

Comment puis-je vous aider aujourd'hui ? 😊`;

export default function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: WELCOME_MESSAGE,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [showEnterpriseForm, setShowEnterpriseForm] = useState(false);
  const [enterpriseForm, setEnterpriseForm] = useState<EnterpriseQuoteForm>({
    schoolCount: '',
    promoterName: '',
    phone: '',
    email: '',
  });
  const [formStep, setFormStep] = useState<'schoolCount' | 'promoterName' | 'phone' | 'email' | 'confirm'>('schoolCount');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Vérifier l'état d'authentification
  useEffect(() => {
    // TODO: Intégrer avec le système d'authentification réel
    // Pour l'instant, on vérifie dans localStorage ou sessionStorage
    const checkAuth = () => {
      // Exemple de vérification - à adapter selon votre système d'auth
      const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      const user = localStorage.getItem('user') || sessionStorage.getItem('user');
      setIsAuthenticated(!!(authToken && user));
    };

    checkAuth();
    // Vérifier périodiquement (optionnel)
    const interval = setInterval(checkAuth, 1000);
    return () => clearInterval(interval);
  }, []);

  // Si l'utilisateur est authentifié, ne pas afficher le chatbot landing
  if (isAuthenticated) {
    return null;
  }

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, showEnterpriseForm, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current && !showEnterpriseForm) {
      inputRef.current.focus();
    }
  }, [isOpen, showEnterpriseForm]);

  // Charger les données FAQ
  const faq = faqData as FAQData;

  const buildAnthropicHistory = (nextUserMessage?: string) => {
    const history = messages
      .slice(-20)
      .map((m) => ({
        role: m.type === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      }));

    if (nextUserMessage && nextUserMessage.trim()) {
      history.push({ role: 'user', content: nextUserMessage.trim() });
    }

    return history;
  };

  const tryGenerateDynamicSaraAnswer = async (
    nextUserMessage: string,
  ): Promise<string | null> => {
    try {
      const res = await fetch('/api/public/sara/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: buildAnthropicHistory(nextUserMessage) }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      const text = typeof data?.text === 'string' ? data.text.trim() : '';
      return text || null;
    } catch {
      return null;
    }
  };

  const streamDynamicSaraAnswer = async (
    nextUserMessage: string,
    onDelta: (delta: string) => void,
  ): Promise<string | null> => {
    try {
      const res = await fetch('/api/public/sara/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: buildAnthropicHistory(nextUserMessage) }),
      });
      if (!res.ok || !res.body) return null;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalText: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const line = chunk
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.startsWith('data:'));
          if (!line) continue;
          const jsonStr = line.replace(/^data:\s*/, '');
          if (!jsonStr) continue;

          let evt: any;
          try {
            evt = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          if (evt?.type === 'delta' && typeof evt?.text === 'string') {
            onDelta(evt.text);
          } else if (evt?.type === 'final' && typeof evt?.text === 'string') {
            finalText = evt.text;
          } else if (evt?.type === 'error') {
            return null;
          }
        }
      }

      return finalText;
    } catch {
      return null;
    }
  };

  /**
   * Convertit le markdown **texte** en HTML avec balises <strong>
   */
  const parseMarkdown = (text: string): string => {
    // Convertir **texte** en <strong>texte</strong>
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  /**
   * Rend le contenu du message avec support du markdown
   */
  const renderMessageContent = (content: string) => {
    const htmlContent = parseMarkdown(content);
    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  };

  /**
   * Détection d'intention intelligente basée sur les intents
   */
  const detectIntent = (question: string): Intent | null => {
    const normalizedQuestion = question.toLowerCase().trim();
    
    // Trier les intents par priorité (plus haute priorité = plus important)
    const sortedIntents = [...intents].sort((a, b) => a.priority - b.priority);
    
    // Chercher l'intent qui correspond le mieux
    for (const intent of sortedIntents) {
      const matchCount = intent.keywords.filter(keyword => 
        normalizedQuestion.includes(keyword.toLowerCase())
      ).length;
      
      // Si au moins un mot-clé correspond, on retourne cet intent
      if (matchCount > 0) {
        return intent;
      }
    }
    
    return null;
  };

  /**
   * Détection d'objection
   */
  const detectObjection = (question: string): Objection | null => {
    const normalizedQuestion = question.toLowerCase().trim();
    
    for (const objection of objections) {
      const objectionKeywords = objection.objection.toLowerCase().split(' ');
      const matchCount = objectionKeywords.filter(keyword => 
        normalizedQuestion.includes(keyword)
      ).length;
      
      // Si au moins 2 mots de l'objection correspondent
      if (matchCount >= 2) {
        return objection;
      }
    }
    
    return null;
  };

  /**
   * Génération de réponse intelligente avec closing
   */
  const generateResponse = (question: string): { answer: string; closing?: string; intentId?: string } => {
    const normalizedQuestion = question.toLowerCase().trim();

    // 1. Détecter les salutations en premier (priorité maximale)
    const greetingIntent = detectIntent(question);
    if (greetingIntent?.id === 'greeting') {
      const timeOfDay = new Date().getHours();
      let greeting = '';
      
      if (timeOfDay < 12) {
        greeting = 'Bonjour';
      } else if (timeOfDay < 18) {
        greeting = 'Bon après-midi';
      } else {
        greeting = 'Bonsoir';
      }
      
      return {
        answer: `${greeting} ! 😊\n\nJe suis SARA, votre assistante conversationnelle. Je suis là pour répondre à toutes vos questions sur Academia Helm : tarification, free trial, fonctionnalités, et bien plus.\n\nComment puis-je vous aider aujourd'hui ?`,
        closing: undefined, // Pas de closing sur les salutations
        intentId: 'greeting'
      };
    }

    // 2. Détecter les objections (priorité)
    const objection = detectObjection(question);
    if (objection) {
      return {
        answer: objection.response,
        closing: closingResponses.trial_close,
        intentId: 'pricing_objection'
      };
    }

    // 3. Détecter l'intention
    const intent = detectIntent(question);
    
    // 3. Cas spécial : Enterprise (3+ écoles)
    if (
      intent?.id === 'enterprise_quote' ||
      normalizedQuestion.includes('3 écoles') ||
      normalizedQuestion.includes('trois écoles') ||
      normalizedQuestion.includes('plus de 3') ||
      normalizedQuestion.includes('plusieurs écoles') ||
      normalizedQuestion.includes('réseau') ||
      normalizedQuestion.includes('enterprise') ||
      normalizedQuestion.includes('devis')
    ) {
      return {
        answer: '',
        closing: closingResponses.enterprise_close,
        intentId: 'enterprise_quote'
      };
    }

    // 4. Recherche dans la FAQ selon l'intent détecté
    let answer = '';
    let closing = '';

    if (intent) {
      // Mapper l'intent vers la catégorie FAQ
      const intentToCategoryMap: Record<string, keyof FAQData> = {
        'about_product': 'about',
        'free_trial': 'trial',
        'pricing_general': 'billing',
        'pricing_objection': 'billing',
        'subscription_initial': 'subscription',
        'billing_cycle': 'billing',
        'grace_period': 'billing',
        'group_two_schools': 'groups',
        'payment_fedapay': 'payment',
        'payment_reminders': 'payment',
        'offline_mode': 'security',
        'ai_orion_atlas': 'ai',
        'security_data': 'security',
        'human_support': 'security'
      };

      const category = intentToCategoryMap[intent.id];
      if (category && faq[category]?.questions?.length > 0) {
        // Cas spécial : pricing → retourner un résumé structuré des plans Helm
        if (intent.id === 'pricing_general') {
          answer =
            "📌 **Grille Academia Helm — tout inclus, sans modules cachés**\n\n" +
            "• **HELM SEED** (1–150 élèves)\n" +
            "  - Souscription initiale : 75 000 FCFA (une seule fois)\n" +
            "  - Abonnement : 14 900 FCFA / mois ou 149 000 FCFA / an\n\n" +
            "• **HELM GROW** (151–400 élèves) — plan le plus choisi\n" +
            "  - Souscription initiale : 100 000 FCFA\n" +
            "  - Abonnement : 24 900 FCFA / mois ou 249 000 FCFA / an\n\n" +
            "• **HELM LEAD** (401–800 élèves)\n" +
            "  - Souscription initiale : 150 000 FCFA\n" +
            "  - Abonnement : 39 900 FCFA / mois ou 399 000 FCFA / an\n\n" +
            "• **HELM NETWORK** (2+ écoles / multi-campus)\n" +
            "  - Souscription initiale : 200 000 FCFA\n" +
            "  - Tarif sur devis selon le nombre de campus\n\n" +
            "Tous les plans incluent les 9 modules complets (élèves, finances, IA ORION, QHSE, communication, etc.).";
        } else {
          answer = faq[category].questions[0].a;
        }
      }
    }

    // 5. Si pas de réponse trouvée, recherche globale dans FAQ
    if (!answer) {
      for (const [categoryKey, categoryData] of Object.entries(faq)) {
        if (categoryData && categoryData.questions) {
          for (const item of categoryData.questions) {
            const normalizedQ = item.q.toLowerCase();
            if (
              normalizedQuestion.includes(normalizedQ) ||
              normalizedQ.includes(normalizedQuestion) ||
              normalizedQuestion.split(' ').some((word) => normalizedQ.includes(word) && word.length > 3)
            ) {
              answer = item.a;
              break;
            }
          }
          if (answer) break;
        }
      }
    }

    // 6. Déterminer le closing approprié selon l'intent
    if (intent) {
      switch (intent.id) {
        case 'greeting':
          // Pas de closing sur les salutations (déjà géré en amont, mais ajouté pour robustesse)
          closing = undefined;
          break;
        case 'free_trial':
          closing = closingResponses.trial_close;
          break;
        case 'subscription_initial':
          closing = closingResponses.activation_close;
          break;
        case 'pricing_general':
        case 'pricing_objection':
          closing = closingResponses.pricing_reassurance;
          break;
        case 'billing_cycle':
          closing = closingResponses.annual_push;
          break;
        case 'human_support':
          closing = closingResponses.human_handoff;
          break;
        default:
          // Closing par défaut pour les autres cas
          closing = closingResponses.trial_close;
      }
    } else {
      // Closing par défaut si pas d'intent détecté
      closing = closingResponses.trial_close;
    }

    return {
      answer: answer || `Très bonne question 😊\n\nJe comprends votre demande. Pourriez-vous être un peu plus précis ?\n\nVous pouvez aussi utiliser les boutons ci-dessous pour accéder rapidement aux informations.`,
      closing,
      intentId: intent?.id
    };
  };

  const findAnswer = (question: string): string | null => {
    const response = generateResponse(question);
    
    // Si c'est enterprise, retourner un signal spécial
    if (response.intentId === 'enterprise_quote') {
      return 'ENTERPRISE_QUOTE';
    }
    
    // Combiner la réponse et le closing
    if (response.answer && response.closing) {
      return `${response.answer}\n\n${response.closing}`;
    }
    
    if (response.answer) {
      return response.answer;
    }
    
    return null;
  };

  const handleQuickReply = (quickReply: QuickReply) => {
    setShowQuickReplies(false);
    setShowEnterpriseForm(false);
    setIsTyping(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: `${quickReply.emoji} ${quickReply.label}`,
      timestamp: new Date(),
    };

    // Utiliser le système de génération de réponse intelligent
    setTimeout(() => {
      const response = generateResponse(quickReply.label);
      
      let answer = response.answer;
      
      // Ajouter le closing si disponible
      if (response.closing) {
        answer = `${answer}\n\n${response.closing}`;
      }
      
      // Fallback si pas de réponse
      if (!answer) {
        const categoryData = faq[quickReply.category as keyof FAQData];
        if (categoryData && categoryData.questions && categoryData.questions.length > 0) {
          answer = categoryData.questions[0].a;
        } else if (quickReply.category === 'contact') {
          answer = closingResponses.human_handoff;
        } else if (quickReply.category === 'features') {
          answer = `📊 **Tous les modules sont inclus** dès le départ :

**Modules principaux** :
• Gestion académique (élèves, classes, notes)
• Gestion financière (paiements, factures)
• Communication (parents, enseignants)
• ORION : Assistant IA de direction
• ATLAS : Assistance guidée
• Mode offline/online
• Tableaux de bord
• Rapports et statistiques

**Aucun module payant supplémentaire**. Tout est inclus, sans option cachée, sans bridage.`;
        } else {
          answer = `Très bonne question 😊\n\nJe comprends votre demande sur "${quickReply.label}". Pourriez-vous être un peu plus précis ?`;
        }
        
        // Ajouter closing par défaut si pas déjà présent
        if (!answer.includes('Souhaitez-vous') && !answer.includes('Voulez-vous')) {
          answer = `${answer}\n\n${closingResponses.trial_close}`;
        }
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: answer,
        timestamp: new Date(),
      };
      setIsTyping(false);
      setMessages((prev) => [...prev, userMessage, botMessage]);
    }, 500);
  };

  const handleEnterpriseQuoteRequest = () => {
    setIsTyping(false);
    setShowEnterpriseForm(true);
    setShowQuickReplies(false);
    setFormStep('schoolCount');

    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'bot',
      content: `📄 Votre structure correspond à une offre personnalisée.
Souhaitez-vous demander un devis ?`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, botMessage]);
  };

  const handleEnterpriseFormSubmit = async () => {
    if (formStep === 'schoolCount') {
      if (!enterpriseForm.schoolCount || parseInt(enterpriseForm.schoolCount) < 3) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: '⚠️ Veuillez entrer un nombre d\'écoles valide (3 ou plus).',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        return;
      }
      setFormStep('promoterName');
      return;
    }

    if (formStep === 'promoterName') {
      if (!enterpriseForm.promoterName.trim()) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: '⚠️ Veuillez entrer le nom du promoteur.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        return;
      }
      setFormStep('phone');
      return;
    }

    if (formStep === 'phone') {
      if (!enterpriseForm.phone.trim()) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: '⚠️ Veuillez entrer un numéro de téléphone valide.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        return;
      }
      setFormStep('email');
      return;
    }

    if (formStep === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!enterpriseForm.email.trim() || !emailRegex.test(enterpriseForm.email)) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: '⚠️ Veuillez entrer une adresse email valide.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        return;
      }
      setFormStep('confirm');
      // Soumettre le formulaire
      await submitEnterpriseQuote();
      return;
    }
  };

  const submitEnterpriseQuote = async () => {
    try {
      // TODO: Appeler l'API backend pour créer l'entrée enterprise_quote
      // const response = await fetch('/api/enterprise-quote', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(enterpriseForm),
      // });

      // Pour l'instant, simulation
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: `✅ Merci. Un conseiller vous contactera rapidement.

**Récapitulatif de votre demande :**
• Nombre d'écoles : ${enterpriseForm.schoolCount}
• Promoteur : ${enterpriseForm.promoterName}
• Téléphone : ${enterpriseForm.phone}
• Email : ${enterpriseForm.email}

Nous vous recontacterons sous 24h ! 😊`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
      setShowEnterpriseForm(false);
      setEnterpriseForm({
        schoolCount: '',
        promoterName: '',
        phone: '',
        email: '',
      });
      setFormStep('schoolCount');
    } catch (error) {
      console.error('Error submitting enterprise quote:', error);
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: '❌ Une erreur est survenue. Veuillez réessayer ou nous contacter directement.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userQuestion = inputValue.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: userQuestion,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setShowQuickReplies(false);
    setIsTyping(true);

    setTimeout(async () => {
      // 1) Réponse dynamique via Anthropic (streaming si possible)
      const botId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: botId, type: 'bot', content: '', timestamp: new Date() },
      ]);

      let streamedContent = '';
      const streamedFinal = await streamDynamicSaraAnswer(userQuestion, (delta) => {
        streamedContent += delta;
        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, content: streamedContent } : m)),
        );
      });

      if (streamedFinal) {
        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, content: streamedFinal } : m)),
        );
        setIsTyping(false);
        return;
      }

      // 1bis) Fallback dyn non-stream (au cas où)
      const dynamic = await tryGenerateDynamicSaraAnswer(userQuestion);
      if (dynamic) {
        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, content: dynamic } : m)),
        );
        setIsTyping(false);
        return;
      }

      // 2) Fallback local (intents/FAQ)
      const answer = findAnswer(userQuestion);

      if (answer === 'ENTERPRISE_QUOTE') {
        setIsTyping(false);
        setMessages((prev) => prev.filter((m) => m.id !== botId));
        handleEnterpriseQuoteRequest();
        return;
      }

      const fallbackText =
        answer ||
        `Je comprends votre question. Pourriez-vous être plus précis ? 

Vous pouvez aussi utiliser les boutons ci-dessous pour accéder rapidement aux informations :
• 📌 Tarification & abonnements
• 🧪 Free trial (3 jours)
• 💳 Paiement & Fedapay
• 🏫 Groupes scolaires
• 📊 Fonctionnalités & modules
• 🤖 ORION & ATLAS (IA)
• 🔒 Sécurité & données
• 📞 Parler à un conseiller

Ou reformulez votre question, je ferai de mon mieux pour vous aider ! 😊`;
      setMessages((prev) =>
        prev.map((m) => (m.id === botId ? { ...m, content: fallbackText } : m)),
      );
      setIsTyping(false);
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showEnterpriseForm) {
        handleEnterpriseFormSubmit();
      } else {
        handleSendMessage();
      }
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 flex items-center justify-center group hover:bg-blue-700"
          aria-label="Ouvrir le chat de support"
        >
          <AppIcon name="messageCircle" size="dashboard" className="text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
        </button>
      )}

      {/* Widget de chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full md:w-80 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 max-w-[calc(100vw-3rem)] md:max-w-none">
          {/* Header - bg-blue-600 (couleur bleue du logo Academia Helm) */}
          <div className="bg-blue-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-white/10">
                <img 
                  src="/images/Chatbot Sara.png" 
                  alt="Sara - Assistant support" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Sara - Assistante Support Academia Helm</h3>
                <p className="text-xs text-white/80 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  En ligne
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                setShowEnterpriseForm(false);
                setFormStep('schoolCount');
              }}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors"
              aria-label="Fermer le chat"
            >
              <AppIcon name="close" size="submenu" className="text-white" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3',
                    message.type === 'user'
                      ? 'bg-gray-200 text-gray-900 border border-gray-300'
                      : 'bg-blue-600 text-white border border-blue-500'
                  )}
                >
                  <div className="whitespace-pre-wrap text-sm leading-relaxed [&_strong]:font-bold [&_strong]:text-inherit">
                    {renderMessageContent(message.content)}
                  </div>
                </div>
              </div>
            ))}

            {/* Indicateur de frappe (typing indicator) */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-blue-600 text-white border border-blue-500 rounded-2xl px-4 py-3 max-w-[80%]">
                  <div className="flex items-center gap-1">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span className="text-xs text-white/80 ml-2">Sara écrit...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Formulaire Enterprise Quote */}
            {showEnterpriseForm && (
              <div className="bg-white border-2 border-blue-600 rounded-2xl p-4 space-y-3">
                <p className="font-semibold text-sm text-blue-600 mb-2">📄 Demander un devis</p>
                
                {formStep === 'schoolCount' && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Nombre d'écoles (3 ou plus)</label>
                    <input
                      type="number"
                      min="3"
                      value={enterpriseForm.schoolCount}
                      onChange={(e) => setEnterpriseForm({ ...enterpriseForm, schoolCount: e.target.value })}
                      onKeyPress={handleKeyPress}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                      placeholder="Ex: 3, 5, 10..."
                      autoFocus
                    />
                  </div>
                )}

                {formStep === 'promoterName' && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Nom du promoteur</label>
                    <input
                      type="text"
                      value={enterpriseForm.promoterName}
                      onChange={(e) => setEnterpriseForm({ ...enterpriseForm, promoterName: e.target.value })}
                      onKeyPress={handleKeyPress}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                      placeholder="Votre nom complet"
                      autoFocus
                    />
                  </div>
                )}

                {formStep === 'phone' && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Téléphone / WhatsApp</label>
                    <input
                      type="tel"
                      value={enterpriseForm.phone}
                      onChange={(e) => setEnterpriseForm({ ...enterpriseForm, phone: e.target.value })}
                      onKeyPress={handleKeyPress}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                      placeholder="+225 XX XX XX XX XX"
                      autoFocus
                    />
                  </div>
                )}

                {formStep === 'email' && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={enterpriseForm.email}
                      onChange={(e) => setEnterpriseForm({ ...enterpriseForm, email: e.target.value })}
                      onKeyPress={handleKeyPress}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                      placeholder="votre@email.com"
                      autoFocus
                    />
                  </div>
                )}

                <button
                  onClick={handleEnterpriseFormSubmit}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  {formStep === 'email' ? 'Envoyer la demande' : 'Suivant'}
                </button>
              </div>
            )}

            {/* Quick Replies */}
            {showQuickReplies && !showEnterpriseForm && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-2">Questions rapides :</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_REPLIES.map((reply) => (
                    <button
                      key={reply.id}
                      onClick={() => handleQuickReply(reply)}
                      className="text-left px-3 py-2 bg-white border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-600 transition-colors text-xs"
                    >
                      <span className="mr-1">{reply.emoji}</span>
                      {reply.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {!showEnterpriseForm && (
            <div className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
              {/* Bouton pour réafficher les questions rapides */}
              {!showQuickReplies && messages.length > 1 && (
                <button
                  onClick={() => setShowQuickReplies(true)}
                  className="w-full mb-2 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors text-xs font-medium flex items-center justify-center gap-2"
                >
                  <AppIcon name="messageCircle" size="submenu" className="text-blue-600" />
                  Voir les questions rapides
                </button>
              )}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Tapez votre question..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className="w-10 h-10 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  aria-label="Envoyer le message"
                >
                  <AppIcon name="send" size="submenu" className="text-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
