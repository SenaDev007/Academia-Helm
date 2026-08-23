/**
 * ============================================================================
 * HELM CONNECT — Background watermark pattern
 * ============================================================================
 *
 * Creates a subtle, beautiful background pattern like WhatsApp's doodle
 * background, but with Helm Connect branding :
 *   - Academia Helm official SVG crest (centered, filled) — inlined from
 *     /public/images/logo-Academia-Helm.svg (the same logo used on the
 *     /portal page inside the Benin map school pins)
 *   - Speech bubbles (chat)
 *   - Megaphone (annonces)
 *   - Phone (calls)
 *   - Video (calls)
 *   - Paperclip (attachments)
 *   - Bell (notifications)
 *   - Microphone (voice messages)
 *   - Heart (reactions)
 *
 * The pattern is rendered as an SVG data URL, with the Azure color tint.
 * It's applied to the conversation view background AND the empty welcome screen.
 *
 * ⭐ Two variants :
 *   - Light mode : pattern on #F5F7FA background (opacity 0.08 — bumped for visibility)
 *   - Dark mode : pattern on #0B1220 background (opacity 0.12)
 * ============================================================================
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface HelmWatermarkProps {
  className?: string;
  /** Override the base color (defaults to Azure light) */
  color?: string;
  /** Opacity of the pattern (0-1). Default: 0.08 for light, 0.12 for dark */
  opacity?: number;
  /** Use dark mode variant */
  dark?: boolean;
}

/**
 * Generates the SVG pattern as a data URL.
 * The pattern contains 8 communication icons + the official Academia Helm
 * crest, all spread across a 240x240 tile that repeats.
 */
