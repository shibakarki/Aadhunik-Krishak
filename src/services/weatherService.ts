import type { DailyForecast, WeatherData } from '../types';

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  elevation: number;
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    sunshine_duration?: number[];
  };
}

function getWeatherLabel(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code >= 56 && code <= 57) return 'Freezing drizzle';
  if (code === 61) return 'Light rain';
  if (code === 63) return 'Moderate rain';
  if (code === 65) return 'Heavy rain';
  if (code >= 66 && code <= 67) return 'Freezing rain';
  if (code >= 71 && code <= 77) return 'Snowfall';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code === 95) return 'Thunderstorm';
  if (code >= 96 && code <= 99) return 'Thunderstorm with hail';
  return 'Partly cloudy';
}

export async function fetchFarmWeather(
  latitude: number,
  longitude: number
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunshine_duration',
    forecast_days: '7',
    timezone: 'auto',
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch weather data (HTTP ${response.status}).`
    );
  }

  const raw = (await response.json()) as OpenMeteoResponse;

  const currentCode = raw.current?.weather_code ?? 0;
  const times = raw.daily?.time ?? [];

  const daily: DailyForecast[] = times.map((date, idx) => {
    const code = raw.daily?.weather_code?.[idx] ?? 0;
    const sunshineSeconds = raw.daily?.sunshine_duration?.[idx] ?? 0;

    return {
      date,
      tempMaxC: raw.daily?.temperature_2m_max?.[idx] ?? 0,
      tempMinC: raw.daily?.temperature_2m_min?.[idx] ?? 0,
      precipitationMm: raw.daily?.precipitation_sum?.[idx] ?? 0,
      precipitationProb: raw.daily?.precipitation_probability_max?.[idx] ?? 0,
      weatherCode: code,
      weatherLabel: getWeatherLabel(code),
      sunshineHours: Number((sunshineSeconds / 3600).toFixed(1)),
    };
  });

  return {
    latitude: raw.latitude ?? latitude,
    longitude: raw.longitude ?? longitude,
    elevationM: raw.elevation ?? 0,
    currentTempC: raw.current?.temperature_2m ?? 0,
    currentHumidity: raw.current?.relative_humidity_2m ?? 0,
    currentWindKmh: raw.current?.wind_speed_10m ?? 0,
    currentPrecipitationMm: raw.current?.precipitation ?? 0,
    currentWeatherCode: currentCode,
    currentWeatherLabel: getWeatherLabel(currentCode),
    daily,
    fetchedAt: new Date().toISOString(),
  };
}