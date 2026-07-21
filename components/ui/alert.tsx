'use client';

import type { ReactNode } from 'react';

/* Alert — sharp, bordered inline callout for page-level messages (controller
   errors, notices). `tone` is "error" (vermilion) or "info" (ink). Replaces the
   ad-hoc bordered <div>s that each admin panel used to hand-roll. */
export interface V3AlertProps {
  tone?: 'error' | 'info';
  title?: ReactNode;
  children?: ReactNode;
}

export function V3Alert({ tone = 'info', title, children }: V3AlertProps) {
  const toneClass =
    tone === 'error'
      ? 'border-[#c5302a] text-[#c5302a]'
      : 'border-ink text-ink';
  const titleBorderClass = tone === 'error' ? 'border-[#c5302a]' : 'border-ink';
  return (
    <div role="alert" className={`border ${toneClass}`}>
      {title && (
        <div className={`sw-eyebrow border-b px-3 py-1.5 text-[10px] ${titleBorderClass}`}>
          {title}
        </div>
      )}
      <div className="px-3 py-2 text-[13px] leading-[1.5]">{children}</div>
    </div>
  );
}
