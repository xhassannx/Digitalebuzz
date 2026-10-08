import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WebsiteBuilderBreadcrumb } from "@/components/website-builder-breadcrumb";
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";
import { safeRandomId } from "@/lib/safe-random-id";

type ScriptItem = {
  id: string;
  type: string;
  url: string;
  inlineCode: string;
  loadingStrategy: string;
  name: string;
  scriptId: string;
  description: string;
  noScript: boolean;
};
type ScriptsContent = { scripts?: ScriptItem[] };

export default function CustomScript() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<ScriptsContent>("scripts");

  const [view, setView] = useState<"list" | "add">("list");
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [form, setForm] = useState({
    type: "external",
    url: "",
    inlineCode: "",
    loadingStrategy: "beforeInteractive",
    name: "",
    scriptId: "",
    description: "",
    noScript: false,
  });

  useEffect(() => {
    if (content?.scripts && Array.isArray(content.scripts) && content.scripts.length > 0) {
      setScripts(
        content.scripts.map((s) => ({
          id: (s as ScriptItem).id || safeRandomId(),
          type: (s as ScriptItem).type ?? "external",
          url: (s as ScriptItem).url ?? "",
          inlineCode: (s as ScriptItem).inlineCode ?? "",
          loadingStrategy: (s as ScriptItem).loadingStrategy ?? "beforeInteractive",
          name: (s as ScriptItem).name ?? "",
          scriptId: (s as ScriptItem).scriptId ?? "",
          description: (s as ScriptItem).description ?? "",
          noScript: (s as ScriptItem).noScript ?? false,
        }))
      );
    }
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleAddScript = () => {
    const newScript: ScriptItem = {
      id: safeRandomId(),
      ...form,
    };
    const next = [...scripts, newScript];
    setScripts(next);
    save({ scripts: next });
    setForm({
      type: "external",
      url: "",
      inlineCode: "",
      loadingStrategy: "beforeInteractive",
      name: "",
      scriptId: "",
      description: "",
      noScript: false,
    });
    setView("list");
    toast({ title: "Script Added", description: "Custom script added successfully" });
  };

  /* ====================== LIST VIEW ====================== */
  if (view === "list") {
    return (
      <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
        <WebsiteBuilderBreadcrumb currentPage="Scripts" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            All Scripts List
          </h1>
          <Button onClick={() => setView("add")}>
            Add New Script
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="p-3">Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">URL</th>
                  <th className="p-3">Loading Strategy</th>
                  <th className="p-3">Description</th>
                </tr>
              </thead>

              <tbody>
                {scripts.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-6 text-center text-muted-foreground"
                    >
                      No results.
                    </td>
                  </tr>
                )}

                {scripts.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="p-3">{s.name || "-"}</td>
                    <td className="p-3">
                      {s.type === "external"
                        ? "External"
                        : "Inline"}
                    </td>
                    <td className="p-3 truncate max-w-[200px]">
                      {s.url || "-"}
                    </td>
                    <td className="p-3">
                      {s.loadingStrategy}
                    </td>
                    <td className="p-3">
                      {s.description || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ====================== ADD VIEW ====================== */
  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <div className="text-sm text-muted-foreground">
        <Link href="/website" className="hover:text-foreground hover:underline">Home</Link>
        <span className="mx-2">›</span>
        <Link href="/website" className="hover:text-foreground hover:underline">Website</Link>
        <span className="mx-2">›</span>
        <span
          className="cursor-pointer underline"
          onClick={() => setView("list")}
        >
          Scripts
        </span>
        <span className="mx-2">›</span>
        <span className="text-foreground font-medium">Manage Scripts</span>
      </div>

      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Add Script</CardTitle>
          <CardDescription>
            Choose how you want to add the script.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* TYPE */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Script Type
            </label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value="external"
                  checked={form.type === "external"}
                  onChange={handleChange}
                />
                External Script URL
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value="inline"
                  checked={form.type === "inline"}
                  onChange={handleChange}
                />
                Inline Script
              </label>
            </div>
          </div>

          {/* URL / INLINE */}
          {form.type === "external" ? (
            <div>
              <label className="text-sm font-medium">
                Script URL
              </label>
              <input
                name="url"
                value={form.url}
                onChange={handleChange}
                className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                placeholder="https://example.com/script.js"
              />
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium">
                Inline Script
              </label>
              <textarea
                name="inlineCode"
                rows={4}
                value={form.inlineCode}
                onChange={handleChange}
                className="w-full border rounded-md px-3 py-2 text-sm mt-1"
              />
            </div>
          )}

          {/* LOADING STRATEGY */}
          <div>
            <label className="text-sm font-medium">
              Loading Strategy
            </label>
            <select
              name="loadingStrategy"
              value={form.loadingStrategy}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm mt-1"
            >
              <option value="beforeInteractive">
                Before Interactive
              </option>
              <option value="afterInteractive">
                After Interactive
              </option>
              <option value="lazyOnload">Lazy Onload</option>
            </select>
          </div>

          {/* OPTIONAL FIELDS */}
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Script Name (Optional)"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />

          <input
            name="scriptId"
            value={form.scriptId}
            onChange={handleChange}
            placeholder="Script ID (Optional)"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />

          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            placeholder="Description (Optional)"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />

          {/* NOSCRIPT */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="noScript"
              checked={form.noScript}
              onChange={handleChange}
            />
            Include NoScript Tag
          </label>

          {/* SUBMIT */}
          <Button
            className="w-full"
            onClick={handleAddScript}
            disabled={isSaving || isLoading}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Script"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
