import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mocksy - Free Shots Clone",
  description: "Create mockups, animations and exports without subscriptions."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
