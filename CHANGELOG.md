# Changelog

All notable changes to MacroLog are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/) (pre-1.0: minor
versions may include breaking changes).

## [0.6.2] — 2026-07-06

### Fixed
- Amount fields no longer snap to a minimum value when cleared — the serving-sheet quantity and settings calorie inputs can now be emptied and retyped freely (the pain was worst on phones, where the forced value was uneditable); validation moved to the Add/Save actions instead

## [0.6.1] — 2026-07-06

### Fixed
- **Scanner overlay misalignment and mobile decode failure** — the 0.6.0 scan-band (`qrbox`) approach restricted decoding to a region html5-qrcode positions against the video's natural size, which drifted away from the visual frame (top of the view on desktop, bottom on phones) — so users were aiming at an area that was never decoded. The scanner now decodes the entire frame, the viewfinder hugs the camera stream's real shape on any device, and the overlay spans exactly what is being scanned.

## [0.6.0] — 2026-07-06

### Added
- **Custom & community foods** — create your own foods (`/foods/new`) with per-serving nutrition and optional gram weights; private foods are loggable immediately and searchable alongside database results with a CUSTOM badge
- **Community review pipeline** — optionally submit a food for review; admins approve it into the shared database or reject it with a note. New `supabase/community_foods.sql` migration adds the table, a `role` column on profiles, and row-level security that makes self-approval impossible
- **Admin review queue** (`/admin`, linked from Settings for admins) — pending submissions with full nutrition, a macro-vs-calorie consistency check that flags entries drifting more than 15%, and approve/reject actions
- "My foods" section on the add page, and "Create food" shortcuts from empty search results and failed barcode scans (barcode pre-filled)
- Torch/flashlight toggle in the barcode scanner (when the camera supports it)

### Changed
- **Search relevance overhaul** — Open Food Facts queries now use the modern Search-a-licious engine (the legacy endpoint returned zero results for multi-word branded queries like "Coop bacon and egg sandwich"), and merged results are re-ranked by how many query words each item's name and brand actually match

### Fixed
- **Barcode scanning on mobile** — the camera opened but never detected barcodes. Scanning now uses the browser's native BarcodeDetector where available, requests a 1080p camera feed (the 640×480 default was too soft to resolve UPC lines), and restricts decoding to a marked scan band with a matching frame overlay

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
