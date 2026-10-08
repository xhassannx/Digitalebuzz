import * as React from "react";

/** Match Tailwind `lg` — sidebar uses sheet below this width. */
export const MOBILE_BREAKPOINT = 1024;

function getIsMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(getIsMobileViewport);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(getIsMobileViewport());
    };
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
    } else {
      mql.addListener(onChange);
    }
    onChange();
    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", onChange);
      } else {
        mql.removeListener(onChange);
      }
    };
  }, []);

  return isMobile;
}
