"use client";

import { useEffect, useState } from "react";

/** Animate a number from 0 to `target` over `ms` with an ease-out curve. */
function useCountUp(target: number, ms = 700): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / ms, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

interface Props {
  eaten: number;
  goal: number;
}

const SIZE = 180;
const STROKE = 13;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function CalorieRing({ eaten, goal }: Props) {
  const over = eaten > goal;
  const remaining = Math.abs(goal - eaten);
  const progress = goal > 0 ? Math.min(eaten / goal, 1) : 0;

  // Mount at 0, then transition to the real offset so the arc sweeps in
  const [offset, setOffset] = useState(CIRC);
  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      setOffset(CIRC * (1 - progress))
    );
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  const shown = useCountUp(remaining);

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--color-raise)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={over ? "var(--color-danger)" : "var(--color-cal)"}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.25,0.8,0.3,1), stroke 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums tracking-tight">
          {shown.toLocaleString()}
        </span>
        <span className={`mt-0.5 text-xs font-medium ${over ? "text-danger" : "text-mute"}`}>
          {over ? "kcal over goal" : "kcal left"}
        </span>
      </div>
    </div>
  );
}
