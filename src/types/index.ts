export type Meal = "breakfast" | "lunch" | "dinner" | "snacks";

export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snacks"];

/** Daily targets from the user's profile. Macro values are grams. */
export interface MacroGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * A food as returned by Open Food Facts, normalized for our UI.
 * Nutrition is per 100 g/ml; perServing is present only when the
 * product declares a serving size.
 */
export interface FoodItem {
  barcode: string;
  name: string;
  brand: string | null;
  /** Which database the item came from (recalled diary items leave it unset). */
  source?: "off" | "usda";
  imageUrl: string | null;
  /** Human-readable serving, e.g. "30 g" */
  servingSize: string | null;
  per100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  perServing: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
}

/** A row in the food_logs table. */
export interface FoodLogEntry {
  id: string;
  user_id: string;
  logged_on: string; // YYYY-MM-DD
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
  created_at: string;
}

/** A row in the profiles table. */
export interface Profile {
  id: string;
  calorie_goal: number;
  protein_goal: number;
  carbs_goal: number;
  fat_goal: number;
  created_at: string;
  updated_at: string;
}
