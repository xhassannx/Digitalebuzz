// @ts-nocheck
/**
 * Atlas (Emerald) My Support — Rh-whatsapp Figma "My Support - Refined Aesthetic".
 *
 * UI-only reskin of the shared support feature. All data/behaviour comes from
 * useMySupportPage() so ticket creation, listing and portal links are unchanged.
 */
import { format } from "date-fns";
import {
  BookOpen,
  ExternalLink,
  Loader2,
  Paperclip,
  Plus,
  ShieldCheck,
  Ticket,
  Users,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMySupportPage, SUPPORT_STATUS_STYLES } from "@/features/my-support/useMySupportPage";
import { cn } from "@/lib/utils";
import { tokens } from "../tokens";
import { RhButton } from "../../ratehonk-v1/components/rh";

const RESOLVED_STATUSES = new Set(["resolved", "closed"]);

export default function AtlasMySupportPage() {
  const {
    open,
    setOpen,
    openCreateDialog,
    subject,
    setSubject,
    description,
    setDescription,
    phone,
    setPhone,
    file,
    setFile,
    fileInputRef,
    targetOrg,
    setTargetOrg,
    organizationsList,
    rows,
    isLoading,
    createMut,
    onCreate,
    openPortalWithoutReload,
    setLocation,
  } = useMySupportPage();

  const openCount = rows.filter((r) => !RESOLVED_STATUSES.has(r.status)).length;
  const resolvedCount = rows.filter((r) => RESOLVED_STATUSES.has(r.status)).length;

  return (
    <div
      className="atlas-support min-h-full w-full px-3 py-4 sm:px-5 sm:py-6 lg:px-6"
      data-testid="page-my-support"
      style={{ fontFamily: tokens.font.sans }}
    >
      <div className="mx-auto w-full max-w-6xl">
        {/* Header */}
        <header className="atlas-sup-header">
          <div className="min-w-0">
            <h1 className="atlas-sup-title">My support</h1>
            <p className="atlas-sup-subtitle">
              Manage your technical inquiries and get assistance with your WhatsApp automation
              flows.
            </p>
            <p className="atlas-sup-sla-note">
              Your ticket will be seen/opened within 2 hours, and you will get an update within 24
              hours after the ticket has been seen.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <button type="button" className="atlas-sup-new-btn" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              New ticket
            </button>
            <DialogContent className="sm:max-w-lg">
              <form onSubmit={onCreate} autoComplete="off">
                <DialogHeader>
                  <DialogTitle>Create ticket</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {organizationsList.length > 0 && (
                    <div>
                      <Label>Organization</Label>
                      <Select
                        value={targetOrg || organizationsList[0]?.id || ""}
                        onValueChange={setTargetOrg}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                        <SelectContent>
                          {organizationsList.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {organizationsList.length === 0 && (
                    <p className="text-sm text-amber-700">
                      You are not a member of any organization yet, so you cannot file a partner
                      ticket.
                    </p>
                  )}
                  <div>
                    <Label htmlFor="support-ticket-subject">Subject</Label>
                    <Input
                      id="support-ticket-subject"
                      name="support-ticket-subject"
                      autoComplete="off"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="support-ticket-description">Description</Label>
                    <Textarea
                      id="support-ticket-description"
                      name="support-ticket-description"
                      autoComplete="off"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      className="min-h-[110px]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="support-ticket-phone">Phone number</Label>
                    <Input
                      id="support-ticket-phone"
                      name="support-ticket-phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      required
                    />
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <RhButton
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4" />
                      Attachment
                    </RhButton>
                    {file ? (
                      <span className="ml-2 text-xs text-[#717786]">{file.name}</span>
                    ) : null}
                  </div>
                </div>
                <DialogFooter>
                  <RhButton
                    type="submit"
                    disabled={createMut.isPending || organizationsList.length === 0}
                  >
                    {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                  </RhButton>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {/* Two-column layout */}
        <div className="atlas-sup-grid">
          {/* Left: helper cards */}
          <aside className="atlas-sup-aside">
            <div className="atlas-sup-info-card">
              <span className="atlas-sup-info-icon" aria-hidden>
                <BookOpen className="h-5 w-5" strokeWidth={2} />
              </span>
              <h3 className="atlas-sup-info-title">Knowledge Base</h3>
              <p className="atlas-sup-info-text">
                Self-serve with our comprehensive guides on campaign setup and API integration.
              </p>
              <a
                href="https://help.whatsapp.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="atlas-sup-info-link"
              >
                Browse Documentation
                <span aria-hidden>→</span>
              </a>
            </div>

            <div className="atlas-sup-info-card">
              <span className="atlas-sup-info-icon atlas-sup-info-icon--alt" aria-hidden>
                <Users className="h-5 w-5" strokeWidth={2} />
              </span>
              <h3 className="atlas-sup-info-title">Community Slack</h3>
              <p className="atlas-sup-info-text">
                Join 5,000+ power users sharing automation flows and strategies.
              </p>
              <button type="button" className="atlas-sup-join-btn" onClick={openCreateDialog}>
                Join Channel
              </button>
            </div>
          </aside>

          {/* Right: tickets */}
          <section className="atlas-sup-tickets">
            <div className="atlas-sup-tickets-head">
              <div className="min-w-0">
                <h2 className="atlas-sup-tickets-title">Your tickets</h2>
                <p className="atlas-sup-tickets-sub">
                  Click a ticket row to open full details and conversation.
                </p>
              </div>
              <div className="atlas-sup-counts">
                <span className="atlas-sup-count atlas-sup-count--open">{openCount} Open</span>
                <span className="atlas-sup-count atlas-sup-count--resolved">
                  {resolvedCount} Resolved
                </span>
              </div>
            </div>

            <div className="atlas-sup-tickets-body">
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--rh-brand,#047857)]" />
                </div>
              ) : rows.length === 0 ? (
                <div className="atlas-sup-empty">
                  <div className="atlas-sup-empty-icon" aria-hidden>
                    <Ticket className="h-7 w-7" strokeWidth={1.75} />
                  </div>
                  <p className="atlas-sup-empty-title">No tickets yet</p>
                  <p className="atlas-sup-empty-desc">
                    Your active and past support requests will appear here.
                  </p>
                </div>
              ) : (
                <ul className="atlas-sup-list">
                  {rows.map((r) => (
                    <li key={r.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        className="atlas-sup-row"
                        onClick={() => setLocation(`/my-support/${r.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setLocation(`/my-support/${r.id}`);
                          }
                        }}
                      >
                        <span className="atlas-sup-row-id">#{r.ticketNumber}</span>
                        <div className="atlas-sup-row-main">
                          <span className="atlas-sup-row-subject">{r.subject}</span>
                          <span className="atlas-sup-row-date">
                            {r.updatedAt
                              ? format(new Date(r.updatedAt), "MMM d, yyyy HH:mm")
                              : "—"}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "atlas-sup-row-status",
                            SUPPORT_STATUS_STYLES[r.status] || "bg-[#f3f4f6] text-[#414754]",
                          )}
                        >
                          {r.status.replace(/_/g, " ")}
                        </span>
                        <button
                          type="button"
                          className="atlas-sup-row-open"
                          onClick={(e) => openPortalWithoutReload(r.customerViewUrl, e)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="atlas-sup-trust">
              <span className="atlas-sup-trust-item">
                <Zap className="h-3.5 w-3.5" strokeWidth={2.25} />
                Avg. response under 2h
              </span>
              <span className="atlas-sup-trust-item">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
                24/7 Monitoring
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
