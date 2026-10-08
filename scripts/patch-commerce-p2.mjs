import fs from "fs";
import path from "path";

const root = process.cwd();

function patch(file, pairs) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, "utf8");
  let n = 0;
  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      console.warn(`MISS: ${file} — ${from.slice(0, 50).replace(/\n/g, " ")}...`);
      continue;
    }
    s = s.replace(from, to);
    n++;
  }
  fs.writeFileSync(p, s);
  console.log(`${file}: ${n} ok`);
}

const PRODUCT_UI_OLD = `          </div>
          
          {productCards.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <p>No product cards added yet. Click "Add Card" to create your carousel.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProductCardIndex(Math.max(0, selectedProductCardIndex - 1))}
                  disabled={selectedProductCardIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">Card {selectedProductCardIndex + 1} of {productCards.length}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProductCardIndex(Math.min(productCards.length - 1, selectedProductCardIndex + 1))}
                  disabled={selectedProductCardIndex === productCards.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {productCards[selectedProductCardIndex] && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Product Card {selectedProductCardIndex + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProductCard(productCards[selectedProductCardIndex].id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/50">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Product Image Placeholder</p>
                    <p className="text-xs text-muted-foreground mt-1">Will be pulled from catalog</p>
                  </div>
                  <div>
                    <Label className="text-sm">Button Label</Label>
                    <Input
                      value={productCards[selectedProductCardIndex].buttonLabel}
                      onChange={(e) => updateProductCard(productCards[selectedProductCardIndex].id, e.target.value)}
                      placeholder="View"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}`;

const PRODUCT_UI_NEW = `          </div>
          <p className="text-xs text-muted-foreground">
            Meta requires at least 2 cards when creating the template. After approval you can send up to 10 products per message.
          </p>
          {onMetaCatalogIdChange ? (
            <div className="space-y-1">
              <Label className="text-sm">Meta catalog ID</Label>
              <Input
                value={metaCatalogId || ""}
                onChange={(e) => onMetaCatalogIdChange(e.target.value)}
                placeholder="From Commerce settings"
              />
            </div>
          ) : null}
          {!catalogSessionId || !metaCatalogId ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Connect WhatsApp Business API and set catalog ID on the Commerce page to pick products.
            </p>
          ) : null}
          {productCards.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <p>No product cards added yet. Click Add Card (minimum 2 for Meta submission).</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProductCardIndex(Math.max(0, selectedProductCardIndex - 1))}
                  disabled={selectedProductCardIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">Card {selectedProductCardIndex + 1} of {productCards.length}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProductCardIndex(Math.min(productCards.length - 1, selectedProductCardIndex + 1))}
                  disabled={selectedProductCardIndex === productCards.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {productCards[selectedProductCardIndex] && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Product Card {selectedProductCardIndex + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProductCard(productCards[selectedProductCardIndex].id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Catalog product</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-8 h-9"
                        placeholder="Search catalog…"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        disabled={!catalogSessionId || !metaCatalogId}
                      />
                    </div>
                    {catalogProductsLoading ? (
                      <p className="text-xs text-muted-foreground">Loading products…</p>
                    ) : (
                      <Select
                        value={productCards[selectedProductCardIndex].productRetailerId || ""}
                        onValueChange={(retailerId) => {
                          const pr = catalogProducts.find((x) => x.retailerId === retailerId);
                          updateProductCard(productCards[selectedProductCardIndex].id, {
                            productRetailerId: retailerId,
                            productName: pr?.name,
                          });
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogProducts.map((p) => (
                            <SelectItem key={p.retailerId} value={p.retailerId}>
                              {p.name} ({p.retailerId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Button type (same on all cards)</Label>
                    <RadioGroup
                      value={productCards[0]?.buttonType || "spm"}
                      onValueChange={(v) => {
                        const bt = v as "spm" | "url";
                        setProductCards(productCards.map((c) => ({ ...c, buttonType: bt })));
                      }}
                      className="flex flex-col gap-2 sm:flex-row sm:gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="spm" id="product-btn-spm" />
                        <Label htmlFor="product-btn-spm" className="font-normal cursor-pointer">View in WhatsApp</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="url" id="product-btn-url" />
                        <Label htmlFor="product-btn-url" className="font-normal cursor-pointer">Open URL</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div>
                    <Label className="text-sm">Button label</Label>
                    <Input
                      value={productCards[selectedProductCardIndex].buttonLabel}
                      onChange={(e) =>
                        updateProductCard(productCards[selectedProductCardIndex].id, {
                          buttonLabel: e.target.value,
                        })
                      }
                      placeholder="View"
                    />
                  </div>
                  {(productCards[0]?.buttonType || "spm") === "url" ? (
                    <>
                      <div>
                        <Label className="text-sm">Button URL</Label>
                        <Input
                          value={productCards[selectedProductCardIndex].url || ""}
                          onChange={(e) =>
                            updateProductCard(productCards[selectedProductCardIndex].id, { url: e.target.value })
                          }
                          placeholder="https://shop.example.com/{{1}}"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">URL example value</Label>
                        <Input
                          value={productCards[selectedProductCardIndex].urlExample || ""}
                          onChange={(e) =>
                            updateProductCard(productCards[selectedProductCardIndex].id, {
                              urlExample: e.target.value,
                            })
                          }
                          placeholder="sku-123"
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      )}`;

