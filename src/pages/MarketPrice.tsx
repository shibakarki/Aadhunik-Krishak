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
  Languages,
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
  parseKalimatiMonthlyJson,
  type CommodityEvaluationResult,
  type CompactKalimatiJson,
  type MarketWeatherContext,
  type MonthlyMarketPoint,
  type ParsedKalimatiDataset,
} from '../services/marketPriceService';

const REPO_JSON_PATH = '/data/kalimati_monthly.json';

const MONTHS_NE: Record<number, { full: string; short: string; bs: string }> = {
  1: { full: 'जनवरी', short: 'जन', bs: 'पुस / माघ' },
  2: { full: 'फेब्रुअरी', short: 'फेब', bs: 'माघ / फागुन' },
  3: { full: 'मार्च', short: 'मार्च', bs: 'फागुन / चैत' },
  4: { full: 'अप्रिल', short: 'अप्रि', bs: 'चैत / वैशाख' },
  5: { full: 'मे', short: 'मे', bs: 'वैशाख / जेठ' },
  6: { full: 'जुन', short: 'जुन', bs: 'जेठ / असार' },
  7: { full: 'जुलाई', short: 'जुल', bs: 'असार / साउन' },
  8: { full: 'अगस्ट', short: 'अग', bs: 'साउन / भदौ' },
  9: { full: 'सेप्टेम्बर', short: 'सेप्ट', bs: 'भदौ / असोज' },
  10: { full: 'अक्टोबर', short: 'अक्ट', bs: 'असोज / कात्तिक' },
  11: { full: 'नोभेम्बर', short: 'नोभ', bs: 'कात्तिक / मंसिर' },
  12: { full: 'डिसेम्बर', short: 'डिस', bs: 'मंसिर / पुस' },
};

const DEMAND_NE: Record<MonthlyMarketPoint['demandLevel'], string> = {
  High: 'उच्च माग',
  Moderate: 'मध्यम माग',
  Low: 'कम माग',
};

const ADVICE_NE: Record<MonthlyMarketPoint['demandLevel'], string> = {
  High: 'उच्च मूल्यको समय — बाली टिपेर सिधै बजारमा बिक्री गर्न उपयुक्त।',
  Moderate: 'सामान्य बिक्री जारी राख्नुहोस् र कालिमाटीको दरभाउ हेर्दै गर्नुहोस्।',
  Low: 'बजारमा आपूर्ति बढी — चरणबद्ध टिप्नुहोस्, ग्रेडिङ गर्नुहोस् वा भण्डारण गर्नुहोस्।',
};

