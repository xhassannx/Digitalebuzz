import { useMemo, useState } from "react";
import { ChevronRight, GripVertical, MessageCircle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrganizationLeadRow } from "@/pages/leads-page";
import {
  buildLeadColumnOrder,
  groupLeadsByStatus,
  priorityClass,
  type OrganizationLeadStatusRow,
} from "./lead-utils";
import { ChangeLeadStatusModal } from "./change-lead-status-modal";

const LEAD_DRAG_MIME = "application/x-lead-id";

type DropHint = {
  statusSlug: string;
  insertIndex: number;
};

type LeadsKanbanBoardProps = {
  leads: OrganizationLeadRow[];
  statuses: OrganizationLeadStatusRow[];
  canEdit: boolean;
  onOpenWhatsApp: (lead: OrganizationLeadRow) => void;
  onMoveLead: (leadId: string, statusSlug: string) => void;
  onReorderLeads: (statusSlug: string, orderedIds: string[]) => void;
  onAddLead?: (statusSlug: string) => void;
  onEditLead?: (lead: OrganizationLeadRow) => void;
  onChangeLeadStatus?: (leadId: string, statusSlug: string) => Promise<void>;
  onDeleteLead?: (lead: OrganizationLeadRow) => void;
  className?: string;
};

function formatPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return digits ? `+${digits}` : phone;
}

function DropIndicator() {
  return <div className="h-0.5 shrink-0 rounded-full bg-[#0059bb] shadow-[0_0_0_1px_rgba(0,89,187,0.25)]" />;
}

