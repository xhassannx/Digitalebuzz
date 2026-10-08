import { useQuery } from "@tanstack/react-query";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import type { ContactPaymentRequestRow } from "./contact-payment-types";

export function useContactPaymentRequests(limit = 8) {
  return useQuery<ContactPaymentRequestRow[]>({
    queryKey: ["/api/payments/contact-requests", "org", limit],
    queryFn: () =>
      fetchLegacyListApi<ContactPaymentRequestRow>(
        `/api/payments/contact-requests?limit=${limit}`,
        "transactions"
      ),
  });
}
