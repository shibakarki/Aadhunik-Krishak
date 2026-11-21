import { NEPAL_CROPS } from '../data/nepalCrops';
import type {
  AgroZone,
  CropRecommendation,
  FarmingActivity,
  NepalCrop,
  NepalSeason,
  SoilData,
  WeatherData,
} from '../types';

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

export function getCropByKey(cropKey: string): NepalCrop | undefined {
  return NEPAL_CROPS.find((c) => c.key === cropKey);
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
}): CropRecommendation[] {
  const { elevationM, weather, soil } = params;
  const agroZone = determineAgroZone(elevationM);
  const season = params.season ?? getCurrentNepalSeason();
  const tempC = weather?.currentTempC ?? null;
  const ph = soil?.ph ?? null;

  const recommendations: CropRecommendation[] = NEPAL_CROPS.map((crop) => {
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
      reasons.push(`Elevation (${Math.round(elevationM)}m) is within optimal range`);
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
        reasons.push(`Current temperature (${tempC}°C) supports healthy growth`);
      } else if (tempC >= crop.minTempC - 4 && tempC <= crop.maxTempC + 4) {
        score += 8;
      }
    } else {
      score += 10; // neutral baseline if weather unavailable
    }

    // 5. Soil pH match (15 pts)
    if (ph !== null) {
      if (ph >= crop.idealPhMin && ph <= crop.idealPhMax) {
        score += 15;
        reasons.push(`Soil pH (${ph}) aligns with ideal ${crop.idealPhMin}–${crop.idealPhMax}`);
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
      reasons: reasons.length > 0 ? reasons : ['Possible with careful soil & water management'],
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
}): Array<Omit<FarmingActivity, 'id' | 'created_at'>> {
  const crop = getCropByKey(params.cropKey);
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