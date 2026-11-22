import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  FlaskConical,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import {
  classifySoilTexture,
  extractSoilReportFromFile,
  getRegionalSoilFallback,
} from '../services/soilService';
import type { Farm, SoilData } from '../types';

interface SoilReportModalProps {
  isOpen: boolean;
  farm: Farm;
  currentSoil: SoilData | null;
  onClose: () => void;
  onSaved: (savedSoil: SoilData) => void;
  onReset: () => void;
}

export function SoilReportModal({
  isOpen,
  farm,
  currentSoil,
  onClose,
  onSaved,
  onReset,
}: SoilReportModalProps) {
  const { lang } = useLanguage();
  const { refreshFarms } = useFarm();

  const [ph, setPh] = useState('6.2');
  const [organicCarbon, setOrganicCarbon] = useState('15.0');
  const [nitrogen, setNitrogen] = useState('1.5');
  const [phosphorus, setPhosphorus] = useState('');
  const [potassium, setPotassium] = useState('');
  const [clay, setClay] = useState('22');
  const [sand, setSand] = useState('42');
  const [silt, setSilt] = useState('36');
  const [textureClass, setTextureClass] = useState('Loam');
  const [labName, setLabName] = useState('');
  const [testDate, setTestDate] = useState('');
  const [reportNotes, setReportNotes] = useState('');

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractMessage, setExtractMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const baseline =
      farm.soil_report ??
      currentSoil ??
      getRegionalSoilFallback(farm.agro_zone ?? 'Hill');

    setPh(String(baseline.ph ?? 6.2));
    setOrganicCarbon(String(baseline.organicCarbonGKg ?? 15));
    setNitrogen(String(baseline.nitrogenGKg ?? 1.5));
    setPhosphorus(
      baseline.phosphorusKgHa != null ? String(baseline.phosphorusKgHa) : ''
    );
    setPotassium(
      baseline.potassiumKgHa != null ? String(baseline.potassiumKgHa) : ''
    );
    setClay(String(baseline.clayPercent ?? 22));
    setSand(String(baseline.sandPercent ?? 42));
    setSilt(String(baseline.siltPercent ?? 36));
    setTextureClass(baseline.textureClass || 'Loam');
    setLabName(baseline.labName ?? '');
    setTestDate(baseline.testDate ?? '');
    setReportNotes(baseline.reportNotes ?? '');

    setSelectedFileName(null);
    setExtractMessage(null);
    setError(null);
  }, [isOpen, farm, currentSoil]);

  if (!isOpen) return null;

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setError(null);
    setExtractMessage(null);
    setExtracting(true);

    try {
      const extracted = await extractSoilReportFromFile(file);

      let filledCount = 0;
      if (extracted.ph !== undefined) {
        setPh(String(extracted.ph));
        filledCount++;
      }
      if (extracted.organicCarbonGKg !== undefined) {
        setOrganicCarbon(String(extracted.organicCarbonGKg));
        filledCount++;
      }
      if (extracted.nitrogenGKg !== undefined) {
        setNitrogen(String(extracted.nitrogenGKg));
        filledCount++;
      }
      if (extracted.phosphorusKgHa !== undefined) {
        setPhosphorus(String(extracted.phosphorusKgHa));
        filledCount++;
      }
      if (extracted.potassiumKgHa !== undefined) {
        setPotassium(String(extracted.potassiumKgHa));
        filledCount++;
      }
      if (extracted.clayPercent !== undefined) {
        setClay(String(extracted.clayPercent));
        filledCount++;
      }
      if (extracted.sandPercent !== undefined) {
        setSand(String(extracted.sandPercent));
        filledCount++;
      }
      if (extracted.siltPercent !== undefined) {
        setSilt(String(extracted.siltPercent));
        filledCount++;
      }
      if (extracted.textureClass) {
        setTextureClass(extracted.textureClass);
        filledCount++;
      } else if (
        extracted.clayPercent !== undefined &&
        extracted.sandPercent !== undefined &&
        extracted.siltPercent !== undefined
      ) {
        setTextureClass(
          classifySoilTexture(
            extracted.clayPercent,
            extracted.sandPercent,
            extracted.siltPercent
          )
        );
      }
      if (extracted.labName) setLabName(extracted.labName);
      if (extracted.testDate) setTestDate(extracted.testDate);
      if (extracted.reportNotes) setReportNotes(extracted.reportNotes);

      setExtractMessage(
        filledCount > 0
          ? lang === 'ne'
            ? `AI ले प्रतिवेदनबाट ${filledCount} वटा विवरण पढ्यो। कृपया जाँच गरी सुरक्षित गर्नुहोस्।`
            : `AI extracted ${filledCount} fields from your report. Review and save below to update analysis.`
          : lang === 'ne'
            ? 'प्रतिवेदनबाट मान पढ्न सकिएन। कृपया तल म्यानुअल रूपमा भर्नुहोस्।'
            : 'Could not detect clear lab values in this file. Please enter values manually below.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to read soil report file.'
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleTexturePercentChange = (
    nextClayStr: string,
    nextSandStr: string,
    nextSiltStr: string
  ) => {
    setClay(nextClayStr);
    setSand(nextSandStr);
    setSilt(nextSiltStr);

    const c = Number.parseFloat(nextClayStr);
    const sa = Number.parseFloat(nextSandStr);
    const si = Number.parseFloat(nextSiltStr);
    if (Number.isFinite(c) && Number.isFinite(sa) && Number.isFinite(si)) {
      setTextureClass(classifySoilTexture(c, sa, si));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedPh = Number.parseFloat(ph);
    const parsedOc = Number.parseFloat(organicCarbon);
    const parsedN = Number.parseFloat(nitrogen);
    const parsedClay = Number.parseFloat(clay);
    const parsedSand = Number.parseFloat(sand);
    const parsedSilt = Number.parseFloat(silt);
    const parsedP = phosphorus.trim() ? Number.parseFloat(phosphorus) : null;
    const parsedK = potassium.trim() ? Number.parseFloat(potassium) : null;

    if (!Number.isFinite(parsedPh) || parsedPh < 3 || parsedPh > 10) {
      setError(
        lang === 'ne'
          ? 'माटोको pH ३.० देखि १०.० को बीचमा हुनुपर्छ।'
          : 'Soil pH must be between 3.0 and 10.0.'
      );
      return;
    }

    if (
      !Number.isFinite(parsedOc) ||
      parsedOc < 0 ||
      !Number.isFinite(parsedN) ||
      parsedN < 0
    ) {
      setError(
        lang === 'ne'
          ? 'कृपया जैविक कार्बन र नाइट्रोजनको मान्य मान लेख्नुहोस्।'
          : 'Please enter valid non-negative Organic Carbon and Nitrogen values.'
      );
      return;
    }

    if (
      !Number.isFinite(parsedClay) ||
      !Number.isFinite(parsedSand) ||
      !Number.isFinite(parsedSilt) ||
      parsedClay < 0 ||
      parsedSand < 0 ||
      parsedSilt < 0
    ) {
      setError(
        lang === 'ne'
          ? 'चिम्टाइलो, बालुवा र पाँगो प्रतिशत ० वा सोभन्दा बढी हुनुपर्छ।'
          : 'Clay, Sand, and Silt percentages must be 0 or greater.'
      );
      return;
    }

    const nextSoilReport: SoilData = {
      ph: Math.round(parsedPh * 10) / 10,
      organicCarbonGKg: Math.round(parsedOc * 10) / 10,
      nitrogenGKg: Math.round(parsedN * 100) / 100,
      clayPercent: Math.round(parsedClay),
      sandPercent: Math.round(parsedSand),
      siltPercent: Math.round(parsedSilt),
      textureClass: textureClass.trim() || 'Loam',
      source: 'Lab Soil Report',
      phosphorusKgHa:
        parsedP !== null && Number.isFinite(parsedP) ? parsedP : null,
      potassiumKgHa:
        parsedK !== null && Number.isFinite(parsedK) ? parsedK : null,
      labName: labName.trim() || null,
      testDate: testDate.trim() || null,
      reportNotes: reportNotes.trim() || null,
      uploadedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('farms')
        .update({
          soil_report: nextSoilReport,
          soil_ph: nextSoilReport.ph,
          soil_type: nextSoilReport.textureClass,
        })
        .eq('id', farm.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await refreshFarms(farm.id);
      onSaved(nextSoilReport);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save soil report.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleResetToSatellite = async () => {
    setError(null);
    setResetting(true);

    try {
      const { error: updateError } = await supabase
        .from('farms')
        .update({
          soil_report: null,
          soil_ph: null,
          soil_type: null,
        })
        .eq('id', farm.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await refreshFarms(farm.id);
      onReset();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to reset to satellite soil data.'
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {lang === 'ne'
                  ? 'माटो परीक्षण प्रतिवेदन अपलोड गर्नुहोस्'
                  : 'Upload Soil Test Report'}
              </h2>
              <p className="text-xs text-slate-500">
                {farm.name} —{' '}
                {lang === 'ne'
                  ? 'बचत गरेपछि भूमि र बाली सिफारिस विश्लेषण स्वतः अद्यावधिक हुन्छ।'
                  : 'Updates both Land Intelligence and Crop Recommendations automatically.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving || resetting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* AI File Upload Zone */}
        <div className="mt-4 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {lang === 'ne'
                    ? 'फोटो वा PDF बाट AI द्वारा मान निकाल्नुहोस्'
                    : 'Auto-Extract from Lab Report (Photo or PDF)'}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {selectedFileName ? (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                      <FileText className="h-3.5 w-3.5" />
                      {selectedFileName}
                    </span>
                  ) : lang === 'ne' ? (
                    'कृषि प्रयोगशालाको रिपोर्ट अपलोड गर्नुहोस् वा तल सिधै मान भर्नुहोस्।'
                  ) : (
                    'Upload a JPG, PNG, WebP, or PDF soil card — or edit values manually below.'
                  )}
                </p>
              </div>
            </div>

            <label className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white cursor-pointer transition-colors">
              {extracting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {lang === 'ne' ? 'पढ्दैछ...' : 'Scanning...'}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {lang === 'ne' ? 'रिपोर्ट छान्नुहोस्' : 'Choose File'}
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                disabled={extracting || saving}
                onChange={(e) => void handleFileChange(e)}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {extractMessage && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>{extractMessage}</span>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          {/* Core Chemistry */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'ne' ? 'माटोको pH *' : 'Soil pH (3.0–10.0) *'}
              </label>
              <input
                type="number"
                step="0.1"
                min="3"
                max="10"
                required
                value={ph}
                onChange={(e) => setPh(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'ne' ? 'जैविक कार्बन (g/kg) *' : 'Organic Carbon (g/kg) *'}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={organicCarbon}
                onChange={(e) => setOrganicCarbon(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'ne' ? 'कुल नाइट्रोजन (g/kg) *' : 'Total Nitrogen (g/kg) *'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={nitrogen}
                onChange={(e) => setNitrogen(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Optional P, K & Texture */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'ne' ? 'फस्फोरस P₂O₅ (kg/ha)' : 'Phosphorus (kg/ha)'}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={phosphorus}
                onChange={(e) => setPhosphorus(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'ne' ? 'पोटासियम K₂O (kg/ha)' : 'Potassium (kg/ha)'}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={potassium}
                onChange={(e) => setPotassium(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'ne' ? 'माटोको प्रकार' : 'Soil Texture Class *'}
              </label>
              <input
                type="text"
                required
                value={textureClass}
                onChange={(e) => setTextureClass(e.target.value)}
                placeholder="e.g. Loam, Clay Loam"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Clay / Sand / Silt */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'ne' ? 'चिम्टाइलो (Clay %)' : 'Clay (%)'}
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                required
                value={clay}
                onChange={(e) =>
                  handleTexturePercentChange(e.target.value, sand, silt)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'ne' ? 'बालुवा (Sand %)' : 'Sand (%)'}
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                required
                value={sand}
                onChange={(e) =>
                  handleTexturePercentChange(clay, e.target.value, silt)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'ne' ? 'पाँगो (Silt %)' : 'Silt (%)'}
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                required
                value={silt}
                onChange={(e) =>
                  handleTexturePercentChange(clay, sand, e.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Lab Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'ne' ? 'प्रयोगशालाको नाम' : 'Testing Lab Name'}
              </label>
              <input
                type="text"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="e.g. NARC Soil Lab, Khumaltar"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'ne' ? 'परीक्षण मिति' : 'Test Date'}
              </label>
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {lang === 'ne' ? 'प्रयोगशाला नोट / टिप्पणी' : 'Lab Notes / Remarks'}
            </label>
            <input
              type="text"
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              placeholder="Optional summary from your soil report"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div>
              {farm.soil_report && (
                <button
                  type="button"
                  onClick={() => void handleResetToSatellite()}
                  disabled={resetting || saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
                >
                  {resetting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  {lang === 'ne'
                    ? 'उपग्रह डाटामा फर्कनुहोस्'
                    : 'Reset to Satellite Data'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || resetting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {lang === 'ne' ? 'रद्द गर्नुहोस्' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={saving || resetting || extracting}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === 'ne'
                  ? 'बचत गरी विश्लेषण अद्यावधिक गर्नुहोस्'
                  : 'Save & Update Analysis'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}