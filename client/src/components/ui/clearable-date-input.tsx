import * as React from "react";
import { Calendar, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ClearableDateInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Show calendar icon on the left (default true). */
  showCalendarIcon?: boolean;
}

/** Native date input with a clear (×) control when a value is set. */
export function ClearableDateInput({
  className,
  value,
  onChange,
  showCalendarIcon = true,
  disabled,
  ...props
}: ClearableDateInputProps) {
  const hasValue = Boolean(value && String(value).trim());

  const clear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange({
      target: { value: "" },
      currentTarget: { value: "" },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className="relative">
      {showCalendarIcon && (
        <Calendar
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      )}
      <Input
        type="date"
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={cn(showCalendarIcon && "pl-10", hasValue && "pr-10", className)}
        {...props}
      />
      {hasValue && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={clear}
          aria-label="Clear date"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
