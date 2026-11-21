import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Calendar,
  CloudSun,
  Compass,
  Droplets,
  Loader2,
  MapPin,
  Mountain,
  Plus,
  Sprout,
  Stethoscope,
  Wind,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { supabase } from '../lib/supabase';
import { fetchFarmWeather } from '../services/weatherService';
import type { FarmingActivity, RegisteredCrop, WeatherData } from '../types';

export function Dashboard() {
  const { profile, user } = useAuth();
  const { farms, activeFarm, setActiveFarm, loading: farmsLoading } = useFarm();

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [crops, setCrops] = useState<RegisteredCrop[]>([]);
  const [activities, setActivities] = useState<FarmingActivity[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (!activeFarm) {
      setWeather(null);
      setCrops([]);
      setActivities([]);
      return;
    }

    let cancelled = false;

    async function loadWeather() {
      if (!activeFarm) return;
      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const data = await fetchFarmWeather(
          activeFarm.latitude,
          activeFarm.longitude
        );
        if (!cancelled) {
          setWeather(data);
        }
      } catch (err) {
        if (!cancelled) {
          setWeatherError(
            err instanceof Error ? err.message : 'Unable to load weather.'
          );
        }
      } finally {
        if (!cancelled) {
          setWeatherLoading(false);
        }
      }
    }

    async function loadFarmRecords() {
      if (!activeFarm) return;
      setDataLoading(true);

      const [cropsResult, activitiesResult] = await Promise.all([
        supabase
          .from('crops')
          .select('*')
          .eq('farm_id', activeFarm.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('activities')
          .select('*')
          .eq('farm_id', activeFarm.id)
          .eq('completed', false)
          .order('due_date', { ascending: true })
          .limit(5),
      ]);

      if (!cancelled) {
        if (!cropsResult.error && cropsResult.data) {
          setCrops(cropsResult.data as RegisteredCrop[]);
        } else {
          setCrops([]);
        }

        if (!activitiesResult.error && activitiesResult.data) {
          setActivities(activitiesResult.data as FarmingActivity[]);
        } else {
          setActivities([]);
        }

        setDataLoading(false);
      }
    }

    void loadWeather();
    void loadFarmRecords();

    return () => {
      cancelled = true;
    };
  }, [activeFarm]);

  const greetingName =
    profile?.full_name || user?.email?.split('@')[0] || 'Farmer';

  if (farmsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-emerald-700 gap-3">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm font-medium">Loading your farm dashboard...</p>
      </div>
    );
  }

  // Empty state: user hasn't added any farm yet
  if (farms.length === 0 || !activeFarm) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-8 sm:p-12 text-center max-w-2xl mx-auto mt-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-5">
          <MapPin className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          Namaste, {greetingName}!
        </h1>
        <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
          Welcome to <strong>Aadhunik Krishak</strong>. Pin your first farmland
          on the Nepal map to unlock live weather forecasts, agro-zone
          detection, and smart crop recommendations.
        </p>
        <Link
          to="/farms/new"
          className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Your First Farm
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Farm Switcher */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Namaste, {greetingName}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Here is the live overview for <strong>{activeFarm.name}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Switch active farm"
            value={activeFarm.id}
            onChange={(e) => {
              const selected =
                farms.find((f) => f.id === e.target.value) ?? null;
              setActiveFarm(selected);
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
                {farm.district ? ` — ${farm.district}` : ''}
              </option>
            ))}
          </select>

          <Link
            to="/farms/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Farm
          </Link>
        </div>
      </div>

      {/* Active Farm Summary Banner */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-700 rounded-2xl p-5 sm:p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">
              Active Farmland
            </p>
            <h2 className="text-xl font-bold mt-0.5">{activeFarm.name}</h2>
          </div>

          <div className="flex flex-wrap gap-2.5 text-xs font-medium">
            {activeFarm.district && (
              <span className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
                <MapPin className="w-3.5 h-3.5" />
                {activeFarm.district}
              </span>
            )}
            {activeFarm.agro_zone && (
              <span className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
                <Sprout className="w-3.5 h-3.5" />
                {activeFarm.agro_zone} Zone
              </span>
            )}
            {activeFarm.elevation_m !== null && (
              <span className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
                <Mountain className="w-3.5 h-3.5" />
                {activeFarm.elevation_m} m
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
              {activeFarm.area_hectares} ha
            </span>
          </div>
        </div>
      </div>

      {/* Live Weather Card */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 inline-flex items-center gap-2">
            <CloudSun className="w-5 h-5 text-amber-500" />
            Live Farm Weather
          </h2>
          {weather && (
            <span className="text-xs text-slate-500">
              Elevation: {Math.round(weather.elevationM)} m
            </span>
          )}
        </div>

        {weatherLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            Fetching live forecast from Open-Meteo...
          </div>
        )}

        {weatherError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{weatherError}</span>
          </div>
        )}

        {!weatherLoading && !weatherError && weather && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-4">
                <p className="text-xs text-slate-500">Temperature</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {Math.round(weather.currentTempC)}&deg;C
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  {weather.currentWeatherLabel}
                </p>
              </div>

              <div className="rounded-xl bg-sky-50/70 border border-sky-100 p-4">
                <p className="text-xs text-slate-500 inline-flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-sky-600" />
                  Humidity
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {weather.currentHumidity}%
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rain: {weather.currentPrecipitationMm} mm
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4">
                <p className="text-xs text-slate-500 inline-flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-slate-600" />
                  Wind Speed
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {Math.round(weather.currentWindKmh)} km/h
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Current</p>
              </div>

              <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-4">
                <p className="text-xs text-slate-500">Condition</p>
                <p className="text-base font-bold text-emerald-900 mt-1.5">
                  {weather.currentWeatherLabel}
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">Live update</p>
              </div>
            </div>

            {/* 5-Day Preview */}
            {weather.daily.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                  5-Day Forecast Preview
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {weather.daily.slice(0, 5).map((day) => (
                    <div
                      key={day.date}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs bg-slate-50/50"
                    >
                      <p className="font-semibold text-slate-800">
                        {new Date(day.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-slate-600 mt-1 truncate">
                        {day.weatherLabel}
                      </p>
                      <p className="font-semibold text-slate-900 mt-1">
                        {Math.round(day.tempMaxC)}&deg; /{' '}
                        <span className="text-slate-500 font-normal">
                          {Math.round(day.tempMinC)}&deg;
                        </span>
                      </p>
                      <p className="text-sky-700 mt-0.5">
                        Rain: {day.precipitationMm} mm
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Crops & Activities Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registered Crops Summary */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 inline-flex items-center gap-2">
              <Sprout className="w-5 h-5 text-emerald-600" />
              Registered Crops
            </h2>
            <Link
              to="/crops"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
            >
              Manage
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {dataLoading ? (
            <p className="text-sm text-slate-500 py-4">Loading crops...</p>
          ) : crops.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center">
              <p className="text-sm text-slate-600">
                No crops registered for this farm yet.
              </p>
              <Link
                to="/crops"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Explore Crop Recommendations
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {crops.map((crop) => (
                <li
                  key={crop.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {crop.crop_name}
                      {crop.variety ? ` (${crop.variety})` : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      Area: {crop.area_hectares} ha &bull; Harvest:{' '}
                      {crop.expected_harvest_date}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 capitalize">
                    {crop.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Upcoming Activities */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 inline-flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Upcoming Activities
            </h2>
            <Link
              to="/calendar"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
            >
              View Calendar
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {dataLoading ? (
            <p className="text-sm text-slate-500 py-4">Loading activities...</p>
          ) : activities.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center">
              <p className="text-sm text-slate-600">
                No upcoming farming tasks scheduled.
              </p>
              <Link
                to="/calendar"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Open Farming Calendar
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activities.map((activity) => (
                <li
                  key={activity.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {activity.title}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">
                      {activity.activity_type.replace('_', ' ')}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full shrink-0">
                    Due: {activity.due_date}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Quick Actions */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/land-intelligence"
            className="bg-white hover:border-emerald-300 rounded-2xl border border-slate-200 p-4 shadow-sm transition-colors flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                Land Intelligence
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Soil pH, nutrients &amp; zone insights
              </p>
            </div>
          </Link>

          <Link
            to="/crops"
            className="bg-white hover:border-emerald-300 rounded-2xl border border-slate-200 p-4 shadow-sm transition-colors flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-lime-50 text-lime-700 flex items-center justify-center shrink-0">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                Crop Advisor
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Nepal crop recommendations
              </p>
            </div>
          </Link>

          <Link
            to="/plant-doctor"
            className="bg-white hover:border-emerald-300 rounded-2xl border border-slate-200 p-4 shadow-sm transition-colors flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                AI Plant Doctor
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Scan crop leaves for diseases
              </p>
            </div>
          </Link>

          <Link
            to="/assistant"
            className="bg-white hover:border-emerald-300 rounded-2xl border border-slate-200 p-4 shadow-sm transition-colors flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                AI Assistant
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Ask farming questions 24/7
              </p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}