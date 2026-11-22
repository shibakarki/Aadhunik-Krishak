import { NEPAL_CROPS } from '../data/nepalCrops';
import { supabase } from '../lib/supabase';
import type {
  AgroZone,
  CropRecommendation,
  CropStageTemplate,
  FarmingActivity,
  NepalCrop,
  NepalSeason,
  SoilData,
  WaterRequirement,
  WeatherData,
} from '../types';

interface CropCatalogDbRow {
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
}

let activeCatalogCache: NepalCrop[] | null = null;

export async function loadActiveCropCatalog(): Promise<NepalCrop[]> {
  try {
    const { data, error } = await supabase
      .from('crop_catalog')
      .select('*')
      .order('name', { ascending: true });

    if (error || !data || data.length === 0) {
      return NEPAL_CROPS;
    }

    const mapped: NepalCrop[] = (data as CropCatalogDbRow[]).map((row) => ({
      key: row.key,
      name: row.name,
      nepaliName: row.nepali_name,
      category: row.category,
      agroZones: row.agro_zones ?? [],
      seasons: row.seasons ?? [],
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
    }));

    activeCatalogCache = mapped;
    return mapped;
  } catch {
    return NEPAL_CROPS;
  }
}

export function determineAgroZone(elevationM: number): AgroZone {
  if (elevationM < 500) return 'Terai';
  if (elevationM <= 2000) return 'Hill';
  return 'Mountain';
}

export function getCurrentNepalSeason(date: Date = new Date()): NepalSeason {
  const month = date.getMonth(); // 0 = Jan, 11 = Dec
  if (month >= 5 && month <= 8) return 'Monsoon'; // Jun - Sep
  if (month >= 2 && month <= 4) return 'Spring'; // Mar - May
  return 'Winter'; // Oct - Feb
}

export function getCropByKey(
  cropKey: string,
  crops?: NepalCrop[]
): NepalCrop | undefined {
  const source =
    crops && crops.length > 0 ? crops : (activeCatalogCache ?? NEPAL_CROPS);
  return (
    source.find((c) => c.key === cropKey) ??
    NEPAL_CROPS.find((c) => c.key === cropKey)
  );
}

export function addDaysToDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export function recommendCrops(params: {
  elevationM: number;
  weather?: WeatherData | null;
  soil?: SoilData | null;
  season?: NepalSeason;
  crops?: NepalCrop[];
}): CropRecommendation[] {
  const { elevationM, weather, soil, crops } = params;
  const catalog =
    crops && crops.length > 0 ? crops : (activeCatalogCache ?? NEPAL_CROPS);

  const agroZone = determineAgroZone(elevationM);
  const season = params.season ?? getCurrentNepalSeason();
  const tempC = weather?.currentTempC ?? null;
  const ph = soil?.ph ?? null;

  const recommendations: CropRecommendation[] = catalog.map((crop) => {
    let score = 0;
    const reasons: string[] = [];

    // 1. Agro-zone match (30 pts)
    if (crop.agroZones.includes(agroZone)) {
      score += 30;
      reasons.push(`Well suited for ${agroZone} agro-ecological zone`);
    }

    // 2. Elevation range (20 pts)
    if (elevationM >= crop.minElevationM && elevationM <= crop.maxElevationM) {
      score += 20;
      reasons.push(
        `Elevation (${Math.round(elevationM)}m) is within optimal range`
      );
    } else if (
      elevationM >= crop.minElevationM - 250 &&
      elevationM <= crop.maxElevationM + 250
    ) {
      score += 10;
    }

    // 3. Seasonal match (20 pts)
    if (crop.seasons.includes(season)) {
      score += 20;
      reasons.push(`Matches current ${season} planting season`);
    }

    // 4. Temperature match (15 pts)
    if (tempC !== null) {
      if (tempC >= crop.minTempC && tempC <= crop.maxTempC) {
        score += 15;
        reasons.push(
          `Current temperature (${tempC}°C) supports healthy growth`
        );
      } else if (tempC >= crop.minTempC - 4 && tempC <= crop.maxTempC + 4) {
        score += 8;
      }
    } else {
      score += 10;
    }

    // 5. Soil pH match (15 pts)
    if (ph !== null) {
      if (ph >= crop.idealPhMin && ph <= crop.idealPhMax) {
        score += 15;
        reasons.push(
          `Soil pH (${ph}) aligns with ideal ${crop.idealPhMin}–${crop.idealPhMax}`
        );
      } else if (ph >= crop.idealPhMin - 0.6 && ph <= crop.idealPhMax + 0.6) {
        score += 8;
      }
    } else {
      score += 10;
    }

    let suitability: CropRecommendation['suitability'] = 'Moderate';
    if (score >= 75) suitability = 'Highly Suitable';
    else if (score >= 55) suitability = 'Suitable';

    return {
      crop,
      score,
      suitability,
      reasons:
        reasons.length > 0
          ? reasons
          : ['Possible with careful soil & water management'],
    };
  });

  return recommendations.sort((a, b) => b.score - a.score);
}

export function generateCropActivities(params: {
  cropKey: string;
  cropId: string;
  farmId: string;
  userId: string;
  sowingDate: string;
  crop?: NepalCrop;
  crops?: NepalCrop[];
}): Array<Omit<FarmingActivity, 'id' | 'created_at'>> {
  const crop = params.crop ?? getCropByKey(params.cropKey, params.crops);
  if (!crop) return [];

  return crop.stages.map((stage) => ({
    crop_id: params.cropId,
    farm_id: params.farmId,
    user_id: params.userId,
    title: `${crop.name}: ${stage.title}`,
    description: stage.description,
    activity_type: stage.activity_type,
    due_date: addDaysToDate(params.sowingDate, stage.dayOffset),
    completed: false,
    completed_at: null,
  }));
}