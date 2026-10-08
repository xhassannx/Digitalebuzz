"use client";

import { FileText, Image as ImageIcon, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getTemplateBodyText } from "@/features/reminders/useRemindersPage";
import type { ReminderTemplateComposeState } from "@/features/reminders/useReminderTemplateCompose";

type ComposeFieldsProps = {
  compose: ReminderTemplateComposeState;
  title: string;
  onTitleChange: (v: string) => void;
  message: string;
  onMessageChange: (v: string) => void;
  notes?: string;
  onNotesChange?: (v: string) => void;
  outlineClass?: string;
  /** When true, message-mode still requires a non-empty message for the parent save button */
  showTitle?: boolean;
};

export function ReminderComposeFields({
  compose: p,
  title,
  onTitleChange,
  message,
  onMessageChange,
  notes,
  onNotesChange,
  outlineClass = "",
  showTitle = true,
}: ComposeFieldsProps) {
  return (
    <>
      {showTitle ? (
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Short reminder title"
            className={outlineClass}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Message</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {p.useTemplate ? "Template" : "Write message"}
            </span>
            <Switch
              checked={p.useTemplate}
              onCheckedChange={p.setUseTemplate}
              aria-label="Use WhatsApp template"
            />
          </div>
        </div>
        {p.useTemplate ? (
          <div className="space-y-3">
            <Select value={p.templateId || undefined} onValueChange={p.selectTemplate}>
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
            {p.templateId ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{p.templateId}</span>
                {(p.headerImageUrl ||
                  p.headerVideoUrl ||
                  p.headerDocumentUrl ||
                  p.templateParams.length > 0) && (
                  <span className="text-xs text-muted-foreground">
                    {[
                      p.headerImageUrl || p.headerVideoUrl || p.headerDocumentUrl
                        ? "media set"
                        : null,
                      p.templateParams.length ? `${p.templateParams.length} variable(s)` : null,
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
              Selecting a template opens a popup to set image/video and variables. It sends
              automatically at the due date.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="Enter reminder message"
              className={cn("min-h-[80px] resize-y", outlineClass)}
            />
            <p className="text-xs text-muted-foreground">
              Sent on WhatsApp automatically at the due date/time. Requires an open 24h chat
              window — if it expired, switch to Template.
            </p>
          </div>
        )}
      </div>

      {onNotesChange ? (
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={notes || ""}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Internal notes (not sent on WhatsApp)"
            className={cn("min-h-[64px] resize-y", outlineClass)}
          />
        </div>
      ) : null}
    </>
  );
}

type ConfigDialogProps = {
  compose: ReminderTemplateComposeState;
  outlineClass?: string;
  primaryBtnClass?: string;
};

export function ReminderTemplateConfigDialog({
  compose: p,
  outlineClass = "",
  primaryBtnClass = "",
}: ConfigDialogProps) {
  return (
    <Dialog
      open={p.templateConfigOpen}
      onOpenChange={(open) => {
        if (!open) p.cancelTemplateConfig();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto z-[80]">
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
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{p.draftTemplate.name}</p>
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
                <div className="overflow-hidden rounded-lg border">
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
                  onClick={() => p.applyDraftMediaUrl()}
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
            className={cn(primaryBtnClass || "bg-rose-500 hover:bg-rose-600 text-white")}
            onClick={() => p.confirmTemplateConfig()}
            disabled={!p.draftTemplate}
          >
            Use template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
