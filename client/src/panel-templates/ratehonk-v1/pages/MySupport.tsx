// @ts-nocheck
/**
 * RateHonk Support — Figma node 1:1563
 */
import { format } from "date-fns";
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
import { ExternalLink, Loader2, Paperclip, Plus } from "lucide-react";
import {
  RhButton,
  RhCard,
  RhEmptyState,
  RhPageHeader,
  RhPageLayout,
} from "../components/rh";
import { cn } from "@/lib/utils";

export default function RatehonkMySupportPage() {
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

  return (
    <RhPageLayout className="mx-auto max-w-6xl">
      <RhPageHeader
        title="Support"
        description="Tickets you opened with a partner organization."
        actions={
          <Dialog
            open={open}
            onOpenChange={setOpen}
          >
            <RhButton type="button" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              New ticket
            </RhButton>
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
        }
      />

      <RhCard className="overflow-hidden p-0">
        <div className="border-b border-[#e5e7eb] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#111c2d]">Your tickets</h2>
          <p className="text-sm text-[#717786]">
            Click a ticket row to open full details and conversation.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--rh-brand)]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <RhEmptyState title="No tickets yet" description="Create a ticket to get help." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb] bg-[var(--rh-brand-soft,#ecfdf5)] text-left text-[#414754]">
                  <th className="px-6 py-3 font-medium">ID</th>
                  <th className="px-6 py-3 font-medium">Subject</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Updated</th>
                  <th className="px-6 py-3 font-medium">Portal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-[#f3f4f6] transition-colors hover:bg-[#f9f9ff]"
                    onClick={() => setLocation(`/my-support/${r.id}`)}
                  >
                    <td className="px-6 py-3 font-mono text-[#414754]">#{r.ticketNumber}</td>
                    <td className="px-6 py-3 font-medium text-[#111c2d]">{r.subject}</td>
                    <td className="px-6 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize",
                          SUPPORT_STATUS_STYLES[r.status] || "bg-[#f3f4f6] text-[#414754]",
                        )}
                      >
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-[#717786]">
                      {r.updatedAt ? format(new Date(r.updatedAt), "MMM d, yyyy HH:mm") : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <RhButton
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={(e) => openPortalWithoutReload(r.customerViewUrl, e)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </RhButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </RhCard>
    </RhPageLayout>
  );
}
