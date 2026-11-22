import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  History,
  Leaf,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { supabase } from '../lib/supabase';
import {
  analyzePlantImage,
  deleteDiseaseScan,
  fetchDiseaseScans,
  saveDiseaseScan,
  type PlantAnalysisResult,
} from '../services/plantDoctorService';
import type { DiseaseScan, RegisteredCrop } from '../types';

const SEVERITY_STYLES: Record<
  DiseaseScan['severity'],
  { label: string; badgeClass: string; borderClass: string }
> = {
  healthy: {
    label: 'Healthy',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    borderClass: 'border-emerald-200',
  },
  low: {
    label: 'Low Severity',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    borderClass: 'border-sky-200',
  },
  medium: {
    label: 'Medium Severity',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    borderClass: 'border-amber-200',
  },
  high: {
    label: 'High Severity',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    borderClass: 'border-rose-200',
  },
};

function scanToResult(scan: DiseaseScan): PlantAnalysisResult {
  return {
    cropName: scan.crop_name ?? 'Unknown Crop',
    diagnosis: scan.diagnosis,
    severity: scan.severity,
    confidence: scan.confidence ?? 'N/A',
    treatment: scan.treatment,
    preventiveMeasures:
      scan.preventive_measures ??
      'Maintain field sanitation, proper spacing, and balanced irrigation.',
  };
}

