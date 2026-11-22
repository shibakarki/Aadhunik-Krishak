export interface MonthlyWeatherStat {
  month: number;
  avgTempC: number;
  totalRainMm: number;
}

export interface MarketWeatherContext {
  locationLabel: string;
  source: 'Open-Meteo Live + Archive' | 'Nepal Seasonal Baseline';
  pastAnnualAvgTempC: number;
  pastAnnualRainMm: number;
  currentMonthBaselineTempC: number;
  currentMonthBaselineRainMm: number;
  upcoming14dAvgTempC: number;
  upcoming14dRainMm: number;
  rainRatioVsNormal: number;
  tempDeltaC: number;
  weatherImpactPct: number;
  weatherSummary: string;
  monthlyNormals: MonthlyWeatherStat[];
}

export interface CommoditySummary {
  name: string;
  unit: string;
  monthsCount: number;
  recordsCount: number;
  latestPriceNpr: number;
}

export interface MonthlyMarketPoint {
  month: number;
  monthShort: string;
  monthFull: string;
  nepaliMonth: string;
  basePriceNpr: number;
  weatherAdjustedPriceNpr: number;
  minExpectedNpr: number;
  maxExpectedNpr: number;
  changePctFromPrev: number;
  demandLevel: 'High' | 'Moderate' | 'Low';
  advice: string;
}

export interface FutureForecastPoint {
  year: number;
  month: number;
  label: string;
  basePredictedNpr: number;
  weatherAdjustedNpr: number;
  mae: number;
  market: string;
}

export interface CommodityEvaluationResult {
  commodity: string;
  unit: string;
  source:
    | 'Kalimati Repo Dataset'
    | 'Uploaded Kalimati CSV'
    | 'Kalimati Default Baseline';
  trainingMethod: string;
  monthsTrained: number;
  recordsUsed: number;
  mae: number;
  currentPriceNpr: number;
  weatherAdjustedCurrentNpr: number;
  annualAvgNpr: number;
  peakMonth: MonthlyMarketPoint;
  lowestMonth: MonthlyMarketPoint;
  trend: 'rising' | 'falling' | 'stable';
  sellingStrategy: string;
  monthlySeries: MonthlyMarketPoint[];
  futureForecast: FutureForecastPoint[];
}

export interface ParsedKalimatiDataset {
  commodities: CommoditySummary[];
  monthlyPricesByCommodity: Map<string, Map<string, number[]>>;
  unitByCommodity: Map<string, string>;
  recordsCountByCommodity: Map<string, number>;
  totalRowsMatched: number;
}

export interface CompactKalimatiJson {
  totalRowsMatched: number;
  commodities: Array<{
    name: string;
    unit: string;
    recordsCount: number;
    monthly: Record<string, number>;
  }>;
}

const MONTH_META = [
  { month: 1, short: 'Jan', full: 'January', ne: 'Poush / Magh' },
  { month: 2, short: 'Feb', full: 'February', ne: 'Magh / Falgun' },
  { month: 3, short: 'Mar', full: 'March', ne: 'Falgun / Chaitra' },
  { month: 4, short: 'Apr', full: 'April', ne: 'Chaitra / Baisakh' },
  { month: 5, short: 'May', full: 'May', ne: 'Baisakh / Jestha' },
  { month: 6, short: 'Jun', full: 'June', ne: 'Jestha / Ashadh' },
  { month: 7, short: 'Jul', full: 'July', ne: 'Ashadh / Shrawan' },
  { month: 8, short: 'Aug', full: 'August', ne: 'Shrawan / Bhadra' },
  { month: 9, short: 'Sep', full: 'September', ne: 'Bhadra / Ashwin' },
  { month: 10, short: 'Oct', full: 'October', ne: 'Ashwin / Kartik' },
  { month: 11, short: 'Nov', full: 'November', ne: 'Kartik / Mangsir' },
  { month: 12, short: 'Dec', full: 'December', ne: 'Mangsir / Poush' },
] as const;

