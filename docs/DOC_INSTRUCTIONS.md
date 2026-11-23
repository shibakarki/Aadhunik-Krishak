Save or share this as a single file (e.g., **`docs\DOC_INSTRUCTIONS.md`**):

```markdown
# Documentation Instructions & Prompts — Sneha, Priya & Alisha
**Project:** Aadhunik Krishak (INNEX 2026 Hackathon)  
**Goal:** Each member generates their own technical documentation file inside `docs/` matching `docs/DOCS_SHIBA.md`:
- `docs/DOCS_SNEHA.md`
- `docs/DOCS_PRIYA.md`
- `docs/DOCS_ALISHA.md`

---

## Standard Rules for Everyone
1. Only document **files, features, tools, and prompts you actually worked on** in your branch.
2. Every file must follow the same **5-section structure**:
   - **1. Role Overview**
   - **2. Summary of Contributions (File-by-File & Feature-by-Feature)**
   - **3. Tools, Libraries & APIs Used** (Table: `Tool | Purpose | Why Chosen Over Alternatives | Official Reference`)
   - **4. Use of AI** (Separate **Runtime AI in the app** vs. **Deterministic Logic** vs. **AI Coding Assistance Disclosure** per INNEX 2026 rules; include exact API prompts if your code calls an LLM)
   - **5. Official References** (Numbered documentation URLs)
3. **Git Steps to Upload Your File:**
   ```bash
   git checkout <your-branch>
   git pull origin index
   mkdir -p docs
   # Save your file as docs/DOCS_<YOURNAME>.md
   git add docs/DOCS_<YOURNAME>.md
   git commit -m "docs(<yourname>): add technical documentation and AI disclosure"
   git push origin <your-branch>
   ```

---

## Prompt for Sneha (Member 2 — Branch: `sneha`)
*(Copy this prompt along with your files `AuthContext.tsx`, `FarmContext.tsx`, `ProtectedRoute.tsx`, `Layout.tsx`, `Login.tsx`, `Register.tsx`, `FarmSelector.tsx`, `Dashboard.tsx`, and any other files you created/edited.)*

```text
Write complete, clean technical documentation in Markdown for my contribution to "Aadhunik Krishak" (INNEX 2026 Hackathon), formatted to be saved as docs/DOCS_SNEHA.md.

Member: Sneha Magar — Member 2 (Branch: sneha)
Files I built/updated: [paste your files or file list here]

Use these exact 5 sections:
1. Role Overview: Summarize my work on authentication, shared React contexts, protected routing, initial Leaflet farm selector, and the centralized farmer dashboard.
2. Summary of Contributions (File-by-File & Feature-by-Feature):
   - AuthContext.tsx & ProtectedRoute.tsx (Supabase session handling, signup metadata, route guard)
   - FarmContext.tsx (loading user farms, persisting activeFarm in localStorage, refreshFarms)
   - Layout.tsx (responsive sidebar/navbar, active farm display/switcher, navigation)
   - Login.tsx & Register.tsx (auth UI, validation, error handling)
   - FarmSelector.tsx (initial Leaflet map centered on Nepal, GPS geolocation, Street/Satellite layer switcher, area unit conversion, Open-Meteo elevation + agro-zone classification)
   - Dashboard.tsx (farm overview, live weather widget, registered crops summary, upcoming reminders)
   - Only describe features actually present in my attached files.
3. Tools, Libraries & APIs Used:
   - Markdown table with columns: Tool / Service | Purpose in Project | Why Chosen Over Alternatives | Reference
   - Cover React, TypeScript, Tailwind CSS, React Router, Supabase Auth & PostgreSQL, React Context API (vs Redux/Zustand), Leaflet + OpenStreetMap + Esri Tiles (vs Google Maps/Mapbox), Open-Meteo API, and Lucide React.
4. Use of AI:
   - Clearly state whether my modules call any runtime AI API (note that Auth, Contexts, Leaflet Map, and Dashboard use deterministic APIs/logic, not LLMs).
   - Include an INNEX 2026 Hackathon AI Development Disclosure stating how AI coding tools were used for assistance while all code and integrations were reviewed and verified by me.
5. Official References:
   - Numbered list of real official documentation URLs for every tool/API mentioned.
```

---

## Prompt for Priya (Member 3 — Branch: `priya`)
*(Copy this prompt along with your files `LanguageContext.tsx`, `LandIntelligence.tsx`, `Crops.tsx`, `Calendar.tsx`, and any updates you made to `cropEngine.ts`, `weatherService.ts`, or `crop_catalog`.)*

```text
Write complete, clean technical documentation in Markdown for my contribution to "Aadhunik Krishak" (INNEX 2026 Hackathon), formatted to be saved as docs/DOCS_PRIYA.md.

