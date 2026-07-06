"use client";

import { useEffect, useState } from "react";

interface Props {
  label: string;
  eaten: number; // grams
  goal: number; // grams
  /** CSS color for the fill, e.g. "var(--color-protein)" */
  color: string;
}

export default function MacroBar({ label, eaten, goal, color }: Props) {
  const pct = goal > 0 ? Math.min((eaten / goal) * 100, 100) : 0;
  const over = eaten > goal;

  // Animate from 0 on mount
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-dim">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: color }}
          />
          {label}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raise">
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background: color,
            transition: "width 0.8s cubic-bezier(0.25,0.8,0.3,1)",
          }}
        />
      </div>
      <p className="mt-1.5 text-xs tabular-nums text-mute">
        <span className="font-semibold text-ink">{Math.round(eaten)}</span>
        {" / "}
        {goal} g{over && <span className="text-danger"> · over</span>}
      </p>
    </div>
  );
}
