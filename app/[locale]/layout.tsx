import type { Metadata, Viewport } from "next";
import "../globals.css";
import { ThemeProvider } from "@/components/editor/ThemeProvider";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { PwaRegister } from "@/components/editor/PwaRegister";
import { SkipLink } from "@/components/editor/SkipLink";
import { ErrorBoundary } from "@/components/editor/ErrorBoundary";
import { isRtlLocale } from "@/i18n/request";
import { isValidLocale } from "@/i18n/locales";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = isValidLocale(locale) ? locale : "en";
  const messages = await getMessages({ locale: resolvedLocale });
  const t = messages.metadata;
  const errors = messages.errors;
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
  const resolvedLocale = isValidLocale(locale) ? locale : "en";
  const messages = await getMessages({ locale: resolvedLocale });
  const errors = messages.errors;

  return (
    <html lang={resolvedLocale} dir={isRtlLocale(resolvedLocale) ? "rtl" : "ltr"} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <SkipLink />
          <ErrorBoundary message={errors?.message} retryLabel={errors?.tryAgain}>
            <ThemeProvider>{children}</ThemeProvider>
          </ErrorBoundary>
        </NextIntlClientProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
