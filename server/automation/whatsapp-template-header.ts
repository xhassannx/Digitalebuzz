import { businessAPIManager } from "../whatsapp/business-api-client";
import { loadPanelMediaBufferFromUrl } from "../panel-inbox-send";
import type { WhatsappSession } from "@shared/schema";

type HeaderMediaResult = {
  headerImageId?: string;
  headerVideoId?: string;
  headerDocumentId?: string;
};

/** Resolve IMAGE/VIDEO/DOCUMENT header media IDs for template sends in automation flows. */
export async function resolveTemplateHeaderMediaForFlow(
  cfg: Record<string, unknown>,
  session: WhatsappSession
): Promise<HeaderMediaResult> {
  const sessionId = String(cfg.connectionId || session.sessionId || "").trim();
  const creds = businessAPIManager["credentials"].get(sessionId) as
    | { phoneNumberId: string; accessToken: string; businessAccountId?: string }
    | undefined;
  if (!creds?.phoneNumberId || !creds.accessToken) {
    throw new Error("WhatsApp credentials not available for template header upload");
  }
  const businessAccountId = session.deviceInfo?.wabaId || creds.businessAccountId;

  const upload = async (url: string, kind: "IMAGE" | "VIDEO" | "DOCUMENT") => {
    const { buffer, fileName } = await loadPanelMediaBufferFromUrl(url);
    const result = await businessAPIManager.uploadMediaWithCredentials(
      {
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken,
        businessAccountId,
      },
      buffer,
      fileName,
      kind,
      false
    );
    return result.id;
  };

  let headerImageId = String(cfg.headerImageId || "").trim() || undefined;
  const headerImageUrl = String(cfg.headerImageUrl || "").trim();
  if (!headerImageId && headerImageUrl) {
    headerImageId = await upload(headerImageUrl, "IMAGE");
  }

  let headerVideoId = String(cfg.headerVideoId || "").trim() || undefined;
  const headerVideoUrl = String(cfg.headerVideoUrl || "").trim();
  if (!headerVideoId && headerVideoUrl) {
    headerVideoId = await upload(headerVideoUrl, "VIDEO");
  }

  let headerDocumentId = String(cfg.headerDocumentId || "").trim() || undefined;
  const headerDocumentUrl = String(cfg.headerDocumentUrl || "").trim();
  if (!headerDocumentId && headerDocumentUrl) {
    headerDocumentId = await upload(headerDocumentUrl, "DOCUMENT");
  }

  return { headerImageId, headerVideoId, headerDocumentId };
}
