import {
  formatPanelUploadLimitsSummary,
  formatPanelUploadMaxMb,
} from "@shared/panel-upload-limits";
import { cn } from "@/lib/utils";

type PanelUploadLimitsHintProps = {
  className?: string;
  /** Shorter single-line hint for tight spaces (e.g. attach menu). */
  compact?: boolean;
};

export function PanelUploadLimitsHint({
  className,
  compact = false,
}: PanelUploadLimitsHintProps) {
  if (compact) {
    return (
      <p className={cn("text-[11px] text-muted-foreground leading-snug", className)}>
        Images ≤{formatPanelUploadMaxMb("image")} MB (auto-compressed), video ≤
        {formatPanelUploadMaxMb("video")} MB, audio/doc ≤{formatPanelUploadMaxMb("audio")} MB
      </p>
    );
  }

  return (
    <p className={cn("text-xs text-muted-foreground/90 leading-snug", className)}>
      {formatPanelUploadLimitsSummary()}
    </p>
  );
}