export function LeadsKanbanBoard({
  leads,
  statuses,
  canEdit,
  onOpenWhatsApp,
  onMoveLead,
  onReorderLeads,
  onAddLead,
  onEditLead,
  onChangeLeadStatus,
  onDeleteLead,
  className,
}: LeadsKanbanBoardProps) {
  const grouped = useMemo(() => groupLeadsByStatus(leads, statuses), [leads, statuses]);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const [statusModalLead, setStatusModalLead] = useState<OrganizationLeadRow | null>(null);

  const handleDragStart = (e: React.DragEvent, lead: OrganizationLeadRow) => {
    if (!canEdit) return;
    if ((e.target as HTMLElement).closest("button")) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(LEAD_DRAG_MIME, lead.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingLeadId(lead.id);
  };

  const handleDragEnd = () => {
    setDraggingLeadId(null);
    setDropHint(null);
  };

  const setInsertHint = (statusSlug: string, insertIndex: number) => {
    setDropHint({ statusSlug, insertIndex });
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    if (!canEdit) return;
    if (!e.dataTransfer.types.includes(LEAD_DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleCardDragOver = (
    e: React.DragEvent,
    statusSlug: string,
    cardIndex: number,
  ) => {
    if (!canEdit) return;
    if (!e.dataTransfer.types.includes(LEAD_DRAG_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    setInsertHint(statusSlug, before ? cardIndex : cardIndex + 1);
  };

  const handleColumnDrop = (e: React.DragEvent, statusSlug: string, columnLeads: OrganizationLeadRow[]) => {
    if (!canEdit) return;
    e.preventDefault();
    const leadId = e.dataTransfer.getData(LEAD_DRAG_MIME) || draggingLeadId;
    setDraggingLeadId(null);
    const insertIndex =
      dropHint?.statusSlug === statusSlug
        ? dropHint.insertIndex
        : columnLeads.filter((lead) => lead.id !== leadId).length;
    setDropHint(null);
    if (!leadId) return;

    const draggedLead = leads.find((lead) => lead.id === leadId);
    const statusChanged = Boolean(draggedLead && draggedLead.status !== statusSlug);

    // Cross-column moves go through status PATCH so drip campaigns enroll.
    if (statusChanged) {
      onMoveLead(leadId, statusSlug);
      return;
    }

    const orderedIds = buildLeadColumnOrder(columnLeads, leadId, insertIndex);
    const unchanged =
      orderedIds.length === columnLeads.length &&
      orderedIds.every((id, index) => columnLeads[index]?.id === id);
    if (unchanged) return;

    onReorderLeads(statusSlug, orderedIds);
  };

  return (
    <>
    <div className={cn("flex h-full min-h-0 gap-4 overflow-x-auto pb-2", className)}>
      {statuses.map((status) => {
        const columnLeads = grouped.get(status.slug) ?? [];
        const isDropTarget = dropHint?.statusSlug === status.slug && draggingLeadId !== null;
        return (
          <div
            key={status.id}
            className="flex h-full max-h-full w-[280px] shrink-0 flex-col rounded-xl border border-[#e5e7eb] bg-[#f8fafc]/80"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#e5e7eb] px-3 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold text-[#111c2d] truncate"
                  style={{ backgroundColor: status.color }}
                >
                  {status.name}
                </span>
                <span className="text-sm font-medium text-[#717786] tabular-nums">({columnLeads.length})</span>
              </div>
              {canEdit && onAddLead && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-[#717786] hover:text-[#0059bb]"
                  onClick={() => onAddLead(status.slug)}
                  title="Add lead"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2 transition-colors",
                isDropTarget && "rounded-b-xl bg-[#0059bb]/10 ring-2 ring-inset ring-[#0059bb]/40",
              )}
              onDragOver={(e) => {
                handleColumnDragOver(e);
                if (!draggingLeadId) return;
                setInsertHint(
                  status.slug,
                  columnLeads.filter((lead) => lead.id !== draggingLeadId).length,
                );
              }}
              onDrop={(e) => handleColumnDrop(e, status.slug, columnLeads)}
            >
              {columnLeads.length === 0 ? (
                <div
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center",
                    isDropTarget ? "border-[#0059bb] bg-white/80" : "border-[#e5e7eb] bg-white/60",
                  )}
                  onDragOver={(e) => {
                    handleColumnDragOver(e);
                    setInsertHint(status.slug, 0);
                  }}
                  onDrop={(e) => handleColumnDrop(e, status.slug, columnLeads)}
                >
                  <p className="text-sm text-[#717786]">
                    {isDropTarget ? "Drop lead here" : "No leads yet"}
                  </p>
                  {canEdit && onAddLead && !isDropTarget && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-[#0059bb]"
                      onClick={() => onAddLead(status.slug)}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add lead
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {dropHint?.statusSlug === status.slug && dropHint.insertIndex === 0 && <DropIndicator />}
                  {columnLeads.map((lead, index) => {
                    const hasName = Boolean(lead.name?.trim());
                    const displayName = lead.name?.trim() || formatPhone(lead.phoneNumber);
                    const formattedPhone = formatPhone(lead.phoneNumber);
                    const phoneLine = hasName && formattedPhone ? formattedPhone : "";
                    const detailLine = hasName
                      ? lead.email?.trim() || lead.firstMessagePreview?.trim() || ""
                      : lead.email?.trim() || lead.firstMessagePreview?.trim() || "";
                    const isDragging = draggingLeadId === lead.id;
                    return (
                      <div key={lead.id} className="flex flex-col gap-2">
                        <div
                          draggable={canEdit}
                          onDragStart={(e) => handleDragStart(e, lead)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleCardDragOver(e, status.slug, index)}
                          onDrop={(e) => handleColumnDrop(e, status.slug, columnLeads)}
                          className={cn(
                            "rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-sm transition-shadow",
                            canEdit && "cursor-grab active:cursor-grabbing",
                            isDragging && "opacity-50 ring-2 ring-[#0059bb]/50",
                            !isDragging && "hover:shadow",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 flex items-start gap-1.5">
                              {canEdit && (
                                <GripVertical
                                  className="mt-0.5 h-4 w-4 shrink-0 text-[#9ca3af]"
                                  aria-hidden
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-[#111c2d] truncate capitalize">{displayName}</p>
                                {phoneLine ? (
                                  <p className="text-xs text-[#717786] truncate mt-0.5">{phoneLine}</p>
                                ) : null}
                                {detailLine ? (
                                  <p className="text-xs text-[#717786] truncate mt-0.5">{detailLine}</p>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              {canEdit && onEditLead && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 rounded-md"
                                  onClick={() => onEditLead(lead)}
                                  title="Edit lead"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md"
                                onClick={() => onOpenWhatsApp(lead)}
                                title="Open in WhatsApp"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-xs text-[#717786]">Score: {lead.score}</span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide capitalize",
                                priorityClass(lead.priority),
                              )}
                            >
                              {lead.priority}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-center gap-2 border-t border-[#e5e7eb] pt-2">
                            {canEdit && onDeleteLead && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => onDeleteLead(lead)}
                                title="Delete lead"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canEdit && onChangeLeadStatus && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[#0059bb] hover:bg-[#0059bb]/10 hover:text-[#004a9a]"
                                onClick={() => setStatusModalLead(lead)}
                                title="Change status"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                              onClick={() => onOpenWhatsApp(lead)}
                              title="Open in WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {dropHint?.statusSlug === status.slug && dropHint.insertIndex === index + 1 && (
                          <DropIndicator />
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>

    {onChangeLeadStatus && (
      <ChangeLeadStatusModal
        open={!!statusModalLead}
        onOpenChange={(open) => {
          if (!open) setStatusModalLead(null);
        }}
        lead={statusModalLead}
        statuses={statuses}
        onSelectStatus={async (statusSlug) => {
          if (!statusModalLead) return;
          await onChangeLeadStatus(statusModalLead.id, statusSlug);
        }}
      />
    )}
    </>
  );
}
