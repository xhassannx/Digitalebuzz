"use client";

import { format } from "date-fns";
import {
  Bell,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  List,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  ArrowUpDown,
  Video,
  FileText,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, getPastelColorForName } from "@/lib/utils";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import {
  reminderDueStatus,
  reminderTitle,
  getTemplateBodyText,
  useRemindersPage,
  type ReminderTab,
} from "@/features/reminders/useRemindersPage";

const TAB_OPTIONS: { value: ReminderTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "due_today", label: "Due today" },
  { value: "overdue", label: "Overdue" },
  { value: "upcoming", label: "Upcoming" },
];

export default function RemindersPage() {
  const skin = useRatehonkPageSkin();
  const p = useRemindersPage();

  const allOnPageSelected =
    p.reminders.length > 0 && p.reminders.every((r) => p.selectedIds.has(r.id));

  const primaryBtn = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white"
    : "";
  const outlineClass = skin ? "rounded-xl border-[#e5e7eb]" : "";

  return (
    <TooltipProvider delayDuration={200}>
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        skin ? "gap-3" : "gap-4 p-4 md:p-6",
        "atlas-reminders rh-reminders-tasks",
      )}
      data-testid="page-reminders"
    >
      {/* Header */}
      <div className="atlas-rem-page-hero atlas-rem-page-hero--v2 shrink-0">
        <div className="atlas-rem-page-hero-glow" aria-hidden />
        <div className="atlas-rem-page-hero-inner">
          <div className="min-w-0 flex-1">
            <p className="atlas-rem-page-hero-eyebrow">Follow-ups & callbacks</p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="atlas-rem-page-hero-title">Reminders</h1>
              <Badge variant="secondary" className="atlas-rem-page-hero-badge">
                {p.totalCount} Reminder{p.totalCount === 1 ? "" : "s"}
              </Badge>
            </div>
            <p className="atlas-rem-page-hero-desc">
              View and manage all your reminders. Open a contact from the associated contact column.
            </p>
          </div>
          <Button
            className={cn("atlas-rem-page-hero-cta shrink-0", primaryBtn, skin && "rounded-xl")}
            onClick={p.openAdd}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Reminder
          </Button>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-[#e5e7eb] pb-0">
        <span className="mr-1 inline-flex h-8 w-8 items-center justify-center text-[var(--rh-brand,#047857)]">
          <List className="h-4 w-4" />
        </span>
        {TAB_OPTIONS.map((opt) => {
          const active = p.tab === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => p.setTab(opt.value)}
              className={cn(
                "relative px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "text-[var(--rh-brand,#047857)]"
                  : "text-[#717786] hover:text-[#111c2d]",
              )}
            >
              {opt.label}
              {active && (
                <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-[var(--rh-brand,#047857)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Select value={p.assigneeFilter} onValueChange={p.setAssigneeFilter}>
          <SelectTrigger className={cn("h-9 w-[150px]", outlineClass)}>
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Assignee: Any</SelectItem>
            {p.members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {p.memberLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={p.statusFilter} onValueChange={p.setStatusFilter}>
          <SelectTrigger className={cn("h-9 w-[140px]", outlineClass)}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status: All</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="due_today">Due today</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 min-w-[200px] justify-start gap-1.5 font-normal",
                  outlineClass,
                  !(p.dateFromFilter || p.dateToFilter) && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                {p.dateFromFilter || p.dateToFilter
                  ? `${p.dateFromFilter ? format(new Date(`${p.dateFromFilter}T00:00:00`), "MMM d, yyyy") : "…"} – ${p.dateToFilter ? format(new Date(`${p.dateToFilter}T00:00:00`), "MMM d, yyyy") : "…"}`
                  : "Date range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex flex-col gap-3 p-3 sm:flex-row sm:gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Calendar
                    mode="single"
                    selected={
                      p.dateFromFilter
                        ? new Date(`${p.dateFromFilter}T00:00:00`)
                        : undefined
                    }
                    onSelect={(d) =>
                      p.setDateFromFilter(d ? format(d, "yyyy-MM-dd") : "")
                    }
                    initialFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Calendar
                    mode="single"
                    selected={
                      p.dateToFilter
                        ? new Date(`${p.dateToFilter}T00:00:00`)
                        : undefined
                    }
                    onSelect={(d) =>
                      p.setDateToFilter(d ? format(d, "yyyy-MM-dd") : "")
                    }
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {(p.dateFromFilter || p.dateToFilter) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              aria-label="Clear date range"
              onClick={() => {
                p.setDateFromFilter("");
                p.setDateToFilter("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-9 gap-1.5", outlineClass)}
          onClick={() => p.setSortDir(p.sortDir === "asc" ? "desc" : "asc")}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort ({p.sortDir === "asc" ? "Soonest" : "Latest"})
        </Button>

        <div className="relative ml-auto min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={p.search}
            onChange={(e) => p.setSearch(e.target.value)}
            placeholder="Search reminders…"
            className={cn("h-9 pl-9", outlineClass)}
          />
        </div>
      </div>

      {/* Table */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white",
          "rh-reminders-table-card",
        )}
      >
        {p.isLoading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--rh-brand,#047857)]" />
          </div>
        ) : p.reminders.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--rh-brand,#047857)_10%,white)] text-[var(--rh-brand,#047857)]">
              <Bell className="h-7 w-7" />
            </div>
            <p className="font-medium text-[#111c2d]">No reminders found</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{p.emptyHint}</p>
            <Button className={cn("mt-4", primaryBtn, skin && "rounded-xl")} onClick={p.openAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Reminder
            </Button>
          </div>
        ) : (
          <>
            <div className="rh-reminders-table-scroll min-h-0 flex-1 overflow-auto">
              <Table className="min-w-[1080px]">
                <TableHeader>
                  <TableRow className="bg-[var(--rh-brand-soft,#ecfdf5)] hover:bg-[var(--rh-brand-soft,#ecfdf5)]">
                    <TableHead className="sticky top-0 z-10 w-10 bg-[var(--rh-brand-soft,#ecfdf5)]">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={() => p.toggleSelectAllOnPage()}
                        aria-label="Select all on page"
                      />
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 w-12 bg-[#f8faf9]">Status</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-[#f8faf9]">Title</TableHead>
                    <TableHead className="sticky top-0 z-10 min-w-[180px] bg-[#f8faf9]">Description</TableHead>
                    <TableHead className="sticky top-0 z-10 min-w-[160px] bg-[#f8faf9]">Notes</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-[#f8faf9]">Associated Contacts</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-[#f8faf9]">Phone</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-[#f8faf9]">Assignee</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-[#f8faf9]">Due Date</TableHead>
                    <TableHead className="sticky top-0 z-10 w-[100px] bg-[#f8faf9] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.reminders.map((r) => {
                    const status = reminderDueStatus(r.reminderAt);
                    const overdue = status === "overdue";
                    const pastel = getPastelColorForName(r.contactName);
                    const initials = r.contactName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    return (
                      <TableRow key={r.id} className="group">
                        <TableCell>
                          <Checkbox
                            checked={p.selectedIds.has(r.id)}
                            onCheckedChange={() => p.toggleSelect(r.id)}
                            aria-label={`Select ${reminderTitle(r.title, r.message)}`}
                          />
                        </TableCell>
                        <TableCell>
                          {overdue ? (
                            <Circle className="h-5 w-5 text-red-500" strokeWidth={2} />
                          ) : status === "due_today" ? (
                            <CheckCircle2 className="h-5 w-5 text-amber-500" strokeWidth={2} />
                          ) : (
                            <Circle className="h-5 w-5 text-[#c5cad3]" strokeWidth={2} />
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] font-medium text-[#111c2d]">
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => p.openContactChat(r.contactId)}
                          >
                            {reminderTitle(r.title, r.message)}
                          </button>
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="line-clamp-2 cursor-default text-sm text-[#717786]">
                                {r.templateName
                                  ? `Template: ${r.templateName}`
                                  : r.message}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-sm border-0 bg-[#111827] px-3 py-2 text-sm text-white shadow-lg"
                            >
                              {r.templateName
                                ? `WhatsApp template “${r.templateName}”${
                                    r.whatsappStatus && r.whatsappStatus !== "none"
                                      ? ` · ${r.whatsappStatus}`
                                      : ""
                                  }`
                                : r.message}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {r.notes?.trim() ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="line-clamp-2 cursor-default text-sm text-[#717786]">
                                  {r.notes}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-sm border-0 bg-[#111827] px-3 py-2 text-sm text-white shadow-lg"
                              >
                                {r.notes}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-sm text-[#c5cad3]">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex max-w-[160px] items-center gap-2 rounded-full pr-2 hover:bg-muted/60"
                                onClick={() => p.openContactChat(r.contactId)}
                              >
                                <span
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                                  style={{ backgroundColor: pastel.bgStyle, color: pastel.textStyle }}
                                >
                                  {initials || "?"}
                                </span>
                                <span className="truncate text-sm text-[#111c2d]">
                                  {r.contactName}
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="border-0 bg-[#111827] px-3 py-1.5 text-sm text-white shadow-lg"
                            >
                              {r.contactName}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-sm text-[#414754]">
                          {r.contactPhone || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-[#414754]">
                          {r.assigneeName || "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "whitespace-nowrap text-sm",
                            overdue ? "font-medium text-red-600" : "text-[#414754]",
                          )}
                        >
                          {format(new Date(r.reminderAt), "MMM d, yyyy · h:mm a")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[#717786]"
                              onClick={() => p.openEdit(r)}
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[#717786] hover:text-red-600"
                              onClick={() => p.setDeleteItem(r)}
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#e5e7eb] px-4 py-2.5 text-sm text-[#717786]">
              <span>
                Page {p.page} of {p.totalPages}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={String(p.pageSize)}
                  onValueChange={(v) => p.setPageSize(Number(v))}
                >
                  <SelectTrigger className={cn("h-8 w-[90px]", outlineClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className={outlineClass}
                  disabled={p.page <= 1}
                  onClick={() => p.setPage(p.page - 1)}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={outlineClass}
                  disabled={p.page >= p.totalPages}
                  onClick={() => p.setPage(p.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Reminder */}
      <Dialog open={p.addOpen} onOpenChange={p.setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Reminder</DialogTitle>
            <DialogDescription>Create a reminder linked to a contact.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Contact</Label>
              <Input
                placeholder="Search contacts by name or phone…"
                value={p.formContactSearch}
                onChange={(e) => {
                  p.setFormContactSearch(e.target.value);
                  p.setFormContactId("");
                }}
                className={outlineClass}
              />
              {p.formContactSearch.trim() && (
                <div className="max-h-36 overflow-auto rounded-lg border border-[#e5e7eb]">
                  {p.contactSearchResults.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No contacts found</p>
                  ) : (
                    p.contactSearchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={cn(
                          "flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted/60",
                          p.formContactId === c.id && "bg-[color-mix(in_srgb,var(--rh-brand,#047857)_10%,white)]",
                        )}
                        onClick={() => {
                          p.setFormContactId(c.id);
                          p.setFormContactSearch(c.name || c.phoneNumber || c.id);
                        }}
                      >
                        <span className="font-medium">{c.name || c.phoneNumber || "Contact"}</span>
                        {c.name && c.phoneNumber ? (
                          <span className="text-xs text-muted-foreground">{c.phoneNumber}</span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={p.formTitle}
                onChange={(e) => p.setFormTitle(e.target.value)}
                placeholder="Short reminder title"
                className={outlineClass}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Message</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {p.formUseTemplate ? "Template" : "Write message"}
                  </span>
                  <Switch
                    checked={p.formUseTemplate}
                    onCheckedChange={p.setFormUseTemplate}
                    aria-label="Use WhatsApp template"
                  />
                </div>
              </div>
              {p.formUseTemplate ? (
                <div className="space-y-3">
                  <Select
                    value={p.formTemplateId || undefined}
                    onValueChange={p.selectTemplate}
                  >
                    <SelectTrigger className={outlineClass}>
                      <SelectValue
                        placeholder={
                          p.templatesLoading
                            ? "Loading templates…"
                            : p.officialSession
                              ? "Select WhatsApp template"
                              : "Connect WhatsApp Business first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {p.approvedTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.name}>
                          {t.name}
                          {t.language ? ` (${t.language})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {p.formTemplateId ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f8faf9] px-3 py-2 text-sm">
                      <span className="font-medium text-[#111c2d]">{p.formTemplateId}</span>
                      {(p.formHeaderImageUrl || p.formHeaderVideoUrl || p.formHeaderDocumentUrl || p.formTemplateParams.length > 0) && (
                        <span className="text-xs text-muted-foreground">
                          {[
                            p.formHeaderImageUrl || p.formHeaderVideoUrl || p.formHeaderDocumentUrl ? "media set" : null,
                            p.formTemplateParams.length ? `${p.formTemplateParams.length} variable(s)` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn("ml-auto h-8", outlineClass)}
                        onClick={p.reopenTemplateConfig}
                      >
                        Edit media / variables
                      </Button>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Selecting a template opens a popup to set image/video and variables. It sends automatically at the due date.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    value={p.formMessage}
                    onChange={(e) => p.setFormMessage(e.target.value)}
                    placeholder="What needs to be done?"
                    rows={3}
                    className={outlineClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    This message is sent on WhatsApp automatically at the due date.
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={p.formNotes}
                onChange={(e) => p.setFormNotes(e.target.value)}
                placeholder="Internal notes (not sent on WhatsApp)"
                rows={2}
                className={outlineClass}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select value={p.formReminderTo || undefined} onValueChange={p.setFormReminderTo}>
                  <SelectTrigger className={outlineClass}>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {p.members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {p.memberLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input
                  type="datetime-local"
                  value={p.formReminderAt}
                  onChange={(e) => p.setFormReminderAt(e.target.value)}
                  className={outlineClass}
                />
                <p className="text-xs text-muted-foreground">Timezone: Asia/Kolkata (IST)</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className={outlineClass} onClick={() => p.setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              className={cn(primaryBtn, skin && "rounded-xl")}
              disabled={p.createMutation.isPending}
              onClick={() => p.createMutation.mutate()}
            >
              {p.createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Reminder */}
      <Dialog open={!!p.editItem} onOpenChange={(open) => !open && p.setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Reminder</DialogTitle>
            <DialogDescription>
              {p.editItem ? `Contact: ${p.editItem.contactName}` : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={p.formTitle}
                onChange={(e) => p.setFormTitle(e.target.value)}
                placeholder="Short reminder title"
                className={outlineClass}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Message</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {p.formUseTemplate ? "Template" : "Write message"}
                  </span>
                  <Switch
                    checked={p.formUseTemplate}
                    onCheckedChange={p.setFormUseTemplate}
                    aria-label="Use WhatsApp template"
                  />
                </div>
              </div>
              {p.formUseTemplate ? (
                <div className="space-y-3">
                  <Select
                    value={p.formTemplateId || undefined}
                    onValueChange={p.selectTemplate}
                  >
                    <SelectTrigger className={outlineClass}>
                      <SelectValue
                        placeholder={
                          p.templatesLoading
                            ? "Loading templates…"
                            : p.officialSession
                              ? "Select WhatsApp template"
                              : "Connect WhatsApp Business first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {p.approvedTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.name}>
                          {t.name}
                          {t.language ? ` (${t.language})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {p.formTemplateId ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f8faf9] px-3 py-2 text-sm">
                      <span className="font-medium text-[#111c2d]">{p.formTemplateId}</span>
                      {(p.formHeaderImageUrl || p.formHeaderVideoUrl || p.formHeaderDocumentUrl || p.formTemplateParams.length > 0) && (
                        <span className="text-xs text-muted-foreground">
                          {[
                            p.formHeaderImageUrl || p.formHeaderVideoUrl || p.formHeaderDocumentUrl ? "media set" : null,
                            p.formTemplateParams.length ? `${p.formTemplateParams.length} variable(s)` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn("ml-auto h-8", outlineClass)}
                        onClick={p.reopenTemplateConfig}
                      >
                        Edit media / variables
                      </Button>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Selecting a template opens a popup to set image/video and variables. It sends automatically at the due date.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    value={p.formMessage}
                    onChange={(e) => p.setFormMessage(e.target.value)}
                    placeholder="What needs to be done?"
                    rows={3}
                    className={outlineClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    This message is sent on WhatsApp automatically at the due date.
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={p.formNotes}
                onChange={(e) => p.setFormNotes(e.target.value)}
                placeholder="Internal notes (not sent on WhatsApp)"
                rows={2}
                className={outlineClass}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select value={p.formReminderTo || undefined} onValueChange={p.setFormReminderTo}>
                  <SelectTrigger className={outlineClass}>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {p.members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {p.memberLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input
                  type="datetime-local"
                  value={p.formReminderAt}
                  onChange={(e) => p.setFormReminderAt(e.target.value)}
                  className={outlineClass}
                />
                <p className="text-xs text-muted-foreground">Timezone: Asia/Kolkata (IST)</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className={outlineClass} onClick={() => p.setEditItem(null)}>
              Cancel
            </Button>
            <Button
              className={cn(primaryBtn, skin && "rounded-xl")}
              disabled={p.updateMutation.isPending}
              onClick={() => p.updateMutation.mutate()}
            >
              {p.updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template media / variables config */}
      <Dialog
        open={p.templateConfigOpen}
        onOpenChange={(open) => {
          if (!open) p.cancelTemplateConfig();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure template</DialogTitle>
            <DialogDescription>
              {p.draftTemplate
                ? `Set media and variables for “${p.draftTemplate.name}”.`
                : "Set media and variables for the selected template."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {p.draftTemplate ? (
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f8faf9] p-3 text-sm text-[#414754]">
                <p className="font-medium text-[#111c2d]">{p.draftTemplate.name}</p>
                {getTemplateBodyText(p.draftTemplate) ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {getTemplateBodyText(p.draftTemplate)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {p.draftTemplateParams.length > 0 && (
              <div className="space-y-3">
                <Label>Variables</Label>
                {p.draftTemplateParams.map((val, idx) => (
                  <div key={idx} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{`{{${idx + 1}}}`}</Label>
                    <Input
                      value={val}
                      onChange={(e) => {
                        const next = [...p.draftTemplateParams];
                        next[idx] = e.target.value;
                        p.setDraftTemplateParams(next);
                      }}
                      placeholder={`Value for {{${idx + 1}}}`}
                      className={outlineClass}
                    />
                  </div>
                ))}
              </div>
            )}

            {(p.draftHeaderFormat === "IMAGE" ||
              p.draftHeaderFormat === "VIDEO" ||
              p.draftHeaderFormat === "DOCUMENT") && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  {p.draftHeaderFormat === "IMAGE" ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : p.draftHeaderFormat === "VIDEO" ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {p.draftHeaderFormat === "IMAGE"
                    ? "Header image"
                    : p.draftHeaderFormat === "VIDEO"
                      ? "Header video"
                      : "Header document"}
                </Label>

                {(p.draftHeaderImageUrl || p.draftHeaderVideoUrl || p.draftHeaderDocumentUrl) && (
                  <div className="overflow-hidden rounded-lg border border-[#e5e7eb]">
                    {p.draftHeaderFormat === "IMAGE" && p.draftHeaderImageUrl ? (
                      <img
                        src={p.draftHeaderImageUrl}
                        alt="Header preview"
                        className="max-h-48 w-full object-cover"
                      />
                    ) : p.draftHeaderFormat === "VIDEO" && p.draftHeaderVideoUrl ? (
                      <video
                        src={p.draftHeaderVideoUrl}
                        controls
                        className="max-h-48 w-full bg-black"
                      />
                    ) : (
                      <p className="truncate px-3 py-2 text-xs text-muted-foreground">
                        {p.draftHeaderDocumentUrl}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    value={p.draftMediaUrlInput}
                    onChange={(e) => p.setDraftMediaUrlInput(e.target.value)}
                    placeholder="Paste media URL (https://…)"
                    className={outlineClass}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className={outlineClass}
                    onClick={() => void p.applyDraftMediaUrl()}
                    disabled={!p.draftMediaUrlInput.trim()}
                  >
                    Use URL
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept={
                      p.draftHeaderFormat === "IMAGE"
                        ? "image/*"
                        : p.draftHeaderFormat === "VIDEO"
                          ? "video/*"
                          : "*/*"
                    }
                    className={cn("cursor-pointer", outlineClass)}
                    disabled={p.mediaUploading || !p.officialSession}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void p.uploadDraftMediaFile(file);
                      e.target.value = "";
                    }}
                  />
                  {p.mediaUploading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Required for this template. Paste a public URL or upload a file.
                </p>
              </div>
            )}

            {!p.draftTemplateParams.length &&
              p.draftHeaderFormat !== "IMAGE" &&
              p.draftHeaderFormat !== "VIDEO" &&
              p.draftHeaderFormat !== "DOCUMENT" && (
                <p className="text-sm text-muted-foreground">
                  This template has no media header or variables. Confirm to use it.
                </p>
              )}
          </div>

          <DialogFooter>
            <Button variant="outline" className={outlineClass} onClick={p.cancelTemplateConfig}>
              Cancel
            </Button>
            <Button
              className={cn(primaryBtn, skin && "rounded-xl")}
              onClick={p.confirmTemplateConfig}
              disabled={!p.draftTemplate}
            >
              Use template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!p.deleteItem} onOpenChange={(open) => !open && p.setDeleteItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete reminder?</DialogTitle>
            <DialogDescription>
              This will permanently remove the reminder
              {p.deleteItem ? ` for ${p.deleteItem.contactName}` : ""}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className={outlineClass} onClick={() => p.setDeleteItem(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={p.deleteMutation.isPending}
              onClick={() => p.deleteItem && p.deleteMutation.mutate(p.deleteItem)}
            >
              {p.deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
