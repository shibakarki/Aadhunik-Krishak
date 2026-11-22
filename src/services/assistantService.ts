import { supabase } from '../lib/supabase';
import { fetchFarmSoil } from './soilService';
import { fetchFarmWeather } from './weatherService';
import type {
  DiseaseScan,
  Farm,
  FarmingActivity,
  RegisteredCrop,
  SoilData,
  WeatherData,
} from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface FarmAssistantContext {
  farm: Farm | null;
  weather: WeatherData | null;
  soil: SoilData | null;
  crops: RegisteredCrop[];
  activities: FarmingActivity[];
  recentScans: DiseaseScan[];
}

const GEMINI_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemma-4-26b-a4b-it',
] as const;

export async function loadFarmAssistantContext(
  farm: Farm | null,
  userId?: string
): Promise<FarmAssistantContext> {
  if (!farm) {
    return {
      farm: null,
      weather: null,
      soil: null,
      crops: [],
      activities: [],
      recentScans: [],
    };
  }

  const [weatherRes, soilRes, cropsRes, activitiesRes, scansRes] =
    await Promise.allSettled([
      fetchFarmWeather(farm.latitude, farm.longitude),
      fetchFarmSoil(farm.latitude, farm.longitude, farm.agro_zone ?? 'Hill'),
      supabase
        .from('crops')
        .select('*')
        .eq('farm_id', farm.id)
        .eq('status', 'active')
        .order('sowing_date', { ascending: false }),
      supabase
        .from('activities')
        .select('*')
        .eq('farm_id', farm.id)
        .eq('completed', false)
        .order('due_date', { ascending: true })
        .limit(8),
      userId
        ? supabase
            .from('disease_scans')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(3)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const weather = weatherRes.status === 'fulfilled' ? weatherRes.value : null;
  const soil = soilRes.status === 'fulfilled' ? soilRes.value : null;

  const crops =
    cropsRes.status === 'fulfilled' && !cropsRes.value.error
      ? ((cropsRes.value.data as RegisteredCrop[]) ?? [])
      : [];

  const activities =
    activitiesRes.status === 'fulfilled' && !activitiesRes.value.error
      ? ((activitiesRes.value.data as FarmingActivity[]) ?? [])
      : [];

  const recentScans =
    scansRes.status === 'fulfilled' && !scansRes.value.error
      ? ((scansRes.value.data as DiseaseScan[]) ?? [])
      : [];

  return {
    farm,
    weather,
    soil,
    crops,
    activities,
    recentScans,
  };
}

function buildFarmContextSummary(
  context: FarmAssistantContext,
  language: 'en' | 'ne'
): string {
  const languageRule =
    language === 'ne'
      ? 'Respond in clear, natural Nepali (Devanagari script) using simple farmer-friendly terms.'
      : 'Respond in clear, practical English with simple farmer-friendly bullet points.';

  if (!context.farm) {
    return `You are Aadhunik Krishak AI, an expert Nepali agricultural advisor.
The user has not selected a specific farm yet, so give helpful Nepal-relevant advice and remind them they can add/select a farm for hyper-local soil and weather recommendations.
${languageRule}`;
  }

  const { farm, weather, soil, crops, activities, recentScans } = context;

  const weatherSummary = weather
    ? `Current: ${weather.currentTempC}°C, ${weather.currentWeatherLabel}, Humidity ${weather.currentHumidity}%, Wind ${weather.currentWindKmh} km/h, Precip ${weather.currentPrecipitationMm} mm.
Next 3 days forecast: ${weather.daily
        .slice(0, 3)
        .map(
          (d) =>
            `${d.date}: ${d.weatherLabel}, ${d.tempMinC}-${d.tempMaxC}°C, Rain ${d.precipitationMm}mm (${d.precipitationProb}%)`
        )
        .join(' | ')}`
    : 'Live weather unavailable right now.';

  const soilSummary = soil
    ? `pH ${soil.ph}, Texture: ${soil.textureClass}, Nitrogen: ${soil.nitrogenGKg} g/kg, Organic Carbon: ${soil.organicCarbonGKg} g/kg (Source: ${soil.source})`
    : `Soil type: ${farm.soil_type ?? 'Unknown'}, pH: ${farm.soil_ph ?? 'Unknown'}`;

  const cropsSummary =
    crops.length > 0
      ? crops
          .map(
            (c) =>
              `${c.crop_name}${c.variety ? ` (${c.variety})` : ''} — planted ${c.sowing_date}, expected harvest ${c.expected_harvest_date}, area ${c.area_hectares} ha`
          )
          .join('; ')
      : 'No active registered crops yet.';

  const tasksSummary =
    activities.length > 0
      ? activities
          .map((a) => `${a.title} (${a.activity_type}, due ${a.due_date})`)
          .join('; ')
      : 'No pending calendar tasks.';

  const scansSummary =
    recentScans.length > 0
      ? recentScans
          .map(
            (s) =>
              `${s.crop_name ?? 'Crop'}: ${s.diagnosis} (severity: ${s.severity})`
          )
          .join('; ')
      : 'None';

  return `You are Aadhunik Krishak AI, an expert Nepali agricultural advisor helping a farmer manage their farm.

LIVE FARM CONTEXT:
- Farm: ${farm.name} (${farm.area_hectares} ha)
- Location: ${farm.district ?? 'Nepal'}, Agro-zone: ${farm.agro_zone ?? 'Unknown'}, Elevation: ${farm.elevation_m ? `${farm.elevation_m} m` : 'Unknown'}
- Soil: ${soilSummary}
- Weather: ${weatherSummary}
- Active Crops: ${cropsSummary}
- Upcoming Tasks: ${tasksSummary}
- Recent Plant Doctor Scans: ${scansSummary}

GUIDELINES:
1. Base your answers directly on the farm's real weather, soil, elevation, crops, and tasks above whenever relevant.
2. Give concise, practical, actionable steps suitable for farming in Nepal (include local agro-vet / organic options when helpful).
3. ${languageRule}`;
}

export async function askFarmingAssistant(params: {
  question: string;
  history: ChatMessage[];
  context: FarmAssistantContext;
  language: 'en' | 'ne';
}): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'your-gemini-api-key') {
    throw new Error(
      'Missing VITE_GEMINI_API_KEY in .env. Please add your Gemini API key and restart `npm run dev`.'
    );
  }

  const systemPrompt = buildFarmContextSummary(params.context, params.language);
  const recentHistory = params.history.slice(-8);

  const contents = [
    {
      role: 'user',
      parts: [{ text: systemPrompt }],
    },
    {
      role: 'model',
      parts: [
        {
          text: 'Understood. I have the live farm context and will provide tailored Nepali agricultural advice.',
        },
      ],
    },
    ...recentHistory.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })),
    {
      role: 'user',
      parts: [{ text: params.question }],
    },
  ];

  let lastError = 'AI Assistant is temporarily busy. Please try again.';

  for (const model of GEMINI_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.4,
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
        if (response.status === 400 || response.status === 403) {
          throw new Error(
            `Gemini API error (${response.status}). Check VITE_GEMINI_API_KEY. Details: ${errorBody.slice(0, 180)}`
          );
        }
        throw new Error(
          `Gemini request failed (${response.status}): ${errorBody.slice(0, 180)}`
        );
      }

      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string; thought?: boolean }> };
        }>;
      };

      const reply =
        payload.candidates?.[0]?.content?.parts
          ?.filter((part) => !part.thought)
          .map((part) => part.text ?? '')
          .join('')
          .trim() ?? '';

      if (!reply) {
        lastError = `Model ${model} returned an empty response.`;
        continue;
      }

      return reply;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = `Model ${model} timed out.`;
        continue;
      }
      throw err;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw new Error(lastError);
}