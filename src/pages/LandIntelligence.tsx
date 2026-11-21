import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CloudRain,
  Compass,
  Droplets,
  Layers,
  Loader2,
  MapPin,
  Mountain,
  RefreshCw,
  Sprout,
  Thermometer,
  Wind,
} from "lucide-react";
import { useFarm } from "../context/FarmContext";
import { supabase } from "../lib/supabase";
import { determineAgroZone } from "../services/cropEngine";
import { fetchFarmSoil } from "../services/soilService";
import { fetchFarmWeather } from "../services/weatherService";
import type { AgroZone, SoilData, WeatherData } from "../types";

function getPhStatus(ph: number): {
  label: string;
  colorClass: string;
  note: string;
} {
  if (ph < 5.5) {
    return {
      label: "Strongly Acidic",
      colorClass: "bg-amber-100 text-amber-800 border-amber-200",
      note: "Consider agricultural lime before planting pH-sensitive crops.",
    };
  }
  if (ph < 6.0) {
    return {
      label: "Slightly Acidic",
      colorClass: "bg-lime-100 text-lime-800 border-lime-200",
      note: "Ideal for potatoes, tea, cardamom, and most Hill vegetables.",
    };
  }
  if (ph <= 7.2) {
    return {
      label: "Neutral (Optimal)",
      colorClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
      note: "Optimal nutrient availability for cereals, pulses, and vegetables.",
    };
  }
  return {
    label: "Alkaline",
    colorClass: "bg-sky-100 text-sky-800 border-sky-200",
    note: "Add organic compost/gypsum to help micronutrient uptake.",
  };
}

function getOrganicCarbonStatus(gKg: number): string {
  if (gKg >= 15) return "Rich organic matter";
  if (gKg >= 10) return "Moderate organic matter";
  return "Low — add compost or FYM";
}