const DEFAULT_MONTHLY_WEATHER: MonthlyWeatherStat[] = [
  { month: 1, avgTempC: 10.5, totalRainMm: 14 },
  { month: 2, avgTempC: 13.0, totalRainMm: 18 },
  { month: 3, avgTempC: 16.8, totalRainMm: 34 },
  { month: 4, avgTempC: 20.1, totalRainMm: 60 },
  { month: 5, avgTempC: 22.3, totalRainMm: 120 },
  { month: 6, avgTempC: 24.0, totalRainMm: 260 },
  { month: 7, avgTempC: 24.2, totalRainMm: 370 },
  { month: 8, avgTempC: 24.1, totalRainMm: 330 },
  { month: 9, avgTempC: 22.8, totalRainMm: 195 },
  { month: 10, avgTempC: 19.4, totalRainMm: 55 },
  { month: 11, avgTempC: 14.9, totalRainMm: 10 },
  { month: 12, avgTempC: 11.4, totalRainMm: 12 },
];

const DEFAULT_COMMODITIES_SERIES: Record<string, { unit: string; monthly: number[] }> = {
  'Tomato Big(Nepali)': { unit: 'Kg', monthly: [54, 48, 46, 50, 58, 74, 90, 96, 88, 80, 68, 56] },
  'Tomato Small(Local)': { unit: 'Kg', monthly: [46, 40, 38, 42, 50, 66, 82, 88, 80, 72, 60, 48] },
  'Potato Red': { unit: 'Kg', monthly: [38, 34, 33, 36, 40, 44, 49, 53, 56, 58, 52, 43] },
  'Potato White': { unit: 'Kg', monthly: [32, 29, 28, 31, 35, 39, 43, 47, 50, 52, 46, 37] },
  'Onion Dry (Indian)': { unit: 'Kg', monthly: [64, 56, 48, 44, 47, 54, 62, 70, 79, 86, 82, 71] },
  'Cauli Local': { unit: 'Kg', monthly: [42, 36, 38, 49, 64, 78, 86, 82, 74, 62, 50, 44] },
  'Cabbage(Local)': { unit: 'Kg', monthly: [28, 25, 24, 29, 36, 45, 52, 54, 49, 43, 35, 30] },
  'Carrot(Local)': { unit: 'Kg', monthly: [48, 42, 40, 46, 58, 72, 82, 85, 78, 68, 56, 50] },
  'Green Peas': { unit: 'Kg', monthly: [75, 65, 68, 85, 110, 130, 145, 140, 125, 110, 95, 82] },
  Ginger: { unit: 'Kg', monthly: [95, 92, 96, 105, 118, 128, 135, 130, 122, 112, 102, 96] },
  'Garlic Dry Nepali': { unit: 'Kg', monthly: [165, 155, 145, 140, 148, 160, 175, 185, 195, 205, 190, 175] },
  Banana: { unit: 'Dozen', monthly: [110, 110, 115, 120, 125, 120, 115, 115, 120, 125, 120, 112] },
};

