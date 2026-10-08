import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const switchTrackClass = cn(
  "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:cursor-not-allowed",
  /* Off / unchecked — visible gray track on white panels */
  "border-neutral-300 bg-neutral-200",
  "data-[state=checked]:border-transparent data-[state=checked]:bg-primary",
  /* Disabled off — stay visible (avoid opacity-only fade) */
  "disabled:data-[state=unchecked]:border-neutral-300 disabled:data-[state=unchecked]:bg-neutral-100",
  "disabled:data-[state=checked]:border-transparent disabled:data-[state=checked]:opacity-60",
)

const switchThumbClass = cn(
  "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md ring-1 ring-neutral-400/70 transition-transform",
  "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
  "data-[state=checked]:ring-primary/25",
  "disabled:ring-neutral-300",
)

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(switchTrackClass, className)}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb className={switchThumbClass} />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
