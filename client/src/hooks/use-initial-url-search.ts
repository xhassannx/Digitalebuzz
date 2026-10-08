import { useEffect } from "react";

/** Applies `?search=` from the URL to local page search state on first mount. */
export function useInitialUrlSearch(setSearchQuery: (value: string) => void) {
  useEffect(() => {
    const search = new URLSearchParams(window.location.search).get("search");
    if (search) {
      setSearchQuery(search);
    }
  }, [setSearchQuery]);
}
