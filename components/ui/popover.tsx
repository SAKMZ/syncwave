"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * The app's one anchored-overlay pattern: presence cards, the listener list,
 * the mood explanation. Every one of them was hand-rolling a backdrop, an
 * absolute card and an Escape handler, which is how three overlays end up with
 * three behaviours. This owns all of it — focus return, outside click, Escape,
 * and the `sw-glass-strong` material.
 *
 * On a phone it becomes a bottom sheet instead. Same component, same content,
 * same material: a 240px card anchored to a control in a cramped top bar is
 * unreachable and usually half off-screen, and a sheet is what a thumb expects.
 * It drags down to dismiss.
 */

const SHEET_BREAKPOINT = "(max-width: 767px)";
/** Drag this far down and the sheet closes rather than springing back. */
const DISMISS_PX = 90;

function useIsPhone() {
  const [phone, setPhone] = React.useState(false);
  // Also re-read on demand. A media-query listener is the right mechanism but
  // not a sufficient one: it only fires on a *change*, so anything that alters
  // the viewport without one reaching this component — a rotation handled
  // upstream, a devtools resize, a re-mount — leaves the flag stale, and the
  // overlay then opens in the wrong form. Checking again at open time costs a
  // synchronous match and makes the decision unconditionally correct.
  const check = React.useCallback(() => {
    const match = window.matchMedia(SHEET_BREAKPOINT).matches;
    setPhone(match);
    return match;
  }, []);

  React.useEffect(() => {
    const mq = window.matchMedia(SHEET_BREAKPOINT);
    const apply = () => setPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return [phone, check] as const;
}

export function Popover({
  label,
  button,
  children,
  align = "end",
  width = 240,
  buttonClassName,
  className,
}: {
  /** Accessible name for the trigger. */
  label: string;
  /** Trigger contents. Rendered inside a button this component owns. */
  button: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end" | "center";
  width?: number;
  buttonClassName?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [dragY, setDragY] = React.useState(0);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const dragStart = React.useRef<number | null>(null);
  const [phone, checkPhone] = useIsPhone();

  const close = React.useCallback(() => {
    setOpen(false);
    setDragY(0);
    // Send focus back where it came from, or the keyboard user is stranded at
    // the top of the document.
    triggerRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, close]);

  // Move focus into the panel when it opens, so the content is reachable by
  // keyboard and announced by a screen reader as a dialog.
  React.useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Portals need a DOM to target, and the server has none.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const sheetDrag = phone
    ? {
        onTouchStart: (e: React.TouchEvent) => {
          dragStart.current = e.touches[0].clientY;
        },
        onTouchMove: (e: React.TouchEvent) => {
          if (dragStart.current == null) return;
          // Downward only — dragging up shouldn't stretch the sheet.
          setDragY(Math.max(0, e.touches[0].clientY - dragStart.current));
        },
        onTouchEnd: () => {
          dragStart.current = null;
          setDragY((y) => {
            if (y > DISMISS_PX) close();
            return 0;
          });
        },
      }
    : {};

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={phone}
      aria-label={label}
      tabIndex={-1}
      style={phone ? { transform: dragY ? `translateY(${dragY}px)` : undefined } : { width }}
      className={cn(
        "sw-glass-strong z-50 outline-none",
        phone
          ? "sw-sheet fixed inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-b-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          : [
              "sw-pop-in absolute top-[calc(100%+8px)] max-w-[calc(100vw-2rem)] p-3",
              align === "end" && "right-0",
              align === "start" && "left-0",
              align === "center" && "left-1/2 -translate-x-1/2",
            ],
        className
      )}
      {...sheetDrag}
    >
      {phone && (
        <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-white/20" aria-hidden />
      )}
      {children}
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          checkPhone();
          setOpen((v) => !v);
        }}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn("sw-focus cursor-pointer", buttonClassName)}
      >
        {button}
      </button>

      {/* The backdrop and the sheet are portalled to <body> deliberately.
          `position: fixed` is resolved against the nearest ancestor with a
          transform, filter or backdrop-filter — and the room's top bar, where
          most of these triggers live, has `backdrop-blur`. Left in place, a
          full-screen backdrop covers only the header (so outside clicks stop
          dismissing) and a bottom-anchored sheet pins itself to the bottom of
          the header rather than the screen. */}
      {open &&
        mounted &&
        createPortal(
          <div
            className={cn(
              "fixed inset-0 z-40",
              phone && "sw-fade-in bg-[color:var(--overlay)] backdrop-blur-sm"
            )}
            onClick={close}
            aria-hidden
          />,
          document.body
        )}

      {open && phone && mounted
        ? createPortal(panel, document.body)
        : open
          ? panel
          : null}
    </div>
  );
}
