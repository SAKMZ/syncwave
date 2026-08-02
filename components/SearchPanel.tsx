"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock3,
  Disc,
  Loader2,
  Mic2,
  Music,
  Plus,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { AlbumDetail, AlbumResult, ArtistResult, SearchType, Track } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Kbd } from "@/components/ui/kbd";
import { TrackRowSkeleton } from "@/components/ui/skeleton";
import { Cover, RowAction, TrackRow } from "@/components/ui/track-row";

/**
 * Finding music, in two shapes.
 *
 * `overlay` lives in the room's top bar and drops its results over the layout,
 * which is what lets the desktop centre column belong entirely to the queue.
 * `panel` is the same thing rendered inline for the phone's Add tab, where
 * there is no layout to float above. They share every behaviour below so a
 * result row looks and acts the same either way.
 *
 * Songs, albums and artists are three tabs over one endpoint. Albums and
 * artists are not playable in themselves — picking either drills into the
 * songs behind it, which is the only thing that can actually join a queue.
 */

const RECENT_KEY = "sw_recent_searches";
const RECENT_MAX = 6;
const DEBOUNCE_MS = 350;

const TABS: { id: SearchType; label: string; icon: React.ElementType }[] = [
  { id: "songs", label: "Songs", icon: Music },
  { id: "albums", label: "Albums", icon: Disc },
  { id: "artists", label: "Artists", icon: Mic2 },
];

