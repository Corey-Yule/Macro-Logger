import { createClient } from "@/lib/supabase/client";
import type { CommunityFood, FoodItem } from "@/types";

export interface NewCustomFood {
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_label: string;
  serving_grams: number | null;
  /** Per serving */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** True → goes straight into the community review queue */
  submit: boolean;
}

export async function createCustomFood(input: NewCustomFood): Promise<CommunityFood> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { submit, ...fields } = input;
  const { data, error } = await supabase
    .from("community_foods")
    .insert({
      ...fields,
      created_by: user.id,
      status: submit ? "pending" : "private",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CommunityFood;
}

/** The current user's own foods, newest first. */
export async function fetchMyFoods(limit = 20): Promise<CommunityFood[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("community_foods")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as CommunityFood[];
}

/**
 * Name/brand search over foods visible to this user (their own + approved
 * community foods — enforced by RLS, not just this query).
 */
export async function searchCommunityFoods(query: string): Promise<CommunityFood[]> {
  // strip characters that have meaning in PostgREST or-filters
  const safe = query.replace(/[%,()\\]/g, " ").trim();
  if (safe.length < 2) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("community_foods")
    .select("*")
    .or(`name.ilike.%${safe}%,brand.ilike.%${safe}%`)
    .neq("status", "rejected")
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []) as CommunityFood[];
}

/** Adapt a community food to the shared FoodItem shape the app logs with. */
export function communityToFoodItem(f: CommunityFood): {
  food: FoodItem;
  allowGrams: boolean;
} {
  const r = (n: number) => Math.round(n * 10) / 10;
  const perServing = {
    calories: r(f.calories),
    protein: r(f.protein),
    carbs: r(f.carbs),
    fat: r(f.fat),
  };
  const g = f.serving_grams;
  const scale = g ? 100 / g : 1;
  return {
    food: {
      barcode: f.barcode || `cf-${f.id}`,
      name: f.name,
      brand: f.brand,
      source: "community",
      imageUrl: null,
      servingSize: g ? `${f.serving_label} (${g} g)` : f.serving_label,
      per100g: {
        calories: r(f.calories * scale),
        protein: r(f.protein * scale),
        carbs: r(f.carbs * scale),
        fat: r(f.fat * scale),
      },
      perServing,
    },
    allowGrams: g !== null,
  };
}

/* ---------------- admin review ---------------- */

export async function fetchPendingFoods(): Promise<CommunityFood[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("community_foods")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CommunityFood[];
}

export async function reviewFood(
  id: string,
  decision: "approved" | "rejected",
  note?: string
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("community_foods")
    .update({
      status: decision,
      review_note: note?.trim() || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
