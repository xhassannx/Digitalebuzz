import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Search, Tag, X } from "lucide-react";
import { fetchLegacyListApi, coerceListApiResponse } from "@/lib/legacy-list-api";
import { apiRequest } from "@/lib/queryClient";
import { useDebouncedValue } from "@/lib/list-pagination";

export type ManagedContactPick = {
  id: string;
  phoneNumber: string;
  name: string | null;
  tags?: string[];
};

type ContactTagPick = {
  id: string;
  name: string;
  color: string;
};

type ContactFilterState = {
  tagIds: string[];
  noTagsOnly: boolean;
};

function buildContactsUrl(search: string, filters: ContactFilterState): string {
  const params = new URLSearchParams();
  const q = search.trim();
  if (q) params.set("search", q);
  if (filters.noTagsOnly) params.set("noTagsOnly", "true");
  filters.tagIds.forEach((id) => params.append("tagIds", id));
  const qs = params.toString();
  return qs ? `/api/contacts?${qs}` : "/api/contacts";
}

export function phonesFromContactIds(
  contacts: ManagedContactPick[],
  ids: Set<string>
): string[] {
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const phones: string[] = [];
  for (const id of ids) {
    const phone = byId.get(id)?.phoneNumber?.trim();
    if (phone) phones.push(phone);
  }
  return phones;
}

export function phoneFromContactId(
  contacts: ManagedContactPick[],
  id: string
): string {
  return contacts.find((c) => c.id === id)?.phoneNumber?.trim() || "";
}

function ContactTagBadges({
  tagIds,
  tagsById,
  max = 2,
}: {
  tagIds?: string[];
  tagsById: Map<string, ContactTagPick>;
  max?: number;
}) {
  if (!tagIds?.length) return null;
  const visible = tagIds.slice(0, max);
  const extra = tagIds.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {visible.map((tagId) => {
        const tag = tagsById.get(tagId);
        if (!tag) return null;
        return (
          <Badge
            key={tagId}
            variant="secondary"
            className="text-[10px] px-1.5 py-0 font-normal"
            style={{ color: tag.color, borderColor: `${tag.color}40` }}
          >
            {tag.name}
          </Badge>
        );
      })}
      {extra > 0 ? (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
          +{extra}
        </Badge>
      ) : null}
    </div>
  );
}

