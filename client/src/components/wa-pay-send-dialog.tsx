import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CreditCard, Search, Package, Info, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export type WaPaySendDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  to: string;
  contactName?: string | null;
  catalogId?: string | null;
};

type CatalogProduct = {
  retailerId: string;
  name: string;
  price?: string;
};

type WaPaySettings = {
  metaCatalogId?: string | null;
  waPayCatalogCheckoutEnabled?: boolean;
  waPayOrderType?: "physical-goods" | "digital-goods";
  metaPaymentConfigurationName?: string | null;
};

function parsePriceMajor(price?: string): number | null {
  if (!price?.trim()) return null;
  const m = price.trim().match(/^([\d,.]+)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function WaPaySendDialog({
  open,
  onOpenChange,
  sessionId,
  to,
  contactName,
  catalogId: catalogIdProp,
}: WaPaySendDialogProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [orderType, setOrderType] = useState<"physical-goods" | "digital-goods">("physical-goods");
  const [bodyText, setBodyText] = useState("Review your order and pay in WhatsApp");

  const { data: waPaySettings } = useQuery<WaPaySettings>({
    queryKey: ["/api/wa-pay/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/wa-pay/settings");
      return res.json();
    },
    enabled: open,
    staleTime: 60_000,
  });

  const { data: commerceSettings } = useQuery<{ metaCatalogId?: string | null }>({
    queryKey: ["/api/commerce/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/commerce/settings");
      return res.json();
    },
    enabled: open,
    staleTime: 60_000,
  });

  const catalogId = (catalogIdProp || commerceSettings?.metaCatalogId || "").trim();
  const configName = waPaySettings?.metaPaymentConfigurationName?.trim() || "";
  const payReady = !!configName;

  useEffect(() => {
    if (waPaySettings?.waPayOrderType) {
      setOrderType(
        waPaySettings.waPayOrderType === "digital-goods" ? "digital-goods" : "physical-goods"
      );
    }
  }, [waPaySettings?.waPayOrderType]);

  const { data: productsData, isLoading } = useQuery<{
    products: CatalogProduct[];
    warning?: string;
  }>({
    queryKey: ["/api/commerce/catalog/products", sessionId, catalogId],
    queryFn: async () => {
      const qs = new URLSearchParams({ sessionId, catalogId, limit: "100" });
      const res = await apiRequest("GET", `/api/commerce/catalog/products?${qs}`);
      return res.json();
    },
    enabled: open && !!sessionId && !!catalogId,
  });

  const products = productsData?.products ?? [];

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.retailerId.toLowerCase().includes(q)
    );
  }, [products, search]);

  const selectedProduct = products.find((p) => p.retailerId === productId);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setProductId("");
      setAmount("");
      setBodyText("Review your order and pay in WhatsApp");
    }
  }, [open]);

  useEffect(() => {
    if (!productId) return;
    const p = products.find((x) => x.retailerId === productId);
    if (!p) return;
    const major = parsePriceMajor(p.price);
    if (major != null) setAmount(String(major));
  }, [productId, products]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const amountMajor = parseFloat(amount);
      if (!Number.isFinite(amountMajor) || amountMajor < 10) {
        throw new Error("Minimum amount is ₹10");
      }
      if (orderType === "physical-goods" && catalogId && !productId.trim()) {
        throw new Error("Select a catalog product for physical goods");
      }
      const res = await apiRequest("POST", "/api/wa-pay/test-send", {
        sessionId,
        to,
        amountMajor,
        productRetailerId: productId.trim() || undefined,
        itemName: selectedProduct?.name || "Order",
        beneficiaryName: contactName?.trim() || undefined,
        orderType,
        bodyText: bodyText.trim() || "Review your order and pay in WhatsApp",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Review and pay sent",
        description: "Customer should see the payment invoice in WhatsApp.",
      });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wa-pay/orders"] });
    },
    onError: (e: Error) => {
      toast({ title: "WA Pay send failed", description: e.message, variant: "destructive" });
    },
  });

  const needsProduct = orderType === "physical-goods" && !!catalogId;
  const canSend =
    payReady &&
    parseFloat(amount) >= 10 &&
    (!needsProduct || !!productId.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden"
        data-testid="dialog-wa-pay-send"
      >
        <DialogHeader className="px-5 pt-5 pb-3 space-y-1 border-b bg-muted/20">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950">
              <CreditCard className="h-5 w-5 text-violet-600" />
            </span>
            Send Review and pay
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Sends Meta <strong>order_details</strong> (native checkout). Requires P2M eligibility on
            your WhatsApp account.{" "}
            <Link href="/commerce/documentation#wa-pay-catalog" className="underline font-medium text-foreground">
              Full guide
            </Link>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {!payReady ? (
            <div className="flex gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 dark:text-amber-100">
                Set payment configuration on{" "}
                <Link href="/wa-pay" className="underline font-medium">
                  WA Pay
                </Link>{" "}
                first (Razorpay/PayU name from Meta Business Manager).
              </p>
            </div>
          ) : null}

          {!catalogId ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Link Meta catalog on{" "}
              <Link href="/commerce" className="underline font-medium text-foreground">
                Commerce
              </Link>{" "}
              before sending catalog WA Pay.
            </p>
          ) : (
            <>
              {(productsData?.warning) ? (
                <div className="flex gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2.5">
                  <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900">{productsData.warning}</p>
                </div>
              ) : null}

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Order type</Label>
                  <Select
                    value={orderType}
                    onValueChange={(v) => setOrderType(v as "physical-goods" | "digital-goods")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical-goods">Physical goods</SelectItem>
                      <SelectItem value="digital-goods">Digital goods</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Amount (INR)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100"
                    disabled={!!productId && orderType === "physical-goods"}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Catalog product {needsProduct ? "(required)" : "(optional)"}
                </Label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 h-9"
                    placeholder="Search products…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <Input
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    placeholder="Content ID from Commerce Manager"
                  />
                ) : (
                  <div className="max-h-[160px] overflow-y-auto space-y-1.5 border rounded-lg p-2">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.retailerId}
                        type="button"
                        onClick={() => setProductId(p.retailerId)}
                        className={cn(
                          "w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors",
                          productId === p.retailerId
                            ? "bg-violet-100 dark:bg-violet-950 ring-1 ring-violet-500/40"
                            : "hover:bg-muted"
                        )}
                      >
                        <span className="font-medium">{p.name}</span>
                        {p.price ? (
                          <span className="text-xs text-muted-foreground ml-2">{p.price}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Message text</Label>
                <Input
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  maxLength={1024}
                />
              </div>

              {contactName ? (
                <p className="text-xs text-muted-foreground">
                  Shipping beneficiary: <strong>{contactName}</strong>
                </p>
              ) : null}
            </>
          )}
        </div>

        <DialogFooter className="px-5 py-4 border-t bg-muted/10 gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-violet-600 hover:bg-violet-700 min-w-[140px]"
            disabled={!canSend || !catalogId || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              "Send Review and pay"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
