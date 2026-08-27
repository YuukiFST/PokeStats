import * as React from "react"
import { cn } from "@/lib/utils"

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-8 w-full rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-2.5 text-sm placeholder:text-[var(--ds-gray-700)] focus:outline-none focus:border-[var(--ds-gray-600)] focus:ring-1 focus:ring-[var(--ds-gray-600)]",
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = "Input"
