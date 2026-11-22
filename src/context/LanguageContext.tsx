tsx;
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Languages } from "lucide-react";
import type { AgroZone, NepalSeason } from "../types";

export type AppLanguage = "en" | "ne";

const LANG_STORAGE_KEY = "aadhunik_krishak_lang";

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      return saved === "ne" ? "ne" : "en";
    } catch {
      return "en";
    }
  });

  const setLang = useCallback((next: AppLanguage) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: AppLanguage = prev === "en" ? "ne" : "en";
      try {
        localStorage.setItem(LANG_STORAGE_KEY, next);
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside a LanguageProvider");
  }
  return ctx;
}

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-1 shadow-sm"
      role="group"
      aria-label="Language switcher"
    >
      <Languages className="ml-1.5 h-3.5 w-3.5 text-emerald-600" />
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
          lang === "en"
            ? "bg-emerald-600 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("ne")}
        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
          lang === "ne"
            ? "bg-emerald-600 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        नेपाली
      </button>
    </div>
  );
}

const DEVANAGARI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

export function toDevanagari(value: string | number): string {
  return String(value)
    .split("")
    .map((ch) => (/\d/.test(ch) ? DEVANAGARI_DIGITS[Number(ch)] : ch))
    .join("");
}

export function translateAgroZone(zone: AgroZone, lang: AppLanguage): string {
  if (lang === "en") return zone;
  if (zone === "Terai") return "तराई";
  if (zone === "Hill") return "पहाड";
  return "हिमाल";
}

export function translateSeason(
  season: NepalSeason,
  lang: AppLanguage,
): string {
  if (lang === "en") return season;
  if (season === "Monsoon") return "वर्षा (मनसुन)";
  if (season === "Winter") return "हिउँद";
  return "बसन्त";
}

const WEATHER_LABELS_NE: Record<string, string> = {
  "Clear sky": "सफा आकाश",
  "Mainly clear": "मुख्यतया सफा",
  "Partly cloudy": "आंशिक बदली",
  Overcast: "पूर्ण बदली",
  Foggy: "कुहिरो",
  Drizzle: "सिमसिमे पानी",
  "Freezing drizzle": "चिसो सिमसिमे पानी",
  "Light rain": "हल्का वर्षा",
  "Moderate rain": "मध्यम वर्षा",
  "Heavy rain": "भारी वर्षा",
  "Freezing rain": "चिसो वर्षा",
  Snowfall: "हिमपात",
  "Rain showers": "झरी / छिटपुट वर्षा",
  "Snow showers": "हिउँ झरी",
  Thunderstorm: "मेघगर्जन सहित वर्षा",
  "Thunderstorm with hail": "असिना सहित मेघगर्जन",
};

export function translateWeatherLabel(
  label: string,
  lang: AppLanguage,
): string {
  if (lang === "en") return label;
  return WEATHER_LABELS_NE[label] ?? label;
}

const SOIL_TEXTURES_NE: Record<string, string> = {
  "Alluvial Loam": "पाँगो दोमट माटो",
  "Mountain Sandy Loam": "हिमाली बलौटे दोमट माटो",
  "Hill Loam": "पहाडी दोमट माटो",
  "Clay / Clay Loam": "चिम्टाइलो / चिम्टाइलो दोमट",
  "Sandy Loam": "बलौटे दोमट",
  "Silt Loam": "पाँगो दोमट",
  "Clay Loam": "चिम्टाइलो दोमट",
  Loam: "दोमट माटो",
};

export function translateSoilTexture(
  texture: string,
  lang: AppLanguage,
): string {
  if (lang === "en") return texture;
  return SOIL_TEXTURES_NE[texture] ?? texture;
}
