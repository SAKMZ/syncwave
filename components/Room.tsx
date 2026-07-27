"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import {
  Users,
  MessageSquare,
  ListMusic,
  Check,
  Loader2,
  Clock,
  Play,
  Radio,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { EVENTS } from "@/lib/protocol.mjs";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BottomPlayer from "@/components/BottomPlayer";
import SearchPanel from "@/components/SearchPanel";
import NowPlaying from "@/components/NowPlaying";
import InstallButton, { InstallBanner } from "@/components/InstallButton";
import ShareButton from "@/components/ShareButton";
import MadeWithLove from "@/components/MadeWithLove";

type Status = { state: "cached" | "downloading" | "pending"; percent: number };
type Track = {
  id?: string;
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail?: string;
  /** Larger cover for the now-playing panel. Absent on pre-existing rooms. */
  art?: string;
  addedBy?: string;
  status?: Status;
};
type Participant = { id: string; nick: string; isHost: boolean };
type ChatMsg = { id: string; ts: number; nick?: string; text: string; system?: boolean; dj?: boolean };
type Repeat = "off" | "one" | "all";
type Tab = "now" | "queue" | "search" | "chat";

export default function Room({ code, asHost }: { code: string; asHost: boolean }) {
  const [nick, setNick] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState(`Room ${code}`);
  const [aiDj, setAiDj] = useState<string | null>(null);

  const [you, setYou] = useState<string | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [queue, setQueue] = useState<Track[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [skipVotes, setSkipVotes] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
  const [dl, setDl] = useState<Record<string, number>>({});
  const [floats, setFloats] = useState<
    {
      id: string;
      emoji: string;
      left: number;
      delay: number;
      drift: number;
      scale: number;
      spin: number;
    }[]
  >([]);
  const [tab, setTab] = useState<Tab>("now");
  const [unread, setUnread] = useState(0);
  // Local per-listener volume — everyone controls their own, unlike playback.
  const [volume, setVolume] = useState(1);

  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const offsetRef = useRef(0);
  const playbackRef = useRef({ startedAt: 0, pausedPosition: 0, isPlaying: false });

  const isHost = you != null && participants.find((p) => p.id === you)?.isHost === true;
  const serverNow = () => Date.now() + offsetRef.current;

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("sw_nick") : "";
    if (saved) setNick(saved);
    const v = typeof window !== "undefined" ? localStorage.getItem("sw_volume") : null;
    if (v !== null) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 1) setVolume(n);
    }
  }, []);

  // Apply volume to the element whenever it or the track changes (a new src
  // resets nothing, but the element may be recreated between renders).
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, current?.videoId]);

  const changeVolume = (v: number) => {
    setVolume(v);
    localStorage.setItem("sw_volume", String(v));
  };

  function applyPlayback(s: any) {
    playbackRef.current = {
      startedAt: s.startedAt,
      pausedPosition: s.pausedPosition,
      isPlaying: s.isPlaying,
    };
    setCurrent(s.current);
    setIsPlaying(s.isPlaying);
    setPreparing(Boolean(s.preparing));
    setShuffle(Boolean(s.shuffle));
    if (s.repeat) setRepeat(s.repeat);
    setSkipVotes(s.skipVotes ?? 0);
    if (typeof s.serverNow === "number" && offsetRef.current === 0) {
      offsetRef.current = s.serverNow - Date.now();
    }
  }

  const doJoin = useCallback(() => {
    if (!nick.trim()) return;
    localStorage.setItem("sw_nick", nick.trim());
    const ownerToken =
      asHost && typeof window !== "undefined" ? localStorage.getItem(`sw_owner_${code}`) : null;

    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit(EVENTS.JOIN, { code, nick: nick.trim(), ownerToken }));
    socket.on(EVENTS.ERROR, (e: { message: string }) => setError(e.message));
    socket.on(EVENTS.ROOM_STATE, (s: any) => {
      setYou(s.you);
      setRoomName(s.name || `Room ${code}`);
      setAiDj(s.aiDj ?? null);
      setQueue(s.queue);
      setParticipants(s.participants);
      setChat(s.chat || []);
      applyPlayback(s);
    });
    socket.on(EVENTS.QUEUE_UPDATE, (s: { queue: Track[] }) => setQueue(s.queue));
    socket.on(EVENTS.PARTICIPANTS_UPDATE, (s: { participants: Participant[] }) =>
      setParticipants(s.participants)
    );
    socket.on(EVENTS.PLAYBACK_UPDATE, (s: any) => applyPlayback(s));
    socket.on(EVENTS.CHAT_NEW, (m: ChatMsg) => {
      setChat((c) => [...c.slice(-199), m]);
      if (!m.system) setUnread((u) => u + 1);
    });
    socket.on(EVENTS.REACTION_NEW, ({ id, emoji }: { id: string; emoji: string }) => {
      // One tap should read as a cheer, not a single balloon. The server still
      // sends one event; each client blooms it into a small burst, so the
      // celebration costs nothing extra on the wire and everyone sees one.
      const n = 4 + Math.floor(Math.random() * 3); // 4–6
      const burst = Array.from({ length: n }, (_, i) => ({
        id: `${id}-${i}`,
        emoji,
        left: 8 + Math.random() * 84,
        delay: Math.round(i * 70 + Math.random() * 70),
        drift: Math.round((Math.random() - 0.5) * 90),
        scale: 0.75 + Math.random() * 0.6,
        spin: Math.round((Math.random() - 0.5) * 50),
      }));
      setFloats((cur) => [...cur, ...burst]);
      const ids = new Set(burst.map((b) => b.id));
      // Longest delay plus the animation, with a little slack.
      setTimeout(() => setFloats((cur) => cur.filter((x) => !ids.has(x.id))), 3400);
    });
    socket.on(EVENTS.DOWNLOAD_PROGRESS, ({ videoId, percent }: { videoId: string; percent: number }) =>
      setDl((d) => ({ ...d, [videoId]: percent }))
    );
    socket.on(EVENTS.SYNC_PONG, ({ t0, serverNow: sn }: { t0: number; serverNow: number }) => {
      const rtt = Date.now() - t0;
      offsetRef.current = sn + rtt / 2 - Date.now();
    });

    const ping = () => socket.emit(EVENTS.SYNC_PING, { t0: Date.now() });
    ping();
    const pingId = setInterval(ping, 5000);
    setJoined(true);
    return () => {
      clearInterval(pingId);
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nick, code, asHost]);

  // smooth position ticker for the progress bar
  useEffect(() => {
    const id = setInterval(() => {
      const pb = playbackRef.current;
      setPosition(pb.isPlaying ? (serverNow() - pb.startedAt) / 1000 : pb.pausedPosition);
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);

  // clear the chat badge when the chat tab is open
  useEffect(() => {
    if (tab === "chat") setUnread(0);
  }, [tab, chat]);

  // audio sync loop — only runs once the server says the track is ready.
  const retryRef = useRef(0);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current || preparing) return;
    const wantSrc = `/audio/${current.videoId}`;
    if (!audio.src.endsWith(wantSrc)) {
      retryRef.current = 0;
      audio.src = wantSrc;
      audio.load();
    }
    const tick = () => {
      const pb = playbackRef.current;
      const expected = pb.isPlaying ? (serverNow() - pb.startedAt) / 1000 : pb.pausedPosition;
      if (pb.isPlaying && audio.paused) {
        audio
          .play()
          .then(() => setNeedsGesture(false))
          .catch((err) => {
            if (err?.name === "NotAllowedError") setNeedsGesture(true);
          });
      }
      if (!pb.isPlaying && !audio.paused) audio.pause();
      if (Number.isFinite(expected) && Math.abs(audio.currentTime - expected) > 0.75) {
        audio.currentTime = Math.max(0, expected);
      }
      setBuffering(pb.isPlaying && audio.readyState < 3);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.videoId, isPlaying, preparing]);

  const resumeAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => setNeedsGesture(false)).catch(() => {});
  };

  const emit = (ev: string, payload?: any) => socketRef.current?.emit(ev, payload);
  const onEnded = () => {
    if (isHost && current) emit(EVENTS.TRACK_ENDED, { videoId: current.videoId });
  };
  const onAudioError = () => {
    const audio = audioRef.current;
    if (!audio || !current || retryRef.current >= 6) return;
    retryRef.current += 1;
    setTimeout(() => {
      audio.load();
      if (playbackRef.current.isPlaying) audio.play().catch(() => {});
    }, 2500);
  };

  const curDl = current ? dl[current.videoId] ?? null : null;
  const needVotes = Math.max(1, Math.ceil(participants.length / 2));

  if (!joined) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6">
        <div className="w-full sw-glass p-6 text-center sm:p-8">
          <div className="mb-1 text-[11px] font-semibold tracking-eyebrow text-accent-2 uppercase">
            Syncwave
          </div>
          <h1 className="mb-1 font-display text-2xl font-bold text-ink">{roomName}</h1>
          <p className="mb-6 text-sm text-muted">Pick a name to join the jam.</p>
          <Input
            className="mb-3 text-center"
            placeholder="your name"
            value={nick}
            maxLength={24}
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doJoin()}
          />
          <Button variant="accent" className="w-full" onClick={doJoin} disabled={!nick.trim()}>
            {asHost ? "Start the room" : "Join"}
          </Button>
          {error && <p className="mt-3 text-sm text-[var(--destructive)]">{error}</p>}
        </div>
        <MadeWithLove className="mt-8 text-center" />
      </main>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {/* ambient backdrop that glows with the current album art */}
      <div
        className={`sw-ambient ${current?.thumbnail ? "on" : ""}`}
        style={current?.thumbnail ? { backgroundImage: `url(${current.thumbnail})` } : undefined}
        aria-hidden
      />
      <audio ref={audioRef} onEnded={onEnded} onError={onAudioError} />

      {/* floating emoji reactions */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floats.map((f) => (
          <span
            key={f.id}
            className="sw-float absolute bottom-24 text-4xl"
            style={
              {
                left: `${f.left}%`,
                "--sw-f-delay": `${f.delay}ms`,
                "--sw-f-drift": `${f.drift}px`,
                "--sw-f-scale": f.scale,
                "--sw-f-spin": `${f.spin}deg`,
              } as React.CSSProperties
            }
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {/* autoplay blocked (mobile) — a tap satisfies the gesture requirement */}
      {needsGesture && current && !preparing && (
        <button
          onClick={resumeAudio}
          className="fixed inset-x-0 bottom-24 z-[60] mx-auto flex w-max items-center gap-2 rounded-full bg-gradient-to-br from-[var(--accent)] to-[#6b3ff0] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-6px_var(--accent)] animate-pulse"
        >
          <Play className="size-4" /> Tap to start audio
        </button>
      )}

      {/* ── top nav: room identity + actions (non-interactive info lives here) ── */}
      <header className="z-30 flex shrink-0 items-center justify-between gap-2 border-b border-white/8 px-3 py-2.5 backdrop-blur-xl sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-3)] text-sm font-black text-white">
            ♪
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-base font-bold leading-tight text-ink sm:text-lg">
              {roomName}
            </h1>
            <div className="truncate text-[10px] font-semibold tracking-eyebrow text-accent-2 uppercase">
              Syncwave{aiDj ? ` · DJ ${aiDj}` : ""}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Room code, spelled out for reading aloud across a room. */}
          <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 sm:flex">
            <span className="text-[10px] font-semibold tracking-eyebrow text-muted uppercase">
              Code
            </span>
            <span className="font-mono text-xs font-bold tracking-[0.18em] text-ink">{code}</span>
          </span>
          {/* Redundant on xl, where Now Playing lists these people in full. */}
          <span className="xl:hidden">
            <Participants list={participants} />
          </span>
          {/* The banner below says the same thing with room to explain why, so
              only one of the two is ever on screen: banner on phones, where
              installing actually matters, this button on desktop. */}
          <span className="hidden md:inline-flex">
            <InstallButton />
          </span>
          <ShareButton code={code} />
        </div>
      </header>

      {/* ── body ── */}
      <main className="relative flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-3 pt-3 md:hidden">
          <TabBar tab={tab} setTab={setTab} queueCount={queue.length} unread={unread} />
        </div>
        {/* The extra bottom padding on phones is the reaction pill's safe area:
            it floats over this region, and without the gap it sits on top of
            whatever the panel ends with. */}
        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-3 px-3 pb-14 pt-3 sm:px-4 sm:pt-4 md:grid md:h-full md:grid-cols-[minmax(0,1fr)_340px] md:gap-4 md:pb-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
          {/* now playing — its own mobile tab, a dedicated column on wide screens */}
          <NowPlaying
            current={current}
            isPlaying={isPlaying}
            preparing={preparing}
            cachePct={curDl ?? 0}
            buffering={buffering}
            participants={participants}
            className={cn(
              tab === "now" ? "flex flex-1" : "hidden",
              "md:hidden xl:flex xl:h-full xl:flex-initial"
            )}
          />

          {/* search + queue */}
          <div
            className={cn(
              "min-h-0 flex-1 flex-col gap-3",
              tab === "queue" || tab === "search" ? "flex" : "hidden",
              "md:flex md:h-full md:flex-initial"
            )}
          >
            <SearchPanel
              onAdd={(track) => {
                emit(EVENTS.QUEUE_ADD, { track });
              }}
              className={cn(tab === "search" ? "flex flex-1" : "hidden", "md:flex md:flex-none")}
            />
            <QueuePanel
              queue={queue}
              dl={dl}
              isHost={isHost}
              onRemove={(id) => emit(EVENTS.QUEUE_REMOVE, { id })}
              onOpenSearch={() => setTab("search")}
              className={cn(tab === "queue" ? "flex flex-1" : "hidden", "md:flex md:min-h-0 md:flex-1")}
            />
          </div>

          {/* chat */}
          <ChatPanel
            chat={chat}
            aiDj={aiDj}
            onSend={(text) => emit(EVENTS.CHAT_SEND, { text })}
            className={cn(tab === "chat" ? "flex flex-1" : "hidden", "md:flex md:h-full")}
          />
        </div>

        <div className="px-3 pb-2 md:hidden">
          <InstallBanner code={code} />
        </div>
      </main>

      {/* ── fixed bottom player ── */}
      <BottomPlayer
        current={current}
        isPlaying={isPlaying}
        position={position}
        duration={current?.duration ?? 0}
        isHost={isHost}
        downloadPct={curDl}
        buffering={buffering}
        preparing={preparing}
        shuffle={shuffle}
        repeat={repeat}
        skipVotes={skipVotes}
        needVotes={needVotes}
        volume={volume}
        onVolume={changeVolume}
        onPlayPause={() => emit(EVENTS.CONTROL_PLAYPAUSE)}
        onSkip={() => emit(EVENTS.CONTROL_SKIP)}
        onSeek={(pos) => emit(EVENTS.CONTROL_SEEK, { position: pos })}
        onVoteSkip={() => emit(EVENTS.VOTE_SKIP)}
        onShuffle={() => emit(EVENTS.CONTROL_SHUFFLE)}
        onRepeat={() => emit(EVENTS.CONTROL_REPEAT)}
        onReact={(emoji) => emit(EVENTS.REACTION, { emoji })}
      />
    </div>
  );
}

