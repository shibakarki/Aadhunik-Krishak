import { NEPAL_CROPS } from '../data/nepalCrops';
import { supabase } from '../lib/supabase';
import type {
  ActivityType,
  AgroZone,
  CropStageTemplate,
  Farm,
  NepalCrop,
  NepalSeason,
  Profile,
  RegisteredCrop,
  WaterRequirement,
} from '../types';

const GEMINI_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'gemini-flash-latest',
] as const;

const VALID_CATEGORIES: readonly NepalCrop['category'][] = [
  'Cereal',
  'Vegetable',
  'Pulse',
  'Oilseed',
  'Cash Crop',
];

const VALID_ZONES: readonly AgroZone[] = ['Terai', 'Hill', 'Mountain'];
const VALID_SEASONS: readonly NepalSeason[] = ['Monsoon', 'Winter', 'Spring'];
const VALID_WATER: readonly WaterRequirement[] = ['low', 'medium', 'high'];
const VALID_ACTIVITY_TYPES: readonly ActivityType[] = [
  'sowing',
  'irrigation',
  'fertilizer',
  'weeding',
  'pest_check',
  'harvest',
];

export interface CropCatalogRow {
  key: string;
  name: string;
  nepali_name: string;
  category: NepalCrop['category'];
  agro_zones: AgroZone[];
  seasons: NepalSeason[];
  min_elevation_m: number;
  max_elevation_m: number;
  min_temp_c: number;
  max_temp_c: number;
  ideal_ph_min: number;
  ideal_ph_max: number;
  water_requirement: WaterRequirement;
  growth_days: number;
  fertilizer_guide: string;
  varieties: string[];
  stages: CropStageTemplate[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminFeedbackItem {
  id: string;
  user_id: string;
  farm_id: string | null;
  category: 'issue' | 'feature' | 'general';
  page_area: string | null;
  subject: string;
  description: string;
  status: 'open' | 'reviewed' | 'resolved';
  created_at: string;
}

export interface AdminOverviewData {
  profiles: Profile[];
  farms: Farm[];
  crops: RegisteredCrop[];
  feedback: AdminFeedbackItem[];
}

export function makeCropKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function rowToNepalCrop(row: CropCatalogRow): NepalCrop {
  return {
    key: row.key,
    name: row.name,
    nepaliName: row.nepali_name,
    category: row.category,
    agroZones: row.agro_zones,
    seasons: row.seasons,
    minElevationM: Number(row.min_elevation_m),
    maxElevationM: Number(row.max_elevation_m),
    minTempC: Number(row.min_temp_c),
    maxTempC: Number(row.max_temp_c),
    idealPhMin: Number(row.ideal_ph_min),
    idealPhMax: Number(row.ideal_ph_max),
    waterRequirement: row.water_requirement,
    growthDays: Number(row.growth_days),
    fertilizerGuide: row.fertilizer_guide,
    varieties: row.varieties ?? [],
    stages: Array.isArray(row.stages) ? row.stages : [],
  };
}

function nepalCropToRow(crop: NepalCrop, userId?: string | null) {
  return {
    key: makeCropKey(crop.key || crop.name),
    name: crop.name.trim(),
    nepali_name: crop.nepaliName.trim(),
    category: crop.category,
    agro_zones: crop.agroZones,
    seasons: crop.seasons,
    min_elevation_m: Math.round(crop.minElevationM),
    max_elevation_m: Math.round(crop.maxElevationM),
    min_temp_c: Number(crop.minTempC),
    max_temp_c: Number(crop.maxTempC),
    ideal_ph_min: Number(crop.idealPhMin),
    ideal_ph_max: Number(crop.idealPhMax),
    water_requirement: crop.waterRequirement,
    growth_days: Math.round(crop.growthDays),
    fertilizer_guide: crop.fertilizerGuide.trim(),
    varieties: crop.varieties,
    stages: crop.stages,
    created_by: userId ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchCropCatalog(): Promise<NepalCrop[]> {
  const { data, error } = await supabase
    .from('crop_catalog')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as CropCatalogRow[]) ?? []).map(rowToNepalCrop);
}

export async function upsertCropCatalogItem(
  crop: NepalCrop,
  userId?: string | null
): Promise<void> {
  const row = nepalCropToRow(crop, userId);
  const { error } = await supabase
    .from('crop_catalog')
    .upsert(row, { onConflict: 'key' });

  if (error) {
    throw new Error(error.message);
  }
}

export async function seedDefaultNepalCrops(
  userId?: string | null
): Promise<number> {
  const rows = NEPAL_CROPS.map((crop) => nepalCropToRow(crop, userId));
  const { error } = await supabase
    .from('crop_catalog')
    .upsert(rows, { onConflict: 'key' });

  if (error) {
    throw new Error(error.message);
  }
  return rows.length;
}

export async function deleteCropCatalogItem(cropKey: string): Promise<void> {
  const { error } = await supabase
    .from('crop_catalog')
    .delete()
    .eq('key', cropKey);

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchAdminOverview(): Promise<AdminOverviewData> {
  const [profilesRes, farmsRes, cropsRes, feedbackRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('farms')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('crops')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false }),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (farmsRes.error) throw new Error(farmsRes.error.message);
  if (cropsRes.error) throw new Error(cropsRes.error.message);

  return {
    profiles: (profilesRes.data as Profile[]) ?? [],
    farms: (farmsRes.data as Farm[]) ?? [],
    crops: (cropsRes.data as RegisteredCrop[]) ?? [],
    feedback: feedbackRes.error
      ? []
      : ((feedbackRes.data as AdminFeedbackItem[]) ?? []),
  };
}

export async function updateFeedbackStatus(
  id: string,
  status: AdminFeedbackItem['status']
): Promise<void> {
  const { error } = await supabase
    .from('feedback')
    .update({ status })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

function extractJsonObject(rawText: string): Record<string, unknown> {
  const stripped = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  const jsonSlice =
    firstBrace !== -1 && lastBrace !== -1
      ? stripped.slice(firstBrace, lastBrace + 1)
      : stripped;

  return JSON.parse(jsonSlice) as Record<string, unknown>;
}

function sanitizeNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export async function evaluateCropWithGemini(params: {
  name: string;
  nepaliName?: string;
  category?: NepalCrop['category'];
  varietiesHint?: string;
  notes?: string;
}): Promise<NepalCrop> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'your-gemini-api-key') {
    throw new Error(
      'Missing VITE_GEMINI_API_KEY in .env. Please add your Gemini API key.'
    );
  }

  const prompt = `You are a senior Nepalese agronomist building a structured crop database for Nepal (Terai, Hill, Mountain zones).
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
- Every stage's activity_type MUST be one of: sowing, irrigation, fertilizer, weeding, pest_check, harvest.`;

  let lastError = 'Gemini AI is temporarily unavailable. Please try again.';

  for (const model of GEMINI_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (
          response.status === 404 ||
          response.status === 429 ||
          response.status >= 500
        ) {
          lastError = `Model ${model} unavailable (${response.status}).`;
          continue;
        }
        throw new Error(
          `Gemini API error (${response.status}): ${errorBody.slice(0, 180)}`
        );
      }

      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string; thought?: boolean }> };
        }>;
      };

      const rawText =
        payload.candidates?.[0]?.content?.parts
          ?.filter((part) => !part.thought)
          .map((part) => part.text ?? '')
          .join('')
          .trim() ?? '';

      if (!rawText) {
        lastError = `Model ${model} returned an empty response.`;
        continue;
      }

      const parsed = extractJsonObject(rawText);

      const categoryRaw = String(parsed.category ?? params.category ?? 'Vegetable');
      const category = VALID_CATEGORIES.includes(
        categoryRaw as NepalCrop['category']
      )
        ? (categoryRaw as NepalCrop['category'])
        : 'Vegetable';

      const agroZonesRaw = Array.isArray(parsed.agroZones)
        ? parsed.agroZones.filter((z): z is AgroZone =>
            VALID_ZONES.includes(z as AgroZone)
          )
        : [];

      const seasonsRaw = Array.isArray(parsed.seasons)
        ? parsed.seasons.filter((s): s is NepalSeason =>
            VALID_SEASONS.includes(s as NepalSeason)
          )
        : [];

      const waterRaw = String(parsed.waterRequirement ?? 'medium').toLowerCase();
      const waterRequirement = VALID_WATER.includes(
        waterRaw as WaterRequirement
      )
        ? (waterRaw as WaterRequirement)
        : 'medium';

      const growthDays = Math.max(
        15,
        Math.round(sanitizeNumber(parsed.growthDays, 90))
      );

      const stagesRaw = Array.isArray(parsed.stages) ? parsed.stages : [];
      const stages: CropStageTemplate[] = stagesRaw
        .map((item) => {
          const obj = item as Record<string, unknown>;
          const typeRaw = String(obj.activity_type ?? 'irrigation').toLowerCase();
          const activity_type = VALID_ACTIVITY_TYPES.includes(
            typeRaw as ActivityType
          )
            ? (typeRaw as ActivityType)
            : 'irrigation';

          return {
            dayOffset: Math.max(
              0,
              Math.round(sanitizeNumber(obj.dayOffset, 0))
            ),
            title: String(obj.title ?? 'Crop Stage').trim(),
            description: String(obj.description ?? '').trim(),
            activity_type,
          };
        })
        .sort((a, b) => a.dayOffset - b.dayOffset);

      const varieties = Array.isArray(parsed.varieties)
        ? parsed.varieties.map((v) => String(v).trim()).filter(Boolean)
        : [];

      const name = String(parsed.name ?? params.name).trim();

      return {
        key: makeCropKey(String(parsed.key ?? name)),
        name,
        nepaliName: String(
          parsed.nepaliName ?? params.nepaliName ?? name
        ).trim(),
        category,
        agroZones: agroZonesRaw.length > 0 ? agroZonesRaw : ['Hill'],
        seasons: seasonsRaw.length > 0 ? seasonsRaw : ['Spring'],
        minElevationM: Math.max(
          0,
          Math.round(sanitizeNumber(parsed.minElevationM, 100))
        ),
        maxElevationM: Math.max(
          100,
          Math.round(sanitizeNumber(parsed.maxElevationM, 2000))
        ),
        minTempC: sanitizeNumber(parsed.minTempC, 15),
        maxTempC: sanitizeNumber(parsed.maxTempC, 30),
        idealPhMin: sanitizeNumber(parsed.idealPhMin, 5.5),
        idealPhMax: sanitizeNumber(parsed.idealPhMax, 7.0),
        waterRequirement,
        growthDays,
        fertilizerGuide: String(
          parsed.fertilizerGuide ??
            'Apply well-rotted FYM/compost at sowing and balanced NPK as needed.'
        ).trim(),
        varieties,
        stages,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = `Model ${model} timed out.`;
        continue;
      }
      if (err instanceof SyntaxError) {
        lastError = `Model ${model} returned invalid JSON, trying fallback...`;
        continue;
      }
      throw err;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw new Error(lastError);
}