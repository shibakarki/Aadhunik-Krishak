# Technical Documentation — Member 1 (Shiba Karki, Team Lead)
**Project:** Aadhunik Krishak — AI-Powered Smart Farming & Agricultural Intelligence Platform (Nepal)  
**Event:** INNEX 2026 Hackathon  
**Branch:** `shiba` (merged sequentially with `index`)

---

## 1. Role Overview
As Team Lead (Member 1), Shiba was responsible for laying the technical foundation of **Aadhunik Krishak**: repository and team workflow architecture, frontend scaffolding, PostgreSQL database design and security, Nepal-specific agricultural datasets, external geospatial/weather/soil API integrations, deterministic crop and irrigation engines, strict form/map UX refinements, Gemini-powered Soil Test Report extraction, and production SPA routing on Vercel.

---

## 2. Summary of Contributions (Feature & File Breakdown)

### A. Project Architecture, Git Workflow & Scaffolding
- **`README.md` & Branching Strategy:** Designed a 4-member sequential workflow (`shiba` → `sneha` → `priya` → `alisha` merging into `index`) with clear file ownership and pre-merge build checks so teammates never overwrote each other's modules.
- **Frontend Scaffold:** Initialized **Vite + React 19 + TypeScript + Tailwind CSS v4** (`vite.config.ts`, `src/index.css`, `.env.example`, `.gitignore`) and structured `src/` into `components`, `context`, `data`, `lib`, `pages`, `services`, and `types`.

### B. Database Schema, Security & Shared Types
- **`supabase/schema.sql`:** Designed the relational PostgreSQL schema with 5 core tables (`profiles`, `farms`, `crops`, `activities`, `disease_scans`), an automatic `handle_new_user()` trigger that creates a farmer profile upon signup, and **Row Level Security (RLS)** policies (`auth.uid() = user_id`) so farmers can only access their own records.
- **Schema Migration & Cleanup:** Added `farms.soil_report` (`jsonb`) to persist uploaded lab soil reports across the entire app, and maintained safe SQL cleanup/reset scripts while preserving `crop_catalog` and verified user data.
- **`src/lib/supabase.ts` & `src/types/index.ts`:** Configured the Supabase client singleton and defined shared TypeScript interfaces (`Farm`, `Profile`, `NepalCrop`, `WeatherData`, `SoilData`, `CropRecommendation`, `IrrigationAdvice`, `FarmingActivity`, `DiseaseScan`) consumed by all 4 team members.

### C. Nepal Agricultural Datasets
- **`src/data/nepalCrops.ts`:** Curated a 10-crop Nepal agricultural catalog (Paddy/Rice, Maize, Wheat, Potato, Tomato, Mustard, Lentil, Finger Millet/Kodo, Cauliflower, Large Cardamom) across **Terai, Hill, and Mountain** zones—complete with Nepali names, elevation/temperature/pH bounds, water requirements, fertilizer guides, recommended Nepali varieties, and phenological stage templates.
- **`src/data/nepalDistricts.ts`:** Added the official list of all **77 districts of Nepal** for strict signup validation and reverse-geocoding normalization.

### D. External Geospatial, Weather & Soil Data Services
- **`src/services/weatherService.ts` (`fetchFarmWeather`):** Fetches live temperature, humidity, wind speed, precipitation, 7-day daily forecast, sunshine hours, and terrain elevation (`DEM`) from **Open-Meteo API**, protected by an 8-second `AbortController` timeout.
- **`src/services/soilService.ts` (`fetchFarmSoil`, `resolveFarmSoil`, `classifySoilTexture`, `getRegionalSoilFallback`):**
  - Queries **ISRIC SoilGrids v2.0** (`0–5 cm` topsoil) for pH, organic carbon, nitrogen, clay, sand, and silt, normalizing scaled API integers (`ph/10`, `soc/10`, `N/100`, `texture/10`) and classifying USDA soil texture.
  - Implements a 5-second timeout and **Nepal Agro-Zone Regional Fallback** so steep Himalayan terrain or null SoilGrids tiles never break the UI.
  - Implements `resolveFarmSoil()`, ensuring an uploaded **Lab Soil Report** automatically overrides satellite estimates across both `LandIntelligence` and `Crops`.

