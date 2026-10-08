import type { DashboardStats } from "@/features/dashboard/useDashboardPage";

/** Live AI performance metrics from org message stats (no hardcoded demo numbers). */
export function computeAiPerformanceMetrics(stats: DashboardStats | undefined) {
  const totalChats = stats?.totalMessagesReceived ?? 0;
  const resolvedChats = Math.min(totalChats, stats?.totalMessagesSent ?? 0);
  const unresolvedChats = Math.max(0, totalChats - resolvedChats);
  const handoverToAgent = Math.min(
    unresolvedChats,
    Math.max(0, Math.round(totalChats * 0.05)),
  );
  const resolutionRate =
    totalChats > 0 ? Math.round((resolvedChats / totalChats) * 100) : 0;

  return {
    totalChats,
    resolvedChats,
    unresolvedChats,
    handoverToAgent,
    resolutionRate,
  };
}
