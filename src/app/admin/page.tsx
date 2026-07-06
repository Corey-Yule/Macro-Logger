"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";
import { fetchProfile } from "@/lib/diary";
import { fetchPendingFoods, reviewFood } from "@/lib/customFoods";
import type { CommunityFood } from "@/types";

function ReviewCard({
  food,
  onDone,
}: {
  food: CommunityFood;
  onDone: (id: string) => void;
}) {
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reviewer aid: what the macros compute to vs the stated calories
  const macroKcal = Math.round(food.protein * 4 + food.carbs * 4 + food.fat * 9);
  const drift = food.calories > 0 ? Math.abs(macroKcal - food.calories) / food.calories : 0;
  const suspicious = drift > 0.15;

  async function decide(decision: "approved" | "rejected") {
    setActing(decision);
    setError(null);
    try {
      await reviewFood(food.id, decision, note);
      onDone(food.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed — try again.");
      setActing(null);
    }
  }

  return (
    <div className="rounded-3xl bg-card p-4 ring-1 ring-line">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-raise ring-1 ring-line">
          <UtensilsCrossed className="size-5 text-mute" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{food.name}</p>
          <p className="mt-0.5 text-xs text-mute">
            {food.brand ? `${food.brand} · ` : ""}
            {food.serving_label}
            {food.serving_grams ? ` (${food.serving_grams} g)` : ""}
            {food.barcode ? ` · ${food.barcode}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-mute">
            Submitted {new Date(food.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* nutrition per serving */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {(
          [
            ["kcal", Math.round(food.calories), null],
            ["Protein", `${Math.round(food.protein)}g`, "var(--color-protein)"],
            ["Carbs", `${Math.round(food.carbs)}g`, "var(--color-carbs)"],
            ["Fat", `${Math.round(food.fat)}g`, "var(--color-fat)"],
          ] as const
        ).map(([label, value, color]) => (
          <div key={label} className="rounded-xl bg-raise px-1 py-2 ring-1 ring-line">
            <p className="text-sm font-bold tabular-nums">{value}</p>
            <p className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-mute">
              {color && <span className="size-1.5 rounded-full" style={{ background: color }} />}
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* consistency check */}
      <p
        className={`mt-2 flex items-center gap-1.5 text-[11px] ${
          suspicious ? "text-fat" : "text-mute"
        }`}
      >
        {suspicious && <TriangleAlert className="size-3.5 shrink-0" />}
        Macros compute to {macroKcal} kcal
        {suspicious
          ? ` — differs from the stated ${Math.round(food.calories)} kcal by more than 15%.`
          : " — consistent with the stated calories."}
      </p>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note to the submitter (shown on rejection)"
        className="mt-3 w-full rounded-xl bg-raise px-3 py-2.5 text-xs outline-none ring-1 ring-line placeholder:text-mute focus:ring-accent/60"
      />

      {error && <p className="mt-2 text-center text-xs text-danger">{error}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => decide("rejected")}
          disabled={acting !== null}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-danger/10 py-2.5 text-xs font-semibold text-danger ring-1 ring-danger/30 transition-colors hover:bg-danger/15 disabled:opacity-50"
        >
          {acting === "rejected" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CircleX className="size-3.5" />
          )}
          Reject
        </button>
        <button
          onClick={() => decide("approved")}
          disabled={acting !== null}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-xs font-bold text-bg transition active:scale-[0.98] disabled:opacity-50"
        >
          {acting === "approved" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CircleCheck className="size-3.5" />
          )}
          Approve
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<CommunityFood[] | null>(null);

  useEffect(() => {
    fetchProfile().then((p) => {
      const admin = p?.role === "admin";
      setIsAdmin(admin);
      if (admin) {
        fetchPendingFoods()
          .then(setPending)
          .catch(() => setPending([]));
      }
    });
  }, []);

  return (
    <main className="px-4 pb-10 pt-6">
      <header className="rise flex items-center gap-3">
        <Link
          href="/settings"
          aria-label="Back to settings"
          className="rounded-xl p-2 text-mute transition-colors hover:bg-card hover:text-ink"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="flex flex-1 items-center gap-2 text-lg font-bold tracking-tight">
          <ShieldCheck className="size-4.5 text-accent" />
          Review queue
        </h1>
        {pending && pending.length > 0 && (
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent ring-1 ring-accent/30">
            {pending.length}
          </span>
        )}
      </header>

      {isAdmin === null ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-mute" />
        </div>
      ) : !isAdmin ? (
        <div className="rise rise-1 mt-6 flex flex-col items-center gap-3 rounded-3xl bg-card p-8 text-center ring-1 ring-line">
          <ShieldCheck className="size-8 text-mute" />
          <p className="text-sm font-semibold">Admin access required</p>
          <p className="text-xs text-mute">
            This page is for reviewing community food submissions.
          </p>
        </div>
      ) : pending === null ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-mute" />
        </div>
      ) : pending.length === 0 ? (
        <div className="rise rise-1 mt-6 flex flex-col items-center gap-3 rounded-3xl bg-card p-8 text-center ring-1 ring-line">
          <CircleCheck className="size-8 text-accent" />
          <p className="text-sm font-semibold">All clear</p>
          <p className="text-xs text-mute">No community foods waiting for review.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {pending.map((food, i) => (
            <div key={food.id} className={`rise rise-${Math.min(i + 1, 5)}`}>
              <ReviewCard
                food={food}
                onDone={(id) =>
                  setPending((cur) => (cur ? cur.filter((f) => f.id !== id) : cur))
                }
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
