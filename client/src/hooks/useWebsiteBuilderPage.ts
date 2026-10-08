import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const API_BASE = "/api/website-builder";

export function useWebsiteBuilderPage<T = Record<string, unknown>>(pageKey: string) {
  const queryClient = useQueryClient();
  const queryKey = [API_BASE, pageKey];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/${pageKey}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      return json;
    },
  });

  const content = (data?.content ?? null) as T | null;

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiRequest("POST", `${API_BASE}/${pageKey}`, payload);
      const json = await res.json() as { content?: Record<string, unknown> };
      return json;
    },
    onSuccess: (data) => {
      if (data && typeof data === "object" && "content" in data && data.content != null) {
        queryClient.setQueryData(queryKey, data);
      }
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/public/white-label/config"] });
    },
  });

  return {
    content,
    isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    error: mutation.error,
  };
}

/** Helper to sync API content into local state (call in useEffect when content changes). */
export function useWebsiteBuilderContentEffect<T>(
  content: T | null,
  setState: (value: T | ((prev: T) => T)) => void,
  defaultState: T
) {
  useEffect(() => {
    if (content != null && typeof content === "object" && Object.keys(content as object).length > 0) {
      setState({ ...defaultState, ...(content as object) } as T);
    }
  }, [content]);
}
