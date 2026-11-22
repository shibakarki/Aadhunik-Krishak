import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck2,
  CheckCircle2,
  CloudSun,
  FlaskConical,
  Languages,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  Sparkles,
  Sprout,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import {
  askFarmingAssistant,
  loadFarmAssistantContext,
  type CalendarActionSummary,
  type ChatMessage,
  type FarmAssistantContext,
  type MarketPromptContext,
} from '../services/assistantService';

const QUICK_PROMPTS_EN = [
  'Should I irrigate my crops today or wait for rain?',
  'Schedule irrigation tomorrow and weeding in 3 days on my calendar',
  'What fertilizer should I apply based on my soil pH?',
  'What farming tasks should I prioritize this week?',
];

const QUICK_PROMPTS_NE = [
  'आज बालीमा सिँचाइ गरूँ कि पानी पर्ने पर्खूँ?',
  'भोलि सिँचाइ र ३ दिनपछि गोडमेल गर्ने काम क्यालेन्डरमा थप्नुहोस्',
  'मेरो माटोको pH अनुसार कुन मल प्रयोग गर्ने?',
  'यो हप्ता फार्ममा कुन काम प्राथमिकतामा राख्ने?',
];

const COPY = {
  en: {
    badge: 'AI Farming Assistant',
    title: 'Farm-Aware Agricultural Advisor',
    subtitle:
      'Ask farming questions, analyze Kalimati market prices, or tell the assistant to update your farm calendar.',
    clearChat: 'Clear Chat',
    marketContextLabel: 'Market Price Context Active:',
    peakLabel: 'Peak',
    clearBtn: 'Clear',
    activeContext: 'Active Context:',
    refreshContext: 'Refresh Context',
    liveWeather: 'Live Weather',
    soilProfile: 'Soil Profile',
    activeCrops: 'Active Crops',
    pendingTasks: 'Pending Tasks',
    loading: 'Loading...',
    unavailable: 'Unavailable',
    defaultSoil: 'Default',
    noneRegistered: 'None registered',
    upcomingOne: 'upcoming task',
    upcomingMany: 'upcoming tasks',
    noFarmNotice:
      'No active farm selected. Select or add a farm to enable live weather/soil context and direct AI calendar scheduling.',
    selectAddFarm: 'Select / Add Farm',
    emptyTitle: 'Ask Advice or Schedule Calendar Tasks',
    emptySubtitle:
      'Try a quick prompt below, or type something like "Add tomato irrigation tomorrow and mark weeding done".',
    calendarSync: 'Calendar Sync',
    viewCalendar: 'View in Calendar',
    thinking: 'Thinking with your farm & market data...',
    inputPlaceholder:
      'Ask advice or say "Schedule irrigation tomorrow"...',
    send: 'Send',
    genericError: 'Could not get a response from AI Assistant.',
  },
  ne: {
    badge: 'एआई कृषि सहायक',
    title: 'फार्म-आधारित कृषि सल्लाहकार',
    subtitle:
      'खेतीपातीका प्रश्न सोध्नुहोस्, कालिमाटी बजार मूल्य विश्लेषण गर्नुहोस् वा एआईमार्फत सिधै क्यालेन्डर अपडेट गर्नुहोस्।',
    clearChat: 'कुराकानी मेटाउनुहोस्',
    marketContextLabel: 'बजार मूल्य सन्दर्भ सक्रिय:',
    peakLabel: 'उच्चतम',
    clearBtn: 'हटाउनुहोस्',
    activeContext: 'सक्रिय फार्म:',
    refreshContext: 'ताजा गर्नुहोस्',
    liveWeather: 'हालको मौसम',
    soilProfile: 'माटोको अवस्था',
    activeCrops: 'लगाइएका बाली',
    pendingTasks: 'बाँकी कामहरू',
    loading: 'लोड हुँदैछ...',
    unavailable: 'उपलब्ध छैन',
    defaultSoil: 'सामान्य',
    noneRegistered: 'दर्ता भएको छैन',
    upcomingOne: 'आगामी काम',
    upcomingMany: 'आगामी कामहरू',
    noFarmNotice:
      'कुनै सक्रिय फार्म छानिएको छैन। मौसम, माटो र सिधै क्यालेन्डर तालिका बनाउन फार्म छान्नुहोस् वा थप्नुहोस्।',
    selectAddFarm: 'फार्म छान्नुहोस् / थप्नुहोस्',
    emptyTitle: 'कृषि सल्लाह लिनुहोस् वा क्यालेन्डर अपडेट गर्नुहोस्',
    emptySubtitle:
      'तलका द्रुत प्रश्नहरू छान्नुहोस् वा "भोलि सिँचाइ गर्ने काम थप्नुहोस्" जस्ता निर्देशन दिनुहोस्।',
    calendarSync: 'क्यालेन्डर अपडेट',
    viewCalendar: 'क्यालेन्डर हेर्नुहोस्',
    thinking: 'तपाईंको फार्म र बजार तथ्याङ्क विश्लेषण हुँदैछ...',
    inputPlaceholder:
      'प्रश्न सोध्नुहोस् वा क्यालेन्डरमा काम थप्न भन्नुहोस्...',
    send: 'पठाउनुहोस्',
    genericError: 'एआई सहायकबाट जवाफ प्राप्त गर्न सकिएन।',
  },
} as const;

