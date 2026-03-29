'use client';

export const MOTION_DURATIONS = {
  instant: 0,
  fast: 0.16,
  normal: 0.22,
  slow: 0.32,
} as const;

export function getMotionDuration(reduced: boolean, key: keyof typeof MOTION_DURATIONS) {
  return reduced ? MOTION_DURATIONS.instant : MOTION_DURATIONS[key];
}

export function getFadeMotion(reduced: boolean) {
  return {
    initial: { opacity: reduced ? 1 : 0 },
    animate: { opacity: 1 },
    exit: { opacity: reduced ? 1 : 0 },
    transition: { duration: getMotionDuration(reduced, 'normal'), ease: 'easeOut' as const },
  };
}

export function getPageSlideMotion(reduced: boolean, yIn = 10, yOut = -6) {
  return {
    initial: { opacity: reduced ? 1 : 0, y: reduced ? 0 : yIn },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: reduced ? 1 : 0, y: reduced ? 0 : yOut },
    transition: { duration: getMotionDuration(reduced, 'normal'), ease: 'easeOut' as const },
  };
}

export function getModalMotion(reduced: boolean) {
  return {
    initial: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 18, scale: reduced ? 1 : 0.99 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.995 },
    transition: { duration: getMotionDuration(reduced, 'normal'), ease: 'easeOut' as const },
  };
}