const COPY = {
  en: {
    badge: 'Kalimati Market Intelligence (ML + Weather)',
    title: 'Crop Price Forecast & Seasonal Analysis',
    subtitle:
      'Pick any vegetable, fruit, or spice from the Kalimati market dataset to evaluate monthly prices using our Random Forest model and past + upcoming weather.',
    loadingCsv: 'Loading Kalimati dataset...',
    commoditiesReady: 'Commodities Ready',
    loadCustomCsv: 'Load Custom CSV',
    step1Title: '1. Select Crop / Commodity',
    itemsSuffix: 'items',
    searchPlaceholder: 'Search (e.g. Tomato, Onion, Apple)...',
    noMatch: 'No items match',
    monthsShort: 'mo',
    step2Title: '2. Past & Future Weather Impact',
    loadingWeather: 'Loading historical archive & 14-day weather forecast...',
    past12m: 'Past 12m Avg',
    next14d: 'Next 14 Days',
    priceImpact: 'Price Impact',
    avgShort: 'avg',
    rainUnit: 'mm/yr',
    weatherSignal: 'Weather Signal:',
    weatherAdjustedNow: 'Weather-Adjusted Now',
    baseModel: 'Base model',
    annualAvg: 'Annual avg',
    peakMonthTitle: 'Peak Selling Month',
    lowestMonthTitle: 'Lowest Price Month',
    highSupply: 'high supply',
    trainedMae: 'Trained Model MAE',
    monthsLabel: 'months',
    rowsLabel: 'rows',
    chartTitle: '12-Month Evaluated Price',
    chartSub: 'Weather-adjusted NPR',
    legendPeak: 'Peak',
    legendNormal: 'Normal',
    legendLow: 'Low',
    insightTitle: 'Market & Weather Insight',
    askAi: 'Ask AI Assistant',
    forecastTitle: 'Next 5-Month Forecast',
    forecastSub:
      'Weather-adjusted predictions using lag-1, lag-12 & forecast climate features',
    perUnit: 'per',
    tableTitle: 'Month-by-Month Analysis',
    tableSub:
      'Base trained model price, weather-adjusted price, month-over-month change, and farmer action',
    colMonth: 'Month (EN / BS)',
    colBase: 'Base Model',
    colWeatherAdj: 'Weather-Adjusted',
    colRange: 'Expected Range',
    colChange: 'vs Prev Month',
    colDemand: 'Demand',
    colAction: 'Recommended Action',
  },
  ne: {
    badge: 'कालिमाटी बजार विश्लेषण (ML + मौसम)',
    title: 'बाली मूल्य पूर्वानुमान र मौसमी विश्लेषण',
    subtitle:
      'कालिमाटी बजार डाटासेटबाट कुनै पनि तरकारी, फलफूल वा मसला छान्नुहोस् र विगत तथा आगामी मौसम अनुसार मासिक मूल्य विश्लेषण हेर्नुहोस्।',
    loadingCsv: 'कालिमाटी डाटा लोड हुँदैछ...',
    commoditiesReady: 'वस्तुहरू तयार छन्',
    loadCustomCsv: 'CSV लोड गर्नुहोस्',
    step1Title: '१. बाली / वस्तु छान्नुहोस्',
    itemsSuffix: 'वस्तु',
    searchPlaceholder: 'खोज्नुहोस् (जस्तै: Tomato, Onion, Apple)...',
    noMatch: 'कुनै वस्तु भेटिएन',
    monthsShort: 'महिना',
    step2Title: '२. विगत र आगामी मौसमको प्रभाव',
    loadingWeather: 'विगत १ वर्ष र आगामी १४ दिनको मौसम लोड हुँदैछ...',
    past12m: 'विगत १२ महिना',
    next14d: 'आगामी १४ दिन',
    priceImpact: 'मूल्य प्रभाव',
    avgShort: 'औसत',
    rainUnit: 'मिमी/वर्ष',
    weatherSignal: 'मौसम संकेत:',
    weatherAdjustedNow: 'मौसम समायोजित हालको मूल्य',
    baseModel: 'आधार मोडल',
    annualAvg: 'वार्षिक औसत',
    peakMonthTitle: 'सबैभन्दा राम्रो बिक्री महिना',
    lowestMonthTitle: 'सबैभन्दा कम मूल्यको महिना',
    highSupply: 'बढी आपूर्ति',
    trainedMae: 'तालिमप्राप्त मोडल त्रुटि (MAE)',
    monthsLabel: 'महिना',
    rowsLabel: 'रेकर्ड',
    chartTitle: '१२ महिनाको मूल्याङ्कन गरिएको मूल्य',
    chartSub: 'मौसम समायोजित रू',
    legendPeak: 'उच्च',
    legendNormal: 'सामान्य',
    legendLow: 'कम',
    insightTitle: 'बजार र मौसम रणनीति',
    askAi: 'एआई सहायकलाई सोध्नुहोस्',
    forecastTitle: 'आगामी ५ महिनाको पूर्वानुमान',
    forecastSub:
      'विगतको मूल्य र मौसम तथ्याङ्कमा आधारित आगामी मासिक अनुमान',
    perUnit: 'प्रति',
    tableTitle: 'महिनाअनुसार विस्तृत बजार विश्लेषण',
    tableSub:
      'आधार मोडल मूल्य, मौसम समायोजित मूल्य, अघिल्लो महिनासँगको परिवर्तन र किसान सुझाव',
    colMonth: 'महिना (अंग्रेजी / वि.सं.)',
    colBase: 'आधार मोडल',
    colWeatherAdj: 'मौसम समायोजित',
    colRange: 'अनुमानित दायरा',
    colChange: 'अघिल्लो महिनासँग',
    colDemand: 'माग',
    colAction: 'सुझाइएको कदम',
  },
} as const;

