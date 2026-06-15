/**
 * ============================================================================
 * useVoicePlayback — Hook de lecture audio pour SARA (TTS)
 * ============================================================================
 *
 * Gère la lecture des réponses vocales de SARA :
 *   - playAudio(base64) : lire un audio base64
 *   - stopAudio : arrêter la lecture
 *   - isPlaying : état de lecture
 *   - currentAudioIndex : index du chunk en cours de lecture
 *
 * Supporte le chunking : plusieurs chunks audio joués en séquence.
 * ============================================================================
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoicePlaybackReturn {
  isPlaying: boolean;
  isLoading: boolean;
  currentChunkIndex: number;
  totalChunks: number;
  playAudio: (audioBase64: string, format?: string) => void;
  playAudioChunks: (chunks: string[], format?: string) => void;
  stopAudio: () => void;
  error: string | null;
}

export function useVoicePlayback(): UseVoicePlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksQueueRef = useRef<string[]>([]);
  const currentFormatRef = useRef<string>('mp3');
  const isPlayingRef = useRef(false);

  // ─── CLEANUP ──────────────────────────────────────────────────────────

  const stopAudio = useCallback(() => {
    isPlayingRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    chunksQueueRef.current = [];
    setIsPlaying(false);
    setCurrentChunkIndex(0);
    setTotalChunks(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ─── PLAY NEXT CHUNK ──────────────────────────────────────────────────

  const playNextChunk = useCallback(() => {
    if (!isPlayingRef.current || chunksQueueRef.current.length === 0) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }

    const chunk = chunksQueueRef.current.shift();
    if (!chunk) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }

    setCurrentChunkIndex((prev) => prev + 1);

    const format = currentFormatRef.current;
    const mimeType = format === 'mp3' ? 'audio/mpeg' : format === 'wav' ? 'audio/wav' : 'audio/mpeg';
    const audio = new Audio(`data:${mimeType};base64,${chunk}`);
    audioRef.current = audio;

    audio.onended = () => {
      playNextChunk();
    };

    audio.onerror = () => {
      setError('Erreur de lecture audio');
      playNextChunk(); // Passer au chunk suivant même en cas d'erreur
    };

    audio.play().catch(() => {
      setError('Lecture automatique bloquée par le navigateur');
      setIsPlaying(false);
      isPlayingRef.current = false;
    });
  }, []);

  // ─── PLAY SINGLE AUDIO ────────────────────────────────────────────────

  const playAudio = useCallback(
    (audioBase64: string, format: string = 'mp3') => {
      // Arrêter l'audio en cours
      stopAudio();

      if (!audioBase64) return;

      setIsLoading(true);
      setError(null);

      const mimeType = format === 'mp3' ? 'audio/mpeg' : format === 'wav' ? 'audio/wav' : 'audio/mpeg';
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audioRef.current = audio;
      isPlayingRef.current = true;

      audio.oncanplaythrough = () => {
        setIsLoading(false);
        setIsPlaying(true);
        setTotalChunks(1);
        setCurrentChunkIndex(0);

        audio.play().catch(() => {
          setError('Lecture automatique bloquée par le navigateur');
          setIsPlaying(false);
          isPlayingRef.current = false;
        });
      };

      audio.onended = () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
      };

      audio.onerror = () => {
        setIsLoading(false);
        setError('Erreur de lecture audio');
        setIsPlaying(false);
        isPlayingRef.current = false;
      };

      // Précharger
      audio.load();
    },
    [stopAudio],
  );

  // ─── PLAY MULTIPLE CHUNKS ─────────────────────────────────────────────

  const playAudioChunks = useCallback(
    (chunks: string[], format: string = 'mp3') => {
      // Arrêter l'audio en cours
      stopAudio();

      if (chunks.length === 0) return;

      setIsLoading(true);
      setError(null);
      setTotalChunks(chunks.length);
      setCurrentChunkIndex(0);

      currentFormatRef.current = format;
      isPlayingRef.current = true;

      // Mettre tous les chunks sauf le premier dans la queue
      chunksQueueRef.current = chunks.slice(1);

      // Jouer le premier chunk
      const firstChunk = chunks[0];
      const mimeType = format === 'mp3' ? 'audio/mpeg' : format === 'wav' ? 'audio/wav' : 'audio/mpeg';
      const audio = new Audio(`data:${mimeType};base64,${firstChunk}`);
      audioRef.current = audio;

      audio.oncanplaythrough = () => {
        setIsLoading(false);
        setIsPlaying(true);

        audio.play().catch(() => {
          setError('Lecture automatique bloquée par le navigateur');
          setIsPlaying(false);
          isPlayingRef.current = false;
        });
      };

      audio.onended = () => {
        playNextChunk();
      };

      audio.onerror = () => {
        setError('Erreur de lecture audio');
        playNextChunk();
      };

      audio.load();
    },
    [stopAudio, playNextChunk],
  );

  return {
    isPlaying,
    isLoading,
    currentChunkIndex,
    totalChunks,
    playAudio,
    playAudioChunks,
    stopAudio,
    error,
  };
}
