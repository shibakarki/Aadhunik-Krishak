import type { AgroZone, Farm, SoilData } from '../types';

export function classifySoilTexture(
  clay: number,
  sand: number,
  silt: number
): string {
  if (clay >= 35) return 'Clay / Clay Loam';
  if (sand >= 55 && clay < 20) return 'Sandy Loam';
  if (silt >= 50 && clay < 27) return 'Silt Loam';
  if (clay >= 27 && clay < 35) return 'Clay Loam';
  return 'Loam';
}

export function getRegionalSoilFallback(zone: AgroZone = 'Hill'): SoilData {
  if (zone === 'Terai') {
    return {
      ph: 6.5,
      organicCarbonGKg: 14.2,
      nitrogenGKg: 1.4,
      clayPercent: 24,
      sandPercent: 38,
      siltPercent: 38,
      textureClass: 'Alluvial Loam',
      source: 'Regional Fallback',
    };
  }

  if (zone === 'Mountain') {
    return {
      ph: 5.7,
      organicCarbonGKg: 19.5,
      nitrogenGKg: 1.7,
      clayPercent: 16,
      sandPercent: 54,
      siltPercent: 30,
      textureClass: 'Mountain Sandy Loam',
      source: 'Regional Fallback',
    };
  }

  // Default: Hill
  return {
    ph: 5.9,
    organicCarbonGKg: 17.8,
    nitrogenGKg: 1.6,
    clayPercent: 22,
    sandPercent: 42,
    siltPercent: 36,
    textureClass: 'Hill Loam',
    source: 'Regional Fallback',
  };
}

interface SoilGridsLayer {
  name: string;
  depths?: Array<{
    label: string;
    values?: { mean?: number | null };
  }>;
}

export async function fetchFarmSoil(
  latitude: number,
  longitude: number,
  fallbackZone: AgroZone = 'Hill'
): Promise<SoilData> {
  const params = new URLSearchParams({
    lon: longitude.toString(),
    lat: latitude.toString(),
    depth: '0-5cm',
    value: 'mean',
  });

  ['phh2o', 'soc', 'nitrogen', 'clay', 'sand', 'silt'].forEach((prop) =>
    params.append('property', prop)
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://rest.isric.org/soilgrids/v2.0/properties/query?${params.toString()}`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      return getRegionalSoilFallback(fallbackZone);
    }

    const raw = await response.json();
    const layers: SoilGridsLayer[] = raw?.properties?.layers ?? [];

    const getMean = (layerName: string): number | null => {
      const layer = layers.find((l) => l.name === layerName);
      const val = layer?.depths?.[0]?.values?.mean;
      return typeof val === 'number' ? val : null;
    };

    const phRaw = getMean('phh2o');
    const socRaw = getMean('soc');
    const nitrogenRaw = getMean('nitrogen');
    const clayRaw = getMean('clay');
    const sandRaw = getMean('sand');
    const siltRaw = getMean('silt');

    // If SoilGrids returned nulls (common in urban/high-slope tiles), use fallback
    if (
      phRaw === null ||
      clayRaw === null ||
      sandRaw === null ||
      siltRaw === null
    ) {
      return getRegionalSoilFallback(fallbackZone);
    }

    const fallback = getRegionalSoilFallback(fallbackZone);
    const ph = Math.round((phRaw / 10) * 10) / 10;
    const organicCarbonGKg =
      socRaw !== null
        ? Math.round((socRaw / 10) * 10) / 10
        : fallback.organicCarbonGKg;
    const nitrogenGKg =
      nitrogenRaw !== null
        ? Math.round((nitrogenRaw / 100) * 100) / 100
        : fallback.nitrogenGKg;

    const clayPercent = Math.round(clayRaw / 10);
    const sandPercent = Math.round(sandRaw / 10);
    const siltPercent = Math.round(siltRaw / 10);

    return {
      ph,
      organicCarbonGKg,
      nitrogenGKg,
      clayPercent,
      sandPercent,
      siltPercent,
      textureClass: classifySoilTexture(clayPercent, sandPercent, siltPercent),
      source: 'SoilGrids',
    };
  } catch {
    return getRegionalSoilFallback(fallbackZone);
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveFarmSoil(
  farm: Farm,
  fallbackZone: AgroZone = 'Hill'
): Promise<SoilData> {
  if (farm.soil_report && typeof farm.soil_report.ph === 'number') {
    const fallback = getRegionalSoilFallback(farm.agro_zone ?? fallbackZone);
    return {
      ...fallback,
      ...farm.soil_report,
      source: 'Lab Soil Report',
    };
  }

  return fetchFarmSoil(farm.latitude, farm.longitude, fallbackZone);
}

export interface ExtractedSoilReport {
  ph?: number;
  organicCarbonGKg?: number;
  nitrogenGKg?: number;
  phosphorusKgHa?: number;
  potassiumKgHa?: number;
  clayPercent?: number;
  sandPercent?: number;
  siltPercent?: number;
  textureClass?: string;
  labName?: string;
  testDate?: string;
  reportNotes?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      if (!base64) {
        reject(new Error('Could not read file contents.'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });
}

function toFiniteNumber(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const parsed = Number.parseFloat(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export async function extractSoilReportFromFile(
  file: File
): Promise<ExtractedSoilReport> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing VITE_GEMINI_API_KEY in .env. You can still enter your soil test values manually below.'
    );
  }

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];
  const mimeType = file.type || 'image/jpeg';
  if (!allowedTypes.includes(mimeType)) {
    throw new Error('Please upload a JPG, PNG, WebP image, or PDF file.');
  }

  const base64Data = await fileToBase64(file);

  const prompt = `You are an agricultural soil lab assistant for Nepal.
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
- Return ONLY valid JSON.`;

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError = 'Failed to analyze soil report with Gemini.';

  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      lastError = `Gemini API error (${response.status}): ${errBody.slice(0, 180)}`;
      if (response.status === 404) continue;
      throw new Error(lastError);
    }

    const json = await response.json();
    const rawText: string =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    if (!cleaned) {
      throw new Error(
        'Gemini could not read soil values from this file. Please try a clearer photo or enter values manually.'
      );
    }

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    return {
      ph: toFiniteNumber(parsed.ph),
      organicCarbonGKg: toFiniteNumber(parsed.organicCarbonGKg),
      nitrogenGKg: toFiniteNumber(parsed.nitrogenGKg),
      phosphorusKgHa: toFiniteNumber(parsed.phosphorusKgHa),
      potassiumKgHa: toFiniteNumber(parsed.potassiumKgHa),
      clayPercent: toFiniteNumber(parsed.clayPercent),
      sandPercent: toFiniteNumber(parsed.sandPercent),
      siltPercent: toFiniteNumber(parsed.siltPercent),
      textureClass:
        typeof parsed.textureClass === 'string' && parsed.textureClass.trim()
          ? parsed.textureClass.trim()
          : undefined,
      labName:
        typeof parsed.labName === 'string' && parsed.labName.trim()
          ? parsed.labName.trim()
          : undefined,
      testDate:
        typeof parsed.testDate === 'string' && parsed.testDate.trim()
          ? parsed.testDate.trim()
          : undefined,
      reportNotes:
        typeof parsed.reportNotes === 'string' && parsed.reportNotes.trim()
          ? parsed.reportNotes.trim()
          : undefined,
    };
  }

  throw new Error(lastError);
}