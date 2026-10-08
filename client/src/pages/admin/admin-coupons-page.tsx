import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClearableDateInput } from "@/components/ui/clearable-date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, ArrowLeft, Search, MoreHorizontal, ArrowUpDown, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const generateCouponCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

type Coupon = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  maxUses: number;
  usedCount: number;
  expiryDate: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function AdminCouponsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ coupons: Coupon[] }>({
    queryKey: ["/api/admin/coupons"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/coupons");
      return await res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/admin/coupons", payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Coupon created", description: "Coupon has been created successfully" });
      setIsCreateOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create coupon", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (couponId: string) => {
      await apiRequest("DELETE", `/api/admin/coupons/${couponId}`);
    },
    onSuccess: () => {
      toast({ title: "Coupon deleted", description: "Coupon has been deleted" });
      refetch();
    },
  });

  const coupons = data?.coupons || [];
  const filtered = coupons.filter(
    (c) =>
      !searchQuery ||
      c.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDiscount = (c: Coupon) => {
    if (c.discountType === "percent") return `${c.discountValue}%`;
    return `₹${(c.discountValue / 100).toLocaleString()}`;
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Coupons</h1>
          <p className="text-muted-foreground">Manage discount coupons for your customers</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Coupon
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coupons</CardTitle>
          <CardDescription>Search coupons by code or description</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search coupons by code or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer">
                      <span className="flex items-center gap-1">
                        Created At <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </TableHead>
                    <TableHead>Coupon Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount Type</TableHead>
                    <TableHead>Discount Value</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No coupons found. Create your first coupon to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((coupon) => (
                      <TableRow key={coupon.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(coupon.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">{coupon.name}</TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 text-sm font-mono">{coupon.code}</code>
                        </TableCell>
                        <TableCell className="capitalize">{coupon.discountType}</TableCell>
                        <TableCell>{formatDiscount(coupon)}</TableCell>
                        <TableCell>
                          {coupon.usedCount} / {coupon.maxUses}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(coupon.id)}
                                disabled={deleteMutation.isPending}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateCouponDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={(form) => {
          createMutation.mutate({
            code: form.code,
            name: form.name,
            description: form.description,
            discountType: form.discountType,
            discountValue: form.discountType === "percent" ? form.discountValue : Math.round((form.discountValue || 0) * 100),
            maxUses: form.maxUses,
            expiryDate: form.expiryDate || null,
          });
        }}
        isLoading={createMutation.isPending}
        generateCode={generateCouponCode}
      />
    </div>
  );
}

function CreateCouponDialog({
  open,
  onClose,
  onSubmit,
  isLoading,
  generateCode,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: any) => void;
  isLoading: boolean;
  generateCode: () => string;
}) {
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    maxUses: 1,
    discountType: "percent" as "percent" | "fixed",
    discountValue: 0,
    expiryDate: "",
  });

  const handleGenerateCode = () => {
    setForm((f) => ({ ...f, code: generateCode() }));
  };

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, code: f.code || generateCode() }));
  }, [open]);

  const handleSubmit = () => {
    onSubmit(form);
    setForm({
      name: "",
      code: generateCode(),
      description: "",
      maxUses: 1,
      discountType: "percent",
      discountValue: 0,
      expiryDate: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 space-y-1.5 border-b px-6 pb-4 pt-6 pr-14 text-left">
          <DialogTitle>Create New Coupon</DialogTitle>
          <DialogDescription>Create a new discount coupon for your customers</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          <div className="space-y-4">
          <div>
            <Label>Coupon Name *</Label>
            <Input
              placeholder="e.g., SUMMER2024"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-2"
            />
          </div>
          <div>
            <Label>Coupon Code *</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g., Q55EKKRU"
                className="font-mono"
              />
              <Button type="button" variant="outline" size="icon" onClick={handleGenerateCode} title="Generate random code">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Click the refresh button to generate a random code</p>
          </div>
          <div>
            <Label>Max Uses</Label>
            <Input
              type="number"
              min={1}
              value={form.maxUses}
              onChange={(e) => setForm((f) => ({ ...f, maxUses: parseInt(e.target.value) || 1 }))}
              className="mt-2"
            />
          </div>
          <div>
            <Label>Discount Type *</Label>
            <Select
              value={form.discountType}
              onValueChange={(v: "percent" | "fixed") => setForm((f) => ({ ...f, discountType: v }))}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percentage</SelectItem>
                <SelectItem value="fixed">Fixed Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Discount Amount *</Label>
            <Input
              type="number"
              min={0}
              step={form.discountType === "percent" ? 1 : 0.01}
              value={form.discountValue}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  discountValue: form.discountType === "percent" ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0,
                }))
              }
              className="mt-2"
              placeholder={form.discountType === "percent" ? "e.g., 10" : "e.g., 500"}
            />
            {form.discountType === "percent" && (
              <p className="text-xs text-muted-foreground mt-1">Enter percentage (0-100)</p>
            )}
            {form.discountType === "fixed" && (
              <p className="text-xs text-muted-foreground mt-1">Enter amount in ₹</p>
            )}
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              placeholder="Brief description of the coupon..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-2"
              rows={2}
            />
          </div>
          <div>
            <Label>Expiry Date</Label>
            <div className="mt-2">
              <ClearableDateInput
                value={form.expiryDate}
                onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Coupon will expire at the end of this date</p>
          </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !form.name || !form.code}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Coupon"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
