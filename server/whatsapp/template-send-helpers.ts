export {
  sanitizeWhatsAppTemplateParamText,
  WHATSAPP_TEMPLATE_PARAM_MAX_CHARS,
} from "@shared/whatsapp-template-params";

/** Detect FORM (WhatsApp Flow) templates and build the Meta-required flow button component payload. */
export function flowButtonForTemplateMeta(
  meta: Record<string, unknown> | null | undefined
): { flowToken?: string; flowActionData?: Record<string, unknown> } | undefined {
  if (!meta || meta.interactiveAction !== "FORM") return undefined;
  // Prefer internal UUID so we can match submissions even if Meta flow id is rotated on re-publish.
  // Fall back to Meta flow id (stored as flowId on the template).
  const internalId =
    typeof meta.internalFlowId === "string" && meta.internalFlowId.trim()
      ? meta.internalFlowId.trim()
      : "";
  const metaFlowId =
    typeof meta.flowId === "string" && meta.flowId.trim() ? meta.flowId.trim() : "";
  const flowToken = internalId || metaFlowId || "unused";
  return { flowToken };
}
