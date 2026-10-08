import type { CreditLineProvider } from "./types";
import { interaktProvider } from "./interakt";

const providers = new Map<string, CreditLineProvider>([[interaktProvider.id, interaktProvider]]);

export function registerCreditLineProvider(provider: CreditLineProvider): void {
  providers.set(provider.id, provider);
}

export function getCreditLineProvider(providerId: string): CreditLineProvider | null {
  return providers.get(providerId) || null;
}

export function listRegisteredCreditLineProviderIds(): string[] {
  return Array.from(providers.keys());
}
