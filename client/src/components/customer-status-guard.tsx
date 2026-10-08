import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import PanelBlockedPage from "@/pages/panel-blocked-page";

type BlockReason = {
  code: string;
  error: string;
  expired_at?: string;
  data_deletion_at?: string;
  retention_days?: number;
};

export function CustomerStatusGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
