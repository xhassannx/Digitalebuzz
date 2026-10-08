import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Inbox, Loader2, Paperclip, Plus } from "lucide-react";
import { useMySupportPage, SUPPORT_STATUS_STYLES } from "@/features/my-support/useMySupportPage";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { cn } from "@/lib/utils";

export default function MySupportPage() {
  const skin = useRatehonkPageSkin();
  const {
    open,
    setOpen,
    openCreateDialog,
    subject,
    setSubject,
    description,
    setDescription,
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
    <div className={cn(skin ? "" : "p-4 md:p-6 max-w-6xl mx-auto")}>
      {!skin && (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Inbox className="h-7 w-7 text-primary" />
              My support
            </h1>
            <p className="text-sm text-muted-foreground">
              Tickets you opened with a partner organization.
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={setOpen}
          >
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1" />
              New ticket
            </Button>
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4 mr-1" />
                      Attachment
                    </Button>
                    {file && (
                      <span className="ml-2 text-xs text-muted-foreground">{file.name}</span>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createMut.isPending || organizationsList.length === 0}
                  >
                    {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your tickets</CardTitle>
          <CardDescription>Click a ticket row to open full details and conversation.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No tickets yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Portal Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setLocation(`/my-support/${r.id}`)}
                    >
                      <TableCell className="font-mono text-sm">#{r.ticketNumber}</TableCell>
                      <TableCell className="font-medium">{r.subject}</TableCell>
                      <TableCell>
                        <Badge className={SUPPORT_STATUS_STYLES[r.status] || ""} variant="secondary">
                          {r.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.updatedAt ? format(new Date(r.updatedAt), "MMM d, yyyy HH:mm") : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={(e) => openPortalWithoutReload(r.customerViewUrl, e)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
