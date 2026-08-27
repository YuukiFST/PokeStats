import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "outline" | "subtle"
  size?: "sm" | "md" | "icon"
}

export function Button({ className, variant = "default", size = "md", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-blue-700)] disabled:opacity-50 disabled:pointer-events-none"
  const variants: Record<string, string> = {
    default: "bg-[var(--ds-gray-1000)] text-[var(--ds-background-100)] hover:bg-[var(--ds-gray-900)]",
    ghost: "hover:bg-[var(--ds-gray-100)] text-[var(--ds-gray-900)]",
    outline: "border border-[var(--ds-gray-400)] hover:bg-[var(--ds-gray-100)]",
    subtle: "bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)]",
  }
  const sizes: Record<string, string> = {
    sm: "h-7 px-2.5",
    md: "h-8 px-3",
    icon: "h-8 w-8 p-0",
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  )
}
