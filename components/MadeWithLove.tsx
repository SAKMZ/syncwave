/**
 * The reason this exists. Distance is a rubbish excuse not to share a song, so
 * the whole app is really just this sentence, implemented.
 *
 * Shown on the two screens you see before the music starts — the landing page
 * and the join gate — and nowhere inside a room, where the point has been made.
 *
 * The emoji are decorative: screen readers get the word "love" instead of a
 * purple heart, and skip the trailing pair entirely.
 */
export default function MadeWithLove({ className = "" }: { className?: string }) {
  return (
    <p
      className={`max-w-xs text-balance text-xs leading-relaxed text-ink/35 ${className}`.trim()}
    >
      Made with{" "}
      <span className="sw-heartbeat text-accent-2" aria-hidden>
        💜
      </span>
      <span className="sr-only">love</span> so two people can hear the same song at the
      same second &mdash; however many miles are in the way.{" "}
      <span aria-hidden>🎧✨</span>
    </p>
  );
}
