import React, { useRef, useEffect } from 'react';

interface SignaturePadProps {
  onChange?: (dataUrl: string) => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827'; // gray-900

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
    <div>
      <canvas
        ref={canvasRef}
        width={300}
        height={150}
        className="border border-gray-300 bg-white"
      ></canvas>
      <button
        type="button"
        onClick={clear}
        className="mt-2 px-2 py-1 text-sm bg-gray-200 rounded"
      >
        Clear
      </button>
    </div>
  );
};

export default SignaturePad;