function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function fetchMarketWeatherContext(params?: {
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
}): Promise<MarketWeatherContext> {
  const lat = params?.latitude ?? 27.7;
  const lon = params?.longitude ?? 85.3;
  const locationLabel = params?.locationLabel ?? 'Kalimati / Kathmandu Supply Basin';

  const now = new Date();
  const archiveEnd = new Date(now);
  archiveEnd.setDate(archiveEnd.getDate() - 5);
  const archiveStart = new Date(archiveEnd);
  archiveStart.setDate(archiveStart.getDate() - 365);

  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${formatIsoDate(archiveStart)}&end_date=${formatIsoDate(archiveEnd)}&daily=temperature_2m_mean,precipitation_sum&timezone=auto`;
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=14&timezone=auto`;

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    const [archiveRes, forecastRes] = await Promise.allSettled([
      fetch(archiveUrl, { signal: controller.signal }),
      fetch(forecastUrl, { signal: controller.signal }),
    ]);
    window.clearTimeout(timeout);

    const monthlyTemps = Array.from({ length: 12 }, () => [] as number[]);
    const monthlyRains = Array.from({ length: 12 }, () => [] as number[]);

    if (archiveRes.status === 'fulfilled' && archiveRes.value.ok) {
      const archiveJson = (await archiveRes.value.json()) as {
        daily?: { time?: string[]; temperature_2m_mean?: Array<number | null>; precipitation_sum?: Array<number | null> };
      };
      const times = archiveJson.daily?.time ?? [];
      const temps = archiveJson.daily?.temperature_2m_mean ?? [];
      const rains = archiveJson.daily?.precipitation_sum ?? [];
      for (let i = 0; i < times.length; i += 1) {
        const monthPart = Number(times[i]?.slice(5, 7));
        if (monthPart >= 1 && monthPart <= 12) {
          const t = temps[i];
          const r = rains[i];
          if (typeof t === 'number' && Number.isFinite(t)) monthlyTemps[monthPart - 1].push(t);
          if (typeof r === 'number' && Number.isFinite(r)) monthlyRains[monthPart - 1].push(r);
        }
      }
    }

    const monthlyNormals: MonthlyWeatherStat[] = DEFAULT_MONTHLY_WEATHER.map((def, idx) => {
      const tArr = monthlyTemps[idx];
      const rArr = monthlyRains[idx];
      return {
        month: def.month,
        avgTempC: tArr.length > 0 ? Number((tArr.reduce((s, v) => s + v, 0) / tArr.length).toFixed(1)) : def.avgTempC,
        totalRainMm: rArr.length > 0 ? Number(rArr.reduce((s, v) => s + v, 0).toFixed(1)) : def.totalRainMm,
      };
    });

    let upcoming14dAvgTempC = monthlyNormals[now.getMonth()].avgTempC;
    let upcoming14dRainMm = Number((monthlyNormals[now.getMonth()].totalRainMm * 0.45).toFixed(1));
    let hasLiveForecast = false;

    if (forecastRes.status === 'fulfilled' && forecastRes.value.ok) {
      const forecastJson = (await forecastRes.value.json()) as {
        daily?: { temperature_2m_max?: Array<number | null>; temperature_2m_min?: Array<number | null>; precipitation_sum?: Array<number | null> };
      };
      const tmax = forecastJson.daily?.temperature_2m_max ?? [];
      const tmin = forecastJson.daily?.temperature_2m_min ?? [];
      const rain = forecastJson.daily?.precipitation_sum ?? [];
      const midTemps: number[] = [];

      for (let i = 0; i < Math.min(tmax.length, tmin.length); i += 1) {
        const hi = tmax[i];
        const lo = tmin[i];
        if (typeof hi === 'number' && typeof lo === 'number') midTemps.push((hi + lo) / 2);
      }
      if (midTemps.length > 0) {
        upcoming14dAvgTempC = Number((midTemps.reduce((s, v) => s + v, 0) / midTemps.length).toFixed(1));
        hasLiveForecast = true;
      }
      const validRain = rain.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      if (validRain.length > 0) {
        upcoming14dRainMm = Number(validRain.reduce((s, v) => s + v, 0).toFixed(1));
        hasLiveForecast = true;
      }
    }

    const currentNorm = monthlyNormals[now.getMonth()];
    const expected14dRain = Math.max(8, currentNorm.totalRainMm * 0.46);
    const rainRatioVsNormal = Number((upcoming14dRainMm / expected14dRain).toFixed(2));
    const tempDeltaC = Number((upcoming14dAvgTempC - currentNorm.avgTempC).toFixed(1));

    let impactPct = 0;
    const reasons: string[] = [];
    if (rainRatioVsNormal >= 1.5 || upcoming14dRainMm >= 95) {
      impactPct += 7.5;
      reasons.push('heavy upcoming rainfall may slow hill-to-market transport and harvest');
    } else if (rainRatioVsNormal >= 1.15) {
      impactPct += 3.5;
      reasons.push('above-normal rain adds mild harvest & logistics pressure');
    } else if (rainRatioVsNormal <= 0.4 && currentNorm.totalRainMm > 40) {
      impactPct += 2.5;
      reasons.push('dry spell could tighten irrigated vegetable yields');
    } else {
      impactPct -= 1.5;
      reasons.push('steady rainfall supports normal harvest arrivals');
    }

    if (Math.abs(tempDeltaC) >= 3.5) {
      impactPct += 3.0;
      reasons.push(tempDeltaC > 0 ? 'warmer-than-normal temperatures accelerate spoilage' : 'cold snap can delay crop maturity');
    }

    const pastAnnualAvgTempC = Number((monthlyNormals.reduce((s, m) => s + m.avgTempC, 0) / monthlyNormals.length).toFixed(1));
    const pastAnnualRainMm = Number(monthlyNormals.reduce((s, m) => s + m.totalRainMm, 0).toFixed(0));

    return {
      locationLabel,
      source: hasLiveForecast ? 'Open-Meteo Live + Archive' : 'Nepal Seasonal Baseline',
      pastAnnualAvgTempC,
      pastAnnualRainMm,
      currentMonthBaselineTempC: currentNorm.avgTempC,
      currentMonthBaselineRainMm: currentNorm.totalRainMm,
      upcoming14dAvgTempC,
      upcoming14dRainMm,
      rainRatioVsNormal,
      tempDeltaC,
      weatherImpactPct: Number(impactPct.toFixed(1)),
      weatherSummary: reasons.length > 0 ? `${reasons[0].charAt(0).toUpperCase()}${reasons[0].slice(1)}.` : 'Normal seasonal weather conditions expected.',
      monthlyNormals,
    };
  } catch {
    const currentNorm = DEFAULT_MONTHLY_WEATHER[now.getMonth()];
    return {
      locationLabel,
      source: 'Nepal Seasonal Baseline',
      pastAnnualAvgTempC: 18.7,
      pastAnnualRainMm: 1488,
      currentMonthBaselineTempC: currentNorm.avgTempC,
      currentMonthBaselineRainMm: currentNorm.totalRainMm,
      upcoming14dAvgTempC: currentNorm.avgTempC,
      upcoming14dRainMm: Number((currentNorm.totalRainMm * 0.45).toFixed(1)),
      rainRatioVsNormal: 1,
      tempDeltaC: 0,
      weatherImpactPct: 0,
      weatherSummary: 'Using Nepal seasonal climate baseline.',
      monthlyNormals: DEFAULT_MONTHLY_WEATHER,
    };
  }
}

