'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Eraser } from 'lucide-react';

interface SignatureCanvasProps {
  width?: number;
  height?: number;
  onSignatureChange?: (data: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function SignatureCanvas({
  width = 400,
  height = 140,
  onSignatureChange,
  disabled = false,
  placeholder = 'Signez ici avec votre souris ou doigt',
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // ⭐ Utiliser useRef au lieu de useState pour isDrawing
  //    → évite les stale closures et permet le multi-strokes
  const isDrawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return ctx;
  }, []);

  // Set up canvas styling
  useEffect(() => {
    const ctx = getContext();
    if (!ctx) return;
    ctx.strokeStyle = '#0b2f73';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [getContext]);

  const getPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Handle both React events and native events
    let clientX: number, clientY: number;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return { x: 0, y: 0 };
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const ctx = getContext();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    isDrawingRef.current = true;
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current || disabled) return;
    e.preventDefault();
    const ctx = getContext();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      setHasSignature(true);
      const data = canvas.toDataURL('image/png');
      onSignatureChange?.(data);
    }
  }, [onSignatureChange]);

  // ⭐ Écouteurs globaux pour capter mouseup/touchend même en dehors du canvas
  //    → permet à l'utilisateur de relâcher la souris n'importe où
  useEffect(() => {
    if (disabled) return;

    const handleGlobalMouseUp = () => {
      if (isDrawingRef.current) {
        stopDrawing();
      }
    };

    const handleGlobalTouchEnd = (e: TouchEvent) => {
      if (isDrawingRef.current) {
        e.preventDefault();
        stopDrawing();
      }
    };

    // ⭐ Écouteur global mousemove pour continuer à dessiner même en dehors du canvas
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [disabled, stopDrawing]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange?.(null);
  };

  return (
    <div className="relative">
      <div
        className={`relative rounded-xl border-2 transition-colors overflow-hidden ${
          disabled
            ? 'border-slate-200 bg-slate-50 opacity-60'
            : hasSignature
            ? 'border-emerald-300 bg-emerald-50/30'
            : 'border-dashed border-slate-300 bg-white hover:border-[#1d4fa5]'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full touch-none cursor-crosshair"
          style={{ maxHeight: height }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchMove={draw}
        />
        {!hasSignature && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-slate-400 font-medium">{placeholder}</p>
          </div>
        )}
      </div>
      {hasSignature && !disabled && (
        <button
          type="button"
          onClick={clear}
          className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
          title="Effacer la signature"
        >
          <Eraser className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
