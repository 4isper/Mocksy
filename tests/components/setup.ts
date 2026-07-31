import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      en: "English",
      ru: "Русский",
      de: "Deutsch",
      es: "Español",
      fr: "Français",
      pt: "Português",
      it: "Italiano",
      ja: "日本語",
      ko: "한국어",
      zh: "中文",
      tr: "Türkçe",
      pl: "Polski",
      nl: "Nederlands",
      uk: "Українська",
      ar: "العربية",
      hi: "हिन्दी",
      id: "Indonesia",
      vi: "Tiếng Việt",
      th: "ไทย",
      sv: "Svenska",
      no: "Norsk",
      da: "Dansk",
      fi: "Suomi",
      cs: "Čeština",
      bg: "Български",
      el: "Ελληνικά",
      et: "Eesti",
      he: "עברית",
      hr: "Hrvatski",
      lt: "Lietuvių",
      ro: "Română",
      sl: "Slovenščina",
      sr: "Српски",
      bn: "বাংলা",
      pa: "ਪੰਜਾਬੀ",
      ms: "Bahasa Melayu",
      sw: "Kiswahili",
      fa: "فارسی",
      te: "తెలుగు",
      mr: "मराठी",
      ta: "தமிழ்",
      ur: "اردو",
      gu: "ગુજરાતી",
      kn: "ಕನ್ನಡ",
      am: "አማርኛ",
      tl: "Filipino",
      hu: "Magyar",
      lv: "Latviešu",
      is: "Íslenska",
      ga: "Gaeilge",
      cy: "Cymraeg",
      sq: "Shqip",
      hy: "Հայերեն",
      ka: "ქართული",
      az: "Azərbaycan",
      kk: "Қазақша",
      ne: "नेपाली",
      language: "Language",
      locale: "Locale"
    };
    return messages[key] ?? key;
  }
}));

export const mockPush = vi.fn();
export const mockPathname = vi.fn().mockReturnValue("/en");

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() })
}));
