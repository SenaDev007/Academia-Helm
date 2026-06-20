/**
 * ============================================================================
 * OnboardingAnimation — Animation particules école + ondes
 * ============================================================================
 *
 * Animation canvas avec des particules en mouvement représentant des éléments
 * scolaires (livres, diplômes, étoiles) + ondes de fond, utilisant la palette
 * Academia Helm (navy, gold, crimson).
 *
 * Utilisé dans le header de la page /signup pour rendre l'onboarding plus
 * captivant et immersif.
 * ============================================================================
 */

'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  type: 'book' | 'star' | 'cap' | 'dot';
  color: string;
  opacity: number;
}

interface Wave {
  amplitude: number;
  frequency: number;
  speed: number;
  offset: number;
  color: string;
  opacity: number;
}

const COLORS = {
  navy: '#0A2A5E',
  navyLight: '#0D3B85',
  gold: '#F2C94C',
  goldDeep: '#CFA63A',
  crimson: '#B91C1C',
  white: '#FFFFFF',
};

export default function OnboardingAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    let waves: Wave[] = [];
    let width = 0;
    let height = 0;
    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    const initParticles = () => {
      particles = [];
      const count = Math.min(28, Math.floor(width / 40));
      const types: Particle['type'][] = ['book', 'star', 'cap', 'dot', 'dot', 'star'];
      const palette = [COLORS.gold, COLORS.goldDeep, COLORS.navyLight, COLORS.crimson];

      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: 6 + Math.random() * 10,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.01,
          type: types[Math.floor(Math.random() * types.length)],
          color: palette[Math.floor(Math.random() * palette.length)],
          opacity: 0.3 + Math.random() * 0.5,
        });
      }
    };

    const initWaves = () => {
      waves = [
        { amplitude: 12, frequency: 0.008, speed: 0.02, offset: 0, color: COLORS.navy, opacity: 0.06 },
        { amplitude: 18, frequency: 0.005, speed: 0.015, offset: Math.PI / 3, color: COLORS.gold, opacity: 0.05 },
        { amplitude: 8, frequency: 0.012, speed: 0.025, offset: Math.PI / 2, color: COLORS.crimson, opacity: 0.04 },
      ];
    };

    const drawBook = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, color: string, opacity: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      // Livre ouvert (2 pages)
      ctx.beginPath();
      ctx.moveTo(-size / 2, -size / 3);
      ctx.lineTo(0, -size / 2);
      ctx.lineTo(size / 2, -size / 3);
      ctx.lineTo(size / 2, size / 3);
      ctx.lineTo(0, size / 2);
      ctx.lineTo(-size / 2, size / 3);
      ctx.closePath();
      ctx.fill();
      // Ligne centrale
      ctx.beginPath();
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(0, size / 2);
      ctx.stroke();
      ctx.restore();
    };

    const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, color: string, opacity: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      const spikes = 5;
      const outerRadius = size / 2;
      const innerRadius = size / 4;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawCap = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, color: string, opacity: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      // Mortarboard (carré + base)
      ctx.beginPath();
      ctx.moveTo(-size / 2, 0);
      ctx.lineTo(0, -size / 3);
      ctx.lineTo(size / 2, 0);
      ctx.lineTo(0, size / 4);
      ctx.closePath();
      ctx.fill();
      // Tassel
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(size / 2, 0);
      ctx.lineTo(size / 2, size / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2 + 2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawDot = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, opacity: number) => {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawParticle = (p: Particle) => {
      switch (p.type) {
        case 'book':
          drawBook(ctx, p.x, p.y, p.size, p.rotation, p.color, p.opacity);
          break;
        case 'star':
          drawStar(ctx, p.x, p.y, p.size, p.rotation, p.color, p.opacity);
          break;
        case 'cap':
          drawCap(ctx, p.x, p.y, p.size, p.rotation, p.color, p.opacity);
          break;
        case 'dot':
        default:
          drawDot(ctx, p.x, p.y, p.size, p.color, p.opacity);
          break;
      }
    };

    const drawWaves = () => {
      waves.forEach((wave) => {
        ctx.save();
        ctx.globalAlpha = wave.opacity;
        ctx.fillStyle = wave.color;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 4) {
          const y = height / 2 + Math.sin(x * wave.frequency + wave.offset + time * wave.speed) * wave.amplitude;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    };

    const update = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      // Fond dégradé navy
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(10, 42, 94, 0.03)');
      gradient.addColorStop(1, 'rgba(242, 201, 76, 0.02)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Ondes
      drawWaves();

      // Particules
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Wrap-around (toroïdal)
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        drawParticle(p);
      });

      animationId = requestAnimationFrame(update);
    };

    resize();
    initParticles();
    initWaves();
    update();

    const handleResize = () => {
      resize();
      initParticles();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ display: 'block' }}
      aria-hidden="true"
    />
  );
}
