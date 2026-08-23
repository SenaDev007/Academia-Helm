/**
 * ============================================================================
 * HELM CONNECT — Background watermark pattern
 * ============================================================================
 * 
 * Creates a subtle, beautiful background pattern like WhatsApp's doodle 
 * background, but with Helm Connect branding :
 *   - Academia Helm logo (graduation cap)
 *   - Speech bubbles (chat)
 *   - Megaphone (annonces)
 *   - Phone (calls)
 *   - Video (calls)
 *   - Paperclip (attachments)
 *   - Bell (notifications)
 * 
 * The pattern is rendered as an SVG data URL, with the Azure color tint.
 * It's applied to the conversation view background.
 * 
 * ⭐ Two variants :
 *   - Light mode : pattern on #F5F7FA background (subtle, low opacity)
 *   - Dark mode : pattern on #0B1220 background (cyan-tinted)
 * ============================================================================
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface HelmWatermarkProps {
  className?: string;
  /** Override the base color (defaults to Azure light) */
  color?: string;
  /** Opacity of the pattern (0-1). Default: 0.04 for light, 0.08 for dark */
  opacity?: number;
  /** Use dark mode variant */
  dark?: boolean;
}

/**
 * Generates the SVG pattern as a data URL.
 * The pattern contains 12 icons spread across a 200x200 tile that repeats.
 */
