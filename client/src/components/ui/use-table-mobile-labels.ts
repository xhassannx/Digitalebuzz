import { useCallback, useLayoutEffect, type RefObject } from "react";

/** Copies thead column titles onto tbody cells as data-label for mobile stacked tables. */
export function useTableMobileLabels(
  containerRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const sync = useCallback(() => {
    if (!enabled) return;
    const root = containerRef.current;
    if (!root) return;
    const table = root.querySelector("table.rh-data-table");
    if (!table) return;

    const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
      (th.textContent ?? "").replace(/\s+/g, " ").trim(),
    );

    table.querySelectorAll("tbody tr").forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll(":scope > td"));
      cells.forEach((td, i) => {
        const label = headers[i];
        if (label) td.setAttribute("data-label", label);
        else td.removeAttribute("data-label");
      });
    });
  }, [containerRef, enabled]);

  useLayoutEffect(() => {
    sync();
    const root = containerRef.current;
    if (!root || !enabled) return;

    const observer = new MutationObserver(() => sync());
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [sync, enabled]);
}
