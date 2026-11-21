import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Droplets,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Sprout,
  Sun,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFarm } from "../context/FarmContext";
import { supabase } from "../lib/supabase";
import { getCropByKey } from "../services/cropEngine";
import { getIrrigationAdvice } from "../services/irrigationEngine";
import { fetchFarmWeather } from "../services/weatherService";
import type {
  ActivityType,
  FarmingActivity,
  IrrigationAdvice,
  RegisteredCrop,
  WeatherData,
} from "../types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ACTIVITY_META: Record<
  ActivityType,
  { emoji: string; label: string; badgeClass: string }
> = {
  sowing: {
    emoji: "🌱",
    label: "Sowing",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  irrigation: {
    emoji: "💧",
    label: "Irrigation",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  fertilizer: {
    emoji: "🌿",
    label: "Fertilizer",
    badgeClass: "bg-lime-50 text-lime-700 border-lime-200",
  },
  weeding: {
    emoji: "🪴",
    label: "Weeding",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  pest_check: {
    emoji: "🔍",
    label: "Pest Check",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
  harvest: {
    emoji: "🌾",
    label: "Harvest",
    badgeClass: "bg-yellow-50 text-yellow-800 border-yellow-200",
  },
};

const BS_2083_MONTHS = [
  { nameEn: "Kartik", nameNe: "कार्तिक", startAd: "2026-10-18", days: 30 },
  { nameEn: "Mangsir", nameNe: "मंसिर", startAd: "2026-11-17", days: 30 },
  { nameEn: "Poush", nameNe: "पुष", startAd: "2026-12-17", days: 29 },
  { nameEn: "Magh", nameNe: "माघ", startAd: "2027-01-15", days: 29 },
];

const DEVANAGARI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

function toDevanagari(num: number): string {
  return String(num)
    .split("")
    .map((ch) => (/\d/.test(ch) ? DEVANAGARI_DIGITS[Number(ch)] : ch))
    .join("");
}

function getBsLabelForAdDate(dateStr: string): {
  shortNe: string;
  fullLabel: string;
} | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const targetUtc = Date.UTC(y, m - 1, d);

  for (const bsMonth of BS_2083_MONTHS) {
    const [sy, sm, sd] = bsMonth.startAd.split("-").map(Number);
    const startUtc = Date.UTC(sy, sm - 1, sd);
    const diffDays = Math.round((targetUtc - startUtc) / 86400000);
    if (diffDays >= 0 && diffDays < bsMonth.days) {
      const bsDay = diffDays + 1;
      return {
        shortNe: toDevanagari(bsDay),
        fullLabel: `${bsMonth.nameNe} ${toDevanagari(bsDay)}, २०८३ (${bsMonth.nameEn} ${bsDay})`,
      };
    }
  }
  return null;
}

function toDateKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getTodayDateKey(): string {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function getIrrigationCardStyle(action: IrrigationAdvice["action"]): {
  container: string;
  badge: string;
  badgeText: string;
} {
  if (action === "irrigate_now") {
    return {
      container: "border-amber-200 bg-amber-50/70",
      badge: "bg-amber-100 text-amber-800 border-amber-200",
      badgeText: "Irrigate Today",
    };
  }
  if (action === "delay_rain_expected") {
    return {
      container: "border-sky-200 bg-sky-50/70",
      badge: "bg-sky-100 text-sky-800 border-sky-200",
      badgeText: "Rain Expected — Hold",
    };
  }
  if (action === "light_watering") {
    return {
      container: "border-teal-200 bg-teal-50/70",
      badge: "bg-teal-100 text-teal-800 border-teal-200",
      badgeText: "Light Watering",
    };
  }
  return {
    container: "border-emerald-200 bg-emerald-50/70",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    badgeText: "Moisture Adequate",
  };
}

export function Calendar() {
  const { user } = useAuth();
  const { activeFarm, loading: farmLoading } = useFarm();

  const todayKey = useMemo(() => getTodayDateKey(), []);
  const [viewYear, setViewYear] = useState<number>(() =>
    new Date().getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState<number>(() =>
    new Date().getMonth(),
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() =>
    getTodayDateKey(),
  );

  const [activities, setActivities] = useState<FarmingActivity[]>([]);
  const [crops, setCrops] = useState<RegisteredCrop[]>([]);
  const [selectedIrrigationCropId, setSelectedIrrigationCropId] =
    useState<string>("");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"selected" | "upcoming">("selected");

  // Add custom task form
  const [newTitle, setNewTitle] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");
  const [newType, setNewType] = useState<ActivityType>("irrigation");
  const [newCropId, setNewCropId] = useState<string>("");
  const [addingTask, setAddingTask] = useState<boolean>(false);

  const loadCalendarData = useCallback(async () => {
    if (!activeFarm) return;

    setLoading(true);
    setError(null);
    setWeatherError(null);

    const [actRes, cropsRes, weatherRes] = await Promise.allSettled([
      supabase
        .from("activities")
        .select("*")
        .eq("farm_id", activeFarm.id)
        .order("due_date", { ascending: true }),
      supabase
        .from("crops")
        .select("*")
        .eq("farm_id", activeFarm.id)
        .order("created_at", { ascending: false }),
      fetchFarmWeather(activeFarm.latitude, activeFarm.longitude),
    ]);

    if (actRes.status === "fulfilled") {
      if (actRes.value.error) {
        setError(actRes.value.error.message);
      } else {
        setActivities((actRes.value.data as FarmingActivity[]) ?? []);
      }
    } else {
      setError("Failed to load farming activities.");
    }

    if (cropsRes.status === "fulfilled" && !cropsRes.value.error) {
      const loadedCrops = (cropsRes.value.data as RegisteredCrop[]) ?? [];
      setCrops(loadedCrops);
      const firstActive =
        loadedCrops.find((c) => c.status === "active") ?? loadedCrops[0];
      if (firstActive) {
        setSelectedIrrigationCropId((prev) => prev || firstActive.id);
        setNewCropId((prev) => prev || firstActive.id);
      }
    }

    if (weatherRes.status === "fulfilled") {
      setWeather(weatherRes.value);
    } else {
      setWeather(null);
      setWeatherError(
        "Could not load live weather for Smart Irrigation advice.",
      );
    }

    setLoading(false);
  }, [activeFarm?.id, activeFarm?.latitude, activeFarm?.longitude]);

  useEffect(() => {
    if (activeFarm) {
      void loadCalendarData();
    }
  }, [activeFarm?.id, loadCalendarData]);

  const activeCrops = useMemo(
    () => crops.filter((c) => c.status === "active"),
    [crops],
  );

  const cropNameById = useMemo(() => {
    const map: Record<string, string> = {};
    crops.forEach((c) => {
      map[c.id] = c.crop_name;
    });
    return map;
  }, [crops]);

  const irrigationTargetCrop = useMemo(() => {
    return (
      crops.find((c) => c.id === selectedIrrigationCropId) ??
      activeCrops[0] ??
      crops[0] ??
      null
    );
  }, [crops, activeCrops, selectedIrrigationCropId]);

  const irrigationAdvice: IrrigationAdvice | null = useMemo(() => {
    if (!weather || !activeFarm) return null;
    const nepalCrop = irrigationTargetCrop
      ? getCropByKey(irrigationTargetCrop.crop_key)
      : undefined;

    return getIrrigationAdvice({
      weather,
      waterRequirement: nepalCrop?.waterRequirement ?? "medium",
      cropName: irrigationTargetCrop?.crop_name ?? activeFarm.name,
    });
  }, [weather, activeFarm, irrigationTargetCrop]);

  const activitiesByDate = useMemo(() => {
    const grouped: Record<string, FarmingActivity[]> = {};
    for (const act of activities) {
      const key = act.due_date;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(act);
    }
    return grouped;
  }, [activities]);

  const nextPendingActivity = useMemo(
    () =>
      activities.find((a) => !a.completed && a.due_date >= todayKey) ??
      activities.find((a) => !a.completed) ??
      null,
    [activities, todayKey],
  );

  const sowingDatesSet = useMemo(() => {
    const set = new Set<string>();
    crops.forEach((c) => set.add(c.sowing_date));
    activities.forEach((a) => {
      if (a.activity_type === "sowing") set.add(a.due_date);
    });
    return set;
  }, [crops, activities]);

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();

    const blanks = Array.from({ length: firstWeekday }, () => null);
    const days = Array.from({ length: totalDays }, (_, idx) => {
      const day = idx + 1;
      const dateKey = toDateKey(viewYear, viewMonth, day);
      const dayTasks = activitiesByDate[dateKey] ?? [];
      const pendingCount = dayTasks.filter((t) => !t.completed).length;
      const emojis = Array.from(
        new Set(
          dayTasks.map((t) => ACTIVITY_META[t.activity_type]?.emoji ?? "🌱"),
        ),
      ).slice(0, 3);

      return {
        day,
        dateKey,
        bs: getBsLabelForAdDate(dateKey),
        dayTasks,
        totalCount: dayTasks.length,
        pendingCount,
        emojis,
        isToday: dateKey === todayKey,
        isSowing: sowingDatesSet.has(dateKey),
        isNextAction: nextPendingActivity?.due_date === dateKey,
      };
    });

    return [...blanks, ...days];
  }, [
    viewYear,
    viewMonth,
    activitiesByDate,
    todayKey,
    sowingDatesSet,
    nextPendingActivity,
  ]);

  const selectedDayTasks = useMemo(
    () => activitiesByDate[selectedDateKey] ?? [],
    [activitiesByDate, selectedDateKey],
  );

  const selectedDayDoneCount = useMemo(
    () => selectedDayTasks.filter((t) => t.completed).length,
    [selectedDayTasks],
  );

  const selectedDayProgress =
    selectedDayTasks.length === 0
      ? 0
      : Math.round((selectedDayDoneCount / selectedDayTasks.length) * 100);

  const totalCompletedCount = useMemo(
    () => activities.filter((a) => a.completed).length,
    [activities],
  );

  const upcomingTasks = useMemo(
    () => activities.filter((a) => !a.completed).slice(0, 20),
    [activities],
  );

  const selectedDateBs = useMemo(
    () => getBsLabelForAdDate(selectedDateKey),
    [selectedDateKey],
  );

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToDate = (dateKey: string) => {
    const [y, m] = dateKey.split("-").map(Number);
    if (y && m) {
      setViewYear(y);
      setViewMonth(m - 1);
    }
    setSelectedDateKey(dateKey);
    setPanelTab("selected");
  };

  const handleToggleCompleted = async (activity: FarmingActivity) => {
    const nextCompleted = !activity.completed;
    const completedAt = nextCompleted ? new Date().toISOString() : null;

    // Optimistic update
    setActivities((prev) =>
      prev.map((item) =>
        item.id === activity.id
          ? { ...item, completed: nextCompleted, completed_at: completedAt }
          : item,
      ),
    );

    const { error: updateError } = await supabase
      .from("activities")
      .update({ completed: nextCompleted, completed_at: completedAt })
      .eq("id", activity.id);

    if (updateError) {
      // Revert if failed
      setActivities((prev) =>
        prev.map((item) => (item.id === activity.id ? activity : item)),
      );
      setError(`Could not update task: ${updateError.message}`);
    }
  };

  const handleAddCustomTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeFarm || !user) return;

    const trimmedTitle = newTitle.trim();
    const targetCropId = newCropId || crops[0]?.id;
    if (!trimmedTitle || !targetCropId) return;

    setAddingTask(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("activities")
      .insert({
        crop_id: targetCropId,
        farm_id: activeFarm.id,
        user_id: user.id,
        title: trimmedTitle,
        description: newDescription.trim() || null,
        activity_type: newType,
        due_date: selectedDateKey,
        completed: false,
        completed_at: null,
      })
      .select()
      .single();

    if (insertError) {
      setError(`Failed to add task: ${insertError.message}`);
    } else if (data) {
      setActivities((prev) =>
        [...prev, data as FarmingActivity].sort((a, b) =>
          a.due_date.localeCompare(b.due_date),
        ),
      );
      setNewTitle("");
      setNewDescription("");
    }

    setAddingTask(false);
  };

  if (farmLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <span>Loading your farming calendar...</span>
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
          Please add or select a farm first to view your farming task calendar
          and weather-aware irrigation advice.
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

  const irrigationStyle = irrigationAdvice
    ? getIrrigationCardStyle(irrigationAdvice.action)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <CalendarIcon className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Farming Calendar &amp; Irrigation
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {activeFarm.name} — Activity Schedule
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track crop lifecycle milestones, check off daily field tasks, and
            follow real-time irrigation guidance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleJumpToDate(todayKey)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            <Sun className="h-4 w-4 text-amber-600" />
            Today
          </button>

          <button
            type="button"
            onClick={() => void loadCalendarData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <Link
            to="/crops"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            <Sprout className="h-4 w-4" />
            Register Crop
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Lifecycle Overview Strip (from prototype layout) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">
            Active Crops
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {activeCrops.length}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {activeCrops.length > 0
              ? activeCrops.map((c) => c.crop_name).join(", ")
              : "No active crops yet"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">
            Task Progress
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {totalCompletedCount} / {activities.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {activities.length > 0
              ? `${Math.round((totalCompletedCount / activities.length) * 100)}% completed overall`
              : "Register a crop to generate tasks"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (nextPendingActivity)
              handleJumpToDate(nextPendingActivity.due_date);
          }}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-sky-300"
        >
          <p className="text-xs font-medium uppercase text-slate-500">
            Next Pending Action
          </p>
          <p className="mt-1 truncate text-base font-bold text-sky-700">
            {nextPendingActivity ? nextPendingActivity.title : "All caught up!"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {nextPendingActivity
              ? `Due ${nextPendingActivity.due_date} (click to jump)`
              : "No pending tasks"}
          </p>
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">
            48h Rain Forecast
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {irrigationAdvice
              ? `${irrigationAdvice.upcomingRainMm48h} mm`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {weather
              ? `${weather.currentTempC}°C · ${weather.currentWeatherLabel}`
              : "Weather unavailable"}
          </p>
        </div>
      </div>

      {/* Smart Irrigation Advice Card */}
      {weatherError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>{weatherError}</span>
        </div>
      )}

      {irrigationAdvice && irrigationStyle && (
        <div
          className={`rounded-2xl border p-5 shadow-sm ${irrigationStyle.container}`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {irrigationAdvice.action === "delay_rain_expected" ? (
                  <CloudRain className="h-5 w-5 text-sky-600" />
                ) : irrigationAdvice.action === "adequate_moisture" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <Droplets className="h-5 w-5 text-amber-600" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Smart Irrigation Advice
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${irrigationStyle.badge}`}
                >
                  {irrigationStyle.badgeText}
                </span>
              </div>

              <h2 className="text-lg font-bold text-slate-900">
                {irrigationAdvice.headline}
              </h2>
              <p className="text-sm text-slate-700">
                {irrigationAdvice.reason}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 lg:shrink-0">
              {crops.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-500">
                    Crop Basis
                  </label>
                  <select
                    value={irrigationTargetCrop?.id ?? ""}
                    onChange={(e) =>
                      setSelectedIrrigationCropId(e.target.value)
                    }
                    className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
                  >
                    {crops.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.crop_name} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rounded-xl border border-white/80 bg-white/80 px-4 py-2.5 text-center">
                <p className="text-[11px] font-semibold uppercase text-slate-500">
                  Next Interval
                </p>
                <p className="text-lg font-bold text-slate-900">
                  Every {irrigationAdvice.recommendedIntervalDays} days
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12-Col Split: Monthly Calendar Grid (Left) + Selected Date Panel (Right) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* LEFT: Calendar Grid */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:col-span-7 xl:col-span-8">
          {/* Month Header & Controls */}
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </h2>
              <p className="text-xs text-slate-500">
                Click any date to inspect, complete, or add farming tasks (BS
                2083 numerals shown where available).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                onClick={() => handleJumpToDate(todayKey)}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 py-3 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Today
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600 bg-emerald-600 px-2.5 py-0.5 text-white">
              🌱 Sowing Day
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-sky-800">
              💧 Next Pending Task
            </span>
          </div>

          {/* Weekday Headers */}
          <div className="mb-1.5 grid grid-cols-7 gap-1.5 sm:gap-2">
            {WEEKDAYS.map((wd, idx) => (
              <div
                key={wd}
                className={`rounded-lg py-2 text-center text-xs font-semibold ${
                  idx === 6
                    ? "bg-rose-50 text-rose-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarCells.map((cell, idx) => {
              if (!cell) {
                return (
                  <div
                    key={`blank-${idx}`}
                    className="min-h-[82px] rounded-xl border border-dashed border-slate-100 bg-slate-50/40 sm:min-h-[96px]"
                  />
                );
              }

              const isSelected = selectedDateKey === cell.dateKey;

              let cellClass =
                "border-slate-200 bg-white text-slate-900 hover:border-emerald-400 hover:bg-slate-50";
              if (cell.isNextAction) {
                cellClass =
                  "border-sky-300 bg-sky-50/80 text-sky-950 hover:border-sky-500";
              }
              if (cell.isToday) {
                cellClass =
                  "border-2 border-amber-400 bg-amber-50/70 text-slate-900";
              }
              if (cell.isSowing) {
                cellClass =
                  "border-2 border-emerald-700 bg-emerald-600 text-white";
              }

              const ringClass = isSelected
                ? "ring-2 ring-slate-900 ring-offset-1"
                : "";

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => {
                    setSelectedDateKey(cell.dateKey);
                    setPanelTab("selected");
                  }}
                  className={`flex min-h-[82px] flex-col justify-between rounded-xl border p-1.5 text-left transition sm:min-h-[96px] sm:p-2 ${cellClass} ${ringClass}`}
                >
                  <div className="flex w-full items-baseline justify-between gap-1">
                    <span className="text-sm font-bold sm:text-base">
                      {cell.day}
                    </span>
                    {cell.bs && (
                      <span
                        className={`text-[11px] font-medium ${
                          cell.isSowing ? "text-emerald-100" : "text-slate-400"
                        }`}
                      >
                        {cell.bs.shortNe}
                      </span>
                    )}
                  </div>

                  <div className="my-0.5 flex flex-wrap gap-1">
                    {cell.isSowing && (
                      <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                        Sowing
                      </span>
                    )}
                    {cell.isToday && !cell.isSowing && (
                      <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex w-full items-center justify-between gap-1">
                    <span className="text-xs leading-none">
                      {cell.emojis.join("")}
                    </span>

                    {cell.totalCount > 0 && (
                      <span
                        className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                          cell.isSowing
                            ? "bg-white/25 text-white"
                            : cell.pendingCount === 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-emerald-600 text-white"
                        }`}
                      >
                        {cell.totalCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* RIGHT: Sticky Interactive Task Panel */}
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-6 lg:col-span-5 xl:col-span-4">
          {/* Panel Header */}
          <div className="bg-slate-900 p-5 text-white">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  Selected Date
                </p>
                <h3 className="mt-0.5 text-xl font-bold">{selectedDateKey}</h3>
                {selectedDateBs && (
                  <p className="mt-0.5 text-xs text-slate-300">
                    {selectedDateBs.fullLabel}
                  </p>
                )}
              </div>

              <div className="flex rounded-lg bg-slate-800 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPanelTab("selected")}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    panelTab === "selected"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Day ({selectedDayTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab("upcoming")}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    panelTab === "upcoming"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  All Upcoming ({upcomingTasks.length})
                </button>
              </div>
            </div>

            {/* Daily Completion Progress Bar */}
            {panelTab === "selected" && (
              <div className="mt-4 rounded-xl bg-slate-800/80 p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-300">Daily Task Progress</span>
                  <span className="font-semibold text-emerald-300">
                    {selectedDayDoneCount}/{selectedDayTasks.length} Done (
                    {selectedDayProgress}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${selectedDayProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Panel Body */}
          <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
            {loading && activities.length === 0 ? (
              <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                Loading activities...
              </div>
            ) : panelTab === "selected" ? (
              <>
                {/* Tasks for Selected Day */}
                {selectedDayTasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      No tasks scheduled for {selectedDateKey}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Select another highlighted date on the calendar or add a
                      custom task below.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedDayTasks.map((task) => {
                      const meta = ACTIVITY_META[task.activity_type];
                      return (
                        <label
                          key={task.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                            task.completed
                              ? "border-emerald-200 bg-emerald-50/50 opacity-80"
                              : "border-slate-200 bg-white hover:border-emerald-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => void handleToggleCompleted(task)}
                            className="mt-1 h-4 w-4 shrink-0 rounded accent-emerald-600"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}
                              >
                                {meta.emoji} {meta.label}
                              </span>

                              {cropNameById[task.crop_id] && (
                                <span className="text-[11px] font-medium text-slate-500">
                                  {cropNameById[task.crop_id]}
                                </span>
                              )}
                            </div>

                            <p
                              className={`mt-1.5 text-sm font-semibold ${
                                task.completed
                                  ? "text-slate-400 line-through"
                                  : "text-slate-900"
                              }`}
                            >
                              {task.title}
                            </p>

                            {task.description && (
                              <p className="mt-0.5 text-xs text-slate-600">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Add Custom Task Form */}
                <div className="border-t border-slate-100 pt-4">
                  <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <Plus className="h-4 w-4 text-emerald-600" />
                    Add Task for {selectedDateKey}
                  </h4>

                  {crops.length === 0 ? (
                    <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                      Register a crop on the{" "}
                      <Link to="/crops" className="font-semibold underline">
                        Crops page
                      </Link>{" "}
                      first to link tasks to a crop.
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => void handleAddCustomTask(e)}
                      className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5"
                    >
                      <input
                        type="text"
                        required
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g., Check drip lines or apply compost"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />

                      <input
                        type="text"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Optional notes..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newType}
                          onChange={(e) =>
                            setNewType(e.target.value as ActivityType)
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                        >
                          {(Object.keys(ACTIVITY_META) as ActivityType[]).map(
                            (type) => (
                              <option key={type} value={type}>
                                {ACTIVITY_META[type].emoji}{" "}
                                {ACTIVITY_META[type].label}
                              </option>
                            ),
                          )}
                        </select>

                        <select
                          value={newCropId || crops[0]?.id || ""}
                          onChange={(e) => setNewCropId(e.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                        >
                          {crops.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.crop_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={addingTask || !newTitle.trim()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {addingTask && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        {addingTask
                          ? "Saving..."
                          : `Add Activity to ${selectedDateKey}`}
                      </button>
                    </form>
                  )}
                </div>
              </>
            ) : (
              /* All Upcoming Pending Tasks Tab */
              <div className="space-y-2.5">
                {upcomingTasks.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    No pending tasks! All tasks are completed.
                  </p>
                ) : (
                  upcomingTasks.map((task) => {
                    const meta = ACTIVITY_META[task.activity_type];
                    return (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => void handleToggleCompleted(task)}
                          className="mt-1 h-4 w-4 shrink-0 rounded accent-emerald-600"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}
                            >
                              {meta.emoji} {meta.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleJumpToDate(task.due_date)}
                              className="text-xs font-semibold text-emerald-700 hover:underline"
                            >
                              {task.due_date}
                            </button>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="mt-0.5 text-xs text-slate-600">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
