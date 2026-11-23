# Technical Documentation — Sneha Magar (Member 2)

**Project:** Aadhunik Krishak — AI-Powered Smart Farming & Agricultural Intelligence Platform (Nepal)  
**Event:** INNEX 2026 Hackathon  
**Member:** Sneha Magar — Member 2  
**Branch:** `sneha`  
**Primary Focus:** Authentication, Shared React Contexts & Route Security, Interactive Farmland Map Selector, Main Dashboard, Open-Meteo Weather Service, Farmer Feedback System, and Developer Admin Console with Gemini-Powered Dynamic Crop Catalog

---

## 1. Role Overview

As Member 2 (`sneha` branch), I built the foundational user experience, state management, geospatial farmland onboarding, live weather integration, farmer feedback loop, and developer administration layer of **Aadhunik Krishak**. My responsibilities spanned:

1. **Authentication & Route Protection:** Farmer login/registration backed by Supabase Auth, session persistence, and role-based route guards (`ProtectedRoute` for farmers, `AdminRoute` for developer admins).
2. **Global State & App Shell:** Shared `AuthContext` and `FarmContext` providers plus a responsive sidebar/mobile drawer navigation shell (`Layout.tsx`) and router configuration (`App.tsx`).
3. **Interactive Farmland Pinning (`FarmSelector.tsx`):** A Leaflet map centered on Nepal with GPS location capture, a **Street ↔ Satellite** view switcher, Nepal land-unit conversion (`Ropani` / `Bigha` / `Hectares`), and automatic elevation + agro-ecological zone classification on save. *(Teammate Shiba later layered strict district/name validation, Nominatim reverse geocoding, `m²` default units, satellite label overlays, and dashed plot boundary previews on top of this selector.)*
4. **Live Weather Service & Farmer Dashboard:** Implemented `fetchFarmWeather()` via the Open-Meteo Forecast API and built the centralized `Dashboard.tsx` summarizing the active farm, live weather + 5-day forecast, registered crops, and upcoming tasks.
5. **Farmer Feedback System (`Feedback.tsx`):** Built an issue/feature-request submission page and personal feedback status tracker backed by Supabase PostgreSQL with Row Level Security (RLS).
6. **Developer Admin Console & AI-Evaluated Dynamic Crop Database (`Admin.tsx`, `adminCropService.ts`):** Built an admin dashboard to inspect farmer profiles and selected lands, manage farmer feedback statuses, sync default crops, and evaluate/upload new Nepal crops using the **Google Gemini API** into a live Supabase `crop_catalog` table—and connected `cropEngine.ts`, `Crops.tsx`, and `Calendar.tsx` to read dynamically from that database.

---

## 2. Summary of Contributions (File-by-File & Feature-by-Feature)

### `src/context/AuthContext.tsx` & `src/components/ProtectedRoute.tsx`

- **`AuthProvider` & `useAuth()`**: Manages `{ user, session, profile, loading, signUp, signIn, signOut, refreshProfile }` using `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange()`.
- **Profile Fetching & Metadata**: Queries `public.profiles` (`maybeSingle()`) when authenticated and passes `{ full_name, phone, district }` in `options.data` during `signUp()` (with a safe fallback `upsert` when a session is immediately active).
- **`ProtectedRoute.tsx`**: Displays a loading indicator while initial auth state resolves and redirects unauthenticated visitors to `/login` (preserving the attempted route in `location.state.from`).

### `src/context/FarmContext.tsx`

- **`FarmProvider` & `useFarm()`**: Automatically fetches all farmlands owned by the logged-in user from `public.farms` ordered by creation time.
- **Persistent Active Farm**: Tracks `activeFarm` globally across Dashboard, Land Intelligence, Crops, Calendar, Plant Doctor, AI Assistant, and Feedback, persisting the selected farm ID in `localStorage` (`aadhunik_krishak_active_farm_id`) and exposing `refreshFarms(selectFarmId?)` so newly pinned farms become active immediately.

### `src/components/Layout.tsx` & `src/App.tsx`

- **`Layout.tsx`**: Responsive desktop fixed sidebar + mobile top header and slide-out drawer with links to `/`, `/farms/new`, `/land-intelligence`, `/crops`, `/calendar`, `/market-price`, `/plant-doctor`, `/assistant`, and `/feedback`, plus an embedded **Active Farm Switcher**, user profile summary, and Sign Out button. Conditionally displays the **Admin Panel** (`/admin`) link only when `isAdminEmail(user?.email)` returns `true`.
- **`App.tsx`**: Configured `BrowserRouter` routes for public `/login` and `/register` pages, `<ProtectedRoute>`-guarded `<Layout />` routes, `<AdminRoute>`-guarded `/admin`, and fallback redirection (`*` → `/`).

