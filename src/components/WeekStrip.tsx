"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dateKey, shiftDate } from "@/lib/diary";

interface Props {
  selected: string;
  onSelect: (date: string) => void;
  /** Days (YYYY-MM-DD) that have at least one diary entry — shown with a dot. */
  logged: Set<string>;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 86_400_000
  );
}

export default function WeekStrip({ selected, onSelect, logged }: Props) {
  const today = dateKey();
  // Rolling 7-day window; offset 0 ends on today. Start on the window
  // containing the selected date (e.g. when arriving via /?date=...).
  const [offset, setOffset] = useState(() =>
    Math.max(0, Math.floor(daysBetween(today, selected) / 7))
  );

  const end = shiftDate(today, -7 * offset);
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(end, i - 6));

  const monthLabel = new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-3xl bg-card p-3 ring-1 ring-line">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold">{monthLabel}</span>
        <div className="flex items-center gap-1">
          {selected !== today && (
            <button
              onClick={() => {
                setOffset(0);
                onSelect(today);
              }}
              className="mr-1 rounded-lg bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent ring-1 ring-accent/30"
            >
              Today
            </button>
          )}
          <button
            onClick={() => setOffset((o) => o + 1)}
            aria-label="Previous week"
            className="rounded-lg p-1.5 text-mute transition-colors hover:bg-raise hover:text-ink"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={offset === 0}
            aria-label="Next week"
            className="rounded-lg p-1.5 text-mute transition-colors hover:bg-raise hover:text-ink disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-7">
        {days.map((d) => {
          const isSelected = d === selected;
          const isToday = d === today;
          const weekday = new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
            weekday: "narrow",
          });
          return (
            <button
              key={d}
              onClick={() => onSelect(d)}
              aria-label={d}
              aria-current={isSelected ? "date" : undefined}
              className="flex flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors hover:bg-raise/60"
            >
              <span className={`text-[10px] font-medium ${isSelected ? "text-accent" : "text-mute"}`}>
                {weekday}
              </span>
              <span
                className={`flex size-8 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-all ${
                  isSelected
                    ? "bg-accent text-bg shadow-[0_0_16px_rgba(163,230,53,0.35)]"
                    : isToday
                      ? "text-ink ring-1 ring-accent/50"
                      : "text-ink-dim"
                }`}
              >
                {parseInt(d.slice(8), 10)}
              </span>
              <span
                className={`size-1 rounded-full ${
                  logged.has(d) && !isSelected ? "bg-cal" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
