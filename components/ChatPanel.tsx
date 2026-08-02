"use client";

import { memo, useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Smile } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ChatMsg, PresenceStatus } from "@/lib/types";
import { Avatar, nickColor } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/panel";

/**
 * The conversation, and only the conversation. Anything that merely *happened*
 * belongs to the activity feed — including track changes, which the hero panel
 * and the player are both already announcing at all times.
 *
 * Consecutive messages from the same person within a few minutes are grouped —
 * the avatar and name appear once, not on every line.
 */

const QUICK_EMOJI = ["😂", "🔥", "❤️", "🎉", "😮", "🙌", "😅", "🎧"];
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function clock(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ChatPanel({
  chat,
  you,
  aiDj,
  onSend,
  onTyping,
  statuses,
  className,
}: {
  chat: ChatMsg[];
  /** nick → presence, so a name in the thread says whether they're still here. */
  statuses?: Record<string, PresenceStatus>;
  /** Your own nickname, so your messages can sit on the other side. */
  you: string;
  aiDj: string | null;
  onSend: (text: string) => void;
  /** Fires as you write, so the room can show you're mid-sentence. */
  onTyping?: () => void;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const send = () => {
    const clean = text.trim();
    if (!clean) return;
    onSend(clean);
    setText("");
    setPickerOpen(false);
  };

  // Everything the room did — joins, queues, skips, track changes — belongs to
  // the activity feed. What's left is people talking.
  const thread = chat.filter((m) => !m.system);
  const hasConversation = thread.length > 0;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <SectionHeader
        icon={<MessageSquare className="size-3.5" />}
        title="Chat"
        trailing={aiDj ? <span className="text-[11px] text-muted">🎧 {aiDj} is in here</span> : undefined}
      />

      <div className="sw-scroll -mr-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
        {!hasConversation && (
          <EmptyState
            icon={<MessageSquare className="size-5" />}
            title="Say something"
            hint={
              aiDj
                ? `Everyone here hears the same second of the song. ${aiDj} is listening too — start a line with /dj to ask for something.`
                : "Everyone here hears the same second of the song — worth a comment."
            }
          />
        )}

        {thread.map((m, i) => {
          const prev = thread[i - 1];
          const grouped =
            prev != null &&
            prev.nick === m.nick &&
            prev.dj === m.dj &&
            m.ts - prev.ts < GROUP_WINDOW_MS;

          return (
            <Bubble
              key={m.id}
              msg={m}
              own={!m.dj && m.nick === you}
              grouped={grouped}
              status={m.nick ? statuses?.[m.nick] : undefined}
            />
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="mt-4 shrink-0">
        {/* The DJ takes requests, and a command nobody can see is a command
            nobody uses. Only shown when there is actually a DJ listening —
            advertising `/dj` on an instance with the DJ switched off just
            teaches people that it does nothing. Tapping it writes the prefix
            so the syntax never has to be remembered, only recognised. */}
        {aiDj && (
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[11px] text-muted">
            <button
              type="button"
              onClick={() => {
                setText((t) => (t.startsWith("/dj ") ? t : `/dj ${t}`));
                inputRef.current?.focus();
              }}
              className="rounded-full border border-[color:color-mix(in_oklab,var(--accent)_45%,transparent)] bg-accent-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--accent-2)] transition-[background-color,transform] duration-200 ease-[var(--ease)] hover:-translate-y-px hover:bg-[color-mix(in_oklab,var(--accent)_26%,transparent)]"
            >
              /dj
            </button>
            <span>
              ask {aiDj} for a track — <span className="text-ink-soft">/dj something moodier</span>
            </span>
          </div>
        )}

        {pickerOpen && (
          <div className="sw-fade-in mb-2 flex flex-wrap gap-1 rounded-md border border-white/8 bg-white/[0.03] p-2">
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setText((t) => t + e);
                  inputRef.current?.focus();
                }}
                className="grid size-8 place-items-center rounded-full text-base transition-transform duration-200 ease-[var(--ease)] hover:scale-125 hover:bg-white/10 active:scale-90"
                aria-label={`Insert ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-full border border-input bg-field pl-4 pr-1.5 py-1.5 transition-[border-color,box-shadow] duration-200 ease-[var(--ease)] focus-within:border-[color:color-mix(in_oklab,var(--accent)_55%,transparent)] focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_18%,transparent)]">
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
            placeholder={aiDj ? "Say something · /dj <request>" : "Say something…"}
            value={text}
            maxLength={500}
            onChange={(e) => {
              setText(e.target.value);
              // The hook deduplicates and decays this, so a whole sentence
              // costs one packet rather than one per keystroke.
              if (e.target.value) onTyping?.();
            }}
            onKeyDown={(e) => e.key === "Enter" && send()}
            aria-label="Chat message"
          />
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-label="Emoji"
            aria-expanded={pickerOpen}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors duration-200 ease-[var(--ease)] hover:bg-white/8 hover:text-ink"
          >
            <Smile className="size-4" />
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!text.trim()}
            aria-label="Send"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-[image:var(--accent-gradient)] text-white transition-[transform,box-shadow,opacity] duration-200 ease-[var(--ease)] hover:scale-105 hover:shadow-[var(--glow-accent)] active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  msg,
  own,
  grouped,
  status,
}: {
  msg: ChatMsg;
  own: boolean;
  grouped: boolean;
  status?: PresenceStatus;
}) {
  const name = msg.nick ?? "guest";
  return (
    <div
      className={cn(
        "sw-pop-in flex items-end gap-2",
        own && "flex-row-reverse",
        grouped ? "mt-0.5" : "mt-3 first:mt-0"
      )}
    >
      {grouped ? (
        <span className="size-6 shrink-0" aria-hidden />
      ) : msg.dj ? (
        <span
          className="grid size-6 shrink-0 place-items-center rounded-full bg-[image:var(--accent-gradient)] text-[11px]"
          title={name}
        >
          🎧
        </span>
      ) : (
        <Avatar name={name} size="sm" status={status} />
      )}

      <div className={cn("flex min-w-0 max-w-[82%] flex-col", own && "items-end")}>
        {!grouped && (
          <div className={cn("mb-1 flex items-baseline gap-2 px-1", own && "flex-row-reverse")}>
            <span
              className="text-[11px] font-semibold"
              style={{ color: msg.dj ? "var(--accent-2)" : own ? "var(--ink)" : nickColor(name) }}
            >
              {own ? "You" : name}
            </span>
            <time className="text-[10px] text-muted" dateTime={new Date(msg.ts).toISOString()}>
              {clock(msg.ts)}
            </time>
          </div>
        )}
        <div className={cn("sw-bubble", own && "sw-bubble-own", msg.dj && "sw-bubble-dj")}>
          {msg.text}
        </div>
      </div>
    </div>
  );
}

/**
 * Memoised: the room re-renders four times a second to advance the progress
 * bar, and none of that touches this panel. Its props are all stable —
 * server state or callbacks the room holds with useCallback.
 */
export default memo(ChatPanel);
