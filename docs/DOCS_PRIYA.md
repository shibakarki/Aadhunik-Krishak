# Technical Documentation — Priya (Member 3)

**Project:** Aadhunik Krishak (INNEX 2026 Hackathon)  
**Member:** Priya Pun — Member 3  
**Branch:** `priya`  
**Primary Focus:** Bilingual English/Nepali Support, Land Intelligence UI, Crop Recommendations & Registration UI, and Farming Calendar & Smart Irrigation UI

---

## 1. Role Overview

As Member 3 (`priya` branch), I built the core agronomic user workflows of **Aadhunik Krishak** on top of Sneha’s authentication/farm contexts and Shiba’s & Sneha’s underlying agronomic service engines. My responsibilities covered:

1. **Bilingual English / Nepali (`EN | नेपाली`) Support** via a persistent `LanguageContext` across all three of my modules.
2. **Land Intelligence (`/land-intelligence`)** combining ISRIC SoilGrids satellite soil chemistry/texture with live Open-Meteo weather, elevation, and automatic Supabase `farms` soil profile syncing.
3. **Crop Recommendations & Registration (`/crops`)** integrating the dynamic Supabase `crop_catalog` (`loadActiveCropCatalog`), suitability scoring, crop registration into Supabase `crops`, and automatic lifecycle task generation into Supabase `activities`.
4. **Farming Calendar & Smart Irrigation (`/calendar`)** delivering an interactive AD/Bikram Sambat (2083 BS) monthly schedule, weather-aware irrigation advice, Done/Undone task switches, future-task completion locking, custom task creation/deletion, and visibility controls.
5. **Routing & Integration (`src/App.tsx`)** wiring `/land-intelligence`, `/crops`, and `/calendar` into the application and wrapping the router tree with `<LanguageProvider>`.

---

## 2. Summary of Contributions (File-by-File & Feature-by-Feature)

### `src/context/LanguageContext.tsx`

- **`LanguageProvider` & `useLanguage()`**: Manages `'en' | 'ne'` language state persisted in browser `localStorage` under `aadhunik_krishak_lang`, exposing `{ lang, setLang, toggleLang }`.
- **`LanguageToggle`**: Reusable segmented pill button (`EN | नेपाली`) placed in the headers of Land Intelligence, Crops, and Calendar so switching language on one page persists across all three pages.
- **Localization Helpers**:
  - `toDevanagari()` converts numeric strings/numbers to Devanagari digits (`०–९`).
  - `translateAgroZone()` translates `'Terai' | 'Hill' | 'Mountain'` to `तराई`, `पहाड`, `हिमाल`.
  - `translateSeason()` translates `'Monsoon' | 'Winter' | 'Spring'` to Nepali seasons.
  - `translateWeatherLabel()` & `translateSoilTexture()` map Open-Meteo weather descriptions and SoilGrids/fallback soil texture classes into Nepali.

### `src/pages/LandIntelligence.tsx` (`/land-intelligence`)

- **Active Farm Guard**: Reads `activeFarm` and `loading` from `useFarm()` (`FarmContext.tsx`) and prompts the farmer to add/select a farm (`/farms/new`) if none is active.
- **Parallel Data Fetching (`loadIntelligence`)**: Uses `Promise.allSettled()` to call `fetchFarmSoil(latitude, longitude, fallbackZone)` and `fetchFarmWeather(latitude, longitude)` simultaneously so partial network/API failures degrade gracefully.
- **Soil & Terrain Visualization**:
  - Displays agro-ecological zone, elevation (`activeFarm.elevation_m` with fallback to Open-Meteo DEM `weather.elevationM`), district/area, and coordinates.
  - Renders soil pH (`getPhStatus()` classifying Strongly Acidic, Slightly Acidic, Neutral, or Alkaline with soil amendment notes), Organic Carbon (`getOrganicCarbonStatus()`), Total Nitrogen, SoilGrids vs. Regional Fallback source badge, and a proportional Clay/Sand/Silt stacked texture bar.
  - Displays live field weather (temperature, humidity, wind, weather condition) and a 5-day forecast outlook.
- **Automatic Farm Profile Sync**: When `activeFarm.soil_type` or `activeFarm.soil_ph` is `null`, automatically updates the `farms` row in Supabase and calls `refreshFarms(activeFarm.id)`.

### `src/pages/Crops.tsx` (`/crops`)

