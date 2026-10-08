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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, Search, Package, LayoutList, Info, Check } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export type CatalogSendDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  to: string;
  catalogId?: string | null;
};

type CatalogProduct = {
  retailerId: string;
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
};

type SendMode = "single" | "list";

function formatProductPrice(p: CatalogProduct): string {
  if (!p.price) return "";
  const sym = p.currency === "INR" ? "₹" : p.currency ? `${p.currency} ` : "";
  return `${sym}${p.price}`;
}

function ProductThumb({
  product,
  selected,
  onSelect,
  multi,
  checked,
  onToggle,
}: {
  product: CatalogProduct;
  selected?: boolean;
  onSelect?: () => void;
  multi?: boolean;
  checked?: boolean;
  onToggle?: () => void;
}) {
  const price = formatProductPrice(product);

  return (
    <button
      type="button"
      onClick={multi ? onToggle : onSelect}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-colors",
        "hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20",
        selected || checked
          ? "border-emerald-500 bg-emerald-50/80 ring-1 ring-emerald-500/30 dark:bg-emerald-950/30"
          : "border-border bg-card"
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-5 w-5 text-muted-foreground/60" />
          </div>
        )}
        {(selected || checked) && (
          <span className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Check className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-medium leading-snug line-clamp-2">{product.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {price ? (
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{price}</span>
          ) : null}
          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
            {product.retailerId}
          </span>
        </div>
      </div>
      {multi ? (
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          className="mt-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
      ) : null}
    </button>
  );
}

