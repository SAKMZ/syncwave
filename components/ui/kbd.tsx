'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

/* Small key-cap badge for rendering shortcut hints. Pure CSS — no
   dependency. Used by the command palette and the shortcuts help dialog. */
export function Kbd({ children, className, ...rest }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center font-mono leading-none select-none',
        'h-5 min-w-5 border border-soft-border bg-transparent px-1.5 text-[11px] text-muted',
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}
