/**
 * Helper pour jouer le son de notification.
 *
 * - Charge le fichier /sounds/notification.wav (généré côté serveur)
 * - Respecte la préférence utilisateur (localStorage 'notification-sound-muted')
 * - Évite les erreurs d'autoplay (catch silently)
 * - Singleton : une seule instance Audio réutilisée
 *
 * Usage :
 *   import { playNotificationSound, toggleSoundMute, isSoundMuted } from '@/lib/sound/play-notification-sound';
 *   playNotificationSound();  // joue si non muté
 */

let audio: HTMLAudioElement | null = null;

const SOUND_PATH = '/sounds/notification.wav';
const MUTE_KEY = 'notification-sound-muted';

/** Vérifie si le son est muté par l'utilisateur. */
export function isSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Bascule mute on/off. Retourne le nouvel état (true = muté). */
export function toggleSoundMute(): boolean {
  const newMuted = !isSoundMuted();
  try {
    localStorage.setItem(MUTE_KEY, newMuted ? '1' : '0');
  } catch {
    /* ignore */
  }
  return newMuted;
}

/**
 * Joue le son de notification.
 * - Ne fait rien si muté
 * - Ne fait rien côté serveur (SSR safe)
 * - Catch les erreurs d'autoplay silencieusement
 */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return;
  if (isSoundMuted()) return;

  try {
    if (!audio) {
      audio = new Audio(SOUND_PATH);
      audio.volume = 0.6;
    }
    // Rebobiner pour permettre de rejouer rapidement
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay bloqué par le navigateur — ignore
        // Le son sera joué au prochain clic utilisateur
      });
    }
  } catch {
    // Ignore
  }
}
