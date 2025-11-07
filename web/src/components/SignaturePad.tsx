import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';

interface SignaturePadProps {
  onChange?: (dataUrl: string) => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const { t } = useTranslation();
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    const handlePointerDown = (e: PointerEvent) => {
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
    };
    const handlePointerMove = (e: PointerEvent) => {
      if (!drawing.current) return;
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    };
    const handlePointerUp = () => {
      if (drawing.current) {
        drawing.current = false;
        if (onChange) {
          const dataUrl = canvas.toDataURL('image/png');
          onChange(dataUrl);
        }
      }
    };
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp);
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerUp);
    };
  }, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = theme === 'dark' ? '#e2e8f0' : '#111827';
  }, [theme]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (onChange) {
      onChange('');
    }
  };

  // Expose clear method via data attribute (optional). Caller can access ref.
  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={300}
        height={150}
        className="w-full max-w-full rounded border border-slate-300 bg-white transition-colors dark:border-slate-600 dark:bg-slate-800"
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