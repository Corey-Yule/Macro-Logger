# Changelog

All notable changes to MacroLog are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/) (pre-1.0: minor
versions may include breaking changes).

## [0.5.0] — 2026-07-06

### Changed
- **Dashboard overhaul** — full redesign of the home screen:
  - Week calendar strip replaces the chevron date navigation: rolling 7-day window, logged-day dots, glowing selected day, and a "Today" jump chip
  - Hero card redesigned to an Eaten | Ring | Goal layout with an ambient glow that shifts red when over goal, plus an "On track" / "kcal over" status chip
  - New quick-stats row: logging streak, 7-day calorie average, and latest weight — all deep-linking to Trends
  - Time-aware greeting header and an empty-day call-to-action card
- Professional README and this changelog; added `.env.example`

## [0.4.0] — 2026-07-06

### Added
- **USDA FoodData Central integration** — new server-side `/api/food-search` route merges Open Food Facts and USDA results with de-duplication; generic USDA foods (e.g. "Bananas, raw") lead plain-text queries and carry a USDA badge
- Barcode lookups now fall back to USDA's branded-food database when Open Food Facts misses (GTINs normalized to USDA's zero-padded 14-digit format)
- `.env.local` slot for `USDA_API_KEY` (server-side only; app degrades gracefully without it)

### Changed
- **Percentage-based macro goals** — settings now use auto-balancing sliders (always totaling 100%) with a live split bar and per-macro % / grams / kcal readouts; presets (Balanced 30/40/30, High protein 40/30/30, Low carb 35/20/45) retained
- Food search moved server-side (API keys stay private; Open Food Facts always gets its required User-Agent)

### Fixed
- Weight unit (lb/kg) preference now persists across page refreshes via a hydration-safe localStorage hook

## [0.3.0] — 2026-07-06

### Added
- **Trends screen** (`/trends`) — 7/30-day calorie bar chart against a dashed goal line, tap-to-inspect any day with a jump link into the diary, and averages (calories, protein, days under goal)
- **Weight tracking** — daily weight logging (one entry per day, re-log to overwrite), 90-day trend line, total change readout, lb/kg toggle; new `supabase/weights.sql` migration
- **Recent foods** — the add page lists your most recent distinct foods for two-tap re-logging, with nutrition rebuilt from your own log history (gram mode disabled when a serving size can't be converted safely)

## [0.2.0] — 2026-07-06

### Added
- **Settings page** (`/settings`) — edit calorie and macro goals with live macro-energy validation, apply preset splits, view account email, sign out
- Settings gear in the dashboard header (sign-out moved into Settings)

## [0.1.0] — 2026-07-04

### Added
- Initial release: Next.js 16 (App Router) + Tailwind CSS v4 + Supabase scaffold, branded **MacroLog** with a dark, lime-accented mobile-first design
- **Authentication** — email/password sign-up and sign-in with Supabase; session refresh and route protection via Next 16 proxy
- **Database schema** — `profiles` (auto-created on signup with default goals) and `food_logs` tables with row-level security
- **Dashboard** — animated calorie ring with count-up remaining calories, macro progress bars, per-meal diary sections with optimistic delete, date navigation
- **Barcode scanner** — UPC/EAN camera scanning (html5-qrcode) with laser-sweep UI and granular error states (permission denied, no camera, camera busy, insecure context)
- **Food logging** — Open Food Facts barcode lookup and debounced text search, bottom-sheet serving picker with per-serving/grams basis and live nutrition preview
