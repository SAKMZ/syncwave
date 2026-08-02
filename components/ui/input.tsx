import * as React from "react"

import { cn } from "@/lib/cn"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex w-full rounded-full border border-input bg-field px-4 py-[9px] text-[13px] text-foreground",
        "transition-[border-color,box-shadow,background-color] duration-200 ease-[var(--ease)]",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground hover:border-[color:var(--separator-strong)]",
        "focus-visible:border-[color:color-mix(in_oklab,var(--accent)_55%,transparent)]",
        "focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_18%,transparent)]",
        "focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
