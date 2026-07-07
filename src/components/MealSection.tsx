"use client";

import Link from "next/link";
import {
  CookingPot,
  Cookie,
  CopyPlus,
  Croissant,
  Loader2,
  Plus,
  Salad,
  Trash2,
} from "lucide-react";
import type { FoodLogEntry, Meal } from "@/types";

const MEAL_META: Record<Meal, { label: string; Icon: typeof Croissant; tint: string }> = {
  breakfast: { label: "Breakfast", Icon: Croissant, tint: "#c98500" },
  lunch: { label: "Lunch", Icon: Salad, tint: "#65a30d" },
  dinner: { label: "Dinner", Icon: CookingPot, tint: "#3987e5" },
  snacks: { label: "Snacks", Icon: Cookie, tint: "#e66767" },
};

export type CopyState = "idle" | "busy" | "empty";

interface Props {
  meal: Meal;
  date: string;
  entries: FoodLogEntry[];
  onDelete: (id: string) => void;
  onEdit: (entry: FoodLogEntry) => void;
  onCopyYesterday: (meal: Meal) => void;
  copyState: CopyState;
}

function servingText(e: FoodLogEntry): string {
  if (e.serving_unit === "g") return `${e.serving_qty} g`;
  return `${e.serving_qty} × ${e.serving_unit}`;
}

export default function MealSection({
  meal,
  date,
  entries,
  onDelete,
  onEdit,
  onCopyYesterday,
  copyState,
}: Props) {
  const { label, Icon, tint } = MEAL_META[meal];
  const total = Math.round(entries.reduce((s, e) => s + e.calories, 0));

  return (
    <section className="rounded-2xl bg-card ring-1 ring-line">
      <header className="flex items-center gap-3 px-4 pt-4">
        <div
          className="flex size-9 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${tint} 14%, transparent)` }}
        >
          <Icon className="size-4.5" style={{ color: tint }} />
        </div>
        <h2 className="text-sm font-bold">{label}</h2>
        <button
          onClick={() => onCopyYesterday(meal)}
          disabled={copyState !== "idle"}
          aria-label={`Copy yesterday's ${label.toLowerCase()}`}
          title="Copy yesterday"
          className="flex items-center gap-1 rounded-lg p-1.5 text-mute transition-colors hover:bg-raise hover:text-accent disabled:opacity-60"
        >
          {copyState === "busy" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CopyPlus className="size-4" />
          )}
          {copyState === "empty" && (
            <span className="text-[10px] font-medium">nothing yesterday</span>
          )}
        </button>
        <span className="flex-1" />
        {total > 0 && (
          <span className="text-sm font-semibold tabular-nums text-ink-dim">
            {total} <span className="text-xs font-normal text-mute">kcal</span>
          </span>
        )}
      </header>

      {entries.length > 0 ? (
        <ul className="mt-2 divide-y divide-line px-4">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-1 py-1">
              <button
                onClick={() => onEdit(e)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2 text-left transition-colors hover:bg-raise/50"
                aria-label={`Edit ${e.food_name}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.food_name}</p>
                  <p className="mt-0.5 truncate text-xs text-mute">
                    {e.brand ? `${e.brand} · ` : ""}
                    {servingText(e)}
                    {" · "}
                    <span style={{ color: "var(--color-protein)" }}>P {Math.round(e.protein)}</span>{" "}
                    <span style={{ color: "var(--color-carbs)" }}>C {Math.round(e.carbs)}</span>{" "}
                    <span style={{ color: "var(--color-fat)" }}>F {Math.round(e.fat)}</span>
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {Math.round(e.calories)}
                </span>
              </button>
              <button
                onClick={() => onDelete(e.id)}
                aria-label={`Delete ${e.food_name}`}
                className="rounded-lg p-2 text-mute transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 px-4 text-xs text-mute">Nothing logged yet.</p>
      )}

      <Link
        href={`/add?meal=${meal}&date=${date}`}
        className="mx-4 my-3 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-xs font-semibold text-ink-dim transition-colors hover:border-accent/40 hover:text-accent"
      >
        <Plus className="size-3.5" />
        Add food
      </Link>
    </section>
  );
}
