import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bot,
  CalendarCheck2,
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import {
  askFarmingAssistant,
  loadFarmAssistantContext,
  type ChatMessage,
  type FarmAssistantContext,
} from '../services/assistantService';

const QUICK_PROMPTS_EN = [
  'Should I irrigate my crops today or wait for rain?',
  'What fertilizer should I apply based on my soil pH?',
  'What farming tasks should I prioritize this week?',
  'Which seasonal crops fit my farm elevation best?',
];

const QUICK_PROMPTS_NE = [
  'आज बालीमा सिँचाइ गरूँ कि पानी पर्ने पर्खूँ?',
  'मेरो माटोको pH अनुसार कुन मल प्रयोग गर्ने?',
  'यो हप्ता फार्ममा कुन काम प्राथमिकतामा राख्ने?',
  'मेरो उचाइ र हावापानीमा कुन बाली राम्रो हुन्छ?',
];

export function Assistant() {
  const { user } = useAuth();
  const { activeFarm } = useFarm();

  const [language, setLanguage] = useState<'en' | 'ne'>('en');
  const [context, setContext] = useState<FarmAssistantContext>({
    farm: null,
    weather: null,
    soil: null,
    crops: [],
    activities: [],
    recentScans: [],
  });
  const [loadingContext, setLoadingContext] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const refreshContext = async () => {
    setLoadingContext(true);
    try {
      const nextContext = await loadFarmAssistantContext(activeFarm, user?.id);
      setContext(nextContext);
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

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    setError(null);

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
      const reply = await askFarmingAssistant({
        question: trimmed,
        history: historyBeforeSend,
        context,
        language,
      });

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not get a response from AI Assistant.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const quickPrompts =
    language === 'ne' ? QUICK_PROMPTS_NE : QUICK_PROMPTS_EN;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            <Bot className="h-3.5 w-3.5" />
            AI Farming Assistant
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Farm-Aware Agricultural Advisor
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Ask anything about irrigation, fertilizer, pests, or seasonal
            planning—powered by your live farm weather, soil, and crop data.
          </p>
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
              Clear Chat
            </button>
          )}
        </div>
      </div>

      {/* Live Farm Context Strip */}
      {activeFarm ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <MapPin className="h-4 w-4 text-emerald-600" />
              <span>
                Active Context: {activeFarm.name}
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
              Refresh Context
            </button>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <CloudSun className="h-4 w-4 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500">Live Weather</div>
                <div className="truncate font-medium text-slate-800">
                  {context.weather
                    ? `${context.weather.currentTempC}°C • ${context.weather.currentWeatherLabel}`
                    : loadingContext
                      ? 'Loading...'
                      : 'Unavailable'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <FlaskConical className="h-4 w-4 shrink-0 text-teal-600" />
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500">Soil Profile</div>
                <div className="truncate font-medium text-slate-800">
                  {context.soil
                    ? `pH ${context.soil.ph} • ${context.soil.textureClass}`
                    : loadingContext
                      ? 'Loading...'
                      : activeFarm.soil_type || 'Default'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <Sprout className="h-4 w-4 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500">Active Crops</div>
                <div className="truncate font-medium text-slate-800">
                  {context.crops.length > 0
                    ? context.crops.map((c) => c.crop_name).join(', ')
                    : 'None registered'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <CalendarCheck2 className="h-4 w-4 shrink-0 text-sky-600" />
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500">Pending Tasks</div>
                <div className="truncate font-medium text-slate-800">
                  {context.activities.length} upcoming{' '}
                  {context.activities.length === 1 ? 'task' : 'tasks'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-amber-700" />
            <span>
              No active farm selected. You can still ask general questions, or
              add/select a farm for live weather, soil, and crop-specific
              advice.
            </span>
          </div>
          <Link
            to="/farms/new"
            className="shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 font-semibold text-white transition hover:bg-amber-700"
          >
            Select / Add Farm
          </Link>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex min-h-[440px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-3 text-base font-semibold text-slate-900">
                {language === 'ne'
                  ? 'आफ्नो फार्मको बारेमा जे पनि सोध्नुहोस्'
                  : 'Ask Anything About Your Farm'}
              </h2>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                {language === 'ne'
                  ? 'तलका द्रुत प्रश्नहरू छान्नुहोस् वा आफ्नै प्रश्न लेख्नुहोस्।'
                  : 'Try one of the quick questions below or type your own question.'}
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

                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                        isUser
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-200 bg-slate-50 text-slate-800'
                      }`}
                    >
                      {msg.content}
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
                    Thinking with your farm data...
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
            placeholder={
              language === 'ne'
                ? 'यहाँ आफ्नो कृषि प्रश्न लेख्नुहोस्...'
                : 'Ask about irrigation, crops, pests, or soil...'
            }
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
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}