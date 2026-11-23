# Technical Documentation — Alisha (Member 4)

**Project:** Aadhunik Krishak (INNEX 2026 Hackathon)
**Member:** Alisha — Member 4 (Branch: `alisha`)
**File:** `docs/DOCS_ALISHA.md`

---

## 1. Role Overview

I built the AI-powered and market-intelligence side of Aadhunik Krishak, plus the final integration layer:

- **AI Plant Doctor** — farmer uploads or captures a leaf photo; Google Gemini Vision returns a structured diagnosis (crop, disease/pest/deficiency, severity, confidence, treatment, prevention) in English or Nepali. Each scan is saved to Supabase (`disease_scans`) and shown in a history panel.
- **Context-Aware AI Farming Assistant** — a chat assistant that receives the active farm's live context (location, agro-zone, elevation, soil, weather, registered crops, calendar tasks, recent Plant Doctor scans) inside the Gemini prompt, answers bilingually, and can also create/complete/reopen/reschedule/delete calendar tasks on the farmer's behalf.
- **Market Price Insights** — a Kalimati-based commodity price page with a small in-browser Random Forest forecaster, Open-Meteo weather adjustment, selling-strategy advice, and an "Ask AI Assistant" handoff into the Assistant.
- **Feedback / QA** — in-app feedback form (issue / feature / general) stored in Supabase `feedback`, with history of the user's submissions.
- **Integration** — route wiring in `App.tsx` for `/market-price`, `/plant-doctor`, `/assistant`, `/feedback`, `/admin` (admin-guarded).

> **Note on file names:** my AI code lives in `src/services/plantDoctorService.ts` and `src/services/assistantService.ts` (there is no file called `geminiService.ts`; the Gemini calls are made inside these two service files).

---

## 2. Summary of Contributions (File-by-File & Feature-by-Feature)

### `src/pages/PlantDoctor.tsx`
- Image input via file picker, camera capture input, and drag-and-drop; rejects non-image files.
- Optional crop hint (free text) with registered crops of the active farm loaded from Supabase `crops` (`status = 'active'`) for quick selection.
- Own English/Nepali toggle for the diagnosis output language.
- Calls `analyzePlantImage()`, displays crop name, diagnosis, severity, confidence, treatment and preventive measures.
- Auto-saves each successful scan via `saveDiseaseScan()` and shows a saved / save-failed notice; loads the last 20 scans via `fetchDiseaseScans()`; supports reopening a past scan and deleting one (`deleteDiseaseScan()`).

### `src/services/plantDoctorService.ts`
- `compressImageToBase64()` — downscales the image so the longest side is at most 1024 px, re-encodes as JPEG (quality 0.85) on a `<canvas>`, falls back to raw `FileReader` base64 if canvas/decoding fails.
- `buildPrompt()` — builds the Gemini prompt with farm context, crop hint and language rule (exact text in Section 4).
- `analyzePlantImage()` — calls Gemini `generateContent` with the prompt + inline image, JSON response mode, model fallback chain, 20 s timeout per model.
- `extractJsonObject()` / `normalizeSeverity()` — defensive parsing: strips markdown fences, extracts the first `{…}` block, maps free-text severity (e.g. "severe", "moderate", "none") to `healthy | low | medium | high`.
- `saveDiseaseScan()`, `fetchDiseaseScans()`, `deleteDiseaseScan()` — Supabase CRUD on `disease_scans`, always filtered by `user_id`.

### `src/pages/Assistant.tsx`
- Chat UI with message history (last 8 messages are sent to the model), English/Nepali support, loading and error states.
- On load, fetches farm context through `loadFarmAssistantContext()`.
- Reads `location.state.marketContext` — when the farmer arrives from Market Price via **Ask AI Assistant**, shows a "Market Price Context Active" banner and **auto-sends** a first question about that commodity in the selected language.
- Renders a summary of any calendar actions the AI performed (applied / skipped).

