"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Loader2,
  ScanLine,
  Settings,
  TrendingUp,
} from "lucide-react";
import CalorieRing from "@/components/CalorieRing";
import MacroBar from "@/components/MacroBar";
import MealSection from "@/components/MealSection";
import {
  dateKey,
  deleteEntry,
  fetchDay,
  fetchProfile,
  formatDay,
  shiftDate,
} from "@/lib/diary";
import { MEALS, type FoodLogEntry, type Profile } from "@/types";

function Dashboard() {
  const params = useSearchParams();
  const [date, setDate] = useState(() => {
    const d = params.get("date");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : dateKey();
  });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  // "loading" is derived: we're loading until the fetched day matches `date`
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = loadedFor !== date;

  useEffect(() => {
    fetchProfile().then(setProfile);
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

  const goals = {
    calories: profile?.calorie_goal ?? 2000,
    protein: profile?.protein_goal ?? 150,
    carbs: profile?.carbs_goal ?? 250,
    fat: profile?.fat_goal ?? 65,
  };

  return (
    <main className="px-4 pb-28 pt-6">
      {/* header */}
      <header className="rise flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/25">
            <Flame className="size-4.5 text-accent" />
          </div>
          <span className="text-lg font-bold tracking-tight">MacroLog</span>
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

      {/* date navigation */}
      <nav className="rise rise-1 mt-5 flex items-center justify-between rounded-2xl bg-card px-2 py-1.5 ring-1 ring-line">
        <button
          onClick={() => setDate((d) => shiftDate(d, -1))}
          aria-label="Previous day"
          className="rounded-xl p-2 text-mute transition-colors hover:bg-raise hover:text-ink"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-sm font-bold">{formatDay(date)}</span>
        <button
          onClick={() => setDate((d) => shiftDate(d, 1))}
          disabled={date >= dateKey()}
          aria-label="Next day"
          className="rounded-xl p-2 text-mute transition-colors hover:bg-raise hover:text-ink disabled:opacity-30"
        >
          <ChevronRight className="size-5" />
        </button>
      </nav>

      {/* summary card */}
      <section className="rise rise-2 mt-4 rounded-3xl bg-card p-5 ring-1 ring-line">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-mute" />
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <CalorieRing eaten={totals.calories} goal={goals.calories} />
            </div>
            <p className="mt-3 text-center text-xs text-mute">
              <span className="font-semibold text-ink-dim">
                {Math.round(totals.calories).toLocaleString()}
              </span>{" "}
              eaten · goal {goals.calories.toLocaleString()} kcal
            </p>
            <div className="mt-5 grid grid-cols-3 gap-4">
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

      {/* meals */}
      <div className="mt-4 space-y-4">
        {MEALS.map((meal, i) => (
          <div key={meal} className={`rise rise-${Math.min(i + 3, 5)}`}>
            <MealSection
              meal={meal}
              date={date}
              entries={entries.filter((e) => e.meal === meal)}
              onDelete={handleDelete}
            />
          </div>
        ))}
      </div>

      {/* floating scan button */}
      <Link
        href={`/add?date=${date}&tab=scan`}
        aria-label="Scan a barcode"
        className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-bold text-bg shadow-[0_8px_30px_rgba(163,230,53,0.35)] transition active:scale-95"
      >
        <ScanLine className="size-4.5" />
        Scan
      </Link>
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
