import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ContactRound, GitBranch, MessageSquare, UserPlus } from "lucide-react";
import { RhSearchField } from "./rh/RhSearchField";

const SEARCH_TARGETS = [
  { label: "Contacts", path: "/contacts", icon: ContactRound },
  { label: "Leads", path: "/leads", icon: UserPlus },
  { label: "Messages", path: "/chat", icon: MessageSquare },
  { label: "Flows", path: "/flows", icon: GitBranch },
] as const;

export function GlobalHeaderSearch() {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const navigateTo = (path: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLocation(`${path}?search=${encodeURIComponent(trimmed)}`);
    setQuery("");
    setMenuOpen(false);
  };

  const openMenu = () => {
    if (query.trim()) {
      setMenuOpen(true);
    }
  };

  return (
    <div ref={containerRef} className="relative hidden min-w-0 max-w-xl flex-1 md:block">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          openMenu();
        }}
      >
        <RhSearchField
          value={query}
          onChange={(value) => {
            setQuery(value);
            if (!value.trim()) {
              setMenuOpen(false);
            }
          }}
          placeholder="Search contacts, messages, or flows..."
          className="w-full [&_input]:h-10 [&_input]:rounded-lg"
          aria-label="Search"
        />
      </form>

      {menuOpen && query.trim() ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-50 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg"
          role="listbox"
          aria-label="Search destinations"
        >
          {SEARCH_TARGETS.map(({ label, path, icon: Icon }) => (
            <button
              key={path}
              type="button"
              role="option"
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-[#111c2d] hover:bg-[#f3f6ff]"
              onClick={() => navigateTo(path)}
            >
              <Icon className="h-4 w-4 shrink-0 text-[#6b7280]" />
              <span>
                Search <span className="font-medium">{label.toLowerCase()}</span> for &ldquo;
                {query.trim()}&rdquo;
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
