/**
 * Upload an image for website builder. File is saved under uploads/{organizationId}/website-builder/
 * and the returned URL can be stored in page content and used in <img src={url} />.
 */
import { preparePanelUploadFile } from "@/lib/prepare-panel-upload";

export async function uploadWebsiteBuilderImage(file: File): Promise<{ url: string; filename?: string; originalName?: string }> {
  const prepared = await preparePanelUploadFile(file);
  const formData = new FormData();
  formData.append("file", prepared.file);
  const res = await fetch("/api/website-builder/upload/image", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || "Upload failed");
  }
  return res.json();
}
