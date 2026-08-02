"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * The room's three columns, the join card, every admin section — all of them
 * are a Panel. Radius, material, padding and internal scrolling live here once
 * so no surface has to re-decide them.
 *
 * A Panel is always a bounded flex column: `min-h-0` is load-bearing, because a
 * flex child defaults to `min-height:auto` and would otherwise render straight
 * through the bottom player instead of scrolling inside itself.
 */
export const Panel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { as?: "div" | "section" | "aside" }
>(({ className, as: Tag = "section", ...props }, ref) => (
  <Tag
    ref={ref as React.Ref<HTMLDivElement>}
    className={cn("sw-panel flex min-h-0 flex-col p-4 sm:p-6", className)}
    {...props}
  />
));
Panel.displayName = "Panel";

/**
 * The uppercase eyebrow at the top of every panel, with an optional count or
 * action on the right. Shrink-0 so a scrolling body never pushes it away.
 */
export function SectionHeader({
  icon,
  title,
  trailing,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("sw-label mb-4 shrink-0 justify-between gap-4", className)}>
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{title}</span>
      </span>
      {trailing != null && (
        <span className="flex shrink-0 items-center gap-2 normal-case tracking-normal">
          {trailing}
        </span>
      )}
    </div>
  );
}