### E. Core Agronomic Intelligence Engines
- **`src/services/cropEngine.ts`:**
  - `determineAgroZone(elevationM)`: Classifies farms into **Terai (`< 500 m`)**, **Hill (`500–2000 m`)**, or **Mountain (`> 2000 m`)**.
  - `getCurrentNepalSeason(date)`: Maps current calendar dates to **Monsoon (Jun–Sep)**, **Spring (Mar–May)**, or **Winter (Oct–Feb)**.
  - `recommendCrops(...)`: 100-point multi-criteria weighted scoring engine (**Agro-zone 30 pts + Elevation 20 pts + Season 20 pts + Temperature 15 pts + Soil pH 15 pts**) that ranks crops and outputs explainable suitability reasons.
  - `generateCropActivities(...)`: Anchors crop `dayOffset` stage templates to a farmer's actual `sowingDate` to generate ready-to-save tasks for the farming calendar.
- **`src/services/irrigationEngine.ts` (`getIrrigationAdvice`):** Weather-aware water-balance heuristic combining crop water demand (`high`/`medium`/`low`), 48-hour forecast rainfall (`upcomingRainMm48h`), current rain, temperature, and humidity into actionable decisions (`delay_rain_expected`, `irrigate_now`, `light_watering`, `adequate_moisture`).

### F. Form Validation & Interactive Farmland Map Enhancements
- **`src/pages/Register.tsx`:** Added strict validation to prevent random/junk signups:
  - **Full Name:** 3–80 characters, Latin/Devanagari letters only, rejects numbers and repeated junk characters.
  - **Phone:** Required 10-digit Nepal mobile format (`/^(98|97|96)\d{8}$/`).
  - **District:** Restricted to Nepal's 77 official districts.
  - **Email & Password:** Strict `name@domain.tld` regex and 8+ character alphanumeric requirement.
- **`src/pages/FarmSelector.tsx`:** Enhanced the Leaflet map selector with:
  - **OpenStreetMap Nominatim Reverse Geocoding:** Clicking any point (or using GPS) automatically fills **District** (with OSM spelling normalization) and suggests an editable **Farm Name** from the detected village/municipality.
  - **Labeled Satellite View:** Layered Esri `World_Transportation` and `World_Boundaries_and_Places` overlays above `World_Imagery` so roads, towns, and districts remain readable in Satellite mode.
  - **Default `m²` Area & Scaled Dashed Plot Boundaries:** Set **Square Meters (`m²`)** as the default area unit (convertible with Ropani, Bigha, Hectares) and added a **Circle / Rectangle** dashed boundary preview scaled in real meters around the pinned point.

### G. Soil Test Report Upload & Re-Analysis
- **`src/components/SoilReportModal.tsx` & `extractSoilReportFromFile`:** Built a bilingual (English/Nepali) modal allowing farmers to upload a lab soil test report (**JPG, PNG, WebP, or PDF**), extract values via Gemini AI, review/edit fields manually, save to Supabase `farms.soil_report`, or reset back to satellite data.
- **`src/pages/LandIntelligence.tsx` & `src/pages/Crops.tsx`:** Wired `resolveFarmSoil()` and `<SoilReportModal>` into both pages so uploaded lab values immediately recalibrate soil chemistry displays and crop recommendation scores.

### H. Production Deployment Fix
- **`vercel.json`:** Resolved `404 NOT_FOUND` errors on direct URL loads and browser refreshes (e.g. `/crops`) by adding Vercel SPA rewrites (`/(.*)` → `/index.html`).

---

## 3. Tools & Technologies Used (Why Chosen Over Alternatives)

