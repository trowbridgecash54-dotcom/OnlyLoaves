/**
 * The OnlyLoafs logo.
 *
 * The "O" is drawn as a round loaf seen from above, with three score
 * marks where a baker's blade would go. Everything else is set in
 * Instrument Serif.
 *
 *   <Wordmark />          horizontal: the full name
 *   <Wordmark compact />  compact: the loaf "O" on its own (matches the favicon)
 *
 * Size it with a text-size class, e.g. className="text-3xl". Color follows
 * the surrounding text; the score marks stay terracotta unless `mono` is set.
 */

type WordmarkProps = {
  compact?: boolean;
  mono?: boolean;
  className?: string;
};

export function LoafO({ mono = false, className = "" }: { mono?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 88 100"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* The letter: a serif O, heavier at the sides than top and bottom. */}
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M44 0C19.7 0 0 22.4 0 50s19.7 50 44 50 44-22.4 44-50S68.3 0 44 0Zm0 5c17.1 0 31 20.15 31 45S61.1 95 44 95 13 74.85 13 50 26.9 5 44 5Z"
      />
      {/* The scoring: three blade marks across the crust. */}
      <g
        fill="none"
        stroke={mono ? "currentColor" : "var(--color-terracotta)"}
        strokeWidth="4"
        strokeLinecap="round"
      >
        <path d="M34 36c6-1.5 12-5 17-10" />
        <path d="M32 55c8-2.5 17-7.5 24-15" />
        <path d="M37 74c6-1.5 12-5 17-10" />
      </g>
    </svg>
  );
}

export function Wordmark({ compact = false, mono = false, className = "" }: WordmarkProps) {
  return (
    <span className={`wordmark ${className}`}>
      <LoafO mono={mono} className="wordmark-o" />
      {compact ? null : <span aria-hidden="true">nlyLoafs</span>}
      <span className="sr-only">OnlyLoafs</span>
    </span>
  );
}