function formatActionLabel(
  item: CalendarActionSummary,
  language: 'en' | 'ne'
): string {
  if (language === 'ne') {
    if (item.action === 'create') {
      return `"${item.title}" (${item.dueDate ?? 'आगामी मिति'}) क्यालेन्डरमा थपियो`;
    }
    if (item.action === 'complete') {
      return `"${item.title}" सम्पन्न भएको चिन्ह लगाइयो`;
    }
    if (item.action === 'reopen') {
      return `"${item.title}" पुनः खोलियो`;
    }
    if (item.action === 'reschedule') {
      return `"${item.title}" को मिति ${item.dueDate ?? 'नयाँ मिति'} मा सारियो`;
    }
    return `"${item.title}" क्यालेन्डरबाट हटाइयो`;
  }

  if (item.action === 'create') {
    return `Added "${item.title}" for ${item.dueDate ?? 'upcoming'}`;
  }
  if (item.action === 'complete') {
    return `Marked "${item.title}" as completed`;
  }
  if (item.action === 'reopen') {
    return `Reopened "${item.title}"`;
  }
  if (item.action === 'reschedule') {
    return `Rescheduled "${item.title}" to ${item.dueDate ?? 'new date'}`;
  }
  return `Removed "${item.title}" from calendar`;
}

