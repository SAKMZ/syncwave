import { cn } from "@/lib/cn";

/**
 * The mark.
 *
 * A tile in the accent gradient with five bars moving inside it — the same
 * equalizer idea that runs everywhere else in the app, drawn once, properly,
 * so it survives being 28px in a header and 64px on a page.
 *
 * The tile is a CSS gradient rather than an SVG one on purpose: an SVG
 * `<linearGradient>` needs an `id`, and two logos on one page would then be two
 * elements claiming the same id. This way it reuses `--accent-gradient` like
 * every other gradient in the app and there is nothing to collide.
 *
 * The bars animate by `scaleY` (a compositor property) rather than by height,
 * so it costs nothing to leave running, and `prefers-reduced-motion` stops them
 * at their resting heights.
 */

const SIZES = {
  sm: "size-8 rounded-sm",
  md: "size-10 rounded-sm",
  lg: "size-16 rounded-md",
} as const;

/**
 * `brand` is the fixed violet→pink ramp — the identity, used anywhere outside a
 * room. `art` follows the current cover, which is what the room tints
 * everything else with; a brand-coloured tile is the one thing that would sit
 * in that header refusing to join in.
 */
const TINTS = {
  brand: "bg-[image:var(--accent-gradient)]",
  art: "bg-[image:linear-gradient(135deg,var(--art-1),var(--art-2))] shadow-[0_6px_20px_-8px_var(--art-1)]",
} as const;

/** Resting heights, tallest in the middle. Drawn on a 32-unit square. */
const BARS = [
  { x: 6, h: 8 },
  { x: 11, h: 14 },
  { x: 16, h: 20 },
  { x: 21, h: 13 },
  { x: 26, h: 9 },
];

export default function Logo({
  size = "sm",
  tint = "brand",
  animated = true,
  className,
}: {
  size?: keyof typeof SIZES;
  tint?: keyof typeof TINTS;
  /** Off for favicons, print, and anywhere it would be the only thing moving. */
  animated?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center", SIZES[size], TINTS[tint], className)}
    >
      <svg viewBox="0 0 32 32" className="size-[70%]" role="presentation">
        <g fill="#fff" className={animated ? "sw-logo-bars" : undefined}>
          {BARS.map(({ x, h }, i) => (
            <rect
              key={x}
              x={x - 1.5}
              y={16 - h / 2}
              width="3"
              height={h}
              rx="1.5"
              style={{ "--sw-logo-delay": `${i * 110}ms` } as React.CSSProperties}
            />
          ))}
        </g>
      </svg>
    </span>
  );
}

/** The mark plus the name, which is what a header and a footer both want. */
export function Wordmark({
  size = "sm",
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Logo size={size} />
      <span className="font-display text-sm font-extrabold tracking-[0.24em]">SYNCWAVE</span>
    </span>
  );
}