export function MarketPrice() {
  const { activeFarm } = useFarm();
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [language, setLanguage] = useState<'en' | 'ne'>('en');
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

  const [csvError, setCsvError] = useState<string | null>(null);

  const t = COPY[language];

  // Auto-load compact Kalimati JSON directly from /public/data/kalimati_monthly.json
  useEffect(() => {
    let active = true;

    async function loadRepoDataset() {
      setLoadingDataset(true);
      try {
        const res = await fetch(REPO_JSON_PATH);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as CompactKalimatiJson;
        const parsed = parseKalimatiMonthlyJson(json);
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

    void loadRepoDataset();
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

  const localizedWeatherSignal = useMemo(() => {
    if (!weatherContext) return '';
    if (language === 'en') return weatherContext.weatherSummary;

    if (
      weatherContext.rainRatioVsNormal >= 1.5 ||
      weatherContext.upcoming14dRainMm >= 95
    ) {
      return 'आगामी भारी वर्षाले ढुवानी र बाली कटानीमा असर पार्न सक्ने भएकाले मूल्य केही बढ्न सक्छ।';
    }
    if (weatherContext.rainRatioVsNormal >= 1.15) {
      return 'सामान्यभन्दा बढी वर्षाले कटानी र ढुवानीमा हल्का दबाब पार्न सक्छ।';
    }
    if (weatherContext.weatherImpactPct < 0) {
      return 'स्थिर र अनुकूल मौसमले बजारमा नियमित आपूर्ति सहज बनाउने देखिन्छ।';
    }
    return 'सामान्य मौसमी अवस्था रहने अनुमान छ।';
  }, [language, weatherContext]);

  const localizedStrategy = useMemo(() => {
    if (!evaluation) return '';
    if (language === 'en') return evaluation.sellingStrategy;

    const peakNe = MONTHS_NE[evaluation.peakMonth.month];
    const lowNe = MONTHS_NE[evaluation.lowestMonth.month];
    return `${evaluation.commodity} को मूल्य सामान्यतया ${peakNe.full} (${peakNe.bs}) मा उच्च (~रू ${evaluation.peakMonth.weatherAdjustedPriceNpr.toFixed(
      0
    )}/${evaluation.unit}) र ${lowNe.full} मा कम (~रू ${evaluation.lowestMonth.weatherAdjustedPriceNpr.toFixed(
      0
    )}/${evaluation.unit}) रहन्छ। ${localizedWeatherSignal}`;
  }, [evaluation, language, localizedWeatherSignal]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-amber-50 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            <BarChart3 className="h-3.5 w-3.5" />
            {t.badge}
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setLanguage((prev) => (prev === 'en' ? 'ne' : 'en'))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-xs transition hover:bg-emerald-50"
          >
            <Languages className="h-3.5 w-3.5" />
            {language === 'en' ? 'English' : 'नेपाली'}
          </button>

          {loadingDataset ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3.5 py-2 text-xs font-medium text-emerald-800">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t.loadingCsv}
            </div>
          ) : dataSource === 'Kalimati Repo Dataset' ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>
                {dataset.commodities.length} {t.commoditiesReady}
              </span>
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
                {t.loadCustomCsv}
              </button>
            </>
          )}
        </div>
      </div>

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
              {t.step1Title} ({dataset.commodities.length} {t.itemsSuffix})
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
                placeholder={t.searchPlaceholder}
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
                <option value="">
                  {t.noMatch} &quot;{searchQuery}&quot;
                </option>
              ) : (
                filteredCommodities.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name} ({item.unit} • {item.monthsCount} {t.monthsShort}
                    )
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
              {t.step2Title}
            </h2>
            {weatherContext && (
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
                {weatherContext.source}
              </span>
            )}
          </div>

          {loadingWeather || !weatherContext ? (
            <p className="mt-4 text-xs text-slate-500">{t.loadingWeather}</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <ThermometerSun className="h-3.5 w-3.5 text-amber-500" />
                    {t.past12m}
                  </div>
                  <div className="mt-1 font-bold text-slate-900">
                    {weatherContext.pastAnnualAvgTempC}°C
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {weatherContext.pastAnnualRainMm} {t.rainUnit}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <CloudRain className="h-3.5 w-3.5 text-sky-600" />
                    {t.next14d}
                  </div>
                  <div className="mt-1 font-bold text-slate-900">
                    {weatherContext.upcoming14dRainMm} mm
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {weatherContext.upcoming14dAvgTempC}°C {t.avgShort}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="text-[11px] text-slate-500">
                    {t.priceImpact}
                  </div>
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
                  {t.weatherSignal}
                </span>{' '}
                {localizedWeatherSignal}
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
                  {t.weatherAdjustedNow}
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
                {t.baseModel}: रू {evaluation.currentPriceNpr.toFixed(1)} •{' '}
                {t.annualAvg} रू {evaluation.annualAvgNpr.toFixed(1)}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                {t.peakMonthTitle}
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-900">
                {language === 'ne'
                  ? MONTHS_NE[evaluation.peakMonth.month].full
                  : evaluation.peakMonth.monthFull}
              </div>
              <p className="mt-1 text-xs text-emerald-700">
                रू {evaluation.peakMonth.weatherAdjustedPriceNpr.toFixed(1)} /{' '}
                {evaluation.unit} (
                {language === 'ne'
                  ? MONTHS_NE[evaluation.peakMonth.month].bs
                  : evaluation.peakMonth.nepaliMonth}
                )
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <TrendingDown className="h-4 w-4 text-amber-600" />
                {t.lowestMonthTitle}
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-900">
                {language === 'ne'
                  ? MONTHS_NE[evaluation.lowestMonth.month].full
                  : evaluation.lowestMonth.monthFull}
              </div>
              <p className="mt-1 text-xs text-amber-700">
                रू {evaluation.lowestMonth.weatherAdjustedPriceNpr.toFixed(1)} /{' '}
                {evaluation.unit} ({t.highSupply})
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Cpu className="h-4 w-4 text-teal-600" />
                {t.trainedMae}
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                ± रू {evaluation.mae.toFixed(2)}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {evaluation.monthsTrained} {t.monthsLabel} •{' '}
                {evaluation.recordsUsed.toLocaleString()} {t.rowsLabel}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {t.chartTitle} — {evaluation.commodity}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {evaluation.trainingMethod} • {t.chartSub} /{' '}
                    {evaluation.unit}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />{' '}
                    {t.legendPeak}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" />{' '}
                    {t.legendNormal}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />{' '}
                    {t.legendLow}
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
                      title={`${point.monthFull} (${point.nepaliMonth}): रू ${point.weatherAdjustedPriceNpr}/${evaluation.unit}`}
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
                        {language === 'ne'
                          ? MONTHS_NE[point.month].short
                          : point.monthShort}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl bg-emerald-50/70 p-4 text-xs text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    {t.insightTitle}
                  </div>
                  <p className="leading-relaxed">{localizedStrategy}</p>
                </div>

                <Link
                  to="/assistant"
                  state={{
                    marketContext: {
                      commodity: evaluation.commodity,
                      unit: evaluation.unit,
                      language,
                      currentPriceNpr: evaluation.currentPriceNpr,
                      weatherAdjustedCurrentNpr:
                        evaluation.weatherAdjustedCurrentNpr,
                      annualAvgNpr: evaluation.annualAvgNpr,
                      peakMonth: `${evaluation.peakMonth.monthFull} (${evaluation.peakMonth.nepaliMonth}) at रू ${evaluation.peakMonth.weatherAdjustedPriceNpr.toFixed(1)}/${evaluation.unit}`,
                      lowestMonth: `${evaluation.lowestMonth.monthFull} at रू ${evaluation.lowestMonth.weatherAdjustedPriceNpr.toFixed(1)}/${evaluation.unit}`,
                      trend: evaluation.trend,
                      mae: evaluation.mae,
                      futureForecast: evaluation.futureForecast
                        .map(
                          (f) =>
                            `${f.label}: रू ${f.weatherAdjustedNpr.toFixed(1)}`
                        )
                        .join(', '),
                      weatherSummary: weatherContext?.weatherSummary ?? '',
                    },
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 font-semibold text-white transition hover:bg-emerald-700"
                >
                  {t.askAi}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  {t.forecastTitle}
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">{t.forecastSub}</p>

              <div className="mt-4 space-y-2.5">
                {evaluation.futureForecast.map((f) => (
                  <div
                    key={`${f.year}-${f.month}`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {language === 'ne'
                          ? `${MONTHS_NE[f.month].full} ${f.year}`
                          : f.label}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t.baseModel} रू {f.basePredictedNpr.toFixed(1)} • MAE ±
                        रू {f.mae.toFixed(1)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-emerald-700">
                        रू {f.weatherAdjustedNpr.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t.perUnit} {evaluation.unit}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              {t.tableTitle} ({evaluation.commodity})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{t.tableSub}</p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-4 font-semibold">{t.colMonth}</th>
                    <th className="py-2.5 pr-4 font-semibold">{t.colBase}</th>
                    <th className="py-2.5 pr-4 font-semibold">
                      {t.colWeatherAdj}
                    </th>
                    <th className="py-2.5 pr-4 font-semibold">{t.colRange}</th>
                    <th className="py-2.5 pr-4 font-semibold">{t.colChange}</th>
                    <th className="py-2.5 pr-4 font-semibold">{t.colDemand}</th>
                    <th className="py-2.5 font-semibold">{t.colAction}</th>
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
                            {language === 'ne'
                              ? MONTHS_NE[row.month].full
                              : row.monthFull}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {language === 'ne'
                              ? MONTHS_NE[row.month].bs
                              : row.nepaliMonth}
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
                            {language === 'ne'
                              ? DEMAND_NE[row.demandLevel]
                              : row.demandLevel}
                          </span>
                        </td>
                        <td className="py-3 text-slate-700">
                          {language === 'ne'
                            ? ADVICE_NE[row.demandLevel]
                            : row.advice}
                        </td>
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