patch("client/src/components/template-interactive-actions.tsx", [
  [
    `  phoneNumberId?: string | null;
  /** When provided, "Select media"`,
    `  phoneNumberId?: string | null;
  catalogSessionId?: string | null;
  metaCatalogId?: string | null;
  onMetaCatalogIdChange?: (catalogId: string) => void;
  /** When provided, "Select media"`,
  ],
  [
    `  phoneNumberId,
  onOpenGalleryForMediaCard,
}: InteractiveActionsProps) {
  const { toast } = useToast();
  const [flowSearch, setFlowSearch] = useState('');`,
    `  phoneNumberId,
  catalogSessionId,
  metaCatalogId,
  onMetaCatalogIdChange,
  onOpenGalleryForMediaCard,
}: InteractiveActionsProps) {
  const { toast } = useToast();
  const [productSearch, setProductSearch] = useState("");
  const [flowSearch, setFlowSearch] = useState('');`,
  ],
  [
    `  const addProductCard = () => {
    if (productCards.length >= 10) return;
    setProductCards([...productCards, { id: \`card-\${Date.now()}\`, buttonLabel: 'View' }]);
    setSelectedProductCardIndex(productCards.length);
  };

  const updateProductCard = (id: string, buttonLabel: string) => {
    setProductCards(productCards.map(card => card.id === id ? { ...card, buttonLabel } : card));
  };`,
    `  const { data: catalogProductsData, isLoading: catalogProductsLoading } = useQuery<{
    products: Array<{ retailerId: string; name: string }>;
  }>({
    queryKey: ["/api/commerce/catalog/products", catalogSessionId, metaCatalogId, productSearch],
    queryFn: async () => {
      const qs = new URLSearchParams({
        sessionId: catalogSessionId || "",
        catalogId: metaCatalogId || "",
        limit: "40",
      });
      if (productSearch.trim()) qs.set("search", productSearch.trim());
      const res = await apiRequest("GET", \`/api/commerce/catalog/products?\${qs}\`);
      return res.json();
    },
    enabled: value === "PRODUCT_CARD_CAROUSEL" && !!catalogSessionId && !!metaCatalogId,
    staleTime: 30_000,
  });
  const catalogProducts = catalogProductsData?.products ?? [];

  const addProductCard = () => {
    if (productCards.length >= 10) return;
    const firstType = productCards[0]?.buttonType || "spm";
    setProductCards([
      ...productCards,
      { id: \`card-\${Date.now()}\`, buttonLabel: "View", buttonType: firstType },
    ]);
    setSelectedProductCardIndex(productCards.length);
  };

  const updateProductCard = (id: string, patch: Partial<ProductCard>) => {
    setProductCards(productCards.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  };`,
  ],
  [PRODUCT_UI_OLD, PRODUCT_UI_NEW],
]);

patch("client/src/panel-templates/types.ts", [
  ['  | "Integrations"\n  | "Reminders"', '  | "Integrations"\n  | "Commerce"\n  | "Reminders"'],
]);

patch("client/src/panel-templates/default/index.ts", [
  [
    `import DefaultIntegrationsPage from "./pages/Integrations";

const template: PanelTemplateModule = {
  meta: {
    id: "default",
    name: getPanelTemplateDisplayName("default"),
    description: getPanelTemplateDescription("default"),
  },
  Layout: PanelLayout,
  pages: {
    Integrations: DefaultIntegrationsPage,
  },
};`,
    `import DefaultIntegrationsPage from "./pages/Integrations";
import DefaultCommercePage from "./pages/Commerce";

const template: PanelTemplateModule = {
  meta: {
    id: "default",
    name: getPanelTemplateDisplayName("default"),
    description: getPanelTemplateDescription("default"),
  },
  Layout: PanelLayout,
  pages: {
    Integrations: DefaultIntegrationsPage,
    Commerce: DefaultCommercePage,
  },
};`,
  ],
]);