export function buildDefaultDataset(): ParsedKalimatiDataset {
  const monthlyPricesByCommodity = new Map<string, Map<string, number[]>>();
  const unitByCommodity = new Map<string, string>();
  const recordsCountByCommodity = new Map<string, number>();
  const commodities: CommoditySummary[] = [];
  const years = [2024, 2025, 2026];

  for (const [name, info] of Object.entries(DEFAULT_COMMODITIES_SERIES)) {
    const ymMap = new Map<string, number[]>();
    years.forEach((yr, yIdx) => {
      const inflationFactor = 1 + yIdx * 0.04;
      info.monthly.forEach((baseVal, mIdx) => {
        ymMap.set(`${yr}-${String(mIdx + 1).padStart(2, '0')}`, [Number((baseVal * inflationFactor).toFixed(2))]);
      });
    });
    monthlyPricesByCommodity.set(name, ymMap);
    unitByCommodity.set(name, info.unit);
    recordsCountByCommodity.set(name, years.length * 12);
    commodities.push({
      name,
      unit: info.unit,
      monthsCount: years.length * 12,
      recordsCount: years.length * 12,
      latestPriceNpr: info.monthly[new Date().getMonth()],
    });
  }

  return {
    commodities,
    monthlyPricesByCommodity,
    unitByCommodity,
    recordsCountByCommodity,
    totalRowsMatched: commodities.length * 36,
  };
}

export function parseKalimatiMonthlyJson(data: CompactKalimatiJson): ParsedKalimatiDataset {
  const monthlyPricesByCommodity = new Map<string, Map<string, number[]>>();
  const unitByCommodity = new Map<string, string>();
  const recordsCountByCommodity = new Map<string, number>();
  const commodities: CommoditySummary[] = [];

  for (const item of data.commodities) {
    const ymMap = new Map<string, number[]>();
    const entries = Object.entries(item.monthly).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [ym, avgPrice] of entries) {
      ymMap.set(ym, [avgPrice]);
    }
    const latestPrice = entries.length > 0 ? entries[entries.length - 1][1] : 0;
    monthlyPricesByCommodity.set(item.name, ymMap);
    unitByCommodity.set(item.name, item.unit);
    recordsCountByCommodity.set(item.name, item.recordsCount);
    commodities.push({
      name: item.name,
      unit: item.unit,
      monthsCount: ymMap.size,
      recordsCount: item.recordsCount,
      latestPriceNpr: Number(latestPrice.toFixed(2)),
    });
  }

  return {
    commodities,
    monthlyPricesByCommodity,
    unitByCommodity,
    recordsCountByCommodity,
    totalRowsMatched: data.totalRowsMatched,
  };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else current += ch;
  }
  result.push(current.trim());
  return result;
}

