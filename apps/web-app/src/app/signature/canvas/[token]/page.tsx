'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Check, X, Eraser, Upload, Send } from 'lucide-react';

/**
 * ⭐ Signature Canvas Page — Self-hosted signature drawing/upload.
 *
 * Accessed via a magic-link token (sent by email to the staff member).
 * The page shows the staff's name + role, a drawing canvas, and upload
 * option. On submit, the PNG is POSTed to /api/settings/signature/upload/:token.
 *
 * No login required — the token authenticates the request.
 */

interface TokenInfo {
  holderName: string;
  role: string;
  email: string;
  expiresAt: string;
}

export default function SignatureCanvasPage() {
  const params = useParams();
  const token = params.token as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Load token info on mount
  useEffect(() => {
    if (!token) return;
    fetch(`/api/settings/signature/token-info/${token}`)
      .then(res => {
        if (!res.ok) throw new Error('Token invalide ou expiré');
        return res.json();
      })
      .then(data => {
        setTokenInfo(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Erreur lors de la vérification du lien');
        setLoading(false);
      });
  }, [token]);

  // Canvas drawing setup
  useEffect(() => {
    if (!canvasRef.current || loading || error) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Pen style
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [loading, error]);

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPointerPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSubmit = async () => {
    if (!hasDrawn) {
      setError('Veuillez dessiner votre signature avant de l\'envoyer.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const canvas = canvasRef.current;
      // Convert canvas to base64 PNG data URL
      const dataUrl = canvas!.toDataURL('image/png');
      const res = await fetch(`/api/settings/signature/upload/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureDataUrl: dataUrl }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Erreur ${res.status}`);
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi de la signature');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas!.width, canvas!.height);
        // Fit the image inside the canvas (maintain aspect ratio)
        const ratio = Math.min(canvas!.width / img.width, canvas!.height / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (canvas!.width - w) / 2;
        const y = (canvas!.height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        setHasDrawn(true);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Vérification du lien...</span>
        </div>
      </div>
    );
  }

  if (error && !tokenInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md text-center p-8 bg-white rounded-xl shadow-lg">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Lien invalide</h1>
          <p className="text-sm text-slate-600">{error}</p>
          <p className="text-xs text-slate-400 mt-4">
            Demandez un nouveau lien à votre administration.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md text-center p-8 bg-white rounded-xl shadow-lg">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Signature enregistrée !</h1>
          <p className="text-sm text-slate-600">
            Votre signature a été enregistrée avec succès. Elle sera automatiquement
            appliquée sur tous vos documents officiels.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Enregistrer votre signature</h1>
          {tokenInfo && (
            <p className="text-sm text-slate-600 mt-2">
              <strong>{tokenInfo.holderName}</strong> — {tokenInfo.role.replace(/_/g, ' ')}
            </p>
          )}
        </div>

        {/* Canvas */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 mb-4">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
              className="w-full touch-none cursor-crosshair bg-white rounded-lg"
              style={{ aspectRatio: '3 / 1' }}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={clearCanvas}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium"
              >
                <Eraser className="w-4 h-4" /> Effacer
              </button>
              <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium cursor-pointer">
                <Upload className="w-4 h-4" /> Importer une image
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!hasDrawn || submitting}
              className="flex items-center gap-1.5 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'Envoi...' : 'Envoyer ma signature'}
            </button>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
          )}

          {/* Help text */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-500 leading-relaxed">
              <strong>Instructions :</strong> Dessinez votre signature avec votre souris ou votre doigt
              (sur tactile) dans la zone ci-dessus, ou importez une image de votre signature.
              Cliquez ensuite sur « Envoyer ma signature ». Votre signature sera automatiquement
              appliquée sur tous les documents officiels vous concernant (reçus, contrats, bulletins, etc.).
            </p>
            <p className="text-xs text-slate-400 mt-3">
              Ce lien expire le {tokenInfo && new Date(tokenInfo.expiresAt).toLocaleDateString('fr-FR')}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
