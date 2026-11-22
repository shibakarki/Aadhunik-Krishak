import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  Database,
  Droplets,
  Edit3,
  Lightbulb,
  Loader2,
  MapPin,
  MessageSquare,
  Mountain,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  deleteCropCatalogItem,
  evaluateCropWithGemini,
  fetchAdminOverview,
  fetchCropCatalog,
  makeCropKey,
  seedDefaultNepalCrops,
  updateFeedbackStatus,
  upsertCropCatalogItem,
  type AdminFeedbackItem,
  type AdminOverviewData,
} from '../services/adminCropService';
import type {
  ActivityType,
  AgroZone,
  CropStageTemplate,
  NepalCrop,
  NepalSeason,
  WaterRequirement,
} from '../types';

type AdminTab = 'farmers' | 'crops' | 'feedback';

const CATEGORIES: NepalCrop['category'][] = [
  'Cereal',
  'Vegetable',
  'Pulse',
  'Oilseed',
  'Cash Crop',
];
const ALL_ZONES: AgroZone[] = ['Terai', 'Hill', 'Mountain'];
const ALL_SEASONS: NepalSeason[] = ['Monsoon', 'Winter', 'Spring'];
const ACTIVITY_TYPES: ActivityType[] = [
  'sowing',
  'irrigation',
  'fertilizer',
  'weeding',
  'pest_check',
  'harvest',
];

function createEmptyCrop(): NepalCrop {
  return {
    key: '',
    name: '',
    nepaliName: '',
    category: 'Vegetable',
    agroZones: ['Terai', 'Hill'],
    seasons: ['Spring'],
    minElevationM: 100,
    maxElevationM: 1800,
    minTempC: 15,
    maxTempC: 30,
    idealPhMin: 5.5,
    idealPhMax: 7.0,
    waterRequirement: 'medium',
    growthDays: 90,
    fertilizerGuide: '',
    varieties: [],
    stages: [
      {
        dayOffset: 0,
        title: 'Sowing / Planting',
        description: 'Prepare seedbed and sow seeds in moist soil.',
        activity_type: 'sowing',
      },
    ],
  };
}

