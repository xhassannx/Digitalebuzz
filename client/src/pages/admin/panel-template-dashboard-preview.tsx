import type { PanelTemplateId } from "@shared/panel-templates";
import { cn } from "@/lib/utils";

/** Shared demo numbers so every preview looks like a populated dashboard. */
const DEMO = {
  sent: "12,480",
  received: "8,942",
  contacts: "3,256",
  agents: "14",
  pending: "128",
  campaigns: "6",
  revenue: "$2,480",
  bars: [42, 68, 38, 86, 54, 72, 48] as const,
};

function MiniBars({
  colors,
  className,
}: {
  colors: { top: string; bottom: string };
  className?: string;
}) {
  return (
    <div className={cn("flex h-16 items-end gap-1", className)}>
      {DEMO.bars.map((h, i) => (
        <div key={i} className="flex w-2.5 flex-col justify-end overflow-hidden rounded-sm" style={{ height: `${h}%` }}>
          <div className="flex-1" style={{ backgroundColor: colors.top }} />
          <div style={{ height: "38%", backgroundColor: colors.bottom }} />
        </div>
      ))}
    </div>
  );
}

function StandardPreview() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-[#f4f4f5] text-[9px] leading-tight text-slate-700">
      <aside
        className="flex w-[28%] shrink-0 flex-col gap-1.5 p-2 text-white"
        style={{ background: "linear-gradient(180deg,#000328 0%,#00458e 100%)" }}
      >
        <div className="mb-1 font-semibold tracking-wide">Standard</div>
        <div className="rounded bg-white/20 px-1.5 py-1 text-[8px] font-medium">Dashboard</div>
        <div className="px-1.5 py-0.5 text-[8px] text-white/70">Inbox</div>
        <div className="px-1.5 py-0.5 text-[8px] text-white/70">Campaigns</div>
        <div className="px-1.5 py-0.5 text-[8px] text-white/70">Contacts</div>
        <div className="mt-auto rounded bg-blue-500 px-1.5 py-1 text-center text-[8px] font-semibold">
          Create Campaign
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-2">
        <div className="mb-2 flex items-center justify-between rounded bg-white px-2 py-1.5 shadow-sm">
          <span className="text-[8px] text-slate-400">Search…</span>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1e3a8a] text-[7px] text-white">
            A
          </span>
        </div>
        <div className="mb-1.5 text-[11px] font-bold text-slate-900">Welcome back, Admin!</div>
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          {[
            ["Messages Sent", DEMO.sent],
            ["Received", DEMO.received],
            ["Contacts", DEMO.contacts],
            ["Agents", DEMO.agents],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-slate-200 bg-white p-1.5 shadow-sm">
              <div className="text-[7px] text-slate-500">{label}</div>
              <div className="text-[11px] font-bold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-1.5 shadow-sm">
          <div className="mb-1 text-[8px] font-semibold text-slate-800">Message Activity</div>
          <MiniBars colors={{ top: "#93c5fd", bottom: "#1e40af" }} />
        </div>
      </main>
    </div>
  );
}

