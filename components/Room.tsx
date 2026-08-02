"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { io, type Socket } from "socket.io-client";
import {
  Activity as ActivityIcon,
  BarChart3,
  History as HistoryIcon,
  Keyboard,
  ListMusic,
  MessageSquare,
  Play,
  Radio,
  Search as SearchIcon,
  Users,
} from "lucide-react";
import { EVENTS } from "@/lib/protocol.mjs";
import { cn } from "@/lib/cn";
import type {
  ChatMsg,
  HistoryEntry,
  Mood,
  Participant,
  PresenceStatus,
  ReactionEvent,
  Repeat,
  RoomStats,
  Track,
} from "@/lib/types";
import { useArtworkTheme } from "@/hooks/useArtworkTheme";
import { usePresence } from "@/hooks/usePresence";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useSwipe } from "@/hooks/useSwipe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Panel } from "@/components/ui/panel";
import { Popover } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import BottomPlayer, { ReactionBar } from "@/components/BottomPlayer";
import SearchPanel from "@/components/SearchPanel";
import NowPlaying from "@/components/NowPlaying";
import QueuePanel from "@/components/QueuePanel";
import Recommendations from "@/components/Recommendations";
import ActivityFeed from "@/components/ActivityFeed";
import ChatPanel from "@/components/ChatPanel";
import Reactions, { type IncomingReaction } from "@/components/Reactions";
import MoodBadge from "@/components/MoodBadge";
import Logo from "@/components/Logo";

/**
 * Three surfaces nobody sees on arrival: two are behind a tab, one behind a
 * keypress. Splitting them out keeps the room's first load to what the room
 * actually opens with — and the dialog drags a whole modal library with it.
 */
const HistoryPanel = dynamic(() => import("@/components/HistoryPanel"), {
  loading: () => <PanelLoading label="Loading history…" />,
});
const StatsPanel = dynamic(() => import("@/components/StatsPanel"), {
  loading: () => <PanelLoading label="Counting up…" />,
});
const ShortcutsDialog = dynamic(() => import("@/components/ShortcutsDialog"));
import { PresenceCard } from "@/components/PresenceCard";
import InstallButton, { InstallBanner } from "@/components/InstallButton";
import ShareButton from "@/components/ShareButton";
import MadeWithLove from "@/components/MadeWithLove";

