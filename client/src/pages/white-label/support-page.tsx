// @ts-nocheck
import { useState, useRef, FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { resolveApiUrl } from "@/lib/queryClient";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LifeBuoy, Loader2, Paperclip, CheckCircle2 } from "lucide-react";
import { WhiteLabelHeader } from "./landing-page-1/components/header";
import { wlMarketingHref } from "@/lib/public-template";

function useOrgId() {
  const { organizationId } = useWhiteLabelConfig();
  const q = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  return (q.get("organizationId") || organizationId) as string | null;
}

export default function WhiteLabelSupportPage() {
  const orgId = useOrgId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState<null | { viewUrl: string; ticketNumber: number }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mut = useMutation({
    mutationFn: async (fd: FormData) => {
      const res = await fetch(resolveApiUrl("/api/public/support/tickets"), {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        try {
          const j = JSON.parse(t);
          throw new Error(j.error || t);
        } catch {
          throw new Error(t);
        }
      }
      return res.json() as { viewUrl: string; ticketNumber: number };
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!orgId) {
      // eslint-disable-next-line no-alert
      alert("Missing organization. Add ?organizationId= to the URL, or set VITE_WHITELABEL_ORG_ID.");
      return;
    }
    const fd = new FormData();
    fd.append("organizationId", orgId);
    fd.append("customerName", name);
    fd.append("customerEmail", email);
    fd.append("customerPhone", phone);
    fd.append("subject", subject);
    fd.append("description", description);
    if (file) {
      fd.append("attachment", file);
    }
    mut.mutate(fd, {
      onSuccess: (data) => {
        setDone({ viewUrl: data.viewUrl, ticketNumber: data.ticketNumber });
        setName("");
        setEmail("");
        setPhone("");
        setSubject("");
        setDescription("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      onError: (err: Error) => {
        // eslint-disable-next-line no-alert
        alert(err.message);
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <WhiteLabelHeader />
      <div className="container max-w-lg py-10 md:py-16">
        {done ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
                <div>
                  <CardTitle>Ticket #{done.ticketNumber} received</CardTitle>
                  <CardDescription>We emailed you a confirmation. Keep this page bookmarked to follow the conversation.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <a href={done.viewUrl}>Open your ticket</a>
              </Button>
              <p className="text-center text-sm text-muted-foreground mt-4">
                <Link className="underline" href={wlMarketingHref("")}>
                  Back to home
                </Link>
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <LifeBuoy className="h-7 w-7" />
                <div>
                  <CardTitle>Contact support</CardTitle>
                  <CardDescription>
                    {orgId
                      ? "We will email you a confirmation and ticket reference number."
                      : "Add your organization to the page URL (organizationId) so we know where to route your request."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Your name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label>Phone number</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    required
                  />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
                </div>
                <div>
                  <Label>How can we help?</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="min-h-[120px]"
                  />
                </div>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
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
                  {file && <span className="ml-2 text-sm text-muted-foreground">{file.name}</span>}
                </div>
                <Button className="w-full" type="submit" disabled={mut.isPending}>
                  {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit ticket"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
