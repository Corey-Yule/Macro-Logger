// FatSecret Platform client (strong UK supermarket coverage). Server-side
// only: OAuth2 client-credentials with the secret, so never import this
// outside API routes.
import type { FoodItem } from "@/types";

const TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const API_URL = "https://platform.fatsecret.com/rest/server.api";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function requestToken(id: string, secret: string, scope?: string) {
  return fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: scope ? `grant_type=client_credentials&scope=${scope}` : "grant_type=client_credentials",
  });
}

async function getToken(): Promise<string | null> {
  const id = process.env.FATSECRET_CLIENT_ID;
  const secret = process.env.FATSECRET_CLIENT_SECRET;
  if (!id || !secret) return null; // integration is optional

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  let res = await requestToken(id, secret, "basic");
  if (!res.ok) res = await requestToken(id, secret); // some apps have no explicit scope
  if (!res.ok) throw new Error(`FatSecret token error: ${res.status}`);

  const data: { access_token: string; expires_in?: number } = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 86400) * 1000,
  };
  return cachedToken.token;
}

interface FsFood {
  food_id: string;
  food_name?: string;
  brand_name?: string;
  food_type?: string;
  food_description?: string;
}

// e.g. "Per 100g - Calories: 520kcal | Fat: 30.00g | Carbs: 55.00g | Protein: 7.00g"
const DESC_RE =
  /^Per (.+?) - Calories: ([\d.]+)kcal \| Fat: ([\d.]+)g \| Carbs: ([\d.]+)g \| Protein: ([\d.]+)g/;

function parseGrams(label: string): number | null {
  const m = /([\d.]+)\s*(?:g|ml)\b/i.exec(label);
  const v = m ? parseFloat(m[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toFoodItem(f: FsFood): FoodItem | null {
  const name = f.food_name?.trim();
  const m = f.food_description ? DESC_RE.exec(f.food_description) : null;
  if (!name || !m) return null;

  const [, basis, kcal, fat, carbs, protein] = m;
  const values = {
    calories: round1(parseFloat(kcal)),
    protein: round1(parseFloat(protein)),
    carbs: round1(parseFloat(carbs)),
    fat: round1(parseFloat(fat)),
  };

  const base = {
    barcode: `fs-${f.food_id}`,
    name,
    source: "fatsecret" as const,
    brand: f.brand_name?.trim() || null,
    imageUrl: null,
  };

  // "Per 100g" entries map straight onto our per-100g model
  if (/^100\s?(?:g|ml)$/i.test(basis.trim())) {
    return {
      ...base,
      servingSize: null,
      per100g: values,
      perServing: null,
      gramsSupported: true,
    };
  }

  // Serving-based entries ("1 sandwich", "1 bar (45 g)", …)
  const grams = parseGrams(basis);
  const scale = grams ? 100 / grams : 1;
  return {
    ...base,
    servingSize: basis.trim(),
    per100g: {
      calories: round1(values.calories * scale),
      protein: round1(values.protein * scale),
      carbs: round1(values.carbs * scale),
      fat: round1(values.fat * scale),
    },
    perServing: values,
    gramsSupported: grams !== null,
  };
}

/** Free-text search. Returns [] when no credentials are configured. */
export async function searchFatSecret(query: string): Promise<FoodItem[]> {
  const token = await getToken();
  if (!token) return [];

  const body = new URLSearchParams({
    method: "foods.search",
    search_expression: query,
    format: "json",
    max_results: "20",
  });
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`FatSecret error: ${res.status}`);

  const data: {
    error?: { message?: string };
    foods?: { food?: FsFood | FsFood[] };
  } = await res.json();
  if (data.error) throw new Error(data.error.message ?? "FatSecret error");

  // FatSecret quirk: a single result comes back as an object, not an array
  const raw = data.foods?.food;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(toFoodItem).filter((x): x is FoodItem => x !== null);
}