type Tab = "now" | "queue" | "search" | "chat";
const TAB_ORDER: Tab[] = ["now", "queue", "search", "chat"];
/** The centre column carries three lists; they share one segmented control. */
type CenterView = "queue" | "history" | "stats";
/** The right column carries two surfaces; on a phone they take turns. */
type SidePane = "chat" | "activity";

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
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  // The DJ has no socket of its own, so the server reports this on its behalf.
  const [djTyping, setDjTyping] = useState(false);
  const [reactionLog, setReactionLog] = useState<ReactionEvent[]>([]);
  const [lastReaction, setLastReaction] = useState<IncomingReaction | null>(null);
  const [skipVotes, setSkipVotes] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
  const [dl, setDl] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<Tab>("now");
  const [center, setCenter] = useState<CenterView>("queue");
  const [pane, setPane] = useState<SidePane>("chat");
  const [unread, setUnread] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchSignal, setSearchSignal] = useState(0);
  // Local per-listener volume — everyone controls their own, unlike playback.
  const [volume, setVolume] = useState(1);

  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const offsetRef = useRef(0);
  const playbackRef = useRef({ startedAt: 0, pausedPosition: 0, isPlaying: false });

  const isHost = you != null && participants.find((p) => p.id === you)?.isHost === true;
  const serverNow = () => Date.now() + offsetRef.current;

  // The whole room takes its colour from the current cover.
  useArtworkTheme(current?.art || current?.thumbnail);

  const emit = useCallback(
    (ev: string, payload?: unknown) => socketRef.current?.emit(ev, payload),
    []
  );

  // Presence: what this listener is doing, reported and deduplicated.
  const signal = usePresence(
    useCallback((status: PresenceStatus) => emit(EVENTS.PRESENCE_SET, { status }), [emit]),
    joined
  );

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

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    localStorage.setItem("sw_volume", String(v));
  }, []);

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
      setHistory(s.history || []);
      setStats(s.stats ?? null);
      setMood(s.mood ?? null);
      applyPlayback(s);
    });
    socket.on(EVENTS.QUEUE_UPDATE, (s: { queue: Track[] }) => setQueue(s.queue));
    socket.on(EVENTS.PARTICIPANTS_UPDATE, (s: { participants: Participant[] }) =>
      setParticipants(s.participants)
    );
    socket.on(EVENTS.HISTORY_UPDATE, (s: { history: HistoryEntry[] }) => setHistory(s.history));
    socket.on(EVENTS.STATS_UPDATE, (s: { stats: RoomStats }) => setStats(s.stats));
    socket.on(EVENTS.MOOD_UPDATE, (s: { mood: Mood }) => setMood(s.mood));
    socket.on(EVENTS.DJ_TYPING, (s: { typing: boolean }) => setDjTyping(s.typing));
    socket.on(EVENTS.PLAYBACK_UPDATE, (s: any) => applyPlayback(s));
    socket.on(EVENTS.CHAT_NEW, (m: ChatMsg) => {
      setChat((c) => [...c.slice(-199), m]);
      if (!m.system) setUnread((u) => u + 1);
    });
    socket.on(
      EVENTS.REACTION_NEW,
      ({ id, emoji, nick: from }: { id: string; emoji: string; nick?: string }) => {
        // The burst itself is drawn by <Reactions>, seeded from this id so
        // every client in the room renders the identical one.
        setLastReaction({ id, emoji });
        // The feed keeps a short tail of them. Bounded because reactions are
        // the one event that can arrive several times a second.
        setReactionLog((l) => [...l.slice(-39), { id, emoji, nick: from, ts: Date.now() }]);
      }
    );
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
    if (tab === "chat" && pane === "chat") setUnread(0);
  }, [tab, pane, chat]);

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

  const curDl = current ? (dl[current.videoId] ?? null) : null;
  const needVotes = Math.max(1, Math.ceil(participants.length / 2));

  /* ------------------------------------------------------------- actions */

  const addTrack = useCallback(
    (track: Track) => {
      emit(EVENTS.QUEUE_ADD, { track });
      signal("queueing");
    },
    [emit, signal]
  );
  const likeTrack = useCallback((id: string) => emit(EVENTS.QUEUE_LIKE, { id }), [emit]);
  const voteTrack = useCallback(
    (id: string) => {
      emit(EVENTS.QUEUE_VOTE, { id });
      signal("voting");
    },
    [emit, signal]
  );
  const reorderTrack = useCallback(
    (id: string, toIndex: number) => emit(EVENTS.QUEUE_REORDER, { id, toIndex }),
    [emit]
  );
  const removeTrack = useCallback((id: string) => emit(EVENTS.QUEUE_REMOVE, { id }), [emit]);
  const seekTo = useCallback((pos: number) => emit(EVENTS.CONTROL_SEEK, { position: pos }), [emit]);
  const voteSkip = useCallback(() => {
    emit(EVENTS.VOTE_SKIP);
    signal("voting");
  }, [emit, signal]);
  const sendChat = useCallback((text: string) => emit(EVENTS.CHAT_SEND, { text }), [emit]);
  const react = useCallback((emoji: string) => emit(EVENTS.REACTION, { emoji }), [emit]);
  const onTyping = useCallback(() => signal("typing"), [signal]);
  const likeCurrent = useCallback(() => {
    if (current?.id) likeTrack(current.id);
  }, [current?.id, likeTrack]);

  const openSearch = useCallback(() => {
    setTab("search");
    setSearchSignal((n) => n + 1);
    signal("queueing");
  }, [signal]);

  /* ----------------------------------------------------------- shortcuts */

  useShortcuts({
    playpause: () => isHost && emit(EVENTS.CONTROL_PLAYPAUSE),
    next: () => isHost && emit(EVENTS.CONTROL_SKIP),
    prev: () => isHost && seekTo(Math.max(0, position - 10)),
    search: openSearch,
    queue: () => {
      setTab("queue");
      setCenter("queue");
    },
    history: () => {
      setTab("queue");
      setCenter("history");
    },
    chat: () => {
      setTab("chat");
      setPane("chat");
    },
    like: () => current?.id && likeTrack(current.id),
    mute: () => changeVolume(volume === 0 ? 1 : 0),
    help: () => setHelpOpen((v) => !v),
    close: () => setHelpOpen(false),
  });

  const swipe = useSwipe(
    useCallback((dir: 1 | -1) => {
      setTab((t) => {
        const i = TAB_ORDER.indexOf(t);
        return TAB_ORDER[Math.min(TAB_ORDER.length - 1, Math.max(0, i + dir))];
      });
    }, [])
  );

  /* -------------------------------------------------------------- derived */

  // Anything already in the room should never be offered back as a suggestion
  // or as an un-added search result.
  const roomIds = useMemo(() => {
    const ids = new Set(queue.map((t) => t.videoId));
    if (current) ids.add(current.videoId);
    return ids;
  }, [queue, current]);

  const statuses = useMemo(
    () => Object.fromEntries(participants.map((p) => [p.nick, p.status])),
    [participants]
  );

  const currentLikes = current?.likes ?? [];
  const youLikeCurrent = currentLikes.includes(nick.trim());

  if (!joined) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6">
        <Panel className="w-full text-center">
          <div className="mb-2 text-[11px] font-semibold tracking-eyebrow text-[var(--accent-2)] uppercase">
            Syncwave
          </div>
          <h1 className="mb-1 font-display text-2xl font-bold text-ink">{roomName}</h1>
          <p className="mb-6 text-sm text-muted">Pick a name to join the jam.</p>

          {/* A first look at the avatar this name gets — the same one that will
              sit beside every track you queue and every line you type. */}
          <div className="mb-6 grid h-14 place-items-center">
            {nick.trim() ? (
              <Avatar name={nick.trim()} size="lg" className="sw-pop-in size-14 text-lg" />
            ) : (
              <span className="grid size-14 place-items-center rounded-full border border-dashed border-white/15 text-muted">
                <Users className="size-5" />
              </span>
            )}
          </div>

          <Input
            className="mb-3 text-center"
            placeholder="your name"
            value={nick}
            maxLength={24}
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doJoin()}
          />
          <Button variant="primary" className="w-full" onClick={doJoin} disabled={!nick.trim()}>
            {asHost ? "Start the room" : "Join"}
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-[var(--destructive)]">
              {error}
            </p>
          )}
        </Panel>
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

      <Reactions incoming={lastReaction} />
      {helpOpen && <ShortcutsDialog open onOpenChange={setHelpOpen} isHost={isHost} />}

      {/* The one thing a screen reader must not have to go looking for: what
          the room is playing. Polite, so it waits for a gap rather than
          interrupting, and keyed on the track so it fires once per change. */}
      <p aria-live="polite" className="sr-only">
        {current
          ? `Now playing: ${current.title} by ${current.artist}${
              current.addedBy ? `, added by ${current.addedBy}` : ""
            }`
          : "Nothing playing"}
      </p>

      {/* autoplay blocked (mobile) — a tap satisfies the gesture requirement */}
      {needsGesture && current && !preparing && (
        <button
          onClick={resumeAudio}
          className="fixed inset-x-0 bottom-24 z-[60] mx-auto flex w-max items-center gap-2 rounded-full bg-[image:var(--accent-gradient)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--glow-accent)] animate-pulse"
        >
          <Play className="size-4" /> Tap to start audio
        </button>
      )}

      {/* ── top bar: identity, mood, search, presence ── */}
      {/* z-50 so the search dropdown clears the bottom player (z-40) rather
          than sliding behind it on a short window. */}
      <header className="z-50 flex shrink-0 items-center gap-4 border-b border-white/8 px-4 py-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          {/* Same mark as the landing page and the favicon, tinted by the
              artwork like everything else in the room. */}
          <Logo size="md" tint="art" animated={isPlaying} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate font-display text-base font-bold leading-tight text-ink sm:text-lg">
                {roomName}
              </h1>
              <span className="hidden sm:block">
                <MoodBadge mood={mood} />
              </span>
            </div>
            <div className="truncate text-[10px] font-semibold tracking-eyebrow text-[var(--accent-2)] uppercase">
              Syncwave room{aiDj ? ` · DJ ${aiDj}` : ""}
            </div>
          </div>
        </div>

        {/* Search floats over the layout rather than taking a column from it —
            it is used in bursts, and the queue deserves the space the rest of
            the time. */}
        <SearchPanel
          onAdd={addTrack}
          queuedIds={roomIds}
          variant="overlay"
          shortcut
          openSignal={searchSignal}
          className="mx-auto hidden w-full max-w-xl md:block"
        />

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          {/* Room code, spelled out for reading aloud across a room. */}
          <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 lg:flex">
            <span className="text-[10px] font-semibold tracking-eyebrow text-muted uppercase">
              Code
            </span>
            <span className="font-mono text-xs font-bold tracking-[0.18em] text-ink">{code}</span>
          </span>

          {participants.length > 0 && (
            <ParticipantsMenu list={participants} statuses={statuses} />
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHelpOpen(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className="hidden lg:inline-flex"
          >
            <Keyboard className="size-4" />
          </Button>

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
      <main className="relative flex min-h-0 flex-1 flex-col" {...swipe}>
        {/* The bottom padding on phones is the reaction pill's safe area: it
            floats over this region, and without the gap it sits on top of
            whatever the panel ends with. */}
        <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 pb-8 pt-4 md:grid md:h-full md:grid-cols-[minmax(0,1fr)_360px] md:pb-4 xl:grid-cols-[340px_minmax(0,1fr)_380px]">
          {/* ── column 1: the hero ── */}
          <NowPlaying
            current={current}
            isPlaying={isPlaying}
            preparing={preparing}
            cachePct={curDl ?? 0}
            buffering={buffering}
            participants={participants}
            position={position}
            likes={currentLikes}
            liked={youLikeCurrent}
            onLike={likeCurrent}
            canSeek={isHost && !preparing && (current?.duration ?? 0) > 0}
            onSeek={seekTo}
            className={cn(
              tab === "now" ? "flex flex-1" : "hidden",
              "md:hidden xl:flex xl:h-full xl:flex-initial"
            )}
          />

          {/* ── column 2: what the room is about to hear, and what it has ── */}
          <div
            className={cn(
              "min-h-0 flex-1 flex-col gap-4",
              tab === "queue" || tab === "search" ? "flex" : "hidden",
              "md:flex md:h-full md:flex-initial"
            )}
          >
            {/* Phone only: the Add tab. On desktop this lives in the top bar. */}
            <Panel className={cn(tab === "search" ? "flex flex-1" : "hidden", "md:hidden")}>
              <SearchPanel
                onAdd={addTrack}
                queuedIds={roomIds}
                variant="panel"
                openSignal={searchSignal}
                className="min-h-0 flex-1"
              />
            </Panel>

            <Panel
              className={cn(
                tab === "queue" ? "flex" : "hidden",
                "md:flex",
                // An empty queue has nothing to scroll, so it gives its height
                // to the suggestions underneath rather than sitting on it.
                center !== "queue" || queue.length > 0 ? "min-h-0 flex-1" : "shrink-0"
              )}
            >
              <CenterTabs
                view={center}
                setView={setCenter}
                queueCount={queue.length}
                historyCount={history.length}
              />

              {center === "queue" && (
                <QueuePanel
                  queue={queue}
                  dl={dl}
                  isHost={isHost}
                  you={nick.trim()}
                  onRemove={removeTrack}
                  onLike={likeTrack}
                  onVote={voteTrack}
                  onReorder={reorderTrack}
                  onOpenSearch={openSearch}
                  className="min-h-0 flex-1"
                />
              )}
              {center === "history" && (
                <HistoryPanel history={history} onReAdd={addTrack} className="min-h-0 flex-1" />
              )}
              {center === "stats" && <StatsPanel stats={stats} className="min-h-0 flex-1" />}
            </Panel>

            <Panel
              className={cn(
                tab === "queue" ? "flex" : "hidden",
                "md:flex",
                center !== "queue" || queue.length > 0
                  ? "max-h-[42%] shrink-0"
                  : "min-h-0 flex-1"
              )}
            >
              <Recommendations
                seed={current}
                mood={mood}
                excludeIds={roomIds}
                onAdd={addTrack}
                className="min-h-0 flex-1"
              />
            </Panel>
          </div>

          {/* ── column 3: the people ── */}
          <Panel
            className={cn(tab === "chat" ? "flex flex-1" : "hidden", "md:flex md:h-full md:gap-4")}
          >
            {/* Two surfaces, one column. Desktop stacks them; a phone hasn't the
                height for that, so they take turns. */}
            <div className="mb-4 shrink-0 md:hidden">
              <div className="sw-seg">
                <button
                  className="sw-seg-item"
                  data-active={pane === "chat"}
                  onClick={() => setPane("chat")}
                >
                  <MessageSquare className="size-4" /> Chat
                  {unread > 0 && pane !== "chat" && (
                    <span className="grid min-w-4 place-items-center rounded-full bg-[image:var(--accent-gradient)] px-1 text-[10px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </button>
                <button
                  className="sw-seg-item"
                  data-active={pane === "activity"}
                  onClick={() => setPane("activity")}
                >
                  <ActivityIcon className="size-4" /> Activity
                </button>
              </div>
            </div>

            {/* The pane switch is scoped to `max-md` on purpose. Unscoped, the
                `flex-1` that makes the chosen pane fill a phone also applies at
                md, where both panes are on screen at once — and the two of them
                then share the column equally instead of 38/62. */}
            <ActivityFeed
              events={chat}
              reactions={reactionLog}
              className={cn(
                pane === "activity" ? "max-md:flex max-md:flex-1" : "max-md:hidden",
                "md:flex md:min-h-0 md:basis-[38%] md:border-b md:border-white/8 md:pb-4"
              )}
            />
            <ChatPanel
              chat={chat}
              you={nick.trim()}
              aiDj={aiDj}
              djTyping={djTyping}
              onSend={sendChat}
              onTyping={onTyping}
              statuses={statuses}
              className={cn(
                pane === "chat" ? "max-md:flex max-md:flex-1" : "max-md:hidden",
                "md:flex md:min-h-0 md:flex-1"
              )}
            />
          </Panel>
        </div>

        <div className="px-4 pb-2 md:hidden">
          <InstallBanner code={code} />
        </div>
      </main>

      {/* ── phone chrome: reactions and tabs, both within thumb reach ──
          The tab bar used to sit at the top of the content, which on a 6"
          phone is the one part of the screen a thumb cannot get to without
          the hand moving. Everything you press often now lives in the same
          band above the player. */}
      <div className="relative z-40 shrink-0 border-t border-white/8 bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 py-2 backdrop-blur-xl md:hidden">
        <div className="pointer-events-none absolute inset-x-0 bottom-full flex justify-center pb-2">
          <ReactionBar
            onReact={react}
            className="pointer-events-auto rounded-full border border-white/10 bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-1.5 py-1 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          />
        </div>
        <TabBar tab={tab} setTab={setTab} queueCount={queue.length} unread={unread} />
      </div>

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
        likes={currentLikes.length}
        liked={youLikeCurrent}
        onLike={() => current?.id && likeTrack(current.id)}
        onVolume={changeVolume}
        onPlayPause={() => emit(EVENTS.CONTROL_PLAYPAUSE)}
        onSkip={() => emit(EVENTS.CONTROL_SKIP)}
        onSeek={seekTo}
        onVoteSkip={voteSkip}
        onShuffle={() => emit(EVENTS.CONTROL_SHUFFLE)}
        onRepeat={() => emit(EVENTS.CONTROL_REPEAT)}
        onReact={react}
      />
    </div>
  );
}

/** Placeholder for a split-out panel, in the shape of the panel it replaces. */
function PanelLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" aria-busy>
      <span className="sr-only">{label}</span>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2" aria-hidden>
          <Skeleton className="size-10 shrink-0 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-[55%] rounded-full" />
            <Skeleton className="h-2.5 w-[35%] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Segmented control for the centre column: what's next, what happened, totals. */
function CenterTabs({
  view,
  setView,
  queueCount,
  historyCount,
}: {
  view: CenterView;
  setView: (v: CenterView) => void;
  queueCount: number;
  historyCount: number;
}) {
  const item = (id: CenterView, icon: React.ReactNode, label: string, badge?: number) => (
    <button
      key={id}
      role="tab"
      aria-selected={view === id}
      data-active={view === id}
      className="sw-seg-item"
      onClick={() => setView(id)}
    >
      {icon}
      <span className="max-sm:sr-only">{label}</span>
      {badge ? <span className="tabular-nums text-muted">{badge}</span> : null}
    </button>
  );
  return (
    <div className="sw-seg mb-4 shrink-0" role="tablist" aria-label="Queue, history or session">
      {item("queue", <ListMusic className="size-4" />, "Up next", queueCount)}
      {item("history", <HistoryIcon className="size-4" />, "History", historyCount)}
      {item("stats", <BarChart3 className="size-4" />, "Session")}
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
      key={id}
      onClick={() => setTab(id)}
      role="tab"
      aria-selected={tab === id}
      aria-current={tab === id}
      data-active={tab === id}
      className="sw-seg-item"
    >
      {icon}
      {label}
      {badge ? (
        <span
          className="grid min-w-4 place-items-center rounded-full bg-[image:var(--accent-gradient)] px-1 text-[10px] font-bold text-white"
          aria-label={`${badge} ${id === "chat" ? "unread" : "queued"}`}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
  return (
    <div className="sw-seg" role="tablist" aria-label="Room sections">
      {item("now", <Radio className="size-4" />, "Now")}
      {item("queue", <ListMusic className="size-4" />, "Queue", queueCount)}
      {item("search", <SearchIcon className="size-4" />, "Add")}
      {item("chat", <MessageSquare className="size-4" />, "Chat", unread)}
    </div>
  );
}

/**
 * Who is here, as faces. The stack is the affordance and the list behind it is
 * the detail — a room of twelve is unreadable as twelve names in a top bar.
 */
function ParticipantsMenu({
  list,
  statuses,
}: {
  list: Participant[];
  statuses: Record<string, string>;
}) {
  return (
    <Popover
      label={`${list.length} listening`}
      width={264}
      buttonClassName="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 transition-[background-color,border-color] duration-200 ease-[var(--ease)] hover:border-white/20 hover:bg-white/10"
      button={
        <>
          <AvatarStack
            names={list.map((p) => p.nick)}
            statuses={statuses as Record<string, Participant["status"]>}
            max={3}
            size="sm"
          />
          <span className="flex items-center gap-1 text-xs font-semibold text-ink/80">
            <Users className="size-3.5" /> {list.length}
          </span>
        </>
      }
    >
      <div className="sw-label mb-2 px-1 text-[10px]">Listening ({list.length})</div>
      <ul className="sw-scroll max-h-72 space-y-1 overflow-y-auto">
        {list.map((p) => (
          <li key={p.id}>
            <details className="group">
              <summary className="sw-row sw-focus flex cursor-pointer list-none items-center gap-2 p-1.5 text-sm text-ink">
                <Avatar name={p.nick} size="sm" isHost={p.isHost} status={p.status} />
                <span className="truncate">{p.nick}</span>
              </summary>
              <div className="px-1 pb-2 pt-3">
                <PresenceCard p={p} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