### `src/services/assistantService.ts`
- `loadFarmAssistantContext()` — runs five fetches in parallel with `Promise.allSettled` (weather via `fetchFarmWeather`, soil via `fetchFarmSoil`, active `crops`, 15 nearest `activities`, last 3 `disease_scans`). Any failed source degrades gracefully to `null`/empty instead of breaking the chat.
- `buildFarmContextSummary()` — builds the system prompt (exact text in Section 4).
- `askFarmingAssistant()` — sends the conversation to Gemini with model fallback, 20 s timeout per model, temperature 0.35.
- `parseAssistantResponse()` — extracts an optional fenced ```` ```calendar_actions ```` JSON block from the reply and strips it from the text shown to the user.
- `executeCalendarActions()` — applies the actions to Supabase `activities` (`create`, `complete`, `reopen`, `reschedule`, `delete`), with validation: activity types are normalised to the allowed set, dates must be `YYYY-MM-DD` (else default to tomorrow), `crop_id` must belong to the farm's active crops, every update/delete is scoped by `user_id`, and tasks are matched by `task_id` or title.

### `src/pages/MarketPrice.tsx` + `src/services/marketPriceService.ts`
- Loads a compact Kalimati monthly price dataset from `/data/kalimati_monthly.json`; also supports uploading a full Kalimati CSV (`parseFullKalimatiCsv`); falls back to a built-in baseline of 12 commodities (`buildDefaultDataset`).
- `fetchMarketWeatherContext()` — Open-Meteo **archive** (past ~365 days → monthly temperature/rain normals) and **forecast** (next 14 days). Computes a rule-based `weatherImpactPct` (heavy rain → transport/harvest pressure, dry spell, ±3.5 °C temperature anomaly) with a seasonal-baseline fallback if the API fails.
- `evaluateCommodityPrices()` — per commodity: builds lag-1 / lag-12 / rainfall / temperature features, trains a **24-tree bagged random-forest regressor written from scratch in TypeScript** (80/20 chronological split, MAE reported) when ≥15 samples exist, otherwise falls back to a lag + seasonal-smoothing method. Outputs a 12-month series (base and weather-adjusted price, expected min/max, demand level, advice), peak/lowest month, trend (rising/falling/stable), a 5-month forecast and a text selling strategy. Weather sensitivity differs by commodity (e.g. tomato/cauliflower 1.2, potato/onion/garlic/ginger 0.65, others 0.9).
- "Ask AI Assistant" navigates to `/assistant` with a `MarketPromptContext` (prices, trend, MAE, forecast, weather signal) passed in router state, which `assistantService` injects into the prompt.

### `src/pages/Feedback.tsx`
- Form: category (issue / feature / general), page area, subject, description; inserts into Supabase `feedback` with `user_id` and active `farm_id`; lists the user's previous submissions with status (`open | reviewed | resolved`).

### `src/App.tsx`
- Routes `/market-price`, `/plant-doctor`, `/assistant`, `/feedback` inside the `ProtectedRoute` + `Layout` shell; `/admin` additionally wrapped in `AdminRoute`; wildcard redirects to `/`.

### Vercel production readiness
- The Vite app reads configuration from `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_GEMINI_API_KEY` (see `.env.example`); these must be added in Vercel → Project Settings → Environment Variables.
- *No `vercel.json` or Vercel configuration is included in the source archive I documented from, so I make no claims here about SPA rewrite rules; if deep links (e.g. `/assistant`) 404 on refresh in production, a rewrite to `index.html` is needed.*

---

## 3. Tools, Libraries & APIs Used

| Tool / Service | Purpose in Project | Why Chosen Over Alternatives | Official Reference |
|---|---|---|---|
| **Google Gemini API** (Vision + text, `generateContent` REST) | Plant disease diagnosis from photos; context-aware farming chat; calendar-action generation | A pre-trained multimodal model handles thousands of crop/disease types and Nepali output out of the box. Training a custom CNN/YOLO classifier needs a labelled dataset (e.g. PlantVillage covers few crops, lab-style images) plus training/tuning time that is unrealistic in a 48-hour hackathon. Gemini has a free tier, whereas OpenAI APIs are paid-only. | [1] |
| **Supabase (PostgreSQL + Auth)** — tables `disease_scans`, `farms`, `crops`, `activities`, `feedback` | Persist scan history, read farm/crop/task context, store feedback | Already the project's backend (shared with the team); relational tables, row-level security and a JS client with no custom server | [2] |
| **Context injection ("RAG-lite")** of farm/weather/soil/crops into the prompt | Make Assistant answers hyper-local | Our context is small and structured (one farm), so it is fetched directly with SQL/APIs and pasted into the prompt. A vector database and embeddings would add infrastructure and latency with no benefit at this scale. | [3] |
| **Open-Meteo API** (forecast + archive) | Live weather for Assistant context; 365-day archive and 14-day forecast for market weather adjustment | Free, no API key, open data, covers Nepal coordinates; paid weather APIs need keys and quotas | [4] |
| **ISRIC SoilGrids** (via the team's `soilService.ts`) | Soil pH/texture/nitrogen/organic carbon supplied to the Assistant prompt | Open global soil dataset, no key; I only *consume* `fetchFarmSoil()` | [5] |
| **Kalimati Market price data** (`/public/data/kalimati_monthly.json`, optional CSV upload) | Historical wholesale prices used for forecasting | Real Nepali wholesale market data is the most relevant reference for Nepali farmers | [6] |
| **Custom in-browser Random Forest (TypeScript)** | 12-month and 5-month price forecasting | Runs fully client-side with zero dependencies; no ML server/Python hosting needed, transparent and explainable (MAE shown). A deep-learning price model would be overkill for small monthly series. | — (own implementation; background: [7]) |
| **React + TypeScript + Vite** | SPA UI and typed services | Project standard; type safety for API payloads | [8] [9] |
| **Tailwind CSS** | Styling and responsive layout | Fast utility-first styling, consistent with the rest of the app | [10] |
| **React Router** | Routing; passing `marketContext` via navigation state | Standard React routing | [11] |
| **Lucide React** | Icons | Lightweight, tree-shakeable icon set | [12] |
| **Browser APIs** (`FileReader`, `Canvas`, `AbortController`, `fetch`) | Image compression, base64 encoding, request timeouts | Native, no extra dependencies | [13] |
| **Vercel** | Production hosting of the Vite build | Zero-config Git deploys and env-var management | [14] |

---

## 4. Use of AI

### 4.1 Where runtime AI is called

| # | Location | Purpose | Type |
|---|---|---|---|
| 1 | `plantDoctorService.ts → analyzePlantImage()` | Image → structured disease diagnosis | Gemini **Vision** (multimodal) |
| 2 | `assistantService.ts → askFarmingAssistant()` | Farm-aware chat + optional calendar actions | Gemini **text chat** |

These are the **only** two runtime LLM calls in my files.

### 4.2 Model IDs, endpoint, configuration

- **Endpoint (both):** `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={VITE_GEMINI_API_KEY}` — direct REST `fetch`, no SDK.
- **Model fallback chains (tried in order; on HTTP 404 / 429 / ≥500 / timeout / empty reply the next model is tried):**
  - Plant Doctor: `gemini-3.7-flash` → `gemini-3-flash-preview` → `gemini-3.8-flash` → `gemini-flash-latest` → `gemini-3.5-flash-lite`
  - Assistant: `gemini-3.7-flash` → `gemini-3.5-flash-lite` → `gemini-3-flash-preview` → `gemini-3.8-flash` → `gemini-flash-latest` → `gemma-4-26b-a4b-it`
- **Generation config:**
  - Plant Doctor: `temperature: 0.2`, `responseMimeType: 'application/json'` (low temperature for consistent, structured diagnosis).
  - Assistant: `temperature: 0.35`, free text (no JSON mode — only the optional `calendar_actions` block is JSON).
- **Timeout:** 20 s per model attempt via `AbortController`.
- **Errors:** HTTP 400/403 → "AI service configuration error, check API key" (no retry); all models exhausted → bilingual "AI service is temporarily busy" message. Empty/"thought" parts are filtered out of the reply.
- **Security note:** the key is a `VITE_` variable, so it is bundled into client-side JavaScript and visible to anyone who opens browser dev tools. For a hackathon demo this is acceptable; for real production the Gemini call should be moved behind a server-side proxy (e.g. a Vercel serverless function) and the key restricted/rotated.

### 4.3 Pipeline (a) — Plant Doctor

1. Farmer picks/captures/drops an image in `PlantDoctor.tsx` (must be `image/*`). Optional crop hint is entered or chosen from registered crops.
2. `handleDiagnose()` calls `analyzePlantImage({ file, cropHint, farm: activeFarm, language })`.
3. `compressImageToBase64()` resizes to ≤1024 px, JPEG 0.85, returns raw base64 (no `data:` prefix) + MIME type.
4. `buildPrompt()` assembles the prompt from farm context (name, district, agro-zone, elevation, soil type, pH), crop hint and language rule.
5. Request body = `contents[0].parts = [ {text: prompt}, {inline_data: {mime_type, data: base64}} ]` with the generation config above, sent to the first available model in the chain.
6. Response text is parsed by `extractJsonObject()`; fields `crop_name`, `diagnosis`, `severity`, `confidence`, `treatment`, `preventive_measures` are read with safe defaults; severity is normalised by `normalizeSeverity()`.
7. UI renders the result; if the user is logged in, `saveDiseaseScan()` inserts into `disease_scans` (`user_id`, `farm_id`, `crop_name`, `diagnosis`, `severity`, `confidence`, `treatment`, `preventive_measures`). The image itself is **not** stored — only the text result.
8. History (last 20, newest first) is re-read with `fetchDiseaseScans()`.

**Exact prompt template** (`buildPrompt`, verbatim; `${…}` are runtime values):

```text
You are an expert Nepali agronomist and plant pathologist helping a farmer diagnose a plant problem from a photo.

${farmContext}
Farmer's crop note: ${cropHint?.trim() ? cropHint.trim() : 'Not specified (identify the plant/crop from the image if possible).'}
Language requirement: ${languageInstruction}

Analyze the uploaded photo carefully and respond ONLY with a valid JSON object using this exact schema:
{
  "crop_name": "Detected or confirmed crop name",
  "diagnosis": "Clear name of the disease, pest, nutrient deficiency, or Healthy Plant if no issue is found, plus 1-2 short sentences describing visible symptoms",
  "severity": "healthy | low | medium | high",
  "confidence": "Percentage string like 88%",
  "treatment": "Practical, numbered or bulleted immediate treatment steps suitable for farmers in Nepal (include both organic/home remedies like neem oil/ash/baking soda and common local agro-vet options with safe usage notes). If healthy, give brief care tips. If the image is not a plant leaf/crop, explain clearly and ask for a clear leaf photo.",
  "preventive_measures": "3-4 concise preventive steps to stop recurrence (spacing, drainage, crop rotation, resistant varieties, sanitation)."
}
```

Where `farmContext` is:

```text
Farm context in Nepal:
- Farm name: ${farm.name}
- District: ${farm.district ?? 'Unknown'}
- Agro-zone: ${farm.agro_zone ?? 'Unknown'}
- Elevation: ${farm.elevation_m ? `${farm.elevation_m} m` : 'Unknown'}
- Soil type: ${farm.soil_type ?? 'Unknown'}
- Soil pH: ${farm.soil_ph ?? 'Unknown'}
```
(or `Farm context: General Nepal agriculture.` when no farm is selected), and `languageInstruction` is one of:

```text
# language === 'ne'
Write the text values for "crop_name", "diagnosis", "treatment", and "preventive_measures" in clear, natural Nepali (Devanagari script) using simple farmer-friendly words. Keep the JSON keys and "severity" value ("healthy" | "low" | "medium" | "high") strictly in English.

# language === 'en'
Write all descriptions in clear, simple farmer-friendly English.
```

### 4.4 Pipeline (b) — Farming Assistant

1. `Assistant.tsx` calls `loadFarmAssistantContext(activeFarm, user.id)` → weather (Open-Meteo), soil (SoilGrids with fallback to the farm's saved soil type/pH), active crops, 15 calendar tasks, last 3 disease scans.
2. If the farmer came from Market Price, a `MarketPromptContext` is also present and an auto-question is sent.
3. `askFarmingAssistant()` calls `buildFarmContextSummary()` to create the **system prompt** (below). Gemini REST has no separate system role in this request, so it is sent as the first `user` turn, followed by a canned `model` acknowledgement, then the last 8 chat messages, then the new question:
   - `{role:'user', text: systemPrompt}`
   - `{role:'model', text: 'Understood. I have the live farm and market context and can answer questions or update calendar tasks when requested.'}`
   - `…last 8 history messages…`
   - `{role:'user', text: question}`
4. The reply is split by `parseAssistantResponse()` into display text + optional `calendar_actions` JSON.
5. `executeCalendarActions()` validates and writes changes to Supabase `activities`; results (applied/skipped + reason) are shown beside the message.
6. Language: the prompt's language rule makes the reply English or Nepali (Devanagari) according to the app language (the auto market question uses the language chosen on the Market Price page).

**Exact prompt templates** (`buildFarmContextSummary`, verbatim; `${…}` are runtime values).

*Main template (farm selected):*

```text
You are Aadhunik Krishak AI, an expert Nepali agricultural advisor helping a farmer manage their farm.

LIVE FARM CONTEXT:
- Farm: ${farm.name} (${farm.area_hectares} ha)
- Location: ${farm.district ?? 'Nepal'}, Agro-zone: ${farm.agro_zone ?? 'Unknown'}, Elevation: ${farm.elevation_m ? `${farm.elevation_m} m` : 'Unknown'}
- Soil: ${soilSummary}
- Weather: ${weatherSummary}
- Active Crops: ${cropsSummary}
- Calendar Tasks: ${tasksSummary}
- Recent Plant Doctor Scans: ${scansSummary}

${marketSection}

GUIDELINES:
1. Base your answers directly on the farm's real weather, soil, elevation, crops, tasks, and any selected Kalimati market price context above.
2. Give concise, practical, actionable steps suitable for farming in Nepal (include local agro-vet / organic / market-timing options when helpful).
3. ${languageRule}

${calendarInstructions}
```

*Template when no farm is selected:*

```text
You are Aadhunik Krishak AI, an expert Nepali agricultural advisor.
The user has not selected a specific farm yet, so give helpful Nepal-relevant advice and remind them they can add/select a farm for hyper-local soil, weather, and calendar scheduling.
${marketSection}
${languageRule}

${calendarInstructions}
```

*`languageRule`:*

```text
# ne
Respond in clear, natural Nepali (Devanagari script) using simple farmer-friendly terms.
# en
Respond in clear, practical English with simple farmer-friendly bullet points.
```

*Context sub-templates:*

```text
weatherSummary:
Current: ${weather.currentTempC}°C, ${weather.currentWeatherLabel}, Humidity ${weather.currentHumidity}%, Wind ${weather.currentWindKmh} km/h, Precip ${weather.currentPrecipitationMm} mm.
Next 3 days forecast: ${date}: ${weatherLabel}, ${tempMinC}-${tempMaxC}°C, Rain ${precipitationMm}mm (${precipitationProb}%) | …
(or "Live weather unavailable right now.")

soilSummary:
pH ${soil.ph}, Texture: ${soil.textureClass}, Nitrogen: ${soil.nitrogenGKg} g/kg, Organic Carbon: ${soil.organicCarbonGKg} g/kg (Source: ${soil.source})
(or "Soil type: ${farm.soil_type ?? 'Unknown'}, pH: ${farm.soil_ph ?? 'Unknown'}")

cropsSummary (per crop, joined by "; "):
[crop_id: ${c.id}] ${c.crop_name} (${c.variety}) — planted ${c.sowing_date}, expected harvest ${c.expected_harvest_date}, area ${c.area_hectares} ha
(or "No active registered crops yet.")

tasksSummary (per task, joined by "; "):
[task_id: ${a.id}] ${a.title} (${a.activity_type}, due ${a.due_date}, completed|pending)
(or "No calendar tasks yet.")

scansSummary (per scan, joined by "; "):
${s.crop_name ?? 'Crop'}: ${s.diagnosis} (severity: ${s.severity})
(or "None")
```

*`marketSection` (only when the farmer clicked "Ask AI Assistant" on Market Price):*

```text
SELECTED KALIMATI MARKET PRICE CONTEXT (the farmer clicked "Ask AI Assistant" from Market Price):
- Commodity: ${commodity} (per ${unit})
- Base Model Current Price: रू ${currentPriceNpr}/${unit}
- Weather-Adjusted Current Price: रू ${weatherAdjustedCurrentNpr}/${unit}
- Annual Average Price: रू ${annualAvgNpr}/${unit}
- Price Trend: ${trend} (Model MAE: ± रू ${mae})
- Peak Price Window: ${peakMonth}
- Lowest Price Window: ${lowestMonth}
- Next 5-Month Forecast: ${futureForecast}
- Market Weather Signal: ${weatherSummary || 'Normal seasonal weather'}
Use these exact numbers when advising on selling, storing, harvesting, or planting ${commodity}.
```

*`calendarInstructions`:*

````text
CALENDAR ACTION CAPABILITY:
Today's date is ${today} (tomorrow is ${tomorrow}).
If—and ONLY if—the user explicitly asks to add, schedule, create, complete/mark done, reopen, reschedule/move, or delete farming calendar tasks, append a fenced block AT THE VERY END of your response using this EXACT format:

```calendar_actions
[
  {
    "action": "create | complete | reopen | reschedule | delete",
    "task_id": "existing task id (for complete/reopen/reschedule/delete, or null for create)",
    "crop_id": "matching crop id from Active Crops below, or null",
    "title": "Clear short task title",
    "description": "Optional brief how-to note or null",
    "activity_type": "sowing | irrigation | fertilizer | weeding | pest_check | harvest",
    "due_date": "YYYY-MM-DD"
  }
]
```

Rules for `calendar_actions`:
- Do NOT include ```calendar_actions``` for normal questions unless the user asks to update/schedule/complete tasks on the calendar.
- Always convert relative dates like "today", "tomorrow", "in 3 days", or "next Friday" into exact YYYY-MM-DD dates using Today = ${today}.
- If no farm is selected, politely tell the user to select or add a farm first before saving calendar tasks, and omit `calendar_actions`.
````

### 4.5 Deterministic logic (NOT generative AI)

| Feature | Method |
|---|---|
| Market price forecast | Hand-written 24-tree bagged regression forest (seeded LCG random generator, depth 5, min leaf 2) trained **in the browser** on Kalimati monthly averages; fallback lag/seasonal smoothing. Classical machine learning — not an LLM. |
| Weather impact on price | Fixed threshold rules on Open-Meteo rainfall/temperature vs. monthly normals |
| Demand level / advice text / trend | Rules relative to the annual average (±15 %) and next-month change (±4 %) |
| Output sanitising (severity, activity type, dates, crop id) | Deterministic normalisation functions guarding all LLM output before it is shown or written to the database |
| Weather, soil, DEM data | Open-Meteo / SoilGrids API responses, no model involved |
| Feedback form, scan history, auth-scoped queries | Plain Supabase CRUD |

### 4.6 INNEX 2026 Hackathon AI Disclosure

**Runtime AI in the product:** Google Gemini (Vision and text) is used for plant-photo diagnosis and the farming assistant as described above. Everything else (market forecasting, weather adjustment, data handling) is deterministic code.

**Advisory limitation:** AI outputs (diagnosis, confidence percentage, treatment suggestions, price forecasts) are *advisory only*. A model's "confidence" is a self-reported estimate, not a validated accuracy figure. Pesticide/fungicide recommendations must be checked with a local agro-vet or agricultural extension officer before use, and price forecasts are estimates (the MAE shown reflects the model's historical error, not a guarantee). *Currently the source code does not show a dedicated on-screen disclaimer on the Plant Doctor or Assistant pages; the team should add this wording to the UI before final submission.*

**AI coding assistance:** AI coding assistants were used during development to help draft and refactor parts of the code (for example UI components, TypeScript typing, the prompt wording, Nepali-language strings, and this documentation). I reviewed, integrated and tested the code and the API integrations myself, and am responsible for what is submitted. *[Alisha: please replace/confirm the exact tool names and the extent of assistance before submitting — I cannot determine which tools you used from the source code alone.]*

**Known limitations I am aware of:** diagnosis quality depends on photo quality and on Gemini's general (not Nepal-specific, not lab-validated) knowledge; the assistant can occasionally mis-parse a requested calendar change (mitigated by validation and an applied/skipped result shown to the user); the Gemini API key is client-exposed (see 4.2).

---

## 5. Official References

1. Google Gemini API — `generateContent` and image understanding: https://ai.google.dev/gemini-api/docs/image-understanding and https://ai.google.dev/api/generate-content
2. Supabase documentation (Database, Auth, JS client): https://supabase.com/docs and https://supabase.com/docs/reference/javascript/introduction
3. Retrieval-Augmented Generation (background on context injection): https://ai.google.dev/gemini-api/docs/prompting-strategies
4. Open-Meteo Forecast and Historical Weather APIs: https://open-meteo.com/en/docs and https://open-meteo.com/en/docs/historical-weather-api
5. ISRIC SoilGrids: https://www.isric.org/explore/soilgrids and https://docs.isric.org/globaldata/soilgrids/
6. Kalimati Fruits and Vegetable Market Development Board (Nepal): https://kalimatimarket.gov.np
7. Random forests (Breiman, 2001), *Machine Learning* 45: https://doi.org/10.1023/A:1010933404324
8. React: https://react.dev
9. TypeScript: https://www.typescriptlang.org/docs/ and Vite: https://vite.dev/guide/
10. Tailwind CSS: https://tailwindcss.com/docs
11. React Router: https://reactrouter.com
12. Lucide React: https://lucide.dev/guide/packages/lucide-react
13. MDN — FileReader: https://developer.mozilla.org/docs/Web/API/FileReader · Canvas API: https://developer.mozilla.org/docs/Web/API/Canvas_API · AbortController: https://developer.mozilla.org/docs/Web/API/AbortController
14. Vercel (deploying Vite, environment variables): https://vercel.com/docs/frameworks/vite and https://vercel.com/docs/environment-variables