patch("client/src/panel-templates/ratehonk-v1/index.ts", [
  [
    `  RatehonkIntegrationsPage,
  RatehonkMySupportPage,`,
    `  RatehonkIntegrationsPage,
  RatehonkCommercePage,
  RatehonkMySupportPage,`,
  ],
  [
    `    Integrations: RatehonkIntegrationsPage,
    Reminders: RatehonkRemindersPage,`,
    `    Integrations: RatehonkIntegrationsPage,
    Commerce: RatehonkCommercePage,
    Reminders: RatehonkRemindersPage,`,
  ],
]);

patch("client/src/panel-templates/ratehonk-v1/pages/wrapped.ts", [
  ['export { default as RatehonkIntegrationsPage } from "./Integrations";', 'export { default as RatehonkIntegrationsPage } from "./Integrations";\nexport { default as RatehonkCommercePage } from "./Commerce";'],
]);

// create-template-page
patch("client/src/pages/create-template-page.tsx", [
  [
    `import { useState, useRef, useEffect } from "react";`,
    `import { useState, useRef, useEffect, useMemo } from "react";`,
  ],
  [
    `  const [productCards, setProductCards] = useState<ProductCard[]>([]);`,
    `  const [productCards, setProductCards] = useState<ProductCard[]>([]);
  const [metaCatalogIdForTemplate, setMetaCatalogIdForTemplate] = useState("");`,
  ],
  [
    `  const hasMultipleOfficialSessions = officialSessions.length > 1;`,
    `  const hasMultipleOfficialSessions = officialSessions.length > 1;

  const { data: commerceSettingsForTemplate } = useQuery<{ metaCatalogId?: string | null }>({
    queryKey: ["/api/commerce/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/commerce/settings");
      return res.json();
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (commerceSettingsForTemplate?.metaCatalogId && !metaCatalogIdForTemplate) {
      setMetaCatalogIdForTemplate(commerceSettingsForTemplate.metaCatalogId);
    }
  }, [commerceSettingsForTemplate?.metaCatalogId]);

  const catalogSessionIdForTemplate = useMemo(() => {
    const pid = selectedPhoneNumberId || phoneNumberIdFromUrl;
    if (pid) {
      const match = sessions.find(
        (s) =>
          s.connectionType === "official" &&
          (s.deviceInfo as { apiPhoneNumberId?: string })?.apiPhoneNumberId === pid
      );
      if (match?.sessionId) return match.sessionId;
    }
    const first = sessions.find((s) => s.connectionType === "official" && s.status === "connected");
    return first?.sessionId || "";
  }, [sessions, selectedPhoneNumberId, phoneNumberIdFromUrl]);`,
  ],
  [
    `                            phoneNumberId={phoneNumberIdFromUrl}
                            onOpenGalleryForMediaCard={(cardId, mediaType) => {`,
    `                            phoneNumberId={phoneNumberIdFromUrl}
                            catalogSessionId={catalogSessionIdForTemplate}
                            metaCatalogId={metaCatalogIdForTemplate}
                            onMetaCatalogIdChange={setMetaCatalogIdForTemplate}
                            onOpenGalleryForMediaCard={(cardId, mediaType) => {`,
  ],
  [
    `      if (!isAuthenticationTemplate && data.interactiveAction === 'PRODUCT_CARD_CAROUSEL') {
        apiData.productCards = productCards.map(card => ({
          buttonLabel: card.buttonLabel,
        }));
      }`,
    `      if (!isAuthenticationTemplate && data.interactiveAction === 'PRODUCT_CARD_CAROUSEL') {
        apiData.catalogId = metaCatalogIdForTemplate.trim() || undefined;
        apiData.productCards = productCards.map((card) => ({
          buttonLabel: card.buttonLabel,
          productRetailerId: card.productRetailerId,
          buttonType: card.buttonType || "spm",
          url: card.url,
          urlExample: card.urlExample,
        }));
      }`,
  ],
]);

// App commerce route
patch("client/src/App.tsx", [
  [
    `function CommerceRoute() {
  return (
    <PermissionGate permission="integrations.view">
      <CommercePage />
    </PermissionGate>
  );
}`,
    `function CommerceRoute() {
  return (
    <PermissionGate permission="integrations.view">
      <TemplatePageRoute pageKey="Commerce" default={CommercePage} />
    </PermissionGate>
  );
}`,
  ],
]);

console.log("patch-commerce-p2 complete");
