import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';

interface SignaturePadProps {
  onChange?: (dataUrl: string) => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const strokeColorRef = useRef('#111827');
  const { t } = useTranslation();
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initializeContext = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * pixelRatio);
      canvas.height = Math.floor(rect.height * pixelRatio);

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }
      ctxRef.current = context;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(pixelRatio, pixelRatio);
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.strokeStyle = strokeColorRef.current;
    };

    initializeContext();

    const resizeObserver = new ResizeObserver(() => {
      initializeContext();
    });
    resizeObserver.observe(canvas);

    const handlePointerDown = (e: PointerEvent) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!drawing.current) return;
      const ctx = ctxRef.current;
      if (!ctx) return;
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    };

    const handlePointerUp = () => {
      if (!drawing.current) return;
      drawing.current = false;
      if (onChange && canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        onChange(dataUrl);
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerUp);
    };
  }, [onChange]);

  useEffect(() => {
    strokeColorRef.current = theme === 'dark' ? '#e2e8f0' : '#111827';
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = strokeColorRef.current;
    }
  }, [theme]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    if (onChange) {
      onChange('');
    }
  };

  // Expose clear method via data attribute (optional). Caller can access ref.
  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="h-40 w-full max-w-full rounded border border-slate-300 bg-white transition-colors dark:border-slate-600 dark:bg-slate-800"
        style={{ touchAction: 'none' }}
      ></canvas>
      <button
        type="button"
        onClick={clear}
        className="rounded bg-slate-200 px-2 py-1 text-sm font-medium text-slate-800 transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 dark:focus:ring-offset-slate-900"
      >
        {t('signaturePad.clear')}
      </button>
    </div>
  );
};

export default SignaturePad;