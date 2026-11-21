# 🌾 Aadhunik Krishak

**AI-Powered Smart Farming & Agricultural Intelligence Platform for Nepal**

Built for the **INNEX 2026 Hackathon** as a 48-hour prototype.

Aadhunik Krishak helps Nepali farmers make better decisions: pick their farmland on a map, get live weather and soil intelligence, receive crop and irrigation recommendations tailored to their agro-zone (Terai / Hill / Mountain), and get AI help diagnosing plant problems.

---

## ✨ Features

- **Farmland Selector:** Pin your farm on an interactive map (Leaflet / OpenStreetMap)
- **Land Intelligence:** Live weather, elevation, and soil data for your exact location
- **Agro-Zone Detection:** Automatic Terai / Hill / Mountain classification from elevation
- **Crop Recommendations:** Nepal-specific crop catalog with registration and tracking
- **Smart Irrigation & Farming Calendar:** Activity reminders driven by weather and crop needs
- **AI Plant Doctor:** Disease and pest diagnosis from photos (Gemini Vision)
- **AI Farming Assistant:** Context-aware chat that knows your farm, crops, and weather
- **Market Price Insights:** Current crop price information

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Tailwind CSS v4, Vite |
| Backend & Database | Supabase (Auth + PostgreSQL with RLS) |
| Maps | Leaflet / OpenStreetMap |
| Weather & Soil Data | Open-Meteo API, SoilGrids API |
| AI | Google Gemini API (Vision & context-aware chat) |
| Deployment | Vercel |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm
- A Supabase project (ask the team for access)

### Setup

```bash
git clone <repo-url>
cd aadhunik-krishak
npm install
cp .env.example .env
```

Fill in your `.env` (never commit this file):

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

Start the dev server:

```bash
npm run dev
```

Production build check:

```bash
npm run build
```

---

## 📁 Project Structure

```
src/
├── components/   # Shared UI (Layout, ProtectedRoute, ...)
├── context/      # AuthContext, FarmContext
├── lib/          # supabase.ts (Supabase client)
├── pages/        # Route pages (Login, Register, Dashboard, FarmSelector, ...)
├── services/     # weatherService.ts, soil service, cropEngine.ts, irrigation engine
└── types/        # Shared TypeScript interfaces (index.ts)
```

---

## 👥 Team & Progress

| Member | Branch | Scope | Status |
|---|---|---|---|
| **Shiba** | `shiba` | Project setup, Supabase schema & RLS, shared types, Nepal crop catalog, weather service, SoilGrids service + fallback, Crop & Irrigation engines | ✅ Done |
| **Sneha** | `sneha` | Auth, App Layout, Leaflet Farmland Selector, Main Dashboard | 🔜 Next up |
| **Priya** | `priya` | Land Intelligence UI, Crop Recommendations & Registration UI, Farming Calendar & Smart Irrigation UI | ⏳ Pending |
| **Alisha** | `alisha` | AI Plant Doctor (Gemini Vision), AI Farming Assistant, Market Price Insights, Vercel deployment | ⏳ Pending |

---

## 📋 Member 2 (Sneha) — Instructions

### 1. Sync Shiba's work into your branch

```bash
git checkout index
git pull origin index
git checkout sneha
git merge index
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env`, ask Shiba for the Supabase keys, then run `npm run dev`.

### 3. Existing modules (use these — do not rewrite)

| File | Purpose |
|---|---|
| `src/lib/supabase.ts` | Supabase client for Auth & DB queries |
| `src/types/index.ts` | Interfaces: `Profile`, `Farm`, `RegisteredCrop`, `FarmingActivity`, `WeatherData`, `AgroZone`, etc. |
| `src/services/weatherService.ts` | `fetchFarmWeather(latitude, longitude)` → live weather, 7-day forecast, `elevationM` |
| `src/services/cropEngine.ts` | `determineAgroZone(elevationM)` → Terai / Hill / Mountain |

### 4. What to build on `sneha`

#### Auth & Active Farm Context (`src/context/`)
- **`AuthContext.tsx`**: manages `user`, `session`, `profile`, `signUp`, `signIn`, `signOut`, and `loading` via `supabase.auth`
- **`FarmContext.tsx`**: fetches the user's farms from the `farms` table and tracks `activeFarm`, shared by Dashboard, Land Intelligence, Crops, and the AI Assistant

#### App Shell & Routing (`src/components/Layout.tsx`, `src/App.tsx`)
A responsive Navbar / Sidebar linking to:

| Route | Page | Owner |
|---|---|---|
| `/` | Dashboard | Sneha |
| `/farms/new` | Add / Select Farmland | Sneha |
| `/land-intelligence` | Placeholder | Priya |
| `/crops` | Placeholder | Priya |
| `/calendar` | Placeholder | Priya |
| `/plant-doctor` | Placeholder | Alisha |
| `/assistant` | Placeholder | Alisha |

Wrap app routes in a `ProtectedRoute` that redirects unauthenticated users to `/login`.

#### Authentication Pages
- **`/login`** (`src/pages/Login.tsx`): email + password via `supabase.auth.signInWithPassword`
- **`/register`** (`src/pages/Register.tsx`): Full Name, Phone, District, Email, Password via `supabase.auth.signUp` with `options.data: { full_name, phone, district }`. A database trigger creates the `profiles` row automatically.

#### Leaflet Farmland Selector (`src/pages/FarmSelector.tsx` → `/farms/new`)
- Interactive map centered on Nepal (`[28.3949, 84.1240]`, zoom 7)
- Click the map (or use browser Geolocation) to drop a marker and capture latitude/longitude
- Inputs: Farm Name, District, Area (hectares, or convert Ropani/Bigha to hectares)
- Call `fetchFarmWeather(lat, lng)` to get `elevationM`, pass it to `determineAgroZone(elevationM)`, then insert the farm into the Supabase `farms` table

#### Main Dashboard (`src/pages/Dashboard.tsx` → `/`)
- **No farms yet:** prompt with a button to add the first farm (`/farms/new`)
- **With farms:**
  - Active farm switcher & summary (name, district, agro-zone, elevation, area)
  - Live weather card via `fetchFarmWeather(activeFarm.latitude, activeFarm.longitude)`: current temp, humidity, wind, condition, and 3–7 day preview
  - Registered crops summary (query `crops` for `activeFarm.id`; empty state links to `/crops`)
  - Upcoming activities (query `activities` where `completed = false`, ordered by `due_date`; empty state links to `/calendar`)
  - Quick actions to `/land-intelligence`, `/crops`, `/plant-doctor`, `/assistant`

### 5. Hand-off checklist (before merging for Priya)

- [ ] Login and registration work
- [ ] Adding a farm on the Leaflet map works
- [ ] Dashboard shows live weather
- [ ] `npm run build` passes with zero errors
- [ ] `.env` is **not** committed

```bash
git status
git add .
git commit -m "feat(sneha): add Supabase auth, Leaflet farm selector, and main dashboard"
git push origin sneha
git checkout index
git pull origin index
git merge sneha
git push origin index
```

Then notify **Priya** that `index` is ready to pull.

---

## 🔐 Security Notes

- Never commit `.env` or any API keys
- Row Level Security (RLS) is enabled on all Supabase tables

---

## 📄 License

Built for the INNEX 2026 Hackathon. All rights reserved by the team.
