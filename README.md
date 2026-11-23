```markdown
# 🌾 Aadhunik Krishak

**AI-Powered Smart Farming & Agricultural Intelligence Platform for Nepal**

Built for the **INNEX 2026 Hackathon** as a 48-hour prototype.

Aadhunik Krishak helps small and medium-scale farmers in Nepal make informed agricultural decisions by combining geographic location, soil characteristics, weather forecasts, crop lifecycle tracking, and AI-assisted disease diagnosis and guidance.

---

## ✨ Features

- 🗺️ **Interactive farmland selector** to pin your farm on a map
- 🌦️ **Live weather** and forecasts for your farm location
- 🌱 **Land intelligence**: soil, elevation, sunlight and climate suitability analysis
- 🌾 **Smart crop recommendations** based on location, soil and season (Terai, Hill and Mountain zones)
- 📅 **Personalized farming calendar** with auto-generated sowing-to-harvest tasks
- 💧 **Smart irrigation reminders** driven by weather
- 🩺 **AI Plant Doctor**: upload a plant photo and get a diagnosis and treatment advice
- 🤖 **Context-aware AI farming assistant** that knows your farm, soil, weather and active crops
- 💰 **Nepal market price reference** with selling and trend guidance

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React, TypeScript, Tailwind CSS, Vite |
| Backend & Database | Supabase (Authentication + PostgreSQL) |
| Maps | Leaflet / OpenStreetMap |
| Weather & Soil Data | Open-Meteo API, SoilGrids API |
| AI | Google Gemini API (Vision & context-aware chat) |
| Deployment | Vercel |

---

## 🧭 Application Pages & Routes

| Route | Page | Owner |
| :--- | :--- | :--- |
| `/login`, `/register` | Farmer authentication & onboarding | Sneha |
| `/` | Main centralized dashboard (farm, weather, crops, reminders) | Sneha |
| `/farms/new` | Interactive farmland selector (Leaflet / OpenStreetMap) | Sneha |
| `/land-intelligence` | Soil, elevation, sunlight & climate suitability analysis | Priya |
| `/crops` | Smart crop recommendations & crop registration | Priya |
| `/calendar` | Personalized farming calendar & smart irrigation reminders | Priya |
| `/plant-doctor` | AI Plant Doctor (photo upload & disease diagnosis) | Alisha |
| `/assistant` | Context-aware AI farming assistant & market insights | Alisha |

---

## 🚀 Local Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/shibakarki/Aadhunik-Krishak.git
   cd Aadhunik-Krishak
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Add the required keys in `.env`:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run the development server**

   ```bash
   npm run dev
   ```

---

## 📁 Planned Project Structure

```text
src/
├── components/   # Reusable UI (Navbar, FarmMapSelector, WeatherCard, etc.)
├── context/      # AuthContext, ActiveFarmContext
├── data/         # nepalCrops.ts, nepalMarketPrices.ts
├── lib/          # supabase.ts
├── pages/        # Dashboard, Login, Register, FarmSelector, LandIntelligence,
│                 # Crops, Calendar, PlantDoctor, Assistant
├── services/     # weatherService.ts, soilService.ts, cropEngine.ts,
│                 # irrigationEngine.ts, geminiService.ts
├── types/        # database.ts / index.ts
├── App.tsx
└── main.tsx
```

---

## 👥 Team Workflow & Branching Rules

We work **sequentially, one member at a time**, so each member builds on verified, working code.

### 1. Branching Order

`shiba` → merge to `main` → `sneha` → merge to `main` → `priya` → merge to `main` → `alisha` → merge to `main`

### 2. Before Starting Your Turn

```bash
git checkout main
git pull origin main
git checkout <your-branch>
git merge main
```

### 3. Before Handing Off to the Next Member

```bash
npm run build   # must pass with zero TypeScript or build errors
git add .
git commit -m "<your-name>: <short summary of completed work>"
git push origin <your-branch>
```

Then merge your branch into `main` (via Pull Request or CLI) so the next team member can pull it.

### 4. Collaboration Rules

- **Respect file ownership:** don't modify another member's core modules unless coordinated with the team lead.
- **Keep secrets safe:** never commit `.env` or API keys. Update `.env.example` if you add a new environment variable.
- **Test before merging:** verify your pages work with real or fallback data and don't break existing routes.
- **Hackathon integrity (INNEX 2026):** every team member must understand all code in their branch and properly document any external APIs or AI-assisted components.

---

## 🧑‍💻 Member Roles & Responsibilities

### Member 1: Shiba (Team Lead), branch `shiba`
**Focus:** Foundation, database, APIs & core engines

- Initialize Vite + React + TypeScript + Tailwind CSS + React Router + `.env.example`
- Set up shared TypeScript interfaces (`src/types/index.ts`) and Supabase client (`src/lib/supabase.ts`)
- Design and apply the Supabase PostgreSQL schema (`profiles`, `farms`, `crops`, `activities`, `disease_scans`) with RLS policies
- Create the Nepal Crop Catalog (`src/data/nepalCrops.ts`) covering Terai, Hill and Mountain agro-ecological zones
- Build `weatherService.ts` (Open-Meteo forecast & elevation) and `soilService.ts` (SoilGrids API with regional fallback)
- Build `cropEngine.ts` (location/soil/season crop recommender + stage generator) and `irrigationEngine.ts` (weather-aware watering logic)

### Member 2: Sneha, branch `sneha`
**Focus:** Authentication, farmland map & main dashboard

- Build the shared app layout (Sidebar/Navbar) and protected routes
- Implement Supabase Auth (`/login`, `/register`, farmer profile creation)
- Build the interactive Leaflet / OpenStreetMap farm selector (`/farms/new`) to pick location/coordinates and save farms to Supabase
- Build the main dashboard (`/`) showing active farm details, live Open-Meteo weather, registered crops summary and upcoming reminders

### Member 3: Priya, branch `priya`
**Focus:** Land intelligence, crop UI & farming calendar

- Build the Land Intelligence page (`/land-intelligence`) using `soilService.ts` and `weatherService.ts`
- Build the Smart Crop Recommendation & Registration UI (`/crops`) wired to `cropEngine.ts` and the Supabase `crops` table
- Auto-generate personalized sowing-to-harvest tasks in `activities` upon crop registration
- Build the Farming Calendar & Smart Irrigation Alerts UI (`/calendar`) wired to `irrigationEngine.ts`, with task completion toggles

### Member 4: Alisha, branch `alisha`
**Focus:** AI modules, market insights & deployment

- Build the AI Plant Doctor (`/plant-doctor`): upload plant photos, analyze via Gemini Vision API, display diagnosis/treatment and save history to `disease_scans`
- Build the context-aware AI Farming Assistant (`/assistant`): chat interface that injects the farmer's farm location, soil, weather and active crops into Gemini prompts
- Add Nepal market price reference and selling/trend guidance
- Run end-to-end integration testing, seed demo data and deploy to Vercel

---

## 🤝 Team Contributions & Documentation

### Shiba Karki — Team Lead (`shiba` branch)
Shiba led the overall project architecture, Git branching workflow, and Vite + React + TypeScript + Tailwind CSS setup. He designed the Supabase PostgreSQL schema and Row Level Security policies, curated the Nepal Crop Catalog and 77-district dataset, and built the core weather (`Open-Meteo`), soil (`SoilGrids` with regional fallback), crop recommendation, and smart irrigation engines. He also added strict signup validation, map reverse-geocoding with labeled satellite overlays and `m²` plot previews, AI-assisted Soil Test Report uploading (`SoilReportModal`) to recalibrate farm analyses, and Vercel SPA routing (`vercel.json`).  
📄 [Detailed Technical Documentation](./docs/DOCS_SHIBA.md)

### Sneha Magar — Frontend & Mapping (`sneha` branch)
Sneha implemented the authentication and shared state foundation, including `AuthContext`, `FarmContext`, `ProtectedRoute`, and the responsive navigation `Layout`. She built the farmer sign-in and registration pages (`/login`, `/register`), the initial interactive Leaflet/OpenStreetMap farmland selector (`/farms/new`) with GPS detection and Street/Satellite views, and the centralized farmer `Dashboard` (`/`) displaying active farm profiles, live weather, crop summaries, and upcoming task reminders.  
📄 [Detailed Technical Documentation](./docs/DOCS_SNEHA.md)

### Priya — Bilingual UI & Crop Lifecycle (`priya` branch)
Priya developed the English/Nepali bilingual experience (`LanguageContext`) with domain-specific agricultural translations and built the core agronomic workflow pages. She implemented `LandIntelligence` (`/land-intelligence`) to visualize soil chemistry, texture, and weather data, built `Crops` (`/crops`) with dynamic `crop_catalog` integration and automated task creation upon sowing registration, and created `Calendar` (`/calendar`) for managing lifecycle tasks alongside smart irrigation alerts.  
📄 [Detailed Technical Documentation](./docs/DOCS_PRIYA.md)

### Alisha — AI Intelligence & Market Insights (`alisha` branch)
Alisha led the generative AI and advisory features of Aadhunik Krishak. She built the AI Plant Doctor (`/plant-doctor`) using Gemini Vision for photo-based crop disease diagnosis and treatment logging into `disease_scans`, developed the context-aware AI Farming Assistant (`/assistant`) powered by each farmer's active farm, soil, weather, and crop context, and integrated Nepal market price insights along with final integration and deployment readiness.  
📄 [Detailed Technical Documentation](./docs/DOCS_ALISHA.md)

---

## Developer Field Notes (From the Digital Khet)

> *"In Nepal, good crops need monsoon rain, fertile soil, and zero TypeScript errors."*

### Official Agro-Tech Engineering Forecast
- **Current Agro-Zone:** Mid-Hill Hackathon Lab (Elevation: ~3 cups of chiya above sea level)
- **Soil pH of This Repo:** `6.5` — Perfectly balanced between clean TypeScript and last-minute caffeine
- **Irrigation Status:** `adequate_moisture` — All branches watered and growing nicely (`shiba` -> `sneha` -> `priya`)
- **Pest Check:** `0` bugs detected by Vite; `oxlint` temporarily scared off by Windows Smart App Control

### Team Harvest Roll Call
- **Shiba** — Built the soil, weather, and crop brains (and survived `mkdir -p` on Windows `cmd`)
- **Sneha** — Put actual farms on the map so nobody gets lost in the Terai
- **Priya** — Turned sowing dates into calendars farmers can actually follow
- **Alisha (Up Next!)** — Bringing Gemini AI magic so plants can finally tell us where it hurts

*Warning to Alisha: Do not feed the AI Plant Doctor photos of your cold chiya. It will diagnose `severe_caffeine_deficiency`.*
```

---

### Commit & Push `README.md` (`cmd`)
Once saved, push it to `index` (and sync `shiba` if you'd like):

```cmd
git checkout index
git add README.md
git commit -m "docs: add short team contribution paragraphs and links to docs folder"
git push origin index
```