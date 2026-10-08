export function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function interpolateTemplate(template: string, root: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, rawPath: string) => {
    const path = String(rawPath).trim();
    const v = getByPath(root, path);
    if (v == null) return "";
    if (typeof v === "object") {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  });
}

export function deepInterpolateConfig(cfg: unknown, root: Record<string, unknown>): unknown {
  if (cfg == null) return cfg;
  if (typeof cfg === "string") return interpolateTemplate(cfg, root);
  if (Array.isArray(cfg)) return cfg.map((x) => deepInterpolateConfig(x, root));
  if (typeof cfg === "object") {
    const o = cfg as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (k.startsWith("_")) {
        out[k] = v;
        continue;
      }
      out[k] = deepInterpolateConfig(v, root);
    }
    return out;
  }
  return cfg;
}
