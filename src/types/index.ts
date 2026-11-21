export type AgroZone = 'Terai' | 'Hill' | 'Mountain';
export type NepalSeason = 'Monsoon' | 'Winter' | 'Spring';
export type WaterRequirement = 'low' | 'medium' | 'high';
export type ActivityType =
  | 'sowing'
  | 'irrigation'
  | 'fertilizer'
  | 'weeding'
  | 'pest_check'
  | 'harvest';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  district: string | null;
  preferred_language: string;
  created_at: string;
}

export interface Farm {
  id: string;
  user_id: string;
  name: string;
  district: string | null;
  latitude: number;
  longitude: number;
  area_hectares: number;
  elevation_m: number | null;
  agro_zone: AgroZone | null;
  soil_type: string | null;
  soil_ph: number | null;
  created_at: string;
}

export interface RegisteredCrop {
  id: string;
  farm_id: string;
  user_id: string;
  crop_key: string;
  crop_name: string;
  variety: string | null;
  sowing_date: string;
  expected_harvest_date: string;
  area_hectares: number;
  status: 'active' | 'harvested' | 'cancelled';
  created_at: string;
}

export interface FarmingActivity {
  id: string;
  crop_id: string;
  farm_id: string;
  user_id: string;
  title: string;
  description: string | null;
  activity_type: ActivityType;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface DiseaseScan {
  id: string;
  farm_id: string | null;
  user_id: string;
  crop_name: string | null;
  diagnosis: string;
  severity: 'low' | 'medium' | 'high' | 'healthy';
  confidence: string | null;
  treatment: string;
  preventive_measures: string | null;
  created_at: string;
}

export interface CropStageTemplate {
  dayOffset: number;
  title: string;
  description: string;
  activity_type: ActivityType;
}

export interface NepalCrop {
  key: string;
  name: string;
  nepaliName: string;
  category: 'Cereal' | 'Vegetable' | 'Pulse' | 'Oilseed' | 'Cash Crop';
  agroZones: AgroZone[];
  seasons: NepalSeason[];
  minElevationM: number;
  maxElevationM: number;
  minTempC: number;
  maxTempC: number;
  idealPhMin: number;
  idealPhMax: number;
  waterRequirement: WaterRequirement;
  growthDays: number;
  fertilizerGuide: string;
  varieties: string[];
  stages: CropStageTemplate[];
}

export interface DailyForecast {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipitationMm: number;
  precipitationProb: number;
  weatherCode: number;
  weatherLabel: string;
  sunshineHours: number;
}

export interface WeatherData {
  latitude: number;
  longitude: number;
  elevationM: number;
  currentTempC: number;
  currentHumidity: number;
  currentWindKmh: number;
  currentPrecipitationMm: number;
  currentWeatherCode: number;
  currentWeatherLabel: string;
  daily: DailyForecast[];
  fetchedAt: string;
}

export interface SoilData {
  ph: number;
  organicCarbonGKg: number;
  nitrogenGKg: number;
  clayPercent: number;
  sandPercent: number;
  siltPercent: number;
  textureClass: string;
  source: 'SoilGrids' | 'Regional Fallback';
}

export interface CropRecommendation {
  crop: NepalCrop;
  score: number;
  suitability: 'Highly Suitable' | 'Suitable' | 'Moderate';
  reasons: string[];
}

export interface IrrigationAdvice {
  action: 'irrigate_now' | 'delay_rain_expected' | 'light_watering' | 'adequate_moisture';
  headline: string;
  reason: string;
  upcomingRainMm48h: number;
  recommendedIntervalDays: number;
}