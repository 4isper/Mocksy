import type { Metadata } from "next";
import "../globals.css";
import { ThemeProvider } from "@/components/editor/ThemeProvider";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getMessages();
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
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
