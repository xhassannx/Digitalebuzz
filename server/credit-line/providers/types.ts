import type { CreditLineProviderConfig } from "@shared/schema";

export type CreditLineSendTemplateInput = {
  phoneNumberId: string;
  wabaId: string;
  body: Record<string, unknown>;
  /** When true and provider.mmLiteEnabled, use /marketing_messages */
  useMmLite?: boolean;
};

export type CreditLineSendTemplateResult = {
  ok: boolean;
  status: number;
  responseText: string;
  json?: any;
};

export type CreditLineTpSignupInput = {
  wabaId: string;
  solutionId: string;
  phoneNumber?: string;
  dataLocalizationRegion?: string;
  autoSubscribe?: boolean;
};

export interface CreditLineProvider {
  readonly id: string;
  sendTemplate(
    cfg: CreditLineProviderConfig,
    input: CreditLineSendTemplateInput
  ): Promise<CreditLineSendTemplateResult>;
  tpSignup?(
    cfg: CreditLineProviderConfig,
    input: CreditLineTpSignupInput
  ): Promise<{ ok: boolean; status: number; body: unknown }>;
  tpUnsubscribe?(
    cfg: CreditLineProviderConfig,
    input: { wabaId: string }
  ): Promise<{ ok: boolean; status: number; body: unknown }>;
  /** Optional: register override_callback_uri on supplier middleware after tp-signup */
  subscribeApps?(
    cfg: CreditLineProviderConfig,
    input: { wabaId: string; overrideCallbackUri: string; verifyToken: string }
  ): Promise<{ ok: boolean; status: number; body: unknown }>;
}
