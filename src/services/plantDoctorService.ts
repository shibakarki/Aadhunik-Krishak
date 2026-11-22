import { supabase } from '../lib/supabase';
import type { DiseaseScan, Farm } from '../types';

export interface PlantAnalysisInput {
  file: File;
  cropHint?: string;
  farm?: Farm | null;
  language?: 'en' | 'ne';
}

export interface PlantAnalysisResult {
  cropName: string;
  diagnosis: string;
  severity: DiseaseScan['severity'];
  confidence: string;
  treatment: string;
  preventiveMeasures: string;
}

const GEMINI_MODELS = [
  'gemini-3.7-flash',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
] as const;

function normalizeSeverity(value: unknown): DiseaseScan['severity'] {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (
    normalized === 'healthy' ||
    normalized === 'low' ||
    normalized === 'medium' ||
    normalized === 'high'
  ) {
    return normalized;
  }
  if (normalized.includes('severe') || normalized.includes('critical')) {
    return 'high';
  }
  if (normalized.includes('moderate')) {
    return 'medium';
  }
  if (normalized.includes('none') || normalized.includes('no disease')) {
    return 'healthy';
  }
  return 'medium';
}

function extractJsonObject(rawText: string): Record<string, unknown> {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
    }
    throw new Error(
      'AI returned an unexpected response format. Please try again.'
    );
  }
}

async function fileToBase64Raw(
  file: File
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const commaIndex = result.indexOf(',');
      if (commaIndex === -1) {
        reject(new Error('Could not read the selected image file.'));
        return;
      }
      resolve({
        base64: result.slice(commaIndex + 1),
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

async function compressImageToBase64(
  file: File,
  maxDimension = 1024
): Promise<{ base64: string; mimeType: string }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image decode failed'));
      image.src = objectUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return fileToBase64Raw(file);
    }

    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const commaIndex = dataUrl.indexOf(',');
    return {
      base64: dataUrl.slice(commaIndex + 1),
      mimeType: 'image/jpeg',
    };
  } catch {
    return fileToBase64Raw(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function buildPrompt(
  cropHint?: string,
  farm?: Farm | null,
  language: 'en' | 'ne' = 'en'
): string {
  const farmContext = farm
    ? `Farm context in Nepal:
- Farm name: ${farm.name}
- District: ${farm.district ?? 'Unknown'}
- Agro-zone: ${farm.agro_zone ?? 'Unknown'}
- Elevation: ${farm.elevation_m ? `${farm.elevation_m} m` : 'Unknown'}
- Soil type: ${farm.soil_type ?? 'Unknown'}
- Soil pH: ${farm.soil_ph ?? 'Unknown'}`
    : 'Farm context: General Nepal agriculture.';

  const languageInstruction =
    language === 'ne'
      ? 'Write the text values for "crop_name", "diagnosis", "treatment", and "preventive_measures" in clear, natural Nepali (Devanagari script) using simple farmer-friendly words. Keep the JSON keys and "severity" value ("healthy" | "low" | "medium" | "high") strictly in English.'
      : 'Write all descriptions in clear, simple farmer-friendly English.';

  return `You are an expert Nepali agronomist and plant pathologist helping a farmer diagnose a plant problem from a photo.

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
}`;
}

export async function analyzePlantImage({
  file,
  cropHint,
  farm,
  language = 'en',
}: PlantAnalysisInput): Promise<PlantAnalysisResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'your-gemini-api-key') {
    throw new Error(
      language === 'ne'
        ? 'VITE_GEMINI_API_KEY सेट गरिएको छैन। कृपया .env जाँच गर्नुहोस्।'
        : 'Missing VITE_GEMINI_API_KEY in .env. Please add your Gemini API key and restart `npm run dev`.'
    );
  }

  const { base64, mimeType } = await compressImageToBase64(file);
  const prompt = buildPrompt(cropHint, farm, language);

  let hadBusyError = false;

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
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
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
          console.warn(
            `PlantDoctor fallback from ${model} (${response.status})`
          );
          if (response.status === 429 || response.status >= 500) {
            hadBusyError = true;
          }
          continue;
        }
        if (response.status === 400 || response.status === 403) {
          throw new Error(
            language === 'ne'
              ? 'एआई सेवा कन्फिगरेसनमा समस्या देखियो। कृपया API key जाँच गर्नुहोस्।'
              : 'AI service configuration error. Please check your Gemini API key.'
          );
        }
        console.warn(
          `PlantDoctor error ${response.status}:`,
          errorBody.slice(0, 180)
        );
        hadBusyError = true;
        continue;
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
        console.warn(`PlantDoctor empty response from ${model}`);
        continue;
      }

      const parsed = extractJsonObject(rawText);

      return {
        cropName: String(parsed.crop_name ?? cropHint ?? 'Unknown Crop').trim(),
        diagnosis: String(
          parsed.diagnosis ?? 'Could not determine diagnosis.'
        ).trim(),
        severity: normalizeSeverity(parsed.severity),
        confidence: String(parsed.confidence ?? 'N/A').trim(),
        treatment: String(
          parsed.treatment ?? 'Consult a local agro-vet for further inspection.'
        ).trim(),
        preventiveMeasures: String(
          parsed.preventive_measures ??
            'Maintain field hygiene, proper spacing, and balanced watering.'
        ).trim(),
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.warn(`PlantDoctor timeout on ${model}`);
        hadBusyError = true;
        continue;
      }
      throw err;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw new Error(
    language === 'ne'
      ? 'एआई सेवा अहिले व्यस्त छ। कृपया केही सेकेन्ड पर्खेर फेरि प्रयास गर्नुहोस्।'
      : hadBusyError
        ? 'AI diagnosis service is temporarily busy. Please wait a few seconds and try again.'
        : 'Unable to analyze this photo right now. Please try again with a clearer leaf photo.'
  );
}

export async function fetchDiseaseScans(userId: string): Promise<DiseaseScan[]> {
  const { data, error } = await supabase
    .from('disease_scans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (data as DiseaseScan[]) ?? [];
}

export async function saveDiseaseScan(params: {
  userId: string;
  farmId: string | null;
  result: PlantAnalysisResult;
}): Promise<DiseaseScan> {
  const { data, error } = await supabase
    .from('disease_scans')
    .insert({
      user_id: params.userId,
      farm_id: params.farmId,
      crop_name: params.result.cropName || null,
      diagnosis: params.result.diagnosis,
      severity: params.result.severity,
      confidence: params.result.confidence || null,
      treatment: params.result.treatment,
      preventive_measures: params.result.preventiveMeasures || null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as DiseaseScan;
}

export async function deleteDiseaseScan(
  scanId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('disease_scans')
    .delete()
    .eq('id', scanId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}