"use client";

import * as React from "react";
import { Disc3, GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";

/**
 * One row of music. The queue, the recommendations, the history and the search
 * results are the same object presented in four places, so they are the same
 * component with different slots filled in — a track added from search should
 * not change shape when it lands in the queue, or when it turns up again in
 * the history an hour later.
 */

/** Cover art with a fallback, at the sizes rows ever use. */
export function Cover({
  src,
  alt = "",
  size = "md",
  className,
  children,
}: {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Overlay content — a play affordance, a caching spinner. */
  children?: React.ReactNode;
}) {
  const box = size === "sm" ? "size-10" : size === "lg" ? "size-14" : "size-12";
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-sm border border-white/8 bg-white/[0.04]",
        box,
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center">
          <Disc3 className="size-5 text-white/20" />
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * A count you can press — likes, votes. Reads as a number first and a control
 * second, which is right: most of the time you are glancing at it, not using it.
 */
export function CountButton({
  icon,
  count,
  active,
  label,
  onClick,
  tone = "accent",
  disabled,
}: {
  icon: React.ReactNode;
  count: number;
  active: boolean;
  label: string;
  onClick?: () => void;
  tone?: "accent" | "pink";
  disabled?: boolean;
}) {
  const activeColor = tone === "pink" ? "var(--accent-3)" : "var(--accent)";
  return (
    <button
      type="button"
      onClick={
        onClick &&
        ((e) => {
          e.stopPropagation();
          onClick();
        })
      }
      disabled={disabled || !onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold tabular-nums",
        "transition-[background-color,border-color,color,transform] duration-200 ease-[var(--ease)]",
        onClick && !disabled && "hover:-translate-y-px active:scale-95",
        active
          ? "text-white"
          : "border-white/10 bg-white/[0.04] text-muted hover:border-white/20 hover:text-ink",
        // A zero that nobody can change is noise; hide it until it means something.
        !count && !onClick && "opacity-0"
      )}
      style={
        active
          ? {
              borderColor: `color-mix(in oklab, ${activeColor} 55%, transparent)`,
              background: `color-mix(in oklab, ${activeColor} 22%, transparent)`,
              color: activeColor,
            }
          : undefined
      }
    >
      {icon}
      {count > 0 && count}
    </button>
  );
}

/** Relative "added 4m ago", compact enough for a metadata line. */
function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function TrackRow({
  art,
  title,
  artist,
  addedBy,
  addedByLabel = "added by",
  addedAt,
  now,
  index,
  active = false,
  muted = false,
  trailing,
  actions,
  dragHandle,
  dragging = false,
  shift = 0,
  exiting = false,
  option,
  onClick,
  className,
}: {
  art?: string;
  title: string;
  artist: string;
  /** Nickname to attribute the row to; renders an avatar plus a caption. */
  addedBy?: string;
  addedByLabel?: string;
  /** When it was queued/played, rendered as a relative time. */
  addedAt?: number;
  /** Shared "now" from the parent, so a hundred rows don't each keep a clock. */
  now?: number;
  /** 1-based position, shown in the queue only. */
  index?: number;
  active?: boolean;
  /** Played, skipped, otherwise past — recedes without disappearing. */
  muted?: boolean;
  /** Persistent status on the right — cache state, duration, counts. */
  trailing?: React.ReactNode;
  /** Revealed on hover and on keyboard focus within the row. */
  actions?: React.ReactNode;
  /** Grip control; rendered at the leading edge when reordering is allowed. */
  dragHandle?: React.ReactNode;
  dragging?: boolean;
  /** Vertical offset while another row is being dragged past this one. */
  shift?: number;
  /** Rendered on its way out — see useListTransition. */
  exiting?: boolean;
  /** Marks the row as a listbox option — search results, where arrows walk. */
  option?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <li
      data-row={option ? "" : undefined}
      role={option ? "option" : undefined}
      aria-selected={option ? active : undefined}
      className={cn(
        "sw-row group flex items-center gap-3 p-2",
        exiting ? "sw-row-exit" : "sw-rise",
        active && "sw-row-active",
        muted && "opacity-60",
        dragging && "sw-row-dragging",
        onClick && "cursor-pointer",
        className
      )}
      style={
        dragging || shift
          ? { transform: `translate3d(0, ${dragging ? 0 : shift}px, 0)` }
          : undefined
      }
      onClick={onClick}
    >
      {dragHandle}

      {index != null && (
        <span className="w-4 shrink-0 text-center font-mono text-[11px] tabular-nums text-muted/70">
          {index}
        </span>
      )}

      <Cover src={art} size="sm" />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink" title={title}>
          {title}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <span className="truncate" title={artist}>
            {artist}
          </span>
          {addedBy && (
            <>
              <span aria-hidden>·</span>
              <Avatar name={addedBy} size="xs" />
              <span className="truncate">
                {addedByLabel} {addedBy}
              </span>
            </>
          )}
          {addedAt != null && now != null && (
            <>
              <span className="hidden sm:inline" aria-hidden>
                ·
              </span>
              <time
                className="hidden shrink-0 sm:inline"
                dateTime={new Date(addedAt).toISOString()}
              >
                {ago(addedAt, now)}
              </time>
            </>
          )}
        </div>
      </div>

      {trailing && <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>}

      {actions && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 ease-[var(--ease)] group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
          {actions}
        </div>
      )}
    </li>
  );
}

/** The grip the host drags. Its own control so it can own the pointer events. */
export function DragHandle(props: React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="button"
      aria-label="Reorder — drag, or use the arrow keys"
      className="sw-focus -ml-1 hidden shrink-0 cursor-grab touch-none rounded-sm p-1 text-muted/50 transition-colors duration-200 ease-[var(--ease)] hover:text-ink active:cursor-grabbing md:block"
      {...props}
    >
      <GripVertical className="size-4" />
    </button>
  );
}

/** Small circular action shown on row hover — add, remove, play. */
export function RowAction({
  label,
  onClick,
  tone = "default",
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "accent" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-full border border-white/10 bg-white/5 text-ink/70",
        "transition-[background-color,color,transform,box-shadow] duration-200 ease-[var(--ease)]",
        "hover:scale-110 active:scale-95",
        tone === "accent" &&
          "hover:border-transparent hover:bg-[image:var(--accent-gradient)] hover:text-white hover:shadow-[var(--glow-accent)]",
        tone === "danger" && "hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]",
        tone === "default" && "hover:bg-white/12 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
