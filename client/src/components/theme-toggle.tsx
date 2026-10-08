import { useTheme } from "@/lib/theme-provider";
import { Button } from "@/components/ui/button";
import { Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled
      data-testid="button-theme-toggle"
      aria-label="Theme toggle (disabled - light mode only)"
    >
      <Sun className="h-5 w-5" />
    </Button>
  );
}
