import type { Metadata, Viewport } from "next";
import "../globals.css";
import { ThemeProvider } from "@/components/editor/ThemeProvider";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { PwaRegister } from "@/components/editor/PwaRegister";
import { SkipLink } from "@/components/editor/SkipLink";
import { ErrorBoundary, LocalizedErrorBoundary } from "@/components/editor/ErrorBoundary";
import { isRtlLocale } from "@/i18n/request";
import { isValidLocale, locales } from "@/i18n/locales";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/state/ogScene";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = isValidLocale(locale) ? locale : "en";
  const messages = await getMessages({ locale: resolvedLocale });
  const t = messages.metadata;
  const title = t?.title ?? "Mocksy — Free mockup editor";
  const description = t?.description ?? "Create mockups, animations and exports without subscriptions.";
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // Mirror the hreflang map from sitemap so every localized route advertises
  // its siblings to search engines. The editor is a single route in [locale].
  const languages = Object.fromEntries(locales.map((locale) => [locale, `${base}/${locale}`]));
  return {
    metadataBase: new URL(base),
    title,
    description,
    alternates: {
      canonical: `${base}/${resolvedLocale}`,
      languages
    },
    openGraph: {
      title,
      description,
      siteName: "Mocksy",
      type: "website",
      images: [{ url: "/og-image.png", width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: title }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"]
    },
    manifest: "/manifest.json",
    icons: [
      { rel: "icon", url: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", url: "/icon-192.png" }
    ]
  };
}

export function generateViewport(): Viewport {
  return {
    themeColor: "#6366f1",
    // Cover the notch/home-indicator areas so the mobile tab bar's
    // env(safe-area-inset-bottom) padding resolves to a real value.
    viewportFit: "cover"
  };
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

  return (
    <html lang={resolvedLocale} dir={isRtlLocale(resolvedLocale) ? "rtl" : "ltr"} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <SkipLink />
          <LocalizedErrorBoundary>
            {/* PWA registration + update banner: lives inside the provider so
                the banner can be localized. Renders null until an update lands. */}
            <ThemeProvider>
              <PwaRegister />
              {children}
            </ThemeProvider>
          </LocalizedErrorBoundary>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
