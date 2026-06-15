/**
 * ============================================================================
 * useVoiceRecorder — Hook d'enregistrement vocal pour SARA
 * ============================================================================
 *
 * Utilise l'API MediaRecorder du navigateur pour capturer l'audio du micro.
 * Retourne :
 *   - isRecording : état d'enregistrement
 *   - startRecording : démarrer la capture
 *   - stopRecording : arrêter et obtenir le base64
 *   - audioLevel : niveau sonore actuel (pour l'animation)
 *   - error : erreur éventuelle
 *
 * Format de sortie : audio/webm (ou audio/mp4 sur Safari)
 * ============================================================================
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  isInitializing: boolean;
  audioLevel: number; // 0-1 pour l'animation du waveform
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>; // Retourne base64 audio
  cancelRecording: () => void;
  error: string | null;
  duration: number; // Durée en secondes
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ─── CLEANUP ──────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    // Arrêter l'animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Arrêter le timer de durée
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Fermer l'AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Arrêter le stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Nettoyer le MediaRecorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }

    chunksRef.current = [];
    setAudioLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // ─── ANALYSE AUDIO LEVEL ──────────────────────────────────────────────

  const startAudioAnalysis = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalizedLevel = Math.min(average / 128, 1); // Normaliser 0-1
        setAudioLevel(normalizedLevel);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch {
      // AudioContext non disponible, on continue sans analyse
    }
  }, []);

  // ─── START RECORDING ──────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setError(null);
    setIsInitializing(true);

    try {
      // Vérifier le support du navigateur
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Votre navigateur ne supporte pas l\'enregistrement vocal');
      }

      if (!window.MediaRecorder) {
        throw new Error('Votre navigateur ne supporte pas l\'API MediaRecorder');
      }

      // Demander la permission du micro
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000, // Optimal pour ASR
        },
      });

      streamRef.current = stream;

      // Choisir le format supporté
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const options: MediaRecorderOptions = {};
      if (mimeType) options.mimeType = mimeType;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Collecter les chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Démarrer l'enregistrement (chunks toutes les 500ms)
      mediaRecorder.start(500);
      setIsRecording(true);
      setIsInitializing(false);

      // Analyser le niveau audio pour l'animation
      startAudioAnalysis(stream);

      // Timer de durée
      startTimeRef.current = Date.now();
      setDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      // Auto-stop après 60 secondes (limite ASR)
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          // L'auto-stop sera géré par le composant
        }
      }, 60000);
    } catch (err: any) {
      setIsInitializing(false);
      cleanup();

      if (err.name === 'NotAllowedError') {
        setError('Accès au microphone refusé. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.');
      } else if (err.name === 'NotFoundError') {
        setError('Aucun microphone détecté. Veuillez connecter un microphone.');
      } else {
        setError(err.message || 'Erreur lors de l\'enregistrement vocal');
      }
    }
  }, [cleanup, startAudioAnalysis]);

  // ─── STOP RECORDING ───────────────────────────────────────────────────

  const stopRecording = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        setIsRecording(false);
        cleanup();
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);

        if (chunksRef.current.length === 0) {
          cleanup();
          resolve(null);
          return;
        }

        try {
          // Créer le blob audio
          const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: mimeType });

          // Convertir en base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            // Retirer le préfixe data:audio/...;base64,
            const base64Data = base64.split(',')[1] || base64;
            cleanup();
            resolve(base64Data);
          };
          reader.onerror = () => {
            cleanup();
            resolve(null);
          };
          reader.readAsDataURL(blob);
        } catch {
          cleanup();
          resolve(null);
        }
      };

      mediaRecorderRef.current.stop();
    });
  }, [cleanup]);

  // ─── CANCEL RECORDING ─────────────────────────────────────────────────

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.onstop = () => {};
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    cleanup();
  }, [cleanup]);

  return {
    isRecording,
    isInitializing,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
    duration,
  };
}
