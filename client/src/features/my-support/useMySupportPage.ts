import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, resolveApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export const SUPPORT_STATUS_STYLES: Record<string, string> = {
  open: "bg-sky-100 text-sky-800",
  pending: "bg-amber-100 text-amber-900",
  in_progress: "bg-violet-100 text-violet-900",
  waiting_on_customer: "bg-orange-100 text-orange-900",
  resolved: "bg-emerald-100 text-emerald-900",
  closed: "bg-slate-200 text-slate-800",
};

export type SupportTicketRow = {
  id: string;
  ticketNumber: number;
  subject: string;
  status: string;
  customerViewUrl: string;
  updatedAt: string;
  organizationId: string;
};

export function useMySupportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetOrg, setTargetOrg] = useState("");

  const openPortalWithoutReload = (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const u = new URL(url, window.location.origin);
      if (u.origin === window.location.origin) {
        setLocation(`${u.pathname}${u.search}`);
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const { data: orgsData } = useQuery<{ organizations?: { id: string; name: string }[] }>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });
  const organizationsList = Array.isArray(orgsData) ? orgsData : (orgsData?.organizations ?? []);

  const resetCreateForm = () => {
    setSubject("");
    setDescription("");
    setPhone("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const { data: authUser } = useQuery<{ phone?: string | null }>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/user");
      return res.json();
    },
  });

  const openCreateDialog = () => {
    resetCreateForm();
    if (authUser?.phone) setPhone(String(authUser.phone));
    setOpen(true);
  };

  useEffect(() => {
    if (!targetOrg && organizationsList[0]) {
      setTargetOrg(organizationsList[0].id);
    }
  }, [targetOrg, organizationsList]);

  const { data: rows = [], isLoading } = useQuery<SupportTicketRow[]>({
    queryKey: ["/api/me/support/tickets"],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl("/api/me/support/tickets"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async (fd: FormData) => {
      const res = await fetch(resolveApiUrl("/api/me/support/tickets"), {
        method: "POST",
        body: fd,
        credentials: "include",
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
      return res.json();
    },
    onSuccess: () => {
      setOpen(false);
      resetCreateForm();
      void queryClient.invalidateQueries({ queryKey: ["/api/me/support/tickets"] });
      toast({ title: "Ticket created" });
    },
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    const org = targetOrg || organizationsList[0]?.id;
    if (!org || !subject.trim() || !description.trim() || !phone.trim()) {
      toast({
        title: "Missing fields",
        description: "Pick an organization, subject, description, and phone number.",
        variant: "destructive",
      });
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast({
        title: "Invalid phone number",
        description: "Enter a valid phone number with at least 10 digits.",
        variant: "destructive",
      });
      return;
    }
    const fd = new FormData();
    fd.append("organizationId", org);
    fd.append("subject", subject.trim());
    fd.append("description", description.trim());
    fd.append("customerPhone", phone.trim());
    if (file) fd.append("attachment", file);
    createMut.mutate(fd, {
      onError: (err: Error) =>
        toast({ title: "Failed", description: err.message, variant: "destructive" }),
    });
  };

  return {
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
  };
}