function EmeraldPreview() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-[#f5f5f5] text-[9px] leading-tight text-slate-700">
      <aside className="flex w-[28%] shrink-0 flex-col gap-1.5 border-r border-slate-200 bg-white p-2">
        <div className="mb-1 font-semibold text-[#047857]">Emerald</div>
        <div className="rounded-md bg-[#d1fae5] px-1.5 py-1 text-[8px] font-semibold text-[#047857]">
          Dashboard
        </div>
        <div className="px-1.5 py-0.5 text-[8px] text-slate-500">Inbox</div>
        <div className="px-1.5 py-0.5 text-[8px] text-slate-500">Campaigns</div>
        <div className="px-1.5 py-0.5 text-[8px] text-slate-500">FAQ Bot</div>
        <div className="mt-auto rounded-md bg-[#047857] px-1.5 py-1 text-center text-[8px] font-semibold text-white">
          + Create
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-2">
        <div className="mb-2 flex items-center justify-between rounded-lg bg-white px-2 py-1.5 shadow-sm">
          <span className="text-[8px] text-slate-400">Search flows, templates…</span>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#047857] text-[7px] text-white">
            A
          </span>
        </div>
        <div className="mb-0.5 flex items-start justify-between gap-1">
          <div>
            <div className="text-[11px] font-bold text-slate-900">Welcome back, Admin!</div>
            <div className="text-[7px] text-slate-500">
              <span className="text-blue-600">{DEMO.pending} pending leads</span>
              {" · "}
              <span className="text-[#047857]">{DEMO.campaigns} campaigns</span>
            </div>
          </div>
          <span className="shrink-0 rounded-md bg-[#047857] px-1.5 py-1 text-[7px] font-semibold text-white">
            Quick Send
          </span>
        </div>
        <div className="mb-1.5 mt-1.5 grid grid-cols-2 gap-1.5">
          {[
            ["Messages Sent", DEMO.sent],
            ["Received", DEMO.received],
            ["Contacts", DEMO.contacts],
            ["Agents", DEMO.agents],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
              <div className="mb-0.5 flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ecfdf5]" />
                <span className="rounded bg-[#d1fae5] px-1 text-[6px] font-medium text-[#047857]">+12%</span>
              </div>
              <div className="text-[7px] text-slate-500">{label}</div>
              <div className="text-[11px] font-bold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
            <div className="mb-1 text-[8px] font-semibold text-slate-800">Leads Overview</div>
            <div className="space-y-1">
              <div>
                <div className="mb-0.5 flex justify-between text-[6px] text-slate-500">
                  <span>TOTAL</span>
                  <span>{DEMO.contacts}</span>
                </div>
                <div className="h-1 overflow-hidden rounded bg-[#ecfdf5]">
                  <div className="h-full w-[100%] bg-[#047857]" />
                </div>
              </div>
              <div>
                <div className="mb-0.5 flex justify-between text-[6px] text-slate-500">
                  <span>PENDING</span>
                  <span>{DEMO.pending}</span>
                </div>
                <div className="h-1 overflow-hidden rounded bg-[#ecfdf5]">
                  <div className="h-full w-[42%] bg-[#10b981]" />
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
            <div className="mb-1 text-[8px] font-semibold text-slate-800">Message Activity</div>
            <MiniBars colors={{ top: "#cce2d9", bottom: "#047857" }} />
          </div>
        </div>
      </main>
    </div>
  );
}

function NovaPreview() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-[#f5f5f5] text-[9px] leading-tight text-slate-700">
      <aside className="flex w-[28%] shrink-0 flex-col gap-1.5 border-r border-slate-200 bg-white p-2">
        <div className="mb-1 font-semibold text-[#0059bb]">Nova</div>
        <div className="rounded-md bg-[#dfe8ff] px-1.5 py-1 text-[8px] font-semibold text-[#0059bb]">
          Dashboard
        </div>
        <div className="px-1.5 py-0.5 text-[8px] text-slate-500">Inbox</div>
        <div className="px-1.5 py-0.5 text-[8px] text-slate-500">Campaigns</div>
        <div className="px-1.5 py-0.5 text-[8px] text-slate-500">Chatbots</div>
        <div className="mt-auto rounded-md bg-[#0059bb] px-1.5 py-1 text-center text-[8px] font-semibold text-white">
          Create Campaign
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-2">
        <div className="mb-2 flex items-center justify-between rounded-lg bg-white px-2 py-1.5 shadow-sm">
          <span className="text-[8px] text-slate-400">Search contacts, messages…</span>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0059bb] text-[7px] text-white">
            A
          </span>
        </div>
        <div className="mb-0.5 text-[11px] font-bold text-slate-900">Hello Admin</div>
        <div className="mb-1.5 text-[7px] text-slate-500">Welcome back! Here&apos;s what&apos;s happening today</div>
        <div className="mb-1.5 grid grid-cols-3 gap-1">
          {[
            ["Contacts", DEMO.contacts],
            ["Revenue", DEMO.revenue],
            ["Campaigns", DEMO.campaigns],
            ["Sent", DEMO.sent],
            ["Received", DEMO.received],
            ["Agents", DEMO.agents],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-slate-200 bg-white p-1 shadow-sm">
              <div className="text-[6px] text-slate-500">{label}</div>
              <div
                className={cn(
                  "text-[10px] font-bold",
                  label === "Revenue" ? "text-green-600" : "text-slate-900",
                )}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[8px] font-semibold text-slate-800">Overview</span>
            <span className="rounded bg-[#dfe8ff] px-1 text-[6px] font-medium text-[#0059bb]">This week</span>
          </div>
          <MiniBars colors={{ top: "#93c5fd", bottom: "#0059bb" }} />
        </div>
      </main>
    </div>
  );
}

export function PanelTemplateDashboardPreview({
  templateId,
  className,
}: {
  templateId: PanelTemplateId;
  className?: string;
}) {
  return (
    <div className={cn("h-full w-full", className)} aria-hidden>
      {templateId === "helicoptic-v1" ? (
        <EmeraldPreview />
      ) : templateId === "ratehonk-v1" ? (
        <NovaPreview />
      ) : (
        <StandardPreview />
      )}
    </div>
  );
}
