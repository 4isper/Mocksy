import type { Metadata } from "next";
import "../globals.css";
import { ThemeProvider } from "@/components/editor/ThemeProvider";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

const VALID_LOCALES = ["en", "ru"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = VALID_LOCALES.includes(locale) ? locale : "en";
  const messages = await getMessages({ locale: resolvedLocale });
  const t = messages.metadata;
  return {
    title: t?.title ?? "Mocksy — Free mockup editor",
    description: t?.description ?? "Create mockups, animations and exports without subscriptions."
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
  const resolvedLocale = VALID_LOCALES.includes(locale) ? locale : "en";
  const messages = await getMessages({ locale: resolvedLocale });

  return (
    <html lang={resolvedLocale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
