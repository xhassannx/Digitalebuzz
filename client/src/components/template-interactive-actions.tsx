import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountryCodeSelect } from "@/components/country-code-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Phone, Link as LinkIcon, MessageSquare, Globe, Search, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Image as ImageIcon, Video, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import type { CountryDialEntry } from "@/lib/country-dial-codes";
import { useToast } from "@/hooks/use-toast";
import { formatPanelUploadMaxMb } from "@shared/panel-upload-limits";

// Types
export type QuickReply = { id: string; text: string };
export type URLButton = { id: string; text: string; url: string; urlType: 'STATIC' | 'DYNAMIC' };
export type PhoneButton = { id: string; text: string; phoneNumber: string; countryCode: string };
export type ProductCard = {
  id: string;
  buttonLabel: string;
  productRetailerId?: string;
  productName?: string;
  buttonType?: "spm" | "url";
  url?: string;
  urlExample?: string;
};
export type MediaCard = { 
  id: string; 
  mediaType: 'IMAGE' | 'VIDEO'; 
  mediaUrl?: string; 
  bodyText: string; 
  buttons: Array<{ id: string; type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phoneNumber?: string; countryCode?: string }> 
};

interface InteractiveActionsProps {
  value: string;
  onChange: (value: string) => void;
  quickReplies: QuickReply[];
  setQuickReplies: (replies: QuickReply[] | ((prev: QuickReply[]) => QuickReply[])) => void;
  urlButtons: URLButton[];
  setUrlButtons: (buttons: URLButton[] | ((prev: URLButton[]) => URLButton[])) => void;
  phoneButtons: PhoneButton[];
  setPhoneButtons: (buttons: PhoneButton[] | ((prev: PhoneButton[]) => PhoneButton[])) => void;
  productCards: ProductCard[];
  setProductCards: (cards: ProductCard[] | ((prev: ProductCard[]) => ProductCard[])) => void;
  mediaCards: MediaCard[];
  setMediaCards: (cards: MediaCard[] | ((prev: MediaCard[]) => MediaCard[])) => void;
  selectedProductCardIndex: number;
  setSelectedProductCardIndex: (index: number) => void;
  selectedMediaCardIndex: number;
  setSelectedMediaCardIndex: (index: number) => void;
  formButtonText: string;
  setFormButtonText: (text: string) => void;
  selectedFlow: { id: string; name: string; flowId: string } | null;
  setSelectedFlow: (flow: { id: string; name: string; flowId: string } | null) => void;
  flowDialogOpen: boolean;
  setFlowDialogOpen: (open: boolean) => void;
  activeButtonTab: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  setActiveButtonTab: (tab: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER') => void;
  phoneNumberId?: string | null;
  catalogSessionId?: string | null;
  metaCatalogId?: string | null;
  onMetaCatalogIdChange?: (catalogId: string) => void;
  /** When provided, "Select media" / "Select video" in Media Card Carousel open the gallery; parent should open gallery and on selection call setMediaCards to set the card's mediaUrl */
  onOpenGalleryForMediaCard?: (cardId: string, mediaType: 'IMAGE' | 'VIDEO') => void;
}

export function TemplateInteractiveActions({
  value,
  onChange,
  quickReplies,
  setQuickReplies,
  urlButtons,
  setUrlButtons,
  phoneButtons,
  setPhoneButtons,
  productCards,
  setProductCards,
  mediaCards,
  setMediaCards,
  selectedProductCardIndex,
  setSelectedProductCardIndex,
  selectedMediaCardIndex,
  setSelectedMediaCardIndex,
  formButtonText,
  setFormButtonText,
  selectedFlow,
  setSelectedFlow,
  flowDialogOpen,
  setFlowDialogOpen,
  activeButtonTab,
  setActiveButtonTab,
  phoneNumberId,
  catalogSessionId,
  metaCatalogId,
  onMetaCatalogIdChange,
  onOpenGalleryForMediaCard,
}: InteractiveActionsProps) {
  const { toast } = useToast();
  const [productSearch, setProductSearch] = useState("");
  const [flowSearch, setFlowSearch] = useState('');
  const [flowPage, setFlowPage] = useState(1);
  const flowsPerPage = 5;

  const { data: countryDialEntries = [], isLoading: countryDialLoading } = useQuery<CountryDialEntry[]>({
    queryKey: ['/api/country-dial-codes'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/country-dial-codes');
      return res.json();
    },
    staleTime: 1000 * 60 * 60 * 24,
  });

  // When user selects Media Card Carousel, auto-add one card so the form fields show immediately (min 2 for submit, but 1 card shows the UI)
  useEffect(() => {
    if (value === 'MEDIA_CARD_CAROUSEL' && mediaCards.length === 0) {
      setMediaCards([{
        id: `media-${Date.now()}`,
        mediaType: 'IMAGE',
        bodyText: '',
        buttons: [],
      }]);
      setSelectedMediaCardIndex(0);
    }
  }, [value, mediaCards.length]);

  // Get phone numbers to find businessAccountId (fetch when phoneNumberId in URL so FORM flow list works)
  const { data: phoneNumbersData } = useQuery<{ success: boolean; phoneNumbers: any[] }>({
    queryKey: ['/api/integrations/whatsapp-business/added-phones'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations/whatsapp-business/added-phones');
      return await res.json();
    },
    enabled: !!phoneNumberId,
  });

  // Find businessAccountId from phone number (WABA id; do not use phoneNumberId as businessAccountId)
  const matchedPhone = phoneNumbersData?.phoneNumbers?.find(
    (p: any) => p.phoneNumberId === phoneNumberId || p.id === phoneNumberId
  );
  const businessAccountId = matchedPhone?.businessAccountId || matchedPhone?.wabaId || undefined;

  const { data: orgData } = useQuery<{ organizations?: { id: string }[] }>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });
  const organizationId = Array.isArray(orgData) ? orgData?.[0]?.id : (orgData?.organizations ?? [])[0]?.id;

  // Fetch flows for form selection (org-scoped)
  const { data: flows = [], isLoading: isLoadingFlows } = useQuery<Array<{ id: string; name: string; flowId: string; status: string; category?: string }>>({
    queryKey: ['/api/whatsapp-flows', organizationId, businessAccountId],
    queryFn: async () => {
      if (!businessAccountId) return [];
      try {
        const params = new URLSearchParams({ businessAccountId });
        if (organizationId) params.set("organizationId", organizationId);
        const data = await fetchLegacyListApi<{ id: string; name: string; flowId: string; status: string; category?: string }>(
          `/api/whatsapp-flows?${params.toString()}`,
          "flows"
        );
        return data.filter((f) => f.status === "PUBLISHED");
      } catch (error) {
        console.error('Error fetching flows:', error);
        return [];
      }
    },
    enabled: !!businessAccountId && value === 'FORM',
  });

  const filteredFlows = flows?.filter(f => 
    f.name.toLowerCase().includes(flowSearch.toLowerCase()) ||
    (f.flowId && f.flowId.toString().includes(flowSearch))
  ) || [];

  // Pagination
  const totalPages = Math.ceil(filteredFlows.length / flowsPerPage);
  const startIndex = (flowPage - 1) * flowsPerPage;
  const paginatedFlows = filteredFlows.slice(startIndex, startIndex + flowsPerPage);

  // Helper functions
  const addQuickReply = () => {
    if (quickReplies.length >= 9) {
      return;
    }
    // Add new reply at the end to maintain insertion order
    setQuickReplies(prev => [...prev, { id: `qr-${Date.now()}`, text: '' }]);
  };

  const updateQuickReply = (id: string, text: string) => {
    if (text.length > 25) return;
    setQuickReplies(quickReplies.map(qr => qr.id === id ? { ...qr, text } : qr));
  };

  const moveQuickReply = (id: string, direction: -1 | 1) => {
    setQuickReplies((prev) => {
      const next = [...prev];
      const index = next.findIndex((qr) => qr.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addURLButton = () => {
    if (urlButtons.length >= 2) return;
    // Add new button at the end to maintain insertion order
    setUrlButtons(prev => [...prev, { id: `url-${Date.now()}`, text: '', url: '', urlType: 'STATIC' }]);
  };

  const updateURLButton = (id: string, field: 'text' | 'url' | 'urlType', value: string) => {
    if (field === 'text' && value.length > 25) return;
    setUrlButtons(urlButtons.map(btn => btn.id === id ? { ...btn, [field]: value } : btn));
  };

  const removeURLButton = (id: string) => {
    setUrlButtons(urlButtons.filter(btn => btn.id !== id));
  };

  const addPhoneButton = () => {
    if (phoneButtons.length >= 1) return;
    // Add new button at the end to maintain insertion order
    setPhoneButtons(prev => [...prev, { id: `phone-${Date.now()}`, text: '', phoneNumber: '', countryCode: '+1' }]);
  };

  const updatePhoneButton = (id: string, field: 'text' | 'phoneNumber' | 'countryCode', value: string) => {
    if (field === 'text' && value.length > 25) return;
    setPhoneButtons(phoneButtons.map(btn => btn.id === id ? { ...btn, [field]: value } : btn));
  };

  const removePhoneButton = (id: string) => {
    setPhoneButtons(phoneButtons.filter(btn => btn.id !== id));
  };

  const { data: catalogProductsData, isLoading: catalogProductsLoading } = useQuery<{
    products: Array<{ retailerId: string; name: string }>;
    warning?: string;
    commerceNote?: string;
  }>({
    queryKey: ["/api/commerce/catalog/products", catalogSessionId, metaCatalogId, productSearch],
    queryFn: async () => {
      const qs = new URLSearchParams({
        sessionId: catalogSessionId || "",
        catalogId: metaCatalogId || "",
        limit: "40",
      });
      if (productSearch.trim()) qs.set("search", productSearch.trim());
      const res = await apiRequest("GET", `/api/commerce/catalog/products?${qs}`);
      return res.json();
    },
    enabled: value === "PRODUCT_CARD_CAROUSEL" && !!catalogSessionId && !!metaCatalogId,
    staleTime: 30_000,
  });
  const catalogProducts = catalogProductsData?.products ?? [];
  const catalogProductsWarning = (
    catalogProductsData?.warning ||
    catalogProductsData?.commerceNote ||
    ""
  ).trim();

  const addProductCard = () => {
    if (productCards.length >= 10) return;
    const firstType = productCards[0]?.buttonType || "spm";
    setProductCards([
      ...productCards,
      { id: `card-${Date.now()}`, buttonLabel: "View", buttonType: firstType },
    ]);
    setSelectedProductCardIndex(productCards.length);
  };

  const updateProductCard = (id: string, patch: Partial<ProductCard>) => {
    setProductCards(productCards.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  };

  const removeProductCard = (id: string) => {
    const newCards = productCards.filter(card => card.id !== id);
    setProductCards(newCards);
    if (selectedProductCardIndex >= newCards.length) {
      setSelectedProductCardIndex(Math.max(0, newCards.length - 1));
    }
  };

  const addMediaCard = () => {
    if (mediaCards.length >= 10) return;
    setMediaCards([...mediaCards, { 
      id: `media-${Date.now()}`, 
      mediaType: 'IMAGE', 
      bodyText: '', 
      buttons: [] 
    }]);
    setSelectedMediaCardIndex(mediaCards.length);
  };

  const updateMediaCard = (id: string, field: 'mediaType' | 'mediaUrl' | 'bodyText', value: string) => {
    setMediaCards(mediaCards.map(card => card.id === id ? { ...card, [field]: value } : card));
  };

  const getButtonTypeSignature = (
    buttons: Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' }>
  ) => buttons.map((b) => b.type);

  const getReferenceButtonTypes = () => {
    const firstCardWithButtons = mediaCards.find((c) => c.buttons.length > 0);
    return firstCardWithButtons ? getButtonTypeSignature(firstCardWithButtons.buttons) : [];
  };

  const addMediaCardButton = (cardId: string, type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER') => {
    const card = mediaCards.find(c => c.id === cardId);
    if (!card || card.buttons.length >= 2) return;
    const referenceTypes = getReferenceButtonTypes();
    if (referenceTypes.length > 0) {
      const candidateTypes = [...getButtonTypeSignature(card.buttons), type];
      const isValidPrefix = candidateTypes.every((t, idx) => t === referenceTypes[idx]);
      if (!isValidPrefix) {
        toast({
          title: "Button type not allowed",
          description:
            "For WhatsApp media carousel, all cards must use the same button types in the same order.",
          variant: "destructive",
        });
        return;
      }
    }
    const defaultText = type === 'QUICK_REPLY' ? 'Quick Reply' : type === 'URL' ? 'URL' : 'Call';
    const newButton = {
      id: `btn-${Date.now()}`,
      type,
      text: defaultText,
      ...(type === 'URL' ? { url: '' } : {}),
      ...(type === 'PHONE_NUMBER' ? { phoneNumber: '', countryCode: '+1' } : {}),
    };
    
    setMediaCards(mediaCards.map(card => 
      card.id === cardId 
        ? { ...card, buttons: [...card.buttons, newButton] }
        : card
    ));
  };

  const updateMediaCardButton = (cardId: string, buttonId: string, field: string, value: string) => {
    setMediaCards(mediaCards.map(card => 
      card.id === cardId
        ? {
            ...card,
            buttons: card.buttons.map(btn => 
              btn.id === buttonId ? { ...btn, [field]: value } : btn
            )
          }
        : card
    ));
  };

  const removeMediaCardButton = (cardId: string, buttonId: string) => {
    setMediaCards(mediaCards.map(card => 
      card.id === cardId
        ? { ...card, buttons: card.buttons.filter(btn => btn.id !== buttonId) }
        : card
    ));
  };

  const removeMediaCard = (id: string) => {
    const newCards = mediaCards.filter(card => card.id !== id);
    setMediaCards(newCards);
    if (selectedMediaCardIndex >= newCards.length) {
      setSelectedMediaCardIndex(Math.max(0, newCards.length - 1));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Interactive Actions</Label>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          In addition to your message, you can send actions with your message. Maximum 25 characters are allowed in CTA button title & Quick Replies.
        </p>
        <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="NONE" id="none" />
            <Label htmlFor="none" className="cursor-pointer">None</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="CALL_TO_ACTION" id="cta" />
            <Label htmlFor="cta" className="cursor-pointer">Call to Actions</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="QUICK_REPLY" id="quick-reply" />
            <Label htmlFor="quick-reply" className="cursor-pointer">Quick Replies</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="ALL" id="all" />
            <Label htmlFor="all" className="cursor-pointer">All</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="PRODUCT_CARD_CAROUSEL" id="product-carousel" />
            <Label htmlFor="product-carousel" className="cursor-pointer">Product Card Carousel</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="MEDIA_CARD_CAROUSEL" id="media-carousel" />
            <Label htmlFor="media-carousel" className="cursor-pointer">Media Card Carousel</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="FORM" id="form" />
            <Label htmlFor="form" className="cursor-pointer">Form</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Call to Actions */}
      {value === 'CALL_TO_ACTION' && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={urlButtons.length > 0 ? "default" : "outline"}
              onClick={() => setActiveButtonTab('URL')}
              className="flex items-center gap-2"
            >
              <LinkIcon className="h-4 w-4" />
              URL
              {urlButtons.length > 0 && <Badge variant="secondary">{urlButtons.length}</Badge>}
            </Button>
            <Button
              type="button"
              variant={phoneButtons.length > 0 ? "default" : "outline"}
              onClick={() => setActiveButtonTab('PHONE_NUMBER')}
              className="flex items-center gap-2"
            >
              <Phone className="h-4 w-4" />
              Phone Number
              {phoneButtons.length > 0 && <Badge variant="secondary">{phoneButtons.length}</Badge>}
            </Button>
          </div>

          {activeButtonTab === 'URL' && (
            <div className="space-y-3">
              {/* Sort buttons by ID (timestamp) to maintain insertion order */}
              {[...urlButtons].sort((a, b) => {
                const aTime = parseInt(a.id.replace('url-', '')) || 0;
                const bTime = parseInt(b.id.replace('url-', '')) || 0;
                return aTime - bTime;
              }).map((btn) => (
                <div key={btn.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">URL</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeURLButton(btn.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-sm">URL Type</Label>
                    <Select value={btn.urlType} onValueChange={(v) => updateURLButton(btn.id, 'urlType', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STATIC">Static URL</SelectItem>
                        <SelectItem value="DYNAMIC">Dynamic URL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Button Title</Label>
                    <Input
                      value={btn.text}
                      onChange={(e) => updateURLButton(btn.id, 'text', e.target.value)}
                      placeholder="Enter button title"
                      maxLength={25}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">URL</Label>
                    <Input
                      value={btn.url}
                      onChange={(e) => updateURLButton(btn.id, 'url', e.target.value)}
                      placeholder="https://example.com/"
                    />
                  </div>
                </div>
              ))}
              {urlButtons.length < 2 && (
                <Button type="button" variant="outline" onClick={addURLButton} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Call to Action
                </Button>
              )}
            </div>
          )}

          {activeButtonTab === 'PHONE_NUMBER' && (
            <div className="space-y-3">
              {/* Sort buttons by ID (timestamp) to maintain insertion order */}
              {[...phoneButtons].sort((a, b) => {
                const aTime = parseInt(a.id.replace('phone-', '')) || 0;
                const bTime = parseInt(b.id.replace('phone-', '')) || 0;
                return aTime - bTime;
              }).map((btn) => (
                <div key={btn.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">PHONE_NUMBER</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePhoneButton(btn.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-sm">Button Title</Label>
                    <Input
                      value={btn.text}
                      onChange={(e) => updatePhoneButton(btn.id, 'text', e.target.value)}
                      placeholder="Enter button title"
                      maxLength={25}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-sm">Country Code</Label>
                      <CountryCodeSelect
                        entries={countryDialEntries}
                        isLoading={countryDialLoading}
                        value={btn.countryCode}
                        onValueChange={(v) => updatePhoneButton(btn.id, 'countryCode', v)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Phone Number</Label>
                      <Input
                        value={btn.phoneNumber}
                        onChange={(e) => updatePhoneButton(btn.id, 'phoneNumber', e.target.value)}
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {phoneButtons.length < 1 && (
                <Button type="button" variant="outline" onClick={addPhoneButton} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Call to Action
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Replies */}
      {value === 'QUICK_REPLY' && (
        <div className="space-y-3 border rounded-lg p-4">
          {quickReplies.map((qr, index) => (
            <div key={qr.id} className="flex items-center gap-2">
              <div className="flex flex-col">
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => moveQuickReply(qr.id, -1)}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={index === quickReplies.length - 1} onClick={() => moveQuickReply(qr.id, 1)}>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={qr.text}
                onChange={(e) => updateQuickReply(qr.id, e.target.value)}
                placeholder={`Quick Reply ${index + 1}`}
                maxLength={25}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeQuickReply(qr.id)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
          {quickReplies.length < 9 && (
            <Button type="button" variant="outline" onClick={addQuickReply} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Quick Reply
            </Button>
          )}
        </div>
      )}

      {/* All - Show tabs for Quick Reply, URL, Phone Number */}
      {value === 'ALL' && (
        <div className="space-y-4 border rounded-lg p-4">
          <Tabs value={activeButtonTab} onValueChange={(v) => setActiveButtonTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="QUICK_REPLY" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Quick Reply
                {quickReplies.length > 0 && <Badge variant="secondary">{quickReplies.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="URL" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                URL
                {urlButtons.length > 0 && <Badge variant="secondary">{urlButtons.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="PHONE_NUMBER" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number
                {phoneButtons.length > 0 && <Badge variant="secondary">{phoneButtons.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="QUICK_REPLY" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">
                Quick replies (including Stop / opt-out) are sent last, after URL and call buttons. Use the arrows to reorder them.
              </p>
              {quickReplies.map((qr, index) => (
                <div key={qr.id} className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => moveQuickReply(qr.id, -1)}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={index === quickReplies.length - 1} onClick={() => moveQuickReply(qr.id, 1)}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    value={qr.text}
                    onChange={(e) => updateQuickReply(qr.id, e.target.value)}
                    placeholder={`Quick reply ${index + 1}`}
                    maxLength={25}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuickReply(qr.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              {quickReplies.length < 9 && (
                <Button type="button" variant="outline" onClick={addQuickReply} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Quick Reply
                </Button>
              )}
            </TabsContent>

            <TabsContent value="URL" className="space-y-3 mt-4">
              {urlButtons.map((btn) => (
                <div key={btn.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">URL</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeURLButton(btn.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-sm">URL Type</Label>
                    <Select value={btn.urlType} onValueChange={(v) => updateURLButton(btn.id, 'urlType', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STATIC">Static URL</SelectItem>
                        <SelectItem value="DYNAMIC">Dynamic URL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Button Title</Label>
                    <Input
                      value={btn.text}
                      onChange={(e) => updateURLButton(btn.id, 'text', e.target.value)}
                      placeholder="Enter button title"
                      maxLength={25}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">URL</Label>
                    <Input
                      value={btn.url}
                      onChange={(e) => updateURLButton(btn.id, 'url', e.target.value)}
                      placeholder="https://example.com/"
                    />
                  </div>
                </div>
              ))}
              {urlButtons.length < 2 && (
                <Button type="button" variant="outline" onClick={addURLButton} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Call to Action
                </Button>
              )}
            </TabsContent>

            <TabsContent value="PHONE_NUMBER" className="space-y-3 mt-4">
              {phoneButtons.map((btn) => (
                <div key={btn.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">PHONE_NUMBER</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePhoneButton(btn.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-sm">Button Title</Label>
                    <Input
                      value={btn.text}
                      onChange={(e) => updatePhoneButton(btn.id, 'text', e.target.value)}
                      placeholder="Enter button title"
                      maxLength={25}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-sm">Country Code</Label>
                      <CountryCodeSelect
                        entries={countryDialEntries}
                        isLoading={countryDialLoading}
                        value={btn.countryCode}
                        onValueChange={(v) => updatePhoneButton(btn.id, 'countryCode', v)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Phone Number</Label>
                      <Input
                        value={btn.phoneNumber}
                        onChange={(e) => updatePhoneButton(btn.id, 'phoneNumber', e.target.value)}
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {phoneButtons.length < 1 && (
                <Button type="button" variant="outline" onClick={addPhoneButton} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Call to Action
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Product Card Carousel */}
      {value === 'PRODUCT_CARD_CAROUSEL' && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Product Card Carousel</Label>
            <Button type="button" variant="outline" onClick={addProductCard} disabled={productCards.length >= 10}>
              <Plus className="h-4 w-4 mr-2" />
              Add Card
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Meta requires at least 2 cards when creating the template. After approval you can send up to 10 products.
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
              Connect WhatsApp Business API and set catalog ID on Commerce to pick products.
            </p>
          ) : null}
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
                    ) : catalogProducts.length === 0 && catalogProductsWarning ? (
                      <p className="text-xs text-amber-800 dark:text-amber-200">{catalogProductsWarning}</p>
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
                        <Label htmlFor="product-btn-spm" className="font-normal cursor-pointer">
                          View in WhatsApp
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="url" id="product-btn-url" />
                        <Label htmlFor="product-btn-url" className="font-normal cursor-pointer">
                          Open URL
                        </Label>
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
                            updateProductCard(productCards[selectedProductCardIndex].id, {
                              url: e.target.value,
                            })
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
      )}

      {/* Media Card Carousel */}
      {value === 'MEDIA_CARD_CAROUSEL' && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">Media Card Carousel</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 2 cards required, maximum 10 cards allowed.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={addMediaCard} disabled={mediaCards.length >= 10}>
              <Plus className="h-4 w-4 mr-2" />
              Add Card
            </Button>
          </div>

          {mediaCards.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <p>No media cards added yet. Add a card to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMediaCardIndex(Math.max(0, selectedMediaCardIndex - 1))}
                  disabled={selectedMediaCardIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">Card {selectedMediaCardIndex + 1} of {mediaCards.length}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMediaCardIndex(Math.min(mediaCards.length - 1, selectedMediaCardIndex + 1))}
                  disabled={selectedMediaCardIndex === mediaCards.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {mediaCards[selectedMediaCardIndex] && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Card {selectedMediaCardIndex + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMediaCard(mediaCards[selectedMediaCardIndex].id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={mediaCards[selectedMediaCardIndex].mediaType === 'IMAGE' ? 'default' : 'outline'}
                      onClick={() => updateMediaCard(mediaCards[selectedMediaCardIndex].id, 'mediaType', 'IMAGE')}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Image
                    </Button>
                    <Button
                      type="button"
                      variant={mediaCards[selectedMediaCardIndex].mediaType === 'VIDEO' ? 'default' : 'outline'}
                      onClick={() => updateMediaCard(mediaCards[selectedMediaCardIndex].id, 'mediaType', 'VIDEO')}
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Video
                    </Button>
                  </div>

                  {mediaCards[selectedMediaCardIndex].mediaType === 'IMAGE' && (
                    <div>
                      <Label className="text-sm">Upload image</Label>
                      <p className="text-xs text-muted-foreground">image type allowed: image/jpeg, image/jpg, image/png</p>
                      <p className="text-xs text-muted-foreground">File Size Limit: {formatPanelUploadMaxMb("image")} MB</p>
                      {mediaCards[selectedMediaCardIndex].mediaUrl && (
                        <div className="mt-2 rounded-lg overflow-hidden border bg-muted/30">
                          <img src={mediaCards[selectedMediaCardIndex].mediaUrl} alt="Card" className="w-full h-32 object-cover" />
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => onOpenGalleryForMediaCard?.(mediaCards[selectedMediaCardIndex].id, 'IMAGE')}
                      >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        {mediaCards[selectedMediaCardIndex].mediaUrl ? 'Change image' : 'Select from gallery'}
                      </Button>
                    </div>
                  )}

                  {mediaCards[selectedMediaCardIndex].mediaType === 'VIDEO' && (
                    <div>
                      <Label className="text-sm">Upload video</Label>
                      <p className="text-xs text-muted-foreground">video type allowed: video/mp4</p>
                      <p className="text-xs text-muted-foreground">File Size Limit: {formatPanelUploadMaxMb("video")} MB</p>
                      {mediaCards[selectedMediaCardIndex].mediaUrl && (
                        <div className="mt-2 rounded-lg overflow-hidden border bg-muted/30 flex items-center justify-center h-24">
                          <Video className="h-8 w-8 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground ml-2">Video selected</span>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => onOpenGalleryForMediaCard?.(mediaCards[selectedMediaCardIndex].id, 'VIDEO')}
                      >
                        <Video className="h-4 w-4 mr-2" />
                        {mediaCards[selectedMediaCardIndex].mediaUrl ? 'Change video' : 'Select from gallery'}
                      </Button>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm">Body Text</Label>
                      <Info className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Up to 160 characters are allowed.</span>
                    </div>
                    <Textarea
                      value={mediaCards[selectedMediaCardIndex].bodyText}
                      onChange={(e) => {
                        if (e.target.value.length <= 160) {
                          updateMediaCard(mediaCards[selectedMediaCardIndex].id, 'bodyText', e.target.value);
                        }
                      }}
                      placeholder="Enter body text"
                      rows={3}
                      maxLength={160}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm">Buttons</Label>
                      <Info className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Minimum 1 button required, maximum 2. All cards must use the same button types in the same order.</span>
                    </div>
                    {mediaCards[selectedMediaCardIndex].buttons.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No buttons added yet</p>
                    ) : (
                      <div className="space-y-3">
                        {mediaCards[selectedMediaCardIndex].buttons.map((btn) => (
                          <div key={btn.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline">{btn.type}</Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMediaCardButton(mediaCards[selectedMediaCardIndex].id, btn.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                            <Input
                              value={btn.text}
                              onChange={(e) => updateMediaCardButton(mediaCards[selectedMediaCardIndex].id, btn.id, 'text', e.target.value)}
                              placeholder="Button text"
                              maxLength={25}
                            />
                            {btn.type === 'URL' && (
                              <Input
                                value={btn.url || ''}
                                onChange={(e) => updateMediaCardButton(mediaCards[selectedMediaCardIndex].id, btn.id, 'url', e.target.value)}
                                placeholder="https://example.com/"
                              />
                            )}
                            {btn.type === 'PHONE_NUMBER' && (
                              <div className="grid grid-cols-2 gap-2">
                                <CountryCodeSelect
                                  entries={countryDialEntries}
                                  isLoading={countryDialLoading}
                                  compactTrigger
                                  value={btn.countryCode || '+1'}
                                  onValueChange={(v) =>
                                    updateMediaCardButton(mediaCards[selectedMediaCardIndex].id, btn.id, 'countryCode', v)
                                  }
                                />
                                <Input
                                  value={btn.phoneNumber || ''}
                                  onChange={(e) => updateMediaCardButton(mediaCards[selectedMediaCardIndex].id, btn.id, 'phoneNumber', e.target.value)}
                                  placeholder="Phone number"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {mediaCards[selectedMediaCardIndex].buttons.length < 2 && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addMediaCardButton(mediaCards[selectedMediaCardIndex].id, 'QUICK_REPLY')}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Quick Reply
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addMediaCardButton(mediaCards[selectedMediaCardIndex].id, 'URL')}
                        >
                          <Globe className="h-4 w-4 mr-2" />
                          URL
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addMediaCardButton(mediaCards[selectedMediaCardIndex].id, 'PHONE_NUMBER')}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Phone
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Form */}
      {value === 'FORM' && (
        <div className="space-y-4 border rounded-lg p-4">
          <div>
            <Label className="text-sm">Button Text</Label>
            <Input
              value={formButtonText}
              onChange={(e) => setFormButtonText(e.target.value)}
              placeholder="View"
              maxLength={25}
            />
          </div>
          <div>
            <Label className="text-base font-semibold">Flow Options</Label>
            <div className="mt-2">
              <Label className="text-sm text-muted-foreground">Use Existing Flow</Label>
              <p className="text-xs text-muted-foreground mb-2">Select from published flows</p>
              <div className="flex items-center gap-2">
                <Input
                  value={selectedFlow?.name || ''}
                  placeholder="Select from published flows"
                  readOnly
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFlowDialogOpen(true)}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Browse Flows
                </Button>
              </div>
              {selectedFlow && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline">Selected: {selectedFlow.name}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFlow(null)}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Flow Selection Dialog */}
      <Dialog open={flowDialogOpen} onOpenChange={(open) => {
        setFlowDialogOpen(open);
        if (open) {
          // Reset search and page when dialog opens
          setFlowSearch('');
          setFlowPage(1);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Published Flow</DialogTitle>
            <DialogDescription>Choose from your published WhatsApp flows</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={flowSearch}
                onChange={(e) => setFlowSearch(e.target.value)}
                placeholder="Search flows..."
                className="pl-10"
              />
            </div>
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              {isLoadingFlows ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p>Loading flows...</p>
                </div>
              ) : filteredFlows.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No published flows found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {paginatedFlows.map((flow) => (
                    <div key={flow.id} className="p-4 flex items-center justify-between hover:bg-muted/50">
                      <div className="flex-1">
                        <p className="font-medium">{flow.name}</p>
                        <p className="text-sm text-muted-foreground">ID: {flow.flowId || flow.id}</p>
                        {flow.category && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {flow.category}
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-4"
                        onClick={() => {
                          setSelectedFlow({ id: flow.id, name: flow.name, flowId: flow.flowId || flow.id });
                          setFlowDialogOpen(false);
                          setFlowSearch(''); // Clear search when selecting
                          setFlowPage(1); // Reset to first page
                        }}
                      >
                        Select
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {filteredFlows.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFlowPage(prev => Math.max(1, prev - 1))}
                  disabled={flowPage === 1}
                >
                  &lt; Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {flowPage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFlowPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={flowPage === totalPages}
                >
                  Next &gt;
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