export function LandIntelligence() {
  const { activeFarm, loading: farmLoading, refreshFarms } = useFarm();

  const [soil, setSoil] = useState<SoilData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [soilSynced, setSoilSynced] = useState<boolean>(false);

  const loadIntelligence = useCallback(async () => {
    if (!activeFarm) return;

    setLoadingData(true);
    setWeatherError(null);
    setSoilSynced(false);

    const fallbackZone: AgroZone =
      activeFarm.agro_zone ??
      (activeFarm.elevation_m !== null
        ? determineAgroZone(activeFarm.elevation_m)
        : "Hill");

    const [soilResult, weatherResult] = await Promise.allSettled([
      fetchFarmSoil(activeFarm.latitude, activeFarm.longitude, fallbackZone),
      fetchFarmWeather(activeFarm.latitude, activeFarm.longitude),
    ]);

    if (soilResult.status === "fulfilled") {
      const soilData = soilResult.value;
      setSoil(soilData);

      // Bonus: fill farm's soil_type and soil_ph in Supabase if still null
      if (activeFarm.soil_type === null || activeFarm.soil_ph === null) {
        const { error: updateError } = await supabase
          .from("farms")
          .update({
            soil_type: activeFarm.soil_type ?? soilData.textureClass,
            soil_ph: activeFarm.soil_ph ?? soilData.ph,
          })
          .eq("id", activeFarm.id);

        if (!updateError) {
          setSoilSynced(true);
          void refreshFarms(activeFarm.id);
        }
      }
    }

    if (weatherResult.status === "fulfilled") {
      setWeather(weatherResult.value);
    } else {
      setWeather(null);
      setWeatherError("Could not load live weather from Open-Meteo right now.");
    }

    setLoadingData(false);
  }, [
    activeFarm?.id,
    activeFarm?.latitude,
    activeFarm?.longitude,
    activeFarm?.agro_zone,
    activeFarm?.elevation_m,
    activeFarm?.soil_type,
    activeFarm?.soil_ph,
    refreshFarms,
  ]);

  useEffect(() => {
    if (activeFarm) {
      void loadIntelligence();
    }
  }, [activeFarm?.id, loadIntelligence]);

  if (farmLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <span>Loading your farm details...</span>
        </div>
      </div>
    );
  }

  if (!activeFarm) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <MapPin className="mx-auto mb-3 h-10 w-10 text-amber-600" />
        <h2 className="text-xl font-semibold text-slate-900">
          No Active Farm Selected
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Please add or select a farm first to analyze its soil profile,
          elevation, agro-ecological zone, and live weather.
        </p>
        <Link
          to="/farms/new"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Add or Select a Farm
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const effectiveElevation =
    activeFarm.elevation_m ?? weather?.elevationM ?? null;
  const effectiveAgroZone =
    activeFarm.agro_zone ??
    (effectiveElevation !== null
      ? determineAgroZone(effectiveElevation)
      : "Hill");

  const phInfo = soil ? getPhStatus(soil.ph) : null;
  const textureTotal = soil
    ? soil.clayPercent + soil.sandPercent + soil.siltPercent || 100
    : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <Sprout className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Land Intelligence
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {activeFarm.name} — Soil &amp; Terrain Profile
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Satellite soil properties (SoilGrids / Nepal regional model) paired
            with live Open-Meteo weather.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadIntelligence()}
            disabled={loadingData}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loadingData ? "animate-spin" : ""}`}
            />
            Refresh Data
          </button>

          <Link
            to="/crops"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            Match Crops
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {soilSynced && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            Detected soil texture and pH have been saved to your farm profile
            automatically.
          </span>
        </div>
      )}

      {weatherError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>{weatherError}</span>
        </div>
      )}

      {/* Farm Terrain & Location Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase">
              Agro-Ecological Zone
            </span>
            <Mountain className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {effectiveAgroZone}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {effectiveAgroZone === "Terai" && "Sub-tropical plains (< 500m)"}
            {effectiveAgroZone === "Hill" && "Mid-hills climate (500m – 2000m)"}
            {effectiveAgroZone === "Mountain" && "Highland climate (> 2000m)"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase">Elevation</span>
            <Mountain className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {effectiveElevation !== null
              ? `${Math.round(effectiveElevation)} m`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {activeFarm.elevation_m !== null
              ? "Recorded farm elevation"
              : "Estimated from weather DEM"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase">
              Location &amp; Area
            </span>
            <MapPin className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {activeFarm.area_hectares} ha
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {activeFarm.district ? `${activeFarm.district}, Nepal` : "Nepal"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase">Coordinates</span>
            <Compass className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {activeFarm.latitude.toFixed(4)}° N
          </p>
          <p className="text-sm font-medium text-slate-700">
            {activeFarm.longitude.toFixed(4)}° E
          </p>
        </div>
      </div>

      {loadingData && !soil ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span>Analyzing SoilGrids &amp; live weather data...</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Soil Profile Card (2 cols) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Soil Composition &amp; Chemistry (0–5 cm)
                </h2>
              </div>

              {soil && (
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    soil.source === "SoilGrids"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  Source: {soil.source}
                </span>
              )}
            </div>

            {soil && phInfo ? (
              <div className="mt-5 space-y-6">
                {/* Key Chemical Metrics */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase text-slate-500">
                      Soil pH
                    </p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-slate-900">
                        {soil.ph}
                      </span>
                    </div>
                    <span
                      className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${phInfo.colorClass}`}
                    >
                      {phInfo.label}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase text-slate-500">
                      Organic Carbon
                    </p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {soil.organicCarbonGKg}
                      <span className="ml-1 text-sm font-normal text-slate-500">
                        g/kg
                      </span>
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
                      {getOrganicCarbonStatus(soil.organicCarbonGKg)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase text-slate-500">
                      Total Nitrogen
                    </p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {soil.nitrogenGKg}
                      <span className="ml-1 text-sm font-normal text-slate-500">
                        g/kg
                      </span>
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
                      Texture:{" "}
                      <span className="font-semibold">{soil.textureClass}</span>
                    </p>
                  </div>
                </div>

                {/* Texture Breakdown Bar */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      Soil Texture Breakdown — {soil.textureClass}
                    </span>
                    <span className="text-xs text-slate-500">
                      Clay {soil.clayPercent}% · Sand {soil.sandPercent}% · Silt{" "}
                      {soil.siltPercent}%
                    </span>
                  </div>

                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      style={{
                        width: `${(soil.clayPercent / textureTotal) * 100}%`,
                      }}
                      className="bg-amber-600"
                      title={`Clay: ${soil.clayPercent}%`}
                    />
                    <div
                      style={{
                        width: `${(soil.sandPercent / textureTotal) * 100}%`,
                      }}
                      className="bg-yellow-400"
                      title={`Sand: ${soil.sandPercent}%`}
                    />
                    <div
                      style={{
                        width: `${(soil.siltPercent / textureTotal) * 100}%`,
                      }}
                      className="bg-emerald-500"
                      title={`Silt: ${soil.siltPercent}%`}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-amber-600" />
                      <span>Clay: {soil.clayPercent}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-yellow-400" />
                      <span>Sand: {soil.sandPercent}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                      <span>Silt: {soil.siltPercent}%</span>
                    </div>
                  </div>
                </div>

                {/* Agronomic Tip */}
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">Soil Management Note</p>
                  <p className="mt-1 text-emerald-800">{phInfo.note}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No soil data available.
              </p>
            )}
          </div>

          {/* Live Weather Card (1 col) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <CloudRain className="h-5 w-5 text-sky-600" />
              <h2 className="text-lg font-semibold text-slate-900">
                Live Field Weather
              </h2>
            </div>

            {weather ? (
              <div className="mt-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-slate-900">
                      {weather.currentTempC}°C
                    </p>
                    <p className="text-sm font-medium text-slate-600">
                      {weather.currentWeatherLabel}
                    </p>
                  </div>
                  <Thermometer className="h-10 w-10 text-amber-500" />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Droplets className="h-3.5 w-3.5 text-sky-500" />
                      Humidity
                    </div>
                    <p className="mt-1 font-semibold text-slate-900">
                      {weather.currentHumidity}%
                    </p>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Wind className="h-3.5 w-3.5 text-slate-500" />
                      Wind
                    </div>
                    <p className="mt-1 font-semibold text-slate-900">
                      {weather.currentWindKmh} km/h
                    </p>
                  </div>
                </div>

                {/* Mini 5-day Outlook */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Upcoming Forecast
                  </p>
                  <div className="space-y-2">
                    {weather.daily.slice(0, 5).map((day) => (
                      <div
                        key={day.date}
                        className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-slate-700">
                          {day.date}
                        </span>
                        <span className="text-slate-500">
                          {day.precipitationMm} mm
                        </span>
                        <span className="font-semibold text-slate-900">
                          {Math.round(day.tempMinC)}° /{" "}
                          {Math.round(day.tempMaxC)}°C
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Weather information is temporarily unavailable.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