function generateWatermarkSvg(color: string, opacity: number): string {
  // ⭐ The SVG contains multiple communication icons positioned in a tile
  // All paths use stroke (not fill) so they look like outline icons
  // The icons are: speech bubble, megaphone, phone, video, paperclip, bell,
  // graduation cap (Academia Helm), heart, send, image, file, microphone
  
  // Each icon is rendered with a transform="translate(x, y) scale(s)"
  // Use single quotes inside the SVG, escaped for data URL
  
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'>
    <g fill='none' stroke='${color}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' opacity='${opacity}'>
      <!-- Top-left : Speech bubble (Helm Connect logo) -->
      <g transform='translate(20, 20) scale(0.9)'>
        <path d='M3 4 h18 a3 3 0 0 1 3 3 v8 a3 3 0 0 1 -3 3 h-9 l-5 4 v-4 h-4 a3 3 0 0 1 -3 -3 v-8 a3 3 0 0 1 3 -3 z'/>
        <circle cx='8' cy='11' r='0.8' fill='${color}'/>
        <circle cx='12' cy='11' r='0.8' fill='${color}'/>
        <circle cx='16' cy='11' r='0.8' fill='${color}'/>
      </g>
      <!-- Top-center : Megaphone (annonces) -->
      <g transform='translate(110, 25) scale(0.8)'>
        <path d='M3 11 l13 -5 v12 l-13 -5 v3 h-3 v-3 z'/>
        <path d='M3 11 v6 h3'/>
        <line x1='19' y1='9' x2='21' y2='7'/>
        <line x1='20' y1='13' x2='22' y2='14'/>
      </g>
      <!-- Top-right : Phone (calls) -->
      <g transform='translate(195, 25) scale(0.7)'>
        <path d='M22 16.92v3a2 2 0 0 1 -2.18 2 19.79 19.79 0 0 1 -8.63 -3.07 19.5 19.5 0 0 1 -6 -6 19.79 19.79 0 0 1 -3.07 -8.67 A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1 -.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27 -1.27a2 2 0 0 1 2.11 -.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z'/>
      </g>
      <!-- Middle-left : Video (calls) -->
      <g transform='translate(30, 105) scale(0.8)'>
        <polygon points='23 7 16 12 23 17 23 7'/>
        <rect x='1' y='5' width='15' height='14' rx='2' ry='2'/>
      </g>
      <!-- Center : Academia Helm logo (graduation cap) -->
      <g transform='translate(95, 100) scale(1.0)'>
        <path d='M12 3 L1 9 L12 15 L23 9 L12 3 Z'/>
        <path d='M5 12 v5 c0 1 3 3 7 3 s7 -2 7 -3 v-5'/>
        <line x1='23' y1='9' x2='23' y2='14'/>
      </g>
      <!-- Middle-right : Paperclip (attachments) -->
      <g transform='translate(195, 105) scale(0.8)'>
        <path d='M21.44 11.05l-9.19 9.19a6 6 0 0 1 -8.49 -8.49l9.19 -9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1 -2.83 -2.83l8.49 -8.48'/>
      </g>
      <!-- Bottom-left : Bell (notifications) -->
      <g transform='translate(20, 185) scale(0.8)'>
        <path d='M18 8A6 6 0 0 0 6 8c0 7 -3 9 -3 9h18s-3 -2 -3 -9'/>
        <path d='M13.73 21a2 2 0 0 1 -3.46 0'/>
      </g>
      <!-- Bottom-center : Microphone (voice messages) -->
      <g transform='translate(105, 195) scale(0.8)'>
        <path d='M12 1a3 3 0 0 0 -3 3 v8 a3 3 0 0 0 6 0 v-8 a3 3 0 0 0 -3 -3 z'/>
        <path d='M19 10 v2 a7 7 0 0 1 -14 0 v-2'/>
        <line x1='12' y1='19' x2='12' y2='23'/>
        <line x1='8' y1='23' x2='16' y2='23'/>
      </g>
      <!-- Bottom-right : Heart (reactions) -->
      <g transform='translate(195, 195) scale(0.7)'>
        <path d='M20.84 4.61a5.5 5.5 0 0 0 -7.78 0 L12 5.67 l-1.06 -1.06a5.5 5.5 0 0 0 -7.78 7.78l1.06 1.06L12 21.23l7.78 -7.78 1.06 -1.06a5.5 5.5 0 0 0 0 -7.78z'/>
      </g>
    </g>
  </svg>`;
  
  // URL-encode the SVG for use as data URL
  // Use encodeURIComponent which handles all special chars properly
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function HelmWatermark({
  className,
  color,
  opacity,
  dark = false,
}: HelmWatermarkProps) {
  const patternColor = color || (dark ? '#3B9EFF' : '#1677FF');
  const patternOpacity = opacity ?? (dark ? 0.08 : 0.05);
  const bgColor = dark ? '#0B1220' : '#F5F7FA';
  
  const svgUrl = generateWatermarkSvg(patternColor, patternOpacity);
  
  return (
    <div
      className={cn('absolute inset-0 pointer-events-none', className)}
      style={{
        backgroundColor: bgColor,
        backgroundImage: `url("${svgUrl}")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '240px 240px',
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Returns the SVG data URL for use in CSS `backgroundImage`.
 * Useful when you can't use the React component (e.g. in a className string).
 */
export function getHelmWatermarkUrl(opts?: { color?: string; opacity?: number; dark?: boolean }): string {
  const color = opts?.color || (opts?.dark ? '#3B9EFF' : '#1677FF');
  const opacity = opts?.opacity ?? (opts?.dark ? 0.08 : 0.05);
  return generateWatermarkSvg(color, opacity);
}

/**
 * Returns the background CSS properties for the Helm watermark.
 * Use as: <div style={getHelmWatermarkStyle()} >
 */
export function getHelmWatermarkStyle(opts?: { color?: string; opacity?: number; dark?: boolean }): React.CSSProperties {
  const color = opts?.color || (opts?.dark ? '#3B9EFF' : '#1677FF');
  const opacity = opts?.opacity ?? (opts?.dark ? 0.08 : 0.05);
  const bgColor = opts?.dark ? '#0B1220' : '#F5F7FA';
  return {
    backgroundColor: bgColor,
    backgroundImage: `url("${generateWatermarkSvg(color, opacity)}")`,
    backgroundRepeat: 'repeat',
    backgroundSize: '240px 240px',
  };
}
