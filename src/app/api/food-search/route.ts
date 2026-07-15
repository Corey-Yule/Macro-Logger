import { NextResponse, type NextRequest } from "next/server";
import { searchFatSecret } from "@/lib/fatsecret";
import { getProductByBarcode, searchProducts } from "@/lib/openfoodfacts";
import { searchUsda, usdaByBarcode } from "@/lib/usda";
import type { FoodItem } from "@/types";

const strip0 = (s: string) => s.replace(/^0+/, "");

/**
 * GET /api/food-search?q=<text>      → FoodItem[] merged from OFF + USDA
 * GET /api/food-search?barcode=<upc> → FoodItem (OFF first, USDA fallback) or 404
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const barcode = sp.get("barcode")?.trim();
  const q = sp.get("q")?.trim();

  if (barcode) {
    const off = await getProductByBarcode(barcode).catch(() => null);
    const item = off ?? (await usdaByBarcode(barcode).catch(() => null));
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(item);
  }

  if (!q || q.length < 2) return NextResponse.json([]);

  const [off, usda, fatsecret] = await Promise.all([
    searchProducts(q).catch(() => [] as FoodItem[]),
    searchUsda(q).catch(() => [] as FoodItem[]),
    searchFatSecret(q).catch(() => [] as FoodItem[]),
  ]);

  // Generic USDA foods (no brand) get inserted first so that on relevance
  // ties (e.g. "banana") the canonical entry leads; then OFF products
  // (they have photos), then USDA branded items OFF didn't already cover.
  const generic = usda.filter((u) => !u.brand);
  const branded = usda.filter((u) => u.brand);

  const out: FoodItem[] = [];
  const seen = new Set<string>();
  const push = (item: FoodItem) => {
    const syntheticCode =
      item.barcode.startsWith("usda-") || item.barcode.startsWith("fs-");
    const codeKey = syntheticCode ? "" : strip0(item.barcode);
    const nameKey = `${item.name}|${item.brand ?? ""}`.toLowerCase();
    if (codeKey && seen.has(`c:${codeKey}`)) return;
    if (seen.has(`n:${nameKey}`)) return;
    if (codeKey) seen.add(`c:${codeKey}`);
    seen.add(`n:${nameKey}`);
    out.push(item);
  };

  generic.slice(0, 5).forEach(push);
  off.forEach(push);
  fatsecret.forEach(push); // strong UK branded coverage
  branded.forEach(push);
  generic.slice(5).forEach(push);

  // Rank by how many of the query's words actually appear in name + brand,
  // so "coop bacon and egg sandwich" surfaces real matches instead of
  // whatever the upstream engines ranked first. Sort is stable, so the
  // source ordering above breaks ties.
  const tokens = q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
  if (tokens.length > 0) {
    const score = new Map(
      out.map((item) => {
        const hay = `${item.name} ${item.brand ?? ""}`.toLowerCase();
        const hits = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
        return [item, hits / tokens.length] as const;
      })
    );
    out.sort((a, b) => score.get(b)! - score.get(a)!);
  }

  return NextResponse.json(out.slice(0, 30));
}
