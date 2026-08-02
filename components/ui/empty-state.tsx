"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * No panel is ever allowed to be a blank rectangle. Every empty region says
 * what belongs there and, where there is one, offers the action that fills it.
 */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  compact = false,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  /**
   * Lays the state out as a single hint bar instead of a centred block. Use it
   * where the empty panel should *give up* its height rather than fill it —
   * an empty queue, for instance, exists to hand its space to the suggestions
   * underneath, and a tall centred placeholder would defeat that.
   */
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div className={cn("sw-fade-in flex items-center gap-3 px-1 py-2", className)}>
        <div className="grid size-10 shrink-0 place-items-center rounded-sm border border-white/8 bg-white/[0.03] text-white/25">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{title}</p>
          {hint && <p className="mt-0.5 text-xs leading-snug text-muted">{hint}</p>}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "sw-fade-in flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center",
        className
      )}
    >
      <div className="grid size-12 place-items-center rounded-md border border-white/8 bg-white/[0.03] text-white/25">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        {hint && <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
