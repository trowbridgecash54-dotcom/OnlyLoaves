"use client";

import { Minus, Plus } from "lucide-react";

/** A quantity selector: minus, number, plus. */
export function Stepper({
  value,
  min = 0,
  max,
  onChange,
  itemName,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  /** Used in button labels for screen readers, e.g. "Classic Sourdough". */
  itemName: string;
}) {
  const button =
    "inline-flex size-11 items-center justify-center text-espresso transition-colors duration-200 hover:bg-wheat disabled:cursor-not-allowed disabled:text-espresso/30 disabled:hover:bg-transparent";

  return (
    <div
      role="group"
      aria-label={`Quantity of ${itemName}`}
      className="inline-flex items-center rounded-[2px] border border-espresso/30 bg-paper"
    >
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`One fewer ${itemName}`}
      >
        <Minus size={16} strokeWidth={1.75} />
      </button>
      <output
        aria-live="polite"
        className="min-w-9 text-center text-base font-medium tabular-nums"
      >
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`One more ${itemName}`}
      >
        <Plus size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