Member: Priya — Member 3 (Branch: priya)
Files I built/updated: [paste your files or file list here]

Use these exact 5 sections:
1. Role Overview: Summarize my work on bilingual English/Nepali support, Land Intelligence UI, Crop Recommendations & Registration UI, Dynamic Crop Catalog integration, and Farming Calendar & Smart Irrigation UI.
2. Summary of Contributions (File-by-File & Feature-by-Feature):
   - LanguageContext.tsx (bilingual EN/NE toggle and domain translators for agro-zones, seasons, soil textures, weather labels)
   - LandIntelligence.tsx (integrating SoilGrids + Open-Meteo weather/DEM, pH & organic carbon agronomic interpretations, texture bar, auto-saving detected soil type/pH)
   - Crops.tsx (dynamic crop catalog loading from Supabase crop_catalog, season/category filters, suitability scoring cards, crop registration modal generating calendar activities)
   - Calendar.tsx (personalized sowing-to-harvest task timeline, task completion toggles, smart irrigation advice via irrigationEngine.ts)
   - Any other files or Supabase table updates I made (only describe what is actually in my files).
3. Tools, Libraries & APIs Used:
   - Markdown table with columns: Tool / Service | Purpose in Project | Why Chosen Over Alternatives | Reference
   - Cover React, TypeScript, Tailwind CSS, Custom LanguageContext (vs i18next), Supabase PostgreSQL, Open-Meteo API, ISRIC SoilGrids API, Lucide React, and deterministic crop/irrigation engines.
4. Use of AI:
   - Clearly distinguish deterministic rule-based agronomic logic and scientific APIs (used in Land Intelligence, Crops, and Calendar) from runtime generative AI.
   - Include an INNEX 2026 Hackathon AI Development Disclosure covering any AI assistance used for Nepali agricultural translations, UI components, or documentation/handoff instructions.
5. Official References:
   - Numbered list of real official documentation URLs for every tool/API mentioned.
```

---

## Prompt for Alisha (Member 4 — Branch: `alisha`)
*(Copy this prompt along with your files `PlantDoctor.tsx`, `Assistant.tsx`, `geminiService.ts`, market price data/feedback files, and `App.tsx` updates.)*

```text
Write complete, clean technical documentation in Markdown for my contribution to "Aadhunik Krishak" (INNEX 2026 Hackathon), formatted to be saved as docs/DOCS_ALISHA.md.

Member: Alisha — Member 4 (Branch: alisha)
Files I built/updated: [paste your files or file list here]

Use these exact 5 sections:
1. Role Overview: Summarize my work on the AI Plant Doctor, Context-Aware AI Farming Assistant, Market Price Insights, feedback/QA integration, and Vercel production readiness.
2. Summary of Contributions (File-by-File & Feature-by-Feature):
   - PlantDoctor.tsx (image upload, Gemini Vision disease diagnosis, severity/confidence/treatment/prevention output, saving scan history to Supabase disease_scans)
   - Assistant.tsx & geminiService.ts (context-aware agricultural chat injecting active farm, agro-zone, soil, weather, and registered crops into Gemini prompts)
   - Market Price Reference / Insights & Feedback features (only describe what is actually in my files)
   - App.tsx routing updates & final integration/Vercel verification.
3. Tools, Libraries & APIs Used:
   - Markdown table with columns: Tool / Service | Purpose in Project | Why Chosen Over Alternatives | Reference
   - Cover Google Gemini API (Vision & Chat — why chosen over training a custom CNN/YOLO disease classifier or custom price-prediction ML model in 48 hours, and why over paid OpenAI APIs), Supabase PostgreSQL (`disease_scans`, `farms`, `crops`), Open-Meteo / Soil context injection (RAG-lite vs vector DB), React + TypeScript + Tailwind CSS, and Vercel.
4. Use of AI (CRITICAL — Be Very Detailed):
   - Explain every place runtime AI is called in my files.
   - Document the exact Gemini model ID(s), API endpoint or SDK used, and temperature/JSON config.
   - Explain BOTH pipelines step by step:
     (a) Plant Doctor: image upload -> base64 -> Gemini Vision -> parsed diagnosis -> disease_scans DB insert
     (b) Farming Assistant: user query + activeFarm + weather + soil + crops context -> Gemini -> bilingual/actionable reply
   - Paste the EXACT verbatim system/user prompt templates sent through the Gemini API in my code.
   - Include an INNEX 2026 Hackathon AI Disclosure (noting advisory disclaimer for farmers and any AI coding assistance used during development).
5. Official References:
   - Numbered list of real official documentation URLs for every tool/API mentioned.
```
```