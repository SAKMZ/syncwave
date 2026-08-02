"use client";

import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("sw-skeleton", className)} aria-hidden />;
}

/**
 * Placeholder shaped like a TrackRow. Shown while a search is in flight so the
 * list reads as loading rather than as "no results" — the two look identical
 * otherwise, and the wrong one of them is discouraging.
 */
export function TrackRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 p-2" aria-hidden>
          <Skeleton className="size-10 shrink-0 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-[55%] rounded-full" />
            <Skeleton className="h-2.5 w-[35%] rounded-full" />
          </div>
          <Skeleton className="h-8 w-16 rounded-full" />
        </li>
      ))}
    </>
  );
}
