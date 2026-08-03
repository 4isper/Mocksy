// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleSwitcher } from "@/components/editor/LocaleSwitcher";
import { locales } from "@/i18n/locales";
import { localeCoverage } from "@/i18n/generated";
import { mockPathname, mockPush } from "./setup";

afterEach(cleanup);

const NATIVE_NAMES = [
  "English",
  "Русский",
  "Deutsch",
  "Español",
  "Français",
  "Português",
  "Italiano",
  "日本語",
  "한국어",
  "中文",
  "Türkçe",
  "Polski",
  "Nederlands",
  "Українська",
  "العربية",
  "हिन्दी",
  "Indonesia",
  "Tiếng Việt",
  "ไทย",
  "Svenska",
  "Norsk",
  "Dansk",
  "Suomi",
  "Čeština",
  "Български",
  "Ελληνικά",
  "Eesti",
  "עברית",
  "Hrvatski",
  "Lietuvių",
  "Română",
  "Slovenščina",
  "Српски",
  "বাংলা",
  "ਪੰਜਾਬੀ",
  "Bahasa Melayu",
  "Kiswahili",
  "فارسی",
  "తెలుగు",
  "मराठी",
  "தமிழ்",
  "اردو",
  "ગુજરાતી",
  "ಕನ್ನಡ",
  "አማርኛ",
  "Filipino",
  "Magyar",
  "Latviešu",
  "Íslenska",
  "Gaeilge",
  "Cymraeg",
  "Shqip",
  "Հայերեն",
  "ქართული",
  "Azərbaycan",
  "Қазақша",
  "नेपाली"
];

const optionTexts = () =>
  locales.map((locale, i) => {
    const coverage = localeCoverage[locale];
    const marker = coverage !== undefined && coverage < 100 ? " (partial)" : "";
    return `${NATIVE_NAMES[i]}${marker}`;
  });

describe("LocaleSwitcher", () => {
  it("renders the locale select", () => {
    render(<LocaleSwitcher />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows the current locale as selected", () => {
    render(<LocaleSwitcher />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("en");
  });

  it("has the correct aria-label", () => {
    render(<LocaleSwitcher />);
    expect(screen.getByLabelText("Language")).toBeInTheDocument();
  });

  it("lists all available locales", () => {
    render(<LocaleSwitcher />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const options = select.querySelectorAll("option");
    expect(options.length).toBe(57);
    const texts = Array.from(options).map((o) => o.textContent);
    expect(texts).toEqual(optionTexts());
  });

  it("marks partial locales while keeping fully translated ones plain", () => {
    render(<LocaleSwitcher />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll("option"));
    for (const option of options) {
      const coverage = localeCoverage[option.value];
      if (coverage !== undefined && coverage < 100) {
        expect(option.textContent).toContain("(partial)");
      } else {
        expect(option.textContent).not.toContain("(partial)");
      }
    }
    expect(select.querySelector('option[value="en"]')?.textContent).toBe("English");
    expect(select.querySelector('option[value="ru"]')?.textContent).toBe("Русский");
  });

  it("navigates on locale change", async () => {
    mockPush.mockClear();
    render(<LocaleSwitcher />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    await userEvent.selectOptions(select, "ru");
    expect(mockPush).toHaveBeenCalledWith("/ru");
  });

  it("falls back to en when pathname has no locale", () => {
    mockPathname.mockReturnValue("/");
    render(<LocaleSwitcher />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("en");
  });
});