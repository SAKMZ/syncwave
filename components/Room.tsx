"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { Link2, Users, MessageSquare, ListMusic, Check, Loader2, Clock, Play } from "lucide-react";
import { EVENTS, REACTIONS } from "@/lib/protocol.mjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Player from "@/components/Player";
import SearchPanel from "@/components/SearchPanel";
import InstallButton, { InstallBanner } from "@/components/InstallButton";

type Status = { state: "cached" | "downloading" | "pending"; percent: number };
type Track = {
  id?: string;
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail?: string;
  addedBy?: string;
  status?: Status;
};
type Participant = { id: string; nick: string; isHost: boolean };
type ChatMsg = { id: string; ts: number; nick?: string; text: string; system?: boolean; dj?: boolean };

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
  const [dl, setDl] = useState<Record<string, number>>({});
  const [floats, setFloats] = useState<{ id: string; emoji: string; left: number }[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const offsetRef = useRef(0);
  const playbackRef = useRef({ startedAt: 0, pausedPosition: 0, isPlaying: false });

  const isHost = you != null && participants.find((p) => p.id === you)?.isHost === true;
  const serverNow = () => Date.now() + offsetRef.current;

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("sw_nick") : "";
    if (saved) setNick(saved);
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
    socket.on(EVENTS.CHAT_NEW, (m: ChatMsg) => setChat((c) => [...c.slice(-199), m]));
    socket.on(EVENTS.REACTION_NEW, ({ id, emoji }: { id: string; emoji: string }) => {
      const f = { id, emoji, left: 8 + Math.random() * 84 };
      setFloats((cur) => [...cur, f]);
      setTimeout(() => setFloats((cur) => cur.filter((x) => x.id !== id)), 2600);
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

  // audio sync loop — only runs once the server says the track is ready
  // (not `preparing`), so we never hit /audio before it's cached.
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
            // Mobile browsers block autoplay without a user gesture.
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

  // Tap-to-start when the browser blocked autoplay (counts as a user gesture).
  const resumeAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio
      .play()
      .then(() => setNeedsGesture(false))
      .catch(() => {});
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

  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/r/${code}` : "";
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    navigator.clipboard?.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const curDl = current ? dl[current.videoId] ?? null : null;
  const needVotes = Math.max(1, Math.ceil(participants.length / 2));

  if (!joined) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
        <div className="w-full sw-glass p-6 sm:p-8 text-center">
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
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-4 p-3 sm:p-4 md:grid-cols-[1fr_340px]">
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
            style={{ left: `${f.left}%` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {/* Autoplay was blocked (mobile) — a tap counts as the needed gesture. */}
      {needsGesture && current && !preparing && (
        <button
          onClick={resumeAudio}
          className="fixed inset-x-0 bottom-5 z-[60] mx-auto flex w-max items-center gap-2 rounded-full bg-gradient-to-br from-[var(--accent)] to-[#6b3ff0] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-6px_var(--accent)] animate-pulse"
        >
          <Play className="size-4" /> Tap to start audio
        </button>
      )}

      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-eyebrow text-accent-2 uppercase">
              Syncwave{aiDj ? ` · AI DJ: ${aiDj}` : ""}
            </div>
            <h1 className="truncate font-display text-xl sm:text-2xl font-bold text-ink">
              {roomName}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <InstallButton />
            <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
              {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
              {copied ? "Copied" : "Share link"}
            </Button>
          </div>
        </div>

        <InstallBanner code={code} />

        <Player
          current={current}
          isPlaying={isPlaying}
          position={position}
          duration={current?.duration ?? 0}
          isHost={isHost}
          downloadPct={curDl}
          buffering={buffering}
          preparing={preparing}
          skipVotes={skipVotes}
          needVotes={needVotes}
          onPlayPause={() => emit(EVENTS.CONTROL_PLAYPAUSE)}
          onSkip={() => emit(EVENTS.CONTROL_SKIP)}
          onSeek={(pos) => emit(EVENTS.CONTROL_SEEK, { position: pos })}
          onVoteSkip={() => emit(EVENTS.VOTE_SKIP)}
        />

        {/* reaction bar */}
        <div className="flex flex-wrap items-center gap-2">
          {REACTIONS.map((e: string) => (
            <button
              key={e}
              onClick={() => emit(EVENTS.REACTION, { emoji: e })}
              className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-lg transition-transform hover:scale-110 hover:bg-white/10 active:scale-95"
              aria-label={`React ${e}`}
            >
              {e}
            </button>
          ))}
        </div>

        <SearchPanel onAdd={(track) => emit(EVENTS.QUEUE_ADD, { track })} />

        <div className="sw-glass p-5">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-eyebrow text-accent-2 uppercase">
            <ListMusic className="size-3.5" /> Up Next ({queue.length})
          </div>
          {queue.length === 0 && <p className="text-sm text-muted">Queue is empty.</p>}
          <ul className="flex flex-col gap-2">
            {queue.map((t) => (
              <li key={t.id} className="flex items-center gap-3">
                {t.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.thumbnail} alt="" className="size-10 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{t.title}</div>
                  <div className="truncate text-xs text-muted">
                    {t.artist} · {t.addedBy}
                  </div>
                </div>
                <QueueStatus status={t.status} live={dl[t.videoId]} />
                {isHost && (
                  <button
                    className="text-xs text-muted hover:text-[var(--destructive)]"
                    onClick={() => emit(EVENTS.QUEUE_REMOVE, { id: t.id })}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <aside className="flex flex-col gap-4 md:max-h-[calc(100vh-2rem)]">
        <div className="sw-glass p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-eyebrow text-accent-2 uppercase">
            <Users className="size-3.5" /> Listening ({participants.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <span key={p.id} className="rounded-full bg-field px-3 py-1 text-sm text-ink">
                {p.isHost ? "★ " : ""}
                {p.nick}
              </span>
            ))}
          </div>
        </div>
        <ChatPanel chat={chat} onSend={(text) => emit(EVENTS.CHAT_SEND, { text })} aiDj={aiDj} />
      </aside>
    </main>
  );
}

function QueueStatus({ status, live }: { status?: Status; live?: number }) {
  const pct = live ?? status?.percent ?? 0;
  const state = live != null && live < 100 ? "downloading" : status?.state ?? "pending";
  if (state === "cached")
    return <Check className="size-4 text-[var(--accent-2)]" aria-label="ready" />;
  if (state === "downloading")
    return (
      <span className="flex items-center gap-1 font-mono text-xs text-accent-2">
        <Loader2 className="size-3.5 animate-spin" />
        {pct}%
      </span>
    );
  return <Clock className="size-4 text-muted" aria-label="queued" />;
}

function ChatPanel({
  chat,
  onSend,
  aiDj,
}: {
  chat: ChatMsg[];
  onSend: (t: string) => void;
  aiDj: string | null;
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
  return (
    <div className="flex min-h-[340px] flex-1 flex-col sw-glass p-4 md:min-h-0">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-eyebrow text-accent-2 uppercase">
        <MessageSquare className="size-3.5" /> Chat
      </div>
      <div className="sw-scroll flex-1 space-y-1 overflow-y-auto pr-1 text-sm">
        {chat.map((m) => (
          <div key={m.id} className={m.system ? "text-xs italic text-muted" : ""}>
            {m.system ? (
              m.text
            ) : (
              <>
                <span className={`font-semibold ${m.dj ? "text-[var(--accent)]" : "text-accent-2"}`}>
                  {m.dj ? "🎧 " : ""}
                  {m.nick}:{" "}
                </span>
                <span className="text-ink">{m.text}</span>
              </>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          placeholder={aiDj ? `say something · /dj <request>` : "say something…"}
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <Button variant="accent" onClick={send}>
          Send
        </Button>
      </div>
    </div>
  );
}
