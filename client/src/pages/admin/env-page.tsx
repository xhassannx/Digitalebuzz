import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, Loader2, Save, Plus, Trash2, FileKey, Eye, EyeOff } from "lucide-react";

type EnvEntry = { key: string; value: string; masked?: boolean };

export default function EnvPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [localEntries, setLocalEntries] = useState<EnvEntry[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ entries: EnvEntry[] }>({
    queryKey: ["/api/admin/env"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/env");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to load .env");
      }
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (data?.entries && localEntries.length === 0) setLocalEntries(data.entries.map((e) => ({ ...e })));
  }, [data?.entries]);

  const entries = localEntries.length > 0 ? localEntries : (data?.entries ?? []);

  const updateEntry = (index: number, field: "key" | "value", value: string) => {
    setLocalEntries((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addNew = () => {
    const k = newKey.trim();
    if (!k) return;
    setLocalEntries((prev) => [...prev, { key: k, value: newValue }]);
    setNewKey("");
    setNewValue("");
  };

  const removeEntry = (index: number) => {
    const key = entries[index]?.key;
    if (key) setRevealedKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
    setLocalEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleReveal = async (index: number) => {
    const entry = entries[index];
    if (!entry?.key || !entry.masked) return;
    const key = entry.key;
    if (revealedKeys.has(key)) {
      setRevealedKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
      setLocalEntries((prev) => {
        const next = [...prev];
        if (next[index]) next[index] = { ...next[index], value: "********" };
        return next;
      });
      return;
    }
    setLoadingKey(key);
    try {
      const res = await apiRequest("GET", `/api/admin/env/value?key=${encodeURIComponent(key)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to load value");
      setRevealedKeys((prev) => new Set(prev).add(key));
      setLocalEntries((prev) => {
        const next = [...prev];
        if (next[index]) next[index] = { ...next[index], value: data.value ?? "" };
        return next;
      });
    } catch {
      setSaveMessage({ type: "error", text: "Could not load value for " + key });
    } finally {
      setLoadingKey(null);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const toSend = entries
        .filter((e) => e.key.trim())
        .filter((e) => !e.masked || e.value !== "********")
        .map((e) => ({ key: e.key.trim(), value: e.masked && e.value === "********" ? "" : e.value }));
      const res = await apiRequest("PATCH", "/api/admin/env", { entries: toSend });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.message || "Failed to save");
      return result;
    },
    onSuccess: () => {
      setSaveMessage({ type: "success", text: "Saved. Restart the app or run Sync & restart in Updates for some variables to take effect." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/env"] });
      setLocalEntries([]);
    },
    onError: (err: Error) => {
      setSaveMessage({ type: "error", text: err.message });
    },
  });

  if (user && !user.isSaaSOwner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>Only SaaS administrators can edit environment variables.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/dashboard")} variant="outline" className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Environment variables</h1>
        <p className="text-muted-foreground mt-1">
          View and update the server .env file. Sensitive keys (secret, password, token) are masked; enter a new value to change them.
        </p>
      </div>

      {saveMessage && (
        <Alert variant={saveMessage.type === "error" ? "destructive" : "default"}>
          {saveMessage.type === "error" ? <AlertCircle className="h-4 w-4" /> : null}
          <AlertTitle>{saveMessage.type === "success" ? "Saved" : "Error"}</AlertTitle>
          <AlertDescription>{saveMessage.text}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileKey className="h-5 w-5" />
            .env
          </CardTitle>
          <CardDescription>
            Keys containing SECRET, PASSWORD, TOKEN, or KEY are shown as ********. Replace with a new value to update.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{(error as Error).message}</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                {entries.map((entry, index) => (
                  <div key={`${entry.key}-${index}`} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
                    <Input
                      value={entry.key}
                      onChange={(e) => updateEntry(index, "key", e.target.value)}
                      placeholder="KEY"
                      className="font-mono text-sm"
                    />
                    <div className="relative flex items-center gap-1">
                      <Input
                        type={entry.masked && !revealedKeys.has(entry.key) ? "password" : "text"}
                        value={entry.value}
                        onChange={(e) => updateEntry(index, "value", e.target.value)}
                        placeholder={entry.masked ? "Click View to reveal or enter new value" : "value"}
                        className="font-mono text-sm pr-9"
                      />
                      {entry.masked && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 h-8 w-8 shrink-0"
                          onClick={() => toggleReveal(index)}
                          disabled={loadingKey === entry.key}
                          aria-label={revealedKeys.has(entry.key) ? "Hide" : "View"}
                        >
                          {loadingKey === entry.key ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : revealedKeys.has(entry.key) ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeEntry(index)} aria-label="Remove">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <div className="flex gap-2 items-end flex-1 min-w-[200px]">
                  <div className="grid gap-1 flex-1">
                    <Label className="text-xs">New key</Label>
                    <Input
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="NEW_VAR"
                      className="font-mono"
                    />
                  </div>
                  <div className="grid gap-1 flex-1">
                    <Label className="text-xs">Value</Label>
                    <Input
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="value"
                      className="font-mono"
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addNew}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save .env
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
