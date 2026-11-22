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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CloudRain,
  Droplets,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Sprout,
  Sun,
  Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFarm } from "../context/FarmContext";
import {
  LanguageToggle,
  toDevanagari,
  translateWeatherLabel,
  useLanguage,
  type AppLanguage,
} from "../context/LanguageContext";
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

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_NE = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"];

const MONTH_NAMES_EN = [
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

const MONTH_NAMES_NE = [
  "जनवरी",
  "फेब्रुअरी",
  "मार्च",
  "अप्रिल",
  "मे",
  "जुन",
  "जुलाई",
  "अगस्ट",
  "सेप्टेम्बर",
  "अक्टोबर",
  "नोभेम्बर",
  "डिसेम्बर",
];

const ACTIVITY_META: Record<
  ActivityType,
  { emoji: string; labelEn: string; labelNe: string; badgeClass: string }
> = {
  sowing: {
    emoji: "🌱",
    labelEn: "Sowing",
    labelNe: "बीउ रोपाइँ",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  irrigation: {
    emoji: "💧",
    labelEn: "Irrigation",
    labelNe: "सिँचाइ",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  fertilizer: {
    emoji: "🌿",
    labelEn: "Fertilizer",
    labelNe: "मलखाद",
    badgeClass: "bg-lime-50 text-lime-700 border-lime-200",
  },
  weeding: {
    emoji: "🪴",
    labelEn: "Weeding",
    labelNe: "गोडमेल",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  pest_check: {
    emoji: "🔍",
    labelEn: "Pest Check",
    labelNe: "कीरा जाँच",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
  harvest: {
    emoji: "🌾",
    labelEn: "Harvest",
    labelNe: "बाली कटानी",
    badgeClass: "bg-yellow-50 text-yellow-800 border-yellow-200",
  },
};

const BS_2083_MONTHS = [
  { nameEn: "Kartik", nameNe: "कार्तिक", startAd: "2026-10-18", days: 30 },
  { nameEn: "Mangsir", nameNe: "मंसिर", startAd: "2026-11-17", days: 30 },
  { nameEn: "Poush", nameNe: "पुष", startAd: "2026-12-17", days: 29 },
  { nameEn: "Magh", nameNe: "माघ", startAd: "2027-01-15", days: 29 },
];

function getBsLabelForAdDate(dateStr: string): {
  shortNe: string;
  fullLabelNe: string;
  fullLabelEn: string;
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
        fullLabelNe: `${bsMonth.nameNe} ${toDevanagari(bsDay)}, २०८३`,
        fullLabelEn: `${bsMonth.nameEn} ${bsDay}, 2083 BS`,
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

function getIrrigationCardStyle(
  action: IrrigationAdvice["action"],
  lang: AppLanguage,
): {
  container: string;
  badge: string;
  badgeText: string;
} {
  if (action === "irrigate_now") {
    return {
      container: "border-amber-200 bg-amber-50/70",
      badge: "bg-amber-100 text-amber-800 border-amber-200",
      badgeText: lang === "ne" ? "आजै सिँचाइ गर्नुहोस्" : "Irrigate Today",
    };
  }
  if (action === "delay_rain_expected") {
    return {
      container: "border-sky-200 bg-sky-50/70",
      badge: "bg-sky-100 text-sky-800 border-sky-200",
      badgeText:
        lang === "ne"
          ? "वर्षा हुने सम्भावना — रोक्नुहोस्"
          : "Rain Expected — Hold",
    };
  }
  if (action === "light_watering") {
    return {
      container: "border-teal-200 bg-teal-50/70",
      badge: "bg-teal-100 text-teal-800 border-teal-200",
      badgeText: lang === "ne" ? "हल्का सिँचाइ" : "Light Watering",
    };
  }
  return {
    container: "border-emerald-200 bg-emerald-50/70",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    badgeText: lang === "ne" ? "चिस्यान सन्तुलित छ" : "Moisture Adequate",
  };
}

function getLocalizedIrrigationCopy(
  advice: IrrigationAdvice,
  cropName: string,
  weather: WeatherData,
  lang: AppLanguage,
): { headline: string; reason: string } {
  if (lang === "en") {
    return { headline: advice.headline, reason: advice.reason };
  }
  if (advice.action === "delay_rain_expected") {
    return {
      headline: "सिँचाइ रोक्नुहोस् — वर्षाको सम्भावना छ",
      reason: `आगामी ४८ घण्टामा करिब ${advice.upcomingRainMm48h} मि.मी. वर्षा हुने पूर्वानुमान छ। ${cropName} मा पानी जम्न नदिन र पानी बचाउन आज सिँचाइ नगर्नुहोस्।`,
    };
  }
  if (advice.action === "irrigate_now") {
    return {
      headline: "आज सिँचाइ गर्नुहोस् (गर्मी र सुख्खा मौसम)",
      reason: `४८ घण्टामा कम वर्षा (${advice.upcomingRainMm48h} मि.मी.) र तापक्रम ${weather.currentTempC}°C / आर्द्रता ${weather.currentHumidity}% छ। बिहान वा बेलुका ${cropName} मा राम्रोसँग सिँचाइ गर्नुहोस्।`,
    };
  }
  if (advice.action === "light_watering") {
    return {
      headline: "हल्का सिँचाइ सिफारिस गरिएको छ",
      reason: `${cropName} लाई धेरै पानी चाहिने र ४८ घण्टामा न्यून वर्षा (${advice.upcomingRainMm48h} मि.मी.) अनुमानित भएकाले जराको चिस्यान कायम राख्नुहोस्।`,
    };
  }
  return {
    headline: "चिस्यान अवस्था सामान्य छ",
    reason: `मौसम सन्तुलित छ (${weather.currentTempC}°C, आर्द्रता ${weather.currentHumidity}%) र ४८ घण्टामा ${advice.upcomingRainMm48h} मि.मी. वर्षा अनुमान छ। ${cropName} मा नियमित ${advice.recommendedIntervalDays}-दिने तालिका अपनाउनुहोस्।`,
  };
}

function isStageTemplateTask(
  task: FarmingActivity,
  cropById: Record<string, RegisteredCrop>,
): boolean {
  const crop = cropById[task.crop_id];
  if (!crop) return false;
  const nepalCrop = getCropByKey(crop.crop_key);
  if (!nepalCrop) return false;
  return nepalCrop.stages.some(
    (stage) => task.title === `${nepalCrop.name}: ${stage.title}`,
  );
}

export function Calendar() {
  const { lang } = useLanguage();
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

  const [showAddTaskForm, setShowAddTaskForm] = useState<boolean>(true);
  const [hideAddedTasks, setHideAddedTasks] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");
  const [newType, setNewType] = useState<ActivityType>("irrigation");
  const [newCropId, setNewCropId] = useState<string>("");
  const [addingTask, setAddingTask] = useState<boolean>(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

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
      setError(
        lang === "ne"
          ? "कृषि कार्यहरू लोड गर्न सकिएन।"
          : "Failed to load farming activities.",
      );
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
        lang === "ne"
          ? "स्मार्ट सिँचाइ सल्लाहको लागि प्रत्यक्ष मौसम लोड गर्न सकिएन।"
          : "Could not load live weather for Smart Irrigation advice.",
      );
    }

    setLoading(false);
  }, [activeFarm?.id, activeFarm?.latitude, activeFarm?.longitude, lang]);

  useEffect(() => {
    if (activeFarm) {
      void loadCalendarData();
    }
  }, [activeFarm?.id, loadCalendarData]);

  const activeCrops = useMemo(
    () => crops.filter((c) => c.status === "active"),
    [crops],
  );

  const cropById = useMemo(() => {
    const map: Record<string, RegisteredCrop> = {};
    crops.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [crops]);

  const getLocalizedCropName = useCallback(
    (crop: RegisteredCrop): string => {
      if (lang === "en") return crop.crop_name;
      return getCropByKey(crop.crop_key)?.nepaliName ?? crop.crop_name;
    },
    [lang],
  );

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
      cropName: irrigationTargetCrop
        ? getLocalizedCropName(irrigationTargetCrop)
        : activeFarm.name,
    });
  }, [weather, activeFarm, irrigationTargetCrop, getLocalizedCropName]);

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

  const visibleSelectedDayTasks = useMemo(() => {
    if (!hideAddedTasks) return selectedDayTasks;
    return selectedDayTasks.filter((task) =>
      isStageTemplateTask(task, cropById),
    );
  }, [selectedDayTasks, hideAddedTasks, cropById]);

  const hiddenAddedCount =
    selectedDayTasks.length - visibleSelectedDayTasks.length;
  const isSelectedDateFuture = selectedDateKey > todayKey;

  const selectedDayDoneCount = useMemo(
    () =>
      selectedDayTasks.filter((t) => t.completed && t.due_date <= todayKey)
        .length,
    [selectedDayTasks, todayKey],
  );

  const selectedDayProgress =
    selectedDayTasks.length === 0
      ? 0
      : Math.round((selectedDayDoneCount / selectedDayTasks.length) * 100);

  const totalCompletedCount = useMemo(
    () =>
      activities.filter((a) => a.completed && a.due_date <= todayKey).length,
    [activities, todayKey],
  );

  const upcomingTasks = useMemo(() => {
    const pending = activities.filter((a) => !a.completed);
    const filtered = hideAddedTasks
      ? pending.filter((task) => isStageTemplateTask(task, cropById))
      : pending;
    return filtered.slice(0, 20);
  }, [activities, hideAddedTasks, cropById]);

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
    if (activity.due_date > todayKey && !activity.completed) {
      return;
    }

    const nextCompleted = !activity.completed;
    const completedAt = nextCompleted ? new Date().toISOString() : null;

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
      setActivities((prev) =>
        prev.map((item) => (item.id === activity.id ? activity : item)),
      );
      setError(
        lang === "ne"
          ? `कार्य अद्यावधिक गर्न सकिएन: ${updateError.message}`
          : `Could not update task: ${updateError.message}`,
      );
    }
  };

  const handleDeleteTask = async (activity: FarmingActivity) => {
    setDeletingTaskId(activity.id);
    setError(null);

    const previous = activities;
    setActivities((prev) => prev.filter((item) => item.id !== activity.id));

    const { error: deleteError } = await supabase
      .from("activities")
      .delete()
      .eq("id", activity.id);

    if (deleteError) {
      setActivities(previous);
      setError(
        lang === "ne"
          ? `कार्य हटाउन सकिएन: ${deleteError.message}`
          : `Could not remove task: ${deleteError.message}`,
      );
    }

    setDeletingTaskId(null);
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
      setError(
        lang === "ne"
          ? `कार्य थप्न असफल भयो: ${insertError.message}`
          : `Failed to add task: ${insertError.message}`,
      );
    } else if (data) {
      setActivities((prev) =>
        [...prev, data as FarmingActivity].sort((a, b) =>
          a.due_date.localeCompare(b.due_date),
        ),
      );
      setNewTitle("");
      setNewDescription("");
      setHideAddedTasks(false);
    }

    setAddingTask(false);
  };

  if (farmLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <span>
            {lang === "ne"
              ? "तपाईंको कृषि पात्रो लोड हुँदैछ..."
              : "Loading your farming calendar..."}
          </span>
        </div>
      </div>
    );
  }

  if (!activeFarm) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <MapPin className="mx-auto mb-3 h-10 w-10 text-amber-600" />
        <h2 className="text-xl font-semibold text-slate-900">
          {lang === "ne"
            ? "कुनै सक्रिय खेत छानिएको छैन"
            : "No Active Farm Selected"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {lang === "ne"
            ? "कृषि कार्य पात्रो र स्मार्ट सिँचाइ सल्लाह हेर्न पहिले खेत थप्नुहोस् वा छान्नुहोस्।"
            : "Please add or select a farm first to view your farming task calendar and weather-aware irrigation advice."}
        </p>
        <Link
          to="/farms/new"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {lang === "ne"
            ? "खेत थप्नुहोस् वा छान्नुहोस्"
            : "Add or Select a Farm"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const irrigationStyle = irrigationAdvice
    ? getIrrigationCardStyle(irrigationAdvice.action, lang)
    : null;

  const localizedIrrigation =
    irrigationAdvice && weather
      ? getLocalizedIrrigationCopy(
          irrigationAdvice,
          irrigationTargetCrop
            ? getLocalizedCropName(irrigationTargetCrop)
            : activeFarm.name,
          weather,
          lang,
        )
      : null;

  const weekdays = lang === "ne" ? WEEKDAYS_NE : WEEKDAYS_EN;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <CalendarIcon className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {lang === "ne"
                ? "कृषि पात्रो र सिँचाइ"
                : "Farming Calendar & Irrigation"}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {activeFarm.name} —{" "}
            {lang === "ne" ? "कार्य तालिका" : "Activity Schedule"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {lang === "ne"
              ? "बालीका चरणहरू ट्र्याक गर्नुहोस्, आज र विगतका कार्यहरू पूरा गर्नुहोस्, र मौसमअनुसार सिँचाइ सल्लाह लिनुहोस्।"
              : "Track crop lifecycle milestones, switch today’s or past field tasks done, and follow real-time irrigation guidance."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <LanguageToggle />

          <button
            type="button"
            onClick={() => handleJumpToDate(todayKey)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            <Sun className="h-4 w-4 text-amber-600" />
            {lang === "ne" ? "आज" : "Today"}
          </button>

          <button
            type="button"
            onClick={() => void loadCalendarData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {lang === "ne" ? "रिफ्रेस" : "Refresh"}
          </button>

          <Link
            to="/crops"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            <Sprout className="h-4 w-4" />
            {lang === "ne" ? "बाली दर्ता" : "Register Crop"}
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Lifecycle Overview Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">
            {lang === "ne" ? "सक्रिय बालीहरू" : "Active Crops"}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {lang === "ne"
              ? toDevanagari(activeCrops.length)
              : activeCrops.length}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {activeCrops.length > 0
              ? activeCrops.map((c) => getLocalizedCropName(c)).join(", ")
              : lang === "ne"
                ? "अहिले कुनै सक्रिय बाली छैन"
                : "No active crops yet"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">
            {lang === "ne" ? "कार्य प्रगति" : "Task Progress"}
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {lang === "ne"
              ? `${toDevanagari(totalCompletedCount)} / ${toDevanagari(activities.length)}`
              : `${totalCompletedCount} / ${activities.length}`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {activities.length > 0
              ? lang === "ne"
                ? `${toDevanagari(Math.round((totalCompletedCount / activities.length) * 100))}% समग्र प्रगति`
                : `${Math.round((totalCompletedCount / activities.length) * 100)}% completed overall`
              : lang === "ne"
                ? "कार्य तालिका बनाउन बाली दर्ता गर्नुहोस्"
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
            {lang === "ne" ? "आगामी बाँकी कार्य" : "Next Pending Action"}
          </p>
          <p className="mt-1 truncate text-base font-bold text-sky-700">
            {nextPendingActivity
              ? nextPendingActivity.title
              : lang === "ne"
                ? "सबै कार्य सम्पन्न!"
                : "All caught up!"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {nextPendingActivity
              ? lang === "ne"
                ? `मिति ${nextPendingActivity.due_date} (हेर्न क्लिक गर्नुहोस्)`
                : `Due ${nextPendingActivity.due_date} (click to jump)`
              : lang === "ne"
                ? "बाँकी कार्य छैन"
                : "No pending tasks"}
          </p>
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">
            {lang === "ne" ? "४८ घण्टे वर्षा पूर्वानुमान" : "48h Rain Forecast"}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {irrigationAdvice
              ? `${irrigationAdvice.upcomingRainMm48h} ${lang === "ne" ? "मि.मी." : "mm"}`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {weather
              ? `${weather.currentTempC}°C · ${translateWeatherLabel(
                  weather.currentWeatherLabel,
                  lang,
                )}`
              : lang === "ne"
                ? "मौसम उपलब्ध छैन"
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

      {irrigationAdvice && irrigationStyle && localizedIrrigation && (
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
                  {lang === "ne"
                    ? "स्मार्ट सिँचाइ सल्लाह"
                    : "Smart Irrigation Advice"}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${irrigationStyle.badge}`}
                >
                  {irrigationStyle.badgeText}
                </span>
              </div>

              <h2 className="text-lg font-bold text-slate-900">
                {localizedIrrigation.headline}
              </h2>
              <p className="text-sm text-slate-700">
                {localizedIrrigation.reason}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 lg:shrink-0">
              {crops.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-500">
                    {lang === "ne" ? "बाली आधार" : "Crop Basis"}
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
                        {getLocalizedCropName(c)} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rounded-xl border border-white/80 bg-white/80 px-4 py-2.5 text-center">
                <p className="text-[11px] font-semibold uppercase text-slate-500">
                  {lang === "ne" ? "सिँचाइ अन्तराल" : "Next Interval"}
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {lang === "ne"
                    ? `हरेक ${toDevanagari(irrigationAdvice.recommendedIntervalDays)} दिनमा`
                    : `Every ${irrigationAdvice.recommendedIntervalDays} days`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12-Col Split */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* LEFT: Calendar Grid */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:col-span-7 xl:col-span-8">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {lang === "ne"
                  ? `${MONTH_NAMES_NE[viewMonth]} ${toDevanagari(viewYear)}`
                  : `${MONTH_NAMES_EN[viewMonth]} ${viewYear}`}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === "ne"
                  ? "आज र विगतका कार्यहरू हेर्न, थप्न वा पूरा गर्न कुनै पनि मितिमा क्लिक गर्नुहोस्।"
                  : "Click any date to schedule, view, or switch today’s & past farming tasks."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                {lang === "ne" ? "अघिल्लो" : "Prev"}
              </button>
              <button
                type="button"
                onClick={() => handleJumpToDate(todayKey)}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                {lang === "ne" ? "आज" : "Today"}
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {lang === "ne" ? "अर्को" : "Next"}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 py-3 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {lang === "ne" ? "आज" : "Today"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600 bg-emerald-600 px-2.5 py-0.5 text-white">
              🌱 {lang === "ne" ? "रोपाइँ दिन" : "Sowing Day"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-sky-800">
              💧 {lang === "ne" ? "आगामी बाँकी कार्य" : "Next Pending Task"}
            </span>
          </div>

          <div className="mb-1.5 grid grid-cols-7 gap-1.5 sm:gap-2">
            {weekdays.map((wd, idx) => (
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
                      {lang === "ne" ? toDevanagari(cell.day) : cell.day}
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
                        {lang === "ne" ? "रोपाइँ" : "Sowing"}
                      </span>
                    )}
                    {cell.isToday && !cell.isSowing && (
                      <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950">
                        {lang === "ne" ? "आज" : "Today"}
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
                        {lang === "ne"
                          ? toDevanagari(cell.totalCount)
                          : cell.totalCount}
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
          <div className="bg-slate-900 p-5 text-white">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  {lang === "ne" ? "छानिएको मिति" : "Selected Date"}
                </p>
                <h3 className="mt-0.5 text-xl font-bold">{selectedDateKey}</h3>
                {selectedDateBs && (
                  <p className="mt-0.5 text-xs text-slate-300">
                    {lang === "ne"
                      ? `${selectedDateBs.fullLabelNe} (${selectedDateBs.fullLabelEn})`
                      : `${selectedDateBs.fullLabelNe} (${selectedDateBs.fullLabelEn})`}
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
                  {lang === "ne" ? "दिन" : "Day"} ({selectedDayTasks.length})
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
                  {lang === "ne" ? "आगामी" : "Upcoming"} ({upcomingTasks.length}
                  )
                </button>
              </div>
            </div>

            {panelTab === "selected" && (
              <div className="mt-4 rounded-xl bg-slate-800/80 p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-300">
                    {isSelectedDateFuture
                      ? lang === "ne"
                        ? "भविष्यका निर्धारित कार्य"
                        : "Scheduled Future Tasks"
                      : lang === "ne"
                        ? "दैनिक कार्य प्रगति"
                        : "Daily Task Progress"}
                  </span>
                  <span className="font-semibold text-emerald-300">
                    {selectedDayDoneCount}/{selectedDayTasks.length}{" "}
                    {lang === "ne" ? "सम्पन्न" : "Done"} ({selectedDayProgress}
                    %)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${selectedDayProgress}%` }}
                  />
                </div>
                {isSelectedDateFuture && selectedDayTasks.length > 0 && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-300">
                    <Lock className="h-3 w-3 shrink-0" />
                    {lang === "ne"
                      ? `भविष्यका कार्यहरू ${selectedDateKey} सम्म लक रहनेछन्।`
                      : `Future tasks stay locked until ${selectedDateKey}.`}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
            {loading && activities.length === 0 ? (
              <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                {lang === "ne"
                  ? "कार्यहरू लोड हुँदैछ..."
                  : "Loading activities..."}
              </div>
            ) : panelTab === "selected" ? (
              <>
                {visibleSelectedDayTasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      {hiddenAddedCount > 0
                        ? lang === "ne"
                          ? `${selectedDateKey} मा थपिएका ${hiddenAddedCount} कार्य लुकाइएका छन्`
                          : `${hiddenAddedCount} added task(s) hidden on ${selectedDateKey}`
                        : lang === "ne"
                          ? `${selectedDateKey} मा कुनै कार्य तालिका छैन`
                          : `No tasks scheduled for ${selectedDateKey}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {hiddenAddedCount > 0
                        ? lang === "ne"
                          ? 'तपाईंले थपेका कार्य हेर्न तल "थपिएका देखाउनुहोस्" मा क्लिक गर्नुहोस्।'
                          : 'Click "Show added" below to view your custom tasks.'
                        : lang === "ne"
                          ? "पात्रोबाट अर्को मिति छान्नुहोस् वा तल नयाँ कार्य थप्नुहोस्।"
                          : "Select another highlighted date on the calendar or add a custom task below."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {visibleSelectedDayTasks.map((task) => {
                      const meta = ACTIVITY_META[task.activity_type];
                      const cropObj = cropById[task.crop_id];
                      const cropName = cropObj
                        ? getLocalizedCropName(cropObj)
                        : null;
                      const isAddedCustom = !isStageTemplateTask(
                        task,
                        cropById,
                      );
                      const isFutureTask = task.due_date > todayKey;
                      const isSwitchDisabled = isFutureTask && !task.completed;
                      const isDeleting = deletingTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition ${
                            task.completed && !isFutureTask
                              ? "border-emerald-200 bg-emerald-50/50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}
                              >
                                {meta.emoji}{" "}
                                {lang === "ne" ? meta.labelNe : meta.labelEn}
                              </span>

                              {isAddedCustom && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  {lang === "ne" ? "थपिएको" : "Added"}
                                </span>
                              )}

                              {cropName && (
                                <span className="text-[11px] font-medium text-slate-500">
                                  {cropName}
                                </span>
                              )}
                            </div>

                            <p
                              className={`mt-1.5 text-sm font-semibold ${
                                task.completed && !isFutureTask
                                  ? "text-slate-500 line-through"
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

                            {isFutureTask && (
                              <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                <Lock className="h-3 w-3" />
                                {lang === "ne"
                                  ? `${task.due_date} मा खुल्नेछ`
                                  : `Unlocks on ${task.due_date}`}
                              </p>
                            )}
                          </div>

                          {/* Done/Undone Switch + Remove */}
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[11px] font-semibold ${
                                  isSwitchDisabled
                                    ? "text-slate-400"
                                    : task.completed
                                      ? "text-emerald-700"
                                      : "text-slate-500"
                                }`}
                              >
                                {task.completed
                                  ? lang === "ne"
                                    ? "सम्पन्न"
                                    : "Done"
                                  : lang === "ne"
                                    ? "बाँकी"
                                    : "Undone"}
                              </span>

                              <button
                                type="button"
                                role="switch"
                                aria-checked={task.completed}
                                disabled={isSwitchDisabled}
                                onClick={() => void handleToggleCompleted(task)}
                                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                                  isSwitchDisabled
                                    ? "cursor-not-allowed bg-slate-200 opacity-60"
                                    : task.completed
                                      ? "cursor-pointer bg-emerald-600"
                                      : "cursor-pointer bg-slate-300 hover:bg-slate-400"
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                    task.completed
                                      ? "translate-x-4"
                                      : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>

                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => void handleDeleteTask(task)}
                              title={
                                lang === "ne"
                                  ? "कार्य हटाउनुहोस्"
                                  : "Remove task"
                              }
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {lang === "ne" ? "हटाउनुहोस्" : "Remove"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Task Bar */}
                <div className="border-t border-slate-100 pt-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <Plus className="h-4 w-4 text-emerald-600" />
                      <span>
                        {lang === "ne"
                          ? `कार्य थप्नुहोस् (${selectedDateKey})`
                          : `Add Task (${selectedDateKey})`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHideAddedTasks((prev) => !prev)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                          hideAddedTasks
                            ? "border-amber-300 bg-amber-50 text-amber-800"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {hideAddedTasks ? (
                          <>
                            <Eye className="h-3.5 w-3.5" />
                            {lang === "ne"
                              ? "थपिएका देखाउनुहोस्"
                              : "Show added"}
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5" />
                            {lang === "ne"
                              ? "थपिएका लुकाउनुहोस्"
                              : "Hide added"}
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAddTaskForm((prev) => !prev)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        {showAddTaskForm ? (
                          <>
                            {lang === "ne" ? "फारम लुकाउनुहोस्" : "Hide form"}
                            <ChevronUp className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            {lang === "ne" ? "फारम देखाउनुहोस्" : "Show form"}
                            <ChevronDown className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {showAddTaskForm && (
                    <>
                      {crops.length === 0 ? (
                        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                          {lang === "ne" ? (
                            <>
                              कार्य जोड्न पहिले{" "}
                              <Link
                                to="/crops"
                                className="font-semibold underline"
                              >
                                बाली पृष्ठ
                              </Link>{" "}
                              मा गएर बाली दर्ता गर्नुहोस्।
                            </>
                          ) : (
                            <>
                              Register a crop on the{" "}
                              <Link
                                to="/crops"
                                className="font-semibold underline"
                              >
                                Crops page
                              </Link>{" "}
                              first to link tasks to a crop.
                            </>
                          )}
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
                            placeholder={
                              lang === "ne"
                                ? "जस्तै: थोपा सिँचाइ पाइप जाँच्ने वा कम्पोस्ट मल हाल्ने"
                                : "e.g., Check drip lines or apply compost"
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                          />

                          <input
                            type="text"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            placeholder={
                              lang === "ne"
                                ? "थप टिप्पणी (ऐच्छिक)..."
                                : "Optional notes..."
                            }
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
                              {(
                                Object.keys(ACTIVITY_META) as ActivityType[]
                              ).map((type) => (
                                <option key={type} value={type}>
                                  {ACTIVITY_META[type].emoji}{" "}
                                  {lang === "ne"
                                    ? ACTIVITY_META[type].labelNe
                                    : ACTIVITY_META[type].labelEn}
                                </option>
                              ))}
                            </select>

                            <select
                              value={newCropId || crops[0]?.id || ""}
                              onChange={(e) => setNewCropId(e.target.value)}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                            >
                              {crops.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {getLocalizedCropName(c)}
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
                              ? lang === "ne"
                                ? "सुरक्षित हुँदैछ..."
                                : "Saving..."
                              : lang === "ne"
                                ? `${selectedDateKey} मा कार्य थप्नुहोस्`
                                : `Add Activity to ${selectedDateKey}`}
                          </button>
                        </form>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              /* All Upcoming Pending Tasks Tab */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-medium text-slate-500">
                    {lang === "ne" ? "बाँकी कार्यहरू" : "Pending tasks"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHideAddedTasks((prev) => !prev)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                      hideAddedTasks
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {hideAddedTasks ? (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        {lang === "ne" ? "थपिएका देखाउनुहोस्" : "Show added"}
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        {lang === "ne" ? "थपिएका लुकाउनुहोस्" : "Hide added"}
                      </>
                    )}
                  </button>
                </div>

                {upcomingTasks.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    {lang === "ne"
                      ? "प्रदर्शन गर्न बाँकी कार्य छैन!"
                      : "No pending tasks to display!"}
                  </p>
                ) : (
                  upcomingTasks.map((task) => {
                    const meta = ACTIVITY_META[task.activity_type];
                    const isAddedCustom = !isStageTemplateTask(task, cropById);
                    const isFutureTask = task.due_date > todayKey;
                    const isSwitchDisabled = isFutureTask && !task.completed;
                    const isDeleting = deletingTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}
                            >
                              {meta.emoji}{" "}
                              {lang === "ne" ? meta.labelNe : meta.labelEn}
                            </span>
                            {isAddedCustom && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                {lang === "ne" ? "थपिएको" : "Added"}
                              </span>
                            )}
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

                          {isFutureTask && (
                            <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                              <Lock className="h-3 w-3" />
                              {lang === "ne"
                                ? `${task.due_date} मा खुल्नेछ`
                                : `Unlocks on ${task.due_date}`}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[11px] font-semibold ${
                                isSwitchDisabled
                                  ? "text-slate-400"
                                  : task.completed
                                    ? "text-emerald-700"
                                    : "text-slate-500"
                              }`}
                            >
                              {task.completed
                                ? lang === "ne"
                                  ? "सम्पन्न"
                                  : "Done"
                                : lang === "ne"
                                  ? "बाँकी"
                                  : "Undone"}
                            </span>

                            <button
                              type="button"
                              role="switch"
                              aria-checked={task.completed}
                              disabled={isSwitchDisabled}
                              onClick={() => void handleToggleCompleted(task)}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                                isSwitchDisabled
                                  ? "cursor-not-allowed bg-slate-200 opacity-60"
                                  : task.completed
                                    ? "cursor-pointer bg-emerald-600"
                                    : "cursor-pointer bg-slate-300 hover:bg-slate-400"
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                  task.completed
                                    ? "translate-x-4"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => void handleDeleteTask(task)}
                            title={
                              lang === "ne" ? "कार्य हटाउनुहोस्" : "Remove task"
                            }
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {lang === "ne" ? "हटाउनुहोस्" : "Remove"}
                          </button>
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
