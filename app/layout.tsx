import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/editor/ThemeProvider";

export const metadata: Metadata = {
  title: "Mocksy — Free mockup editor",
  description: "Create mockups, animations and exports without subscriptions."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
