import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

type Props = {
  onSave: (dataUrl: string) => void;
  onCancel?: () => void;
  saving?: boolean;
};

/**
 * Hand-drawn signature pad. Renders at 2x device resolution so the exported
 * PNG stays crisp on the printed card. Emits a `data:image/png;base64,...`
 * string (the format the server accepts for signature approval).
 */
export default function CardSignaturePad({ onSave, onCancel, saving }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const scale = 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.5 * scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1B355E";
  }, []);

  const toLocalPoint = (e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    const point = toLocalPoint(e.nativeEvent);
    if (!point) return;
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const point = toLocalPoint(e.nativeEvent);
    if (!point) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setHasInk(true);
  };

  const end = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-[#B9CBC6] bg-white">
        <canvas
          ref={canvasRef}
          width={520}
          height={180}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="h-[90px] w-full touch-none cursor-crosshair"
        />
        {!hasInk && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center font-[cursive] italic text-[#9AA9B8]">
            Sign your name here
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clear}
          disabled={!hasInk}
          className="h-9 flex-1 border-[#B9CBC6] text-[#1B355E]"
        >
          <Eraser className="mr-1.5 h-3.5 w-3.5" /> Clear
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            onSave(canvas.toDataURL("image/png"));
          }}
          disabled={!hasInk || saving}
          className="msap-primary-action h-9 flex-1 text-white disabled:opacity-60"
        >
          {saving ? "Submitting…" : "Submit for approval"}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="h-9 text-[#66788D]">
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
