'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  thumbnailUrl?: string;
  title?: string;
}

export default function VideoPlayerModal({
  isOpen,
  onClose,
  videoUrl,
  thumbnailUrl,
  title = 'Présentation Academia Helm',
}: VideoPlayerModalProps) {
  const handlePlay = () => {
    // Pour le moment, on ne lance pas la vidéo
    // La vidéo sera activée plus tard
    console.log('Bouton play cliqué - La vidéo sera activée prochainement');
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="video-modal-title"
    >
      <div
        className={cn(
          'relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl',
          'animate-in zoom-in-95 duration-300',
          'overflow-hidden'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-900 to-blue-800">
          <h2
            id="video-modal-title"
            className="text-xl font-bold text-white flex items-center gap-2"
          >
            <AppIcon name="playCircle" size="menu" className="text-white" />
            {title}
          </h2>
          <button
            onClick={onClose}
            className={cn(
              'p-2 rounded-lg text-white hover:bg-white/20',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-white/50'
            )}
            aria-label="Fermer le lecteur vidéo"
          >
            <AppIcon name="close" size="menu" className="text-white" />
          </button>
        </div>

        {/* Video Player - Only Thumbnail and Play Button for now */}
        <div className="relative bg-black aspect-video group overflow-hidden">
          {/* Thumbnail with Play Button */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 to-blue-800/90">
            {thumbnailUrl ? (
              <div className="relative w-full h-full">
                <Image
                  src={encodeURI(thumbnailUrl)}
                  alt={title}
                  fill
                  className="object-cover"
                  priority
                  unoptimized
                />
                <div className="absolute inset-0 bg-black/30" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-blue-800" />
            )}
            
            {/* Play Button - Centered absolutely */}
            <button
              onClick={handlePlay}
              className={cn(
                "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
                "z-20 group/play",
                "flex items-center justify-center",
                "w-24 h-24 md:w-28 md:h-28",
                "bg-white/95 hover:bg-white rounded-full",
                "shadow-2xl hover:shadow-3xl",
                "transition-all duration-300",
                "hover:scale-110 active:scale-95",
                "focus:outline-none focus:ring-4 focus:ring-white/50"
              )}
              aria-label="Lire la vidéo"
            >
              {/* Play Icon */}
              <div className="relative ml-2">
                <AppIcon 
                  name="playCircle" 
                  size={40} 
                  className="text-blue-900 group-hover/play:text-blue-700 transition-colors" 
                />
              </div>
              
              {/* Ripple Effect */}
              <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-75" />
            </button>

            {/* Title Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10">
              <h3 className="text-white text-lg md:text-xl font-semibold text-center">
                {title}
              </h3>
              <p className="text-white/80 text-sm text-center mt-1">
                Cliquez pour lancer la vidéo
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            Découvrez comment Academia Helm transforme la gestion scolaire
          </p>
        </div>
      </div>
    </div>
  );
}

