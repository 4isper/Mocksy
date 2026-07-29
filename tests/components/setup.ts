import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = { en: "English", ru: "Русский", locale: "Locale" };
    return messages[key] ?? key;
  }
}));

export const mockPush = vi.fn();
export const mockPathname = vi.fn().mockReturnValue("/en");

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() })
}));