export function Admin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('farmers');

  const [overview, setOverview] = useState<AdminOverviewData>({
    profiles: [],
    farms: [],
    crops: [],
    feedback: [],
  });
  const [catalog, setCatalog] = useState<NepalCrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Crop upload & Gemini evaluation form state
  const [formCrop, setFormCrop] = useState<NepalCrop>(createEmptyCrop());
  const [varietiesText, setVarietiesText] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [evaluatingAi, setEvaluatingAi] = useState(false);
  const [savingCrop, setSavingCrop] = useState(false);
  const [seedingDefaults, setSeedingDefaults] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, catalogData] = await Promise.all([
        fetchAdminOverview(),
        fetchCropCatalog().catch(() => [] as NepalCrop[]),
      ]);
      setOverview(overviewData);
      setCatalog(catalogData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load admin data. Check that Shiba has run the Admin SQL.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const farmsByUser = useMemo(() => {
    const map = new Map<string, AdminOverviewData['farms']>();
    for (const farm of overview.farms) {
      const list = map.get(farm.user_id) ?? [];
      list.push(farm);
      map.set(farm.user_id, list);
    }
    return map;
  }, [overview.farms]);

  const cropsByUser = useMemo(() => {
    const map = new Map<string, AdminOverviewData['crops']>();
    for (const crop of overview.crops) {
      const list = map.get(crop.user_id) ?? [];
      list.push(crop);
      map.set(crop.user_id, list);
    }
    return map;
  }, [overview.crops]);

  const profileNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of overview.profiles) {
      map.set(p.id, p.full_name || 'Unnamed Farmer');
    }
    return map;
  }, [overview.profiles]);

  const farmNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of overview.farms) {
      map.set(f.id, f.name);
    }
    return map;
  }, [overview.farms]);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return overview.profiles;
    return overview.profiles.filter((p) => {
      const userFarms = farmsByUser.get(p.id) ?? [];
      const farmText = userFarms
        .map((f) => `${f.name} ${f.district ?? ''} ${f.agro_zone ?? ''}`)
        .join(' ')
        .toLowerCase();
      return (
        p.full_name.toLowerCase().includes(q) ||
        (p.phone ?? '').toLowerCase().includes(q) ||
        (p.district ?? '').toLowerCase().includes(q) ||
        farmText.includes(q)
      );
    });
  }, [overview.profiles, farmsByUser, searchQuery]);

  const handleToggleZone = (zone: AgroZone) => {
    setFormCrop((prev) => {
      const exists = prev.agroZones.includes(zone);
      const next = exists
        ? prev.agroZones.filter((z) => z !== zone)
        : [...prev.agroZones, zone];
      return { ...prev, agroZones: next.length > 0 ? next : [zone] };
    });
  };

  const handleToggleSeason = (season: NepalSeason) => {
    setFormCrop((prev) => {
      const exists = prev.seasons.includes(season);
      const next = exists
        ? prev.seasons.filter((s) => s !== season)
        : [...prev.seasons, season];
      return { ...prev, seasons: next.length > 0 ? next : [season] };
    });
  };

  const handleEvaluateWithGemini = async () => {
    setError(null);
    setNotice(null);

    if (!formCrop.name.trim()) {
      setError('Enter a crop name first before evaluating with Gemini AI.');
      return;
    }

    setEvaluatingAi(true);
    try {
      const evaluated = await evaluateCropWithGemini({
        name: formCrop.name.trim(),
        nepaliName: formCrop.nepaliName.trim() || undefined,
        category: formCrop.category,
        varietiesHint: varietiesText.trim() || undefined,
        notes: aiNotes.trim() || undefined,
      });

      setFormCrop(evaluated);
      setVarietiesText(evaluated.varieties.join(', '));
      setNotice(
        `Gemini AI evaluated "${evaluated.name}" (watering, growth days, elevation, pH, fertilizer & ${evaluated.stages.length} stages). Review below and click Save Crop to Database!`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gemini evaluation failed.'
      );
    } finally {
      setEvaluatingAi(false);
    }
  };

  const handleSaveCrop = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!formCrop.name.trim() || !formCrop.nepaliName.trim()) {
      setError('Please enter both Crop Name and Nepali Name.');
      return;
    }

    const varieties = varietiesText
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    const cropToSave: NepalCrop = {
      ...formCrop,
      key: makeCropKey(formCrop.key || formCrop.name),
      varieties,
    };

    setSavingCrop(true);
    try {
      await upsertCropCatalogItem(cropToSave, user?.id);
      const updatedCatalog = await fetchCropCatalog();
      setCatalog(updatedCatalog);
      setNotice(`Saved "${cropToSave.name}" to the crop database!`);
      setFormCrop(createEmptyCrop());
      setVarietiesText('');
      setAiNotes('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save crop. Verify Shiba ran the crop_catalog SQL.'
      );
    } finally {
      setSavingCrop(false);
    }
  };

  const handleSeedDefaults = async () => {
    setError(null);
    setNotice(null);
    setSeedingDefaults(true);
    try {
      const count = await seedDefaultNepalCrops(user?.id);
      const updatedCatalog = await fetchCropCatalog();
      setCatalog(updatedCatalog);
      setNotice(
        `Synced ${count} default Nepal crops from static data into Supabase!`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to seed default crops into Supabase.'
      );
    } finally {
      setSeedingDefaults(false);
    }
  };

  const handleEditCatalogCrop = (crop: NepalCrop) => {
    setFormCrop(crop);
    setVarietiesText(crop.varieties.join(', '));
    setNotice(`Loaded "${crop.name}" into the editor.`);
  };

  const handleDeleteCatalogCrop = async (crop: NepalCrop) => {
    setError(null);
    setNotice(null);
    try {
      await deleteCropCatalogItem(crop.key);
      setCatalog((prev) => prev.filter((c) => c.key !== crop.key));
      setNotice(`Deleted "${crop.name}" from crop database.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const handleStageChange = (
    index: number,
    patch: Partial<CropStageTemplate>
  ) => {
    setFormCrop((prev) => ({
      ...prev,
      stages: prev.stages.map((st, idx) =>
        idx === index ? { ...st, ...patch } : st
      ),
    }));
  };

  const handleAddStage = () => {
    setFormCrop((prev) => ({
      ...prev,
      stages: [
        ...prev.stages,
        {
          dayOffset: prev.growthDays,
          title: 'Irrigation / Care',
          description: 'Water thoroughly and inspect crop health.',
          activity_type: 'irrigation',
        },
      ],
    }));
  };

  const handleRemoveStage = (index: number) => {
    setFormCrop((prev) => ({
      ...prev,
      stages: prev.stages.filter((_, idx) => idx !== index),
    }));
  };

  const handleFeedbackStatusChange = async (
    id: string,
    status: AdminFeedbackItem['status']
  ) => {
    setError(null);
    try {
      await updateFeedbackStatus(id, status);
      setOverview((prev) => ({
        ...prev,
        feedback: prev.feedback.map((item) =>
          item.id === id ? { ...item, status } : item
        ),
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update feedback status.'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Developer Admin Console
          </span>
          <h1 className="text-2xl font-bold text-slate-900">
            Platform Management
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            View farmer profiles &amp; selected lands, manage AI-evaluated crop
            catalog, and review farmer feedback.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Registered Farmers</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {overview.profiles.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Pinned Farmlands</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">
            {overview.farms.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Master Crop Catalog</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {catalog.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Open Feedback</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {overview.feedback.filter((f) => f.status === 'open').length}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('farmers')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === 'farmers'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Farmers &amp; Lands ({overview.profiles.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('crops')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === 'crops'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          Crop Database &amp; AI Upload ({catalog.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('feedback')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === 'feedback'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Farmer Feedback ({overview.feedback.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-emerald-700 gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-medium">Loading admin records...</span>
        </div>
      ) : null}

      {/* TAB 1: FARMERS & SELECTED LANDS */}
      {!loading && activeTab === 'farmers' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search farmer name, phone, district, or farm..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {filteredProfiles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              No matching farmer profiles found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProfiles.map((farmer) => {
                const farmerFarms = farmsByUser.get(farmer.id) ?? [];
                const farmerCrops = cropsByUser.get(farmer.id) ?? [];

                return (
                  <div
                    key={farmer.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {farmer.full_name || 'Unnamed Farmer'}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {farmer.phone || 'No phone provided'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {farmer.district || 'No district'}
                          </span>
                          <span>
                            Joined:{' '}
                            {new Date(farmer.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {farmerFarms.length} Land(s)
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                          {farmerCrops.length} Crop(s)
                        </span>
                      </div>
                    </div>

                    {/* Selected Lands */}
                    {farmerFarms.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {farmerFarms.map((farm) => (
                          <div
                            key={farm.id}
                            className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 text-sm">
                                {farm.name}
                              </span>
                              {farm.agro_zone && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                                  {farm.agro_zone}
                                </span>
                              )}
                            </div>
                            <p className="text-slate-600">
                              District: {farm.district || 'N/A'} &bull; Area:{' '}
                              {farm.area_hectares} ha
                              {farm.elevation_m !== null
                                ? ` • Elevation: ${farm.elevation_m} m`
                                : ''}
                            </p>
                            <p className="text-slate-400">
                              Coords: {farm.latitude.toFixed(4)},{' '}
                              {farm.longitude.toFixed(4)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No farmland pinned yet.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CROP DATABASE & GEMINI AI UPLOAD */}
      {!loading && activeTab === 'crops' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Upload / AI Evaluation Form */}
          <form
            onSubmit={handleSaveCrop}
            className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Add / Update Crop with Gemini AI
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter basic crop details, click Evaluate with Gemini AI to
                  auto-fill watering times &amp; agronomic data, then save.
                </p>
              </div>

              <button
                type="button"
                onClick={handleEvaluateWithGemini}
                disabled={evaluatingAi}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer"
              >
                {evaluatingAi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Evaluating with Gemini...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Evaluate Details with Gemini AI
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Crop Name *
                </label>
                <input
                  type="text"
                  required
                  value={formCrop.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormCrop((prev) => ({
                      ...prev,
                      name,
                      key: prev.key || makeCropKey(name),
                    }));
                  }}
                  placeholder="e.g. Strawberry"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nepali Name *
                </label>
                <input
                  type="text"
                  required
                  value={formCrop.nepaliName}
                  onChange={(e) =>
                    setFormCrop((prev) => ({
                      ...prev,
                      nepaliName: e.target.value,
                    }))
                  }
                  placeholder="e.g. स्ट्रबेरी (Strawberry)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={formCrop.category}
                  onChange={(e) =>
                    setFormCrop((prev) => ({
                      ...prev,
                      category: e.target.value as NepalCrop['category'],
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Varieties (comma-separated)
                </label>
                <input
                  type="text"
                  value={varietiesText}
                  onChange={(e) => setVarietiesText(e.target.value)}
                  placeholder="e.g. Nyoho, Camarosa, Sweet Charlie"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Extra Notes for AI (optional)
                </label>
                <input
                  type="text"
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  placeholder="e.g. Grown in Nuwakot hills, drip irrigation"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Agro Zones & Seasons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Agro-Ecological Zones
                </span>
                <div className="flex flex-wrap gap-2">
                  {ALL_ZONES.map((zone) => {
                    const active = formCrop.agroZones.includes(zone);
                    return (
                      <button
                        key={zone}
                        type="button"
                        onClick={() => handleToggleZone(zone)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        {zone}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Planting Seasons
                </span>
                <div className="flex flex-wrap gap-2">
                  {ALL_SEASONS.map((season) => {
                    const active = formCrop.seasons.includes(season);
                    return (
                      <button
                        key={season}
                        type="button"
                        onClick={() => handleToggleSeason(season)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        {season}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Numeric Agronomic Params */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Min Elev (m)
                </label>
                <input
                  type="number"
                  value={formCrop.minElevationM}
                  onChange={(e) =>
                    setFormCrop((p) => ({
                      ...p,
                      minElevationM: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Elev (m)
                </label>
                <input
                  type="number"
                  value={formCrop.maxElevationM}
                  onChange={(e) =>
                    setFormCrop((p) => ({
                      ...p,
                      maxElevationM: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Min Temp (&deg;C)
                </label>
                <input
                  type="number"
                  step="any"
                  value={formCrop.minTempC}
                  onChange={(e) =>
                    setFormCrop((p) => ({
                      ...p,
                      minTempC: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Temp (&deg;C)
                </label>
                <input
                  type="number"
                  step="any"
                  value={formCrop.maxTempC}
                  onChange={(e) =>
                    setFormCrop((p) => ({
                      ...p,
                      maxTempC: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ideal pH Min
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formCrop.idealPhMin}
                  onChange={(e) =>
                    setFormCrop((p) => ({
                      ...p,
                      idealPhMin: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ideal pH Max
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formCrop.idealPhMax}
                  onChange={(e) =>
                    setFormCrop((p) => ({
                      ...p,
                      idealPhMax: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Water Needs
                </label>
                <select
                  value={formCrop.waterRequirement}
                  onChange={(e) =>
                    setFormCrop((p) => ({
                      ...p,
                      waterRequirement: e.target.value as WaterRequirement,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Growth Days
                </label>
                <input
                  type="number"
                  value={formCrop.growthDays}
                  onChange={(e) =>
                    setFormCrop((p) => ({
                      ...p,
                      growthDays: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fertilizer Guide
              </label>
              <textarea
                rows={2}
                value={formCrop.fertilizerGuide}
                onChange={(e) =>
                  setFormCrop((p) => ({ ...p, fertilizerGuide: e.target.value }))
                }
                placeholder="Basal & top-dress fertilizer schedule..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Watering & Growth Stages */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-sky-600" />
                  Growth &amp; Watering Schedule Stages ({formCrop.stages.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddStage}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Stage
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {formCrop.stages.map((stage, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2"
                  >
                    <div className="grid grid-cols-12 gap-2">
                      <input
                        type="number"
                        min={0}
                        value={stage.dayOffset}
                        onChange={(e) =>
                          handleStageChange(idx, {
                            dayOffset: Number(e.target.value),
                          })
                        }
                        title="Day offset"
                        className="col-span-3 sm:col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                      <select
                        value={stage.activity_type}
                        onChange={(e) =>
                          handleStageChange(idx, {
                            activity_type: e.target.value as ActivityType,
                          })
                        }
                        className="col-span-9 sm:col-span-3 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      >
                        {ACTIVITY_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={stage.title}
                        onChange={(e) =>
                          handleStageChange(idx, { title: e.target.value })
                        }
                        placeholder="Stage title"
                        className="col-span-10 sm:col-span-6 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveStage(idx)}
                        aria-label="Remove stage"
                        className="col-span-2 sm:col-span-1 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={stage.description}
                      onChange={(e) =>
                        handleStageChange(idx, { description: e.target.value })
                      }
                      placeholder="Stage / watering instruction..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="submit"
                disabled={savingCrop}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
              >
                {savingCrop ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving to Supabase...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Crop to Database
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormCrop(createEmptyCrop());
                  setVarietiesText('');
                  setAiNotes('');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Reset Form
              </button>
            </div>
          </form>

          {/* Saved Crop Catalog */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 h-fit">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Database Crops ({catalog.length})
              </h2>
              <button
                type="button"
                onClick={handleSeedDefaults}
                disabled={seedingDefaults}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                {seedingDefaults ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sprout className="w-3.5 h-3.5" />
                )}
                Sync 10 Default Crops
              </button>
            </div>

            {catalog.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 space-y-2">
                <p>No crops in `crop_catalog` table yet.</p>
                <p>
                  Click <strong>Sync 10 Default Crops</strong> above to populate
                  your existing Nepal crop database, or add a new crop on the
                  left!
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
                {catalog.map((crop) => (
                  <li
                    key={crop.key}
                    className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/60 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {crop.name}{' '}
                          <span className="font-normal text-slate-500">
                            ({crop.nepaliName})
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {crop.category} &bull; Water: {crop.waterRequirement}{' '}
                          &bull; {crop.growthDays} days
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditCatalogCrop(crop)}
                          title="Edit crop"
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-emerald-700 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteCatalogCrop(crop)}
                          title="Delete crop"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        <Mountain className="w-3 h-3" />
                        {crop.minElevationM}–{crop.maxElevationM}m
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                        {crop.agroZones.join(', ')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                        {crop.stages.length} stages
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FARMER FEEDBACK */}
      {!loading && activeTab === 'feedback' && (
        <div className="space-y-3">
          {overview.feedback.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              No farmer feedback submitted yet.
            </div>
          ) : (
            overview.feedback.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                        item.category === 'issue'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : item.category === 'feature'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-sky-50 text-sky-700 border-sky-200'
                      }`}
                    >
                      {item.category === 'issue' ? (
                        <Bug className="w-3 h-3" />
                      ) : item.category === 'feature' ? (
                        <Lightbulb className="w-3 h-3" />
                      ) : (
                        <MessageSquare className="w-3 h-3" />
                      )}
                      {item.category}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {profileNameById.get(item.user_id) ?? 'Farmer'}
                    </span>
                    {item.farm_id && (
                      <span className="text-xs text-slate-400">
                        &bull; Farm: {farmNameById.get(item.farm_id) ?? 'Unknown'}
                      </span>
                    )}
                  </div>

                  <select
                    aria-label="Update feedback status"
                    value={item.status}
                    onChange={(e) =>
                      void handleFeedbackStatusChange(
                        item.id,
                        e.target.value as AdminFeedbackItem['status']
                      )
                    }
                    className="px-3 py-1 rounded-lg border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-800"
                  >
                    <option value="open">Open</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <h3 className="text-sm font-bold text-slate-900">
                  {item.subject}
                </h3>
                <p className="text-xs text-slate-600 whitespace-pre-line">
                  {item.description}
                </p>
                <p className="text-[11px] text-slate-400">
                  Area: {item.page_area || 'General'} &bull;{' '}
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}