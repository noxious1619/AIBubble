import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Bubble Doomsday Clock | Real-Time Market Fragility Index",
  description: "Real-time econophysics LPPLS model and macro stress indexing tracking artificial intelligence market fragility.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    title: "AI Bubble Doomsday Clock",
    description: "Real-time LPPLS log-periodic power law regression and macro stress indexing tracking AI market fragility.",
    url: "/",
    siteName: "AI Bubble Doomsday Clock",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "AI Bubble Doomsday Clock Live Status",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Bubble Doomsday Clock",
    description: "Real-time LPPLS log-periodic power law regression and macro stress indexing tracking AI market fragility.",
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