function generateWatermarkSvg(color: string, opacity: number): string {
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
    <!-- ⭐ Academia Helm official SVG logo (centered, filled)
         Replaces the generic graduation cap / stylized shield I had before.
         The 4 original paths are inlined with their original Y-flip transform,
         wrapped in a parent translate+scale to fit ~40px in the 240x240 tile.
         Since the tile repeats infinitely, the logo appears multiple times
         across the conversation view, exactly like the other icons. -->
    <g fill='${color}' stroke='none' opacity='${opacity}'>
      <g transform='translate(100, 100) scale(0.039)'>
        <g transform='translate(0, 1024) scale(0.1, -0.1)'>
      <path d='M5090 9961 c0 -66 -119 -465 -216 -726 -99 -264 -121 -319 -136 -328 -37 -21 -333 -155 -473 -215 -38 -16 -153 -66 -255 -111 -102 -45 -201 -89 -220 -97 -19 -9 -73 -33 -120 -54 -47 -21 -272 -122 -500 -224 -228 -101 -428 -191 -445 -200 -16 -9 -33 -16 -37 -16 -3 0 -62 -26 -130 -59 -69 -32 -135 -62 -147 -66 -12 -4 -53 -22 -89 -40 -37 -18 -83 -38 -104 -45 l-36 -13 -6 -136 c-4 -75 -11 -206 -16 -291 -6 -85 -15 -231 -20 -325 -34 -576 -116 -1516 -174 -2010 -65 -544 -131 -1029 -177 -1300 -36 -214 -150 -767 -209 -1017 -22 -92 -40 -172 -40 -178 0 -27 301 -318 574 -554 653 -567 1549 -1124 2494 -1550 202 -91 479 -206 496 -206 60 0 918 399 1271 592 403 219 930 551 1193 752 52 39 104 78 116 86 208 142 662 539 918 806 l67 70 -33 134 c-47 190 -110 480 -141 645 -15 77 -33 172 -40 210 -43 217 -99 573 -140 895 -13 107 -30 233 -36 280 -96 749 -198 1955 -239 2820 -6 135 -13 251 -15 258 -5 13 -63 41 -365 177 -102 46 -221 100 -265 120 -44 20 -100 46 -125 57 -25 11 -63 28 -85 38 -22 10 -103 46 -180 80 -77 34 -187 83 -245 109 -58 27 -148 66 -200 89 -260 112 -870 383 -1011 449 l-96 45 -71 182 c-95 240 -191 534 -238 729 -35 142 -54 191 -54 138z m25 -398 c13 -80 50 -225 102 -398 30 -99 66 -219 80 -267 l26 -86 81 -36 c45 -19 203 -92 351 -161 149 -70 342 -160 430 -200 135 -61 407 -186 625 -287 30 -14 114 -53 185 -85 221 -102 235 -109 410 -190 94 -44 232 -108 308 -144 l137 -63 0 -61 c0 -53 14 -285 50 -845 22 -341 130 -1565 145 -1640 3 -14 12 -90 20 -170 25 -227 90 -736 120 -930 8 -52 24 -158 35 -235 35 -235 81 -481 155 -830 14 -66 38 -178 53 -249 l27 -129 -130 -124 c-557 -532 -1198 -989 -2010 -1431 -289 -158 -561 -291 -925 -452 l-285 -127 -100 42 c-917 385 -1782 878 -2469 1405 -247 190 -455 368 -653 561 l-133 129 10 47 c5 27 21 100 35 163 114 505 239 1248 300 1780 8 74 22 191 30 260 53 447 68 590 95 885 46 518 87 1059 125 1670 9 132 16 250 18 263 2 24 -16 15 897 437 135 62 283 131 330 153 116 55 346 161 585 272 110 50 256 118 325 150 69 32 150 69 180 83 30 13 80 36 110 49 30 14 62 27 70 30 25 9 178 508 217 709 10 49 21 89 25 89 4 0 10 -17 13 -37z'/>
      <path d='M4740 8415 c-30 -30 -104 -100 -165 -157 -104 -96 -289 -270 -525 -493 -58 -55 -154 -145 -213 -199 -96 -89 -107 -103 -107 -134 0 -18 -9 -89 -20 -156 -11 -66 -58 -384 -105 -706 -47 -322 -94 -643 -105 -715 -11 -71 -31 -211 -45 -310 -13 -99 -41 -290 -60 -425 -20 -135 -49 -337 -65 -450 -16 -113 -36 -252 -45 -310 -9 -58 -43 -294 -76 -525 -33 -231 -105 -732 -159 -1112 -55 -381 -100 -702 -100 -713 0 -17 4 -19 18 -11 15 7 371 141 917 345 83 30 199 73 260 94 l109 38 43 384 c23 211 46 387 51 392 8 8 252 126 407 197 44 20 85 39 91 43 7 5 14 91 19 245 4 131 10 291 14 356 l6 118 90 39 c49 22 102 40 118 40 32 0 208 -67 218 -82 4 -6 9 -71 13 -146 4 -76 11 -202 16 -282 5 -80 10 -172 11 -205 2 -62 12 -95 30 -95 6 0 95 -41 197 -91 103 -50 208 -100 234 -111 40 -17 48 -26 52 -52 5 -30 59 -509 76 -669 4 -43 9 -79 11 -81 2 -1 65 -24 139 -51 176 -62 924 -340 1122 -417 52 -20 51 -40 3 292 -19 129 -50 348 -69 485 -19 138 -67 468 -106 735 -39 267 -79 548 -90 625 -11 77 -49 343 -85 590 -36 248 -72 495 -80 550 -27 188 -165 1140 -185 1275 -11 74 -45 310 -76 523 l-55 388 -42 37 c-53 47 -171 158 -312 293 -123 118 -354 336 -541 509 -68 63 -131 125 -140 138 -23 34 -32 26 -23 -20 42 -212 107 -548 175 -908 20 -107 45 -238 55 -290 17 -89 40 -215 124 -665 19 -99 45 -243 60 -320 26 -139 32 -171 79 -420 13 -71 22 -133 20 -137 -3 -4 -53 15 -112 41 -59 26 -155 66 -214 90 -58 23 -114 49 -125 56 -17 12 -18 38 -23 347 l-5 334 -175 172 -175 172 -172 -172 -173 -173 0 -338 0 -338 -47 -20 c-27 -12 -93 -39 -148 -61 -55 -22 -129 -52 -165 -68 -36 -15 -76 -31 -89 -35 -28 -8 -31 -36 45 365 30 157 63 332 74 390 58 314 76 409 125 665 30 154 84 438 120 630 36 193 79 415 95 495 32 167 43 230 38 230 -1 0 -28 -25 -58 -55z m455 -3188 c63 -18 130 -90 150 -161 59 -204 -113 -389 -310 -331 -174 50 -244 271 -132 416 66 87 166 113 292 76z m-595 -300 c0 -13 -5 -48 -10 -78 -6 -30 -26 -153 -45 -274 -19 -120 -38 -222 -43 -226 -22 -19 -482 -223 -488 -216 -3 2 7 74 22 158 14 85 38 225 53 311 15 87 31 162 37 168 10 10 440 177 462 179 6 1 12 -9 12 -22z m1245 -65 l230 -87 13 -50 c12 -49 102 -565 102 -586 0 -6 -6 -9 -12 -6 -7 3 -65 29 -128 57 -63 29 -167 75 -230 102 -63 28 -118 54 -123 57 -4 4 -25 124 -47 267 -22 142 -43 268 -46 279 -3 11 -8 28 -10 38 -3 10 0 17 8 16 7 0 117 -39 243 -87z'/>
      <path d='M3259 6132 c-64 -43 -112 -74 -384 -247 -110 -70 -217 -138 -238 -152 -21 -13 -40 -29 -42 -36 -4 -11 -51 -304 -115 -722 -46 -296 -110 -708 -130 -840 -11 -66 -31 -192 -45 -280 -14 -88 -41 -263 -61 -390 -43 -281 -133 -843 -139 -869 -8 -38 246 -263 495 -435 l145 -101 7 37 c4 21 25 178 48 348 66 504 80 605 95 705 8 52 31 210 51 350 93 662 156 1102 183 1285 48 322 171 1173 181 1255 6 41 12 87 15 103 2 15 1 27 -3 26 -4 0 -32 -17 -63 -37z'/>
      <path d='M6875 6138 c11 -60 34 -218 95 -638 34 -228 76 -514 95 -635 30 -191 90 -615 139 -970 9 -60 29 -202 46 -315 16 -113 43 -308 60 -435 29 -223 48 -362 90 -673 11 -81 27 -205 36 -277 9 -71 18 -132 19 -133 2 -2 24 11 48 30 25 18 92 65 148 103 127 86 214 158 345 287 77 76 100 105 97 121 -2 12 -21 139 -43 282 -22 143 -51 332 -65 420 -14 88 -32 203 -40 255 -8 52 -26 167 -40 255 -14 88 -32 205 -40 260 -8 55 -30 201 -50 325 -20 124 -42 266 -50 315 -8 50 -28 178 -45 285 -17 107 -42 269 -55 360 -45 294 -56 343 -79 360 -27 19 -306 195 -495 312 -80 49 -159 101 -176 114 -42 31 -47 30 -40 -8z'/>
        </g>
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
  const patternOpacity = opacity ?? (dark ? 0.12 : 0.08);
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
  const opacity = opts?.opacity ?? (opts?.dark ? 0.12 : 0.08);
  return generateWatermarkSvg(color, opacity);
}

/**
 * Returns the background CSS properties for the Helm watermark.
 * Use as: <div style={getHelmWatermarkStyle()} >
 */
export function getHelmWatermarkStyle(opts?: { color?: string; opacity?: number; dark?: boolean }): React.CSSProperties {
  const color = opts?.color || (opts?.dark ? '#3B9EFF' : '#1677FF');
  const opacity = opts?.opacity ?? (opts?.dark ? 0.12 : 0.08);
  const bgColor = opts?.dark ? '#0B1220' : '#F5F7FA';
  return {
    backgroundColor: bgColor,
    backgroundImage: `url("${generateWatermarkSvg(color, opacity)}")`,
    backgroundRepeat: 'repeat',
    backgroundSize: '240px 240px',
  };
}
