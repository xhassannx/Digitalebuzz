import { compressImageFile } from "@/lib/compress-image";
import {
  classifyPanelUploadFile,
  validatePanelUploadFile,
  type PanelUploadMediaKind,
} from "@shared/panel-upload-limits";

export type PreparePanelUploadResult = {
  file: File;
  kind: PanelUploadMediaKind;
  compressed: boolean;
  savedBytes: number;
};

export type PreparePanelUploadOptions = {
  /** Default true — only images are compressed. */
  compressImages?: boolean;
};

/**
 * Validates type/size and optionally compresses images before upload or send.
 */
export async function preparePanelUploadFile(
  file: File,
  options?: PreparePanelUploadOptions,
): Promise<PreparePanelUploadResult> {
  const compressImages = options?.compressImages !== false;
  let kind = classifyPanelUploadFile(file);
  if (!kind) {
    throw new Error(
      "Unsupported file type. Upload images, videos, audio, or documents.",
    );
  }

  let working = file;
  let compressed = false;
  let savedBytes = 0;

  if (kind === "image" && compressImages) {
    const result = await compressImageFile(file);
    working = result.file;
    compressed = result.compressed;
    savedBytes = result.savedBytes;
    kind = classifyPanelUploadFile(working) ?? "image";
  }

  const validation = validatePanelUploadFile(working);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return {
    file: working,
    kind: validation.kind,
    compressed,
    savedBytes,
  };
}

export { validatePanelUploadFile, classifyPanelUploadFile };
