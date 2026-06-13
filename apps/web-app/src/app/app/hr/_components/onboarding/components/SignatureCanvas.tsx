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
  const [isDrawing, setIsDrawing] = useState(false);
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

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
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
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const ctx = getContext();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setHasSignature(true);
      const data = canvas.toDataURL('image/png');
      onSignatureChange?.(data);
    }
  };

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
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
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