// Segmented tab control (mobile).
function TabBar({
  tab,
  setTab,
  queueCount,
  unread,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  queueCount: number;
  unread: number;
}) {
  const item = (id: Tab, icon: React.ReactNode, label: string, badge?: number) => (
    <button
      onClick={() => setTab(id)}
      aria-current={tab === id}
      className={cn(
        "relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-colors",
        tab === id ? "bg-white/12 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" : "text-muted hover:text-ink"
      )}
    >
      {icon}
      {label}
      {badge ? (
        <span className="grid min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/8 bg-white/5 p-1">
      {item("now", <Radio className="size-4" />, "Now")}
      {item("queue", <ListMusic className="size-4" />, "Queue", queueCount)}
      {item("search", <SearchIcon className="size-4" />, "Add")}
      {item("chat", <MessageSquare className="size-4" />, "Chat", unread)}
    </div>
  );
}

// Participants count with a click-to-open list.
function Participants({ list }: { list: Participant[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`${list.length} listening`}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-ink/80 transition-colors hover:bg-white/10"
      >
        <Users className="size-3.5" /> {list.length}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-48 rounded-2xl border border-white/10 bg-[var(--popover)] p-2 shadow-xl sw-fade-in">
            <div className="mb-1 px-2 text-[10px] font-semibold tracking-eyebrow text-accent-2 uppercase">
              Listening ({list.length})
            </div>
            <ul className="sw-scroll max-h-56 space-y-0.5 overflow-y-auto">
              {list.map((p) => (
                <li key={p.id} className="truncate rounded-lg px-2 py-1 text-sm text-ink">
                  {p.isHost ? "★ " : ""}
                  {p.nick}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function QueuePanel({
  queue,
  dl,
  isHost,
  onRemove,
  onOpenSearch,
  className,
}: {
  queue: Track[];
  dl: Record<string, number>;
  isHost: boolean;
  onRemove: (id: string) => void;
  onOpenSearch: () => void;
  className?: string;
}) {
  const totalSec = queue.reduce((n, t) => n + (t.duration || 0), 0);
  const mins = Math.round(totalSec / 60);

  return (
    <div className={cn("min-h-0 flex-col sw-glass p-3 sm:p-4", className)}>
      <div className="sw-label mb-3 shrink-0 justify-between">
        <span className="flex items-center gap-2">
          <ListMusic className="size-3.5" /> Up next
        </span>
        {queue.length > 0 && (
          <span className="normal-case tracking-normal">
            {queue.length} {queue.length === 1 ? "track" : "tracks"}
            {mins > 0 ? ` · ${mins} min` : ""}
          </span>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="grid size-12 place-items-center rounded-2xl border border-white/8 bg-white/[0.03]">
            <ListMusic className="size-5 text-white/25" />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">The queue is empty</p>
            <p className="mt-0.5 text-xs text-muted">Anyone in the room can add a track.</p>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenSearch} className="gap-1.5">
            <SearchIcon className="size-3.5" /> Find a song
          </Button>
        </div>
      ) : (
        <ul className="sw-scroll -mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
          {queue.map((t, i) => (
            <li
              key={t.id}
              className="group flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-white/[0.06]"
            >
              <span className="w-4 shrink-0 text-center font-mono text-[11px] tabular-nums text-muted/70">
                {i + 1}
              </span>
              {t.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.thumbnail}
                  alt=""
                  className="size-10 shrink-0 rounded-lg border border-white/8 object-cover"
                />
              ) : (
                <div className="size-10 shrink-0 rounded-lg bg-white/5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{t.title}</div>
                <div className="truncate text-xs text-muted">
                  {t.artist}
                  {t.addedBy ? ` · added by ${t.addedBy}` : ""}
                </div>
              </div>
              <QueueStatus status={t.status} live={dl[t.videoId]} />
              {isHost && (
                <button
                  className="shrink-0 rounded-full p-1 text-muted opacity-0 transition-all hover:bg-white/10 hover:text-[var(--destructive)] focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => t.id && onRemove(t.id)}
                  aria-label={`Remove ${t.title}`}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QueueStatus({ status, live }: { status?: Status; live?: number }) {
  const pct = live ?? status?.percent ?? 0;
  const state = live != null && live < 100 ? "downloading" : status?.state ?? "pending";
  if (state === "cached") return <Check className="size-4 shrink-0 text-[var(--accent-2)]" aria-label="ready" />;
  if (state === "downloading")
    return (
      <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-accent-2">
        <Loader2 className="size-3.5 animate-spin" />
        {pct}%
      </span>
    );
  return <Clock className="size-4 shrink-0 text-muted" aria-label="queued" />;
}

function ChatPanel({
  chat,
  onSend,
  aiDj,
  className,
}: {
  chat: ChatMsg[];
  onSend: (t: string) => void;
  aiDj: string | null;
  className?: string;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);
  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };
  const hasReal = chat.some((m) => !m.system);

  return (
    <div className={cn("min-h-0 flex-col sw-glass p-3 sm:p-4", className)}>
      <div className="sw-label mb-3 shrink-0">
        <MessageSquare className="size-3.5" /> Chat
      </div>

      <div className="sw-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 text-sm">
        {!hasReal && (
          <p className="py-6 text-center text-xs text-muted">
            {aiDj
              ? `Say hi — or ask the DJ for something with /dj`
              : "No messages yet. Say something."}
          </p>
        )}
        {chat.map((m) =>
          m.system ? (
            <p key={m.id} className="py-0.5 text-center text-[11px] text-muted/80">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="leading-snug">
              <span
                className={cn(
                  "font-semibold",
                  m.dj ? "text-[var(--accent)]" : "text-[var(--accent-2)]"
                )}
              >
                {m.dj ? "🎧 " : ""}
                {m.nick}
              </span>
              <span className="text-muted"> · </span>
              <span className="text-ink-soft">{m.text}</span>
            </div>
          )
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex shrink-0 gap-2">
        <Input
          placeholder={aiDj ? "message · /dj <request>" : "say something…"}
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          aria-label="Chat message"
        />
        <Button variant="accent" onClick={send} disabled={!text.trim()} className="px-4">
          Send
        </Button>
      </div>
    </div>
  );
}