| Tool / Service | Purpose in Project | Why Chosen Over Alternatives | Reference |
| :--- | :--- | :--- | :--- |
| **React 19 + TypeScript + Vite** | Component UI, static type safety, fast bundling | **Vite** builds in ~1.5s vs. slow Webpack/CRA. **React + TS** avoids Next.js SSR complexity for a pure client-side API/Supabase SPA and shares strict types cleanly across 4 developers. | [React](https://react.dev) · [TypeScript](https://www.typescriptlang.org) · [Vite](https://vite.dev) |
| **Tailwind CSS v4** | Utility-first responsive UI styling | Much faster prototyping in a 48-hour hackathon than writing custom CSS or overriding opinionated Material UI / Bootstrap themes. | [Tailwind CSS](https://tailwindcss.com) |
| **React Router v7** | Client-side navigation & protected routes | Lightweight, standard SPA routing without requiring a Node server runtime. | [React Router](https://reactrouter.com) |
| **Supabase (Auth + PostgreSQL)** | Authentication, database, RLS security | Gives instant PostgreSQL + relational foreign keys (`farms` → `crops` → `activities`) + built-in Auth & RLS out of the box—avoiding writing a custom Express/Django backend and avoiding Firebase NoSQL's weak relational joins. | [Supabase](https://supabase.com/docs) |
| **Leaflet + OpenStreetMap + Esri Tiles** | Interactive map, street & labeled satellite views | 100% free with **no API key or billing card required** (unlike Google Maps JS API or Mapbox). Esri's reference layers give clean labels on Satellite imagery for free. | [Leaflet](https://leafletjs.com) · [OpenStreetMap](https://www.openstreetmap.org) · [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) |
| **Nominatim API (OSM)** | Reverse geocoding (lat/lng → place & district) | Free reverse geocoding with detailed Nepali village/municipality/district hierarchy, unlike paid Google Geocoding API. | [Nominatim Docs](https://nominatim.org/release-docs/latest/api/Reverse/) |
| **Open-Meteo API** | Live weather, 7-day forecast, sunshine, elevation DEM | Free, no API key required, returns **both** weather forecasts and terrain elevation in a single call—replacing paid OpenWeatherMap tiers and separate elevation APIs. | [Open-Meteo](https://open-meteo.com/en/docs) |
| **ISRIC SoilGrids v2.0 API** | Satellite-derived soil pH, OC, N, clay/sand/silt | Free global scientific soil grid at 250m resolution; paired with a custom regional fallback when tiles return null. | [ISRIC SoilGrids](https://www.isric.org/explore/soilgrids) |
| **Google Gemini API (`gemini-2.5-flash` / `2.0-flash`)** | Multimodal parsing of uploaded soil test reports (images & PDFs) | Natively reads **both photos and multi-layout PDFs** (English & Nepali units) into structured JSON—far stronger than basic Tesseract OCR, which breaks on tables, handwriting, and skewed lab photos. | [Google AI for Developers](https://ai.google.dev/gemini-api/docs) |
| **Lucide React** | Clean vector icons | Tree-shakable, lightweight, and consistent Tailwind sizing vs. heavy FontAwesome bundles. | [Lucide](https://lucide.dev) |
| **Vercel + GitHub** | Hosting, CI/CD, branch collaboration | Zero-config Vite deployment, instant preview builds on push, and simple `vercel.json` SPA rewrites vs. manual VPS/Render setup. | [Vercel](https://vercel.com/docs) · [GitHub](https://github.com) |

---

## 4. Use of AI in Shiba's Part (Where, Why & How It Works)

### Important Distinction: Deterministic Agronomic Engines vs. Generative AI
- **`cropEngine.ts` & `irrigationEngine.ts` do NOT use an LLM.** They use **transparent, deterministic agro-ecological rules and weighted math** so crop suitability scores and watering advice are fast, offline-predictable, cost-free, and 100% explainable to farmers.
- **Generative AI (Google Gemini API)** is used specifically where unstructured human documents need interpretation: **reading uploaded Soil Test Reports** in `src/services/soilService.ts`.

### Where AI Is Used
- **Service:** `extractSoilReportFromFile(file)` in `src/services/soilService.ts`
- **UI Trigger:** `src/components/SoilReportModal.tsx`
- **Pages Updated by AI Output:** `src/pages/LandIntelligence.tsx` and `src/pages/Crops.tsx`

### How the AI Soil Report Pipeline Works (Step by Step)
1. **Upload:** The farmer selects a soil test report photo (`JPG`, `PNG`, `WebP`) or `PDF` inside `SoilReportModal`.
2. **Client-Side Encoding:** `fileToBase64()` reads the file via `FileReader` and strips the Data URL prefix into raw base64.
3. **Gemini REST API Call:** Sends a `POST` request to:
   `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
   - Primary model: **`gemini-2.5-flash`** (automatically falls back to **`gemini-2.0-flash`** if a `404` occurs).
   - Configuration: `temperature: 0.1` (minimizes hallucination for numeric extraction) and `responseMimeType: "application/json"` (enforces strict JSON output).
4. **Unit Normalization & Parsing:** Gemini converts common Nepali soil lab formats (e.g., Organic Matter `%` → Organic Carbon `g/kg`, Nitrogen `%` → `g/kg`, `ppm` → `kg/ha`), and `toFiniteNumber()` safely sanitizes every parsed field.
5. **Human-in-the-Loop Verification:** Extracted values pre-fill the modal form so the farmer can verify or edit any number before clicking **Save & Update Analysis**.
6. **System-Wide Recalibration:** Saving writes the structured JSON into `farms.soil_report` (plus `farms.soil_ph` and `farms.soil_type`) in Supabase and refreshes `FarmContext`. Both `LandIntelligence` and `Crops` call `resolveFarmSoil()`, immediately updating pH diagnostics, nutrient charts, and crop recommendation rankings.

### Exact Prompt Sent Through the Gemini API
*(Located in `src/services/soilService.ts` → `extractSoilReportFromFile`)*

```text
You are an agricultural soil lab assistant for Nepal.
Analyze this uploaded soil test report (image or PDF, in English or Nepali) and extract all available soil properties as strict JSON with these exact keys (omit or set null for any field not present in the report):
{
  "ph": number or null,
  "organicCarbonGKg": number or null,
  "nitrogenGKg": number or null,
  "phosphorusKgHa": number or null,
  "potassiumKgHa": number or null,
  "clayPercent": number or null,
  "sandPercent": number or null,
  "siltPercent": number or null,
  "textureClass": string or null,
  "labName": string or null,
  "testDate": "YYYY-MM-DD" or null,
  "reportNotes": "1 concise sentence summarizing key findings or recommendations from the report" or null
}

Unit conversion rules:
- If the report lists Organic Matter % (OM%), convert to organicCarbonGKg using OM% * 5.8. If Organic Carbon % (OC%), multiply by 10.
- If the report lists Total Nitrogen %, convert to nitrogenGKg using N% * 10.
- Keep phosphorusKgHa and potassiumKgHa in kg/ha (if ppm or mg/kg is shown, multiply by 2.24).
- Return ONLY valid JSON.


AI Development Assistance Disclosure
During development, AI coding assistance was used to accelerate TypeScript scaffolding, regex validation patterns, SQL schema/cleanup debugging, and technical documentation. All architectural decisions, Nepal agro-ecological logic, database queries, and UI integrations were reviewed, tested (tsc -b && vite build), and verified by the team.


Official References
React Documentation: https://react.dev
TypeScript Handbook: https://www.typescriptlang.org/docs/
Vite Guide: https://vite.dev/guide/
Tailwind CSS v4 Documentation: https://tailwindcss.com/docs
React Router v7 Documentation: https://reactrouter.com
Supabase Docs (Auth, Postgres, RLS): https://supabase.com/docs
LeafletJS Documentation: https://leafletjs.com/reference.html
OpenStreetMap & Nominatim Reverse Geocoding API: https://nominatim.org/release-docs/latest/api/Reverse/
Esri ArcGIS World Imagery & Reference Overlays: https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9
Open-Meteo Weather Forecast API: https://open-meteo.com/en/docs
ISRIC SoilGrids v2.0 REST API: https://rest.isric.org/soilgrids/v2.0/docs
Google Gemini API (generateContent): https://ai.google.dev/api/generate-content
Vercel Rewrites Configuration: https://vercel.com/docs/projects/project-configuration#rewrites