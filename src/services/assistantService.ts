import { supabase } from '../lib/supabase';
import { fetchFarmSoil } from './soilService';
import { fetchFarmWeather } from './weatherService';
import type {
  ActivityType,
  DiseaseScan,
  Farm,
  FarmingActivity,
  RegisteredCrop,
  SoilData,
  WeatherData,
} from '../types';

export interface CalendarActionSummary {
  action: 'create' | 'complete' | 'reopen' | 'reschedule' | 'delete';
  title: string;
  dueDate?: string;
  activityType?: ActivityType;
  status: 'applied' | 'skipped';
  note?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  calendarActions?: CalendarActionSummary[];
}

export interface FarmAssistantContext {
  farm: Farm | null;
  weather: WeatherData | null;
  soil: SoilData | null;
  crops: RegisteredCrop[];
  activities: FarmingActivity[];
  recentScans: DiseaseScan[];
}

interface RawCalendarAction {
  action?: string;
  task_id?: string | null;
  crop_id?: string | null;
  title?: string;
  description?: string | null;
  activity_type?: string;
  due_date?: string;
}

export interface AssistantReplyResult {
  reply: string;
  calendarActions: CalendarActionSummary[];
}

const GEMINI_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemma-4-26b-a4b-it',
] as const;

const VALID_ACTIVITY_TYPES: readonly ActivityType[] = [
  'sowing',
  'irrigation',
  'fertilizer',
  'weeding',
  'pest_check',
  'harvest',
];

function getLocalIsoDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeActivityType(
  rawType?: string,
  titleHint?: string
): ActivityType {
  const normalized = String(rawType ?? '')
    .trim()
    .toLowerCase();
  if (VALID_ACTIVITY_TYPES.includes(normalized as ActivityType)) {
    return normalized as ActivityType;
  }

  const text = `${normalized} ${titleHint ?? ''}`.toLowerCase();
  if (text.includes('irrigat') || text.includes('water')) return 'irrigation';
  if (
    text.includes('fertiliz') ||
    text.includes('urea') ||
    text.includes('compost') ||
    text.includes('manure') ||
    text.includes('dap') ||
    text.includes('potash')
  ) {
    return 'fertilizer';
  }
  if (text.includes('sow') || text.includes('plant') || text.includes('seed')) {
    return 'sowing';
  }
  if (text.includes('weed') || text.includes('hoe')) return 'weeding';
  if (text.includes('harvest') || text.includes('pick')) return 'harvest';
  return 'pest_check';
}

