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

/** The current user's own foods, newest first, minus any they've hidden. */
export async function fetchMyFoods(limit = 20): Promise<CommunityFood[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [foodsRes, hiddenIds] = await Promise.all([
    supabase
      .from("community_foods")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(limit + 50),
    supabase
      .from("hidden_community_foods")
      .select("food_id")
      // hide table may not exist yet — a query error means "nothing hidden"
      .then(({ data, error }) =>
        error
          ? new Set<string>()
          : new Set((data ?? []).map((r) => r.food_id as string))
      ),
  ]);
  if (foodsRes.error) throw new Error(foodsRes.error.message);

  return ((foodsRes.data ?? []) as CommunityFood[])
    .filter((f) => !hiddenIds.has(f.id))
    .slice(0, limit);
}

/**
 * Remove a food from the user's "My foods" list.
 * Approved community foods are only hidden (the community keeps them);
 * private/pending/rejected foods are the user's alone and get deleted.
 */
export async function removeFromMyFoods(food: CommunityFood): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  if (food.status === "approved") {
    const { error } = await supabase
      .from("hidden_community_foods")
      .upsert({ user_id: user.id, food_id: food.id });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("community_foods")
      .delete()
      .eq("id", food.id);
    if (error) throw new Error(error.message);
  }
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

/** Fields an admin may correct while approving a submission. */
export type ReviewUpdates = Partial<
  Pick<
    CommunityFood,
    | "name"
    | "brand"
    | "serving_label"
    | "serving_grams"
    | "calories"
    | "protein"
    | "carbs"
    | "fat"
  >
>;

export async function reviewFood(
  id: string,
  decision: "approved" | "rejected",
  note?: string,
  updates?: ReviewUpdates
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("community_foods")
    .update({
      ...updates,
      status: decision,
      review_note: note?.trim() || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
