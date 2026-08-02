import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn"

/* Syncwave's aesthetic: fully rounded pills, uppercase letter-spaced labels,
   1px borders. Every variant shares one radius, one transition and the same
   hover/active response — the tone is the only thing that changes.
   `primary` and `danger` are the canonical names; `accent` and `destructive`
   are kept as aliases so existing call sites keep working. */
const buttonVariants = cva(
  [
    "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full",
    "text-[10px] font-bold tracking-[0.2em] whitespace-nowrap uppercase",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-[var(--ease)]",
    "hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
    "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border border-ink bg-transparent text-ink hover:bg-white/8",
        outline:
          "border border-ink bg-transparent text-ink hover:bg-white/8",
        solid:
          "border border-ink bg-ink text-bg hover:opacity-85",
        // The one call to action on any given surface.
        primary:
          "border border-transparent bg-[image:var(--accent-gradient)] text-white hover:shadow-[var(--glow-accent)]",
        accent:
          "border border-transparent bg-[image:var(--accent-gradient)] text-white hover:shadow-[var(--glow-accent)]",
        secondary:
          "border border-[color:var(--separator-strong)] bg-secondary text-ink hover:bg-white/10",
        ghost:
          "border border-transparent bg-transparent text-[color:var(--muted)] hover:bg-white/8 hover:text-ink",
        danger:
          "border border-[var(--destructive)] bg-[var(--destructive)] text-white hover:opacity-90",
        destructive:
          "border border-[var(--destructive)] bg-[var(--destructive)] text-white hover:opacity-90",
        link: "text-[var(--accent-2)] underline-offset-4 hover:underline",
      },
      size: {
        default: "px-3.5 py-[7px]",
        sm: "px-2.5 py-[5px] text-[9px]",
        lg: "px-[22px] py-[11px] text-[11px]",
        icon: "size-8",
        "icon-sm": "size-7",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref as React.Ref<HTMLButtonElement>}
        {...props}
      />
    );
  },
);
Button.displayName = "Button"

export { Button, buttonVariants }
