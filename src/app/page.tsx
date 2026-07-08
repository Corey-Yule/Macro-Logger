"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Flame,
  GlassWater,
  Loader2,
  Plus,
  Scale,
  ScanLine,
  Search,
  Settings,
  Trash2,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import AddFoodSheet from "@/components/AddFoodSheet";
import CalorieRing from "@/components/CalorieRing";
import ExerciseSheet from "@/components/ExerciseSheet";
import MacroBar from "@/components/MacroBar";
import MealSection, { type CopyState } from "@/components/MealSection";
import WeekStrip from "@/components/WeekStrip";
import {
  copyMealFromDate,
  dateKey,
  deleteEntry,
  deleteExercise,
  entryToFoodItem,
  fetchDay,
  fetchExercise,
  fetchProfile,
  fetchRangeTotals,
  fetchWater,
  fetchWeights,
  formatDay,
  setWater,
  shiftDate,
  type DayTotals,
} from "@/lib/diary";
import { useLocalPref } from "@/lib/useLocalPref";
import {
  MEALS,
  type ExerciseEntry,
  type FoodLogEntry,
  type Meal,
  type Profile,
} from "@/types";

const WATER_GOAL = 8;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Consecutive logged days ending today (or yesterday, so today doesn't break it early). */
function calcStreak(days: DayTotals[]): number {
  const logged = new Map(days.map((d) => [d.date, d.logged]));
  let cursor = dateKey();
  if (!logged.get(cursor)) cursor = shiftDate(cursor, -1);
  let streak = 0;
  while (logged.get(cursor)) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

interface ConfettiPiece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
}

function makeConfetti(): ConfettiPiece[] {
  const colors = ["#a3e635", "#3987e5", "#e66767", "#c98500", "#f4f4f2"];
  return Array.from({ length: 28 }, (_, i) => ({
    left: (i * 3.7 + Math.random() * 3) % 100,
    delay: Math.random() * 0.5,
    duration: 1.3 + Math.random() * 0.9,
    color: colors[i % colors.length],
    size: 5 + Math.random() * 4,
  }));
}

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Link
      href="/trends"
      className="rounded-2xl bg-card p-3 ring-1 ring-line transition hover:ring-accent/40"
    >
      <div className="flex items-center gap-1.5 text-mute">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className="mt-1 text-base font-bold tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-mute">{sub}</p>}
    </Link>
  );
}