export function CatalogSendDialog({
  open,
  onOpenChange,
  sessionId,
  to,
  catalogId: catalogIdProp,
}: CatalogSendDialogProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<SendMode>("single");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [listSelected, setListSelected] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("Check out our products");
  const [footer, setFooter] = useState("");

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

  const { data: productsData, isLoading, isError, error } = useQuery<{
    catalogId: string;
    products: CatalogProduct[];
    warning?: string;
    commerceNote?: string;
  }>({
    queryKey: ["/api/commerce/catalog/products", sessionId, catalogId],
    queryFn: async () => {
      const qs = new URLSearchParams({
        sessionId,
        catalogId,
        limit: "100",
      });
      const res = await apiRequest("GET", `/api/commerce/catalog/products?${qs}`);
      return res.json();
    },
    enabled: open && !!sessionId && !!catalogId,
  });

  const products = productsData?.products ?? [];
  const productsWarning = (productsData?.warning || productsData?.commerceNote || "").trim();

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.retailerId.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const selectedProduct = products.find((p) => p.retailerId === selectedProductId);
  const listCount = listSelected.size;
  const canSend = mode === "list" ? listCount > 0 : !!selectedProductId;

  useEffect(() => {
    if (!open) {
      setSearch("");
      setMode("single");
      setSelectedProductId("");
      setListSelected(new Set());
      setBody("Check out our products");
      setFooter("");
    }
  }, [open]);

  useEffect(() => {
    if (mode === "single") {
      setListSelected(new Set());
    } else {
      setSelectedProductId("");
    }
  }, [mode]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        sessionId,
        to,
        body: body.trim() || undefined,
        footer: footer.trim() || undefined,
        catalogId: catalogId || undefined,
      };

      if (mode === "list") {
        const ids = Array.from(listSelected);
        if (ids.length > 1) {
          payload.products = ids.map((productRetailerId) => ({ productRetailerId }));
          payload.sectionTitle = "Products";
        } else if (ids.length === 1) {
          payload.productRetailerId = ids[0];
        } else {
          throw new Error("Select at least one product");
        }
      } else {
        if (!selectedProductId) throw new Error("Select a product");
        payload.productRetailerId = selectedProductId;
      }

      const res = await apiRequest("POST", "/api/messages/send-catalog-product", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Catalog message sent" });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: (e: Error) => {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    },
  });

  const toggleListProduct = (retailerId: string) => {
    setListSelected((prev) => {
      const next = new Set(prev);
      if (next.has(retailerId)) {
        next.delete(retailerId);
      } else if (next.size >= 30) {
        toast({
          title: "Limit reached",
          description: "You can send up to 30 products in one list message.",
          variant: "destructive",
        });
        return prev;
      } else {
        next.add(retailerId);
      }
      return next;
    });
  };

  const sendLabel =
    sendMutation.isPending
      ? "Sending…"
      : mode === "list"
        ? listCount === 1
          ? "Send 1 product"
          : `Send ${listCount} products`
        : "Send product";

  const productPicker = (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 h-10"
          placeholder="Search by name or product ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          Loading catalog products…
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive py-4 text-center">
          {error instanceof Error ? error.message : "Failed to load catalog"}
        </p>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 px-4 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium">
            {products.length === 0 ? "No products in catalog" : "No matches"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {products.length === 0 ? (
              <>
                Sync products on the{" "}
                <Link href="/commerce" className="underline text-foreground">
                  Commerce
                </Link>{" "}
                page first.
              </>
            ) : (
              "Try a different search term."
            )}
          </p>
        </div>
      ) : (
        <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 -mr-1">
          {filteredProducts.map((p) =>
            mode === "list" ? (
              <ProductThumb
                key={p.retailerId}
                product={p}
                multi
                checked={listSelected.has(p.retailerId)}
                onToggle={() => toggleListProduct(p.retailerId)}
              />
            ) : (
              <ProductThumb
                key={p.retailerId}
                product={p}
                selected={selectedProductId === p.retailerId}
                onSelect={() => setSelectedProductId(p.retailerId)}
              />
            )
          )}
        </div>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden"
        data-testid="dialog-catalog-send"
      >
        <DialogHeader className="px-5 pt-5 pb-3 space-y-1 border-b bg-muted/20">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950">
              <ShoppingBag className="h-5 w-5 text-emerald-600" />
            </span>
            Send catalog message
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Send one product or a scrollable product list inside the customer&apos;s 24-hour chat
            window.             For swipeable marketing carousels, see the{" "}
            <Link href="/commerce/documentation#carousel" className="underline font-medium text-foreground">
              carousel guide
            </Link>
            .
          </DialogDescription>
        </DialogHeader>

        {!catalogId ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Connect your Meta catalog in{" "}
              <Link href="/commerce" className="underline font-medium text-foreground">
                Commerce settings
              </Link>{" "}
              before sending products.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            {productsWarning ? (
              <div className="flex gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/60 px-3 py-2.5">
                <Info className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 dark:text-amber-100 leading-snug">
                  {productsWarning}
                </p>
              </div>
            ) : null}

            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as SendMode)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 h-10">
                <TabsTrigger value="single" className="gap-1.5 text-xs sm:text-sm">
                  <Package className="h-3.5 w-3.5" />
                  Single product
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-1.5 text-xs sm:text-sm">
                  <LayoutList className="h-3.5 w-3.5" />
                  Product list
                  {listCount > 0 && mode === "list" ? (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {listCount}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="mt-3 space-y-3">
                {productPicker}
                {selectedProduct ? (
                  <div className="rounded-lg border bg-muted/30 p-3 flex gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-background">
                      {selectedProduct.imageUrl ? (
                        <img
                          src={selectedProduct.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{selectedProduct.name}</p>
                      {formatProductPrice(selectedProduct) ? (
                        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
                          {formatProductPrice(selectedProduct)}
                        </p>
                      ) : null}
                      {selectedProduct.description ? (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {selectedProduct.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : filteredProducts.length > 0 && !isLoading ? (
                  <p className="text-xs text-center text-muted-foreground">
                    Tap a product above to preview it
                  </p>
                ) : null}
              </TabsContent>

              <TabsContent value="list" className="mt-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Select up to <strong>30 products</strong>. Customer sees a scrollable catalog list
                  in WhatsApp.
                </p>
                {productPicker}
                {listCount > 0 ? (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    {listCount} product{listCount !== 1 ? "s" : ""} selected
                  </p>
                ) : null}
              </TabsContent>
            </Tabs>

            <div className="space-y-3 pt-1 border-t">
              <div className="space-y-1.5">
                <Label htmlFor="catalog-body" className="text-sm">
                  Message text
                </Label>
                <Input
                  id="catalog-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="e.g. Here are our bestsellers for you"
                  maxLength={1024}
                />
              </div>
              {mode === "list" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="catalog-footer" className="text-sm">
                    Footer <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="catalog-footer"
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                    placeholder="e.g. Tap to view details"
                    maxLength={60}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter className="px-5 py-4 border-t bg-muted/10 gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700 min-w-[120px]"
            disabled={!catalogId || !canSend || sendMutation.isPending || isLoading}
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              sendLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