function fastExtractYearMonth(rawDate: string): string | null {
  const trimmed = rawDate.trim();
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(trimmed);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    if (y >= 2000 && y <= 2035 && m >= 1 && m <= 12) return `${y}-${String(m).padStart(2, '0')}`;
  }
  const slashMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(trimmed);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    const y = Number(slashMatch[3]);
    const m = a <= 12 ? a : b;
    if (y >= 2000 && y <= 2035 && m >= 1 && m <= 12) return `${y}-${String(m).padStart(2, '0')}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

export function parseFullKalimatiCsv(csvText: string): ParsedKalimatiDataset {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) throw new Error('The uploaded CSV file is empty.');

  const headers = splitCsvLine(lines[0].trim()).map((h) => h.toLowerCase());
  const commodityIdx = headers.findIndex((h) => h.includes('commodity'));
  const dateIdx = headers.findIndex((h) => h === 'date' || h.includes('date'));
  const unitIdx = headers.findIndex((h) => h === 'unit' || h.includes('unit'));
  const avgIdx = headers.findIndex((h) => h === 'average' || h.includes('avg') || h.includes('price'));

  if (commodityIdx === -1 || dateIdx === -1 || avgIdx === -1) {
    throw new Error('CSV must contain Commodity, Date, and Average columns.');
  }

  const monthlyPricesByCommodity = new Map<string, Map<string, number[]>>();
  const unitByCommodity = new Map<string, string>();
  const recordsCountByCommodity = new Map<string, number>();
  const latestPriceByCommodity = new Map<string, { ym: string; price: number }>();
  let totalRowsMatched = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;
    const cols = splitCsvLine(line);
    const commodity = (cols[commodityIdx] ?? '').replace(/^"|"$/g, '').trim();
    if (!commodity) continue;
    const price = Number(cols[avgIdx]);
    if (!Number.isFinite(price) || price <= 0) continue;
    const ym = fastExtractYearMonth(cols[dateIdx] ?? '');
    if (!ym) continue;

    const unit = unitIdx !== -1 ? (cols[unitIdx] ?? '').replace(/^"|"$/g, '').trim() || 'Kg' : 'Kg';
    let ymMap = monthlyPricesByCommodity.get(commodity);
    if (!ymMap) {
      ymMap = new Map<string, number[]>();
      monthlyPricesByCommodity.set(commodity, ymMap);
      unitByCommodity.set(commodity, unit);
    }
    let arr = ymMap.get(ym);
    if (!arr) {
      arr = [];
      ymMap.set(ym, arr);
    }
    arr.push(price);
    recordsCountByCommodity.set(commodity, (recordsCountByCommodity.get(commodity) ?? 0) + 1);

    const prevLatest = latestPriceByCommodity.get(commodity);
    if (!prevLatest || ym >= prevLatest.ym) latestPriceByCommodity.set(commodity, { ym, price });
    totalRowsMatched += 1;
  }

  if (totalRowsMatched === 0) throw new Error('No valid price rows were found in the CSV file.');

  const commodities: CommoditySummary[] = Array.from(monthlyPricesByCommodity.entries())
    .map(([name, ymMap]) => ({
      name,
      unit: unitByCommodity.get(name) ?? 'Kg',
      monthsCount: ymMap.size,
      recordsCount: recordsCountByCommodity.get(name) ?? ymMap.size,
      latestPriceNpr: Number((latestPriceByCommodity.get(name)?.price ?? 0).toFixed(2)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { commodities, monthlyPricesByCommodity, unitByCommodity, recordsCountByCommodity, totalRowsMatched };
}

interface TrainingSample {
  features: [number, number, number, number, number, number];
  target: number;
}

interface TreeNode {
  leafValue?: number;
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

function buildRegressionTree(
  samples: TrainingSample[],
  depth: number,
  maxDepth: number,
  minLeafSize: number,
  rngSeed: { state: number }
): TreeNode {
  const n = samples.length;
  const mean = samples.reduce((sum, s) => sum + s.target, 0) / Math.max(1, n);
  if (depth >= maxDepth || n <= minLeafSize) return { leafValue: mean };

  let variance = 0;
  for (let i = 0; i < n; i += 1) {
    const diff = samples[i].target - mean;
    variance += diff * diff;
  }
  if (variance / n < 0.01) return { leafValue: mean };

  const featureIndices = [0, 1, 2, 3, 4, 5];
  for (let i = featureIndices.length - 1; i > 0; i -= 1) {
    rngSeed.state = (rngSeed.state * 1664525 + 1013904223) >>> 0;
    const j = rngSeed.state % (i + 1);
    const tmp = featureIndices[i];
    featureIndices[i] = featureIndices[j];
    featureIndices[j] = tmp;
  }

  let bestScore = Infinity;
  let bestFeature = -1;
  let bestThreshold = 0;

  for (const fIdx of featureIndices.slice(0, 4)) {
    const values = samples.map((s) => s.features[fIdx]).sort((a, b) => a - b);
    const step = Math.max(1, Math.floor(values.length / 8));
    for (let i = step; i < values.length - 1; i += step) {
      const thresh = (values[i] + values[i + 1]) / 2;
      let leftSum = 0;
      let leftCount = 0;
      let rightSum = 0;
      let rightCount = 0;
      for (let k = 0; k < n; k += 1) {
        if (samples[k].features[fIdx] <= thresh) {
          leftSum += samples[k].target;
          leftCount += 1;
        } else {
          rightSum += samples[k].target;
          rightCount += 1;
        }
      }
      if (leftCount === 0 || rightCount === 0) continue;
      const leftMean = leftSum / leftCount;
      const rightMean = rightSum / rightCount;
      let sse = 0;
      for (let k = 0; k < n; k += 1) {
        const pred = samples[k].features[fIdx] <= thresh ? leftMean : rightMean;
        const err = samples[k].target - pred;
        sse += err * err;
      }
      if (sse < bestScore) {
        bestScore = sse;
        bestFeature = fIdx;
        bestThreshold = thresh;
      }
    }
  }

  if (bestFeature === -1) return { leafValue: mean };
  const leftSamples = samples.filter((s) => s.features[bestFeature] <= bestThreshold);
  const rightSamples = samples.filter((s) => s.features[bestFeature] > bestThreshold);
  if (leftSamples.length === 0 || rightSamples.length === 0) return { leafValue: mean };

  return {
    featureIndex: bestFeature,
    threshold: bestThreshold,
    left: buildRegressionTree(leftSamples, depth + 1, maxDepth, minLeafSize, rngSeed),
    right: buildRegressionTree(rightSamples, depth + 1, maxDepth, minLeafSize, rngSeed),
  };
}

function predictTree(node: TreeNode, features: [number, number, number, number, number, number]): number {
  if (node.leafValue !== undefined) return node.leafValue;
  const fIdx = node.featureIndex ?? 0;
  const thresh = node.threshold ?? 0;
  if (features[fIdx] <= thresh) return node.left ? predictTree(node.left, features) : 0;
  return node.right ? predictTree(node.right, features) : 0;
}

function trainBaggedForest(trainSamples: TrainingSample[], numTrees = 24): (features: [number, number, number, number, number, number]) => number {
  const rngSeed = { state: 42 };
  const trees: TreeNode[] = [];
  for (let t = 0; t < numTrees; t += 1) {
    const bootstrap: TrainingSample[] = [];
    for (let i = 0; i < trainSamples.length; i += 1) {
      rngSeed.state = (rngSeed.state * 1664525 + 1013904223) >>> 0;
      bootstrap.push(trainSamples[rngSeed.state % trainSamples.length]);
    }
    trees.push(buildRegressionTree(bootstrap, 0, 5, 2, rngSeed));
  }
  return (features) => trees.reduce((acc, tree) => acc + predictTree(tree, features), 0) / trees.length;
}

function getWeatherSensitivityFactor(commodityName: string): number {
  const lower = commodityName.toLowerCase();
  if (
    lower.includes('tomato') || lower.includes('cauli') || lower.includes('spinach') ||
    lower.includes('saag') || lower.includes('coriander') || lower.includes('cucumber') ||
    lower.includes('beans') || lower.includes('chilli')
  ) return 1.2;
  if (lower.includes('potato') || lower.includes('onion') || lower.includes('garlic') || lower.includes('ginger')) return 0.65;
  return 0.9;
}

export function evaluateCommodityPrices(params: {
  commodity: string;
  dataset: ParsedKalimatiDataset;
  source: CommodityEvaluationResult['source'];
  weather: MarketWeatherContext;
}): CommodityEvaluationResult {
  const { commodity, dataset, source, weather } = params;
  const ymMap = dataset.monthlyPricesByCommodity.get(commodity);
  const unit = dataset.unitByCommodity.get(commodity) ?? 'Kg';
  const recordsUsed = dataset.recordsCountByCommodity.get(commodity) ?? 0;

  const monthlySeriesRaw = Array.from(ymMap?.entries() ?? [])
    .map(([ym, prices]) => {
      const [yStr, mStr] = ym.split('-');
      return { ym, year: Number(yStr), month: Number(mStr), avg: prices.reduce((s, p) => s + p, 0) / prices.length };
    })
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

  const byCalendarMonth = new Map<number, number[]>();
  monthlySeriesRaw.forEach((row) => {
    const arr = byCalendarMonth.get(row.month) ?? [];
    arr.push(row.avg);
    byCalendarMonth.set(row.month, arr);
  });

  const overallAvg = monthlySeriesRaw.length > 0 ? monthlySeriesRaw.reduce((s, r) => s + r.avg, 0) / monthlySeriesRaw.length : 50;
  const seasonalMeanByMonth = Array.from({ length: 12 }, (_, idx) => {
    const vals = byCalendarMonth.get(idx + 1) ?? [];
    return vals.length === 0 ? overallAvg : vals.reduce((s, v) => s + v, 0) / vals.length;
  });

  const samples: TrainingSample[] = [];
  for (let i = 1; i < monthlySeriesRaw.length; i += 1) {
    const row = monthlySeriesRaw[i];
    const prev = monthlySeriesRaw[i - 1];
    const lag12Row = monthlySeriesRaw.find((r) => r.year === row.year - 1 && r.month === row.month);
    const lag12 = lag12Row ? lag12Row.avg : seasonalMeanByMonth[row.month - 1];
    const wNorm = weather.monthlyNormals[row.month - 1] ?? DEFAULT_MONTHLY_WEATHER[0];
    samples.push({ features: [row.year, row.month, prev.avg, lag12, wNorm.totalRainMm, wNorm.avgTempC], target: row.avg });
  }

  let mae = Math.max(2, overallAvg * 0.11);
  let trainingMethod = 'Seasonal Historical Baseline';
  let predictFn: (f: [number, number, number, number, number, number]) => number = (f) => 0.45 * f[2] + 0.55 * f[3];

  if (samples.length >= 15) {
    const split = Math.max(10, Math.floor(samples.length * 0.8));
    const trainedForest = trainBaggedForest(samples.slice(0, split), 24);
    predictFn = trainedForest;
    trainingMethod = '24-Tree Random Forest (80/20 Chronological Split)';
    const testSet = samples.slice(split);
    if (testSet.length > 0) {
      const absErrSum = testSet.reduce((sum, s) => sum + Math.abs(s.target - trainedForest(s.features)), 0);
      mae = Number((absErrSum / testSet.length).toFixed(2));
    }
  } else if (samples.length >= 4) {
    const errors = samples.map((s) => Math.abs(s.target - (0.5 * s.features[2] + 0.5 * s.features[3])));
    mae = Number((errors.reduce((a, b) => a + b, 0) / errors.length).toFixed(2));
    trainingMethod = 'Lag-1 + Seasonal Smoothing (Short History)';
  }

  const sensitivity = getWeatherSensitivityFactor(commodity);
  const currentMonthIdx = new Date().getMonth();
  const currentWeatherMultiplier = 1 + (weather.weatherImpactPct * sensitivity) / 100;
  const lastYear = monthlySeriesRaw[monthlySeriesRaw.length - 1]?.year ?? new Date().getFullYear();
  let rollingLag1 = monthlySeriesRaw[monthlySeriesRaw.length - 1]?.avg ?? overallAvg;

  const raw12MonthPrices = MONTH_META.map((meta, idx) => {
    const seasonal = seasonalMeanByMonth[idx];
    const wNorm = weather.monthlyNormals[idx] ?? DEFAULT_MONTHLY_WEATHER[idx];
    const modelPred = predictFn([lastYear, meta.month, rollingLag1, seasonal, wNorm.totalRainMm, wNorm.avgTempC]);
    const blended = Math.max(5, 0.55 * modelPred + 0.45 * seasonal);
    rollingLag1 = blended;
    return blended;
  });

  const annualAvgNpr = Number((raw12MonthPrices.reduce((s, p) => s + p, 0) / raw12MonthPrices.length).toFixed(2));

  const monthlySeries: MonthlyMarketPoint[] = MONTH_META.map((meta, idx) => {
    const basePrice = Number(raw12MonthPrices[idx].toFixed(2));
    const prevBase = raw12MonthPrices[(idx + 11) % 12];
    const changePct = prevBase > 0 ? ((basePrice - prevBase) / prevBase) * 100 : 0;
    const isNearTerm = idx === currentMonthIdx || idx === (currentMonthIdx + 1) % 12;
    const monthWeatherMultiplier = isNearTerm
      ? currentWeatherMultiplier
      : 1 + ((weather.monthlyNormals[idx].totalRainMm > 220 ? 3.5 : 0) * sensitivity) / 100;

    const weatherAdjustedPrice = Number((basePrice * monthWeatherMultiplier).toFixed(2));
    let demandLevel: MonthlyMarketPoint['demandLevel'] = 'Moderate';
    let advice = 'Sell steadily and track weekly Kalimati arrivals.';
    if (basePrice >= annualAvgNpr * 1.15) {
      demandLevel = 'High';
      advice = 'Peak seasonal price window — prioritize harvest & direct sales.';
    } else if (basePrice <= annualAvgNpr * 0.85) {
      demandLevel = 'Low';
      advice = 'High supply period — stagger harvest, grade well, or hold if storable.';
    }

    const spread = Math.max(3, Math.round(mae * 0.85));
    return {
      month: meta.month,
      monthShort: meta.short,
      monthFull: meta.full,
      nepaliMonth: meta.ne,
      basePriceNpr: basePrice,
      weatherAdjustedPriceNpr: weatherAdjustedPrice,
      minExpectedNpr: Math.max(4, Math.round(weatherAdjustedPrice - spread)),
      maxExpectedNpr: Math.round(weatherAdjustedPrice + spread),
      changePctFromPrev: Number(changePct.toFixed(1)),
      demandLevel,
      advice,
    };
  });

  const sortedByPrice = [...monthlySeries].sort((a, b) => b.weatherAdjustedPriceNpr - a.weatherAdjustedPriceNpr);
  const peakMonth = sortedByPrice[0];
  const lowestMonth = sortedByPrice[sortedByPrice.length - 1];
  const currentPoint = monthlySeries[currentMonthIdx];
  const nextPoint = monthlySeries[(currentMonthIdx + 1) % 12];

  let trend: CommodityEvaluationResult['trend'] = 'stable';
  if (nextPoint.weatherAdjustedPriceNpr > currentPoint.weatherAdjustedPriceNpr * 1.04) trend = 'rising';
  else if (nextPoint.weatherAdjustedPriceNpr < currentPoint.weatherAdjustedPriceNpr * 0.96) trend = 'falling';

  const nowDate = new Date();
  let forwardLag1 = monthlySeriesRaw[monthlySeriesRaw.length - 1]?.avg ?? currentPoint.basePriceNpr;

  const futureForecast: FutureForecastPoint[] = Array.from({ length: 5 }, (_, offset) => {
    const targetDate = new Date(nowDate.getFullYear(), nowDate.getMonth() + offset + 1, 1);
    const yr = targetDate.getFullYear();
    const mo = targetDate.getMonth() + 1;
    const seasonal = seasonalMeanByMonth[mo - 1];
    const wNorm = weather.monthlyNormals[mo - 1] ?? DEFAULT_MONTHLY_WEATHER[0];
    const rainFeature = offset === 0 ? weather.upcoming14dRainMm * 2.1 : wNorm.totalRainMm;
    const tempFeature = offset === 0 ? weather.upcoming14dAvgTempC : wNorm.avgTempC;
    const basePred = Math.max(5, Number(predictFn([yr, mo, forwardLag1, seasonal, rainFeature, tempFeature]).toFixed(2)));
    forwardLag1 = basePred;
    const mult = offset === 0 ? currentWeatherMultiplier : 1 + (weather.weatherImpactPct * 0.4 * sensitivity) / 100;
    const mMeta = MONTH_META[mo - 1];
    return {
      year: yr,
      month: mo,
      label: `${mMeta.short} ${yr}`,
      basePredictedNpr: basePred,
      weatherAdjustedNpr: Number((basePred * mult).toFixed(2)),
      mae,
      market: source === 'Kalimati Default Baseline' ? 'Kalimati Baseline' : 'Kalimati CSV (Trained)',
    };
  });

  const sellingStrategy = `${commodity} typically peaks in ${peakMonth.monthFull} (${peakMonth.nepaliMonth}, ~रू ${peakMonth.weatherAdjustedPriceNpr.toFixed(0)}/${unit}) and dips in ${lowestMonth.monthFull} (~रू ${lowestMonth.weatherAdjustedPriceNpr.toFixed(0)}/${unit}). ${weather.weatherSummary}`;

  return {
    commodity,
    unit,
    source,
    trainingMethod,
    monthsTrained: monthlySeriesRaw.length,
    recordsUsed,
    mae,
    currentPriceNpr: currentPoint.basePriceNpr,
    weatherAdjustedCurrentNpr: currentPoint.weatherAdjustedPriceNpr,
    annualAvgNpr,
    peakMonth,
    lowestMonth,
    trend,
    sellingStrategy,
    monthlySeries,
    futureForecast,
  };
}