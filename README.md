# 🌾 Aadhunik Krishak

**AI-Powered Smart Farming & Agricultural Intelligence Platform for Nepal**

### AI Plant Doctor (`/plant-doctor`) & AI Farming Assistant (`/assistant`) — Alisha

#### 1. AI Plant Doctor (`/plant-doctor`)
- **Files:** `src/pages/PlantDoctor.tsx`, `src/services/plantDoctorService.ts`
- **Features:**
  - Drag-and-drop upload, file picker, and mobile camera capture (`capture="environment"`) with automatic client-side image resizing/compression.
  - Uses **Gemini Vision** (`VITE_GEMINI_API_KEY` with automatic fallback across available Flash models and request timeout handling) enriched with the active farm's district, agro-zone, elevation, soil profile, and registered crops.
  - Displays detected crop name, diagnosis, severity (`healthy`, `low`, `medium`, `high`), confidence score, Nepal-relevant treatment steps (organic + agro-vet options), and preventive measures.
  - Automatically saves, displays, and lets users delete scan records in the Supabase `disease_scans` table.

#### 2. AI Farming Assistant (`/assistant`)
- **Files:** `src/pages/Assistant.tsx`, `src/services/assistantService.ts`
- **Features:**
  - Farm-aware multi-turn agricultural chat assistant powered by Gemini (`VITE_GEMINI_API_KEY`).
  - Automatically aggregates live context for the active farm before answering:
    - Farm location & profile (`district`, `agro_zone`, `elevation_m`, `area_hectares`)
    - Live weather & 3-day forecast (`fetchFarmWeather`)
    - Soil chemistry & texture (`fetchFarmSoil`)
    - Active registered crops (`crops`), upcoming tasks (`activities`), and recent Plant Doctor scans (`disease_scans`)
  - Includes an **English / नेपाली (Nepali)** response toggle and one-click quick prompt buttons.

