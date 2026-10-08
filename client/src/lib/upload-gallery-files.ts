import { uploadGalleryFile } from "@/lib/gallery-upload";
import { preparePanelUploadFile } from "@/lib/prepare-panel-upload";
import type { QueryClient } from "@tanstack/react-query";

export type GalleryUploadToast = (opts: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}) => void;

export type UploadGalleryFilesOptions = {
  toast?: GalleryUploadToast;
  queryClient?: QueryClient;
  onProgress?: (percent: number, fileName: string) => void;
  compressImages?: boolean;
};

export type UploadGalleryFilesResult = {
  uploaded: number;
  compressed: number;
  errors: string[];
};

/**
 * Validates, compresses images, and uploads one or more files to the gallery API.
 */
export async function uploadGalleryFiles(
  files: FileList | File[],
  options?: UploadGalleryFilesOptions,
): Promise<UploadGalleryFilesResult> {
  const list = Array.from(files);
  let uploaded = 0;
  let compressed = 0;
  const errors: string[] = [];

  for (const raw of list) {
    try {
      const prepared = await preparePanelUploadFile(raw, {
        compressImages: options?.compressImages,
      });
      if (prepared.compressed && options?.toast) {
        const savedKb = Math.round(prepared.savedBytes / 1024);
        options.toast({
          title: "Image optimized",
          description: `${raw.name} reduced by ~${savedKb} KB before upload.`,
          duration: 3500,
        });
        compressed++;
      }

      await uploadGalleryFile(
        prepared.file,
        (pct) => options?.onProgress?.(pct, prepared.file.name),
        {
          onRetry: (nextAttempt) => {
            options?.toast?.({
              title: "Retrying upload",
              description: `Connection issue — trying again (attempt ${nextAttempt})…`,
              duration: 4000,
            });
          },
        },
      );
      uploaded++;
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : `Failed to upload ${raw.name}`;
      errors.push(message);
      options?.toast?.({
        title: "Upload failed",
        description: message,
        variant: "destructive",
      });
    }
  }

  if (uploaded > 0) {
    await options?.queryClient?.invalidateQueries({ queryKey: ["/api/gallery"] });
    if (errors.length === 0) {
      options?.toast?.({
        title: "Success",
        description:
          uploaded === 1
            ? "File uploaded successfully"
            : `${uploaded} files uploaded successfully`,
      });
    }
  }

  return { uploaded, compressed, errors };
}
