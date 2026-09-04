'use client';

/**
 * ============================================================================
 * HELM CONNECT V2.6 — Categorized Attachment Menu
 * ============================================================================
 * 
 * Menu catégorisé style Telegram/WhatsApp pour joindre des fichiers :
 *   - 📷 Photos & Vidéos  →  ouvre la galerie du device
 *   - 📄 Documents        →  ouvre le sélecteur de fichiers (PDF, Word, Excel...)
 *   - 🎤 Audio            →  enregistre ou choisit un audio
 *   - 📊 Sondage          →  ouvre la création de sondage (PollModal)
 *   - 📍 Localisation     →  partage de position (V2.7)
 *   - 👤 Contact          →  partage de contact (V2.7)
 * 
 * ⭐ Design : grilles d'icônes circulaires colorées comme Telegram
 *    - Photos : violet
 *    - Documents : bleu
 *    - Sondage : vert
 *    - Audio : orange
 *    - Localisation : cyan
 *    - Contact : rose
 * ============================================================================
 */

import React, { useState, useRef } from 'react';
import {
  X, Image as ImageIcon, FileText, BarChart3, Mic, Clock,
  MapPin, User, Camera, Film, Music,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AttachmentOption {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;        // bg color
  iconColor: string;    // icon color
  action: () => void;
}

interface CategorizedAttachmentMenuProps {
  currentUserId: string;
  conversationId: string | null;
  onClose: () => void;
  onSendFile: (file: File, type: 'IMAGE' | 'DOCUMENT' | 'AUDIO') => Promise<void>;
  onOpenPoll: () => void;
  /** ⭐ V6 — ouvre le modal « Programmer le message » (mobile-friendly). */
  onOpenSchedule?: () => void;
}

export default function CategorizedAttachmentMenu({
  currentUserId,
  conversationId,
  onClose,
  onSendFile,
  onOpenPoll,
  onOpenSchedule,
}: CategorizedAttachmentMenuProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading('image');
    try {
      await onSendFile(file, 'IMAGE');
      onClose();
    } catch (err: any) {
      toast.error(`Échec envoi image : ${err.message}`);
    } finally {
      setLoading(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Videos are sent as DOCUMENT for now (V2.7 will add VIDEO type)
    setLoading('video');
    try {
      await onSendFile(file, 'DOCUMENT');
      onClose();
    } catch (err: any) {
      toast.error(`Échec envoi vidéo : ${err.message}`);
    } finally {
      setLoading(null);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading('document');
    try {
      await onSendFile(file, 'DOCUMENT');
      onClose();
    } catch (err: any) {
      toast.error(`Échec envoi document : ${err.message}`);
    } finally {
      setLoading(null);
      if (documentInputRef.current) documentInputRef.current.value = '';
    }
  };

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading('audio');
    try {
      await onSendFile(file, 'AUDIO');
      onClose();
    } catch (err: any) {
      toast.error(`Échec envoi audio : ${err.message}`);
    } finally {
      setLoading(null);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  // Hidden file inputs (each accepts the appropriate MIME type)
  const hiddenInputs = (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideoSelect}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.md,.json,.xml"
        className="hidden"
        onChange={handleDocumentSelect}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleAudioSelect}
      />
    </>
  );

  const options: AttachmentOption[] = [
    {
      key: 'gallery',
      label: 'Photos',
      description: 'Galerie',
      icon: <ImageIcon className="w-6 h-6" />,
      color: 'bg-violet-500',
      iconColor: 'text-white',
      action: () => imageInputRef.current?.click(),
    },
    {
      key: 'camera',
      label: 'Caméra',
      description: 'Prendre une photo',
      icon: <Camera className="w-6 h-6" />,
      color: 'bg-pink-500',
      iconColor: 'text-white',
      action: () => {
        // Open camera (use input capture attribute via the image input with capture)
        if (imageInputRef.current) {
          imageInputRef.current.setAttribute('capture', 'environment');
          imageInputRef.current.click();
          // Remove capture after — so next time it's gallery again
          setTimeout(() => imageInputRef.current?.removeAttribute('capture'), 500);
        }
      },
    },
    {
      key: 'video',
      label: 'Vidéos',
      description: 'Galerie',
      icon: <Film className="w-6 h-6" />,
      color: 'bg-rose-500',
      iconColor: 'text-white',
      action: () => videoInputRef.current?.click(),
    },
    {
      key: 'document',
      label: 'Documents',
      description: 'PDF, Word, Excel...',
      icon: <FileText className="w-6 h-6" />,
      color: 'bg-[#1677FF]',
      iconColor: 'text-white',
      action: () => documentInputRef.current?.click(),
    },
    {
      key: 'audio',
      label: 'Audio',
      description: 'Fichier audio',
      icon: <Music className="w-6 h-6" />,
      color: 'bg-amber-500',
      iconColor: 'text-white',
      action: () => audioInputRef.current?.click(),
    },
    {
      key: 'poll',
      label: 'Sondage',
      description: 'Créer un sondage',
      icon: <BarChart3 className="w-6 h-6" />,
      color: 'bg-emerald-500',
      iconColor: 'text-white',
      action: () => {
        onClose();
        onOpenPoll();
      },
    },
    {
      key: 'schedule',
      label: 'Programmer',
      description: 'Envoyer plus tard',
      icon: <Clock className="w-6 h-6" />,
      color: 'bg-[#CFA63A]',
      iconColor: 'text-white',
      action: () => {
        onClose();
        onOpenSchedule?.();
      },
    },
    {
      key: 'location',
      label: 'Localisation',
      description: 'Partager position',
      icon: <MapPin className="w-6 h-6" />,
      color: 'bg-cyan-500',
      iconColor: 'text-white',
      action: () => {
        toast.info('Partage de localisation — V2.7');
      },
    },
    {
      key: 'contact',
      label: 'Contact',
      description: 'Partager un contact',
      icon: <User className="w-6 h-6" />,
      color: 'bg-fuchsia-500',
      iconColor: 'text-white',
      action: () => {
        toast.info('Partage de contact — V2.7');
      },
    },
  ];

  return (
    <>
      {hiddenInputs}
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Menu panel */}
      <div className="fixed bottom-0 left-0 right-0 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl z-50 animate-slide-up">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Joindre un fichier</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        {/* Grid of options */}
        <div className="grid grid-cols-4 gap-3 p-4">
          {options.map(opt => (
            <button
              key={opt.key}
              onClick={opt.action}
              disabled={loading !== null}
              className="flex flex-col items-center gap-2 p-2 hover:bg-slate-50 rounded-xl disabled:opacity-50"
            >
              <div className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center',
                opt.color,
                loading === opt.key && 'animate-pulse'
              )}>
                {loading === opt.key ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  opt.icon
                )}
              </div>
              <span className="text-xs font-semibold text-slate-700 text-center">
                {opt.label}
              </span>
            </button>
          ))}
        </div>
        {/* Footer note */}
        <div className="px-4 pb-4 -mt-2">
          <p className="text-[10px] text-slate-400 text-center">
            Taille max : 50 MB · Chiffrement TLS
          </p>
        </div>
      </div>
    </>
  );
}
