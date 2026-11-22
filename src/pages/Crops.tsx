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
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Droplets,
  Filter,
  Leaf,
  Loader2,
  MapPin,
  Plus,
  Sprout,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFarm } from "../context/FarmContext";
import { supabase } from "../lib/supabase";
import {
  addDaysToDate,
  determineAgroZone,
  generateCropActivities,
  getCurrentNepalSeason,
  loadActiveCropCatalog,
  recommendCrops,
} from "../services/cropEngine";
import { fetchFarmSoil } from "../services/soilService";
import { fetchFarmWeather } from "../services/weatherService";
import type {
  AgroZone,
  CropRecommendation,
  NepalCrop,
  NepalSeason,
  RegisteredCrop,
  SoilData,
  WeatherData,
} from "../types";

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getSuitabilityStyle(
  suitability: CropRecommendation["suitability"],
): string {
  if (suitability === "Highly Suitable") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (suitability === "Suitable") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getStatusBadge(status: RegisteredCrop["status"]): string {
  if (status === "active") return "bg-emerald-100 text-emerald-800";
  if (status === "harvested") return "bg-sky-100 text-sky-800";
  return "bg-slate-100 text-slate-600";
}

export function Crops() {
  const { user } = useAuth();
  const { activeFarm, loading: farmLoading } = useFarm();

  const [soil, setSoil] = useState<SoilData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [cropCatalog, setCropCatalog] = useState<NepalCrop[]>([]);
  const [registeredCrops, setRegisteredCrops] = useState<RegisteredCrop[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSeason, setSelectedSeason] = useState<NepalSeason>(() =>
    getCurrentNepalSeason(),
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [expandedCropKey, setExpandedCropKey] = useState<string | null>(null);

  const [modalCrop, setModalCrop] = useState<NepalCrop | null>(null);
  const [variety, setVariety] = useState<string>("");
  const [sowingDate, setSowingDate] = useState<string>(getTodayDateString);
  const [areaHectares, setAreaHectares] = useState<string>("0.5");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadFarmCropContext = useCallback(async () => {
    if (!activeFarm) return;

    setLoading(true);
    setError(null);

    const fallbackZone: AgroZone =
      activeFarm.agro_zone ??
      (activeFarm.elevation_m !== null
        ? determineAgroZone(activeFarm.elevation_m)
        : "Hill");

    const [soilRes, weatherRes, cropsRes, catalogRes] =
      await Promise.allSettled([
        fetchFarmSoil(activeFarm.latitude, activeFarm.longitude, fallbackZone),
        fetchFarmWeather(activeFarm.latitude, activeFarm.longitude),
        supabase
          .from("crops")
          .select("*")
          .eq("farm_id", activeFarm.id)
          .order("created_at", { ascending: false }),
        loadActiveCropCatalog(),
      ]);

    if (soilRes.status === "fulfilled") {
      setSoil(soilRes.value);
    }

    if (weatherRes.status === "fulfilled") {
      setWeather(weatherRes.value);
    } else {
      setWeather(null);
    }

    if (cropsRes.status === "fulfilled") {
      if (cropsRes.value.error) {
        setError(cropsRes.value.error.message);
      } else {
        setRegisteredCrops((cropsRes.value.data as RegisteredCrop[]) ?? []);
      }
    } else {
      setError("Failed to load registered crops.");
    }

    if (catalogRes.status === "fulfilled") {
      setCropCatalog(catalogRes.value);
    }

    setLoading(false);
  }, [
    activeFarm?.id,
    activeFarm?.latitude,
    activeFarm?.longitude,
    activeFarm?.agro_zone,
    activeFarm?.elevation_m,
  ]);

  useEffect(() => {
    if (activeFarm) {
      void loadFarmCropContext();
    }
  }, [activeFarm?.id, loadFarmCropContext]);

  const effectiveElevation =
    activeFarm?.elevation_m ?? weather?.elevationM ?? 1300;

  const recommendations = useMemo(() => {
    if (!activeFarm) return [];
    const ranked = recommendCrops({
      elevationM: effectiveElevation,
      weather,
      soil,
      season: selectedSeason,
      crops: cropCatalog,
    });
    if (categoryFilter === "All") return ranked;
    return ranked.filter((rec) => rec.crop.category === categoryFilter);
  }, [
    activeFarm,
    effectiveElevation,
    weather,
    soil,
    selectedSeason,
    categoryFilter,
    cropCatalog,
  ]);

  const openRegisterModal = (crop: NepalCrop) => {
    setModalCrop(crop);
    setVariety(crop.varieties[0] ?? "");
    setSowingDate(getTodayDateString());
    setAreaHectares(String(activeFarm?.area_hectares ?? 0.5));
    setSubmitError(null);
  };

  const closeRegisterModal = () => {
    if (submitting) return;
    setModalCrop(null);
    setSubmitError(null);
  };

  const handleRegisterCrop = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeFarm || !user || !modalCrop) return;

    const parsedArea = Number(areaHectares);
    if (!Number.isFinite(parsedArea) || parsedArea <= 0) {
      setSubmitError(
        "Please enter a valid cultivated area greater than 0 hectares.",
      );
      return;
    }

    if (!sowingDate) {
      setSubmitError("Please choose a sowing date.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    const expectedHarvestDate = addDaysToDate(sowingDate, modalCrop.growthDays);

    try {
      const { data: insertedCrop, error: cropError } = await supabase
        .from("crops")
        .insert({
          farm_id: activeFarm.id,
          user_id: user.id,
          crop_key: modalCrop.key,
          crop_name: modalCrop.name,
          variety: variety.trim() || null,
          sowing_date: sowingDate,
          expected_harvest_date: expectedHarvestDate,
          area_hectares: parsedArea,
          status: "active",
        })
        .select()
        .single();

      if (cropError) {
        throw new Error(cropError.message);
      }

      const newCrop = insertedCrop as RegisteredCrop;
      const stageActivities = generateCropActivities({
        cropKey: modalCrop.key,
        crop: modalCrop,
        cropId: newCrop.id,
        farmId: activeFarm.id,
        userId: user.id,
        sowingDate,
      });

      if (stageActivities.length > 0) {
        const { error: actError } = await supabase
          .from("activities")
          .insert(stageActivities);

        if (actError) {
          throw new Error(
            `Crop saved, but failed to generate tasks: ${actError.message}`,
          );
        }
      }

      setRegisteredCrops((prev) => [newCrop, ...prev]);
      setSuccessMessage(
        `Registered ${modalCrop.name}${variety ? ` (${variety})` : ""} and created ${stageActivities.length} farming tasks in your Calendar!`,
      );
      setModalCrop(null);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to register crop.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkHarvested = async (cropId: string) => {
    const { error: updateError } = await supabase
      .from("crops")
      .update({ status: "harvested" })
      .eq("id", cropId);

    if (!updateError) {
      setRegisteredCrops((prev) =>
        prev.map((c) => (c.id === cropId ? { ...c, status: "harvested" } : c)),
      );
    }
  };

  if (farmLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <span>Loading your farm...</span>
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
          Please add or select a farm first to view personalized crop
          recommendations and register crops.
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <Sprout className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Smart Crop Advisory
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Crop Recommendations &amp; Registration
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Ranked for <span className="font-medium">{activeFarm.name}</span> (
            {determineAgroZone(effectiveElevation)} zone ·{" "}
            {Math.round(effectiveElevation)}m{soil ? ` · pH ${soil.ph}` : ""}
            {weather ? ` · ${weather.currentTempC}°C` : ""})
          </p>
        </div>

        <Link
          to="/calendar"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Calendar className="h-4 w-4 text-emerald-600" />
          View Farming Calendar
        </Link>
      </div>

      {successMessage && (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <Link
            to="/calendar"
            className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline hover:text-emerald-900"
          >
            Go to Calendar
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Registered Crops on This Farm */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Registered Crops on {activeFarm.name}
            </h2>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {registeredCrops.length} total
          </span>
        </div>

        {loading && registeredCrops.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            Loading registered crops...
          </div>
        ) : registeredCrops.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">
            No crops registered on this farm yet. Pick a recommended crop below
            to register it and auto-generate its farming calendar!
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {registeredCrops.map((crop) => (
              <div
                key={crop.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {crop.crop_name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Variety: {crop.variety || "Standard"} ·{" "}
                        {crop.area_hectares} ha
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusBadge(
                        crop.status,
                      )}`}
                    >
                      {crop.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="block text-slate-400">Sowing Date</span>
                      <span className="font-medium text-slate-800">
                        {crop.sowing_date}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400">Est. Harvest</span>
                      <span className="font-medium text-slate-800">
                        {crop.expected_harvest_date}
                      </span>
                    </div>
                  </div>
                </div>

                {crop.status === "active" && (
                  <button
                    type="button"
                    onClick={() => void handleMarkHarvested(crop.id)}
                    className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Mark as Harvested
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Filter className="h-4 w-4 text-emerald-600" />
          <span>Season &amp; Category Filter</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(["Monsoon", "Winter", "Spring"] as NepalSeason[]).map(
              (season) => (
                <button
                  key={season}
                  type="button"
                  onClick={() => setSelectedSeason(season)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    selectedSeason === season
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {season}
                </button>
              ),
            )}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            <option value="All">All Categories</option>
            <option value="Cereal">Cereal</option>
            <option value="Vegetable">Vegetable</option>
            <option value="Pulse">Pulse</option>
            <option value="Oilseed">Oilseed</option>
            <option value="Cash Crop">Cash Crop</option>
          </select>
        </div>
      </div>

      {/* Ranked Recommendations Grid */}
      {loading && !soil ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            <span>Scoring Nepal crops against your soil and climate...</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {recommendations.map((rec) => {
            const isExpanded = expandedCropKey === rec.crop.key;
            return (
              <div
                key={rec.crop.key}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">
                          {rec.crop.name}
                        </h3>
                        <span className="text-sm text-slate-500">
                          ({rec.crop.nepaliName})
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        {rec.crop.category} · {rec.crop.growthDays} days to
                        harvest
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getSuitabilityStyle(
                          rec.suitability,
                        )}`}
                      >
                        {rec.suitability}
                      </span>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        Match Score: {rec.score}/100
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1">
                      <Droplets className="h-3.5 w-3.5 text-sky-600" />
                      Water:{" "}
                      <strong className="capitalize">
                        {rec.crop.waterRequirement}
                      </strong>
                    </span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1">
                      pH: {rec.crop.idealPhMin}–{rec.crop.idealPhMax}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1">
                      Seasons: {rec.crop.seasons.join(", ")}
                    </span>
                  </div>

                  <ul className="mt-4 space-y-1.5 text-xs text-slate-700">
                    {rec.reasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-700">
                      Recommended Nepal Varieties:
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {rec.crop.varieties.map((v) => (
                        <span
                          key={v}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-amber-50/70 p-3 text-xs text-amber-950">
                    <span className="font-semibold">Fertilizer Guide: </span>
                    {rec.crop.fertilizerGuide}
                  </div>

                  {isExpanded && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-slate-700">
                        Auto-Generated Farming Stages ({rec.crop.stages.length}{" "}
                        tasks):
                      </p>
                      <div className="space-y-2">
                        {rec.crop.stages.map((stage, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-2 text-xs"
                          >
                            <div>
                              <span className="font-medium text-slate-800">
                                {stage.title}
                              </span>
                              <p className="text-slate-500">
                                {stage.description}
                              </p>
                            </div>
                            <span className="shrink-0 rounded bg-white px-2 py-0.5 font-medium text-slate-600">
                              Day {stage.dayOffset}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCropKey(isExpanded ? null : rec.crop.key)
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    {isExpanded ? (
                      <>
                        Hide Stages <ChevronUp className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Preview {rec.crop.stages.length} Stages{" "}
                        <ChevronDown className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openRegisterModal(rec.crop)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                  >
                    <Plus className="h-4 w-4" />
                    Register Crop
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register Crop Modal */}
      {modalCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Register {modalCrop.name}
                </h2>
                <p className="text-xs text-slate-500">
                  Farm: {activeFarm.name} ({activeFarm.area_hectares} ha total)
                </p>
              </div>
              <button
                type="button"
                onClick={closeRegisterModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleRegisterCrop(e)}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Variety
                </label>
                <select
                  value={variety}
                  onChange={(e) => setVariety(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  {modalCrop.varieties.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Sowing Date
                </label>
                <input
                  type="date"
                  required
                  value={sowingDate}
                  onChange={(e) => setSowingDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Cultivated Area (hectares)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={areaHectares}
                  onChange={(e) => setAreaHectares(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
                <p>
                  <span className="font-semibold">Expected Harvest:</span>{" "}
                  {sowingDate
                    ? addDaysToDate(sowingDate, modalCrop.growthDays)
                    : "—"}{" "}
                  ({modalCrop.growthDays} days)
                </p>
                <p className="mt-1">
                  <span className="font-semibold">Calendar Automation:</span>{" "}
                  {modalCrop.stages.length} stage tasks will be added to your
                  farm calendar.
                </p>
              </div>

              {submitError && (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {submitError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeRegisterModal}
                  disabled={submitting}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Registering..." : "Confirm & Generate Tasks"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}