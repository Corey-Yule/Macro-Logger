import { createClient } from "@/lib/supabase/client";
import type {
  FavoriteFood,
  FoodItem,
  FoodLogEntry,
  Meal,
  Profile,
} from "@/types";

/** Local-timezone date key, YYYY-MM-DD (en-CA formats exactly that way). */
export function dateKey(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA");
}

export function shiftDate(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00`); // noon dodges DST edges
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

export function formatDay(key: string): string {
  if (key === dateKey()) return "Today";
  if (key === shiftDate(dateKey(), -1)) return "Yesterday";
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export async function fetchProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("profiles").select("*").single();
  if (error) return null;
  return data as Profile;
}

export interface GoalUpdate {
  calorie_goal: number;
  protein_goal: number;
  carbs_goal: number;
  fat_goal: number;
}

export async function updateGoals(goals: GoalUpdate): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("profiles")
    .update({ ...goals, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
}

export async function fetchDay(date: string): Promise<FoodLogEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("food_logs")
    .select("*")
    .eq("logged_on", date)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as FoodLogEntry[];
}

export interface NewEntry {
  logged_on: string;
  meal: Meal;
  food_name: string;
  brand: string | null;
  barcode: string | null;
  serving_qty: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export async function addEntry(entry: NewEntry): Promise<FoodLogEntry> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("food_logs")
    .insert({ ...entry, user_id: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as FoodLogEntry;
}

export async function deleteEntry(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("food_logs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Update an existing diary entry (used by the edit flow). */
export async function updateEntry(
  id: string,
  changes: Partial<NewEntry>
): Promise<FoodLogEntry> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("food_logs")
    .update(changes)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as FoodLogEntry;
}

/** Copy one meal's entries from another day (usually yesterday) into `date`. */
export async function copyMealFromDate(
  date: string,
  meal: Meal,
  fromDate: string
): Promise<FoodLogEntry[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: source, error } = await supabase
    .from("food_logs")
    .select("*")
    .eq("logged_on", fromDate)
    .eq("meal", meal);
  if (error) throw new Error(error.message);
  if (!source || source.length === 0) return [];

  const clones = (source as FoodLogEntry[]).map((e) => ({
    user_id: user.id,
    logged_on: date,
    meal,
    food_name: e.food_name,
    brand: e.brand,
    barcode: e.barcode,
    serving_qty: e.serving_qty,
    serving_unit: e.serving_unit,
    calories: e.calories,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
  }));
  const { data: inserted, error: insertError } = await supabase
    .from("food_logs")
    .insert(clones)
    .select();
  if (insertError) throw new Error(insertError.message);
  return (inserted ?? []) as FoodLogEntry[];
}

/* ---------------- favourites ---------------- */

export async function fetchFavorites(): Promise<FavoriteFood[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("favorite_foods")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FavoriteFood[];
}

/** Pin a diary entry's portion as a favourite (idempotent per name+brand). */
export async function addFavorite(
  entry: Pick<
    FoodLogEntry,
    | "food_name"
    | "brand"
    | "barcode"
    | "serving_qty"
    | "serving_unit"
    | "calories"
    | "protein"
    | "carbs"
    | "fat"
  >
): Promise<FavoriteFood> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("favorite_foods")
    .upsert(
      {
        user_id: user.id,
        food_name: entry.food_name,
        brand: entry.brand,
        barcode: entry.barcode,
        serving_qty: entry.serving_qty,
        serving_unit: entry.serving_unit,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
      },
      { onConflict: "user_id,food_name,brand" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as FavoriteFood;
}

export async function removeFavorite(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("favorite_foods").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------- water ---------------- */

export async function fetchWater(date: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("water_logs")
    .select("glasses")
    .eq("logged_on", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.glasses ?? 0;
}

export async function setWater(date: string, glasses: number): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("water_logs")
    .upsert(
      { user_id: user.id, logged_on: date, glasses },
      { onConflict: "user_id,logged_on" }
    );
  if (error) throw new Error(error.message);
}

/* ---------------- recent foods ---------------- */

/** Most recently logged distinct foods (by name + brand), newest first. */
export async function fetchRecentFoods(limit = 12): Promise<FoodLogEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("food_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const out: FoodLogEntry[] = [];
  for (const row of (data ?? []) as FoodLogEntry[]) {
    const key = `${row.food_name}|${row.brand ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

/** Pull "52" out of serving text like "0.333 PACKAGE (52 g)". */
function parseServingGrams(s: string | null): number | null {
  if (!s) return null;
  const matches = [...s.matchAll(/([\d.]+)\s*(?:g|ml)\b/gi)];
  if (matches.length === 0) return null;
  const v = parseFloat(matches[matches.length - 1][1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Rebuild a FoodItem from one of the user's own log entries so it can be
 * re-logged through the normal AddFoodSheet flow. `allowGrams` is false when
 * the original serving size can't be converted to grams reliably.
 */
export function entryToFoodItem(e: FoodLogEntry): {
  food: FoodItem;
  allowGrams: boolean;
  initialQty: number;
} {
  const scale = (factor: number) => ({
    calories: Math.round(e.calories * factor * 10) / 10,
    protein: Math.round(e.protein * factor * 10) / 10,
    carbs: Math.round(e.carbs * factor * 10) / 10,
    fat: Math.round(e.fat * factor * 10) / 10,
  });

  if (e.serving_unit === "g") {
    return {
      food: {
        barcode: e.barcode ?? "",
        name: e.food_name,
        brand: e.brand,
        imageUrl: null,
        servingSize: null,
        per100g: scale(100 / e.serving_qty),
        perServing: null,
      },
      allowGrams: true,
      initialQty: e.serving_qty,
    };
  }

  const m = /^serving \((.+)\)$/.exec(e.serving_unit);
  const servingSize = m?.[1] ?? e.serving_unit;
  const perServing = scale(1 / e.serving_qty);
  const grams = parseServingGrams(servingSize);
  return {
    food: {
      barcode: e.barcode ?? "",
      name: e.food_name,
      brand: e.brand,
      imageUrl: null,
      servingSize,
      per100g: grams ? scale(100 / (e.serving_qty * grams)) : perServing,
      perServing,
    },
    allowGrams: grams !== null,
    initialQty: e.serving_qty,
  };
}

/* ---------------- trends ---------------- */

export interface DayTotals {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  logged: boolean;
}

/** Daily totals for the last `days` days (today included), zero-filled. */
export async function fetchRangeTotals(days: number): Promise<DayTotals[]> {
  const end = dateKey();
  const start = shiftDate(end, -(days - 1));
  const supabase = createClient();
  const { data, error } = await supabase
    .from("food_logs")
    .select("logged_on, calories, protein, carbs, fat")
    .gte("logged_on", start)
    .lte("logged_on", end);
  if (error) throw new Error(error.message);

  const byDay = new Map<string, Omit<DayTotals, "date" | "logged">>();
  for (const row of data ?? []) {
    const cur = byDay.get(row.logged_on) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    cur.calories += row.calories;
    cur.protein += row.protein;
    cur.carbs += row.carbs;
    cur.fat += row.fat;
    byDay.set(row.logged_on, cur);
  }

  const out: DayTotals[] = [];
  for (let i = 0; i < days; i++) {
    const date = shiftDate(start, i);
    const t = byDay.get(date);
    out.push({
      date,
      calories: t?.calories ?? 0,
      protein: t?.protein ?? 0,
      carbs: t?.carbs ?? 0,
      fat: t?.fat ?? 0,
      logged: !!t,
    });
  }
  return out;
}

/* ---------------- weight ---------------- */

export interface WeightEntry {
  measured_on: string;
  weight: number;
}

export async function fetchWeights(days = 90): Promise<WeightEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("weights")
    .select("measured_on, weight")
    .gte("measured_on", shiftDate(dateKey(), -(days - 1)))
    .order("measured_on", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as WeightEntry[];
}

/** Insert or overwrite the weight for a given day. */
export async function upsertWeight(date: string, weight: number): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("weights")
    .upsert(
      { user_id: user.id, measured_on: date, weight },
      { onConflict: "user_id,measured_on" }
    );
  if (error) throw new Error(error.message);
}