function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((s) => typeof s === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function SearchPanel({
  onAdd,
  queuedIds,
  variant = "panel",
  shortcut = false,
  openSignal = 0,
  className,
}: {
  onAdd: (t: Track) => void;
  /** videoIds already in the room, so a result can say so instead of duplicating. */
  queuedIds: Set<string>;
  variant?: "overlay" | "panel";
  /** Bind ⌘K / Ctrl-K to this instance. Only ever set on one of them. */
  shortcut?: boolean;
  /** Bump to focus the field from elsewhere — the `/` shortcut does this. */
  openSignal?: number;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<SearchType>("songs");
  const [results, setResults] = useState<(Track | AlbumResult | ArtistResult)[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  /** When set, the list shows this album's tracks instead of search results. */
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [cursor, setCursor] = useState(-1);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  // Guards against a slow early request landing after a later, faster one.
  const runId = useRef(0);

  useEffect(() => setRecent(readRecent()), []);

  useEffect(() => {
    if (!openSignal) return;
    setOpen(true);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [openSignal]);

  const remember = useCallback((term: string) => {
    setRecent((prev) => {
      const next = [term, ...prev.filter((t) => t !== term)].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* private mode — recents are a convenience, not state we need */
      }
      return next;
    });
  }, []);

  const run = useCallback(
    async (term: string, type: SearchType, { persist = false } = {}) => {
      const clean = term.trim();
      if (!clean) {
        setResults([]);
        return;
      }
      const id = ++runId.current;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(clean)}&type=${type}`
        );
        const data = await res.json();
        if (runId.current !== id) return;
        setResults(Array.isArray(data.results) ? data.results : []);
        setCursor(-1);
        if (persist) remember(clean);
      } catch {
        if (runId.current === id) setResults([]);
      } finally {
        if (runId.current === id) setLoading(false);
      }
    },
    [remember]
  );

  // Instant results: type and they arrive, no Enter required. Enter still works
  // and is what promotes a term into the recent list — pressing it is the
  // signal that the query was the one you meant.
  useEffect(() => {
    if (album) return;
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = setTimeout(() => run(q, tab), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q, tab, album, run]);

  // Overlay only: close on outside click.
  useEffect(() => {
    if (variant !== "overlay") return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [variant]);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  const add = useCallback(
    (t: Track) => {
      onAdd(t);
      setAdded((a) => ({ ...a, [t.videoId]: true }));
    },
    [onAdd]
  );

  const openAlbum = useCallback(async (a: AlbumResult) => {
    setLoading(true);
    setCursor(-1);
    try {
      const res = await fetch(`/api/album?id=${encodeURIComponent(a.albumId)}`);
      const data = await res.json();
      // Fall back to what the search result already told us, so a partial
      // response still shows a header rather than an error.
      setAlbum(data.album ?? { ...a, tracks: [] });
    } catch {
      setAlbum({ ...a, tracks: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  /** The rows the arrow keys walk, whatever the current tab is showing. */
  const rows = useMemo(() => (album ? album.tracks : results), [album, results]);

  const activate = useCallback(
    (i: number) => {
      const row = rows[i];
      if (!row) return;
      if ("videoId" in row) add(row as Track);
      else if ("albumId" in row) openAlbum(row as AlbumResult);
      else if ("artistId" in row) {
        // An artist isn't playable, so picking one means "show me their songs".
        setQ((row as ArtistResult).name);
        setTab("songs");
        inputRef.current?.focus();
      }
    },
    [rows, add, openAlbum]
  );

  const onFieldKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (cursor >= 0) {
        e.preventDefault();
        activate(cursor);
        return;
      }
      run(q, tab, { persist: true });
      return;
    }
    if (e.key === "Escape") {
      if (album) {
        setAlbum(null);
        return;
      }
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!rows.length) return;
      e.preventDefault();
      setCursor((c) => {
        const next =
          e.key === "ArrowDown"
            ? Math.min(rows.length - 1, c + 1)
            : Math.max(0, (c === -1 ? 0 : c) - 1);
        listRef.current
          ?.querySelectorAll("li[data-row]")
          [next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    }
    if (e.key === "Tab" && !e.shiftKey && !album && rows.length === 0) {
      // Nothing to walk yet — Tab cycles the type instead of leaving the field.
      e.preventDefault();
      setTab((t) => TABS[(TABS.findIndex((x) => x.id === t) + 1) % TABS.length].id);
    }
  };

  const showResults = variant === "panel" || open;
  const isEmptyQuery = q.trim().length < 2;

  const list = (
    <ul
      ref={listRef}
      role="listbox"
      aria-label="Search results"
      className={cn(
        "sw-scroll -mx-1 flex flex-col gap-1 overflow-y-auto px-1",
        variant === "overlay" ? "max-h-[min(60vh,26rem)]" : "min-h-0 flex-1"
      )}
    >
      {loading && rows.length === 0 && <TrackRowSkeleton count={4} />}

      {album && (
        <li className="mb-1 flex items-center gap-3 px-1 py-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setAlbum(null)}
            aria-label="Back to results"
          >
            <ArrowLeft className="size-3.5" />
          </Button>
          <Cover src={album.thumbnail} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{album.title}</div>
            <div className="truncate text-xs text-muted">
              {album.artist}
              {album.year ? ` · ${album.year}` : ""} · {album.tracks.length} tracks
            </div>
          </div>
          {album.tracks.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              className="gap-1"
              onClick={() => album.tracks.forEach(add)}
            >
              <Plus className="size-3.5" /> Add all
            </Button>
          )}
        </li>
      )}

      {!album && isEmptyQuery && recent.length > 0 && (
        <li className="px-1 pb-1 pt-2">
          <div className="sw-label mb-2 text-[10px]">
            <Clock3 className="size-3" /> Recent
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setQ(r);
                  run(r, tab);
                  inputRef.current?.focus();
                }}
                className="max-w-full truncate rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-ink-soft transition-[background-color,border-color,transform] duration-200 ease-[var(--ease)] hover:-translate-y-px hover:border-white/20 hover:bg-white/10"
              >
                {r}
              </button>
            ))}
          </div>
        </li>
      )}

      {!album && isEmptyQuery && recent.length === 0 && (
        <li className="flex flex-1">
          <EmptyState
            icon={<Search className="size-5" />}
            title="Search YouTube Music"
            hint="Songs, albums and artists. Anything you add goes straight into the room's queue."
          />
        </li>
      )}

      {!album && !isEmptyQuery && !loading && results.length === 0 && (
        <li className="flex flex-1">
          <EmptyState
            icon={<Search className="size-5" />}
            title={`Nothing for “${q.trim()}”`}
            hint="Try the artist's name, or a line from the chorus."
          />
        </li>
      )}

      {rows.map((row, i) => {
        const selected = cursor === i;

        if ("videoId" in row) {
          const t = row as Track;
          const inRoom = queuedIds.has(t.videoId) || added[t.videoId];
          return (
            <TrackRow
              key={t.videoId}
              art={t.thumbnail}
              title={t.title}
              artist={t.artist}
              active={selected}
              option
              className="scroll-mt-2"
              actions={
                inRoom ? (
                  <span
                    className="grid size-8 place-items-center rounded-full text-[var(--success)]"
                    title="Already in the room"
                  >
                    <Check className="size-4" />
                  </span>
                ) : (
                  <RowAction label={`Add ${t.title}`} tone="accent" onClick={() => add(t)}>
                    <Plus className="size-4" />
                  </RowAction>
                )
              }
            />
          );
        }

        if ("albumId" in row) {
          const a = row as AlbumResult;
          return (
            <ResultRow
              key={a.albumId}
              selected={selected}
              thumbnail={a.thumbnail}
              title={a.title}
              sub={`${a.artist}${a.year ? ` · ${a.year}` : ""}`}
              badge="Album"
              onClick={() => openAlbum(a)}
            />
          );
        }

        const ar = row as ArtistResult;
        return (
          <ResultRow
            key={ar.artistId}
            selected={selected}
            thumbnail={ar.thumbnail}
            title={ar.name}
            sub="See their songs"
            badge="Artist"
            round
            onClick={() => {
              setQ(ar.name);
              setTab("songs");
              inputRef.current?.focus();
            }}
          />
        );
      })}
    </ul>
  );

  const field = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setAlbum(null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onFieldKey}
        placeholder="Search songs, albums, artists…"
        aria-label="Search YouTube Music"
        role="combobox"
        aria-expanded={showResults}
        aria-controls="sw-search-results"
        aria-autocomplete="list"
        className={cn(
          "w-full rounded-full border border-input bg-field py-2.5 pl-11 text-[13px] text-ink outline-none",
          "transition-[border-color,box-shadow,background-color] duration-200 ease-[var(--ease)]",
          "placeholder:text-muted hover:border-[color:var(--separator-strong)]",
          "focus:border-[color:color-mix(in_oklab,var(--accent)_55%,transparent)]",
          "focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_18%,transparent)]",
          shortcut ? "pr-20" : q ? "pr-11" : "pr-4"
        )}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {loading && <Loader2 className="size-4 animate-spin text-muted" />}
        {q && !loading && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setResults([]);
              setAlbum(null);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="grid size-7 place-items-center rounded-full text-muted transition-colors duration-200 ease-[var(--ease)] hover:bg-white/10 hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )}
        {shortcut && !q && !loading && (
          <Kbd className="pointer-events-none mr-1 hidden rounded-sm lg:inline-flex">⌘K</Kbd>
        )}
      </div>
    </div>
  );

  const tabs = (
    <div className="sw-seg mt-3" role="tablist" aria-label="Result type">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={tab === id}
          data-active={tab === id}
          className="sw-seg-item"
          onClick={() => {
            setTab(id);
            setAlbum(null);
          }}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );

  const body = (
    <div id="sw-search-results">
      {!isEmptyQuery && !album && tabs}
      <div className={cn(variant === "overlay" ? "mt-2" : "mt-4 flex min-h-0 flex-1 flex-col")}>
        {list}
      </div>
    </div>
  );

  if (variant === "overlay") {
    return (
      <div ref={wrapRef} className={cn("relative", className)}>
        {field}
        {showResults && (
          <div className="sw-glass-strong sw-fade-in absolute inset-x-0 top-full z-50 mt-2 p-2">
            {body}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="shrink-0">{field}</div>
      <div className="flex min-h-0 flex-1 flex-col">{body}</div>
    </div>
  );
}

/** An album or artist hit. Same row anatomy as a track, different payload. */
function ResultRow({
  thumbnail,
  title,
  sub,
  badge,
  selected,
  round,
  onClick,
}: {
  thumbnail?: string;
  title: string;
  sub: string;
  badge: string;
  selected: boolean;
  round?: boolean;
  onClick: () => void;
}) {
  return (
    <li
      data-row
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "sw-row sw-rise group flex cursor-pointer items-center gap-3 p-2",
        selected && "sw-row-active"
      )}
    >
      <Cover src={thumbnail} size="sm" className={cn(round && "rounded-full")} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{title}</div>
        <div className="truncate text-xs text-muted">{sub}</div>
      </div>
      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">
        {badge}
      </span>
    </li>
  );
}

/**
 * Memoised: the room re-renders four times a second to advance the progress
 * bar, and none of that touches this panel. Its props are all stable —
 * server state or callbacks the room holds with useCallback.
 */
export default memo(SearchPanel);
