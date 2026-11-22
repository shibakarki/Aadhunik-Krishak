import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  Calendar,
  CheckCircle2,
  CloudRain,
  Cpu,
  Loader2,
  Minus,
  Search,
  Sparkles,
  ThermometerSun,
  TrendingDown,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import {
  buildDefaultDataset,
  evaluateCommodityPrices,
  fetchMarketWeatherContext,
  parseFullKalimatiCsv,
  type CommodityEvaluationResult,
  type MarketWeatherContext,
  type ParsedKalimatiDataset,
} from '../services/marketPriceService';

const REPO_CSV_PATH = '/data/kalimati_tarkari.csv';

export function MarketPrice() {
  const { activeFarm } = useFarm();
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [dataset, setDataset] = useState<ParsedKalimatiDataset>(() =>
    buildDefaultDataset()
  );
  const [dataSource, setDataSource] = useState<
    | 'Kalimati Repo Dataset'
    | 'Uploaded Kalimati CSV'
    | 'Kalimati Default Baseline'
  >('Kalimati Default Baseline');
  const [loadingDataset, setLoadingDataset] = useState(true);

  const [selectedCommodity, setSelectedCommodity] =
    useState<string>('Tomato Big(Nepali)');
  const [searchQuery, setSearchQuery] = useState('');

  const [weatherContext, setWeatherContext] =
    useState<MarketWeatherContext | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);

  const [datasetNotice, setDatasetNotice] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Auto-load Kalimati CSV directly from repo (/public/data/kalimati_tarkari.csv)
  useEffect(() => {
    let active = true;

    async function loadRepoCsv() {
      setLoadingDataset(true);
      try {
        const res = await fetch(REPO_CSV_PATH);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const text = await res.text();
        if (text.trimStart().startsWith('<')) {
          throw new Error('Dataset file not found in /public/data/');
        }

        const parsed = parseFullKalimatiCsv(text);
        if (!active) return;

        setDataset(parsed);
        setDataSource('Kalimati Repo Dataset');
       

        if (!parsed.monthlyPricesByCommodity.has('Tomato Big(Nepali)')) {
          const firstTomato = parsed.commodities.find((c) =>
            c.name.toLowerCase().includes('tomato')
          );
          if (firstTomato) {
            setSelectedCommodity(firstTomato.name);
          } else if (parsed.commodities.length > 0) {
            setSelectedCommodity(parsed.commodities[0].name);
          }
        }
      } catch {
        if (!active) return;
        setDataSource('Kalimati Default Baseline');
      } finally {
        if (active) {
          setLoadingDataset(false);
        }
      }
    }

    void loadRepoCsv();
    return () => {
      active = false;
    };
  }, []);

  // Load Past (365-day Archive) + Future (14-day Forecast) Weather
  useEffect(() => {
    let active = true;
    async function loadWeather() {
      setLoadingWeather(true);
      const nextWeather = await fetchMarketWeatherContext(
        activeFarm
          ? {
              latitude: activeFarm.latitude,
              longitude: activeFarm.longitude,
              locationLabel: `${activeFarm.name}${
                activeFarm.district ? ` (${activeFarm.district})` : ''
              }`,
            }
          : undefined
      );
      if (active) {
        setWeatherContext(nextWeather);
        setLoadingWeather(false);
      }
    }

    void loadWeather();
    return () => {
      active = false;
    };
  }, [activeFarm]);

  const filteredCommodities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return dataset.commodities;
    return dataset.commodities.filter((c) => c.name.toLowerCase().includes(q));
  }, [dataset.commodities, searchQuery]);

  const handleUploadCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setCsvError(null);
    try {
      const text = await file.text();
      const parsed = parseFullKalimatiCsv(text);
      setDataset(parsed);
      setDataSource('Uploaded Kalimati CSV');

      if (
        !parsed.monthlyPricesByCommodity.has(selectedCommodity) &&
        parsed.commodities.length > 0
      ) {
        setSelectedCommodity(parsed.commodities[0].name);
      }

      setDatasetNotice(
        `Loaded ${parsed.commodities.length} commodities & ${parsed.totalRowsMatched.toLocaleString()} price rows from "${file.name}".`
      );
    } catch (err) {
      setCsvError(
        err instanceof Error ? err.message : 'Failed to parse Kalimati CSV.'
      );
    }
  };

  const evaluation: CommodityEvaluationResult | null = useMemo(() => {
    if (!weatherContext) return null;
    const validCommodity = dataset.monthlyPricesByCommodity.has(
      selectedCommodity
    )
      ? selectedCommodity
      : dataset.commodities[0]?.name;
    if (!validCommodity) return null;

    return evaluateCommodityPrices({
      commodity: validCommodity,
      dataset,
      source: dataSource,
      weather: weatherContext,
    });
  }, [dataset, dataSource, selectedCommodity, weatherContext]);

  const maxChartPrice = evaluation
    ? Math.max(
        ...evaluation.monthlySeries.map((m) =>
          Math.max(m.basePriceNpr, m.weatherAdjustedPriceNpr)
        ),
        1
      )
    : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-amber-50 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            <BarChart3 className="h-3.5 w-3.5" />
            Kalimati Market Intelligence (ML + Weather)
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Crop Price Forecast &amp; Seasonal Analysis
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pick any vegetable, fruit, or spice from the Kalimati market
            dataset to evaluate monthly prices using our Random Forest model and
            past + upcoming weather.
          </p>
        </div>

        <div className="shrink-0">
          {loadingDataset ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3.5 py-2 text-xs font-medium text-emerald-800">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading Kalimati dataset...
            </div>
          ) : dataSource === 'Kalimati Repo Dataset' ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{dataset.commodities.length} Commodities Ready</span>
            </div>
          ) : (
            <>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleUploadCsv}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-xs transition hover:bg-emerald-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Load Custom CSV
              </button>
            </>
          )}
        </div>
      </div>

      {datasetNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{datasetNotice}</span>
        </div>
      )}

      {csvError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{csvError}</span>
        </div>
      )}

      {/* Commodity Selector + Past/Future Weather Panel */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              1. Select Crop / Commodity ({dataset.commodities.length} items)
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              {dataSource}
            </span>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search (e.g. Tomato, Onion, Apple)..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pr-3 pl-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
              />
            </div>

            <select
              aria-label="Select commodity"
              value={evaluation?.commodity ?? selectedCommodity}
              onChange={(e) => setSelectedCommodity(e.target.value)}
              className="w-full rounded-xl border border-emerald-300 bg-emerald-50/50 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
            >
              {filteredCommodities.length === 0 ? (
                <option value="">No items match &quot;{searchQuery}&quot;</option>
              ) : (
                filteredCommodities.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name} ({item.unit} • {item.monthsCount} mo)
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {filteredCommodities.slice(0, 6).map((item) => {
              const active = item.name === evaluation?.commodity;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedCommodity(item.name)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    active
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  {item.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50/70 via-white to-emerald-50/50 p-5 shadow-sm lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CloudRain className="h-4 w-4 text-sky-600" />
              2. Past &amp; Future Weather Impact
            </h2>
            {weatherContext && (
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
                {weatherContext.source}
              </span>
            )}
          </div>

          {loadingWeather || !weatherContext ? (
            <p className="mt-4 text-xs text-slate-500">
              Loading historical archive &amp; 14-day weather forecast...
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <ThermometerSun className="h-3.5 w-3.5 text-amber-500" />
                    Past 12m Avg
                  </div>
                  <div className="mt-1 font-bold text-slate-900">
                    {weatherContext.pastAnnualAvgTempC}°C
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {weatherContext.pastAnnualRainMm} mm/yr
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <CloudRain className="h-3.5 w-3.5 text-sky-600" />
                    Next 14 Days
                  </div>
                  <div className="mt-1 font-bold text-slate-900">
                    {weatherContext.upcoming14dRainMm} mm
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {weatherContext.upcoming14dAvgTempC}°C avg
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="text-[11px] text-slate-500">Price Impact</div>
                  <div
                    className={`mt-1 font-bold ${
                      weatherContext.weatherImpactPct > 0
                        ? 'text-rose-600'
                        : weatherContext.weatherImpactPct < 0
                          ? 'text-emerald-700'
                          : 'text-slate-800'
                    }`}
                  >
                    {weatherContext.weatherImpactPct > 0 ? '+' : ''}
                    {weatherContext.weatherImpactPct}%
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {weatherContext.locationLabel.split('(')[0].trim()}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">
                  Weather Signal:
                </span>{' '}
                {weatherContext.weatherSummary}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Model Results & Charts */}
      {evaluation && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  Weather-Adjusted Now
                </span>
                {evaluation.trend === 'rising' ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : evaluation.trend === 'falling' ? (
                  <TrendingDown className="h-4 w-4 text-rose-500" />
                ) : (
                  <Minus className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                रू {evaluation.weatherAdjustedCurrentNpr.toFixed(1)}{' '}
                <span className="text-xs font-normal text-slate-500">
                  / {evaluation.unit}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Base model: रू {evaluation.currentPriceNpr.toFixed(1)} • Annual
                avg रू {evaluation.annualAvgNpr.toFixed(1)}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Peak Selling Month
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-900">
                {evaluation.peakMonth.monthFull}
              </div>
              <p className="mt-1 text-xs text-emerald-700">
                रू {evaluation.peakMonth.weatherAdjustedPriceNpr.toFixed(1)} /{' '}
                {evaluation.unit} ({evaluation.peakMonth.nepaliMonth})
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <TrendingDown className="h-4 w-4 text-amber-600" />
                Lowest Price Month
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-900">
                {evaluation.lowestMonth.monthFull}
              </div>
              <p className="mt-1 text-xs text-amber-700">
                रू {evaluation.lowestMonth.weatherAdjustedPriceNpr.toFixed(1)} /{' '}
                {evaluation.unit} (high supply)
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Cpu className="h-4 w-4 text-teal-600" />
                Trained Model MAE
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                ± रू {evaluation.mae.toFixed(2)}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {evaluation.monthsTrained} months •{' '}
                {evaluation.recordsUsed.toLocaleString()} rows
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    12-Month Evaluated Price — {evaluation.commodity}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {evaluation.trainingMethod} • Weather-adjusted NPR /{' '}
                    {evaluation.unit}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />{' '}
                    Peak
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" />{' '}
                    Normal
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Low
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-12 items-end gap-2 border-b border-slate-200 pb-3 pt-4">
                {evaluation.monthlySeries.map((point) => {
                  const heightPct = Math.max(
                    14,
                    Math.round(
                      (point.weatherAdjustedPriceNpr / maxChartPrice) * 100
                    )
                  );

                  const barColor =
                    point.demandLevel === 'High'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : point.demandLevel === 'Low'
                        ? 'bg-amber-400 hover:bg-amber-500'
                        : 'bg-teal-500 hover:bg-teal-600';

                  return (
                    <div
                      key={point.month}
                      title={`${point.monthFull} (${point.nepaliMonth}): Base रू ${point.basePriceNpr}, Weather-Adjusted रू ${point.weatherAdjustedPriceNpr}/${evaluation.unit}`}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <span className="text-[10px] font-semibold text-slate-700">
                        {point.weatherAdjustedPriceNpr.toFixed(0)}
                      </span>
                      <div className="flex h-44 w-full items-end justify-center">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full max-w-[30px] rounded-t-lg transition-all ${barColor}`}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-slate-600">
                        {point.monthShort}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl bg-emerald-50/70 p-4 text-xs text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    Market &amp; Weather Insight
                  </div>
                  <p className="leading-relaxed">
                    {evaluation.sellingStrategy}
                  </p>
                </div>

                <Link
                  to="/assistant"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 font-semibold text-white transition hover:bg-emerald-700"
                >
                  Ask AI Assistant
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Next 5-Month Forecast
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Weather-adjusted predictions using lag-1, lag-12 &amp; forecast
                climate features
              </p>

              <div className="mt-4 space-y-2.5">
                {evaluation.futureForecast.map((f) => (
                  <div
                    key={`${f.year}-${f.month}`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {f.label}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Base रू {f.basePredictedNpr.toFixed(1)} • MAE ± रू{' '}
                        {f.mae.toFixed(1)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-emerald-700">
                        रू {f.weatherAdjustedNpr.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        per {evaluation.unit}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              Month-by-Month Analysis ({evaluation.commodity})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Base trained model price, weather-adjusted price, month-over-month
              change, and farmer action
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-4 font-semibold">
                      Month (EN / BS)
                    </th>
                    <th className="py-2.5 pr-4 font-semibold">Base Model</th>
                    <th className="py-2.5 pr-4 font-semibold">
                      Weather-Adjusted
                    </th>
                    <th className="py-2.5 pr-4 font-semibold">
                      Expected Range
                    </th>
                    <th className="py-2.5 pr-4 font-semibold">vs Prev Month</th>
                    <th className="py-2.5 pr-4 font-semibold">Demand</th>
                    <th className="py-2.5 font-semibold">Recommended Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {evaluation.monthlySeries.map((row) => {
                    const demandBadge =
                      row.demandLevel === 'High'
                        ? 'bg-emerald-100 text-emerald-800'
                        : row.demandLevel === 'Low'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700';

                    return (
                      <tr key={row.month} className="hover:bg-slate-50/70">
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-slate-900">
                            {row.monthFull}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {row.nepaliMonth}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          रू {row.basePriceNpr.toFixed(2)}
                        </td>
                        <td className="py-3 pr-4 font-bold text-slate-900">
                          रू {row.weatherAdjustedPriceNpr.toFixed(2)} /{' '}
                          {evaluation.unit}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          रू {row.minExpectedNpr} – {row.maxExpectedNpr}
                        </td>
                        <td
                          className={`py-3 pr-4 font-semibold ${
                            row.changePctFromPrev > 0
                              ? 'text-emerald-700'
                              : row.changePctFromPrev < 0
                                ? 'text-rose-600'
                                : 'text-slate-500'
                          }`}
                        >
                          {row.changePctFromPrev > 0 ? '+' : ''}
                          {row.changePctFromPrev}%
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${demandBadge}`}
                          >
                            {row.demandLevel}
                          </span>
                        </td>
                        <td className="py-3 text-slate-700">{row.advice}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}