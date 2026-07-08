# 🔥 MacroLog

**A mobile-first calorie & macro tracker with barcode scanning** — scan it, log it, hit your macros.

MacroLog is a MyFitnessPal-style food diary built as a modern web app. Point your camera at a barcode and it pulls nutrition data instantly, or search across two food databases covering millions of products and generic foods. Track calories, protein, carbs, and fat against personal goals with a fast, dark, animated UI designed for your phone.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-Auth_+_Postgres-3fcf8e?logo=supabase)

---

## ✨ Features

- **📷 Barcode scanning** — UPC/EAN scanning through the device camera using the native BarcodeDetector where available, with a torch toggle and clear permission, no-camera, and not-found states
- **🔎 Dual-database food search** — [Open Food Facts](https://openfoodfacts.org) (packaged products, photos) merged with [USDA FoodData Central](https://fdc.nal.usda.gov) (lab-verified generic foods, branded fallback) behind a single server-side API route
- **📊 Daily dashboard** — animated calorie ring with count-up remaining calories, macro progress meters, on-track/over-goal status, and a week calendar strip with logged-day dots
- **📒 Food diary** — entries grouped by meal (breakfast / lunch / dinner / snacks), serving-size and gram-based portions, optimistic one-tap delete, full date navigation
- **🕑 Recent foods & favourites** — re-log anything from your history in two taps, star foods to pin them with their usual portion, copy yesterday's meals, and edit or move logged entries in place
- **💧 Water tracker** — tappable glasses on the dashboard, saved per day
- **🏃 Exercise logging** — log workouts with duration and calories burned; burned calories extend the day's budget and flow through the ring, warnings, and celebrations
- **📲 Installable PWA** — add MacroLog to your phone's home screen and it runs standalone, with a goal-hit confetti celebration to keep you honest
- **🍳 Custom & community foods** — create foods that aren't in any database (private to you, loggable instantly), or submit them to the community; an admin review queue with a macro-consistency check gates what enters the shared database
- **📈 Trends** — 7/30-day calorie chart against your goal line with tap-to-inspect days, weekly averages, and streak tracking
- **⚖️ Weight logging** — one entry per day with a 90-day trend line and lb/kg preference that persists
- **🎯 Percentage-based goals** — set your calorie target, then split macros with auto-balancing sliders that always total 100% (with Balanced / High protein / Low carb presets)
- **🔐 Private by design** — Supabase authentication with Postgres row-level security; users can only ever read or write their own data

## 🛠 Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (CSS-first config, custom dark theme) |
| Icons | [lucide-react](https://lucide.dev) |
| Auth + database | [Supabase](https://supabase.com) (Postgres, RLS, email auth) |
| Food data | Open Food Facts API + USDA FoodData Central API |
| Barcode scanning | [html5-qrcode](https://github.com/mebjas/html5-qrcode) |

## 🚀 Getting started

### Prerequisites

- Node.js 20+
- A free [Supabase](https://supabase.com) project
- A free [USDA FoodData Central API key](https://fdc.nal.usda.gov/api-key-signup) *(optional — search falls back to Open Food Facts only without it)*

### Setup

1. **Clone and install**

   ```bash
   git clone <your-repo-url>
   cd FitnessApp
   npm install
   ```

2. **Configure environment** — copy the example file and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API (anon/public key) |
   | `USDA_API_KEY` | Emailed to you after [signup](https://fdc.nal.usda.gov/api-key-signup) (server-side only) |

3. **Create the database** — in the Supabase dashboard, open **SQL Editor** and run, in order:

   - [`supabase/schema.sql`](supabase/schema.sql) — profiles, food logs, RLS policies, signup trigger
   - [`supabase/weights.sql`](supabase/weights.sql) — weight tracking table
   - [`supabase/community_foods.sql`](supabase/community_foods.sql) — custom foods, user roles, review pipeline (edit the email at the bottom to grant yourself admin)
   - [`supabase/qol.sql`](supabase/qol.sql) — favourites + water tracking tables
   - [`supabase/hide_foods.sql`](supabase/hide_foods.sql) — per-user hide list for "My foods"
   - [`supabase/exercise.sql`](supabase/exercise.sql) — exercise / calories-burned logging

   Optionally, paste [`supabase/email-templates/confirm-signup.html`](supabase/email-templates/confirm-signup.html) into **Authentication → Emails → Templates → Confirm signup** for a branded confirmation email.

4. **Run it**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000), create an account, and start logging.

### 📱 Testing on a phone

Camera access requires HTTPS (or `localhost`). To use the barcode scanner from a real phone during development, tunnel your dev server:

```bash
npx ngrok http 3000
```

## 📁 Project structure

```
src/
├── app/
│   ├── page.tsx               # Dashboard: week strip, calorie ring, macros, meals
│   ├── add/page.tsx           # Add food: search + scan tabs, serving sheet
│   ├── trends/page.tsx        # Calorie chart, averages, weight tracking
│   ├── settings/page.tsx      # Calorie goal + %-based macro sliders, account
│   ├── login/page.tsx         # Sign in / sign up
│   └── api/food-search/       # Server route merging Open Food Facts + USDA
├── components/                # CalorieRing, MacroBar, WeekStrip, BarcodeScanner, …
├── lib/
│   ├── diary.ts               # Data access: logs, profiles, trends, weights
│   ├── openfoodfacts.ts       # Open Food Facts client
│   ├── usda.ts                # USDA FoodData Central client (server-only)
│   └── supabase/              # Supabase browser client
├── proxy.ts                   # Auth gate — session refresh + route protection
└── types/                     # Shared domain types
supabase/                      # SQL schema + migrations
```

## 🗺 Roadmap

- [ ] Restaurant food coverage (Nutritionix)
- [ ] UK-boosted Open Food Facts search for better drink/supermarket coverage
- [ ] Daily logging reminder notifications
- [ ] CSV export

## 📜 Changelog

All notable changes are documented in [CHANGELOG.md](CHANGELOG.md).

## 🙏 Data credits

Nutrition data provided by [Open Food Facts](https://openfoodfacts.org) (ODbL) and [USDA FoodData Central](https://fdc.nal.usda.gov) (public domain).