### `src/pages/Login.tsx` & `src/pages/Register.tsx`

- **`Login.tsx`**: Email and password sign-in form calling `useAuth().signIn()` (`supabase.auth.signInWithPassword`), inline error banners, loading states, and redirect logic for already-authenticated users.
- **`Register.tsx`**: Farmer signup UI collecting Full Name, Phone, District, Email, and Password, calling `signUp()` and handling both immediate-session logins and email-verification states. *(Later enhanced by Shiba with strict regex validation and Nepal's 77-district dropdown.)*

### `src/pages/FarmSelector.tsx` (`/farms/new`)

- **Interactive Leaflet Map**: Initializes a Leaflet map centered on Nepal (`[28.3949, 84.124]`, zoom `7`) with proper React `StrictMode` cleanup (`map.remove()`), custom SVG `L.divIcon` markers (preventing Vite production asset path issues), and browser `navigator.geolocation` capture.
- **Street ↔ Satellite Layer Switcher**: Allows farmers to switch seamlessly between OpenStreetMap Street tiles and Esri `World_Imagery` Satellite tiles without losing their pinned marker or zoom level.
- **Area Unit Conversion & Agro-Zone Classification**: Converts farmer inputs from `Ropani` (`× 0.050874`), `Bigha` (`× 0.677263`), `Sq. Meters` (`÷ 10000`), or `Hectares` into hectares, calls `fetchFarmWeather(lat, lng)` to obtain elevation (`elevationM`), classifies the farm via `determineAgroZone(elevationM)` (`Terai`, `Hill`, `Mountain`), and inserts the record into `public.farms`.

### `src/services/weatherService.ts`

- **`fetchFarmWeather(latitude, longitude)`**: Calls the **Open-Meteo Forecast API** (`current` temperature, humidity, precipitation, weather code, wind speed + 7-day `daily` min/max temperature, precipitation sum, precipitation probability, and `sunshine_duration` converted to hours, plus DEM `elevation`).
- **`getWeatherLabel(code)`**: Deterministically translates WMO weather codes (`0–99`) into human-readable labels for the Dashboard and downstream engines.

### `src/pages/Dashboard.tsx` (`/`)

- **Onboarding Empty State**: Prompts new farmers with no farms yet to pin their first farmland (`/farms/new`).
- **Active Farm Overview & Switcher**: Dropdown to switch `activeFarm`, quick `+ Add Farm` button, and a summary banner displaying district, agro-zone, elevation, and area in hectares.
- **Live Weather & 5-Day Forecast**: Fetches `fetchFarmWeather(activeFarm.latitude, activeFarm.longitude)` on farm change and renders current temperature, humidity, rain, wind speed, condition label, and a 5-day forecast strip.
- **Crops & Tasks Summary + Quick Actions**: Queries `public.crops` and incomplete `public.activities` (`completed = false`, ordered by `due_date`) for `activeFarm.id`, with empty-state links to `/crops` and `/calendar` and quick action cards for `/land-intelligence`, `/crops`, `/plant-doctor`, and `/assistant`.

### `src/pages/Feedback.tsx` (`/feedback`)

- **Farmer Feedback Form**: Allows logged-in farmers to submit **Report Issue (`issue`)**, **New Feature (`feature`)**, or **General (`general`)** feedback linked to a feature/page area (`page_area`), optional `activeFarm.id`, subject, and description into `public.feedback`.
- **Personal Feedback History**: Displays the farmer's previously submitted feedback rows with category badges and live status (`open`, `reviewed`, `resolved`).

### `src/lib/admin.ts`, `src/components/AdminRoute.tsx`, `src/pages/Admin.tsx`, `src/services/adminCropService.ts` & Dynamic Crop Integration

- **`src/lib/admin.ts` & `src/components/AdminRoute.tsx`**: Restricts `/admin` access in the UI to the four developer emails (`ADMIN_EMAILS`) paired with a Supabase `public.is_admin()` RLS helper function (`auth.jwt() ->> 'email'`).
- **`src/pages/Admin.tsx` (`/admin`)**: Three-tab developer management console:
  1. **Farmers & Lands:** Displays summary metrics, search filter, registered farmer profiles (`name`, `phone`, `district`, join date), and each farmer's pinned farmlands and crop counts.
  2. **Crop Database & AI Upload:** Lets admins click **Sync 10 Default Crops** (upserting `NEPAL_CROPS` into `public.crop_catalog`), click **Evaluate Details with Gemini AI** to auto-generate agronomic parameters and watering/growth stages, edit every field or stage visually, and save/edit/delete crops in `public.crop_catalog`.
  3. **Farmer Feedback:** Lists all submitted feedback across users with farmer/farm labels and status selectors (`open` → `reviewed` → `resolved`).
- **Dynamic Crop Catalog Integration (`src/services/cropEngine.ts`, `src/pages/Crops.tsx`, `src/pages/Calendar.tsx`)**: Added `loadActiveCropCatalog()` to fetch crops live from Supabase `crop_catalog` (falling back automatically to `NEPAL_CROPS` if empty/offline) and updated `getCropByKey()`, `recommendCrops()`, `generateCropActivities()`, `Crops.tsx`, and `Calendar.tsx` so admin-uploaded crops immediately work in recommendations and calendar stage generation.

---

## 3. Tools, Libraries & APIs Used

| Tool / Service | Purpose in Project | Why Chosen Over Alternatives | Reference |
| :--- | :--- | :--- | :--- |
| **React 19** | Component-driven UI for Auth, Map, Dashboard, Feedback, and Admin Console | Familiar reactive state/hooks model shared across the 4-member team without SSR complexity | [React Docs](https://react.dev/) |
| **TypeScript** | Static typing across `Profile`, `Farm`, `WeatherData`, `NepalCrop`, `RegisteredCrop`, and `FarmingActivity` | Catches API and database column mismatches at compile time (`tsc -b`) before Vite bundling | [TypeScript Docs](https://www.typescriptlang.org/docs/) |
| **Tailwind CSS v4** | Utility-first responsive layout and UI styling (sidebar, mobile drawer, cards, forms) | Enables fast, consistent responsive styling without maintaining custom CSS files | [Tailwind CSS Docs](https://tailwindcss.com/docs) |
| **React Router v7** | Client-side routing, `<ProtectedRoute>`, `<AdminRoute>`, and nested `<Layout>` `<Outlet />` | Standard SPA routing in Vite without requiring server-side route handlers | [React Router Docs](https://reactrouter.com/) |
| **Supabase Auth & PostgreSQL** | User authentication, `profiles`, `farms`, `crops`, `activities`, `feedback`, and `crop_catalog` with RLS | Provides auth, relational foreign keys, and row-level security out of the box—much faster than building a custom Node/Django backend or managing NoSQL joins in Firebase | [Supabase Docs](https://supabase.com/docs) |
| **React Context API (`AuthContext`, `FarmContext`)** | Global authentication and active-farm state management | Zero extra bundle weight or boilerplate compared to Redux Toolkit or Zustand for two focused global states | [React Context Docs](https://react.dev/reference/react/createContext) |
| **Leaflet + OpenStreetMap + Esri World Imagery** | Interactive Nepal farmland map, custom pins, and Street ↔ Satellite layer switching | Completely free with no API key or credit card billing limits, unlike Google Maps JS API or Mapbox GL | [Leaflet Docs](https://leafletjs.com/reference.html) · [OpenStreetMap](https://www.openstreetmap.org/) |
| **Open-Meteo Forecast API** | Live weather, 7-day forecast, sunshine duration, and DEM elevation | Free, no API key required, and supplies both weather and terrain elevation in one call | [Open-Meteo Docs](https://open-meteo.com/en/docs) |
| **Google Gemini API (`generateContent`)** | Admin-side evaluation of new crops (watering schedule, growth days, elevation/temp/pH bounds, fertilizer guide) | Generates structured Nepal agronomic JSON in seconds vs. hours of manual research, using the same `VITE_GEMINI_API_KEY` already configured for the team | [Google Gemini API Docs](https://ai.google.dev/api/generate-content) |
| **Lucide React** | Lightweight SVG UI icons across navigation, weather cards, map controls, and admin tools | Clean, tree-shakable React icon components matching Tailwind sizing | [Lucide React Docs](https://lucide.dev/guide/packages/lucide-react) |

---

## 4. Use of AI

### Runtime AI vs. Deterministic Logic

1. **Deterministic Modules (No Runtime AI / LLMs):**
   - **Authentication, Route Guards, Contexts, Dashboard, Feedback, Farmer/Feedback Admin Views, Leaflet Map, Ropani/Bigha Conversion, and `weatherService.ts`** use **100% deterministic code and real-world APIs** (Supabase Auth/Postgres, Leaflet/Esri/OSM, and Open-Meteo). No generative AI is used for login, unit math, elevation agro-zone classification (`< 500 m` Terai, `500–2000 m` Hill, `> 2000 m` Mountain), or live weather display.
2. **Where Runtime AI Is Used (`src/services/adminCropService.ts` → `evaluateCropWithGemini`):**
   - Generative AI (**Google Gemini REST API**) is used **only on the Admin Crop Upload form** (`/admin`) to help developers quickly onboard new Nepali crops into `public.crop_catalog`.
   - **Why at upload time only:** Running Gemini **once** when an admin adds a crop—with **human-in-the-loop review and editing** before saving to Supabase—avoids repeated LLM latency and API cost when farmers browse `/crops` or `/calendar`, where recommendations run deterministically against the saved database records.
   - **API & Model Fallback Configuration:**
     - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=...`
     - Model fallback chain: `['gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3-flash-preview', 'gemini-3.8-flash', 'gemini-flash-latest']`
     - Generation config: `temperature: 0.25` with a 25-second `AbortController` timeout, filtering out `part.thought` segments, extracting strict JSON (`extractJsonObject`), and validating/sanitizing categories, agro-zones, seasons, water requirement, numbers, and stage `activity_type` values before populating the form.

#### Exact Verbatim Prompt Sent to the Gemini API
*(Located in `src/services/adminCropService.ts` → `evaluateCropWithGemini`)*

```text
You are a senior Nepalese agronomist building a structured crop database for Nepal (Terai, Hill, Mountain zones).
Evaluate and generate accurate agricultural parameters—including watering/irrigation timing, growth stages, elevation range, temperature range, ideal soil pH, and fertilizer guide—for this crop:

- Crop Name: ${params.name}
- Nepali Name (if known): ${params.nepaliName || 'Please provide English + Devanagari like "धान (Dhan)"'}
- Category hint: ${params.category || 'Choose best fit'}
- Varieties hint: ${params.varietiesHint || 'Suggest popular varieties grown in Nepal'}
- Additional notes from admin: ${params.notes || 'None'}

Return ONLY a single valid JSON object (no markdown commentary) with these exact keys:
{
  "key": "snake_case_key",
  "name": "Crop Name",
  "nepaliName": "नेपाली नाम (Transliteration)",
  "category": "Cereal | Vegetable | Pulse | Oilseed | Cash Crop",
  "agroZones": ["Terai", "Hill", "Mountain"],
  "seasons": ["Monsoon", "Winter", "Spring"],
  "minElevationM": 100,
  "maxElevationM": 2000,
  "minTempC": 15,
  "maxTempC": 32,
  "idealPhMin": 5.5,
  "idealPhMax": 7.0,
  "waterRequirement": "low | medium | high",
  "growthDays": 100,
  "fertilizerGuide": "Concise Nepal-specific basal and top-dress fertilizer schedule",
  "varieties": ["Variety 1", "Variety 2", "Variety 3"],
  "stages": [
    {
      "dayOffset": 0,
      "title": "Sowing / Transplanting",
      "description": "Short actionable instruction",
      "activity_type": "sowing"
    },
    {
      "dayOffset": 14,
      "title": "First Irrigation / Watering",
      "description": "Specific watering schedule & moisture tip",
      "activity_type": "irrigation"
    }
  ]
}

Important rules:
- Include 5 to 7 realistic stages from dayOffset 0 (sowing) through growthDays (harvest), with explicit watering/irrigation stages ("irrigation"), fertilizer, weeding, and pest_check stages.
- Every stage's activity_type MUST be one of: sowing, irrigation, fertilizer, weeding, pest_check, harvest.
```

### INNEX 2026 Hackathon AI Coding Assistance Disclosure

- During development, AI coding assistance was used to help scaffold React/TypeScript components, Tailwind CSS v4 responsive layouts, Supabase RLS SQL templates, Git branch workflow steps, and technical documentation.
- All code, TypeScript builds (`npm run build`), Supabase queries, map behavior, weather fetches, and admin crop evaluations were personally tested, reviewed, and verified by me in the browser.

---

## 5. Official References

1. React Documentation — https://react.dev/
2. TypeScript Documentation — https://www.typescriptlang.org/docs/
3. Vite Documentation — https://vite.dev/guide/
4. Tailwind CSS Documentation — https://tailwindcss.com/docs
5. React Router Documentation — https://reactrouter.com/
6. Supabase Documentation (Auth, PostgreSQL & Row-Level Security) — https://supabase.com/docs
7. Leaflet Documentation — https://leafletjs.com/reference.html
8. OpenStreetMap — https://www.openstreetmap.org/copyright
9. Esri World Imagery (ArcGIS Online) — https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9
10. Open-Meteo Weather Forecast API — https://open-meteo.com/en/docs
11. Google Gemini API (`generateContent`) — https://ai.google.dev/api/generate-content
12. Lucide React Icon Library — https://lucide.dev/guide/packages/lucide-react