export function PlantDoctor() {
  const { user } = useAuth();
  const { activeFarm } = useFarm();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [cropHint, setCropHint] = useState('');
  const [registeredCrops, setRegisteredCrops] = useState<RegisteredCrop[]>([]);

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [activeResult, setActiveResult] = useState<PlantAnalysisResult | null>(
    null
  );
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  const [history, setHistory] = useState<DiseaseScan[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Clean up object URL on image change/unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Load registered crops for active farm
  useEffect(() => {
    async function loadFarmCrops() {
      if (!activeFarm) {
        setRegisteredCrops([]);
        return;
      }

      const { data, error: cropError } = await supabase
        .from('crops')
        .select('*')
        .eq('farm_id', activeFarm.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (!cropError && data) {
        setRegisteredCrops(data as RegisteredCrop[]);
      }
    }

    void loadFarmCrops();
  }, [activeFarm]);

  // Load past disease scans
  useEffect(() => {
    async function loadHistory() {
      if (!user) {
        setHistory([]);
        setLoadingHistory(false);
        return;
      }

      setLoadingHistory(true);
      try {
        const scans = await fetchDiseaseScans(user.id);
        setHistory(scans);
      } catch (err) {
        console.warn('Could not load scan history:', err);
      } finally {
        setLoadingHistory(false);
      }
    }

    void loadHistory();
  }, [user]);

  const handleSelectFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG, PNG, or WebP).');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setSaveNotice(null);
    setSelectedScanId(null);
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    handleSelectFile(file);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    handleSelectFile(file);
  };

  const handleClearImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
  };

  const handleDiagnose = async () => {
    if (!selectedFile) {
      setError('Please upload or capture a plant/leaf photo first.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setSaveNotice(null);

    try {
      const result = await analyzePlantImage({
        file: selectedFile,
        cropHint,
        farm: activeFarm,
      });

      setActiveResult(result);
      setSelectedScanId(null);

      if (user) {
        try {
          const saved = await saveDiseaseScan({
            userId: user.id,
            farmId: activeFarm?.id ?? null,
            result,
          });
          setHistory((prev) => [saved, ...prev]);
          setSelectedScanId(saved.id);
          setSaveNotice('Diagnosis saved to your scan history.');
        } catch (saveErr) {
          console.warn('Scan save failed:', saveErr);
          setSaveNotice(
            'Diagnosis ready (could not save to cloud history right now).'
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to analyze the plant photo. Please try again.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectHistoryItem = (scan: DiseaseScan) => {
    setActiveResult(scanToResult(scan));
    setSelectedScanId(scan.id);
    setError(null);
    setSaveNotice(null);
  };

  const handleDeleteScan = async (scanId: string) => {
    if (!user) return;
    try {
      await deleteDiseaseScan(scanId, user.id);
      setHistory((prev) => prev.filter((item) => item.id !== scanId));
      if (selectedScanId === scanId) {
        setSelectedScanId(null);
        setActiveResult(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete scan record.'
      );
    }
  };

  const severityMeta = activeResult
    ? SEVERITY_STYLES[activeResult.severity]
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            <Stethoscope className="h-3.5 w-3.5" />
            AI Plant Doctor
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Instant Crop Disease Diagnosis
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Upload a leaf or plant photo to detect diseases, pests, or nutrient
            deficiencies and get practical treatment steps for Nepal.
          </p>
        </div>

        <div className="shrink-0">
          {activeFarm ? (
            <div className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs text-slate-700 shadow-xs">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                <MapPin className="h-3.5 w-3.5" />
                {activeFarm.name}
              </div>
              <div className="mt-0.5 text-slate-500">
                {[activeFarm.district, activeFarm.agro_zone]
                  .filter(Boolean)
                  .join(' • ') || 'Active farm context attached'}
              </div>
            </div>
          ) : (
            <Link
              to="/farms/new"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
            >
              <MapPin className="h-3.5 w-3.5" />
              Add/Select a Farm (Optional)
            </Link>
          )}
        </div>
      </div>

      {/* Main 2-column workspace */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Upload & Controls */}
        <div className="space-y-5 lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              1. Upload Plant / Leaf Photo
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              For best accuracy, take a close, well-lit photo of the affected
              leaf or stem.
            </p>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {!previewUrl ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-300 bg-slate-50/70 hover:border-emerald-400 hover:bg-emerald-50/40'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-800">
                  Click to upload or drag & drop photo
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Supports JPG, PNG, WebP
                </p>
              </div>
            ) : (
              <div className="relative mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                <img
                  src={previewUrl}
                  alt="Selected plant leaf"
                  className="h-64 w-full object-contain"
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  aria-label="Remove image"
                  className="absolute top-2.5 right-2.5 rounded-full bg-slate-900/75 p-1.5 text-white transition hover:bg-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Quick action buttons */}
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Choose File
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Camera className="h-3.5 w-3.5" />
                Use Camera
              </button>
            </div>

            {/* Crop Hint Input */}
            <div className="mt-5 space-y-2">
              <label
                htmlFor="crop-hint"
                className="block text-xs font-semibold text-slate-700"
              >
                2. Crop Name (Optional — AI can auto-detect)
              </label>
              <input
                id="crop-hint"
                type="text"
                value={cropHint}
                onChange={(e) => setCropHint(e.target.value)}
                placeholder="e.g., Tomato, Rice, Potato, Maize..."
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
              />

              {registeredCrops.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500">
                    Your crops:
                  </span>
                  {registeredCrops.map((crop) => (
                    <button
                      key={crop.id}
                      type="button"
                      onClick={() => setCropHint(crop.crop_name)}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                        cropHint.toLowerCase() === crop.crop_name.toLowerCase()
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {crop.crop_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleDiagnose}
              disabled={analyzing || !selectedFile}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Plant Photo...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Diagnose & Get Solutions
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Diagnosis Result */}
        <div className="space-y-5 lg:col-span-7">
          {analyzing ? (
            <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                Inspecting leaf symptoms...
              </h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Checking disease patterns, pest signs, and preparing tailored
                treatment recommendations for your farm.
              </p>
            </div>
          ) : activeResult && severityMeta ? (
            <div
              className={`rounded-2xl border bg-white p-6 shadow-sm ${severityMeta.borderClass}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      <Leaf className="h-3 w-3 text-emerald-600" />
                      {activeResult.cropName}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${severityMeta.badgeClass}`}
                    >
                      {severityMeta.label}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      Confidence: {activeResult.confidence}
                    </span>
                  </div>
                  <h2 className="mt-2.5 text-xl font-bold text-slate-900">
                    Diagnosis
                  </h2>
                </div>
              </div>

              {saveNotice && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{saveNotice}</span>
                </div>
              )}

              <div className="mt-4 space-y-5">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm leading-relaxed text-slate-800">
                    {activeResult.diagnosis}
                  </p>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Stethoscope className="h-4 w-4 text-emerald-600" />
                    Suggested Solutions & Treatment
                  </h3>
                  <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm leading-relaxed whitespace-pre-line text-slate-800">
                    {activeResult.treatment}
                  </div>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ShieldCheck className="h-4 w-4 text-teal-600" />
                    Preventive Measures
                  </h3>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed whitespace-pre-line text-slate-700">
                    {activeResult.preventiveMeasures}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Leaf className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                Ready to Diagnose Your Crop
              </h3>
              <p className="mt-1.5 max-w-md text-sm text-slate-500">
                Upload a photo on the left and click{' '}
                <span className="font-semibold text-slate-700">
                  Diagnose & Get Solutions
                </span>
                . Your AI diagnosis, severity level, and treatment plan will
                appear here.
              </p>
            </div>
          )}

          {/* Recent Scan History */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <History className="h-4 w-4 text-emerald-600" />
                Recent Scan History
              </h2>
              <span className="text-xs text-slate-500">
                {history.length} {history.length === 1 ? 'scan' : 'scans'}
              </span>
            </div>

            {loadingHistory ? (
              <div className="flex items-center gap-2 py-6 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading scan history...
              </div>
            ) : history.length === 0 ? (
              <p className="py-6 text-xs text-slate-500">
                No past scans yet. Your diagnosed plant photos will appear here
                automatically.
              </p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {history.map((scan) => {
                  const badge = SEVERITY_STYLES[scan.severity];
                  const isSelected = selectedScanId === scan.id;
                  return (
                    <div
                      key={scan.id}
                      className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-50/40'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectHistoryItem(scan)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900">
                            {scan.crop_name || 'Plant Scan'}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.badgeClass}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(scan.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                          {scan.diagnosis}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeleteScan(scan.id)}
                        aria-label="Delete scan"
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}