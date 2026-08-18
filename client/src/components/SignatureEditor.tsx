import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, PenLine, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import CardSignaturePad from "./CardSignaturePad";
import { removeImageBackground } from "@/lib/signatureBackground";

type Props = {
  onSave: (dataUrl: string) => void;
  onCancel?: () => void;
  saving?: boolean;
};

type Mode = "draw" | "upload";

/**
 * Signature editor with two input modes:
 *  - Draw  — the existing hand-drawn pad.
 *  - Upload — choose a signature image file; the white/light background is
 *    removed automatically (client-side) so the signature sits cleanly on the
 *    card. A tolerance slider controls how aggressively the background is
 *    cleared, with a checkerboard preview showing the resulting transparency.
 */
export default function SignatureEditor({ onSave, onCancel, saving }: Props) {
  const [mode, setMode] = useState<Mode>("draw");
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [processed, setProcessed] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(34);
  const [processing, setProcessing] = useState(false);

  // Server-side cap on accepted signature data URLs.
  const MAX_SIGNATURE_DATA_URL_LENGTH = 400_000;
  // Monotonic token so overlapping re-processes can't land out of order.
  const processToken = useRef(0);

  const handleFile = async (next: File | undefined | null) => {
    if (!next) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(next.type)) {
      toast.error("Please choose a PNG, JPEG or WebP image.");
      return;
    }
    const token = ++processToken.current;
    setFile(next);
    setProcessing(true);
    try {
      const dataUrl = await removeImageBackground(next, { tolerance });
      if (token !== processToken.current) return; // a newer run superseded us
      setProcessed(dataUrl);
    } catch (error) {
      if (token !== processToken.current) return;
      toast.error((error as Error).message || "Could not process that image.");
      setProcessed(null);
    } finally {
      if (token === processToken.current) setProcessing(false);
    }
  };

  const reRun = async (nextTolerance: number) => {
    setTolerance(nextTolerance);
    if (!file) return;
    const token = ++processToken.current;
    setProcessing(true);
    try {
      const dataUrl = await removeImageBackground(file, {
        tolerance: nextTolerance,
      });
      if (token !== processToken.current) return;
      setProcessed(dataUrl);
    } catch (error) {
      if (token !== processToken.current) return;
      toast.error((error as Error).message || "Could not re-process the image.");
    } finally {
      if (token === processToken.current) setProcessing(false);
    }
  };

  const submit = () => {
    if (!processed) return;
    if (processed.length > MAX_SIGNATURE_DATA_URL_LENGTH) {
      toast.error(
        "That signature image is too large for the card. Lower the background removal or use a smaller image."
      );
      return;
    }
    onSave(processed);
  };

  return (
    <div className="space-y-3">
      {/* Mode switch */}
      <div className="flex rounded-lg border border-[#D9E4E1] bg-[#F6F9F8] p-1">
        <button
          type="button"
          onClick={() => setMode("draw")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
            mode === "draw"
              ? "bg-white text-[#1B355E] shadow-sm"
              : "text-[#66788D] hover:text-[#1B355E]"
          }`}
        >
          <PenLine className="h-3.5 w-3.5" /> Draw
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
            mode === "upload"
              ? "bg-white text-[#1B355E] shadow-sm"
              : "text-[#66788D] hover:text-[#1B355E]"
          }`}
        >
          <ImagePlus className="h-3.5 w-3.5" /> Upload image
        </button>
      </div>

      {mode === "draw" ? (
        <CardSignaturePad onSave={onSave} onCancel={onCancel} saving={saving} />
      ) : (
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = ""; // allow re-selecting the same file
            }}
          />

          {!processed && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={processing}
              className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#B9CBC6] bg-white text-center transition-colors hover:border-[#138A73] hover:bg-[#F6FBF9] disabled:opacity-60"
            >
              {processing ? (
                <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
              ) : (
                <ImagePlus className="h-6 w-6 text-[#138A73]" />
              )}
              <span className="text-xs font-semibold text-[#1B355E]">
                {processing ? "Removing background…" : "Choose a signature image"}
              </span>
              <span className="max-w-[240px] text-[10px] leading-4 text-[#8A9BAE]">
                PNG, JPG or WebP. The light background is removed automatically
                so only your signature remains.
              </span>
            </button>
          )}

          {processed && (
            <>
              {/* Checkerboard preview shows the transparency */}
              <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl border border-[#D9E4E1]"
                style={{
                  backgroundImage:
                    "conic-gradient(#E9EFED 0 25%, #ffffff 0 50%, #E9EFED 0 75%, #ffffff 0)",
                  backgroundSize: "14px 14px",
                }}
              >
                {processing ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
                ) : (
                  <img
                    src={processed}
                    alt="Processed signature"
                    className="max-h-24 max-w-[85%] object-contain"
                  />
                )}
              </div>

              {/* Tolerance slider */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 font-semibold text-[#1B355E]">
                    <Sparkles className="h-3.5 w-3.5 text-[#138A73]" />
                    Background removal
                  </span>
                  <span className="text-[10px] text-[#8A9BAE]">
                    {tolerance}% tolerance
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={95}
                  value={tolerance}
                  onChange={(e) => reRun(Number(e.target.value))}
                  className="mt-2 w-full accent-[#138A73]"
                />
                <p className="mt-1 text-[10px] leading-4 text-[#8A9BAE]">
                  Raise it to clear shadows and stains; lower it to keep more
                  detail.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={processing}
                  className="h-9 flex-1 border-[#B9CBC6] text-[#1B355E]"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Choose another
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!processed || processing || saving}
                  onClick={submit}
                  className="msap-primary-action h-9 flex-1 text-white disabled:opacity-60"
                >
                  {saving ? "Submitting…" : "Submit for approval"}
                </Button>
                {onCancel && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={onCancel}
                    className="h-9 text-[#66788D]"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