export function Assistant() {
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const location = useLocation();

  const initialMarketContext = (
    location.state as { marketContext?: MarketPromptContext } | null
  )?.marketContext ?? null;

  const [marketContext, setMarketContext] =
    useState<MarketPromptContext | null>(initialMarketContext);
  const [language, setLanguage] = useState<'en' | 'ne'>(
    initialMarketContext?.language ?? 'en'
  );
  const [context, setContext] = useState<FarmAssistantContext>({
    farm: null,
    weather: null,
    soil: null,
    crops: [],
    activities: [],
    recentScans: [],
  });
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextReady, setContextReady] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const hasAutoAskedRef = useRef(false);

  const t = COPY[language];

  const refreshContext = async () => {
    setLoadingContext(true);
    try {
      const nextContext = await loadFarmAssistantContext(activeFarm, user?.id);
      setContext(nextContext);
      setContextReady(true);
    } finally {
      setLoadingContext(false);
    }
  };

  useEffect(() => {
    void refreshContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFarm?.id, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const sendMessage = async (
    textToSend: string,
    overrideMarket?: MarketPromptContext | null,
    overrideLang?: 'en' | 'ne'
  ) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    setError(null);
    const activeLang = overrideLang ?? language;
    const activeMarket =
      overrideMarket !== undefined ? overrideMarket : marketContext;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const historyBeforeSend = messages;
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const { reply, calendarActions } = await askFarmingAssistant({
        question: trimmed,
        history: historyBeforeSend,
        context,
        language: activeLang,
        userId: user?.id,
        marketContext: activeMarket,
      });

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
        calendarActions,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (calendarActions.some((a) => a.status === 'applied')) {
        await refreshContext();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (
      !contextReady ||
      !marketContext ||
      hasAutoAskedRef.current ||
      messages.length > 0
    ) {
      return;
    }

    hasAutoAskedRef.current = true;
    const targetLang = marketContext.language ?? language;
    const autoPrompt =
      targetLang === 'ne'
        ? `कालिमाटी बजार विश्लेषण अनुसार ${marketContext.commodity} को हालको मूल्य (रू ${marketContext.weatherAdjustedCurrentNpr.toFixed(
            1
          )}/${marketContext.unit}, उच्चतम महिना: ${
            marketContext.peakMonth
          }) को आधारमा बिक्री, भण्डारण र खेती रणनीति के हुनुपर्छ?`
        : `Based on the Kalimati market analysis for ${
            marketContext.commodity
          } (current weather-adjusted price रू ${marketContext.weatherAdjustedCurrentNpr.toFixed(
            1
          )}/${marketContext.unit}, peaking in ${
            marketContext.peakMonth
          }), what should my selling, harvesting, or planting strategy be?`;

    void sendMessage(autoPrompt, marketContext, targetLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextReady, marketContext]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const quickPrompts =
    language === 'ne' ? QUICK_PROMPTS_NE : QUICK_PROMPTS_EN;
  const pendingTasksCount = context.activities.filter((a) => !a.completed).length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            <Bot className="h-3.5 w-3.5" />
            {t.badge}
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage((prev) => (prev === 'en' ? 'ne' : 'en'))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-xs transition hover:bg-emerald-50"
          >
            <Languages className="h-3.5 w-3.5" />
            {language === 'en' ? 'English' : 'नेपाली'}
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t.clearChat}
            </button>
          )}
        </div>
      </div>

      {/* Selected Market Price Context Banner */}
      {marketContext && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>
              <span className="font-bold">{t.marketContextLabel}</span>{' '}
              {marketContext.commodity} — रू{' '}
              {marketContext.weatherAdjustedCurrentNpr.toFixed(1)}/
              {marketContext.unit} ({t.peakLabel}: {marketContext.peakMonth})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMarketContext(null)}
            aria-label="Clear market price context"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
          >
            <X className="h-3.5 w-3.5" />
            {t.clearBtn}
          </button>
        </div>
      )}

      {/* Live Farm Context Strip */}
      {activeFarm ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <MapPin className="h-4 w-4 text-emerald-600" />
              <span>
                {t.activeContext} {activeFarm.name}
                {activeFarm.district ? ` (${activeFarm.district})` : ''}
              </span>
              {activeFarm.agro_zone && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800">
                  {activeFarm.agro_zone}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => void refreshContext()}
              disabled={loadingContext}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingContext ? 'animate-spin' : ''}`}
              />
              {t.refreshContext}
            </button>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <CloudSun className="h-4 w-4 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500">
                  {t.liveWeather}
                </div>
                <div className="truncate font-medium text-slate-800">
                  {context.weather
                    ? `${context.weather.currentTempC}°C • ${context.weather.currentWeatherLabel}`
                    : loadingContext
                      ? t.loading
                      : t.unavailable}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <FlaskConical className="h-4 w-4 shrink-0 text-teal-600" />
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500">
                  {t.soilProfile}
                </div>
                <div className="truncate font-medium text-slate-800">
                  {context.soil
                    ? `pH ${context.soil.ph} • ${context.soil.textureClass}`
                    : loadingContext
                      ? t.loading
                      : activeFarm.soil_type || t.defaultSoil}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <Sprout className="h-4 w-4 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500">
                  {t.activeCrops}
                </div>
                <div className="truncate font-medium text-slate-800">
                  {context.crops.length > 0
                    ? context.crops.map((c) => c.crop_name).join(', ')
                    : t.noneRegistered}
                </div>
              </div>
            </div>

            <Link
              to="/calendar"
              className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2 text-xs transition hover:bg-emerald-50"
            >
              <CalendarCheck2 className="h-4 w-4 shrink-0 text-sky-600" />
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500">
                  {t.pendingTasks}
                </div>
                <div className="truncate font-medium text-slate-800">
                  {pendingTasksCount}{' '}
                  {pendingTasksCount === 1 ? t.upcomingOne : t.upcomingMany}
                </div>
              </div>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-amber-700" />
            <span>{t.noFarmNotice}</span>
          </div>
          <Link
            to="/farms/new"
            className="shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 font-semibold text-white transition hover:bg-amber-700"
          >
            {t.selectAddFarm}
          </Link>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex min-h-[440px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && marketContext && !error ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                {language === 'ne'
                  ? `${marketContext.commodity} को बजार मूल्य विश्लेषण हुँदैछ...`
                  : `Analyzing ${marketContext.commodity} market prices...`}
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-3 text-base font-semibold text-slate-900">
                {t.emptyTitle}
              </h2>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                {t.emptySubtitle}
              </p>

              <div className="mt-5 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-2.5 text-left text-xs font-medium text-emerald-900 transition hover:bg-emerald-100"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const hasAppliedCalendarChanges = Boolean(
                  msg.calendarActions?.some((a) => a.status === 'applied')
                );

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}

                    <div className="max-w-[82%] space-y-2">
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                          isUser
                            ? 'bg-emerald-600 text-white'
                            : 'border border-slate-200 bg-slate-50 text-slate-800'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {msg.calendarActions &&
                        msg.calendarActions.length > 0 && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs">
                            <div className="flex items-center justify-between gap-2 font-semibold text-emerald-900">
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarCheck2 className="h-4 w-4 text-emerald-600" />
                                {t.calendarSync}
                              </span>
                              {hasAppliedCalendarChanges && (
                                <Link
                                  to="/calendar"
                                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900"
                                >
                                  {t.viewCalendar}
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                              )}
                            </div>

                            <ul className="mt-2 space-y-1">
                              {msg.calendarActions.map((item, idx) => (
                                <li
                                  key={`${msg.id}-action-${idx}`}
                                  className={`flex items-start gap-1.5 ${
                                    item.status === 'applied'
                                      ? 'text-emerald-800'
                                      : 'text-amber-800'
                                  }`}
                                >
                                  {item.status === 'applied' ? (
                                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                  ) : (
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                                  )}
                                  <span>
                                    {formatActionLabel(item, language)}
                                    {item.note ? ` — ${item.note}` : ''}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>

                    {isUser && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {sending && (
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                    {t.thinking}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </>
          )}
        </div>

        {error && (
          <div className="mx-5 mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick chips when chat already started */}
        {messages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-5 pt-3">
            {quickPrompts.slice(0, 2).map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={sending}
                onClick={() => void sendMessage(prompt)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-slate-200 p-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.inputPlaceholder}
            disabled={sending}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{t.send}</span>
          </button>
        </form>
      </div>
    </div>
  );
}