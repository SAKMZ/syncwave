"use client";

import { Bluetooth, SlidersHorizontal, Speaker } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const DELAY_MAX_MS = 500;

const PRESETS = [
  { ms: 0, label: "Speakers or wired", icon: Speaker },
  { ms: 150, label: "Bluetooth", icon: Bluetooth },
  { ms: 250, label: "Older Bluetooth", icon: Bluetooth },
];

/**
 * Per-device sound settings. Only one so far, and it's the one that matters for
 * "everyone on the same second": Bluetooth headphones and speakers play sound
 * 100–300 ms after the browser sends it. This plays that far ahead so what the
 * listener actually hears lines up with everyone else. Saved on this device
 * only, because it describes this device's speakers, not the room.
 */
export default function SoundSettings({
  open,
  onOpenChange,
  delayMs,
  onDelay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delayMs: number;
  onDelay: (ms: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="sound-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-ink">
            <SlidersHorizontal className="size-4 text-[var(--accent-2)]" /> Sound settings
          </DialogTitle>
          <DialogDescription id="sound-desc" className="text-muted">
            Saved on this device. Nobody else in the room is affected.
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-4">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="sw-delay" className="text-sm font-semibold text-ink">
                Audio delay
              </label>
              <span className="font-mono text-sm tabular-nums text-ink-soft">{delayMs} ms</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Bluetooth headphones and speakers play sound a moment late. If you hear the song a
              beat behind everyone else, raise this until you&rsquo;re together.
            </p>
          </div>

          <input
            id="sw-delay"
            type="range"
            min={0}
            max={DELAY_MAX_MS}
            step={10}
            value={delayMs}
            onChange={(e) => onDelay(Number(e.target.value))}
            className="sw-range w-full"
            aria-valuetext={`${delayMs} milliseconds`}
          />

          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Presets">
            {PRESETS.map(({ ms, label, icon: Icon }) => (
              <button
                key={ms}
                type="button"
                onClick={() => onDelay(ms)}
                aria-pressed={delayMs === ms}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-sm border px-2 py-3 text-xs transition-[background-color,border-color,color] duration-200 ease-[var(--ease)]",
                  delayMs === ms
                    ? "border-[color:color-mix(in_oklab,var(--accent)_60%,transparent)] bg-[color:color-mix(in_oklab,var(--accent)_18%,transparent)] text-ink"
                    : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-ink"
                )}
              >
                <Icon className="size-4" />
                <span className="leading-tight">{label}</span>
                <span className="font-mono text-[10px] opacity-70">{ms} ms</span>
              </button>
            ))}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
