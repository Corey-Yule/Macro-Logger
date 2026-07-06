"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Scale,
  TrendingUp,
} from "lucide-react";
import {
  dateKey,
  fetchProfile,
  fetchRangeTotals,
  fetchWeights,
  formatDay,
  upsertWeight,
  type DayTotals,
  type WeightEntry,
} from "@/lib/diary";
import { useLocalPref } from "@/lib/useLocalPref";

type Range = 7 | 30;

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-raise px-3 py-2.5 ring-1 ring-line">
      <p className="text-[11px] font-medium text-mute">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-mute">{sub}</p>}
    </div>
  );
}

export default function TrendsPage() {
  const [range, setRange] = useState<Range>(7);
  const [days, setDays] = useState<DayTotals[] | null>(null);
  const [goal, setGoal] = useState(2000);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile().then((p) => setGoal(p?.calorie_goal ?? 2000));
  }, []);

  useEffect(() => {
    let stale = false;
    fetchRangeTotals(range).then((d) => {
      if (!stale) {
        setDays(d);
        setSelected(null);
      }
    });
    return () => {
      stale = true;
    };
  }, [range]);

  const stats = useMemo(() => {
    const logged = (days ?? []).filter((d) => d.logged);
    if (logged.length === 0) return null;
    const avg = (f: (d: DayTotals) => number) =>
      Math.round(logged.reduce((s, d) => s + f(d), 0) / logged.length);
    return {
      avgCalories: avg((d) => d.calories),
      avgProtein: avg((d) => d.protein),
      onTarget: logged.filter((d) => d.calories <= goal).length,
      loggedCount: logged.length,
    };
  }, [days, goal]);

  const maxVal = useMemo(
    () => Math.max(goal, ...(days ?? []).map((d) => d.calories)) * 1.08,
    [days, goal]
  );
  const selectedDay = days?.find((d) => d.date === selected) ?? null;

  /* ---- weight ---- */
  const [weights, setWeights] = useState<WeightEntry[] | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [unit, setUnit] = useLocalPref<"lb" | "kg">("weight-unit", "lb");
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightSaved, setWeightSaved] = useState(false);
  const [weightsAvailable, setWeightsAvailable] = useState(true);

  useEffect(() => {
    fetchWeights()
      .then(setWeights)
      .catch(() => setWeightsAvailable(false)); // table not created yet
  }, []);

  async function saveWeight() {
    const v = parseFloat(weightInput);
    if (!Number.isFinite(v) || v <= 0) return;
    setSavingWeight(true);
    setWeightSaved(false);
    try {
      await upsertWeight(dateKey(), v);
      setWeights((prev) => {
        const rest = (prev ?? []).filter((w) => w.measured_on !== dateKey());
        return [...rest, { measured_on: dateKey(), weight: v }].sort((a, b) =>
          a.measured_on.localeCompare(b.measured_on)
        );
      });
      setWeightInput("");
      setWeightSaved(true);
    } catch {
      setWeightsAvailable(false);
    } finally {
      setSavingWeight(false);
    }
  }

  const weightTrend = useMemo(() => {
    if (!weights || weights.length === 0) return null;
    const latest = weights[weights.length - 1];
    const delta = latest.weight - weights[0].weight;
    const min = Math.min(...weights.map((w) => w.weight));
    const max = Math.max(...weights.map((w) => w.weight));
    const span = max - min || 1;
    const points = weights
      .map((w, i) => {
        const x = weights.length === 1 ? 50 : (i / (weights.length - 1)) * 100;
        const y = 30 - ((w.weight - min) / span) * 26;
        return `${x},${y}`;
      })
      .join(" ");
    return { latest, delta, min, max, points };
  }, [weights]);

  return (
    <main className="px-4 pb-10 pt-6">
      <header className="rise flex items-center gap-3">
        <Link
          href="/"
          aria-label="Back to diary"
          className="rounded-xl p-2 text-mute transition-colors hover:bg-card hover:text-ink"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="flex-1 text-lg font-bold tracking-tight">Trends</h1>
        <div className="grid grid-cols-2 rounded-xl bg-card p-1 ring-1 ring-line">
          {([7, 30] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                range === r ? "bg-raise text-ink" : "text-mute hover:text-ink-dim"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </header>

      {!days ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-mute" />
        </div>
      ) : (
        <>
          {/* calories chart */}
          <section className="rise rise-1 mt-5 rounded-3xl bg-card p-5 ring-1 ring-line">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <TrendingUp className="size-4 text-accent" />
              Calories — last {range} days
            </h2>

            <div className="relative mt-8 h-40">
              {/* goal line */}
              <div
                className="absolute left-0 right-0 z-10 border-t border-dashed border-mute/60"
                style={{ bottom: `${(goal / maxVal) * 100}%` }}
              >
                <span className="absolute -top-4 right-0 text-[10px] tabular-nums text-mute">
                  goal {goal.toLocaleString()}
                </span>
              </div>
              {/* bars */}
              <div className="flex h-full items-end gap-[3px]">
                {days.map((d) => {
                  const pct = (d.calories / maxVal) * 100;
                  const isSel = selected === d.date;
                  return (
                    <button
                      key={d.date}
                      onClick={() => setSelected(isSel ? null : d.date)}
                      aria-label={`${formatDay(d.date)}: ${Math.round(d.calories)} kcal`}
                      className="group flex h-full flex-1 items-end"
                    >
                      <div
                        className="w-full rounded-t-[4px] transition-all duration-300"
                        style={{
                          height: d.logged ? `${Math.max(pct, 2)}%` : "3px",
                          background: !d.logged
                            ? "var(--color-raise)"
                            : isSel
                              ? "var(--color-accent)"
                              : "var(--color-cal)",
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* x-axis labels */}
            <div className="mt-1.5 flex gap-[3px]">
              {days.map((d, i) => {
                const show =
                  range === 7 || i === 0 || i === days.length - 1 || i === Math.floor(days.length / 2);
                const text =
                  range === 7
                    ? new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })
                    : new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                return (
                  <span
                    key={d.date}
                    className={`flex-1 text-center text-[10px] text-mute ${show ? "" : "invisible"} ${
                      range === 30 ? "whitespace-nowrap" : ""
                    }`}
                  >
                    {text}
                  </span>
                );
              })}
            </div>

            {/* tapped-day readout */}
            {selectedDay && (
              <div className="fade-in mt-3 flex items-center justify-between rounded-2xl bg-raise px-4 py-3 ring-1 ring-line">
                <div>
                  <p className="text-xs font-bold">{formatDay(selectedDay.date)}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-mute">
                    <span className="font-semibold text-ink-dim">
                      {Math.round(selectedDay.calories).toLocaleString()} kcal
                    </span>
                    {" · "}
                    <span style={{ color: "var(--color-protein)" }}>P {Math.round(selectedDay.protein)}</span>{" "}
                    <span style={{ color: "var(--color-carbs)" }}>C {Math.round(selectedDay.carbs)}</span>{" "}
                    <span style={{ color: "var(--color-fat)" }}>F {Math.round(selectedDay.fat)}</span>
                  </p>
                </div>
                <Link
                  href={`/?date=${selectedDay.date}`}
                  className="flex items-center gap-1 text-xs font-semibold text-accent"
                >
                  Open day <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}

            {/* averages */}
            {stats ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <StatTile
                  label="Avg calories"
                  value={stats.avgCalories.toLocaleString()}
                  sub={`${stats.loggedCount} day${stats.loggedCount === 1 ? "" : "s"} logged`}
                />
                <StatTile label="Avg protein" value={`${stats.avgProtein} g`} />
                <StatTile
                  label="Under goal"
                  value={`${stats.onTarget}/${stats.loggedCount}`}
                  sub="logged days"
                />
              </div>
            ) : (
              <p className="mt-4 text-center text-xs text-mute">
                No days logged in this range yet — start logging to see trends.
              </p>
            )}
          </section>

          {/* weight */}
          <section className="rise rise-2 mt-4 rounded-3xl bg-card p-5 ring-1 ring-line">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Scale className="size-4 text-accent" />
                Weight
              </h2>
              <div className="grid grid-cols-2 rounded-lg bg-raise p-0.5 ring-1 ring-line">
                {(["lb", "kg"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      unit === u ? "bg-card text-ink" : "text-mute"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {!weightsAvailable ? (
              <p className="mt-4 rounded-2xl bg-fat/10 px-4 py-3 text-xs text-fat ring-1 ring-fat/30">
                Weight tracking needs a one-time database step: run{" "}
                <span className="font-mono font-semibold">supabase/weights.sql</span> in the
                Supabase SQL Editor, then reload.
              </p>
            ) : (
              <>
                {weightTrend && (
                  <div className="mt-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tabular-nums">
                        {weightTrend.latest.weight}
                      </span>
                      <span className="text-xs text-mute">{unit}</span>
                      {weights && weights.length > 1 && (
                        <span className="ml-auto text-xs font-semibold tabular-nums text-ink-dim">
                          {weightTrend.delta > 0 ? "+" : ""}
                          {Math.round(weightTrend.delta * 10) / 10} {unit} over{" "}
                          {weights.length} entries
                        </span>
                      )}
                    </div>
                    {weights && weights.length > 1 && (
                      <svg
                        viewBox="0 0 100 32"
                        preserveAspectRatio="none"
                        className="mt-3 h-16 w-full"
                        role="img"
                        aria-label={`Weight from ${weightTrend.min} to ${weightTrend.max} ${unit}`}
                      >
                        <polyline
                          points={weightTrend.points}
                          fill="none"
                          stroke="var(--color-carbs)"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    )}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="1"
                    placeholder={`Today's weight (${unit})`}
                    value={weightInput}
                    onChange={(e) => {
                      setWeightInput(e.target.value);
                      setWeightSaved(false);
                    }}
                    className="w-full rounded-xl bg-raise px-4 py-3 text-sm tabular-nums outline-none ring-1 ring-line placeholder:text-mute focus:ring-accent/60"
                  />
                  <button
                    onClick={saveWeight}
                    disabled={savingWeight || !weightInput}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-5 text-sm font-bold text-bg transition active:scale-95 disabled:opacity-40"
                  >
                    {savingWeight ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : weightSaved ? (
                      <Check className="size-4" />
                    ) : null}
                    {weightSaved ? "Saved" : "Log"}
                  </button>
                </div>
                {weights && weights.length === 0 && (
                  <p className="mt-3 text-center text-xs text-mute">
                    Log your first weight to start the trend line.
                  </p>
                )}
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
