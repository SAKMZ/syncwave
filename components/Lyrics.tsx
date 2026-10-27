"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MicVocal } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Track } from "@/lib/types";

type Line = { t: number; text: string };
type LyricsData = { synced: Line[] | null; plain: string | null; instrumental: boolean } | null;

/** Show a line this long before its timestamp, so the eye arrives as the voice does. */
const LEAD_SECONDS = 0.25;
/** How long a manual scroll keeps the view where the reader put it. */
const MANUAL_HOLD_MS = 4000;

/**
 * Lyrics for whatever is playing, highlighted line by line.
 *
 * Every listener's position comes from the room's shared clock, so everyone is
 * on the same line at the same moment. `position` only updates a few times a
 * second, so the active line is computed from an interpolated clock on each
 * animation frame and React only re-renders when the line actually changes.
 */
export default function Lyrics({
  track,
  position,
  playing,
  className,
}: {
  track: Track;
  position: number;
  playing: boolean;
  className?: string;
}) {
  const [data, setData] = useState<LyricsData | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(-1);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const clock = useRef({ pos: position, at: performance.now(), playing });
  const manualUntil = useRef(0);

  useEffect(() => {
    clock.current = { pos: position, at: performance.now(), playing };
  }, [position, playing]);

  // Fetch once per track.
  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setFailed(false);
    setActive(-1);
    const params = new URLSearchParams({
      id: track.videoId,
      title: track.title,
      artist: track.artist,
      duration: String(Math.round(track.duration || 0)),
    });
    fetch(`/api/lyrics?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => !cancelled && setData(d.lyrics ?? null))
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setData(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [track.videoId, track.title, track.artist, track.duration]);

  // Follow the music.
  const lines = data?.synced ?? null;
  useEffect(() => {
    if (!lines) return;
    let raf = 0;
    const step = () => {
      const c = clock.current;
      const now = c.playing ? c.pos + (performance.now() - c.at) / 1000 : c.pos;
      let i = -1;
      // Lines are sorted; a linear scan from the end is plenty for a song.
      for (let k = lines.length - 1; k >= 0; k--) {
        if (lines[k].t <= now + LEAD_SECONDS) {
          i = k;
          break;
        }
      }
      setActive((prev) => (prev === i ? prev : i));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [lines]);

  // Keep the current line in the middle, unless the reader is scrolling.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || active < 0 || Date.now() < manualUntil.current) return;
    const el = box.querySelector<HTMLElement>(`[data-line="${active}"]`);
    if (!el) return;
    const top = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  const holdScroll = () => {
    manualUntil.current = Date.now() + MANUAL_HOLD_MS;
  };

  let body: React.ReactNode;
  if (data === undefined) {
    body = (
      <div className="grid h-full place-items-center">
        <Loader2 className="size-5 animate-spin text-muted" aria-label="Loading lyrics" />
      </div>
    );
  } else if (data?.instrumental) {
    body = <Empty title="Instrumental" hint="Nothing to sing along to on this one." />;
  } else if (lines) {
    body = (
      <ol className="space-y-3 py-[40%]">
        {lines.map((l, i) => (
          <li
            key={`${l.t}-${i}`}
            data-line={i}
            className={cn(
              "font-display text-lg font-semibold leading-snug transition-[color,opacity,transform] duration-300 ease-[var(--ease)] sm:text-xl",
              i === active ? "text-ink" : i < active ? "text-ink/35" : "text-ink/55",
              i === active && "motion-safe:scale-[1.02] origin-left"
            )}
            aria-current={i === active ? "true" : undefined}
          >
            {l.text || <span aria-hidden>♪</span>}
          </li>
        ))}
      </ol>
    );
  } else if (data?.plain) {
    body = (
      <div className="py-4">
        <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-muted">Not time-synced</p>
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{data.plain}</p>
      </div>
    );
  } else {
    body = (
      <Empty
        title={failed ? "Couldn't load lyrics" : "No lyrics for this one yet"}
        hint={
          failed ? (
            "The lyrics service didn't answer. Try again on the next track."
          ) : (
            <>
              Lyrics come from{" "}
              <a href="https://lrclib.net" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-2)] hover:underline">
                LRCLIB
              </a>
              , a free community database. Anyone can add them.
            </>
          )
        }
      />
    );
  }

  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      <div
        ref={scrollRef}
        onWheel={holdScroll}
        onTouchMove={holdScroll}
        className="sw-scroll min-h-0 flex-1 overflow-y-auto px-1 [mask-image:linear-gradient(to_bottom,transparent,#000_14%,#000_86%,transparent)]"
        aria-live="off"
        aria-label={`Lyrics for ${track.title}`}
      >
        {body}
      </div>
      {lines && (
        <a
          href="https://lrclib.net"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 self-center text-[10px] uppercase tracking-[0.14em] text-muted/70 hover:text-muted"
        >
          Lyrics from LRCLIB
        </a>
      )}
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint: React.ReactNode }) {
  return (
    <div className="grid h-full place-items-center px-4 text-center">
      <div>
        <MicVocal className="mx-auto size-6 text-white/20" />
        <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
      </div>
    </div>
  );
}
