import { useEffect, useState } from "react";
import { File } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderPdfFirstPageToDataUrl } from "@/lib/render-pdf-thumbnail";

type PdfThumbnailProps = {
  src: string;
  alt?: string;
  className?: string;
};

/**
 * Client-side first-page PDF preview using PDF.js → canvas → JPEG data URL.
 */
export function PdfThumbnail({ src, alt, className }: PdfThumbnailProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setFailed(false);

    renderPdfFirstPageToDataUrl(src, { maxWidth: 520, imageQuality: 0.82 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (failed) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-muted/50",
          className
        )}
      >
        <File className="h-10 w-10 text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={cn(
          "flex h-full w-full animate-pulse items-center justify-center bg-muted/60",
          className
        )}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          PDF…
        </span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt ?? "PDF first page"}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
