'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  AnimatePresence,
  animate as motionAnimate,
  m,
  useMotionValue,
  useReducedMotion,
} from 'motion/react';
import { useDrag } from '@use-gesture/react';
import { cn } from '@/lib/cn';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  children?: ReactNode;
  container?: HTMLElement | null;
}

// Swipe threshold — distance OR velocity. iOS/Android side-sheets dismiss
// somewhere around here, so it feels native.
const DISMISS_PX = 80;
const DISMISS_VX = 0.4;

/* Sheet — right-side drawer between the top and bottom bars (offset 80px
   each), 460px wide, glassy cream wash over a backdrop-filter blur so the
   center-stage art bleeds through, 1px ink borders.

   Entrance is the existing `sw-drawer-content` CSS keyframe — motion only
   owns the exit and the drag gesture, to avoid double-animating the slide-in.
   AnimatePresence + Radix forceMount lets the exit play before Radix unmounts.

   Swipe-to-dismiss is a mobile gesture: rightward drag past 80 px or 0.4
   viewport-velocity dismisses; below threshold springs back. Disabled in the
   contained (landing-embedded) variant — that drawer lives inside a card and
   shouldn't slide independently. Also disabled when the user has opted into
   prefers-reduced-motion. */
export function Sheet({ open, onOpenChange, title, children, container }: SheetProps) {
  const contained = !!container;
  const pos = contained ? 'absolute' : 'fixed';
  const prefersReducedMotion = useReducedMotion();
  const gestureEnabled = !contained && !prefersReducedMotion;

  const x = useMotionValue(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset the drag offset whenever the drawer opens. The exit animation slides
  // the m.div to x: 100% on close — and because useMotionValue persists across
  // the AnimatePresence mount cycle, that stale offset would otherwise carry
  // into the next open and render the drawer off-screen to the right.
  // useLayoutEffect runs before paint so the user never sees the wrong frame.
  useLayoutEffect(() => {
    if (open) x.set(0);
  }, [open, x]);

  const bind = useDrag(
    ({ first, movement: [mx], velocity: [vx], cancel, last, event }) => {
      if (first) {
        // Cancel if the touch started inside the scroll body AND the body is
        // scrolled below the top — body scroll wins in that case so the user
        // can scroll the drawer content as expected.
        const target = event.target as HTMLElement | null;
        const scrollEl = scrollRef.current;
        if (
          target &&
          scrollEl &&
          scrollEl.contains(target) &&
          target !== scrollEl &&
          scrollEl.scrollTop > 0
        ) {
          cancel();
          return;
        }
      }
      // Drawer slides to the right only — clamp leftward to 0.
      const clampedX = Math.max(0, mx);
      x.set(clampedX);
      if (last) {
        const shouldClose = clampedX > DISMISS_PX || vx > DISMISS_VX;
        if (shouldClose) {
          // Hand off to onOpenChange; AnimatePresence finishes the slide.
          onOpenChange(false);
        } else {
          motionAnimate(x, 0, { type: 'spring', stiffness: 400, damping: 32 });
        }
      }
    },
    {
      axis: 'x',
      enabled: gestureEnabled,
      filterTaps: true,
      pointer: { touch: true },
    },
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount container={container}>
            <Dialog.Overlay asChild forceMount>
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className={cn('sw-drawer-overlay inset-0 z-40 bg-overlay', pos)}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
            >
              <m.div
                // Entrance is owned by the sw-drawer-content CSS keyframe; we
                // only declare the exit so motion controls the slide-out.
                initial={false}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
                style={gestureEnabled ? { x } : undefined}
                // @use-gesture's bind() spreads a DOM `onAnimationStart` that
                // conflicts with motion's animation callback of the same name.
                // The DOM handler is irrelevant here — cast lets the spread
                // through; motion's own handler wins anyway.
                {...((gestureEnabled ? bind() : {}) as Record<string, unknown>)}
                className={cn(
                  'sw-drawer-content z-50 flex touch-pan-y flex-col border-x border-ink text-ink shadow-drawer',
                  'bg-[color-mix(in_oklab,var(--bg)_30%,transparent)]',
                  '[backdrop-filter:blur(28px)_saturate(1.9)_brightness(1.07)]',
                  '[-webkit-backdrop-filter:blur(28px)_saturate(1.9)_brightness(1.07)]',
                  pos,
                  contained
                    ? 'top-16 right-4 bottom-16 w-[min(420px,calc(100%-32px))]'
                    : 'inset-x-0 top-16 bottom-16 w-full sm:top-20 sm:right-24 sm:bottom-20 sm:left-auto sm:w-[460px]',
                  'p-5 outline-none sm:p-7',
                )}
              >
                <div className="mb-5 flex items-baseline justify-between">
                  <Dialog.Title className="sw-eyebrow m-0 text-sm tracking-[0.4em]">
                    {title}
                  </Dialog.Title>
                  <Dialog.Close
                    className="sw-focus cursor-pointer text-xl leading-none"
                    aria-label="Close"
                  >
                    ×
                  </Dialog.Close>
                </div>
                <div ref={scrollRef} className="sw-scroll flex-1 overflow-auto">
                  {children}
                </div>
              </m.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