function Dashboard() {
  const params = useSearchParams();
  const [date, setDate] = useState(() => {
    const d = params.get("date");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : dateKey();
  });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [history, setHistory] = useState<DayTotals[]>([]);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [weightUnit] = useLocalPref<"lb" | "kg">("weight-unit", "lb");
  const [editing, setEditing] = useState<FoodLogEntry | null>(null);
  const [copyStates, setCopyStates] = useState<Record<Meal, CopyState>>({
    breakfast: "idle",
    lunch: "idle",
    dinner: "idle",
    snacks: "idle",
  });
  const [water, setWaterState] = useState(0);
  const [waterAvailable, setWaterAvailable] = useState(true);
  const [exercise, setExercise] = useState<ExerciseEntry[]>([]);
  const [exerciseAvailable, setExerciseAvailable] = useState(true);
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const loading = loadedFor !== date;

  useEffect(() => {
    fetchProfile().then(setProfile);
    fetchRangeTotals(30).then(setHistory).catch(() => {});
    fetchWeights(90)
      .then((ws) => setLatestWeight(ws.length ? ws[ws.length - 1].weight : null))
      .catch(() => {}); // weights table may not exist yet
  }, []);

  useEffect(() => {
    let stale = false;
    fetchDay(date)
      .then((rows) => {
        if (!stale) setEntries(rows);
      })
      .catch(() => {
        if (!stale) setEntries([]);
      })
      .finally(() => {
        if (!stale) setLoadedFor(date);
      });
    fetchWater(date)
      .then((glasses) => {
        if (!stale) setWaterState(glasses);
      })
      .catch(() => {
        if (!stale) setWaterAvailable(false); // qol.sql not run yet
      });
    fetchExercise(date)
      .then((rows) => {
        if (!stale) setExercise(rows);
      })
      .catch(() => {
        if (!stale) setExerciseAvailable(false); // exercise.sql not run yet
      });
    return () => {
      stale = true;
    };
  }, [date]);

  const totals = useMemo(
    () =>
      entries.reduce(
        (t, e) => ({
          calories: t.calories + e.calories,
          protein: t.protein + e.protein,
          carbs: t.carbs + e.carbs,
          fat: t.fat + e.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [entries]
  );

  const loggedDays = useMemo(() => {
    const set = new Set(history.filter((d) => d.logged).map((d) => d.date));
    if (entries.length > 0) set.add(date);
    return set;
  }, [history, entries.length, date]);

  const streak = useMemo(() => calcStreak(history), [history]);

  const avg7 = useMemo(() => {
    const week = history.slice(-7).filter((d) => d.logged);
    if (week.length === 0) return null;
    return Math.round(week.reduce((s, d) => s + d.calories, 0) / week.length);
  }, [history]);

  const goals = {
    calories: profile?.calorie_goal ?? 2000,
    protein: profile?.protein_goal ?? 150,
    carbs: profile?.carbs_goal ?? 250,
    fat: profile?.fat_goal ?? 65,
  };
  // Exercise gives calories back: budget = goal + burned
  const burned = Math.round(exercise.reduce((s, e) => s + e.calories, 0));
  const budget = goals.calories + burned;
  const over = totals.calories > budget;
  const overBy = Math.round(totals.calories - budget);
  const hitGoal =
    !loading && !over && totals.calories >= budget * 0.95 && totals.calories > 0;

  // Celebrate landing in the goal zone — once per day per session
  useEffect(() => {
    if (!hitGoal) return;
    const key = `celebrated-${date}`;
    if (sessionStorage.getItem(key)) return;
    const start = setTimeout(() => {
      sessionStorage.setItem(key, "1");
      setConfetti(makeConfetti());
      setCelebrate(true);
    }, 350);
    return () => clearTimeout(start);
  }, [hitGoal, date]);

  useEffect(() => {
    if (!celebrate) return;
    const stop = setTimeout(() => setCelebrate(false), 2600);
    return () => clearTimeout(stop);
  }, [celebrate]);

  const refreshDay = useCallback(() => {
    fetchDay(date)
      .then(setEntries)
      .catch(() => {});
  }, [date]);

  const handleDelete = useCallback((id: string) => {
    // Optimistic: remove immediately, restore on failure
    setEntries((prev) => {
      const removed = prev.find((e) => e.id === id);
      deleteEntry(id).catch(() => {
        if (removed) setEntries((cur) => [...cur, removed]);
      });
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const handleCopyYesterday = useCallback(
    async (meal: Meal) => {
      setCopyStates((s) => ({ ...s, [meal]: "busy" }));
      try {
        const rows = await copyMealFromDate(date, meal, shiftDate(date, -1));
        if (rows.length > 0) {
          setEntries((cur) => [...cur, ...rows]);
          setCopyStates((s) => ({ ...s, [meal]: "idle" }));
        } else {
          setCopyStates((s) => ({ ...s, [meal]: "empty" }));
          setTimeout(
            () => setCopyStates((s) => ({ ...s, [meal]: "idle" })),
            2200
          );
        }
      } catch {
        setCopyStates((s) => ({ ...s, [meal]: "idle" }));
      }
    },
    [date]
  );

  function handleWater(index: number) {
    const next = index + 1 === water ? index : index + 1;
    const prev = water;
    setWaterState(next);
    setWater(date, next).catch(() => setWaterState(prev));
  }

  return (
    <main className="px-4 pb-28 pt-6">
      {/* header */}
      <header className="rise flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-mute">{greeting()} 👋</p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight">
            Macro<span className="text-accent">Log</span>
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/trends"
            aria-label="Trends"
            className="rounded-xl p-2.5 text-mute transition-colors hover:bg-card hover:text-ink"
          >
            <TrendingUp className="size-4.5" />
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className="rounded-xl p-2.5 text-mute transition-colors hover:bg-card hover:text-ink"
          >
            <Settings className="size-4.5" />
          </Link>
        </div>
      </header>

      {/* week calendar strip */}
      <div className="rise rise-1 mt-4">
        <WeekStrip selected={date} onSelect={setDate} logged={loggedDays} />
      </div>

      {/* hero summary */}
      <section className="rise rise-2 relative mt-4 overflow-hidden rounded-3xl bg-card p-5 ring-1 ring-line">
        {/* ambient glow behind the ring */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-16 size-44 -translate-x-1/2 rounded-full opacity-15 blur-3xl transition-colors duration-500"
          style={{ background: over ? "var(--color-danger)" : "var(--color-cal)" }}
        />

        {/* goal-hit confetti */}
        {celebrate && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
            {confetti.map((p, i) => (
              <span
                key={i}
                className="confetti absolute rounded-[2px]"
                style={{
                  left: `${p.left}%`,
                  width: p.size,
                  height: p.size * 1.6,
                  background: p.color,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                }}
              />
            ))}
          </div>
        )}

        <div className="relative flex items-center justify-between">
          <span className="text-xs font-semibold text-mute">{formatDay(date)}</span>
          {!loading &&
            totals.calories > 0 &&
            (over ? (
              <span className="flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger ring-1 ring-danger/30">
                <TriangleAlert className="size-3" />
                {overBy.toLocaleString()} kcal over
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent ring-1 ring-accent/30">
                <Check className="size-3" />
                {hitGoal ? "Goal hit!" : "On track"}
              </span>
            ))}
        </div>

        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-mute" />
          </div>
        ) : (
          <>
            <div className="relative mt-2 flex items-center justify-between gap-2">
              <div className="flex-1 text-center">
                <p className="text-lg font-bold tabular-nums leading-tight">
                  {Math.round(totals.calories).toLocaleString()}
                </p>
                <p className="mt-0.5 text-[11px] text-mute">Eaten</p>
              </div>
              <div className={celebrate ? "pulse-once" : undefined}>
                <CalorieRing eaten={totals.calories} goal={budget} />
              </div>
              <div className="flex-1 text-center">
                <p
                  className="text-lg font-bold tabular-nums leading-tight"
                  style={burned > 0 ? { color: "var(--color-burn)" } : undefined}
                >
                  {burned > 0 ? `+${burned.toLocaleString()}` : "—"}
                </p>
                <p className="mt-0.5 text-[11px] text-mute">Burned</p>
              </div>
            </div>
            <p className="relative mt-2 text-center text-[11px] tabular-nums text-mute">
              Budget {budget.toLocaleString()} kcal
              {burned > 0 && (
                <> — {goals.calories.toLocaleString()} goal + {burned.toLocaleString()} exercise</>
              )}
            </p>

            <div className="relative mt-5 grid grid-cols-3 gap-4">
              <MacroBar
                label="Protein"
                eaten={totals.protein}
                goal={goals.protein}
                color="var(--color-protein)"
              />
              <MacroBar
                label="Carbs"
                eaten={totals.carbs}
                goal={goals.carbs}
                color="var(--color-carbs)"
              />
              <MacroBar
                label="Fat"
                eaten={totals.fat}
                goal={goals.fat}
                color="var(--color-fat)"
              />
            </div>
          </>
        )}
      </section>

      {/* quick stats */}
      <div className="rise rise-3 mt-4 grid grid-cols-3 gap-2">
        <StatTile
          icon={<Flame className="size-3.5 text-accent" />}
          label="Streak"
          value={streak > 0 ? `${streak} day${streak === 1 ? "" : "s"}` : "—"}
          sub={streak > 0 ? "keep it going" : "log to start"}
        />
        <StatTile
          icon={<TrendingUp className="size-3.5" style={{ color: "var(--color-carbs)" }} />}
          label="7-day avg"
          value={avg7 !== null ? avg7.toLocaleString() : "—"}
          sub={avg7 !== null ? "kcal / day" : "no data yet"}
        />
        <StatTile
          icon={<Scale className="size-3.5" style={{ color: "var(--color-fat)" }} />}
          label="Weight"
          value={latestWeight !== null ? `${latestWeight} ${weightUnit}` : "—"}
          sub={latestWeight !== null ? "latest entry" : "tap to log"}
        />
      </div>

      {/* water tracker */}
      <section className="rise rise-4 mt-4 rounded-3xl bg-card p-4 ring-1 ring-line">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <GlassWater className="size-4" style={{ color: "var(--color-carbs)" }} />
            Water
          </h2>
          {waterAvailable && (
            <span className="text-xs tabular-nums text-mute">
              <span className="font-bold text-ink">{water}</span> / {WATER_GOAL} glasses
            </span>
          )}
        </div>
        {waterAvailable ? (
          <div className="mt-3 grid grid-cols-8 gap-1.5">
            {Array.from({ length: WATER_GOAL }, (_, i) => (
              <button
                key={i}
                onClick={() => handleWater(i)}
                aria-label={`Set water to ${i + 1 === water ? i : i + 1} glasses`}
                className={`flex aspect-square items-center justify-center rounded-xl ring-1 transition active:scale-90 ${
                  i < water ? "bg-carbs/15 ring-carbs/40" : "bg-raise ring-line"
                }`}
              >
                <GlassWater
                  className="size-4.5 transition-colors"
                  style={{ color: i < water ? "var(--color-carbs)" : "var(--color-mute)" }}
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-mute">
            One-time setup: run <span className="font-mono font-semibold">supabase/qol.sql</span>{" "}
            in the Supabase SQL Editor, then reload.
          </p>
        )}
      </section>

      {/* exercise */}
      <section
        className="rise rise-4 mt-4 overflow-hidden rounded-3xl p-4 ring-1 ring-line"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--color-burn) 10%, var(--color-card)), var(--color-card) 55%)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Flame className="size-4" style={{ color: "var(--color-burn)" }} />
            Exercise
          </h2>
          {burned > 0 && (
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: "var(--color-burn)" }}
            >
              +{burned.toLocaleString()}{" "}
              <span className="text-xs font-normal text-mute">kcal back</span>
            </span>
          )}
        </div>

        {!exerciseAvailable ? (
          <p className="mt-3 text-xs text-mute">
            One-time setup: run{" "}
            <span className="font-mono font-semibold">supabase/exercise.sql</span> in the
            Supabase SQL Editor, then reload.
          </p>
        ) : (
          <>
            {exercise.length > 0 && (
              <ul className="mt-2 divide-y divide-line">
                {exercise.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      {e.duration_min && (
                        <p className="text-xs text-mute">{e.duration_min} min</p>
                      )}
                    </div>
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: "var(--color-burn)" }}
                    >
                      +{Math.round(e.calories)}
                    </span>
                    <button
                      onClick={() => {
                        setExercise((cur) => {
                          const removed = cur.find((x) => x.id === e.id);
                          deleteExercise(e.id).catch(() => {
                            if (removed) setExercise((c) => [...c, removed]);
                          });
                          return cur.filter((x) => x.id !== e.id);
                        });
                      }}
                      aria-label={`Delete ${e.name}`}
                      className="rounded-lg p-2 text-mute transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setExerciseOpen(true)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-xs font-semibold transition-colors"
              style={{
                borderColor: "color-mix(in srgb, var(--color-burn) 40%, transparent)",
                color: "var(--color-burn)",
              }}
            >
              <Flame className="size-3.5" />
              Log exercise
            </button>
          </>
        )}
      </section>

      {/* empty-day call to action */}
      {!loading && entries.length === 0 && (
        <div className="rise rise-5 mt-4 flex items-center gap-3 rounded-3xl bg-card p-4 ring-1 ring-line">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/25">
            <Flame className="size-5 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Nothing logged {formatDay(date).toLowerCase()}</p>
            <p className="text-xs text-mute">Scan a barcode or search to get started.</p>
          </div>
          <Link
            href={`/add?date=${date}`}
            aria-label="Search foods"
            className="flex size-10 items-center justify-center rounded-xl bg-raise text-ink ring-1 ring-line transition active:scale-90"
          >
            <Search className="size-4" />
          </Link>
        </div>
      )}

      {/* meals */}
      <div className="mt-4 space-y-4">
        {MEALS.map((meal, i) => (
          <div key={meal} className={`rise rise-${Math.min(i + 4, 5)}`}>
            <MealSection
              meal={meal}
              date={date}
              entries={entries.filter((e) => e.meal === meal)}
              onDelete={handleDelete}
              onEdit={setEditing}
              onCopyYesterday={handleCopyYesterday}
              copyState={copyStates[meal]}
            />
          </div>
        ))}
      </div>

      {/* floating action bar */}
      <div className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2">
        <Link
          href={`/add?date=${date}`}
          aria-label="Log food"
          className="flex items-center gap-2 rounded-full bg-card px-5 py-3.5 text-sm font-bold text-ink ring-1 ring-line backdrop-blur transition active:scale-95"
        >
          <Plus className="size-4.5 text-accent" />
          Log
        </Link>
        <Link
          href={`/add?date=${date}&tab=scan`}
          aria-label="Scan a barcode"
          className="flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-bold text-bg shadow-[0_8px_30px_rgba(163,230,53,0.35)] transition active:scale-95"
        >
          <ScanLine className="size-4.5" />
          Scan
        </Link>
      </div>

      {/* exercise sheet */}
      {exerciseOpen && (
        <ExerciseSheet
          date={date}
          onClose={() => setExerciseOpen(false)}
          onAdded={(entry) => {
            setExercise((cur) => [...cur, entry]);
            setExerciseOpen(false);
          }}
        />
      )}

      {/* edit-entry sheet */}
      {editing &&
        (() => {
          const { food, allowGrams, initialQty } = entryToFoodItem(editing);
          return (
            <AddFoodSheet
              food={food}
              allowGrams={allowGrams}
              initialQty={initialQty}
              date={date}
              initialMeal={editing.meal}
              editEntryId={editing.id}
              onClose={() => setEditing(null)}
              onAdded={() => {
                setEditing(null);
                refreshDay();
              }}
            />
          );
        })()}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Loader2 className="size-6 animate-spin text-mute" />
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
