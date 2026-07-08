"use client";

import { useState } from "react";
import {
  Bike,
  Dumbbell,
  Flame,
  Footprints,
  Loader2,
  Timer,
  Trophy,
  WavesHorizontal,
  X,
  Zap,
} from "lucide-react";
import { addExercise } from "@/lib/diary";
import type { ExerciseEntry } from "@/types";

const ACTIVITIES = [
  { name: "Running", Icon: Zap },
  { name: "Walking", Icon: Footprints },
  { name: "Cycling", Icon: Bike },
  { name: "Gym", Icon: Dumbbell },
  { name: "Swimming", Icon: WavesHorizontal },
  { name: "Sports", Icon: Trophy },
] as const;

const KCAL_CHIPS = [100, 200, 300, 500];

interface Props {
  date: string;
  onClose: () => void;
  onAdded: (entry: ExerciseEntry) => void;
}

export default function ExerciseSheet({ date, onClose, onAdded }: Props) {
  const [name, setName] = useState("Running");
  const [duration, setDuration] = useState("");
  const [kcal, setKcal] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kcalNum = parseFloat(kcal);
  const valid = name.trim().length > 0 && Number.isFinite(kcalNum) && kcalNum > 0;

  async function handleSave() {
    if (!valid) return;
    setPending(true);
    setError(null);
    try {
      const mins = parseFloat(duration);
      const entry = await addExercise({
        logged_on: date,
        name: name.trim(),
        duration_min: Number.isFinite(mins) && mins > 0 ? mins : null,
        calories: Math.round(kcalNum),
      });
      onAdded(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="sheet-up relative rounded-t-3xl bg-card p-5 pb-8 ring-1 ring-line">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-raise" />

        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-burn/15 ring-1 ring-burn/30">
            <Flame className="size-5" style={{ color: "var(--color-burn)" }} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold">Log exercise</h2>
            <p className="text-xs text-mute">Burned calories add to today&apos;s budget.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-mute hover:bg-raise hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* activity quick-picks */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {ACTIVITIES.map(({ name: activity, Icon }) => {
            const active = name === activity;
            return (
              <button
                key={activity}
                onClick={() => setName(activity)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[11px] font-semibold ring-1 transition ${
                  active
                    ? "bg-burn/15 text-ink ring-burn/50"
                    : "bg-raise text-ink-dim ring-line hover:ring-burn/30"
                }`}
              >
                <Icon
                  className="size-5"
                  style={{ color: active ? "var(--color-burn)" : "var(--color-mute)" }}
                />
                {activity}
              </button>
            );
          })}
        </div>

        {/* custom name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Activity name"
          aria-label="Activity name"
          className="mt-3 w-full rounded-xl bg-raise px-4 py-3 text-sm outline-none ring-1 ring-line placeholder:text-mute focus:ring-burn/50"
        />

        {/* duration + calories */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-xl bg-raise px-3.5 py-3 ring-1 ring-line focus-within:ring-burn/50">
            <Timer className="size-4 shrink-0 text-mute" />
            <input
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="Minutes"
              aria-label="Duration in minutes"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full bg-transparent text-sm tabular-nums outline-none placeholder:text-mute"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-raise px-3.5 py-3 ring-1 ring-line focus-within:ring-burn/50">
            <Flame className="size-4 shrink-0" style={{ color: "var(--color-burn)" }} />
            <input
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="kcal burned"
              aria-label="Calories burned"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              className="w-full bg-transparent text-sm tabular-nums outline-none placeholder:text-mute"
            />
          </label>
        </div>

        {/* kcal quick chips */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {KCAL_CHIPS.map((v) => (
            <button
              key={v}
              onClick={() => setKcal(String(v))}
              className={`rounded-xl py-2 text-xs font-semibold ring-1 transition ${
                kcal === String(v)
                  ? "bg-burn/15 text-ink ring-burn/50"
                  : "bg-raise text-ink-dim ring-line hover:ring-burn/30"
              }`}
            >
              {v} kcal
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-center text-xs text-danger">{error}</p>}

        <button
          onClick={handleSave}
          disabled={pending || !valid}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-bg transition active:scale-[0.98] disabled:opacity-50"
          style={{ background: "var(--color-burn)", color: "#fff" }}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {valid ? `Add ${Math.round(kcalNum)} kcal burn` : "Enter calories burned"}
        </button>
      </div>
    </div>
  );
}
