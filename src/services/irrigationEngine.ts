import type { IrrigationAdvice, WaterRequirement, WeatherData } from '../types';

export function getIrrigationAdvice(params: {
  weather: WeatherData;
  waterRequirement: WaterRequirement;
  cropName?: string;
}): IrrigationAdvice {
  const { weather, waterRequirement, cropName = 'your crop' } = params;

  const upcomingRainMm48h =
    Math.round(
      weather.daily
        .slice(0, 2)
        .reduce((sum, day) => sum + (day.precipitationMm || 0), 0) * 10
    ) / 10;

  const baseInterval =
    waterRequirement === 'high' ? 3 : waterRequirement === 'medium' ? 5 : 8;

  // Heavy rain expected soon -> delay irrigation
  if (upcomingRainMm48h >= 12 || weather.currentPrecipitationMm >= 5) {
    return {
      action: 'delay_rain_expected',
      headline: 'Hold Irrigation — Rain Expected',
      reason: `Around ${upcomingRainMm48h} mm of rainfall is forecast over the next 48 hours. Skip watering to save water and prevent root waterlogging for ${cropName}.`,
      upcomingRainMm48h,
      recommendedIntervalDays: baseInterval + 2,
    };
  }

  // Hot/dry conditions with minimal rain -> irrigate now
  if (
    upcomingRainMm48h < 3 &&
    (weather.currentTempC >= 28 || weather.currentHumidity < 50)
  ) {
    return {
      action: 'irrigate_now',
      headline: 'Irrigate Today (Warm & Dry)',
      reason: `Low rainfall forecast (${upcomingRainMm48h} mm in 48h) with ${weather.currentTempC}°C temperature and ${weather.currentHumidity}% humidity. Water ${cropName} thoroughly in the early morning or evening.`,
      upcomingRainMm48h,
      recommendedIntervalDays: Math.max(2, baseInterval - 1),
    };
  }

  // High water demand crop with little rain -> light watering
  if (waterRequirement === 'high' && upcomingRainMm48h < 5) {
    return {
      action: 'light_watering',
      headline: 'Light Watering Recommended',
      reason: `${cropName} has high moisture demand and minimal rain (${upcomingRainMm48h} mm) is forecast over the next 48 hours. Maintain steady root-zone moisture.`,
      upcomingRainMm48h,
      recommendedIntervalDays: baseInterval,
    };
  }

  // Otherwise adequate moisture
  return {
    action: 'adequate_moisture',
    headline: 'Moisture Conditions Normal',
    reason: `Weather is mild (${weather.currentTempC}°C, ${weather.currentHumidity}% humidity) with ${upcomingRainMm48h} mm rain expected in 48h. Follow your regular ${baseInterval}-day schedule for ${cropName}.`,
    upcomingRainMm48h,
    recommendedIntervalDays: baseInterval,
  };
}