- **Dynamic Catalog & Context Loading (`loadFarmCropContext`)**: Fetches soil (`fetchFarmSoil`), weather (`fetchFarmWeather`), registered farm crops (`supabase.from('crops').select('*').eq('farm_id', activeFarm.id)`), and the dynamic Supabase `crop_catalog` via `loadActiveCropCatalog()` (from `cropEngine.ts`, falling back to `NEPAL_CROPS`).
- **Suitability Ranking & Filtering**: Runs `recommendCrops({ elevationM, weather, soil, season, crops: cropCatalog })` to rank crops (`0–100` score) with localized suitability badges (`Highly Suitable`, `Suitable`, `Moderate`), Nepal season switcher (`Monsoon`, `Winter`, `Spring`), category filter (`Cereal`, `Vegetable`, `Pulse`, `Oilseed`, `Cash Crop`), varieties, fertilizer guide, and expandable growth stages.
- **Crop Registration & Task Automation (`handleRegisterCrop`)**: Opens a modal to pick variety, sowing date, and cultivated area (`ha`), computes `expected_harvest_date` via `addDaysToDate()`, inserts into Supabase `crops` (`user_id`, `farm_id`, `status: 'active'`), generates stage tasks via `generateCropActivities()`, and inserts them into Supabase `activities`.
- **Harvest Status Update (`handleMarkHarvested`)**: Lets the farmer mark active crops as `'harvested'` in Supabase `crops`.

### `src/pages/Calendar.tsx` (`/calendar`)

- **Data Loading (`loadCalendarData`)**: Queries Supabase `activities` (ordered by `due_date`) and `crops` for `activeFarm.id`, loads dynamic `crop_catalog` (`loadActiveCropCatalog`), and fetches live Open-Meteo weather (`fetchFarmWeather`).
- **Smart Irrigation Advice Card**: Calls `getCropByKey(crop_key, cropCatalog)` and `getIrrigationAdvice({ weather, waterRequirement, cropName })` (`irrigationEngine.ts`), displaying localized Nepali/English headlines and reasons (`irrigate_now`, `delay_rain_expected`, `light_watering`, `adequate_moisture`), 48-hour rainfall total, crop basis selector, and recommended watering interval.
- **Overview Strip & Interactive Calendar Grid**:
  - 4-card overview strip: Active Crops count, overall Task Progress, clickable Next Pending Action jumper, and 48h Rain Forecast.
  - Monthly AD calendar grid overlaid with 2083 BS Nepali dates (`getBsLabelForAdDate()` for Kartik–Magh), Devanagari numerals in Nepali mode, and Today / Sowing Day / Next Pending Task indicators.
- **Task Panel & Controls**:
  - **Day** and **All Upcoming** tabs with a daily completion progress bar.
  - **Done / Undone Toggle Switches (`handleToggleCompleted`)**: Replaced checklists with side toggle switches updating `completed` and `completed_at` in Supabase `activities`.
  - **Future-Task Completion Lock**: Blocks marking tasks complete when `due_date > todayKey` (showing an `Unlocks on YYYY-MM-DD` badge) so future tasks cannot prematurely increase progress.
  - **Custom Task Creation & Deletion**: Allows adding custom tasks for the selected date (`handleAddCustomTask` inserting into Supabase `activities`) and removing tasks (`handleDeleteTask` deleting from Supabase `activities`).
  - **Add Task Bar Visibility Toggles**: Includes **Hide added / Show added** (distinguishing custom-added tasks from crop stage template tasks via `isStageTemplateTask()`) and **Hide form / Show form** collapse controls.

### `src/App.tsx`

- Replaced `<PlaceholderPage />` stubs for `/land-intelligence`, `/crops`, and `/calendar` with `<LandIntelligence />`, `<Crops />`, and `<Calendar />`.
- Wrapped `<AuthProvider>` and `<FarmProvider>` inside `<LanguageProvider>` while preserving all team routes (`/market-price`, `/plant-doctor`, `/assistant`, `/feedback`, `/admin`) after merging `index`.

---

## 3. Tools, Libraries & APIs Used

