import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, AlertCircle, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const PREVIEW_MAX_WIDTH = 720;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function drawVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  maxWidth: number
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.min(1, maxWidth / vw);
  const w = Math.max(1, Math.round(vw * scale));
  const h = Math.max(1, Math.round(vh * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(video, 0, 0, w, h);
}

export type VideoUploadEditorProps = {
  file: File;
  onCancel: () => void;
  /** Called with the same video file when the user confirms upload */
  onConfirm: (file: File) => void;
  className?: string;
};

/**
 * YouTube-style video upload step: drag/drop is handled by the parent; this editor
 * loads the file, generates a canvas thumbnail from arbitrary frames, and lets the user scrub to pick a poster frame.
 */
export function VideoUploadEditor({
  file,
  onCancel,
  onConfirm,
  className,
}: VideoUploadEditorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const seekBusyRef = useRef(false);

  const sliderId = useId();
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [sliderPct, setSliderPct] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const paintFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    drawVideoFrame(video, canvas, PREVIEW_MAX_WIDTH);
  }, []);

  useEffect(() => {
    setPhase("loading");
    setErrorMessage(null);
    setDuration(0);
    setCurrentTime(0);
    setSliderPct(0);

    const video = videoRef.current;
    if (!video) return;

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    video.src = url;
    video.load();

    const onLoadedMetadata = () => {
      const d = video.duration;
      if (!Number.isFinite(d) || d <= 0) {
        setPhase("error");
        setErrorMessage("Could not read this video's duration. The file may be damaged or unsupported.");
        return;
      }
      setDuration(d);
      const start = Math.min(0.25, Math.max(0.05, d * 0.02));
      seekBusyRef.current = true;
      video.currentTime = start;
    };

    const onSeeked = () => {
      seekBusyRef.current = false;
      setCurrentTime(video.currentTime);
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setSliderPct((video.currentTime / video.duration) * 100);
      }
      paintFrame();
      setPhase("ready");
    };

    const onTimeUpdate = () => {
      if (!seekBusyRef.current) {
        setCurrentTime(video.currentTime);
      }
    };

    const onError = () => {
      setPhase("error");
      setErrorMessage(
        "This video format could not be played in your browser. Try MP4 (H.264) or WebM."
      );
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("error", onError);
      video.removeAttribute("src");
      video.load();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file, paintFrame]);

  const handleSliderChange = (values: number[]) => {
    const v = values[0];
    if (v === undefined || !Number.isFinite(duration) || duration <= 0) return;
    const video = videoRef.current;
    if (!video) return;
    const t = (v / 100) * duration;
    seekBusyRef.current = true;
    video.currentTime = t;
    setSliderPct(v);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <video
        ref={videoRef}
        className="sr-only"
        muted
        playsInline
        preload="auto"
        aria-hidden
      />

      <div className="relative w-full overflow-hidden rounded-xl border bg-black/5 dark:bg-black/40 aspect-video max-h-[min(50vh,360px)]">
        {phase === "loading" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-medium text-muted-foreground">
              Processing video…
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-destructive/10 p-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
            <p className="text-sm font-medium text-destructive">{errorMessage}</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={cn(
            "h-full w-full object-contain",
            (phase === "error" || phase === "loading") && "opacity-0"
          )}
          aria-label="Video thumbnail preview"
        />

        {phase === "ready" && (
          <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        )}
      </div>

      {phase === "ready" && duration > 0 && (
        <div className="space-y-2">
          <label
            htmlFor={sliderId}
            className="flex items-center gap-2 text-sm font-medium text-foreground"
          >
            <Film className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Thumbnail frame
          </label>
          <Slider
            id={sliderId}
            min={0}
            max={100}
            step={0.1}
            value={[sliderPct]}
            onValueChange={handleSliderChange}
            className="py-1"
            disabled={phase !== "ready"}
          />
          <p className="text-xs text-muted-foreground">
            Scrub to choose which frame appears as the preview thumbnail.
          </p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Back
        </Button>
        <Button
          type="button"
          onClick={() => onConfirm(file)}
          disabled={phase !== "ready"}
        >
          Upload video
        </Button>
      </div>
    </div>
  );
}

/** First-frame style preview for gallery grid cards (muted, no controls). */
export function VideoGalleryPoster({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const seekPreview = () => {
      const d = el.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      try {
        el.currentTime = Math.min(0.5, d * 0.05);
      } catch {
        /* ignore */
      }
    };

    el.addEventListener("loadedmetadata", seekPreview);
    return () => el.removeEventListener("loadedmetadata", seekPreview);
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="metadata"
      className={cn("h-full w-full object-cover pointer-events-none", className)}
      aria-hidden
    />
  );
}
