"use client";

import type { Mood } from "@/lib/types";
import { Popover } from "@/components/ui/popover";

/**
 * What the room feels like, next to what it's called.
 *
 * The reasoning is one click away on purpose. A badge that says "Party" with
 * no way to ask why is a horoscope; the room inferred this from things that
 * actually happened, so it should be willing to say which ones.
 */
export default function MoodBadge({ mood }: { mood: Mood | null }) {
  if (!mood) return null;

  return (
    <Popover
      label={`Room mood: ${mood.label}`}
      align="start"
      width={220}
      buttonClassName="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 transition-[background-color,border-color,transform] duration-200 ease-[var(--ease)] hover:-translate-y-px hover:border-white/20 hover:bg-white/10"
      button={
        <>
          <span className="text-xs leading-none" aria-hidden>
            {mood.emoji}
          </span>
          <span className="text-[10px] font-semibold tracking-eyebrow text-ink-soft uppercase">
            {mood.label}
          </span>
        </>
      }
    >
      <div className="flex items-start gap-2.5">
        <span className="text-lg leading-none" aria-hidden>
          {mood.emoji}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">{mood.label}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            The room picked this up from {mood.why}. It follows the last ten minutes, so it
            changes as the room does.
          </p>
        </div>
      </div>
    </Popover>
  );
}