| Tool / Service                                                      | Purpose in Project                                                                                                                    | Why Chosen Over Alternatives                                                                                                  | Reference                                                                                                               |
| :------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **React 19 / React**                                                | Component-based UI for `/land-intelligence`, `/crops`, `/calendar`, and state hooks                                                   | Matches the existing team architecture (`AuthContext`, `FarmContext`) with reusable hooks and memoized calculations           | [React Docs](https://react.dev/)                                                                                        |
| **TypeScript**                                                      | Strict type safety across `Farm`, `SoilData`, `WeatherData`, `NepalCrop`, `RegisteredCrop`, `FarmingActivity`, and `IrrigationAdvice` | Catches schema/API mismatches at compile time (`tsc -b`) before Vite production bundling                                      | [TypeScript Docs](https://www.typescriptlang.org/docs/)                                                                 |
| **Tailwind CSS v4**                                                 | Responsive utility styling for grids, calendar cells, modal, stacked soil texture bar, and toggle switches                            | Rapid, consistent styling matching Sneha’s `Layout` and `Dashboard` without writing custom CSS files                          | [Tailwind CSS Docs](https://tailwindcss.com/docs)                                                                       |
| **Custom `LanguageContext` + `localStorage`**                       | Lightweight `EN                                                                                                                       | नेपाली` switcher, Devanagari digit formatting, and domain translations                                                        | Much lighter and faster to integrate than `i18next` for 3 domain-specific pages with custom Nepali agro/BS date helpers | [React Context Docs](https://react.dev/reference/react/createContext) |
| **Supabase PostgreSQL (`@supabase/supabase-js`)**                   | Persisting and querying `farms`, `crop_catalog`, `crops`, and `activities` with Row-Level Security (RLS)                              | Provides instant REST queries, `user_id`/`farm_id` RLS isolation, and shared live sync with `Dashboard` and `Admin`           | [Supabase Docs](https://supabase.com/docs)                                                                              |
| **Open-Meteo Forecast API**                                         | Live field weather (temp, humidity, wind, precipitation), 7-day forecast, and DEM elevation via `weatherService.ts`                   | Free, requires no API key, and returns reliable 48h rainfall + elevation data for Nepal coordinates                           | [Open-Meteo Docs](https://open-meteo.com/en/docs)                                                                       |
| **ISRIC SoilGrids REST API v2.0**                                   | Fetching `0–5 cm` soil properties (`phh2o`, `soc`, `nitrogen`, `clay`, `sand`, `silt`) via `soilService.ts`                           | Global open soil grid dataset with `AbortController` 5s timeout + Nepal regional fallback when steep/urban tiles return nulls | [ISRIC SoilGrids](https://www.isric.org/explore/soilgrids)                                                              |
| **Lucide React**                                                    | Clean agricultural, weather, lock, switch, and navigation icons                                                                       | Already installed in `package.json`; tree-shakable and consistent across all pages                                            | [Lucide React Docs](https://lucide.dev/guide/packages/lucide-react)                                                     |
| **Deterministic Engines (`cropEngine.ts` & `irrigationEngine.ts`)** | Weighted 100-point crop suitability scoring, lifecycle task generation, and 48h rain-aware irrigation rules                           | Transparent, predictable, zero-latency agronomic logic that works offline/without LLM token costs                             | [Aadhunik Krishak `src/services/`](../src/services/cropEngine.ts)                                                       |

---

## 4. Use of AI

### Runtime AI vs. Deterministic Logic

- **No Runtime Generative AI / LLM Calls:** None of the modules I built (`LanguageContext.tsx`, `LandIntelligence.tsx`, `Crops.tsx`, `Calendar.tsx`) invoke any LLM or generative AI API at runtime.
- **Deterministic Agronomic & Scientific Logic:**
  - Soil chemistry and texture come deterministically from **ISRIC SoilGrids REST API v2.0** or the Nepal agro-zone regional fallback (`Terai`, `Hill`, `Mountain`) in `soilService.ts`, with threshold-based pH/organic-carbon rules in `LandIntelligence.tsx`.
  - Crop suitability ranking uses a deterministic 100-point weighted scoring algorithm in `cropEngine.ts` (agro-zone 30 pts + elevation 20 pts + season 20 pts + temperature 15 pts + soil pH 15 pts) over dynamic `crop_catalog` / `NEPAL_CROPS` data.
  - Smart Irrigation Advice uses deterministic weather thresholds in `irrigationEngine.ts` (48-hour Open-Meteo rainfall sum, current precipitation, temperature, humidity, and crop water demand).
  - Bilingual `EN | नेपाली` translations and Bikram Sambat (2083 BS) date mappings use deterministic lookup tables and date arithmetic.

### INNEX 2026 Hackathon AI Coding Assistance Disclosure

- AI coding assistance was used during development for React/Tailwind component scaffolding, Nepali agricultural terminology and UI translations, TypeScript type-checking fixes, Git branch merge/conflict resolution guidance, and drafting technical documentation.
- All generated code, Supabase database operations (`crops`, `activities`, `farms`, `crop_catalog`), edge-case behaviors (such as the future-task completion lock), and production builds (`npm run build` and `npm run dev`) were reviewed, tested in the browser, and verified by me.

---

## 5. Official References

1. React Documentation — https://react.dev/
2. TypeScript Documentation — https://www.typescriptlang.org/docs/
3. Vite Guide — https://vite.dev/
4. Tailwind CSS Documentation — https://tailwindcss.com/docs
5. React Router Documentation — https://reactrouter.com/
6. Supabase Documentation (Database, Auth & Row-Level Security) — https://supabase.com/docs
7. Open-Meteo Weather Forecast API Documentation — https://open-meteo.com/en/docs
8. ISRIC SoilGrids Global Soil Information — https://www.isric.org/explore/soilgrids
9. Lucide React Icon Library — https://lucide.dev/guide/packages/lucide-react