function ContactFilterBar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  tags,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  filters: ContactFilterState;
  onFiltersChange: (filters: ContactFilterState) => void;
  tags: ContactTagPick[];
}) {
  const [tagSearch, setTagSearch] = useState("");

  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, tagSearch]);

  const hasActiveFilters = filters.noTagsOnly || filters.tagIds.length > 0;

  const tagLabel = filters.noTagsOnly
    ? "No tags"
    : filters.tagIds.length
      ? `${filters.tagIds.length} tag(s)`
      : "Filter by tags";

  const clearFilters = () => onFiltersChange({ tagIds: [], noTagsOnly: false });

  const toggleTag = (tagId: string, checked: boolean) => {
    onFiltersChange({
      ...filters,
      noTagsOnly: false,
      tagIds: checked
        ? [...filters.tagIds, tagId]
        : filters.tagIds.filter((id) => id !== tagId),
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Search contacts by name or phone…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-9 justify-start font-normal shrink-0 sm:min-w-[160px]"
            >
              <Tag className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">{tagLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-7 h-8 text-sm"
                  placeholder="Search tags…"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto p-2 space-y-1">
              <label className="flex items-center gap-2 cursor-pointer rounded px-1 py-1 hover:bg-muted/50">
                <Checkbox
                  checked={filters.noTagsOnly}
                  onCheckedChange={(checked) =>
                    onFiltersChange({
                      tagIds: [],
                      noTagsOnly: !!checked,
                    })
                  }
                />
                <span className="text-sm">Not assigned tag</span>
              </label>
              <div className="border-t pt-2 mt-1 space-y-1">
                {filteredTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    {tags.length === 0 ? "No tags created yet" : "No tags match your search"}
                  </p>
                ) : (
                  filteredTags.map((tag) => (
                    <label
                      key={tag.id}
                      className="flex items-center gap-2 cursor-pointer rounded px-1 py-1 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={filters.tagIds.includes(tag.id)}
                        disabled={filters.noTagsOnly}
                        onCheckedChange={(checked) => toggleTag(tag.id, !!checked)}
                      />
                      <span className="text-sm truncate" style={{ color: tag.color }}>
                        {tag.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.noTagsOnly ? (
            <Badge variant="secondary" className="gap-1 pr-1">
              No tags
              <button
                type="button"
                className="rounded-full hover:bg-muted p-0.5"
                onClick={() => onFiltersChange({ ...filters, noTagsOnly: false })}
                aria-label="Remove no-tags filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ) : (
            filters.tagIds.map((tagId) => {
              const tag = tags.find((t) => t.id === tagId);
              if (!tag) return null;
              return (
                <Badge key={tagId} variant="secondary" className="gap-1 pr-1">
                  <span style={{ color: tag.color }}>{tag.name}</span>
                  <button
                    type="button"
                    className="rounded-full hover:bg-muted p-0.5"
                    onClick={() => toggleTag(tagId, false)}
                    aria-label={`Remove ${tag.name} filter`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })
          )}
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}

type ContactRecipientPickerProps = {
  mode: "single" | "multiple";
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  /** Merge loaded rows into parent cache (e.g. campaign recipient resolution). */
  onContactsLoaded?: (contacts: ManagedContactPick[]) => void;
  label?: string;
  className?: string;
  enabled?: boolean;
  listMaxHeightClass?: string;
};

export function ContactRecipientPicker({
  mode,
  selectedIds,
  onSelectionChange,
  onContactsLoaded,
  label,
  className,
  enabled = true,
  listMaxHeightClass = "max-h-48",
}: ContactRecipientPickerProps) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ContactFilterState>({ tagIds: [], noTagsOnly: false });
  const debouncedSearch = useDebouncedValue(search, 350);

  const { data: tags = [] } = useQuery<ContactTagPick[]>({
    queryKey: ["/api/tags"],
    queryFn: () => fetchLegacyListApi<ContactTagPick>("/api/tags", "tags"),
    enabled,
    staleTime: 60_000,
  });

  const contactsUrl = buildContactsUrl(debouncedSearch, filters);

  const { data: contacts = [], isLoading, isFetching } = useQuery<ManagedContactPick[]>({
    queryKey: ["/api/contacts", "recipient-picker", debouncedSearch, filters],
    queryFn: async () => {
      const res = await apiRequest("GET", contactsUrl);
      return coerceListApiResponse<ManagedContactPick>(await res.json(), "contacts");
    },
    enabled,
    staleTime: 30_000,
  });

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  useEffect(() => {
    if (contacts.length > 0 && onContactsLoaded) {
      onContactsLoaded(contacts);
    }
  }, [contacts, onContactsLoaded]);

  const singleId = mode === "single" ? Array.from(selectedIds)[0] || "" : "";
  const allFilteredSelected =
    contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id));

  const toggleContact = (contactId: string) => {
    const next = new Set(selectedIds);
    if (next.has(contactId)) {
      next.delete(contactId);
    } else {
      next.add(contactId);
    }
    onSelectionChange(next);
  };

  const emptyMessage = debouncedSearch.trim() || filters.tagIds.length || filters.noTagsOnly
    ? "No contacts match your search or filters."
    : "No contacts yet. Add contacts from the Contacts page.";

  if (mode === "single") {
    return (
      <div className={className}>
        {label ? <Label className="text-xs font-semibold">{label}</Label> : null}
        <div className="space-y-2 mt-1">
          <ContactFilterBar
            search={search}
            onSearchChange={setSearch}
            filters={filters}
            onFiltersChange={setFilters}
            tags={tags}
          />
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading contacts…
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <Select
              value={singleId}
              onValueChange={(id) => onSelectionChange(new Set([id]))}
            >
              <SelectTrigger data-testid="select-contact-recipient">
                <SelectValue placeholder="Select a contact" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span>
                      {c.name || c.phoneNumber} — {c.phoneNumber}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isFetching && !isLoading ? (
            <p className="text-[11px] text-muted-foreground">Updating list…</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {label ? <Label className="text-xs font-semibold">{label}</Label> : null}
      <div className="space-y-2 mt-1">
        <ContactFilterBar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          tags={tags}
        />
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading contacts…
          </div>
        ) : (
          <>
            <div className={`border rounded-lg overflow-y-auto divide-y ${listMaxHeightClass}`}>
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 px-3">{emptyMessage}</p>
              ) : (
                contacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedIds.has(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {contact.name || contact.phoneNumber}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.phoneNumber}
                      </p>
                      <ContactTagBadges tagIds={contact.tags} tagsById={tagsById} />
                    </div>
                  </label>
                ))
              )}
            </div>
            {contacts.length > 0 ? (
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground shrink-0">
                  {selectedIds.size} selected · {contacts.length} shown
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => {
                    if (allFilteredSelected) {
                      const next = new Set(selectedIds);
                      contacts.forEach((c) => next.delete(c.id));
                      onSelectionChange(next);
                    } else {
                      const next = new Set(selectedIds);
                      contacts.forEach((c) => next.add(c.id));
                      onSelectionChange(next);
                    }
                  }}
                >
                  {allFilteredSelected ? "Deselect shown" : "Select all shown"}
                </Button>
              </div>
            ) : null}
            {isFetching && !isLoading ? (
              <p className="text-[11px] text-muted-foreground">Updating list…</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
