import type { Metadata, Viewport } from "next";
import "../globals.css";
import { ThemeProvider } from "@/components/editor/ThemeProvider";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { PwaRegister } from "@/components/editor/PwaRegister";

const VALID_LOCALES = ["en", "ru"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = VALID_LOCALES.includes(locale) ? locale : "en";
  const messages = await getMessages({ locale: resolvedLocale });
  const t = messages.metadata;
  return {
    title: t?.title ?? "Mocksy — Free mockup editor",
    description: t?.description ?? "Create mockups, animations and exports without subscriptions.",
    manifest: "/manifest.json",
    icons: [
      { rel: "icon", url: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", url: "/icon-192.png" }
    ]
  };
}

export function generateViewport(): Viewport {
  return { themeColor: "#6366f1" };
}

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const resolvedLocale = VALID_LOCALES.includes(locale) ? locale : "en";
  const messages = await getMessages({ locale: resolvedLocale });

  return (
    <html lang={resolvedLocale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
