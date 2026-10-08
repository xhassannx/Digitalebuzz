import type { DashboardStats } from "@/features/dashboard/useDashboardPage";

function qualityLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  const q = raw.toUpperCase();
  if (q === "GREEN" || q === "HIGH") return "High";
  if (q === "YELLOW" || q === "MEDIUM") return "Medium";
  if (q === "RED" || q === "LOW") return "Low";
  return raw;
}

function qualityTone(raw: string | null | undefined): string {
  const q = (raw || "").toUpperCase();
  if (q === "GREEN" || q === "HIGH") return "bg-[#dcfce7] text-[#15803d]";
  if (q === "YELLOW" || q === "MEDIUM") return "bg-[#fef9c3] text-[#a16207]";
  if (q === "RED" || q === "LOW") return "bg-[#fee2e2] text-[#b91c1c]";
  return "bg-[#f3f4f6] text-[#4b5563]";
}

export function NovaMessagingLimitCard({
  messagingLimit,
  isLive,
}: {
  messagingLimit: NonNullable<DashboardStats["messagingLimit"]>;
  isLive: boolean;
}) {
  const remaining =
    messagingLimit.remaining != null
      ? messagingLimit.remaining.toLocaleString()
      : messagingLimit.dailyLimit == null
        ? "Unlimited"
        : "—";

  const usedLine =
    messagingLimit.dailyLimit != null
      ? `${messagingLimit.usedToday.toLocaleString()} / ${messagingLimit.dailyLimit.toLocaleString()} used (24h)`
      : `${messagingLimit.usedToday.toLocaleString()} unique customers messaged (24h)`;

  return (
    <section
      className="mb-4 rounded-[14px] border border-[#eceef2] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:px-5"
      data-testid="messaging-limit-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6 sm:gap-10">
          <div>
            <p className="text-[12px] font-medium text-[#6b7280]">WhatsApp Business API Status</p>
            <span
              className={`mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[12px] font-semibold ${
                isLive ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#f3f4f6] text-[#4b5563]"
              }`}
            >
              {isLive ? "LIVE" : "Offline"}
            </span>
          </div>
          <div>
            <p className="text-[12px] font-medium text-[#6b7280]">Quality Rating</p>
            <span
              className={`mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[12px] font-semibold ${qualityTone(
                messagingLimit.qualityRating,
              )}`}
            >
              {qualityLabel(messagingLimit.qualityRating)}
            </span>
          </div>
          <div>
            <p className="text-[12px] font-medium text-[#6b7280]">Remaining Quota</p>
            <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-[#2563eb]">
              {remaining}
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[13px] font-semibold text-[#0f172a]">{messagingLimit.tierLabel}</p>
          <p className="mt-0.5 text-[11px] text-[#6b7280]">{usedLine}</p>
          <p className="mt-0.5 text-[11px] text-[#9ca3af]">
            Meta business-initiated conversations · rolling 24 hours
          </p>
        </div>
      </div>
    </section>
  );
}