function normalizeIsoDate(rawDate?: string): string {
  const trimmed = String(rawDate ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return getLocalIsoDate(1);
}

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
        .order('completed', { ascending: true })
        .order('due_date', { ascending: true })
        .limit(15),
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
  const today = getLocalIsoDate(0);
  const tomorrow = getLocalIsoDate(1);

  const languageRule =
    language === 'ne'
      ? 'Respond in clear, natural Nepali (Devanagari script) using simple farmer-friendly terms.'
      : 'Respond in clear, practical English with simple farmer-friendly bullet points.';

  const calendarInstructions = `CALENDAR ACTION CAPABILITY:
Today's date is ${today} (tomorrow is ${tomorrow}).
If—and ONLY if—the user explicitly asks to add, schedule, create, complete/mark done, reopen, reschedule/move, or delete farming calendar tasks, append a fenced block AT THE VERY END of your response using this EXACT format:

\`\`\`calendar_actions
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
\`\`\`

Rules for \`calendar_actions\`:
- Do NOT include \`\`\`calendar_actions\`\`\` for normal questions unless the user asks to update/schedule/complete tasks on the calendar.
- Always convert relative dates like "today", "tomorrow", "in 3 days", or "next Friday" into exact YYYY-MM-DD dates using Today = ${today}.
- If no farm is selected, politely tell the user to select or add a farm first before saving calendar tasks, and omit \`calendar_actions\`.`;

  if (!context.farm) {
    return `You are Aadhunik Krishak AI, an expert Nepali agricultural advisor.
The user has not selected a specific farm yet, so give helpful Nepal-relevant advice and remind them they can add/select a farm for hyper-local soil, weather, and calendar scheduling.
${languageRule}

${calendarInstructions}`;
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
              `[crop_id: ${c.id}] ${c.crop_name}${c.variety ? ` (${c.variety})` : ''} — planted ${c.sowing_date}, expected harvest ${c.expected_harvest_date}, area ${c.area_hectares} ha`
          )
          .join('; ')
      : 'No active registered crops yet.';

  const tasksSummary =
    activities.length > 0
      ? activities
          .map(
            (a) =>
              `[task_id: ${a.id}] ${a.title} (${a.activity_type}, due ${a.due_date}, ${a.completed ? 'completed' : 'pending'})`
          )
          .join('; ')
      : 'No calendar tasks yet.';

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
- Calendar Tasks: ${tasksSummary}
- Recent Plant Doctor Scans: ${scansSummary}

GUIDELINES:
1. Base your answers directly on the farm's real weather, soil, elevation, crops, and tasks above whenever relevant.
2. Give concise, practical, actionable steps suitable for farming in Nepal (include local agro-vet / organic options when helpful).
3. ${languageRule}

${calendarInstructions}`;
}

function parseAssistantResponse(rawText: string): {
  cleanReply: string;
  rawActions: RawCalendarAction[];
} {
  const blockRegex = /```calendar_actions\s*([\s\S]*?)```/i;
  const match = rawText.match(blockRegex);

  if (!match) {
    return { cleanReply: rawText.trim(), rawActions: [] };
  }

  const cleanReply = rawText.replace(blockRegex, '').trim();
  const jsonText = (match[1] ?? '').trim();

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const rawActions = Array.isArray(parsed)
      ? (parsed as RawCalendarAction[])
      : [];
    return { cleanReply, rawActions };
  } catch (err) {
    console.warn('Could not parse calendar_actions block:', err);
    return { cleanReply, rawActions: [] };
  }
}

function findMatchingTask(
  item: RawCalendarAction,
  activities: FarmingActivity[]
): FarmingActivity | undefined {
  if (item.task_id) {
    const byId = activities.find((a) => a.id === item.task_id);
    if (byId) return byId;
  }
  const searchTitle = String(item.title ?? '')
    .trim()
    .toLowerCase();
  if (!searchTitle) return undefined;

  return activities.find((a) => a.title.toLowerCase().includes(searchTitle));
}

async function executeCalendarActions(params: {
  rawActions: RawCalendarAction[];
  context: FarmAssistantContext;
  userId?: string;
}): Promise<CalendarActionSummary[]> {
  const { rawActions, context, userId } = params;
  if (rawActions.length === 0) return [];

  if (!context.farm || !userId) {
    return rawActions.map((item) => ({
      action: 'create',
      title: String(item.title ?? 'Calendar Task'),
      status: 'skipped',
      note: 'Select a farm and sign in to update the calendar.',
    }));
  }

  const validCropIds = new Set(context.crops.map((c) => c.id));
  const results: CalendarActionSummary[] = [];

  for (const item of rawActions) {
    const actionType = String(item.action ?? '')
      .trim()
      .toLowerCase();

    if (actionType === 'create') {
      const title = String(item.title ?? '').trim() || 'Farm Task';
      const dueDate = normalizeIsoDate(item.due_date);
      const activityType = normalizeActivityType(item.activity_type, title);
      const cropId =
        item.crop_id && validCropIds.has(item.crop_id)
          ? item.crop_id
          : (context.crops[0]?.id ?? null);

      const { error } = await supabase.from('activities').insert({
        crop_id: cropId,
        farm_id: context.farm.id,
        user_id: userId,
        title,
        description: item.description ? String(item.description).trim() : null,
        activity_type: activityType,
        due_date: dueDate,
        completed: false,
        completed_at: null,
      });

      results.push({
        action: 'create',
        title,
        dueDate,
        activityType,
        status: error ? 'skipped' : 'applied',
        note: error
          ? error.message.includes('crop_id')
            ? 'Please register a crop on /crops first so calendar tasks can be linked to it.'
            : error.message
          : undefined,
      });
      continue;
    }

    if (actionType === 'complete' || actionType === 'reopen') {
      const target = findMatchingTask(item, context.activities);
      if (!target) {
        results.push({
          action: actionType,
          title: String(item.title ?? 'Task'),
          status: 'skipped',
          note: 'Could not find a matching task on your calendar.',
        });
        continue;
      }

      const nextCompleted = actionType === 'complete';
      const { error } = await supabase
        .from('activities')
        .update({
          completed: nextCompleted,
          completed_at: nextCompleted ? new Date().toISOString() : null,
        })
        .eq('id', target.id)
        .eq('user_id', userId);

      results.push({
        action: actionType,
        title: target.title,
        dueDate: target.due_date,
        status: error ? 'skipped' : 'applied',
        note: error ? error.message : undefined,
      });
      continue;
    }

    if (actionType === 'reschedule') {
      const target = findMatchingTask(item, context.activities);
      if (!target) {
        results.push({
          action: 'reschedule',
          title: String(item.title ?? 'Task'),
          status: 'skipped',
          note: 'Could not find a matching task to reschedule.',
        });
        continue;
      }

      const newDate = normalizeIsoDate(item.due_date);
      const { error } = await supabase
        .from('activities')
        .update({ due_date: newDate })
        .eq('id', target.id)
        .eq('user_id', userId);

      results.push({
        action: 'reschedule',
        title: target.title,
        dueDate: newDate,
        status: error ? 'skipped' : 'applied',
        note: error ? error.message : undefined,
      });
      continue;
    }

    if (actionType === 'delete') {
      const target = findMatchingTask(item, context.activities);
      if (!target) {
        results.push({
          action: 'delete',
          title: String(item.title ?? 'Task'),
          status: 'skipped',
          note: 'Could not find a matching task to delete.',
        });
        continue;
      }

      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', target.id)
        .eq('user_id', userId);

      results.push({
        action: 'delete',
        title: target.title,
        status: error ? 'skipped' : 'applied',
        note: error ? error.message : undefined,
      });
    }
  }

  return results;
}

export async function askFarmingAssistant(params: {
  question: string;
  history: ChatMessage[];
  context: FarmAssistantContext;
  language: 'en' | 'ne';
  userId?: string;
}): Promise<AssistantReplyResult> {
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
          text: 'Understood. I have the live farm context and can answer questions or update calendar tasks when requested.',
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
            temperature: 0.35,
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

      const { cleanReply, rawActions } = parseAssistantResponse(rawText);
      const calendarActions = await executeCalendarActions({
        rawActions,
        context: params.context,
        userId: params.userId,
      });

      return {
        reply:
          cleanReply ||
          (calendarActions.length > 0
            ? 'Your farming calendar has been updated.'
            : 'Done.'),
        calendarActions,
      };
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